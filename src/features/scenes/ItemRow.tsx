import { ConfirmStrip } from '../../components/ConfirmStrip'
import { EyeIcon, EyeOffIcon, LockIcon, TransformIcon, TrashIcon, UnlockIcon } from '../../components/icons'
import { kindLabel } from '../../obs/kinds'
import { useInputs } from '../../store/inputs'
import { containersOf, useProtection } from '../../store/live'
import { itemKey, useScenes } from '../../store/scenes'
import { OrderButtons } from './OrderButtons'
import type { ScenesPanelState } from './panelState'
import type { Row } from './rows'
import { TransformEditor } from './TransformEditor'

const indent = (depth: number, base = 8) => ({ paddingLeft: base + depth * 18 })

/** One item in a scene: visibility, name, type, order, transform editor, remove/delete. */
export function ItemRow({ row, ui }: { row: Row; ui: ScenesPanelState }) {
  const { item, container, depth } = row
  const setEnabled = useScenes((s) => s.setEnabled)
  const setLocked = useScenes((s) => s.setLocked)
  const key = itemKey(container, item.id)
  const editing = ui.openEditors.has(key)
  const onAir = useProtection().sceneLocked(container) // show mode: in the live scene
  const onAirTitle = 'Show mode: this scene is on air and protected'

  return (
    <li className={`item-wrap ${editing ? 'is-editing' : ''}`}>
      <div className={`item ${item.enabled ? '' : 'is-hidden'}`} style={indent(depth)}>
        <button
          className={`icon-button ${item.enabled ? '' : 'is-off'}`}
          onClick={() => void setEnabled(container, item.id, !item.enabled)}
          aria-pressed={item.enabled}
          disabled={onAir}
          title={onAir ? `${item.enabled ? 'Visible' : 'Hidden'}. ${onAirTitle}` : item.enabled ? 'Visible: click to hide' : 'Hidden: click to show'}
        >
          {item.enabled ? <EyeIcon /> : <EyeOffIcon />}
        </button>
        <span className="item__name">{item.sourceName}</span>
        <span className="item__kind">{kindLabel(item.inputKind, item)}</span>
        <button
          className={`icon-button item__lock ${item.locked ? 'is-locked' : 'is-off'}`}
          onClick={() => void setLocked(container, item.id, !item.locked)}
          aria-pressed={item.locked}
          title={item.locked ? 'Locked: position, size and order are protected. Click to unlock' : 'Unlocked: click to lock its position, size and order'}
        >
          {item.locked ? <LockIcon /> : <UnlockIcon />}
        </button>
        <OrderButtons container={container} itemId={item.id} locked={item.locked || onAir} />
        <button
          className={`icon-button ${editing ? 'is-active' : 'is-off'}`}
          onClick={() => ui.toggleEditor(key)}
          aria-expanded={editing}
          title={editing ? 'Close transform' : 'Edit transform'}
        >
          <TransformIcon />
        </button>
        <button
          className="icon-button icon-button--danger is-off"
          onClick={() => ui.setConfirming(`item:${key}`)}
          disabled={onAir}
          title={onAir ? onAirTitle : 'Remove or delete…'}
        >
          <TrashIcon />
        </button>
      </div>

      {ui.confirming === `item:${key}` && !onAir && (
        <div style={indent(depth)}>
          <ItemDeleteConfirm row={row} onDone={() => ui.setConfirming(null)} />
        </div>
      )}
      {editing && (
        <div style={indent(depth, 42)}>
          <TransformEditor container={container} itemId={item.id} />
        </div>
      )}
    </li>
  )
}

/**
 * "Remove from this scene", plus "Delete from all N" when the source is used elsewhere.
 * Groups and nested scenes can only be removed from the scene.
 */
function ItemDeleteConfirm({ row, onDone }: { row: Row; onDone: () => void }) {
  const { item, container } = row
  const items = useScenes((s) => s.items)
  const removeItem = useScenes((s) => s.removeItem)
  const deleteInput = useInputs((s) => s.deleteInput)
  const where = containersOf(item.sourceName, items)
  const isInput = !item.isGroup && !item.isScene
  const usedElsewhere = isInput && where.length > 1

  return (
    <ConfirmStrip
      message={<>
        <strong>{item.sourceName}</strong>
        {usedElsewhere ? <> is used in {where.length} places: {where.join(', ')}.</> : <> is only in {container}.</>}
      </>}
      actions={[
        { label: `Remove from ${container}`, danger: true, onClick: () => void removeItem(container, item.id) },
        ...(usedElsewhere
          ? [{ label: `Delete from all ${where.length}`, danger: true, onClick: () => void deleteInput(item.sourceName) }]
          : []),
      ]}
      onCancel={onDone}
    />
  )
}
