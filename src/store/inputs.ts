import { create } from 'zustand'
import { obs, errorText, labelled } from '../obs/client'
import { useConnection } from './connection'
import { onAirSources } from './live'
import { useScenes } from './scenes'
import { SHOW_MODE_BLOCKED, protectedContainers, useShowMode } from './showMode'

export type Category = 'browser' | 'media' | 'image' | 'slideshow' | 'text'
export type Settings = Record<string, unknown>

/** Which table an input kind belongs to (prefix match: kinds carry version suffixes). */
export function categoryOf(kind: string): Category | null {
  if (kind.startsWith('browser_source')) return 'browser'
  if (kind.startsWith('ffmpeg_source')) return 'media'
  if (kind.startsWith('image_source')) return 'image'
  if (kind.startsWith('slideshow')) return 'slideshow'
  if (kind.startsWith('text_gdiplus') || kind.startsWith('text_ft2')) return 'text'
  return null
}

export interface InputInfo {
  name: string
  uuid: string
  kind: string
  category: Category | null
}

export const MediaAction = {
  play: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY',
  pause: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE',
  restart: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
  stop: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP',
  next: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_NEXT',
  previous: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PREVIOUS',
} as const
export type MediaActionName = keyof typeof MediaAction

interface InputsState {
  inputs: InputInfo[]
  /** Full settings per input name: kind defaults overlaid with the input's own values. */
  settings: Record<string, Settings>
  /** OBS media state per media/slideshow input, e.g. OBS_MEDIA_STATE_PLAYING. */
  mediaState: Record<string, string>
  loading: boolean
  error: string | null
  /** Inputs whose settings couldn't be read, with the reason. Shown as rows instead of hiding the table. */
  rowErrors: Record<string, string>

  /** Change settings. Shallow merge: nested objects (e.g. `font`) and arrays (e.g. `files`) must be sent whole. */
  setSettings: (inputName: string, patch: Settings) => Promise<void>
  pressButton: (inputName: string, propertyName: string) => Promise<void>
  mediaAction: (inputName: string, action: MediaActionName) => Promise<void>
  clearError: () => void
  /** Delete a source from every scene. No undo. */
  deleteInput: (inputName: string) => Promise<void>
  /** Create a new source directly in a scene. Resolves to an error message, or null on success. */
  createInput: (sceneName: string, inputName: string, category: Category, settings: Settings, enabled: boolean) => Promise<string | null>
}

/** Kind-ID prefixes to try per category, in order of preference (Windows GDI+ text before FreeType). */
const KIND_PREFIXES: Record<Category, string[]> = {
  browser: ['browser_source'],
  media: ['ffmpeg_source'],
  image: ['image_source'],
  slideshow: ['slideshow'],
  text: ['text_gdiplus', 'text_ft2_source'],
}

/**
 * Pick the newest available kind ID for a category from OBS's list,
 * e.g. text_gdiplus_v3 over text_gdiplus_v2, slideshow_v2 over slideshow.
 */
export function resolveKind(category: Category, available: string[]): string | null {
  const version = (k: string) => Number(/_v(\d+)$/.exec(k)?.[1] ?? 1)
  for (const prefix of KIND_PREFIXES[category]) {
    const matches = available.filter((k) => k === prefix || /^_v\d+$/.test(k.slice(prefix.length)) && k.startsWith(prefix))
    if (matches.length) return matches.sort((a, b) => version(b) - version(a))[0]
  }
  return null
}

let kindListCache: string[] | null = null

const MEDIA_CATEGORIES: (Category | null)[] = ['media', 'slideshow']

// Defaults per input kind, cached for the connection (they don't change at runtime).
let defaultsCache: Record<string, Settings> = {}
let loadToken = 0

async function defaultsFor(kind: string): Promise<Settings> {
  if (!defaultsCache[kind]) {
    try {
      const res = await obs.call('GetInputDefaultSettings', { inputKind: kind })
      defaultsCache[kind] = res.defaultInputSettings as Settings
    } catch (e) {
      // Not fatal: without defaults, fields left at OBS defaults just show blank/fallback values.
      console.warn(`[OBS] GetInputDefaultSettings for ${kind} failed; continuing without defaults`, e)
      defaultsCache[kind] = {}
    }
  }
  return defaultsCache[kind]
}

async function fetchSettings(input: InputInfo): Promise<Settings> {
  // GetInputSettings omits values left at their defaults, so overlay them on the kind's defaults.
  const [defaults, res] = await Promise.all([
    defaultsFor(input.kind),
    labelled(`GetInputSettings “${input.name}”`, obs.call('GetInputSettings', { inputName: input.name })),
  ])
  return { ...defaults, ...(res.inputSettings as Settings) }
}

async function fetchMediaState(name: string): Promise<string> {
  const res = await obs.call('GetMediaInputStatus', { inputName: name })
  return res.mediaState
}

/** Show mode: sources visible on air can't be changed (see store/showMode.ts). */
function onAirAndProtected(inputName: string) {
  if (!useShowMode.getState().on) return false
  return onAirSources(useConnection.getState().programScene, useScenes.getState().items).has(inputName)
}

/** Show mode: nothing can be added to the live scene or anything nested in it. */
function sceneProtected(sceneName: string) {
  if (!useShowMode.getState().on) return false
  return protectedContainers(useConnection.getState().programScene, useScenes.getState().items).has(sceneName)
}

export const useInputs = create<InputsState>()((set, get) => {
  async function loadAll() {
    const token = ++loadToken
    set({ loading: true })
    try {
      const res = await labelled('GetInputList', obs.call('GetInputList'))
      const inputs: InputInfo[] = (res.inputs as unknown as { inputName: string; inputUuid: string; inputKind: string }[])
        .map((i) => ({ name: i.inputName, uuid: i.inputUuid, kind: i.inputKind, category: categoryOf(i.inputKind) }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))

      const relevant = inputs.filter((i) => i.category)
      // One failing source must not hide the others.
      const results = await Promise.allSettled(relevant.map(fetchSettings))
      const settings: Record<string, Settings> = {}
      const rowErrors: Record<string, string> = {}
      results.forEach((r, n) => {
        if (r.status === 'fulfilled') settings[relevant[n].name] = r.value
        else rowErrors[relevant[n].name] = errorText(r.reason)
      })
      const media = relevant.filter((i) => MEDIA_CATEGORIES.includes(i.category) && settings[i.name])
      const states = await Promise.all(media.map((i) => fetchMediaState(i.name).catch(() => 'OBS_MEDIA_STATE_NONE')))

      if (token !== loadToken) return
      set({
        inputs,
        settings,
        rowErrors,
        mediaState: Object.fromEntries(media.map((i, n) => [i.name, states[n]])),
        loading: false,
        error: null,
      })
    } catch (e) {
      if (token !== loadToken) return
      set({ loading: false, error: `Couldn't load sources: ${errorText(e)}` })
    }
  }

  async function refreshOne(name: string) {
    const input = get().inputs.find((i) => i.name === name)
    if (!input?.category) return
    try {
      const s = await fetchSettings(input)
      const { [name]: _, ...rowErrors } = get().rowErrors
      set({ settings: { ...get().settings, [name]: s }, rowErrors })
    } catch {
      void loadAll() // renamed or removed meanwhile
    }
  }

  const mediaTimers: Record<string, ReturnType<typeof setTimeout>> = {}
  function refreshMediaState(name: string) {
    // Small delay: OBS reports the state a moment after the action.
    clearTimeout(mediaTimers[name])
    mediaTimers[name] = setTimeout(() => {
      fetchMediaState(name)
        .then((st) => set({ mediaState: { ...get().mediaState, [name]: st } }))
        .catch(() => {})
    }, 150)
  }

  useConnection.subscribe((s, prev) => {
    if (s.status === 'connected' && prev.status !== 'connected') {
      defaultsCache = {}
      kindListCache = null
      void loadAll()
    } else if (s.status === 'disconnected' || s.status === 'error') {
      loadToken++
      set({ inputs: [], settings: {}, rowErrors: {}, mediaState: {}, loading: false, error: null })
    }
  })

  obs.on('InputCreated', () => void loadAll())
  obs.on('InputRemoved', () => void loadAll())
  obs.on('InputNameChanged', () => void loadAll())
  // obs-websocket 5.4+: edits from anywhere (OBS itself, other clients) arrive here.
  obs.on('InputSettingsChanged', (e) => {
    const input = get().inputs.find((i) => i.name === e.inputName)
    if (!input?.category) return
    const defaults = defaultsCache[input.kind] ?? {}
    set({ settings: { ...get().settings, [e.inputName]: { ...defaults, ...(e.inputSettings as Settings) } } })
  })
  obs.on('MediaInputPlaybackStarted', (e) => refreshMediaState(e.inputName))
  obs.on('MediaInputPlaybackEnded', (e) => refreshMediaState(e.inputName))
  obs.on('MediaInputActionTriggered', (e) => refreshMediaState(e.inputName))

  return {
    inputs: [],
    settings: {},
    rowErrors: {},
    mediaState: {},
    loading: false,
    error: null,

    setSettings: async (inputName, patch) => {
      if (onAirAndProtected(inputName)) {
        set({ error: SHOW_MODE_BLOCKED })
        await refreshOne(inputName) // put back what OBS has, in case a field showed the change
        return
      }
      const prev = get().settings[inputName]
      if (prev) set({ settings: { ...get().settings, [inputName]: { ...prev, ...patch } } }) // optimistic
      try {
        await obs.call('SetInputSettings', { inputName, inputSettings: patch as never, overlay: true })
      } catch (e) {
        set({ error: `Couldn't update “${inputName}”: ${errorText(e)}` })
      }
      // Re-read: confirms the change on older OBS (no InputSettingsChanged) and restores truth on failure.
      await refreshOne(inputName)
    },

    pressButton: async (inputName, propertyName) => {
      if (onAirAndProtected(inputName)) return set({ error: SHOW_MODE_BLOCKED })
      try {
        await obs.call('PressInputPropertiesButton', { inputName, propertyName })
      } catch (e) {
        set({ error: `Couldn't press “${propertyName}” on “${inputName}”: ${errorText(e)}` })
      }
    },

    mediaAction: async (inputName, action) => {
      if (onAirAndProtected(inputName)) return set({ error: SHOW_MODE_BLOCKED })
      try {
        await obs.call('TriggerMediaInputAction', { inputName, mediaAction: MediaAction[action] })
      } catch (e) {
        set({ error: `Couldn't ${action} “${inputName}”: ${errorText(e)}` })
      }
      refreshMediaState(inputName)
    },

    clearError: () => set({ error: null }),

    createInput: async (sceneName, inputName, category, settings, enabled) => {
      if (sceneProtected(sceneName)) return SHOW_MODE_BLOCKED
      try {
        if (!kindListCache) {
          const res = await obs.call('GetInputKindList', { unversioned: false })
          kindListCache = res.inputKinds
        }
        const inputKind = resolveKind(category, kindListCache)
        if (!inputKind) return `This OBS has no ${category} source type available.`
        await obs.call('CreateInput', { sceneName, inputName, inputKind, inputSettings: settings as never, sceneItemEnabled: enabled })
        return null // lists refresh via InputCreated / SceneItemCreated
      } catch (e) {
        return errorText(e)
      }
    },

    deleteInput: async (inputName) => {
      if (onAirAndProtected(inputName)) return set({ error: SHOW_MODE_BLOCKED })
      try {
        await obs.call('RemoveInput', { inputName })
        // Lists refresh via InputRemoved / SceneItemRemoved.
      } catch (e) {
        set({ error: `Couldn't delete “${inputName}”: ${errorText(e)}` })
      }
    },
  }
})
