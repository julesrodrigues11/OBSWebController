import { create } from 'zustand'
import { obs, errorText } from '../obs/client'
import { useConnection } from './connection'
import type { Transform } from '../obs/transform'
import { useUi } from './ui'
import { SHOW_MODE_BLOCKED, protectedContainers, useShowMode } from './showMode'

/** A scene item. Visibility and lock belong to the item (per scene), not to the source. */
export interface SceneItem {
  id: number
  sourceName: string
  sourceUuid: string
  inputKind: string | null
  isGroup: boolean
  /** A scene nested inside another scene (not a group). */
  isScene: boolean
  enabled: boolean
  locked: boolean
}

interface ScenesState {
  /** Items per container (scene or group name), top-to-bottom as in the OBS Sources dock. */
  items: Record<string, SceneItem[]>
  /** Names of containers that are groups (they need GetGroupSceneItemList). */
  groups: Set<string>
  loading: boolean
  error: string | null
  /** Transforms of items whose editor is open, keyed by itemKey(container, id). */
  transforms: Record<string, Transform>
  setEnabled: (container: string, itemId: number, enabled: boolean) => Promise<void>
  /** Lock or unlock an item in OBS (the padlock in OBS's Sources dock). */
  setLocked: (container: string, itemId: number, locked: boolean) => Promise<void>
  clearError: () => void
  loadTransform: (container: string, itemId: number) => Promise<void>
  setTransform: (container: string, itemId: number, patch: Partial<Transform>) => Promise<void>
  /** Remove one item from a scene/group (the source itself stays if used elsewhere). */
  removeItem: (container: string, itemId: number) => Promise<void>
  /** Delete a whole scene. No undo. */
  deleteScene: (sceneName: string) => Promise<void>
  /** Create an empty scene. Resolves to an error message, or null on success. */
  createScene: (sceneName: string) => Promise<string | null>
  /** Rename a scene. Resolves to an error message, or null on success. */
  renameScene: (oldName: string, newName: string) => Promise<string | null>
  /** Change stacking order. 'up' = towards the top of the list (drawn above more items). */
  moveItem: (container: string, itemId: number, to: 'up' | 'down' | 'top' | 'bottom') => Promise<void>
  /** Add an existing source to a scene. Resolves to an error message, or null on success. */
  addExisting: (sceneName: string, sourceName: string, enabled: boolean) => Promise<string | null>
}

export const itemKey = (container: string, itemId: number) => `${container}:${itemId}`

interface RawSceneItem {
  sceneItemId: number
  sourceName: string
  sourceUuid: string
  inputKind: string | null
  isGroup: boolean | null
  sourceType: string
  sceneItemEnabled: boolean
  sceneItemLocked: boolean
}

function toItem(r: RawSceneItem): SceneItem {
  return {
    id: r.sceneItemId,
    sourceName: r.sourceName,
    sourceUuid: r.sourceUuid,
    inputKind: r.inputKind ?? null,
    isGroup: !!r.isGroup,
    isScene: r.sourceType === 'OBS_SOURCE_TYPE_SCENE' && !r.isGroup,
    enabled: r.sceneItemEnabled,
    locked: r.sceneItemLocked,
  }
}

async function fetchContainer(name: string, isGroup: boolean): Promise<SceneItem[]> {
  const res = isGroup
    ? await obs.call('GetGroupSceneItemList', { sceneName: name })
    : await obs.call('GetSceneItemList', { sceneName: name })
  // OBS returns bottom-to-top; reverse to match the Sources dock.
  return (res.sceneItems as unknown as RawSceneItem[]).map(toItem).reverse()
}

/** Fetch the given containers, then any groups found inside them. */
async function fetchWithGroups(names: string[], groups: Set<string>) {
  const items: Record<string, SceneItem[]> = {}
  let queue = names.map((n) => ({ name: n, isGroup: groups.has(n) }))
  while (queue.length) {
    const results = await Promise.all(queue.map((c) => fetchContainer(c.name, c.isGroup)))
    const next: typeof queue = []
    queue.forEach((c, i) => {
      items[c.name] = results[i]
      for (const it of results[i]) {
        if (it.isGroup && !(it.sourceName in items) && !next.some((n) => n.name === it.sourceName)) {
          groups.add(it.sourceName)
          next.push({ name: it.sourceName, isGroup: true })
        }
      }
    })
    queue = next
  }
  return items
}

let loadToken = 0

export const useScenes = create<ScenesState>()((set, get) => {
  async function loadAll() {
    const token = ++loadToken
    const sceneNames = useConnection.getState().scenes.map((s) => s.sceneName)
    set({ loading: true })
    try {
      const groups = new Set<string>()
      const items = await fetchWithGroups(sceneNames, groups)
      if (token !== loadToken) return
      // Drop transforms for items that no longer exist; editors refetch the rest as needed.
      const transforms = Object.fromEntries(
        Object.entries(get().transforms).filter(([k]) => {
          const i = k.lastIndexOf(':')
          return items[k.slice(0, i)]?.some((it) => it.id === Number(k.slice(i + 1)))
        }),
      )
      set({ items, groups, transforms, loading: false, error: null })
    } catch (e) {
      if (token !== loadToken) return
      set({ loading: false, error: `Couldn't load scene items: ${errorText(e)}` })
    }
  }

  async function reloadContainer(name: string) {
    if (useConnection.getState().status !== 'connected') return
    try {
      const groups = new Set(get().groups)
      const fresh = await fetchWithGroups([name], groups)
      set({ items: { ...get().items, ...fresh }, groups })
    } catch {
      void loadAll() // container may have been removed or renamed; resync everything
    }
  }

  /**
   * Show mode protects the live scene and what's nested in it. The UI disables those controls;
   * this also stops a change that was already under way (e.g. a field committed on blur).
   */
  function protectedByShowMode(container: string) {
    if (!useShowMode.getState().on) return false
    if (!protectedContainers(useConnection.getState().programScene, get().items).has(container)) return false
    set({ error: SHOW_MODE_BLOCKED })
    return true
  }

  /** Locked items keep their position, size and order (also guarded here, not just in the UI). */
  function isLocked(container: string, id: number) {
    return get().items[container]?.find((it) => it.id === id)?.locked ?? false
  }

  function patchItem(container: string, id: number, patch: Partial<SceneItem>) {
    const list = get().items[container]
    if (!list) return
    set({ items: { ...get().items, [container]: list.map((it) => (it.id === id ? { ...it, ...patch } : it)) } })
  }

  // React to connection changes: (re)load when connected or when the scene list changes.
  useConnection.subscribe((s, prev) => {
    if (s.status === 'connected' && (prev.status !== 'connected' || s.scenes !== prev.scenes)) {
      void loadAll()
    } else if (s.status === 'disconnected' || s.status === 'error') {
      loadToken++
      set({ items: {}, groups: new Set(), transforms: {}, loading: false, error: null })
    }
  })

  // Live updates from OBS (also fire for changes made by other clients or in OBS itself).
  obs.on('SceneItemEnableStateChanged', (e) => patchItem(e.sceneName, e.sceneItemId, { enabled: e.sceneItemEnabled }))
  obs.on('SceneItemLockStateChanged', (e) => patchItem(e.sceneName, e.sceneItemId, { locked: e.sceneItemLocked }))
  obs.on('SceneItemCreated', (e) => void reloadContainer(e.sceneName))
  obs.on('SceneItemRemoved', (e) => void reloadContainer(e.sceneName))
  obs.on('SceneItemListReindexed', (e) => void reloadContainer(e.sceneName))
  obs.on('InputNameChanged', () => void loadAll())
  // Only tracked for items whose editor is open; fires when edited here, in OBS, or by dragging.
  obs.on('SceneItemTransformChanged', (e) => {
    const key = itemKey(e.sceneName, e.sceneItemId)
    const current = get().transforms[key]
    if (current) {
      set({ transforms: { ...get().transforms, [key]: { ...current, ...(e.sceneItemTransform as unknown as Transform) } } })
    }
  })

  return {
    items: {},
    groups: new Set(),
    loading: false,
    error: null,
    transforms: {},

    setEnabled: async (container, itemId, enabled) => {
      if (protectedByShowMode(container)) return
      patchItem(container, itemId, { enabled }) // optimistic
      try {
        await obs.call('SetSceneItemEnabled', { sceneName: container, sceneItemId: itemId, sceneItemEnabled: enabled })
      } catch (e) {
        patchItem(container, itemId, { enabled: !enabled })
        set({ error: `Couldn't change visibility: ${errorText(e)}` })
      }
    },

    setLocked: async (container, itemId, locked) => {
      patchItem(container, itemId, { locked }) // optimistic
      try {
        await obs.call('SetSceneItemLocked', { sceneName: container, sceneItemId: itemId, sceneItemLocked: locked })
      } catch (e) {
        patchItem(container, itemId, { locked: !locked })
        set({ error: `Couldn't ${locked ? 'lock' : 'unlock'} item: ${errorText(e)}` })
      }
    },

    clearError: () => set({ error: null }),

    removeItem: async (container, itemId) => {
      if (protectedByShowMode(container)) return
      try {
        await obs.call('RemoveSceneItem', { sceneName: container, sceneItemId: itemId })
        // The list refreshes via the SceneItemRemoved event.
      } catch (e) {
        set({ error: `Couldn't remove item: ${errorText(e)}` })
      }
    },

    moveItem: async (container, itemId, to) => {
      const list = get().items[container]
      if (!list) return
      const from = list.findIndex((it) => it.id === itemId)
      if (from < 0 || list[from].locked || protectedByShowMode(container)) return
      const last = list.length - 1
      const target = to === 'top' ? 0 : to === 'bottom' ? last : to === 'up' ? from - 1 : from + 1
      if (target < 0 || target > last || target === from) return

      // Optimistic reorder (list is top-first, as in the Sources dock).
      const next = [...list]
      const [moved] = next.splice(from, 1)
      next.splice(target, 0, moved)
      set({ items: { ...get().items, [container]: next } })

      try {
        // OBS indexes from the bottom (0 = drawn first, underneath everything).
        await obs.call('SetSceneItemIndex', { sceneName: container, sceneItemId: itemId, sceneItemIndex: last - target })
      } catch (e) {
        set({ error: `Couldn't reorder: ${errorText(e)}` })
        void reloadContainer(container)
      }
    },

    addExisting: async (sceneName, sourceName, enabled) => {
      if (protectedByShowMode(sceneName)) return SHOW_MODE_BLOCKED
      try {
        await obs.call('CreateSceneItem', { sceneName, sourceName, sceneItemEnabled: enabled })
        return null // list refreshes via SceneItemCreated
      } catch (e) {
        return errorText(e)
      }
    },

    createScene: async (sceneName) => {
      try {
        await obs.call('CreateScene', { sceneName })
        return null // scene list refreshes via SceneListChanged
      } catch (e) {
        return errorText(e)
      }
    },

    renameScene: async (oldName, newName) => {
      if (protectedByShowMode(oldName)) return SHOW_MODE_BLOCKED
      try {
        await obs.call('SetSceneName', { sceneName: oldName, newSceneName: newName })
        // Keep the Sources panel on this scene if it was showing it.
        const { scope, setScope } = useUi.getState()
        if (scope.mode === 'scene' && scope.scene === oldName) setScope({ mode: 'scene', scene: newName })
        return null // lists refresh via SceneNameChanged
      } catch (e) {
        return errorText(e)
      }
    },

    deleteScene: async (sceneName) => {
      if (protectedByShowMode(sceneName)) return
      try {
        await obs.call('RemoveScene', { sceneName })
        // Scene list refreshes via SceneListChanged.
      } catch (e) {
        set({ error: `Couldn't delete scene “${sceneName}”: ${errorText(e)}` })
      }
    },

    loadTransform: async (container, itemId) => {
      try {
        const res = await obs.call('GetSceneItemTransform', { sceneName: container, sceneItemId: itemId })
        set({ transforms: { ...get().transforms, [itemKey(container, itemId)]: res.sceneItemTransform as unknown as Transform } })
      } catch (e) {
        set({ error: `Couldn't read transform: ${errorText(e)}` })
      }
    },

    setTransform: async (container, itemId, patch) => {
      if (protectedByShowMode(container)) return
      if (isLocked(container, itemId)) {
        set({ error: 'That item is locked: unlock it to change its position, size or crop.' })
        return
      }
      try {
        await obs.call('SetSceneItemTransform', {
          sceneName: container,
          sceneItemId: itemId,
          sceneItemTransform: patch as unknown as Record<string, number>,
        })
      } catch (e) {
        set({ error: `Couldn't change transform: ${errorText(e)}` })
      }
      // Re-read either way: OBS derives width/height, and on failure this restores the true values.
      await get().loadTransform(container, itemId)
    },
  }
})
