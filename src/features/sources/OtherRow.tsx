import { useState } from 'react'
import { obs, errorText } from '../../obs/client'
import { kindLabel } from '../../obs/kinds'
import type { Settings } from '../../store/inputs'
import { TrashIcon } from '../../components/icons'
import { DeleteSourceConfirm } from './SourceRow'

/**
 * A source type without an editor yet: shows its kind and, on demand, the raw settings
 * (fetched only when opened, since these sources aren't loaded up front).
 */
export function OtherRow({ name, kind, live, dim }: { name: string; kind: string; live: boolean; dim?: boolean }) {
  const [raw, setRaw] = useState<Settings | string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const open = raw !== null

  async function toggle() {
    if (open) return setRaw(null)
    try {
      const res = await obs.call('GetInputSettings', { inputName: name })
      setRaw(res.inputSettings as Settings)
    } catch (e) {
      setRaw(`Couldn't read settings: ${errorText(e)}`)
    }
  }

  const label = kindLabel(kind)
  return (
    <div className={`srow ${live ? 'is-live' : ''} ${open ? 'is-open' : ''} ${dim ? 'is-dim' : ''}`}>
      <div className="srow__name" title={name}>
        <span className="srow__label">{name}</span>
        {live && <span className="badge badge--live" title="Visible on air right now">LIVE</span>}
      </div>
      <div className="muted other__kind">
        {label}
        {label !== kind && <span className="other__id"> ({kind})</span>}
      </div>
      <div className="srow__actions">
        <button className={`chip ${open ? 'is-active' : ''}`} onClick={() => void toggle()} title="Show this source's stored settings (values left at defaults are omitted)">
          {'{ }'}
        </button>
        <button className="icon-button icon-button--danger is-off" onClick={() => setConfirming(true)} title="Delete this source…">
          <TrashIcon />
        </button>
      </div>
      {confirming && <DeleteSourceConfirm name={name} onDone={() => setConfirming(false)} />}
      {open && (
        <div className="srow__panel">
          <pre className="raw">{typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
