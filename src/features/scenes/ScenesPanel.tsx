import { useMemo, useState } from 'react'
import { useConnection } from '../../store/connection'
import { useScenes } from '../../store/scenes'
import { NewScene } from './NewScene'
import type { ScenesPanelState } from './panelState'
import { ProgramPreview } from './ProgramPreview'
import { ScenePreview } from './ScenePreview'
import { filterScenes } from './rows'
import { SceneSection } from './SceneSection'
import { useCollapsed } from './useCollapsed'

/**
 * The Scenes panel: header (filter, expand/collapse, + Scene), preview, errors, and one
 * SceneSection per scene. Holds the panel-wide state shared by the sections (see panelState.ts).
 */
export function ScenesPanel() {
  const scenes = useConnection((s) => s.scenes)
  const programScene = useConnection((s) => s.programScene)
  const actionError = useConnection((s) => s.actionError)
  const clearActionError = useConnection((s) => s.clearActionError)
  const items = useScenes((s) => s.items)
  const loading = useScenes((s) => s.loading)
  const error = useScenes((s) => s.error)
  const clearError = useScenes((s) => s.clearError)

  const collapsed = useCollapsed()
  const [filter, setFilter] = useState('')
  const [creatingScene, setCreatingScene] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [openEditors, setOpenEditors] = useState<Set<string>>(() => new Set())

  const ui: ScenesPanelState = {
    adding, setAdding,
    renaming, setRenaming,
    finishRename(oldName, newName) {
      setRenaming(null)
      if (newName) collapsed.rename(oldName, newName)
    },
    confirming, setConfirming,
    openEditors,
    toggleEditor(key) {
      const next = new Set(openEditors)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      setOpenEditors(next)
    },
  }

  const q = filter.trim().toLowerCase()
  const sections = useMemo(() => filterScenes(scenes, items, q), [scenes, items, q])

  return (
    <section className="panel scenes">
      <div className="panel__head">
        <h2>Scenes</h2>
        <input
          className="filter"
          type="search"
          placeholder="Filter…"
          title="Filter scenes and sources by name or type (Esc clears)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
        />
        <button className="button--small" onClick={() => collapsed.setAll([])} title="Expand all">Expand</button>
        <button className="button--small" onClick={() => collapsed.setAll(scenes.map((s) => s.sceneName))} title="Collapse all">Collapse</button>
        <button
          className={`button--small ${creatingScene ? 'is-active' : ''}`}
          onClick={() => setCreatingScene(!creatingScene)}
          title="Create a new empty scene"
        >
          + Scene
        </button>
      </div>

      {creatingScene && <NewScene onClose={() => setCreatingScene(false)} />}

      <ProgramPreview />
      <ScenePreview />

      {actionError && (
        <p className="error" role="alert">
          {actionError} <button className="button--link" onClick={clearActionError}>Dismiss</button>
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error} <button className="button--link" onClick={clearError}>Dismiss</button>
        </p>
      )}
      {loading && Object.keys(items).length === 0 && <p className="placeholder">Loading…</p>}
      {q && sections.length === 0 && <p className="placeholder">Nothing matches “{filter}”.</p>}

      {sections.map(({ scene, rows }) => (
        <SceneSection
          key={scene.sceneUuid}
          scene={scene}
          rows={rows}
          // While filtering, always show matches; otherwise respect the collapsed state.
          open={!!q || !collapsed.isCollapsed(scene.sceneName)}
          live={scene.sceneName === programScene}
          onToggle={() => collapsed.toggle(scene.sceneName)}
          ui={ui}
        />
      ))}
    </section>
  )
}
