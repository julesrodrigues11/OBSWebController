import { create } from 'zustand'
import { EventSubscription, type OBSWebSocketError } from 'obs-websocket-js'
import { obs, describeCloseCode, errorText, versionAtLeast, MIN_RECOMMENDED_WS_VERSION } from '../obs/client'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

/** The connection currently in use. Saved connections live in the profiles store. */
export interface ConnectionSettings {
  host: string
  port: number
  password: string
  /** Saved connection this came from, for display. */
  profileId: string | null
  profileName: string
}

export interface SceneInfo {
  sceneName: string
  sceneUuid: string
}

interface ServerInfo {
  obsVersion: string
  obsWebSocketVersion: string
  /** False on obs-websocket < 5.4: edits made directly in OBS won't sync live. */
  supportsSettingsEvents: boolean
}

interface ConnectionState {
  settings: ConnectionSettings
  status: ConnectionStatus
  error: string | null
  server: ServerInfo | null
  scenes: SceneInfo[]
  programScene: string | null
  reconnectAttempt: number

  /** Last failed action (kept separate from connection errors). */
  actionError: string | null

  setSettings: (patch: Partial<ConnectionSettings>) => void
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  /** Put a scene on air (also updates projectors showing Preview, since Studio Mode is off). */
  goLive: (sceneName: string) => Promise<void>
  clearActionError: () => void
}

const EMPTY_SETTINGS: ConnectionSettings = { host: '', port: 4455, password: '', profileId: null, profileName: '' }

// ---------- connection internals ----------

const CONNECT_TIMEOUT_MS = 5000
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000] // then stays at 10s

/** True when the user asked to disconnect, so a close event shouldn't trigger reconnects. */
let userClosed = false
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
/** Bumped on every user connect/disconnect, so stale in-flight attempts can tell they're obsolete. */
let generation = 0

function clearReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 1006 })), ms)
    p.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

// GetSceneList returns scenes bottom-to-top; reverse to match the OBS Scenes dock.
async function fetchScenes() {
  const res = await obs.call('GetSceneList')
  const scenes = (res.scenes as unknown as SceneInfo[])
    .map((s) => ({ sceneName: s.sceneName, sceneUuid: s.sceneUuid }))
    .reverse()
  return { scenes, programScene: res.currentProgramSceneName ?? null }
}

// ---------- store ----------

export const useConnection = create<ConnectionState>()((set, get) => {
  async function openSocket(isReconnect: boolean) {
    const { host, port, password } = get().settings
    const url = `ws://${host.trim()}:${port}`
    const gen = generation

    set({ status: isReconnect ? 'reconnecting' : 'connecting', error: null })

    try {
      // Make sure any half-open previous socket is gone.
      await obs.disconnect().catch(() => {})
      userClosed = false

      await withTimeout(
        obs.connect(url, password || undefined, {
          // Everything except high-volume streams (volume meters etc.).
          // SceneItemTransformChanged is opt-in (high volume); needed so open transform editors stay in sync.
          eventSubscriptions: EventSubscription.All | EventSubscription.SceneItemTransformChanged,
        }),
        CONNECT_TIMEOUT_MS,
      )

      const version = await obs.call('GetVersion')
      const { scenes, programScene } = await fetchScenes()
      if (gen !== generation) return // user disconnected or restarted meanwhile

      clearReconnect()
      set({
        status: 'connected',
        error: null,
        reconnectAttempt: 0,
        server: {
          obsVersion: version.obsVersion,
          obsWebSocketVersion: version.obsWebSocketVersion,
          supportsSettingsEvents: versionAtLeast(version.obsWebSocketVersion, MIN_RECOMMENDED_WS_VERSION),
        },
        scenes,
        programScene,
      })
    } catch (e) {
      if (gen !== generation) return
      const err = e as Partial<OBSWebSocketError>
      await obs.disconnect().catch(() => {})
      // Browsers report unreachable hosts as close code 1006; some runtimes give a string code instead.
      const code = typeof err.code === 'number' ? err.code : 1006
      const message = describeCloseCode(code, err.message)

      // Wrong password / protocol mismatch won't fix themselves: stop retrying.
      const fatal = code === 4009 || code === 4010
      if (isReconnect && !fatal && !userClosed) {
        scheduleReconnect(message)
      } else {
        set({ status: 'error', error: message })
      }
    }
  }

  function scheduleReconnect(lastError: string | null) {
    clearReconnect()
    const attempt = get().reconnectAttempt
    const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)]
    set({ status: 'reconnecting', error: lastError, reconnectAttempt: attempt + 1 })
    reconnectTimer = setTimeout(() => void openSocket(true), delay)
  }

  // Lost connection after being connected (OBS closed, network blip, PC slept).
  obs.on('ConnectionClosed', (err) => {
    if (userClosed) return
    if (get().status === 'connected') {
      scheduleReconnect(describeCloseCode(err?.code, err?.message))
    }
  })

  // Keep scene list and program scene live.
  const refreshScenes = () => {
    if (get().status !== 'connected') return
    fetchScenes().then((r) => set(r)).catch(() => {})
  }
  obs.on('SceneListChanged', refreshScenes)
  obs.on('SceneNameChanged', refreshScenes)
  obs.on('CurrentProgramSceneChanged', (e) => set({ programScene: e.sceneName }))

  return {
    settings: EMPTY_SETTINGS,
    status: 'disconnected',
    error: null,
    server: null,
    scenes: [],
    programScene: null,
    reconnectAttempt: 0,
    actionError: null,

    setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

    connect: async () => {
      generation++
      clearReconnect()
      set({ reconnectAttempt: 0 })
      await openSocket(false)
    },

    disconnect: async () => {
      generation++
      userClosed = true
      clearReconnect()
      await obs.disconnect().catch(() => {})
      set({ status: 'disconnected', error: null, server: null, scenes: [], programScene: null, reconnectAttempt: 0 })
    },

    goLive: async (sceneName) => {
      try {
        await obs.call('SetCurrentProgramScene', { sceneName })
        // programScene updates via the CurrentProgramSceneChanged event.
      } catch (e) {
        set({ actionError: `Couldn't switch to “${sceneName}”: ${errorText(e)}` })
      }
    },

    clearActionError: () => set({ actionError: null }),
  }
})
