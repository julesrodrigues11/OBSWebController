import { useState } from 'react'
import { useConnection } from '../../store/connection'
import { ChevronIcon } from '../../components/icons'
import { STORAGE_KEYS, readString, writeString } from '../../lib/storage'
import { useCanvasAspect, useSnapshots } from './useSnapshots'

/** Seconds between frames. Each frame is a JPEG encoded by OBS, so keep this modest. */
const RATES = [0.5, 1, 2, 5]

/** Collapsible, low-rate snapshot of the Program (live) scene. Only polls while open. */
export function ProgramPreview() {
  const programScene = useConnection((s) => s.programScene)
  const [open, setOpen] = useState(() => (readString(STORAGE_KEYS.previewOpen) ?? 'true') === 'true')
  const [rate, setRate] = useState(() => Number(readString(STORAGE_KEYS.previewRate) ?? '1') || 1)
  const { frame, error } = useSnapshots(programScene, open, rate)
  const aspect = useCanvasAspect()

  function toggle() {
    const next = !open
    setOpen(next)
    writeString(STORAGE_KEYS.previewOpen, String(next))
  }

  return (
    <div className="preview preview--program">
      <div className="preview__head">
        <button className="scene__toggle" onClick={toggle} aria-expanded={open}>
          <ChevronIcon open={open} />
          <span className="scene__name">Program{programScene ? `: ${programScene}` : ''}</span>
        </button>
        {open && (
          <select
            className="preview__rate"
            value={rate}
            title="Time between preview frames"
            onChange={(e) => { const r = Number(e.target.value); setRate(r); writeString(STORAGE_KEYS.previewRate, String(r)) }}
          >
            {RATES.map((r) => <option key={r} value={r}>every {r}s</option>)}
          </select>
        )}
      </div>
      {open && <PreviewFrame frame={frame} error={error} aspect={aspect} alt={`Snapshot of ${programScene}`} />}
    </div>
  )
}

export function PreviewFrame({ frame, error, aspect, alt }: { frame: string | null; error: string | null; aspect: number; alt: string }) {
  return (
    <div className="preview__frame" style={{ aspectRatio: String(aspect) }}>
      {frame && <img src={frame} alt={alt} />}
      {error && <span className="preview__error">{error}</span>}
      {!frame && !error && <span className="muted">Loading…</span>}
    </div>
  )
}
