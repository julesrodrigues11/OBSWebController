/**
 * A fake OBS for tests: an obs-websocket v5 server with realistic state.
 *
 * - Speaks both message formats obs-websocket-js may use (JSON and MessagePack).
 * - Checks the password with the real challenge/response scheme.
 * - Answers the requests the app uses, changes its state like OBS would,
 *   and sends the same events (so the app's live sync is tested too).
 * - Records every request in `requests`, so tests can check exactly what was sent.
 * - Can fail requests on purpose, drop connections, and restart.
 */
import { createHash } from 'node:crypto'
import { WebSocketServer, type WebSocket } from 'ws'
import { encode, decode } from '@msgpack/msgpack'
import { demoFixture, type Fixture, type FixtureItem, type MockTransform } from './fixture'

type Json = Record<string, unknown>

interface Item {
  id: number
  sourceName: string
  inputKind: string | null
  isGroup: boolean
  isScene: boolean
  enabled: boolean
  locked: boolean
  transform: MockTransform
}

export interface RecordedRequest {
  type: string
  data: Json
}

export interface MockOptions {
  password?: string
  /** obs-websocket version reported by GetVersion. */
  wsVersion?: string
  fixture?: Fixture
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('base64')

const baseTransform = (t: Partial<MockTransform> = {}): MockTransform => ({
  positionX: 0, positionY: 0, rotation: 0, scaleX: 1, scaleY: 1,
  sourceWidth: 1920, sourceHeight: 1080, alignment: 5,
  boundsType: 'OBS_BOUNDS_NONE', boundsAlignment: 0, boundsWidth: 0, boundsHeight: 0,
  cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0, ...t,
})

/** Width/height are derived by OBS from source size, crop and scale. */
const withSize = (t: MockTransform) => ({
  ...t,
  width: (t.sourceWidth - t.cropLeft - t.cropRight) * t.scaleX,
  height: (t.sourceHeight - t.cropTop - t.cropBottom) * t.scaleY,
})

class RequestError extends Error {
  constructor(public code: number, message: string) {
    super(message)
  }
}

export class MockObs {
  readonly password: string
  port = 0
  /** Every request received, in order. */
  readonly requests: RecordedRequest[] = []

  // ---- OBS state ----
  /** Scenes and groups: name -> items, BOTTOM-first (OBS's own order). */
  readonly containers = new Map<string, Item[]>()
  /** Real scenes (not groups), bottom-first as GetSceneList returns them. */
  sceneOrder: string[] = []
  readonly groups = new Set<string>()
  inputs: Record<string, { kind: string; settings: Json; mediaState?: string }>
  defaults: Record<string, Json>
  program: string
  wsVersion: string

  private wss?: WebSocketServer
  private nextItemId = 1
  private failures: { type: string; code: number; comment?: string; times: number }[] = []

  constructor(opts: MockOptions = {}) {
    const fx = opts.fixture ?? demoFixture()
    this.password = opts.password ?? 'test-password'
    this.wsVersion = opts.wsVersion ?? '5.5.4'
    this.inputs = structuredClone(fx.inputs)
    this.defaults = structuredClone(fx.defaults)
    this.program = fx.program
    for (const scene of fx.scenes) {
      this.containers.set(scene.name, this.buildItems(scene.items))
      this.sceneOrder.unshift(scene.name) // fixture is top-first; OBS order is bottom-first
    }
  }

  private buildItems(topFirst: FixtureItem[]): Item[] {
    const items = topFirst.map((f): Item => {
      if (f.kind === 'group') {
        this.groups.add(f.name)
        this.containers.set(f.name, this.buildItems(f.children ?? []))
      }
      return {
        id: this.nextItemId++,
        sourceName: f.name,
        inputKind: f.kind === 'group' || f.kind === 'scene' ? null : f.kind,
        isGroup: f.kind === 'group',
        isScene: f.kind === 'scene',
        enabled: !f.hidden,
        locked: !!f.locked,
        transform: baseTransform(f.transform),
      }
    })
    return items.reverse()
  }

  // ---------- test controls ----------

  /** The URL the app should connect to. */
  get url() {
    return `ws://127.0.0.1:${this.port}`
  }

  /** Make the next `times` requests of this type fail with an OBS error. */
  failNext(type: string, code = 600, comment?: string, times = 1) {
    this.failures.push({ type, code, comment, times })
  }

  /** Requests of one type, in order. */
  requestsOf(type: string): Json[] {
    return this.requests.filter((r) => r.type === type).map((r) => r.data)
  }

  /** The most recent request of a type (or undefined). */
  last(type: string): Json | undefined {
    return this.requestsOf(type).at(-1)
  }

  /** Items of a scene or group, TOP-first (as the app and OBS's dock show them). */
  itemNames(container: string): string[] {
    return [...(this.containers.get(container) ?? [])].reverse().map((i) => i.sourceName)
  }

  /** Scene names TOP-first. */
  sceneNames(): string[] {
    return [...this.sceneOrder].reverse()
  }

  /** Send an event to every connected client, as if something changed in OBS. */
  emit(eventType: string, eventData: Json = {}) {
    for (const ws of this.wss?.clients ?? []) this.sendTo(ws, { op: 5, d: { eventType, eventIntent: 0xfffff, eventData } })
  }

  /** Simulate OBS crashing / the network dropping: close every connection abruptly. */
  dropConnections() {
    for (const ws of this.wss?.clients ?? []) ws.terminate()
  }

  async start(port = 0): Promise<this> {
    this.wss = new WebSocketServer({
      host: '127.0.0.1',
      port,
      // Accept whichever format the client offers (obs-websocket-js picks one per environment).
      handleProtocols: (offered) =>
        offered.has('obswebsocket.json') ? 'obswebsocket.json' : offered.has('obswebsocket.msgpack') ? 'obswebsocket.msgpack' : false,
    })
    await new Promise<void>((resolve) => this.wss!.once('listening', () => resolve()))
    this.port = (this.wss.address() as { port: number }).port
    this.wss.on('connection', (ws) => this.onConnection(ws))
    return this
  }

  async stop() {
    const wss = this.wss
    this.wss = undefined
    if (!wss) return
    for (const ws of wss.clients) ws.terminate()
    await new Promise<void>((resolve) => wss.close(() => resolve()))
  }

  /** Stop, then start again on the same port (OBS restarted). */
  async restart() {
    const port = this.port
    await this.stop()
    await this.start(port)
  }

  // ---------- protocol ----------

  private sendTo(ws: WebSocket, msg: Json) {
    if (ws.readyState !== ws.OPEN) return
    ws.send(ws.protocol === 'obswebsocket.msgpack' ? encode(msg) : JSON.stringify(msg))
  }

  private onConnection(ws: WebSocket) {
    const salt = 'mock-salt', challenge = 'mock-challenge'
    const expected = sha256(sha256(this.password + salt) + challenge)
    this.sendTo(ws, { op: 0, d: { obsWebSocketVersion: this.wsVersion, rpcVersion: 1, authentication: { challenge, salt } } })

    ws.on('message', (raw: Buffer, isBinary: boolean) => {
      const msg = (isBinary || ws.protocol === 'obswebsocket.msgpack' ? decode(raw) : JSON.parse(raw.toString())) as { op: number; d: Json }
      if (msg.op === 1) {
        if (msg.d.authentication !== expected) return ws.close(4009, 'Authentication failed.')
        return this.sendTo(ws, { op: 2, d: { negotiatedRpcVersion: 1 } })
      }
      if (msg.op !== 6) return
      const { requestType, requestId } = msg.d as { requestType: string; requestId: string }
      const data = (msg.d.requestData ?? {}) as Json
      this.requests.push({ type: requestType, data })
      let status: Json = { result: true, code: 100 }
      let responseData: Json | undefined
      try {
        const f = this.failures.find((x) => x.type === requestType)
        if (f) {
          if (--f.times <= 0) this.failures.splice(this.failures.indexOf(f), 1)
          throw new RequestError(f.code, f.comment ?? '')
        }
        responseData = this.handle(requestType, data)
      } catch (e) {
        if (!(e instanceof RequestError)) throw e
        status = { result: false, code: e.code, ...(e.message ? { comment: e.message } : {}) }
      }
      this.sendTo(ws, { op: 7, d: { requestType, requestId, requestStatus: status, ...(responseData ? { responseData } : {}) } })
    })
  }

  /** Events go out just after the response, like OBS. */
  private later(eventType: string, eventData: Json) {
    setTimeout(() => this.emit(eventType, eventData), 5)
  }

  // ---------- helpers ----------

  private container(name: unknown): Item[] {
    const c = this.containers.get(String(name))
    if (!c) throw new RequestError(600, `No source was found by the name of \`${name}\`.`)
    return c
  }

  private item(sceneName: unknown, id: unknown): Item {
    const it = this.container(sceneName).find((i) => i.id === id)
    if (!it) throw new RequestError(600, 'No scene items were found in the specified scene by that ID.')
    return it
  }

  private input(name: unknown) {
    const i = this.inputs[String(name)]
    if (!i) throw new RequestError(600, `No source was found by the name of \`${name}\`.`)
    return i
  }

  private nameTaken(name: string) {
    return name in this.inputs || this.containers.has(name)
  }

  private toJson(it: Item, index: number): Json {
    return {
      sceneItemId: it.id,
      sourceName: it.sourceName,
      sourceUuid: `uuid-${it.sourceName}`,
      inputKind: it.inputKind,
      isGroup: it.isGroup ? true : null,
      sourceType: it.isGroup || it.isScene ? 'OBS_SOURCE_TYPE_SCENE' : 'OBS_SOURCE_TYPE_INPUT',
      sceneItemEnabled: it.enabled,
      sceneItemLocked: it.locked,
      sceneItemIndex: index,
    }
  }

  /** Remove every item showing `sourceName`, everywhere, emitting events. */
  private removeEverywhere(sourceName: string) {
    for (const [name, items] of this.containers) {
      for (let k = items.length - 1; k >= 0; k--) {
        if (items[k].sourceName === sourceName) {
          const [it] = items.splice(k, 1)
          this.later('SceneItemRemoved', { sceneName: name, sourceName, sceneItemId: it.id })
        }
      }
    }
  }

  // ---------- requests ----------

  private handle(type: string, d: Json): Json | undefined {
    switch (type) {
      case 'GetVersion':
        return { obsVersion: '31.1.2', obsWebSocketVersion: this.wsVersion, rpcVersion: 1, availableRequests: [], supportedImageFormats: ['jpg', 'png'] }
      case 'GetVideoSettings':
        return { baseWidth: 1920, baseHeight: 1080, outputWidth: 1920, outputHeight: 1080, fpsNumerator: 30, fpsDenominator: 1 }
      case 'GetSourceScreenshot':
        return { imageData: 'data:image/jpg;base64,AAAA' }

      // ---- scenes ----
      case 'GetSceneList':
        return {
          currentProgramSceneName: this.program,
          currentPreviewSceneName: null,
          scenes: this.sceneOrder.map((n, i) => ({ sceneName: n, sceneUuid: `uuid-${n}`, sceneIndex: i })),
        }
      case 'SetCurrentProgramScene':
        this.container(d.sceneName)
        this.program = String(d.sceneName)
        this.later('CurrentProgramSceneChanged', { sceneName: this.program })
        return
      case 'CreateScene': {
        const name = String(d.sceneName)
        if (this.nameTaken(name)) throw new RequestError(601, 'A source already exists by that scene name.')
        this.containers.set(name, [])
        this.sceneOrder.push(name) // OBS adds new scenes at the top of the list
        this.later('SceneCreated', { sceneName: name, isGroup: false })
        this.later('SceneListChanged', { scenes: [] })
        return
      }
      case 'SetSceneName': {
        const from = String(d.sceneName), to = String(d.newSceneName)
        const items = this.container(from)
        if (this.nameTaken(to)) throw new RequestError(601, 'A source already exists by that new scene name.')
        this.containers.delete(from)
        this.containers.set(to, items)
        this.sceneOrder = this.sceneOrder.map((n) => (n === from ? to : n))
        for (const list of this.containers.values()) for (const it of list) if (it.sourceName === from) it.sourceName = to
        if (this.program === from) this.program = to
        this.later('SceneNameChanged', { oldSceneName: from, sceneName: to })
        return
      }
      case 'RemoveScene': {
        const name = String(d.sceneName)
        this.container(name)
        if (this.sceneOrder.length <= 1) throw new RequestError(702, 'You cannot remove the last scene in the collection.')
        this.containers.delete(name)
        this.sceneOrder = this.sceneOrder.filter((n) => n !== name)
        this.removeEverywhere(name)
        this.later('SceneRemoved', { sceneName: name, isGroup: false })
        this.later('SceneListChanged', { scenes: [] })
        return
      }

      // ---- scene items ----
      case 'GetSceneItemList':
      case 'GetGroupSceneItemList':
        return { sceneItems: this.container(d.sceneName).map((it, i) => this.toJson(it, i)) }
      case 'SetSceneItemEnabled': {
        const it = this.item(d.sceneName, d.sceneItemId)
        it.enabled = Boolean(d.sceneItemEnabled)
        this.later('SceneItemEnableStateChanged', { sceneName: d.sceneName, sceneItemId: it.id, sceneItemEnabled: it.enabled })
        return
      }
      case 'SetSceneItemIndex': {
        const list = this.container(d.sceneName)
        const it = this.item(d.sceneName, d.sceneItemId)
        list.splice(list.indexOf(it), 1)
        list.splice(Number(d.sceneItemIndex), 0, it)
        this.later('SceneItemListReindexed', { sceneName: d.sceneName, sceneItems: list.map((x, i) => ({ sceneItemId: x.id, sceneItemIndex: i })) })
        return
      }
      case 'GetSceneItemTransform':
        return { sceneItemTransform: withSize(this.item(d.sceneName, d.sceneItemId).transform) }
      case 'SetSceneItemTransform': {
        const it = this.item(d.sceneName, d.sceneItemId)
        const patch = d.sceneItemTransform as Partial<MockTransform>
        if (patch.scaleX === 0 || patch.scaleY === 0) throw new RequestError(402, 'The field value of `scaleX` is below the minimum.')
        Object.assign(it.transform, patch)
        this.later('SceneItemTransformChanged', { sceneName: d.sceneName, sceneItemId: it.id, sceneItemTransform: withSize(it.transform) })
        return
      }
      case 'CreateSceneItem': {
        const list = this.container(d.sceneName)
        const name = String(d.sourceName)
        const isScene = this.containers.has(name) && !this.groups.has(name)
        if (!isScene && !(name in this.inputs)) throw new RequestError(600, `No source was found by the name of \`${name}\`.`)
        const it: Item = {
          id: this.nextItemId++, sourceName: name, inputKind: isScene ? null : this.inputs[name].kind,
          isGroup: false, isScene, enabled: d.sceneItemEnabled !== false, locked: false, transform: baseTransform(),
        }
        list.push(it) // new items go on top
        this.later('SceneItemCreated', { sceneName: d.sceneName, sourceName: name, sceneItemId: it.id, sceneItemIndex: list.length - 1 })
        return { sceneItemId: it.id }
      }
      case 'RemoveSceneItem': {
        const list = this.container(d.sceneName)
        const it = this.item(d.sceneName, d.sceneItemId)
        list.splice(list.indexOf(it), 1)
        this.later('SceneItemRemoved', { sceneName: d.sceneName, sourceName: it.sourceName, sceneItemId: it.id })
        return
      }

      // ---- inputs ----
      case 'GetInputList':
        return { inputs: Object.entries(this.inputs).map(([n, v]) => ({ inputName: n, inputUuid: `uuid-${n}`, inputKind: v.kind, unversionedInputKind: v.kind.replace(/_v\d+$/, '') })) }
      case 'GetInputKindList':
        return { inputKinds: ['browser_source', 'ffmpeg_source', 'image_source', 'slideshow', 'slideshow_v2', 'text_gdiplus_v2', 'text_gdiplus_v3', 'dshow_input'] }
      case 'GetInputDefaultSettings':
        return { defaultInputSettings: this.defaults[String(d.inputKind)] ?? {} }
      case 'GetInputSettings': {
        const i = this.input(d.inputName)
        return { inputSettings: i.settings, inputKind: i.kind }
      }
      case 'SetInputSettings': {
        const i = this.input(d.inputName)
        const patch = d.inputSettings as Json
        i.settings = d.overlay === false ? { ...patch } : { ...i.settings, ...patch }
        this.later('InputSettingsChanged', { inputName: d.inputName, inputUuid: `uuid-${d.inputName}`, inputSettings: i.settings })
        return
      }
      case 'PressInputPropertiesButton':
        this.input(d.inputName)
        return
      case 'GetMediaInputStatus':
        return { mediaState: this.input(d.inputName).mediaState ?? 'OBS_MEDIA_STATE_NONE', mediaDuration: null, mediaCursor: null }
      case 'TriggerMediaInputAction': {
        const i = this.input(d.inputName)
        const action = String(d.mediaAction).split('_').pop()
        const state = ({ PLAY: 'PLAYING', PAUSE: 'PAUSED', STOP: 'STOPPED', RESTART: 'PLAYING' } as Record<string, string>)[action ?? '']
        if (state) i.mediaState = `OBS_MEDIA_STATE_${state}`
        this.later('MediaInputActionTriggered', { inputName: d.inputName, mediaAction: d.mediaAction })
        return
      }
      case 'CreateInput': {
        const name = String(d.inputName)
        const list = this.container(d.sceneName)
        if (this.nameTaken(name)) throw new RequestError(601, 'A source already exists by that input name.')
        this.inputs[name] = { kind: String(d.inputKind), settings: (d.inputSettings as Json) ?? {} }
        const it: Item = {
          id: this.nextItemId++, sourceName: name, inputKind: String(d.inputKind), isGroup: false, isScene: false,
          enabled: d.sceneItemEnabled !== false, locked: false, transform: baseTransform(),
        }
        list.push(it)
        this.later('InputCreated', { inputName: name, inputKind: d.inputKind })
        this.later('SceneItemCreated', { sceneName: d.sceneName, sourceName: name, sceneItemId: it.id, sceneItemIndex: list.length - 1 })
        return { inputUuid: `uuid-${name}`, sceneItemId: it.id }
      }
      case 'RemoveInput': {
        const name = String(d.inputName)
        this.input(name)
        delete this.inputs[name]
        this.removeEverywhere(name)
        this.later('InputRemoved', { inputName: name, inputUuid: `uuid-${name}` })
        return
      }

      default:
        throw new RequestError(204, `Unknown request type in mock: ${type}`)
    }
  }
}

/** Create and start a mock OBS on a free port. */
export async function startMockObs(opts: MockOptions = {}) {
  return new MockObs(opts).start()
}
