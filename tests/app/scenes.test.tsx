import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { buttonTitled, itemRow, renderConnected, sceneBox, shownItems, shownScenes, waitForRequest } from '../helpers'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const isHidden = (row: HTMLElement) => row.querySelector('.item')!.classList.contains('is-hidden')

describe('scenes and items', () => {
  test('shows scenes and items in the same order as OBS, with groups and nested scenes', async () => {
    await renderConnected()
    expect(shownScenes()).toEqual(['Starting Soon', 'Main', 'Interview', 'BRB'])
    expect(shownItems('Main')).toEqual(['Lower Third', 'LT Name', 'LT Bar', 'Chat Overlay', 'Logo', 'Camera', 'Background Loop'])
    expect(itemRow('Main', 'Lower Third').textContent).toContain('Group')
    expect(itemRow('Interview', 'Main').textContent).toContain('Scene')
    expect(itemRow('Main', 'Logo').querySelector('.item__lock')!.getAttribute('aria-pressed')).toBe('true')
    expect(isHidden(itemRow('BRB', 'Music'))).toBe(true)
  })

  test('the eye hides an item, and OBS receives the change', async () => {
    const { obs, user } = await renderConnected()
    await user.click(buttonTitled(itemRow('Main', 'Chat Overlay'), /click to hide/))
    expect(await waitForRequest(obs, 'SetSceneItemEnabled')).toMatchObject({ sceneName: 'Main', sceneItemEnabled: false })
    await waitFor(() => expect(isHidden(itemRow('Main', 'Chat Overlay'))).toBe(true))
  })

  test('works inside groups (the group is the "scene" sent to OBS)', async () => {
    const { obs, user } = await renderConnected()
    await user.click(buttonTitled(itemRow('Main', 'LT Bar'), /click to hide/))
    expect(await waitForRequest(obs, 'SetSceneItemEnabled')).toMatchObject({ sceneName: 'Lower Third', sceneItemEnabled: false })
  })

  test('if OBS refuses, the eye flips back and an error is shown', async () => {
    const { obs, user } = await renderConnected()
    obs.failNext('SetSceneItemEnabled', 600, 'No scene item')
    await user.click(buttonTitled(itemRow('Main', 'Logo'), /click to hide/))
    await screen.findByText(/couldn't change visibility/i)
    expect(isHidden(itemRow('Main', 'Logo'))).toBe(false)
  })

  test('changes made in OBS itself appear immediately', async () => {
    const { obs } = await renderConnected()
    const id = obs.containers.get('Main')!.find((i) => i.sourceName === 'Camera')!.id
    obs.emit('SceneItemEnableStateChanged', { sceneName: 'Main', sceneItemId: id, sceneItemEnabled: false })
    await waitFor(() => expect(isHidden(itemRow('Main', 'Camera'))).toBe(true))
  })
})

describe('going live', () => {
  test('Go live switches the program scene and moves the LIVE badge', async () => {
    const { obs, user } = await renderConnected()
    expect(within(sceneBox('Main')).getByText('LIVE')).toBeTruthy()
    await user.click(within(sceneBox('BRB')).getByRole('button', { name: 'Go live' }))
    expect(await waitForRequest(obs, 'SetCurrentProgramScene')).toEqual({ sceneName: 'BRB' })
    await waitFor(() => expect(within(sceneBox('BRB')).queryByText('LIVE')).not.toBeNull())
    expect(within(sceneBox('Main')).queryByText('LIVE')).toBeNull()
  })

  test('the live scene cannot be deleted', async () => {
    await renderConnected()
    expect(buttonTitled(sceneBox('Main'), /This scene is live/).disabled).toBe(true)
  })
})

describe('ordering', () => {
  // OBS counts positions from the bottom: in Main (5 top-level items) the top is index 4.
  test('to top / down / to bottom send the right OBS position', async () => {
    const { obs, user } = await renderConnected()
    await user.click(buttonTitled(itemRow('Main', 'Camera'), /Move to top/))
    expect(await waitForRequest(obs, 'SetSceneItemIndex', 1)).toMatchObject({ sceneName: 'Main', sceneItemIndex: 4 })
    await waitFor(() => expect(obs.itemNames('Main')[0]).toBe('Camera'))
    expect(shownItems('Main')[0]).toBe('Camera')

    await user.click(buttonTitled(itemRow('Main', 'Camera'), 'Move down'))
    expect(await waitForRequest(obs, 'SetSceneItemIndex', 2)).toMatchObject({ sceneItemIndex: 3 })

    await user.click(buttonTitled(itemRow('Main', 'Camera'), /Move to bottom/))
    expect(await waitForRequest(obs, 'SetSceneItemIndex', 3)).toMatchObject({ sceneItemIndex: 0 })
    await waitFor(() => expect(obs.itemNames('Main').at(-1)).toBe('Camera'))
  })

  test('buttons that would do nothing are disabled', async () => {
    await renderConnected()
    const top = itemRow('Main', 'Lower Third')
    expect(buttonTitled(top, /Move to top/).disabled).toBe(true)
    expect(buttonTitled(top, 'Move up').disabled).toBe(true)
    expect(buttonTitled(top, 'Move down').disabled).toBe(false)
  })

  test('reordering inside a group', async () => {
    const { obs, user } = await renderConnected()
    await user.click(buttonTitled(itemRow('Main', 'LT Bar'), 'Move up'))
    expect(await waitForRequest(obs, 'SetSceneItemIndex')).toMatchObject({ sceneName: 'Lower Third', sceneItemIndex: 1 })
    await waitFor(() => expect(obs.itemNames('Lower Third')).toEqual(['LT Bar', 'LT Name']))
  })
})

describe('transform editor', () => {
  /** Opens the editor on an item in Main; returns a function to find a field by its label. */
  async function openEditor(user: UserEvent, name: string) {
    await user.click(buttonTitled(itemRow('Main', name), 'Edit transform'))
    await waitFor(() => expect(itemRow('Main', name).querySelector('.transform .numfield')).not.toBeNull())
    return (label: string) =>
      [...itemRow('Main', name).querySelectorAll('.numfield')]
        .find((l) => l.querySelector('.numfield__label')?.textContent === label)!
        .querySelector('input')!
  }

  test('shows the current values', async () => {
    const { user } = await renderConnected()
    const field = await openEditor(user, 'Chat Overlay')
    expect(field('X').value).toBe('1310')
    expect(field('Y').value).toBe('120')
    expect(field('W').value).toBe('480')
    expect(field('H').value).toBe('720')
  })

  test('typing is held (amber) until Enter; Escape cancels', async () => {
    const { obs, user } = await renderConnected()
    const field = await openEditor(user, 'Chat Overlay')
    await user.clear(field('Y'))
    await user.type(field('Y'), '300')
    expect(field('Y').closest('.numfield')!.classList.contains('is-dirty')).toBe(true)
    expect(obs.requestsOf('SetSceneItemTransform')).toHaveLength(0)
    await user.keyboard('{Escape}')
    await sleep(50)
    expect(obs.requestsOf('SetSceneItemTransform')).toHaveLength(0)
    expect(field('Y').value).toBe('120')

    await user.clear(field('X'))
    await user.type(field('X'), '100{Enter}')
    expect(await waitForRequest(obs, 'SetSceneItemTransform')).toMatchObject({ sceneItemTransform: { positionX: 100 } })
  })

  test('changing the width keeps the aspect ratio by default', async () => {
    const { obs, user } = await renderConnected()
    const field = await openEditor(user, 'Chat Overlay')
    await user.clear(field('W'))
    await user.type(field('W'), '240{Enter}')
    const sent = (await waitForRequest(obs, 'SetSceneItemTransform')).sceneItemTransform as { scaleX: number; scaleY: number }
    expect(sent.scaleX).toBeCloseTo(0.5)
    expect(sent.scaleY).toBeCloseTo(0.5)
    await waitFor(() => expect(field('H').value).toBe('360'))
  })

  test('crop values are whole pixels', async () => {
    const { obs, user } = await renderConnected()
    const field = await openEditor(user, 'Chat Overlay')
    await user.clear(field('L'))
    await user.type(field('L'), '12.6{Enter}')
    expect(await waitForRequest(obs, 'SetSceneItemTransform')).toMatchObject({ sceneItemTransform: { cropLeft: 13 } })
  })

  test('a value OBS rejects shows an error and restores the real value', async () => {
    const { obs, user } = await renderConnected()
    const field = await openEditor(user, 'Chat Overlay')
    obs.failNext('SetSceneItemTransform', 402, 'The field value of `positionX` is out of range.')
    await user.clear(field('X'))
    await user.type(field('X'), '99999{Enter}')
    await screen.findByText(/couldn't change transform/i)
    await waitFor(() => expect(field('X').value).toBe('1310'))
  })

  test('follows changes made in OBS (e.g. dragging the source)', async () => {
    const { obs, user } = await renderConnected()
    const field = await openEditor(user, 'Chat Overlay')
    const it = obs.containers.get('Main')!.find((i) => i.sourceName === 'Chat Overlay')!
    obs.emit('SceneItemTransformChanged', { sceneName: 'Main', sceneItemId: it.id, sceneItemTransform: { ...it.transform, positionX: 42 } })
    await waitFor(() => expect(field('X').value).toBe('42'))
  })
})

describe('panel controls', () => {
  test('the filter matches scene names, source names and types', async () => {
    const { user } = await renderConnected()
    const filter = screen.getByPlaceholderText('Filter…')
    await user.type(filter, 'brb')
    expect(shownScenes()).toEqual(['BRB'])
    await user.clear(filter)
    await user.type(filter, 'browser')
    expect(shownScenes()).toEqual(['Starting Soon', 'Main'])
    expect(shownItems('Starting Soon')).toEqual(['Countdown'])
    expect(shownItems('Main')).toEqual(['Chat Overlay'])
    await user.keyboard('{Escape}')
    expect(shownScenes()).toHaveLength(4)
  })

  test('collapsing a scene is remembered', async () => {
    const { user } = await renderConnected()
    await user.click(within(sceneBox('BRB')).getByText('BRB'))
    expect(shownItems('BRB')).toEqual([])
    expect(JSON.parse(localStorage.getItem('obs-web-controller:collapsed-scenes')!)).toEqual(['BRB'])
  })

  test('the preview takes snapshots of the live scene only while open', async () => {
    const { obs } = await renderConnected({ preview: true })
    expect(await waitForRequest(obs, 'GetSourceScreenshot')).toMatchObject({ sourceName: 'Main', imageFormat: 'jpg' })
    await waitFor(() => expect(document.querySelector('.preview img')).not.toBeNull())
    fireEvent.click(document.querySelector('.preview .scene__toggle')!)
    const count = obs.requestsOf('GetSourceScreenshot').length
    await sleep(1300)
    expect(obs.requestsOf('GetSourceScreenshot').length).toBe(count)
  })
})

describe('locking items', () => {
  const lockButton = (scene: string, name: string) => itemRow(scene, name).querySelector('button.item__lock') as HTMLButtonElement

  test('the padlock shows OBS\'s lock state and toggles it', async () => {
    const { obs, user } = await renderConnected()
    expect(lockButton('Main', 'Logo').getAttribute('aria-pressed')).toBe('true') // locked in the fixture
    expect(lockButton('Main', 'Camera').getAttribute('aria-pressed')).toBe('false')

    await user.click(lockButton('Main', 'Camera'))
    expect(await waitForRequest(obs, 'SetSceneItemLocked')).toMatchObject({ sceneName: 'Main', sceneItemLocked: true })
    await waitFor(() => expect(obs.containers.get('Main')!.find((i) => i.sourceName === 'Camera')!.locked).toBe(true))
    expect(lockButton('Main', 'Camera').getAttribute('aria-pressed')).toBe('true')

    await user.click(lockButton('Main', 'Logo'))
    expect(await waitForRequest(obs, 'SetSceneItemLocked', 2)).toMatchObject({ sceneItemLocked: false })
  })

  test('works inside groups (the group is the "scene" sent to OBS)', async () => {
    const { obs, user } = await renderConnected()
    await user.click(lockButton('Main', 'LT Bar'))
    expect(await waitForRequest(obs, 'SetSceneItemLocked')).toMatchObject({ sceneName: 'Lower Third', sceneItemLocked: true })
  })

  test('a locked item can\'t be reordered, but its neighbours can', async () => {
    await renderConnected()
    const logo = itemRow('Main', 'Logo')
    for (const t of [/Move to top/, 'Move up', 'Move down', /Move to bottom/]) expect(buttonTitled(logo, t).disabled).toBe(true)
    expect(buttonTitled(itemRow('Main', 'Camera'), 'Move up').disabled).toBe(false)
  })

  test('a locked item\'s transform can be viewed but not changed', async () => {
    const { obs, user } = await renderConnected()
    await user.click(buttonTitled(itemRow('Main', 'Logo'), 'Edit transform'))
    await waitFor(() => expect(itemRow('Main', 'Logo').querySelector('.transform .numfield')).not.toBeNull())
    expect(itemRow('Main', 'Logo').textContent).toMatch(/Locked: unlock the item/)
    const inputs = [...itemRow('Main', 'Logo').querySelectorAll<HTMLInputElement>('.transform input')]
    expect(inputs.length).toBeGreaterThan(0)
    expect(inputs.every((i) => i.matches(':disabled'))).toBe(true)

    // Unlocking (here: from OBS itself) makes it editable straight away.
    const id = obs.containers.get('Main')!.find((i) => i.sourceName === 'Logo')!.id
    obs.emit('SceneItemLockStateChanged', { sceneName: 'Main', sceneItemId: id, sceneItemLocked: false })
    await waitFor(() => expect(inputs.every((i) => !i.matches(':disabled'))).toBe(true))
    await user.click(lockButton('Main', 'Logo')) // and locking again disables it
    await waitFor(() => expect(inputs.every((i) => i.matches(':disabled'))).toBe(true))
    expect(obs.requestsOf('SetSceneItemTransform')).toHaveLength(0)
  })

  test('if OBS refuses, the padlock flips back and an error is shown', async () => {
    const { obs, user } = await renderConnected()
    obs.failNext('SetSceneItemLocked', 600, 'No scene item')
    await user.click(lockButton('Main', 'Camera'))
    await screen.findByText(/couldn't lock item/i)
    expect(lockButton('Main', 'Camera').getAttribute('aria-pressed')).toBe('false')
  })
})
