import { create } from 'zustand'
import { STORAGE_KEYS, readString, writeString } from '../lib/storage'

/**
 * The second preview panel ("Preview: <scene>"), for looking at a scene that isn't live, e.g.
 * while preparing the next one during a show. Remembered by this browser.
 */
interface ScenePreviewState {
  /** The scene to show; null until one is chosen. */
  scene: string | null
  open: boolean
  /** Seconds between frames (slower than the live preview by default, to spare OBS). */
  rate: number
  show: (scene: string) => void
  setOpen: (open: boolean) => void
  setRate: (rate: number) => void
  /** Keep following a scene that was renamed. */
  renamed: (oldName: string, newName: string) => void
}

export const useScenePreview = create<ScenePreviewState>()((set, get) => ({
  scene: readString(STORAGE_KEYS.scenePreview) || null,
  open: readString(STORAGE_KEYS.scenePreviewOpen) === 'true',
  rate: Number(readString(STORAGE_KEYS.scenePreviewRate) ?? '2') || 2,
  show: (scene) => {
    set({ scene, open: true })
    writeString(STORAGE_KEYS.scenePreview, scene)
    writeString(STORAGE_KEYS.scenePreviewOpen, 'true')
  },
  setOpen: (open) => {
    set({ open })
    writeString(STORAGE_KEYS.scenePreviewOpen, String(open))
  },
  setRate: (rate) => {
    set({ rate })
    writeString(STORAGE_KEYS.scenePreviewRate, String(rate))
  },
  renamed: (oldName, newName) => {
    if (get().scene !== oldName) return
    set({ scene: newName })
    writeString(STORAGE_KEYS.scenePreview, newName)
  },
}))
