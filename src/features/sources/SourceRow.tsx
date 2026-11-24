import { useState, type ReactNode } from 'react'
import { useInputs, type Settings } from '../../store/inputs'
import { useScenes } from '../../store/scenes'
import { containersOf } from '../../store/live'
import { ConfirmStrip } from '../../components/ConfirmStrip'
import { TrashIcon } from '../../components/icons'

interface Props {
  name: string
  live: boolean
  /** In the chosen scope but hidden there: shown greyed out. */
  dim?: boolean
  settings: Settings
  /** Cells after the name column, matching the section's columns. A function gets row controls. */
  children: ReactNode | ((row: { openExtra: () => void }) => ReactNode)
  /** Optional extra panel (e.g. slideshow file list), toggled by the row itself. */
  extra?: { label: string; title: string; render: () => ReactNode }
}

/** One row of a sources table: name, type-specific cells, and expandable extra/raw panels. */
export function SourceRow({ name, live, dim, settings, children, extra }: Props) {
  const [open, setOpen] = useState<'extra' | 'raw' | null>(null)
  const [confirming, setConfirming] = useState(false)
  const toggle = (which: 'extra' | 'raw') => setOpen(open === which ? null : which)

  return (
    <div className={`srow ${live ? 'is-live' : ''} ${open ? 'is-open' : ''} ${dim ? 'is-dim' : ''}`}>
      <div className="srow__name" title={name}>
        <span className="srow__label">{name}</span>
        {live && <span className="badge badge--live" title="Visible on air right now">LIVE</span>}
      </div>
      {typeof children === 'function' ? children({ openExtra: () => setOpen('extra') }) : children}
      <div className="srow__actions">
        {extra && (
          <button className={`chip ${open === 'extra' ? 'is-active' : ''}`} onClick={() => toggle('extra')} title={extra.title}>
            {extra.label}
          </button>
        )}
        <button className={`chip ${open === 'raw' ? 'is-active' : ''}`} onClick={() => toggle('raw')} title="Show every setting OBS stores for this source">
          {'{ }'}
        </button>
        <button className="icon-button icon-button--danger is-off" onClick={() => setConfirming(true)} title="Delete this source…">
          <TrashIcon />
        </button>
      </div>
      {confirming && <DeleteSourceConfirm name={name} onDone={() => setConfirming(false)} />}
      {open === 'extra' && extra && <div className="srow__panel">{extra.render()}</div>}
      {open === 'raw' && (
        <div className="srow__panel">
          <pre className="raw">{JSON.stringify(settings, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

/** Confirmation for deleting a source everywhere; lists where it's used. */
export function DeleteSourceConfirm({ name, onDone }: { name: string; onDone: () => void }) {
  const items = useScenes((s) => s.items)
  const deleteInput = useInputs((s) => s.deleteInput)
  const where = containersOf(name, items)
  return (
    <div className="srow__panel">
      <ConfirmStrip
        message={<>
          Delete <strong>{name}</strong>
          {where.length === 0 ? <> (it isn't in any scene)</> : <> from {where.length === 1 ? where[0] : <>all {where.length} scenes: {where.join(', ')}</>}</>}
          ? This can't be undone.
        </>}
        actions={[{ label: 'Delete source', danger: true, onClick: () => void deleteInput(name) }]}
        onCancel={onDone}
      />
    </div>
  )
}
