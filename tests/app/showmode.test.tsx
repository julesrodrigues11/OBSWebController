import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { useScenes } from '../../src/store/scenes'
import { useInputs } from '../../src/store/inputs'
import { buttonTitled, itemRow, renderConnected, sceneBox, sourceRow, waitForRequest } from '../helpers'

// The fixture's live scene is Main: it holds the Lower Third group (LT Name, LT Bar), Chat Overlay,
// Logo, Camera and Background Loop. Interview has Main nested inside it; Starting Soon also uses
// Background Loop; BRB is unrelated.

const showModeButton = () => document.querySelector('.topbar button.showmode') as HTMLButtonElement
const eye = (scene: string, name: string) => buttonTitled(itemRow(scene, name), /Visible|Hidden/)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function renderInShowMode() {
  const app = await renderConnected({ scope: { mode: 'all' } })
  await app.user.click(showModeButton())
  return app
}

describe('show mode', () => {
  test('is off by default, toggled from the top bar, and remembered by this browser', async () => {
    const { user } = await renderConnected()
    expect(showModeButton().getAttribute('aria-pressed')).toBe('false')
    expect(eye('Main', 'Camera').disabled).toBe(false)
    await user.click(showModeButton())
    expect(showModeButton().getAttribute('aria-pressed')).toBe('true')
    expect(localStorage.getItem('obs-web-controller:show-mode')).toBe('true')
    await user.click(showModeButton())
    expect(localStorage.getItem('obs-web-controller:show-mode')).toBe('false')
  })

  test('protects items in the live scene, including inside groups; other scenes stay editable', async () => {
    const { obs, user } = await renderInShowMode()
    for (const name of ['Camera', 'Lower Third', 'LT Bar']) expect(eye('Main', name).disabled).toBe(true)
    expect(buttonTitled(itemRow('Main', 'Camera'), 'Move up').disabled).toBe(true)
    expect(buttonTitled(itemRow('Main', 'Camera'), /on air and protected/).disabled).toBe(true) // remove/delete

    // Interview contains Main, but Interview itself isn't on air: its items can change.
    expect(eye('Interview', 'Guest Name').disabled).toBe(false)
    await user.click(eye('BRB', 'BRB Title'))
    expect(await waitForRequest(obs, 'SetSceneItemEnabled')).toMatchObject({ sceneName: 'BRB' })
  })

  test('the live scene can\'t be renamed or added to; other scenes can', async () => {
    await renderInShowMode()
    const main = within(sceneBox('Main'))
    expect(main.getAllByTitle(/on air and protected/).every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
    expect(buttonTitled(sceneBox('BRB'), 'Rename this scene').disabled).toBe(false)
    expect(buttonTitled(sceneBox('BRB'), 'Add a source to this scene').disabled).toBe(false)
  })

  test('the transform editor of a live item is read-only', async () => {
    const { obs, user } = await renderInShowMode()
    await user.click(buttonTitled(itemRow('Main', 'Chat Overlay'), 'Edit transform'))
    await waitFor(() => expect(itemRow('Main', 'Chat Overlay').querySelector('.transform .numfield')).not.toBeNull())
    expect(itemRow('Main', 'Chat Overlay').textContent).toMatch(/Show mode: this scene is on air/)
    expect([...itemRow('Main', 'Chat Overlay').querySelectorAll('.transform input')].every((i) => i.matches(':disabled'))).toBe(true)
    expect(obs.requestsOf('SetSceneItemTransform')).toHaveLength(0)
  })

  test('sources on air can\'t be edited in the Sources panel; others can', async () => {
    await renderInShowMode()
    const inputsOf = (name: string) => [...sourceRow(name).querySelectorAll<HTMLInputElement>('input, textarea, button')]
    // Chat Overlay is on air: URL, size, Refresh and delete are all disabled ({ } still works).
    expect(inputsOf('Chat Overlay').filter((el) => el.textContent !== '{ }').every((el) => el.matches(':disabled'))).toBe(true)
    expect(buttonTitled(sourceRow('Chat Overlay'), /every setting/).disabled).toBe(false)
    // Countdown (Starting Soon) isn't on air.
    expect(inputsOf('Countdown').some((el) => el.matches(':disabled'))).toBe(false)
    // Background Loop is on air through Main, so it's protected even though Starting Soon isn't.
    expect(inputsOf('Background Loop').filter((el) => el.textContent !== '{ }').every((el) => el.matches(':disabled'))).toBe(true)
    expect(eye('Starting Soon', 'Background Loop').disabled).toBe(false)
  })

  test('Go live asks first, and the protection moves to the new live scene', async () => {
    const { obs, user } = await renderInShowMode()
    await user.click(within(sceneBox('BRB')).getByRole('button', { name: 'Go live' }))
    await sleep(50)
    expect(obs.requestsOf('SetCurrentProgramScene')).toHaveLength(0)
    const confirm = within(sceneBox('BRB')).getByRole('alertdialog')
    expect(confirm.textContent).toMatch(/from Main to BRB/)
    await user.click(within(confirm).getByRole('button', { name: 'Go live' }))
    expect(await waitForRequest(obs, 'SetCurrentProgramScene')).toMatchObject({ sceneName: 'BRB' })

    await waitFor(() => expect(eye('BRB', 'BRB Title').disabled).toBe(true))
    expect(eye('Main', 'Camera').disabled).toBe(false)
  })

  test('also follows scene changes made in OBS itself', async () => {
    const { obs } = await renderInShowMode()
    obs.emit('CurrentProgramSceneChanged', { sceneName: 'Interview' })
    // Interview and Main (nested in it) are now protected; BRB isn't.
    await waitFor(() => expect(eye('Interview', 'Guest Name').disabled).toBe(true))
    expect(eye('Main', 'Camera').disabled).toBe(true)
    expect(eye('BRB', 'BRB Title').disabled).toBe(false)
  })

  test('changes already under way are refused too, not just the buttons', async () => {
    const { obs } = await renderInShowMode()
    const id = obs.containers.get('Main')!.find((i) => i.sourceName === 'Camera')!.id
    await useScenes.getState().setTransform('Main', id, { positionX: 5 })
    await useScenes.getState().setEnabled('Main', id, false)
    await useInputs.getState().setSettings('Chat Overlay', { url: 'https://example.com/other' })
    expect(obs.requestsOf('SetSceneItemTransform')).toHaveLength(0)
    expect(obs.requestsOf('SetSceneItemEnabled')).toHaveLength(0)
    expect(obs.requestsOf('SetInputSettings')).toHaveLength(0)
    expect((await screen.findAllByText(/Show mode is on/)).length).toBeGreaterThan(0)
  })
})
