import { screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { useHost } from '../../src/store/host'
import { useProfiles } from '../../src/store/profiles'
import { APP_VERSION } from '../../src/version'
import { renderApp } from '../helpers'
import { hostJson } from '../setup'
import pkg from '../../package.json'

const json = (data: object) => () => Promise.resolve(new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }))
const hostedAs = (obsHost: string | null, obsPort = 4455) => { hostJson.response = json({ app: 'stagehand-obs', version: '0.1.0', obsHost, obsPort }) }
const field = (label: string) => screen.getByText(label, { selector: 'label > span' }).parentElement!.querySelector('input') as HTMLInputElement

/** Render with no saved connections, so the "New connection" form opens straight away. */
async function renderEmpty() {
  const app = await renderApp()
  useProfiles.setState({ profiles: [], lastUsedId: null })
  await app.user.click(screen.getByRole('button', { name: '+ New' }))
  await waitFor(() => expect(useHost.getState().loaded).toBe(true))
  return app
}

test('the version from package.json is shown in the top bar', async () => {
  await renderApp()
  expect(APP_VERSION).toBe(pkg.version)
  expect(document.querySelector('.topbar__version')!.textContent).toBe(`v${pkg.version}`)
})

describe('new connections when hosted', () => {
  test('not hosted (e.g. npm run dev): the form starts empty', async () => {
    await renderEmpty()
    expect(field('OBS PC address').value).toBe('')
    expect(document.querySelector('.connect__prefilled')).toBeNull()
  })

  test('hosted on the OBS PC: address, port and name are filled in, with a hint', async () => {
    hostedAs('same', 4460)
    await renderEmpty()
    await waitFor(() => expect(field('OBS PC address').value).toBe('localhost')) // the page's own host
    expect(field('Port').value).toBe('4460')
    expect(field('Name').value).toBe('OBS PC')
    expect(screen.getByText(/running on the OBS PC/)).toBeTruthy()
  })

  test('hosted elsewhere, with OBS on another PC: uses the configured address', async () => {
    hostedAs('192.168.1.70')
    await renderEmpty()
    await waitFor(() => expect(field('OBS PC address').value).toBe('192.168.1.70'))
    expect(field('Name').value).toBe('') // no name guess when it isn't "this PC"
    expect(screen.getByText(/filled in from the host settings/)).toBeTruthy()
  })

  test('the suggestion is saved like typed values', async () => {
    hostedAs('same')
    const { user } = await renderEmpty()
    await waitFor(() => expect(field('OBS PC address').value).toBe('localhost'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(useProfiles.getState().profiles[0]).toMatchObject({ name: 'OBS PC', host: 'localhost', port: 4455 })
  })

  test('a slow answer never overwrites what the user has typed', async () => {
    let answer!: () => void
    // (Uses the pre-rename app name, so this also checks an older host server is still recognised.)
    hostJson.response = () => new Promise((r) => { answer = () => r(new Response(JSON.stringify({ app: 'obs-web-controller', obsHost: 'same', obsPort: 4460 }))) })
    const { user } = await renderApp()
    useProfiles.setState({ profiles: [], lastUsedId: null })
    await user.click(screen.getByRole('button', { name: '+ New' }))
    await user.type(field('OBS PC address'), '10.0.0.5')
    answer()
    await waitFor(() => expect(useHost.getState().info).not.toBeNull())
    expect(field('OBS PC address').value).toBe('10.0.0.5')
    expect(field('Port').value).toBe('4460') // untouched fields still take the suggestion
  })

  test('editing an existing connection is never pre-filled', async () => {
    hostedAs('same')
    const { user } = await renderApp()
    await waitFor(() => expect(useHost.getState().info).not.toBeNull())
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(field('OBS PC address').value).toBe('127.0.0.1')
  })

  test('a non-JSON answer (a dev server’s page) or another app’s JSON means "not hosted"', async () => {
    hostJson.response = () => Promise.resolve(new Response('<!doctype html><html></html>', { headers: { 'Content-Type': 'text/html' } }))
    await renderEmpty()
    expect(useHost.getState().info).toBeNull()
    hostJson.response = json({ app: 'something-else', obsHost: 'same' })
    const { loadHostInfo } = await import('../../src/store/host')
    await loadHostInfo()
    expect(useHost.getState().info).toBeNull()
  })
})
