import { useEffect, useState } from 'react'
import { itemKey, useScenes } from '../../store/scenes'
import { NumberField } from '../../components/NumberField'
import { LinkIcon } from '../../components/icons'
import { boundsLabel, croppedBase, displaySize, sizePatch, usesBounds, type Transform } from '../../obs/transform'

interface Props {
  container: string
  itemId: number
}

const ASPECT_KEY = 'obs-web-controller:lock-aspect'
const nonNegInt = (n: number) => n >= 0
const positive = (n: number) => n > 0

export function TransformEditor({ container, itemId }: Props) {
  const t = useScenes((s) => s.transforms[itemKey(container, itemId)])
  const loadTransform = useScenes((s) => s.loadTransform)
  const setTransform = useScenes((s) => s.setTransform)
  const [lockAspect, setLockAspect] = useState(() => {
    try { return localStorage.getItem(ASPECT_KEY) !== 'false' } catch { return true }
  })

  // Always fetch fresh values when the editor opens.
  useEffect(() => {
    void loadTransform(container, itemId)
  }, [container, itemId, loadTransform])

  if (!t) return <div className="transform placeholder">Loading transform…</div>

  const apply = (patch: Partial<Transform>) => void setTransform(container, itemId, patch)
  const size = displaySize(t)
  const bounds = usesBounds(t)
  const base = croppedBase(t)
  const sizeUnknown = !bounds && (!base.w || !base.h)

  function setSize(w: number, h: number, changed: 'w' | 'h') {
    if (lockAspect && size.w > 0 && size.h > 0) {
      if (changed === 'w') h = (w * size.h) / size.w
      else w = (h * size.w) / size.h
    }
    const patch = sizePatch(t, w, h)
    if (patch) apply(patch)
  }

  function toggleAspect() {
    const next = !lockAspect
    setLockAspect(next)
    try { localStorage.setItem(ASPECT_KEY, String(next)) } catch { /* ignore */ }
  }

  return (
    <div className="transform">
      <div className="transform__group">
        <span className="transform__title">Position</span>
        <NumberField label="X" value={t.positionX} onCommit={(n) => apply({ positionX: n })} unit="px" />
        <NumberField label="Y" value={t.positionY} onCommit={(n) => apply({ positionY: n })} unit="px" />
      </div>

      <div className="transform__group">
        <span className="transform__title">Rotation</span>
        <NumberField label="°" value={t.rotation} onCommit={(n) => apply({ rotation: ((n % 360) + 360) % 360 })} />
      </div>

      <div className="transform__group">
        <span className="transform__title" title={bounds ? boundsLabel(t.boundsType) : undefined}>
          {bounds ? 'Bounds' : 'Size'}
        </span>
        <NumberField
          label="W" value={size.w} unit="px" validate={positive} disabled={sizeUnknown}
          onCommit={(n) => setSize(n, size.h, 'w')}
          title={sizeUnknown ? "Source size unknown (source may not be loaded)" : undefined}
        />
        <button
          className={`icon-button ${lockAspect ? 'is-active' : 'is-off'}`}
          onClick={toggleAspect}
          aria-pressed={lockAspect}
          title={lockAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
        >
          <LinkIcon />
        </button>
        <NumberField
          label="H" value={size.h} unit="px" validate={positive} disabled={sizeUnknown}
          onCommit={(n) => setSize(size.w, n, 'h')}
        />
        {bounds && <span className="transform__note">{boundsLabel(t.boundsType)}</span>}
      </div>

      <div className="transform__group">
        <span className="transform__title">Crop</span>
        <NumberField label="L" value={t.cropLeft} validate={nonNegInt} onCommit={(n) => apply({ cropLeft: Math.round(n) })} />
        <NumberField label="T" value={t.cropTop} validate={nonNegInt} onCommit={(n) => apply({ cropTop: Math.round(n) })} />
        <NumberField label="R" value={t.cropRight} validate={nonNegInt} onCommit={(n) => apply({ cropRight: Math.round(n) })} />
        <NumberField label="B" value={t.cropBottom} validate={nonNegInt} onCommit={(n) => apply({ cropBottom: Math.round(n) })} />
      </div>
    </div>
  )
}
