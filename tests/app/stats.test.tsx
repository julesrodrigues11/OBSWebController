import { waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'
import { renderConnected } from '../helpers'

// The strip polls every 2 s, so these tests wait a little longer than usual.
const strip = () => document.querySelector('.topbar .stats') as HTMLElement | null
const soon = { timeout: 4000 }

test('shows FPS and CPU once connected, and nothing about streaming while idle', async () => {
  await renderConnected()
  await waitFor(() => expect(strip()?.textContent).toContain('30 fps'))
  expect(strip()!.textContent).toContain('CPU 12%')
  expect(strip()!.textContent).not.toMatch(/STREAM|REC/)
  expect(strip()!.title).toMatch(/render 2\.1 ms per frame/)
})

test('shows stream and recording time while they run', async () => {
  const { obs } = await renderConnected()
  obs.stream = { ...obs.stream, outputActive: true, outputTimecode: '01:02:33.456' }
  obs.record = { ...obs.record, outputActive: true, outputPaused: true, outputTimecode: '00:42:10.000' }
  await waitFor(() => expect(strip()?.textContent).toContain('STREAM 1:02:33'), soon)
  expect(strip()!.textContent).toContain('REC (paused) 42:10')
}, 10_000)

test('warns when OBS starts skipping frames, and when disk space is low', async () => {
  const { obs } = await renderConnected()
  await waitFor(() => expect(strip()).not.toBeNull())
  obs.stats = { ...obs.stats, renderSkippedFrames: 3, renderTotalFrames: 1060, availableDiskSpace: 5 * 1024 }
  await waitFor(() => expect(strip()!.textContent).toContain('⚠ 2 problems'), soon)
  expect(strip()!.classList.contains('stats--warn')).toBe(true)
  expect(strip()!.textContent).toContain('Disk 5.0 GB')
  expect(strip()!.title).toMatch(/skipping frames while rendering/)
}, 10_000)

test('copes with values OBS doesn\'t report (e.g. CPU as null): the page keeps working', async () => {
  const { obs } = await renderConnected()
  // As seen on a real OBS: cpuUsage null. Also simulate other fields missing or odd.
  obs.stats = { ...obs.stats, cpuUsage: null, availableDiskSpace: undefined, averageFrameRenderTime: 'n/a' } as never
  await waitFor(() => expect(strip()?.title).toMatch(/CPU not reported by OBS/), soon)
  expect(strip()!.textContent).toContain('30 fps')
  expect(strip()!.textContent).not.toContain('CPU')
  expect(strip()!.title).toMatch(/render \? ms per frame/)
  expect(document.querySelector('.scene')).not.toBeNull() // the rest of the app is still there
}, 10_000)
