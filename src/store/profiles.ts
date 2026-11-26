import { create } from 'zustand'
import { STORAGE_KEYS, readJson, removeKey, writeJson } from '../lib/storage'

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
  /** Replace the whole list (used by import). */
  setAll: (profiles: Profile[]) => void
}

export const newProfileId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

interface Stored {
  profiles: Profile[]
  lastUsedId: string | null
}

function load(): Stored {
  const data = readJson<Partial<Stored> | null>(STORAGE_KEYS.profiles, null)
  if (data) {
    return { profiles: Array.isArray(data.profiles) ? data.profiles : [], lastUsedId: data.lastUsedId ?? null }
  }
  // First run of this version: migrate the single connection saved by earlier versions, if any.
  const l = readJson<{ host?: string; port?: number; password?: string; rememberPassword?: boolean } | null>(STORAGE_KEYS.legacyConnection, null)
  if (l?.host) {
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
  return { profiles: [], lastUsedId: null }
}

function persist(s: Stored) {
  // Passwords the user chose not to save never reach storage.
  const profiles = s.profiles.map((p) => (p.savePassword ? p : { ...p, password: '' }))
  writeJson(STORAGE_KEYS.profiles, { profiles, lastUsedId: s.lastUsedId })
  removeKey(STORAGE_KEYS.legacyConnection)
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

    setAll: (profiles) => update({ profiles }),
  }
})
