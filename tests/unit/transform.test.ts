import { describe, expect, test } from 'vitest'
import { croppedBase, displaySize, fmt, sizePatch, usesBounds, type Transform } from '../../src/obs/transform'

const t = (over: Partial<Transform> = {}): Transform => ({
  positionX: 0, positionY: 0, rotation: 0, scaleX: 0.5, scaleY: 0.5, width: 960, height: 540,
  sourceWidth: 1920, sourceHeight: 1080, alignment: 5, boundsType: 'OBS_BOUNDS_NONE', boundsAlignment: 0,
  boundsWidth: 0, boundsHeight: 0, cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0, ...over,
})

describe('size ↔ scale', () => {
  test('a pixel size becomes a scale factor of the source size', () => {
    expect(sizePatch(t(), 1280, 720)).toEqual({ scaleX: 1280 / 1920, scaleY: 720 / 1080 })
  })
  test('cropping is taken into account', () => {
    const cropped = t({ cropLeft: 320, cropRight: 320 }) // 1280 px wide after cropping
    expect(croppedBase(cropped)).toEqual({ w: 1280, h: 1080 })
    expect(sizePatch(cropped, 640, 540)).toEqual({ scaleX: 0.5, scaleY: 0.5 })
  })
  test('with a bounding box, size edits the box instead of the scale', () => {
    const b = t({ boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: 1920, boundsHeight: 1080 })
    expect(usesBounds(b)).toBe(true)
    expect(displaySize(b)).toEqual({ w: 1920, h: 1080 })
    expect(sizePatch(b, 960, 540)).toEqual({ boundsWidth: 960, boundsHeight: 540 })
  })
  test('refuses sizes it cannot apply', () => {
    expect(sizePatch(t(), 0, 100)).toBeNull()
    expect(sizePatch(t(), -5, 100)).toBeNull()
    expect(sizePatch(t({ sourceWidth: 0, sourceHeight: 0 }), 100, 100)).toBeNull() // source not loaded
  })
})

test('fmt shows whole numbers as-is and at most two decimals', () => {
  expect(fmt(1920)).toBe('1920')
  expect(fmt(0.6666666)).toBe('0.67')
  expect(fmt(12.5)).toBe('12.5')
})
