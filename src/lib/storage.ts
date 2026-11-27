/**
 * Small wrappers around the browser's localStorage.
 *
 * Storage can be unavailable or throw (private windows, storage disabled, quota), and saved
 * values can be corrupt. These helpers never throw: reads fall back to a default and failed
 * writes are ignored, so a storage problem only means a setting isn't remembered.
 */

/** Every key the app stores, in one place. */
export const STORAGE_KEYS = {
  // These keys keep the app's original name (OBS Web Controller) on purpose: renaming them
  // would make every browser lose its saved connections and settings. Users never see them.
  profiles: 'obs-web-controller:profiles',
  legacyConnection: 'obs-web-controller:connection', // from early versions; migrated into profiles
  collapsedScenes: 'obs-web-controller:collapsed-scenes',
  previewOpen: 'obs-web-controller:preview-open',
  previewRate: 'obs-web-controller:preview-rate',
  lockAspect: 'obs-web-controller:lock-aspect',
  sourceScope: 'obs-web-controller:source-scope',
  sourceTypes: 'obs-web-controller:source-types',
  showMode: 'obs-web-controller:show-mode',
} as const

export function readString(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeString(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable: just not remembered */
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** Read and parse JSON; `fallback` if missing or unreadable. */
export function readJson<T>(key: string, fallback: T): T {
  const raw = readString(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown) {
  writeString(key, JSON.stringify(value))
}
