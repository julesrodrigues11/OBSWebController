import { useEffect, useState } from 'react'
import { obs, errorText } from '../../obs/client'
import { useConnection } from '../../store/connection'
import { ChevronIcon } from '../../components/icons'

const OPEN_KEY = 'obs-web-controller:preview-open'
const RATE_KEY = 'obs-web-controller:preview-rate'
/** Seconds between frames. Each frame is a JPEG encoded by OBS, so keep this modest. */
const RATES = [0.5, 1, 2, 5]
const WIDTH = 640

function read(key: string, fallback: string) {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function write(key: string, v: string) {
  try { localStorage.setItem(key, v) } catch { /* ignore */ }
}

/**
 * Collapsible, low-rate snapshot of the Program scene (GetSourceScreenshot).
 * Only polls while open and while this browser tab is visible.
 */
export function ProgramPreview() {
  const programScene = useConnection((s) => s.programScene)
  const status = useConnection((s) => s.status)
  const [open, setOpen] = useState(() => read(OPEN_KEY, 'true') === 'true')
  const [rate, setRate] = useState(() => Number(read(RATE_KEY, '1')) || 1)
  const [frame, setFrame] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aspect, setAspect] = useState(16 / 9)

  // Canvas aspect ratio, for a stable box before the first frame arrives.
  useEffect(() => {
    if (status !== 'connected') return
    obs.call('GetVideoSettings')
      .then((v) => v.baseWidth && v.baseHeight && setAspect(v.baseWidth / v.baseHeight))
      .catch(() => {})
  }, [status])

  useEffect(() => {
    if (!open || status !== 'connected' || !programScene) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>

    async function tick() {
      if (stopped) return
      if (document.visibilityState === 'visible') {
        try {
          const res = await obs.call('GetSourceScreenshot', {
            sourceName: programScene!,
            imageFormat: 'jpg',
            imageWidth: WIDTH,
            imageCompressionQuality: 70,
          })
          if (!stopped) { setFrame(res.imageData); setError(null) }
        } catch (e) {
          if (!stopped) setError(errorText(e))
        }
      }
      // Wait for each frame before asking for the next, so a slow OBS never gets a backlog.
      if (!stopped) timer = setTimeout(tick, rate * 1000)
    }
    void tick()
    return () => { stopped = true; clearTimeout(timer) }
  }, [open, status, programScene, rate])

  function toggle() {
    const next = !open
    setOpen(next)
    write(OPEN_KEY, String(next))
  }

  return (
    <div className="preview">
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
            onChange={(e) => { const r = Number(e.target.value); setRate(r); write(RATE_KEY, String(r)) }}
          >
            {RATES.map((r) => <option key={r} value={r}>every {r}s</option>)}
          </select>
        )}
      </div>
      {open && (
        <div className="preview__frame" style={{ aspectRatio: String(aspect) }}>
          {frame && <img src={frame} alt={`Snapshot of ${programScene}`} />}
          {error && <span className="preview__error">{error}</span>}
          {!frame && !error && <span className="muted">Loading…</span>}
        </div>
      )}
    </div>
  )
}
