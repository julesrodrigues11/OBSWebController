import { create } from 'zustand'
import { STORAGE_KEYS, readString, writeString } from '../lib/storage'
import type { SceneItem } from './scenes'

/**
 * Show mode: protects what's on air from accidental changes. It's a setting of this browser
 * (remembered across reloads), not shared with other browsers or stored in OBS.
 *
 * What it protects:
 * - the live (Program) scene and every group and scene inside it: visibility, order, transform,
 *   adding/removing items, rename and delete;
 * - every source that is visible on air: its settings, buttons (Refresh), media controls, delete.
 * Other scenes and sources stay editable, so the next scene can be prepared during a show.
 * Go live still works, after a confirmation.
 */
export const useShowMode = create<{ on: boolean; setOn: (on: boolean) => void }>()((set) => ({
  on: readString(STORAGE_KEYS.showMode) === 'true',
  setOn: (on) => {
    set({ on })
    writeString(STORAGE_KEYS.showMode, String(on))
  },
}))

export const SHOW_MODE_BLOCKED = 'Show mode is on: what’s on air is protected. Turn show mode off to change it.'

/** The live scene plus every group and scene nested in it (hidden ones too). */
export function protectedContainers(programScene: string | null, items: Record<string, SceneItem[]>): Set<string> {
  const found = new Set<string>()
  const walk = (container: string) => {
    if (found.has(container)) return // also guards against scene loops
    found.add(container)
    for (const it of items[container] ?? []) if (it.isGroup || it.isScene) walk(it.sourceName)
  }
  if (programScene) walk(programScene)
  return found
}
