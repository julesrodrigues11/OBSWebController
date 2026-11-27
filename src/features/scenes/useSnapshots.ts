import { useEffect, useState } from 'react'
import { obs, errorText } from '../../obs/client'
import { useConnection } from '../../store/connection'

const WIDTH = 640

/**
 * Repeatedly asks OBS for a JPEG snapshot of a scene (GetSourceScreenshot) while `active`.
 * Waits for each frame before asking for the next, so a slow OBS never gets a backlog, and
 * pauses while this browser tab is hidden. Each frame costs OBS some work, so keep rates modest.
 */
export function useSnapshots(sceneName: string | null, active: boolean, rateSeconds: number) {
  const status = useConnection((s) => s.status)
  // Each result remembers which scene it's for, so switching scenes never shows the old picture.
  const [shot, setShot] = useState<{ scene: string; frame: string | null; error: string | null } | null>(null)

  useEffect(() => {
    if (!active || status !== 'connected' || !sceneName) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>

    async function tick() {
      if (stopped) return
      if (document.visibilityState === 'visible') {
        try {
          const res = await obs.call('GetSourceScreenshot', {
            sourceName: sceneName!,
            imageFormat: 'jpg',
            imageWidth: WIDTH,
            imageCompressionQuality: 70,
          })
          if (!stopped) setShot({ scene: sceneName!, frame: res.imageData, error: null })
        } catch (e) {
          if (!stopped) setShot((prev) => ({ scene: sceneName!, frame: prev?.scene === sceneName ? prev.frame : null, error: errorText(e) }))
        }
      }
      if (!stopped) timer = setTimeout(tick, rateSeconds * 1000)
    }
    void tick()
    return () => { stopped = true; clearTimeout(timer) }
  }, [active, status, sceneName, rateSeconds])

  const current = shot?.scene === sceneName ? shot : null
  return { frame: current?.frame ?? null, error: current?.error ?? null }
}

/** The OBS canvas's aspect ratio, so preview boxes keep their shape before the first frame. */
export function useCanvasAspect() {
  const status = useConnection((s) => s.status)
  const [aspect, setAspect] = useState(16 / 9)
  useEffect(() => {
    if (status !== 'connected') return
    obs.call('GetVideoSettings')
      .then((v) => v.baseWidth && v.baseHeight && setAspect(v.baseWidth / v.baseHeight))
      .catch(() => {})
  }, [status])
  return aspect
}
