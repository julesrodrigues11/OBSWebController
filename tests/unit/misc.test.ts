import { describe, expect, test } from 'vitest'
import { describeCloseCode, errorText, versionAtLeast } from '../../src/obs/client'
import { resolveKind } from '../../src/store/inputs'
import { uniqueName } from '../../src/store/names'

describe('resolveKind (which OBS source type to create)', () => {
  test('picks the newest version available', () => {
    expect(resolveKind('slideshow', ['slideshow', 'slideshow_v2'])).toBe('slideshow_v2')
    expect(resolveKind('text', ['text_gdiplus_v2', 'text_gdiplus_v3'])).toBe('text_gdiplus_v3')
  })
  test('prefers Windows GDI+ text, falling back to FreeType', () => {
    expect(resolveKind('text', ['text_ft2_source_v2', 'text_gdiplus_v3'])).toBe('text_gdiplus_v3')
    expect(resolveKind('text', ['text_ft2_source', 'text_ft2_source_v2'])).toBe('text_ft2_source_v2')
  })
  test('does not confuse similarly named kinds', () => {
    expect(resolveKind('image', ['image_source', 'image_source_extra'])).toBe('image_source')
  })
  test('returns null when OBS lacks the type', () => {
    expect(resolveKind('browser', ['ffmpeg_source'])).toBeNull()
  })
})

describe('uniqueName', () => {
  test('uses the base name when free, otherwise numbers it', () => {
    expect(uniqueName('Scene', new Set())).toBe('Scene')
    expect(uniqueName('Scene', new Set(['Scene']))).toBe('Scene 2')
    expect(uniqueName('Scene', new Set(['Scene', 'Scene 2', 'Scene 3']))).toBe('Scene 4')
  })
})

describe('connection helpers', () => {
  test('versionAtLeast compares dotted versions numerically', () => {
    expect(versionAtLeast('5.4.0', '5.4.0')).toBe(true)
    expect(versionAtLeast('5.10.0', '5.4.0')).toBe(true)
    expect(versionAtLeast('5.3.9', '5.4.0')).toBe(false)
    expect(versionAtLeast('6', '5.4.0')).toBe(true)
  })
  test('close codes become actionable messages', () => {
    expect(describeCloseCode(4009)).toMatch(/wrong password/i)
    expect(describeCloseCode(1006)).toMatch(/firewall/i)
    expect(describeCloseCode(-1)).toMatch(/could not reach obs/i)
    expect(describeCloseCode(4321, 'Something odd')).toBe('Something odd')
    expect(describeCloseCode(undefined)).toMatch(/connection failed/i)
  })
  test('errorText includes OBS status codes and copes with empty messages', () => {
    expect(errorText({ message: 'No source', code: 600 })).toBe('No source (code 600)')
    expect(errorText({ message: '', code: 400 })).toBe('OBS gave no details (code 400)')
    expect(errorText(new Error('boom'))).toBe('boom')
  })
})
