import { useState } from 'react'
import { ChevronIcon } from '../../components/icons'
import { useConnection } from '../../store/connection'
import { useScenePreview } from '../../store/scenePreview'
import { useShowMode } from '../../store/showMode'
import { GoLiveConfirm } from './GoLiveConfirm'
import { PreviewFrame } from './ProgramPreview'
import { useCanvasAspect, useSnapshots } from './useSnapshots'

const RATES = [1, 2, 5]

/**
 * "Preview: <scene>": a snapshot of any scene, shown under the live preview so both can be
 * watched while preparing the next scene. Off until opened; runs slower than the live one.
 */
export function ScenePreview() {
  const scenes = useConnection((s) => s.scenes)
  const programScene = useConnection((s) => s.programScene)
  const goLive = useConnection((s) => s.goLive)
  const showMode = useShowMode((s) => s.on)
  const { scene: chosen, open, rate, show, setOpen, setRate } = useScenePreview()
  const [confirming, setConfirming] = useState(false)
  const aspect = useCanvasAspect()

  // A scene that was deleted (or renamed in OBS while we weren't looking) can't be shown.
  const scene = chosen && scenes.some((s) => s.sceneName === chosen) ? chosen : null
  const isLive = scene !== null && scene === programScene
  const { frame, error } = useSnapshots(scene, open && scene !== null, rate)

  return (
    <div className={`preview preview--scene ${isLive ? 'is-live' : ''}`}>
      <div className="preview__head">
        <button className="scene__toggle preview__toggle" onClick={() => setOpen(!open)} aria-expanded={open} title="Show or hide the scene preview">
          <ChevronIcon open={open} />
          <span className="scene__name">Preview</span>
        </button>
        <select
          className="preview__scene"
          aria-label="Scene to preview"
          value={scene ?? ''}
          onChange={(e) => e.target.value && show(e.target.value)}
        >
          {!scene && <option value="">Choose a scene…</option>}
          {scenes.map((s) => (
            <option key={s.sceneName} value={s.sceneName}>
              {s.sceneName}{s.sceneName === programScene ? ' (live)' : ''}
            </option>
          ))}
        </select>
        {open && scene && (
          <select className="preview__rate" value={rate} title="Time between preview frames" onChange={(e) => setRate(Number(e.target.value))}>
            {RATES.map((r) => <option key={r} value={r}>every {r}s</option>)}
          </select>
        )}
        {scene && (isLive ? (
          <span className="badge badge--live">LIVE</span>
        ) : (
          <button
            className="button--golive"
            onClick={() => (showMode ? setConfirming(true) : void goLive(scene))}
            title="Switch the live (Program) scene to this one"
          >
            Go live
          </button>
        ))}
      </div>
      {confirming && scene && !isLive && <GoLiveConfirm name={scene} onDone={() => setConfirming(false)} />}
      {open && (scene ? (
        <PreviewFrame frame={frame} error={error} aspect={aspect} alt={`Snapshot of ${scene}`} />
      ) : (
        <p className="muted preview__hint">Choose a scene above, or use the preview button on a scene, to see it here without putting it on air.</p>
      ))}
    </div>
  )
}
