import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { buttonTitled, profileRow, renderApp, renderConnected, sceneBox, shownSources, shownTables, sourceRow, waitForLoaded, waitForRequest } from '../helpers'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const mainField = (name: string) => sourceRow(name).querySelector<HTMLInputElement>('input.field')!
const numField = (row: HTMLElement, label: string) =>
  [...row.querySelectorAll('.numfield')].find((l) => l.querySelector('.numfield__label')?.textContent === label)!.querySelector('input')!

describe('tables', () => {
  test('one table per type, with everything else under Other', async () => {
    await renderConnected()
    expect(shownTables()).toEqual(['Browser', 'Media', 'Image', 'Image Slideshow', 'Text', 'Other'])
    expect(within(document.querySelector('.sources')!).getByText('Video device')).toBeTruthy()
    expect(mainField('Chat Overlay').value).toBe('https://example.com/overlays/chat')
    expect(mainField('Logo').value).toBe('D:\\Show\\graphics\\logo.png')
  })

  test('LIVE badges mark only what is visible on air (including inside groups)', async () => {
    await renderConnected()
    const live = [...document.querySelectorAll('.sources .srow.is-live .srow__label')].map((e) => e.textContent).sort()
    expect(live).toEqual(['Background Loop', 'Camera', 'Chat Overlay', 'LT Bar', 'LT Name', 'Logo'])
  })
})

describe('editing (Enter / leave the field applies, Escape cancels)', () => {
  test('a browser URL: amber while typing, sent on Enter', async () => {
    const { obs, user } = await renderConnected()
    const url = mainField('Chat Overlay')
    await user.clear(url)
    await user.type(url, 'https://example.com/new')
    expect(url.classList.contains('is-dirty')).toBe(true)
    expect(obs.requestsOf('SetInputSettings')).toHaveLength(0)
    await user.keyboard('{Enter}')
    expect(await waitForRequest(obs, 'SetInputSettings')).toEqual({
      inputName: 'Chat Overlay', inputSettings: { url: 'https://example.com/new' }, overlay: true,
    })
    await waitFor(() => expect(mainField('Chat Overlay').classList.contains('is-dirty')).toBe(false))
  })

  test('Escape discards the edit', async () => {
    const { obs, user } = await renderConnected()
    await user.clear(mainField('Chat Overlay'))
    await user.type(mainField('Chat Overlay'), 'https://typo')
    await user.keyboard('{Escape}')
    await sleep(50)
    expect(obs.requestsOf('SetInputSettings')).toHaveLength(0)
    expect(mainField('Chat Overlay').value).toBe('https://example.com/overlays/chat')
  })

  test('leaving the field applies, and Windows "Copy as path" quotes are removed', async () => {
    const { obs, user } = await renderConnected()
    await user.clear(mainField('Logo'))
    await user.type(mainField('Logo'), '"D:\\Show\\new logo.png"')
    await user.tab()
    expect(await waitForRequest(obs, 'SetInputSettings')).toMatchObject({ inputName: 'Logo', inputSettings: { file: 'D:\\Show\\new logo.png' } })
  })

  test('text: Enter adds a line, Ctrl+Enter applies', async () => {
    const { obs, user } = await renderConnected()
    const text = sourceRow('BRB Title').querySelector('textarea')!
    await user.clear(text)
    await user.type(text, 'Back in{Enter}5 minutes')
    expect(obs.requestsOf('SetInputSettings')).toHaveLength(0)
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(await waitForRequest(obs, 'SetInputSettings')).toMatchObject({ inputName: 'BRB Title', inputSettings: { text: 'Back in\n5 minutes' } })
  })

  test('font size keeps the rest of the font settings', async () => {
    const { obs, user } = await renderConnected()
    const size = numField(sourceRow('LT Name'), 'Size')
    await user.clear(size)
    await user.type(size, '72{Enter}')
    expect(await waitForRequest(obs, 'SetInputSettings')).toMatchObject({
      inputSettings: { font: { face: 'Segoe UI', size: 72, style: 'Bold', flags: 1 } },
    })
  })

  test('colour is shown and sent in OBS format', async () => {
    const { obs } = await renderConnected()
    const swatch = sourceRow('LT Name').querySelector<HTMLInputElement>('input.swatch')!
    expect(swatch.value).toBe('#ff0000') // stored as 0xff0000ff
    swatch.value = '#00ff00'
    fireEvent.change(swatch)
    expect(await waitForRequest(obs, 'SetInputSettings')).toMatchObject({ inputName: 'LT Name', inputSettings: { color: 0xff00ff00 } })
  })

  test('browser size and Refresh', async () => {
    const { obs, user } = await renderConnected()
    const w = numField(sourceRow('Countdown'), 'W')
    await user.clear(w)
    await user.type(w, '1280{Enter}')
    expect(await waitForRequest(obs, 'SetInputSettings')).toMatchObject({ inputSettings: { width: 1280 } })
    await user.click(within(sourceRow('Countdown')).getByRole('button', { name: 'Refresh' }))
    expect(await waitForRequest(obs, 'PressInputPropertiesButton')).toEqual({ inputName: 'Countdown', propertyName: 'refreshnocache' })
  })

  test('the Local file toggle switches a browser source to a file path', async () => {
    const { obs, user } = await renderConnected()
    await user.click(within(sourceRow('Countdown')).getByLabelText('Local file'))
    expect(await waitForRequest(obs, 'SetInputSettings')).toMatchObject({ inputSettings: { is_local_file: true } })
    await waitFor(() => expect(mainField('Countdown').placeholder).toMatch(/page\.html/))
  })

  test('changes made in OBS appear in the field', async () => {
    const { obs } = await renderConnected()
    obs.emit('InputSettingsChanged', { inputName: 'Logo', inputSettings: { file: 'E:\\changed-in-obs.png' } })
    await waitFor(() => expect(mainField('Logo').value).toBe('E:\\changed-in-obs.png'))
  })

  test('if OBS refuses an edit, an error is shown and the real value comes back', async () => {
    const { obs, user } = await renderConnected()
    obs.failNext('SetInputSettings', 600, 'Something went wrong')
    await user.clear(mainField('Logo'))
    await user.type(mainField('Logo'), 'D:\\nope.png{Enter}')
    await screen.findByText(/couldn't update “logo”/i)
    await waitFor(() => expect(mainField('Logo').value).toBe('D:\\Show\\graphics\\logo.png'))
  })
})

describe('media and slideshows', () => {
  test('media buttons control playback and show the state', async () => {
    const { obs, user } = await renderConnected()
    const row = sourceRow('Music')
    expect(row.querySelector('.media__state')!.textContent).toBe('Stopped')
    await user.click(buttonTitled(row, 'Play'))
    expect(await waitForRequest(obs, 'TriggerMediaInputAction')).toEqual({ inputName: 'Music', mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY' })
    await waitFor(() => expect(sourceRow('Music').querySelector('.media__state')!.textContent).toBe('Playing'))
  })

  test('the slideshow list: add, exclude, reorder, remove (always sending the whole list)', async () => {
    const { obs, user } = await renderConnected()
    const files = () => (obs.inputs['BRB Slides'].settings.files as { value: string; hidden: boolean }[])
    await user.click(sourceRow('BRB Slides').querySelector('button.slides__summary')!)
    const panel = () => sourceRow('BRB Slides').querySelector('.slides') as HTMLElement

    await user.type(panel().querySelector<HTMLInputElement>('.slides__add input')!, '"D:\\Show\\slides\\extra.png"{Enter}')
    await waitFor(() => expect(files().map((f) => f.value)).toEqual(['D:\\Show\\slides\\brb', 'D:\\Show\\slides\\sponsor.png', 'D:\\Show\\slides\\extra.png']))

    await user.click(panel().querySelectorAll<HTMLElement>('.slides__item .icon-button')[0])
    await waitFor(() => expect(files().map((f) => f.hidden)).toEqual([true, false, false]))

    await user.click(buttonTitled(panel(), 'Move down'))
    await waitFor(() => expect(files()[1].value).toBe('D:\\Show\\slides\\brb'))

    await user.click(within(panel()).getAllByTitle(/Remove from list/)[2])
    await waitFor(() => expect(files()).toHaveLength(2))
    for (const req of obs.requestsOf('SetInputSettings')) expect(Object.keys(req.inputSettings as object)).toEqual(['files'])
  })

  test('slide time is shown in seconds and sent in milliseconds', async () => {
    const { obs, user } = await renderConnected()
    const every = numField(sourceRow('BRB Slides'), 'Every')
    expect(every.value).toBe('8')
    await user.clear(every)
    await user.type(every, '2.5{Enter}')
    expect(await waitForRequest(obs, 'SetInputSettings')).toMatchObject({ inputSettings: { slide_time: 2500 } })
  })
})

describe('when OBS refuses to load some sources', () => {
  test('one unreadable source gets its own error row; the rest still load', async () => {
    const { obs } = await renderConnected()
    obs.failNext('GetInputSettings', 600, 'No source was found')
    obs.emit('InputCreated', { inputName: 'x' }) // makes the app reload all sources
    await waitFor(() => expect(document.querySelector('.srow__error')).not.toBeNull())
    expect(document.querySelector('.srow__error')!.textContent).toMatch(/GetInputSettings.*\(code 600\)/)
    expect(shownTables()).toContain('Text')
    expect(document.querySelector('.sources > .error')).toBeNull()
  })

  test('OBS refusing default settings with no message (the blank "Couldn’t load sources:" bug) no longer blanks the panel', async () => {
    const { obs, user } = await renderApp()
    obs.failNext('GetInputDefaultSettings', 400, undefined, 100) // every type, no comment
    await user.click(within(profileRow('Test OBS')).getByRole('button', { name: 'Connect' }))
    await waitForLoaded()
    expect(shownTables()).toEqual(['Browser', 'Media', 'Image', 'Image Slideshow', 'Text', 'Other'])
    expect(mainField('Chat Overlay').value).toBe('https://example.com/overlays/chat')
    expect(document.querySelector('.sources > .error')).toBeNull()
  })
})

describe('choosing what to show', () => {
  test('Live scene shows only the live scene (through groups), and follows Go live', async () => {
    const { user } = await renderConnected({ scope: { mode: 'live' } })
    expect(shownSources().sort()).toEqual(['Background Loop', 'Camera', 'Chat Overlay', 'LT Bar', 'LT Name', 'Logo'])
    await user.click(within(sceneBox('BRB')).getByRole('button', { name: 'Go live' }))
    await waitFor(() => expect(shownSources().sort()).toEqual(['BRB Slides', 'BRB Title', 'Music']))
    expect(sourceRow('Music').classList.contains('is-dim')).toBe(true) // in the scene but hidden
  })

  test('a chosen scene (via its header button) includes nested scenes', async () => {
    const { user } = await renderConnected()
    await user.click(buttonTitled(sceneBox('Interview'), /Show only this scene/))
    expect((document.querySelector('.sources select.scope') as HTMLSelectElement).value).toBe('scene:Interview')
    expect(shownSources()).toContain('Guest Name')
    expect(shownSources()).toContain('Chat Overlay') // from the nested Main scene
    expect(shownSources()).not.toContain('BRB Title')
  })

  test('type buttons: click adds a type, Ctrl+click shows only that type, All resets', async () => {
    const { user } = await renderConnected()
    const typeButton = (name: string) => within(document.querySelector('.typefilter') as HTMLElement).getByRole('button', { name: new RegExp(`^${name}( \\d+)?$`) })
    await user.click(typeButton('Text'))
    expect(shownTables()).toEqual(['Text'])
    await user.click(typeButton('Media'))
    expect(shownTables()).toEqual(['Media', 'Text'])
    await user.keyboard('{Control>}')
    await user.click(typeButton('Image'))
    await user.keyboard('{/Control}')
    expect(shownTables()).toEqual(['Image'])
    await user.click(typeButton('All'))
    expect(shownTables()).toHaveLength(6)
  })

  test('the text filter also searches URLs, paths and text', async () => {
    const { user } = await renderConnected()
    const filter = screen.getByPlaceholderText(/Filter by name, URL/)
    await user.type(filter, 'overlays/chat')
    expect(shownSources()).toEqual(['Chat Overlay'])
    await user.clear(filter)
    await user.type(filter, 'right back')
    expect(shownSources()).toEqual(['BRB Title'])
  })
})
