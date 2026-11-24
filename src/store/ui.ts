import { create } from 'zustand'

/** Which sources the Sources panel shows: all, whatever is live, or one chosen scene. */
export type SourceScope = { mode: 'all' } | { mode: 'live' } | { mode: 'scene'; scene: string }

const KEY = 'obs-web-controller:source-scope'

function load(): SourceScope {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v?.mode === 'all' || v?.mode === 'live') return { mode: v.mode }
    if (v?.mode === 'scene' && typeof v.scene === 'string') return { mode: 'scene', scene: v.scene }
  } catch { /* ignore */ }
  return { mode: 'live' }
}

export const useUi = create<{ scope: SourceScope; setScope: (s: SourceScope) => void }>()((set) => ({
  scope: load(),
  setScope: (scope) => {
    set({ scope })
    try { localStorage.setItem(KEY, JSON.stringify(scope)) } catch { /* ignore */ }
  },
}))
