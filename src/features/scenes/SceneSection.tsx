import { ConfirmStrip } from '../../components/ConfirmStrip'
import type { SceneInfo } from '../../store/connection'
import { containersOf, useProtection } from '../../store/live'
import { itemKey, useScenes } from '../../store/scenes'
import { AddSource } from './AddSource'
import { GoLiveConfirm } from './GoLiveConfirm'
import { ItemRow } from './ItemRow'
import type { ScenesPanelState } from './panelState'
import type { Row } from './rows'
import { SceneHeader } from './SceneHeader'

interface Props {
  scene: SceneInfo
  rows: Row[]
  open: boolean
  live: boolean
  onToggle: () => void
  ui: ScenesPanelState
}

/** One scene's box: header, add-source form, delete confirmation, and its items. */
export function SceneSection({ scene, rows, open, live, onToggle, ui }: Props) {
  const name = scene.sceneName
  const { sceneLocked } = useProtection()
  const locked = sceneLocked(name)
  return (
    <div className={`scene ${live ? 'is-live' : ''}`}>
      <SceneHeader scene={scene} open={open} live={live} onToggle={onToggle} ui={ui} />
      {ui.confirming === `golive:${name}` && <GoLiveConfirm name={name} onDone={() => ui.setConfirming(null)} />}
      {ui.adding === name && !locked && <AddSource sceneName={name} onClose={() => ui.setAdding(null)} />}
      {ui.confirming === `scene:${name}` && <SceneDeleteConfirm name={name} onDone={() => ui.setConfirming(null)} />}

      {open && (
        <ul className="items">
          {rows.length === 0 && <li className="placeholder items__empty">No sources</li>}
          {rows.map((row) => (
            <ItemRow key={itemKey(row.container, row.item.id)} row={row} ui={ui} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** Confirmation for deleting a scene; warns if it's nested inside other scenes. */
function SceneDeleteConfirm({ name, onDone }: { name: string; onDone: () => void }) {
  const items = useScenes((s) => s.items)
  const deleteScene = useScenes((s) => s.deleteScene)
  const nestedIn = containersOf(name, items)
  return (
    <ConfirmStrip
      message={<>
        Delete scene <strong>{name}</strong>? Its sources stay if they're used in other scenes.
        {nestedIn.length > 0 && <> It's also nested inside <strong>{nestedIn.join(', ')}</strong> and will disappear from there.</>}
        {' '}This can't be undone.
      </>}
      actions={[{ label: 'Delete scene', danger: true, onClick: () => void deleteScene(name) }]}
      onCancel={onDone}
    />
  )
}
