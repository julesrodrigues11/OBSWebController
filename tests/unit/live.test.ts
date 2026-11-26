import { describe, expect, test } from 'vitest'
import { containersOf, onAirSources, sourcesInScene } from '../../src/store/live'
import type { SceneItem } from '../../src/store/scenes'

let id = 1
const item = (sourceName: string, over: Partial<SceneItem> = {}): SceneItem => ({
  id: id++, sourceName, sourceUuid: sourceName, inputKind: 'x', isGroup: false, isScene: false, enabled: true, locked: false, ...over,
})

// Live: Camera, a hidden Overlay, group "LT" (Name, hidden Bar), hidden group "Extras" (Badge), nested scene "Inner".
const items: Record<string, SceneItem[]> = {
  Live: [
    item('Camera'),
    item('Overlay', { enabled: false }),
    item('LT', { isGroup: true }),
    item('Extras', { isGroup: true, enabled: false }),
    item('Inner', { isScene: true }),
  ],
  LT: [item('Name'), item('Bar', { enabled: false })],
  Extras: [item('Badge')],
  Inner: [item('Logo'), item('Camera')],
  Other: [item('Overlay')],
}

describe('onAirSources (what is actually visible)', () => {
  test('includes visible items, visible group contents and nested scenes', () => {
    expect([...onAirSources('Live', items)].sort()).toEqual(['Camera', 'Inner', 'LT', 'Logo', 'Name'])
  })
  test('excludes hidden items and everything inside hidden groups', () => {
    const onAir = onAirSources('Live', items)
    expect(onAir.has('Overlay')).toBe(false)
    expect(onAir.has('Bar')).toBe(false)
    expect(onAir.has('Badge')).toBe(false)
  })
  test('nothing is on air without a program scene', () => {
    expect(onAirSources(null, items).size).toBe(0)
  })
  test('does not loop forever when scenes contain each other', () => {
    const loop = { A: [item('B', { isScene: true })], B: [item('A', { isScene: true })] }
    expect([...onAirSources('A', loop)].sort()).toEqual(['A', 'B'])
  })
})

describe('sourcesInScene (for the Sources scope)', () => {
  test('lists hidden sources too, marking whether each is visible there', () => {
    const m = sourcesInScene('Live', items)
    expect(m.get('Camera')).toBe(true)
    expect(m.get('Overlay')).toBe(false) // in the scene, but hidden
    expect(m.get('Badge')).toBe(false) // inside a hidden group
    expect(m.get('Logo')).toBe(true) // via the nested scene
    expect(m.has('Unrelated')).toBe(false)
  })
})

test('containersOf lists every scene/group that contains a source', () => {
  expect(containersOf('Overlay', items).sort()).toEqual(['Live', 'Other'])
  expect(containersOf('Camera', items).sort()).toEqual(['Inner', 'Live'])
  expect(containersOf('Nowhere', items)).toEqual([])
})
