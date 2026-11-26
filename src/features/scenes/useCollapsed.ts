import { useState } from 'react'
import { STORAGE_KEYS, readJson, writeJson } from '../../lib/storage'

/** Which scenes are collapsed, remembered in browser storage. */
export function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => new Set(readJson<string[]>(STORAGE_KEYS.collapsedScenes, [])))

  function save(next: Set<string>) {
    setCollapsed(next)
    writeJson(STORAGE_KEYS.collapsedScenes, [...next])
  }

  return {
    isCollapsed: (name: string) => collapsed.has(name),
    toggle(name: string) {
      const next = new Set(collapsed)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      save(next)
    },
    /** Collapse these scenes and expand all others (pass [] to expand everything). */
    setAll: (names: string[]) => save(new Set(names)),
    /** Keep a scene's collapsed state when it's renamed. */
    rename(oldName: string, newName: string) {
      if (!collapsed.has(oldName)) return
      const next = new Set(collapsed)
      next.delete(oldName)
      next.add(newName)
      save(next)
    },
  }
}
