import { expect, test } from 'vitest'
import { filterScenes } from '../../src/features/scenes/rows'
import type { SceneItem } from '../../src/store/scenes'

let id = 1
const item = (sourceName: string, over: Partial<SceneItem> = {}): SceneItem => ({
  id: id++, sourceName, sourceUuid: sourceName, inputKind: 'image_source', isGroup: false, isScene: false, enabled: true, locked: false, ...over,
})
const scenes = [{ sceneName: 'Main', sceneUuid: 'm' }, { sceneName: 'BRB', sceneUuid: 'b' }]
const items = {
  Main: [item('Lower Third', { isGroup: true, inputKind: null }), item('Chat', { inputKind: 'browser_source' })],
  'Lower Third': [item('LT Name', { inputKind: 'text_gdiplus_v3' }), item('LT Bar')],
  BRB: [item('BRB Title', { inputKind: 'text_gdiplus_v3' })],
}
const view = (q: string) =>
  filterScenes(scenes, items, q).map((s) => `${s.scene.sceneName}: ${s.rows.map((r) => '  '.repeat(r.depth) + r.item.sourceName).join(', ')}`)

test('no filter: everything, with group contents indented', () => {
  expect(view('')).toEqual(['Main: Lower Third,   LT Name,   LT Bar, Chat', 'BRB: BRB Title'])
})

test('a matching scene name shows the whole scene', () => {
  expect(view('brb')).toEqual(['BRB: BRB Title'])
})

test('a match inside a group keeps the group visible, with only the matching child', () => {
  expect(view('lt name')).toEqual(['Main: Lower Third,   LT Name'])
})

test('a matching group shows all its children', () => {
  expect(view('lower')).toEqual(['Main: Lower Third,   LT Name,   LT Bar'])
})

test('type labels match too, across scenes', () => {
  expect(view('text')).toEqual(['Main: Lower Third,   LT Name', 'BRB: BRB Title'])
})
