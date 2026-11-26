import { expect, test } from 'vitest'
import { kindLabel } from '../../src/obs/kinds'

test('known kinds get short labels, whatever their version suffix', () => {
  expect(kindLabel('browser_source')).toBe('Browser')
  expect(kindLabel('text_gdiplus_v2')).toBe('Text')
  expect(kindLabel('text_gdiplus_v3')).toBe('Text')
  expect(kindLabel('slideshow_v2')).toBe('Slideshow')
  expect(kindLabel('ffmpeg_source')).toBe('Media')
})

test('groups and nested scenes are labelled as such', () => {
  expect(kindLabel(null, { isGroup: true })).toBe('Group')
  expect(kindLabel(null, { isScene: true })).toBe('Scene')
})

test('unknown kinds fall back to the raw ID', () => {
  expect(kindLabel('some_plugin_source')).toBe('some_plugin_source')
  expect(kindLabel(null)).toBe('')
})
