/** A scene item's transform as returned by GetSceneItemTransform (OBS units: pixels and degrees). */
export interface Transform {
  positionX: number
  positionY: number
  rotation: number
  scaleX: number
  scaleY: number
  /** Rendered size: (source size - crop) × scale. Read-only in OBS. */
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  alignment: number
  boundsType: string
  boundsAlignment: number
  boundsWidth: number
  boundsHeight: number
  cropLeft: number
  cropRight: number
  cropTop: number
  cropBottom: number
  cropToBounds?: boolean
}

export const NO_BOUNDS = 'OBS_BOUNDS_NONE'

const BOUNDS_LABELS: Record<string, string> = {
  OBS_BOUNDS_NONE: 'No bounds',
  OBS_BOUNDS_STRETCH: 'Stretch to bounds',
  OBS_BOUNDS_SCALE_INNER: 'Scale to inner bounds',
  OBS_BOUNDS_SCALE_OUTER: 'Scale to outer bounds',
  OBS_BOUNDS_SCALE_TO_WIDTH: 'Scale to width of bounds',
  OBS_BOUNDS_SCALE_TO_HEIGHT: 'Scale to height of bounds',
  OBS_BOUNDS_MAX_ONLY: 'Maximum size only',
}
export const boundsLabel = (t: string) => BOUNDS_LABELS[t] ?? t

/** Width/height of the source after cropping, before scaling. 0 if unknown (e.g. source not loaded). */
export function croppedBase(t: Transform) {
  return {
    w: Math.max(0, t.sourceWidth - t.cropLeft - t.cropRight),
    h: Math.max(0, t.sourceHeight - t.cropTop - t.cropBottom),
  }
}

/** True when the item's size is controlled by its bounding box rather than its scale. */
export const usesBounds = (t: Transform) => t.boundsType !== NO_BOUNDS

/** The size shown in the editor: bounds size if bounds are active, otherwise rendered size. */
export function displaySize(t: Transform) {
  return usesBounds(t) ? { w: t.boundsWidth, h: t.boundsHeight } : { w: t.width, h: t.height }
}

/**
 * Build the transform patch for a new size. With bounds active this sets the bounds box;
 * otherwise it converts pixels to scale. Returns null if the size can't be applied.
 */
export function sizePatch(t: Transform, w: number, h: number): Partial<Transform> | null {
  if (!(w > 0 && h > 0)) return null
  if (usesBounds(t)) return { boundsWidth: w, boundsHeight: h }
  const base = croppedBase(t)
  if (!base.w || !base.h) return null
  return { scaleX: w / base.w, scaleY: h / base.h }
}

/** Round for display: whole pixels stay whole, otherwise up to 2 decimals. */
export function fmt(n: number): string {
  return String(Math.round(n * 100) / 100)
}
