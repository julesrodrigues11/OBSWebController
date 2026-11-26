import { describe, expect, test } from 'vitest'
import { cleanPath, hexToObsColor, obsColorToHex } from '../../src/obs/values'

describe('cleanPath', () => {
  test('removes the quotes Windows adds with "Copy as path"', () => {
    expect(cleanPath('"D:\\Show\\logo.png"')).toBe('D:\\Show\\logo.png')
  })
  test('trims spaces and leaves unquoted paths alone', () => {
    expect(cleanPath('  D:\\Show\\logo.png ')).toBe('D:\\Show\\logo.png')
  })
  test('keeps quotes that are not around the whole path', () => {
    expect(cleanPath('D:\\"odd"\\file.png')).toBe('D:\\"odd"\\file.png')
  })
})

describe('OBS colours (stored as 0xAABBGGRR)', () => {
  test('converts to #rrggbb with red in the lowest byte', () => {
    expect(obsColorToHex(0xff0000ff)).toBe('#ff0000') // red
    expect(obsColorToHex(0xff00ff00)).toBe('#00ff00') // green
    expect(obsColorToHex(0xffff0000)).toBe('#0000ff') // blue
    expect(obsColorToHex(0xffffff)).toBe('#ffffff') // white without alpha
  })
  test('converts back, keeping the original alpha', () => {
    expect(hexToObsColor('#ff0000', 0xff000000)).toBe(0xff0000ff)
    expect(hexToObsColor('#00ff00', 0x80000000)).toBe(0x8000ff00)
    expect(hexToObsColor('#123456', 0)).toBe(0x00563412)
  })
  test('round-trips', () => {
    for (const hex of ['#000000', '#ffffff', '#e5484d', '#2ad1ff']) {
      expect(obsColorToHex(hexToObsColor(hex, 0xff000000))).toBe(hex)
    }
  })
})
