import { useMemo } from 'react'
import { useConnection } from './connection'
import { useScenes, type SceneItem } from './scenes'
import { protectedContainers, useShowMode } from './showMode'

/** Pure version of useOnAirSources, for testing. */
export function onAirSources(programScene: string | null, items: Record<string, SceneItem[]>): Set<string> {
  const onAir = new Set<string>()
  const visited = new Set<string>()
  const walk = (container: string) => {
    if (visited.has(container)) return // guards against scene loops
    visited.add(container)
    for (const it of items[container] ?? []) {
      if (!it.enabled) continue
      onAir.add(it.sourceName)
      if (it.isGroup || it.isScene) walk(it.sourceName)
    }
  }
  if (programScene) walk(programScene)
  return onAir
}

/**
 * Names of sources currently visible on air: enabled items in the Program scene,
 * following into enabled groups and nested scenes.
 */
export function useOnAirSources(): Set<string> {
  const programScene = useConnection((s) => s.programScene)
  const items = useScenes((s) => s.items)

  return useMemo(() => onAirSources(programScene, items), [programScene, items])
}

/**
 * Every source inside a scene (through groups and nested scenes), including hidden ones.
 * Value: whether it's actually visible there (its item and every parent are enabled).
 */
export function sourcesInScene(scene: string, items: Record<string, SceneItem[]>): Map<string, boolean> {
  const found = new Map<string, boolean>()
  const visiting = new Set<string>()
  const walk = (container: string, parentVisible: boolean) => {
    if (visiting.has(container)) return // scene loops
    visiting.add(container)
    for (const it of items[container] ?? []) {
      const visible = parentVisible && it.enabled
      found.set(it.sourceName, (found.get(it.sourceName) ?? false) || visible)
      if (it.isGroup || it.isScene) walk(it.sourceName, visible)
    }
    visiting.delete(container)
  }
  walk(scene, true)
  return found
}

/** Scenes/groups that directly contain a source (for delete warnings). */
export function containersOf(sourceName: string, items: Record<string, SceneItem[]>): string[] {
  return Object.entries(items)
    .filter(([, list]) => list.some((it) => it.sourceName === sourceName))
    .map(([container]) => container)
}

/**
 * What show mode protects right now. `sceneLocked(container)` is true for the live scene and
 * everything nested in it; `sourceLocked(name)` for sources visible on air. Both are false
 * when show mode is off.
 */
export function useProtection() {
  const on = useShowMode((s) => s.on)
  const programScene = useConnection((s) => s.programScene)
  const items = useScenes((s) => s.items)
  const onAir = useOnAirSources()
  const containers = useMemo(() => (on ? protectedContainers(programScene, items) : new Set<string>()), [on, programScene, items])
  return {
    on,
    sceneLocked: (container: string) => containers.has(container),
    sourceLocked: (name: string) => on && onAir.has(name),
  }
}
