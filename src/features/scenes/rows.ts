import { kindLabel } from '../../obs/kinds'
import type { SceneInfo } from '../../store/connection'
import type { SceneItem } from '../../store/scenes'

/** One line in a scene's item list. `container` is the scene or group the item belongs to. */
export type Row = { item: SceneItem; container: string; depth: number }

/** Flatten a container's items (and group children) into rows, applying the filter. */
export function buildRows(container: string, items: Record<string, SceneItem[]>, q: string, depth = 0): Row[] {
  const rows: Row[] = []
  for (const item of items[container] ?? []) {
    const children = item.isGroup ? buildRows(item.sourceName, items, q, depth + 1) : []
    const label = kindLabel(item.inputKind, item).toLowerCase()
    const selfMatch = !q || item.sourceName.toLowerCase().includes(q) || label.includes(q)
    // A group stays visible if it or any child matches; if the group matches, show all its children.
    if (selfMatch) {
      rows.push({ item, container, depth })
      if (item.isGroup) rows.push(...(q ? buildRows(item.sourceName, items, '', depth + 1) : children))
    } else if (children.length) {
      rows.push({ item, container, depth }, ...children)
    }
  }
  return rows
}

/**
 * The scenes to show for a filter, each with its rows. A scene whose name matches shows all its
 * items; otherwise it shows only matching items, and is hidden if none match.
 */
export function filterScenes(scenes: SceneInfo[], items: Record<string, SceneItem[]>, q: string) {
  return scenes
    .map((scene) => {
      const sceneMatch = !!q && scene.sceneName.toLowerCase().includes(q)
      const rows = buildRows(scene.sceneName, items, sceneMatch ? '' : q)
      return { scene, rows, visible: !q || sceneMatch || rows.length > 0 }
    })
    .filter((s) => s.visible)
}
