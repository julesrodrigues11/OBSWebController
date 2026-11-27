import { fireEvent, waitFor, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { useScenes } from '../../src/store/scenes'
import { useShowMode } from '../../src/store/showMode'
import { useScenePreview } from '../../src/store/scenePreview'
import { buttonTitled, renderConnected, sceneBox, waitForRequest } from '../helpers'

// Live scene in the fixture: Main. The live preview stays collapsed in these tests (the default),
// so every screenshot request comes from the scene preview.

const panel = () => document.querySelector('.preview--scene') as HTMLElement
const picker = () => within(panel()).getByLabelText('Scene to preview') as HTMLSelectElement
const shotsOf = (obs: { requestsOf: (t: string) => Record<string, unknown>[] }, scene: string) =>
  obs.requestsOf('GetSourceScreenshot').filter((r) => r.sourceName === scene).length
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('scene preview', () => {
  test('is closed by default and takes no snapshots until a scene is chosen', async () => {
    const { obs, user } = await renderConnected()
    await sleep(100)
    expect(obs.requestsOf('GetSourceScreenshot')).toHaveLength(0)
    await user.click(within(panel()).getByRole('button', { name: /Preview/ }))
    expect(panel().textContent).toMatch(/Choose a scene/)
    expect(obs.requestsOf('GetSourceScreenshot')).toHaveLength(0)
  })

  test('the preview button on a scene shows that scene, without putting it on air', async () => {
    const { obs, user } = await renderConnected()
    await user.click(buttonTitled(sceneBox('BRB'), /Preview this scene/))
    expect(await waitForRequest(obs, 'GetSourceScreenshot')).toMatchObject({ sourceName: 'BRB', imageFormat: 'jpg' })
    await waitFor(() => expect(panel().querySelector('img')?.getAttribute('alt')).toBe('Snapshot of BRB'))
    expect(picker().value).toBe('BRB')
    expect(obs.requestsOf('SetCurrentProgramScene')).toHaveLength(0)
    expect(buttonTitled(sceneBox('BRB'), /Preview this scene/).classList.contains('is-active')).toBe(true)
  })

  test('the picker switches scenes, and collapsing stops the snapshots', async () => {
    const { obs, user } = await renderConnected()
    useScenePreview.getState().setRate(1)
    await user.click(buttonTitled(sceneBox('BRB'), /Preview this scene/))
    await waitForRequest(obs, 'GetSourceScreenshot')
    fireEvent.change(picker(), { target: { value: 'Interview' } })
    await waitFor(() => expect(shotsOf(obs, 'Interview')).toBeGreaterThan(0))
    expect(picker().textContent).toContain('Main (live)')

    await user.click(within(panel()).getByRole('button', { name: /Preview/ }))
    const count = obs.requestsOf('GetSourceScreenshot').length
    await sleep(1600) // longer than the 1s rate
    expect(obs.requestsOf('GetSourceScreenshot').length).toBe(count)
  })

  test('Go live from the preview puts that scene on air; it then shows LIVE', async () => {
    const { obs, user } = await renderConnected()
    await user.click(buttonTitled(sceneBox('BRB'), /Preview this scene/))
    await user.click(within(panel()).getByRole('button', { name: 'Go live' }))
    expect(await waitForRequest(obs, 'SetCurrentProgramScene')).toMatchObject({ sceneName: 'BRB' })
    await waitFor(() => expect(within(panel()).getByText('LIVE')).toBeTruthy())
  })

  test('in show mode, Go live from the preview asks first', async () => {
    const { obs, user } = await renderConnected()
    useShowMode.getState().setOn(true)
    await user.click(buttonTitled(sceneBox('BRB'), /Preview this scene/))
    await user.click(within(panel()).getByRole('button', { name: 'Go live' }))
    await sleep(50)
    expect(obs.requestsOf('SetCurrentProgramScene')).toHaveLength(0)
    const confirm = within(panel()).getByRole('alertdialog')
    expect(confirm.textContent).toMatch(/from Main to BRB/)
    await user.click(within(confirm).getByRole('button', { name: 'Go live' }))
    expect(await waitForRequest(obs, 'SetCurrentProgramScene')).toMatchObject({ sceneName: 'BRB' })
  })

  test('keeps following a scene that is renamed', async () => {
    const { obs, user } = await renderConnected()
    await user.click(buttonTitled(sceneBox('BRB'), /Preview this scene/))
    await waitForRequest(obs, 'GetSourceScreenshot')
    expect(await useScenes.getState().renameScene('BRB', 'Be Right Back')).toBeNull()
    await waitFor(() => expect(picker().value).toBe('Be Right Back'))
    await waitFor(() => expect(shotsOf(obs, 'Be Right Back')).toBeGreaterThan(0))
  })
})
