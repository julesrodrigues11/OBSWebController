import { create } from 'zustand'

/** A saved connection to an OBS machine. */
export interface Profile {
  id: string
  name: string
  host: string
  port: number
  /** Only stored when savePassword is true; otherwise asked for at connect time. */
  password: string
  savePassword: boolean
}

interface ProfilesState {
  profiles: Profile[]
  lastUsedId: string | null
  save: (p: Profile) => void
  remove: (id: string) => void
  markUsed: (id: string) => void
}

const KEY = 'obs-web-controller:profiles'
/** Single connection saved by earlier versions of the app; migrated into a profile once. */
const LEGACY_KEY = 'obs-web-controller:connection'

export const newProfileId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

interface Stored {
  profiles: Profile[]
  lastUsedId: string | null
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const data = JSON.parse(raw) as Stored
      return { profiles: Array.isArray(data.profiles) ? data.profiles : [], lastUsedId: data.lastUsedId ?? null }
    }
    // First run of this version: migrate the old single saved connection, if any.
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const l = JSON.parse(legacy) as { host?: string; port?: number; password?: string; rememberPassword?: boolean }
      if (l.host) {
        const p: Profile = {
          id: newProfileId(),
          name: 'OBS PC',
          host: l.host,
          port: l.port ?? 4455,
          password: l.rememberPassword ? (l.password ?? '') : '',
          savePassword: !!l.rememberPassword,
        }
        return { profiles: [p], lastUsedId: p.id }
      }
    }
  } catch {
    /* corrupt or unavailable storage: start empty */
  }
  return { profiles: [], lastUsedId: null }
}

function persist(s: Stored) {
  try {
    const profiles = s.profiles.map((p) => (p.savePassword ? p : { ...p, password: '' }))
    localStorage.setItem(KEY, JSON.stringify({ profiles, lastUsedId: s.lastUsedId }))
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* storage unavailable: profiles last for this session only */
  }
}

export const useProfiles = create<ProfilesState>()((set, get) => {
  const initial = load()
  const update = (patch: Partial<Stored>) => {
    set(patch)
    persist({ profiles: get().profiles, lastUsedId: get().lastUsedId })
  }

  return {
    ...initial,

    save: (p) => {
      const exists = get().profiles.some((x) => x.id === p.id)
      update({ profiles: exists ? get().profiles.map((x) => (x.id === p.id ? p : x)) : [...get().profiles, p] })
    },

    remove: (id) =>
      update({
        profiles: get().profiles.filter((p) => p.id !== id),
        lastUsedId: get().lastUsedId === id ? null : get().lastUsedId,
      }),

    markUsed: (id) => update({ lastUsedId: id }),
  }
})
