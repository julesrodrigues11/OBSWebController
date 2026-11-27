import { describe, expect, test } from 'vitest'
import { assess, fmt, formatMb, shortTimecode, toStats, type Snapshot } from '../../src/obs/stats'

const snap = (over: Partial<Snapshot['stats']> = {}, stream: Snapshot['stream'] = null): Snapshot => ({
  stats: {
    cpuUsage: 10, memoryUsage: 500, availableDiskSpace: 100_000, activeFps: 30, averageFrameRenderTime: 2,
    renderSkippedFrames: 0, renderTotalFrames: 1000, outputSkippedFrames: 0, outputTotalFrames: 1000, ...over,
  },
  stream,
  record: null,
})

describe('assess', () => {
  test('the first reading has nothing to compare with, so frames are fine', () => {
    expect(assess(snap({ renderSkippedFrames: 500 }), null).render).toBe('ok')
  })

  test('only frames skipped since the last reading count (OBS counters are cumulative)', () => {
    const before = snap({ renderSkippedFrames: 50, renderTotalFrames: 1000 })
    expect(assess(snap({ renderSkippedFrames: 50, renderTotalFrames: 1060 }), before).render).toBe('ok')
    expect(assess(snap({ renderSkippedFrames: 51, renderTotalFrames: 1060 }), before).render).toBe('warn')
    expect(assess(snap({ renderSkippedFrames: 60, renderTotalFrames: 1060 }), before).render).toBe('bad') // >5%
  })

  test('encoder skips and network drops are judged separately', () => {
    const live = (skipped: number, total: number) => ({ active: true, timecode: '00:01:00.000', skippedFrames: skipped, totalFrames: total })
    const before = snap({}, live(0, 1000))
    const now = snap({ outputSkippedFrames: 2, outputTotalFrames: 1060 }, live(10, 1060))
    expect(assess(now, before)).toMatchObject({ render: 'ok', encode: 'warn', network: 'bad', overall: 'bad' })
  })

  test('a new stream (counters reset) isn\'t mistaken for a problem', () => {
    const before = { ...snap(), stream: { active: true, timecode: '01:00:00.000', skippedFrames: 900, totalFrames: 100_000 } }
    const now = { ...snap(), stream: { active: true, timecode: '00:00:04.000', skippedFrames: 0, totalFrames: 120 } }
    expect(assess(now, before).network).toBe('ok')
  })

  test('low disk space: amber under 10 GB, red under 2 GB', () => {
    expect(assess(snap({ availableDiskSpace: 50 * 1024 }), null).disk).toBe('ok')
    expect(assess(snap({ availableDiskSpace: 8 * 1024 }), null).disk).toBe('warn')
    expect(assess(snap({ availableDiskSpace: 1024 }), null).disk).toBe('bad')
  })
})

test('shortTimecode drops milliseconds and empty hours', () => {
  expect(shortTimecode('01:02:33.123')).toBe('1:02:33')
  expect(shortTimecode('00:04:10.000')).toBe('4:10')
  expect(shortTimecode('00:00:07.900')).toBe('0:07')
})

test('formatMb', () => {
  expect(formatMb(800)).toBe('800 MB')
  expect(formatMb(12_400)).toBe('12.1 GB')
})

test('toStats turns anything that isn\'t a real number into null', () => {
  const s = toStats({ cpuUsage: null, activeFps: 30, memoryUsage: 'lots', availableDiskSpace: Number.NaN })
  expect(s).toMatchObject({ cpuUsage: null, activeFps: 30, memoryUsage: null, availableDiskSpace: null, renderSkippedFrames: null })
  expect(toStats(undefined).activeFps).toBeNull()
})

test('missing values never cause a warning or a crash', () => {
  const empty = { stats: toStats({}), stream: null, record: null }
  expect(assess(empty, empty).overall).toBe('ok')
  expect(fmt(null)).toBe('?')
  expect(formatMb(null)).toBe('?')
  expect(shortTimecode(undefined)).toBe('')
})
