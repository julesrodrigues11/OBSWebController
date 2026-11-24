import { useMemo, useState } from 'react'
import { useConnection } from '../../store/connection'
import { itemKey, useScenes, type SceneItem } from '../../store/scenes'
import { kindLabel } from '../../obs/kinds'
import { ChevronIcon, EyeIcon, EyeOffIcon, ListIcon, LockIcon, PlusIcon, TransformIcon, TrashIcon } from '../../components/icons'
import { AddSource } from './AddSource'
import { ConfirmStrip } from '../../components/ConfirmStrip'
import { useInputs } from '../../store/inputs'
import { containersOf } from '../../store/live'
import { useUi } from '../../store/ui'
import { TransformEditor } from './TransformEditor'
import { ProgramPreview } from './ProgramPreview'

const COLLAPSED_KEY = 'obs-web-controller:collapsed-scenes'

function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}
function saveCollapsed(s: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...s]))
  } catch {
    /* ignore */
  }
}

type Row = { item: SceneItem; container: string; depth: number }

/** Flatten a container's items (and group children) into rows, applying the filter. */
function buildRows(container: string, items: Record<string, SceneItem[]>, q: string, depth = 0): Row[] {
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

export function ScenesPanel() {
  const scenes = useConnection((s) => s.scenes)
  const programScene = useConnection((s) => s.programScene)
  const goLive = useConnection((s) => s.goLive)
  const actionError = useConnection((s) => s.actionError)
  const clearActionError = useConnection((s) => s.clearActionError)
  const items = useScenes((s) => s.items)
  const loading = useScenes((s) => s.loading)
  const error = useScenes((s) => s.error)
  const clearError = useScenes((s) => s.clearError)
  const setEnabled = useScenes((s) => s.setEnabled)
  const removeItem = useScenes((s) => s.removeItem)
  const deleteScene = useScenes((s) => s.deleteScene)
  const moveItem = useScenes((s) => s.moveItem)
  /** Scene whose "add source" form is open. */
  const [adding, setAdding] = useState<string | null>(null)
  const deleteInput = useInputs((s) => s.deleteInput)
  const scope = useUi((s) => s.scope)
  const setScope = useUi((s) => s.setScope)
  /** Which delete confirmation is open: `scene:<name>` or `item:<itemKey>`. */
  const [confirming, setConfirming] = useState<string | null>(null)

  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  /** Items whose transform editor is open (itemKey). */
  const [openEditors, setOpenEditors] = useState<Set<string>>(() => new Set())

  function toggleEditor(key: string) {
    const next = new Set(openEditors)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setOpenEditors(next)
  }
  const q = filter.trim().toLowerCase()

  const sections = useMemo(
    () =>
      scenes
        .map((scene) => {
          const sceneMatch = !!q && scene.sceneName.toLowerCase().includes(q)
          const rows = buildRows(scene.sceneName, items, sceneMatch ? '' : q)
          return { scene, rows, visible: !q || sceneMatch || rows.length > 0 }
        })
        .filter((s) => s.visible),
    [scenes, items, q],
  )

  function toggleCollapsed(name: string) {
    const next = new Set(collapsed)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setCollapsed(next)
    saveCollapsed(next)
  }
  function setAll(collapse: boolean) {
    const next = collapse ? new Set(scenes.map((s) => s.sceneName)) : new Set<string>()
    setCollapsed(next)
    saveCollapsed(next)
  }

  return (
    <section className="panel scenes">
      <div className="panel__head">
        <h2>Scenes</h2>
        <input
          className="filter"
          type="search"
          placeholder="Filter scenes and sources…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
        />
        <button className="button--small" onClick={() => setAll(false)} title="Expand all">Expand</button>
        <button className="button--small" onClick={() => setAll(true)} title="Collapse all">Collapse</button>
      </div>

      <ProgramPreview />

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

      {sections.map(({ scene, rows }) => {
        const live = scene.sceneName === programScene
        // While filtering, always show matches; otherwise respect the collapsed state.
        const open = !!q || !collapsed.has(scene.sceneName)
        return (
          <div key={scene.sceneUuid} className={`scene ${live ? 'is-live' : ''}`}>
            <div className="scene__head">
              <button className="scene__toggle" onClick={() => toggleCollapsed(scene.sceneName)} aria-expanded={open}>
                <ChevronIcon open={open} />
                <span className="scene__name">{scene.sceneName}</span>
                <span className="muted scene__count">{(items[scene.sceneName] ?? []).length}</span>
              </button>
              <button
                className={`icon-button ${adding === scene.sceneName ? 'is-active' : 'is-off'}`}
                onClick={() => setAdding(adding === scene.sceneName ? null : scene.sceneName)}
                title="Add a source to this scene"
              >
                <PlusIcon />
              </button>
              <button
                className={`icon-button ${scope.mode === 'scene' && scope.scene === scene.sceneName ? 'is-active' : 'is-off'}`}
                onClick={() => setScope({ mode: 'scene', scene: scene.sceneName })}
                title="Show only this scene's sources in the Sources panel"
              >
                <ListIcon />
              </button>
              <button
                className="icon-button icon-button--danger is-off"
                onClick={() => setConfirming(`scene:${scene.sceneName}`)}
                disabled={live || scenes.length <= 1}
                title={live ? 'This scene is live: switch to another scene before deleting it' : scenes.length <= 1 ? 'OBS needs at least one scene' : 'Delete this scene'}
              >
                <TrashIcon />
              </button>
              {live ? (
                <span className="badge badge--live">LIVE</span>
              ) : (
                <button className="button--golive" onClick={() => void goLive(scene.sceneName)} title="Switch the live (Program) scene to this one">
                  Go live
                </button>
              )}
            </div>
            {adding === scene.sceneName && <AddSource sceneName={scene.sceneName} onClose={() => setAdding(null)} />}
            {confirming === `scene:${scene.sceneName}` && (() => {
              const nestedIn = containersOf(scene.sceneName, items)
              return (
                <ConfirmStrip
                  message={<>
                    Delete scene <strong>{scene.sceneName}</strong>? Its sources stay if they're used in other scenes.
                    {nestedIn.length > 0 && <> It's also nested inside <strong>{nestedIn.join(', ')}</strong> and will disappear from there.</>}
                    {' '}This can't be undone.
                  </>}
                  actions={[{ label: 'Delete scene', danger: true, onClick: () => void deleteScene(scene.sceneName) }]}
                  onCancel={() => setConfirming(null)}
                />
              )
            })()}

            {open && (
              <ul className="items">
                {rows.length === 0 && <li className="placeholder items__empty">No sources</li>}
                {rows.map(({ item, container, depth }) => {
                  const key = itemKey(container, item.id)
                  const editing = openEditors.has(key)
                  const siblings = items[container] ?? []
                  const pos = siblings.findIndex((s) => s.id === item.id)
                  const isTop = pos <= 0
                  const isBottom = pos === siblings.length - 1
                  return (
                  <li key={key} className={`item-wrap ${editing ? 'is-editing' : ''}`}>
                  <div
                    className={`item ${item.enabled ? '' : 'is-hidden'}`}
                    style={{ paddingLeft: 8 + depth * 18 }}
                  >
                    <button
                      className={`icon-button ${item.enabled ? '' : 'is-off'}`}
                      onClick={() => void setEnabled(container, item.id, !item.enabled)}
                      aria-pressed={item.enabled}
                      title={item.enabled ? 'Visible: click to hide' : 'Hidden: click to show'}
                    >
                      {item.enabled ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                    <span className="item__name">{item.sourceName}</span>
                    <span className="item__kind">{kindLabel(item.inputKind, item)}</span>
                    {item.locked && (
                      <span className="item__lock" title="Locked in OBS">
                        <LockIcon />
                      </span>
                    )}
                    <span className="item__order" aria-label="Order">
                      <button className="order-button" disabled={isTop} onClick={() => void moveItem(container, item.id, 'top')} title="Move to top (drawn above everything)">⤒</button>
                      <button className="order-button" disabled={isTop} onClick={() => void moveItem(container, item.id, 'up')} title="Move up">▲</button>
                      <button className="order-button" disabled={isBottom} onClick={() => void moveItem(container, item.id, 'down')} title="Move down">▼</button>
                      <button className="order-button" disabled={isBottom} onClick={() => void moveItem(container, item.id, 'bottom')} title="Move to bottom (drawn underneath everything)">⤓</button>
                    </span>
                    <button
                      className={`icon-button ${editing ? 'is-active' : 'is-off'}`}
                      onClick={() => toggleEditor(key)}
                      aria-expanded={editing}
                      title={editing ? 'Close transform' : 'Edit transform'}
                    >
                      <TransformIcon />
                    </button>
                    <button
                      className="icon-button icon-button--danger is-off"
                      onClick={() => setConfirming(`item:${key}`)}
                      title="Remove or delete…"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  {confirming === `item:${key}` && (() => {
                    const where = containersOf(item.sourceName, items)
                    const isInput = !item.isGroup && !item.isScene
                    return (
                      <div style={{ paddingLeft: 8 + depth * 18 }}>
                        <ConfirmStrip
                          message={<>
                            <strong>{item.sourceName}</strong>
                            {isInput && where.length > 1 ? <> is used in {where.length} places: {where.join(', ')}.</> : <> is only in {container}.</>}
                          </>}
                          actions={[
                            { label: `Remove from ${container}`, danger: true, onClick: () => void removeItem(container, item.id) },
                            ...(isInput && where.length > 1
                              ? [{ label: `Delete from all ${where.length}`, danger: true, onClick: () => void deleteInput(item.sourceName) }]
                              : []),
                          ]}
                          onCancel={() => setConfirming(null)}
                        />
                      </div>
                    )
                  })()}
                  {editing && (
                    <div style={{ paddingLeft: 42 + depth * 18 }}>
                      <TransformEditor container={container} itemId={item.id} />
                    </div>
                  )}
                  </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </section>
  )
}
