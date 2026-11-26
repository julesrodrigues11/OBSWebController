import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { useUi } from '../../src/store/ui'
import { buttonTitled, itemRow, renderConnected, sceneBox, shownItems, shownScenes, sourceRow, waitForRequest } from '../helpers'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('adding sources', () => {
  async function openAdd(user: UserEvent, scene: string) {
    await user.click(buttonTitled(sceneBox(scene), 'Add a source to this scene'))
    return sceneBox(scene).querySelector('.addsrc') as HTMLElement
  }

  test('a new browser source: suggested name, canvas size, hidden by default in the live scene', async () => {
    const { obs, user } = await renderConnected()
    const form = await openAdd(user, 'Main')
    expect(form.querySelector<HTMLInputElement>('.addsrc__hidden input')!.checked).toBe(true) // Main is live
    const [name, url] = form.querySelectorAll<HTMLInputElement>('.addsrc__form input.field')
    expect(name.value).toBe('Browser')
    await waitFor(() => expect([...form.querySelectorAll<HTMLInputElement>('.addsrc__num')].map((i) => i.value)).toEqual(['1920', '1080']))
    await user.type(url, 'https://example.com/poll')
    await user.click(within(form).getByRole('button', { name: 'Add to Main' }))
    expect(await waitForRequest(obs, 'CreateInput')).toEqual({
      sceneName: 'Main', inputName: 'Browser', inputKind: 'browser_source',
      inputSettings: { url: 'https://example.com/poll', width: 1920, height: 1080 }, sceneItemEnabled: false,
    })
    await waitFor(() => expect(shownItems('Main')[0]).toBe('Browser')) // new items go on top
  })

  test('not hidden by default in a scene that is not live; picks the newest source type', async () => {
    const { obs, user } = await renderConnected()
    const form = await openAdd(user, 'BRB')
    expect(form.querySelector<HTMLInputElement>('.addsrc__hidden input')!.checked).toBe(false)
    await user.selectOptions(form.querySelector('select')!, 'slideshow')
    await user.type(form.querySelectorAll<HTMLInputElement>('.addsrc__form input.field')[1], '"D:\\Show\\slides\\event"')
    await user.click(within(form).getByRole('button', { name: 'Add to BRB' }))
    expect(await waitForRequest(obs, 'CreateInput')).toMatchObject({
      inputName: 'Image Slideshow', inputKind: 'slideshow_v2', sceneItemEnabled: true,
      inputSettings: { files: [{ value: 'D:\\Show\\slides\\event', hidden: false, selected: false }] },
    })
  })

  test('names already used by a source or scene are blocked', async () => {
    const { obs, user } = await renderConnected()
    const form = await openAdd(user, 'BRB')
    const name = form.querySelectorAll<HTMLInputElement>('.addsrc__form input.field')[0]
    for (const taken of ['Logo', 'Main', 'Lower Third']) {
      await user.clear(name)
      await user.type(name, taken)
      expect(within(form).getByRole<HTMLButtonElement>('button', { name: 'Add to BRB' }).disabled).toBe(true)
    }
    expect(obs.requestsOf('CreateInput')).toHaveLength(0)
  })

  test('adding an existing source (or another scene)', async () => {
    const { obs, user } = await renderConnected()
    const form = await openAdd(user, 'BRB')
    await user.click(within(form).getByRole('button', { name: 'Existing source' }))
    await user.type(within(form).getByPlaceholderText(/Search sources/), 'logo')
    await user.click(within(form).getByRole('button', { name: /^Logo/ }))
    expect(await waitForRequest(obs, 'CreateSceneItem')).toEqual({ sceneName: 'BRB', sourceName: 'Logo', sceneItemEnabled: true })
    await waitFor(() => expect(shownItems('BRB')[0]).toBe('Logo'))
  })

  test('the existing-source list never offers the scene itself', async () => {
    const { user } = await renderConnected()
    const form = await openAdd(user, 'Main')
    await user.click(within(form).getByRole('button', { name: 'Existing source' }))
    const offered = [...form.querySelectorAll('.addsrc__pick .item__name')].map((e) => e.textContent)
    expect(offered).toContain('Interview')
    expect(offered).not.toContain('Main')
  })
})

describe('removing and deleting', () => {
  test('remove from one scene vs delete everywhere', async () => {
    const { obs, user } = await renderConnected()
    await user.click(buttonTitled(itemRow('Main', 'Background Loop'), 'Remove or delete…'))
    const bar = itemRow('Main', 'Background Loop').querySelector('.confirm') as HTMLElement
    expect(bar.textContent).toMatch(/used in 2 places: Starting Soon, Main/)
    await user.click(within(bar).getByRole('button', { name: 'Remove from Main' }))
    expect(await waitForRequest(obs, 'RemoveSceneItem')).toMatchObject({ sceneName: 'Main' })
    await waitFor(() => expect(shownItems('Main')).not.toContain('Background Loop'))
    expect(shownItems('Starting Soon')).toContain('Background Loop')
    expect(obs.requestsOf('RemoveInput')).toHaveLength(0)
  })

  test('"Delete from all" deletes the source everywhere', async () => {
    const { obs, user } = await renderConnected()
    await user.click(buttonTitled(itemRow('Main', 'Background Loop'), 'Remove or delete…'))
    await user.click(screen.getByRole('button', { name: 'Delete from all 2' }))
    expect(await waitForRequest(obs, 'RemoveInput')).toEqual({ inputName: 'Background Loop' })
    await waitFor(() => expect(shownItems('Starting Soon')).not.toContain('Background Loop'))
  })

  test('groups and nested scenes can only be removed, not deleted', async () => {
    const { user } = await renderConnected()
    await user.click(buttonTitled(itemRow('Main', 'Lower Third'), 'Remove or delete…'))
    const buttons = [...document.querySelectorAll('.confirm button')].map((b) => b.textContent)
    expect(buttons).toEqual(['Remove from Main', 'Cancel'])
  })

  test('Cancel and Escape send nothing', async () => {
    const { obs, user } = await renderConnected()
    await user.click(buttonTitled(itemRow('Main', 'Logo'), 'Remove or delete…'))
    await user.click(within(document.querySelector('.confirm') as HTMLElement).getByRole('button', { name: 'Cancel' }))
    await user.click(buttonTitled(sourceRow('Logo'), /Delete this source/))
    await user.keyboard('{Escape}')
    await sleep(50)
    expect(document.querySelector('.confirm')).toBeNull()
    expect(obs.requests.filter((r) => r.type.startsWith('Remove'))).toHaveLength(0)
  })

  test('deleting from the Sources panel lists where the source is used', async () => {
    const { obs, user } = await renderConnected()
    await user.click(buttonTitled(sourceRow('Microphone'), /Delete this source/))
    expect(document.querySelector('.confirm')!.textContent).toMatch(/isn't in any scene/)
    await user.click(screen.getByRole('button', { name: 'Delete source' }))
    expect(await waitForRequest(obs, 'RemoveInput')).toEqual({ inputName: 'Microphone' })
  })

  test('deleting a scene', async () => {
    const { obs, user } = await renderConnected()
    await user.click(buttonTitled(sceneBox('BRB'), 'Delete this scene'))
    await user.click(screen.getByRole('button', { name: 'Delete scene' }))
    expect(await waitForRequest(obs, 'RemoveScene')).toEqual({ sceneName: 'BRB' })
    await waitFor(() => expect(shownScenes()).toEqual(['Starting Soon', 'Main', 'Interview']))
  })

  test('deleting a scene nested elsewhere warns about it', async () => {
    const { obs, user } = await renderConnected()
    await user.click(within(sceneBox('BRB')).getByRole('button', { name: 'Go live' }))
    await waitFor(() => expect(within(sceneBox('BRB')).queryByText('LIVE')).not.toBeNull())
    await user.click(buttonTitled(sceneBox('Main'), 'Delete this scene'))
    expect(document.querySelector('.confirm')!.textContent).toMatch(/nested inside Interview/)
    void obs
  })
})

describe('creating and renaming scenes', () => {
  test('+ Scene creates a scene with a unique suggested name', async () => {
    const { obs, user } = await renderConnected()
    await user.click(screen.getByRole('button', { name: '+ Scene' }))
    const input = document.querySelector('.newscene input') as HTMLInputElement
    expect(input.value).toBe('Scene')
    await user.clear(input)
    await user.type(input, 'Main')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create' }).disabled).toBe(true)
    await user.clear(input)
    await user.type(input, 'Q&A{Enter}')
    expect(await waitForRequest(obs, 'CreateScene')).toEqual({ sceneName: 'Q&A' })
    await waitFor(() => expect(shownScenes()[0]).toBe('Q&A'))
    expect(document.querySelector('.newscene')).toBeNull()
  })

  test('rename with the pencil and Enter; collapsed state and Sources scope follow', async () => {
    const { obs, user } = await renderConnected({ collapsed: ['BRB'], scope: { mode: 'scene', scene: 'BRB' } })
    await user.click(buttonTitled(sceneBox('BRB'), 'Rename this scene'))
    const field = document.querySelector('.rename__input') as HTMLInputElement
    await user.clear(field)
    await user.type(field, 'Holding{Enter}')
    expect(await waitForRequest(obs, 'SetSceneName')).toEqual({ sceneName: 'BRB', newSceneName: 'Holding' })
    await waitFor(() => expect(shownScenes()).toContain('Holding'))
    expect(JSON.parse(localStorage.getItem('obs-web-controller:collapsed-scenes')!)).toEqual(['Holding'])
    expect(useUi.getState().scope).toEqual({ mode: 'scene', scene: 'Holding' })
  })

  test('double-click to rename; leaving the field applies', async () => {
    const { obs, user } = await renderConnected()
    await user.dblClick(within(sceneBox('Interview')).getByText('Interview'))
    const field = document.querySelector('.rename__input') as HTMLInputElement
    await user.clear(field)
    await user.type(field, 'Guests')
    await user.tab()
    expect(await waitForRequest(obs, 'SetSceneName')).toEqual({ sceneName: 'Interview', newSceneName: 'Guests' })
  })

  test('a duplicate name shows an error on Enter and is cancelled on leaving; Escape cancels', async () => {
    const { obs, user } = await renderConnected()
    await user.click(buttonTitled(sceneBox('BRB'), 'Rename this scene'))
    let field = document.querySelector('.rename__input') as HTMLInputElement
    await user.clear(field)
    await user.type(field, 'Main{Enter}')
    expect(document.querySelector('.rename__error')!.textContent).toMatch(/already used/)
    await user.tab()
    expect(document.querySelector('.rename__input')).toBeNull()

    await user.click(buttonTitled(sceneBox('BRB'), 'Rename this scene'))
    field = document.querySelector('.rename__input') as HTMLInputElement
    await user.type(field, 'XYZ')
    await user.keyboard('{Escape}')
    await sleep(50)
    expect(obs.requestsOf('SetSceneName')).toHaveLength(0)
    expect(shownScenes()).toContain('BRB')
  })

  test('renaming the live scene keeps it live', async () => {
    const { user } = await renderConnected()
    await user.click(buttonTitled(sceneBox('Main'), 'Rename this scene'))
    const field = document.querySelector('.rename__input') as HTMLInputElement
    await user.clear(field)
    await user.type(field, 'Main Show{Enter}')
    await waitFor(() => expect(within(sceneBox('Main Show')).queryByText('LIVE')).not.toBeNull())
  })
})
