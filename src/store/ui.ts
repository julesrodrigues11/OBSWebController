import { create } from 'zustand'
import { STORAGE_KEYS, readJson, writeJson } from '../lib/storage'

/** Which sources the Sources panel shows: all, whatever is live, or one chosen scene. */
export type SourceScope = { mode: 'all' } | { mode: 'live' } | { mode: 'scene'; scene: string }

function load(): SourceScope {
  const v = readJson<{ mode?: string; scene?: unknown } | null>(STORAGE_KEYS.sourceScope, null)
  if (v?.mode === 'all' || v?.mode === 'live') return { mode: v.mode }
  if (v?.mode === 'scene' && typeof v.scene === 'string') return { mode: 'scene', scene: v.scene }
  return { mode: 'live' }
}

export const useUi = create<{ scope: SourceScope; setScope: (s: SourceScope) => void }>()((set) => ({
  scope: load(),
  setScope: (scope) => {
    set({ scope })
    writeJson(STORAGE_KEYS.sourceScope, scope)
  },
}))
