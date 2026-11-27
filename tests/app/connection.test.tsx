import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { useConnection } from '../../src/store/connection'
import { useProfiles } from '../../src/store/profiles'
import { profileRow, renderApp, renderConnected, shownScenes, startObs } from '../helpers'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const connectButton = (name: string) => within(profileRow(name)).getByRole('button', { name: 'Connect' })

describe('connecting', () => {
  test('connects with a saved connection and shows OBS details', async () => {
    await renderConnected()
    expect(shownScenes()).toEqual(['Starting Soon', 'Main', 'Interview', 'BRB'])
    const bar = document.querySelector('.topbar')!
    expect(bar.textContent).toContain('Test OBS')
    expect(bar.textContent).toContain('OBS 31.1.2')
    expect(bar.textContent).toContain('Connected')
  })

  test('a wrong password shows a clear error under that connection and is not retried', async () => {
    const { obs, user } = await renderApp()
    useProfiles.getState().save({ ...useProfiles.getState().profiles[0], password: 'wrong' })
    await user.click(connectButton('Test OBS'))
    await waitFor(() => expect(profileRow('Test OBS').textContent).toMatch(/wrong password/i))
    const attempts = obs.requests.length
    await sleep(1500)
    expect(useConnection.getState().status).toBe('error')
    expect(obs.requests.length).toBe(attempts) // no retry loop
  })

  test('an unreachable OBS gives a message pointing at the usual causes', async () => {
    const { obs, user } = await renderApp()
    await obs.stop()
    await user.click(connectButton('Test OBS'))
    await waitFor(() => expect(profileRow('Test OBS').textContent).toMatch(/could not reach obs/i))
    expect(profileRow('Test OBS').textContent).toMatch(/firewall/i)
  })

  test('reconnects by itself after OBS goes away and comes back', async () => {
    const { obs } = await renderConnected()
    await obs.stop()
    await screen.findByText(/lost connection to obs/i)
    expect(shownScenes()).toHaveLength(4) // keeps showing the last view meanwhile
    await obs.restart()
    await waitFor(() => expect(useConnection.getState().status).toBe('connected'), { timeout: 8000 })
    expect(screen.queryByText(/lost connection to obs/i)).toBeNull()
  })

  test('Disconnect returns to the connection list', async () => {
    const { user } = await renderConnected()
    await user.click(screen.getByRole('button', { name: 'Disconnect' }))
    // Disconnecting waits for the connection to close (and any requests in flight), so wait for it.
    await waitFor(() => expect(profileRow('Test OBS')).toBeTruthy())
    expect(document.querySelector('.scene')).toBeNull()
  })

  test('warns when OBS is too old to report changes live', async () => {
    await renderConnected({ mock: { wsVersion: '5.3.0' } })
    expect(screen.getByText(/won’t\s+appear here live/i)).toBeTruthy()
  })
})

describe('saved connections', () => {
  test('adding a connection with "Save & connect"', async () => {
    const { obs, user } = await renderApp()
    useProfiles.setState({ profiles: [], lastUsedId: null })
    await user.click(screen.getByRole('button', { name: '+ New' }))
    const form = document.querySelector('form.connect') as HTMLElement
    const field = (label: string) => within(form).getByText(label, { selector: 'label > span' }).parentElement!.querySelector('input')!
    const [name, host, port, password] = ['Name', 'OBS PC address', 'Port', 'Password'].map(field)
    await user.type(name, 'Studio PC')
    await user.type(host, '127.0.0.1')
    await user.clear(port)
    await user.type(port, String(obs.port))
    await user.type(password, obs.password)
    await user.click(within(form).getByRole('button', { name: 'Save & connect' }))
    await waitFor(() => expect(useConnection.getState().status).toBe('connected'))
    expect(useProfiles.getState().profiles.map((p) => p.name)).toEqual(['Studio PC'])
  })

  test('the port field can be cleared and retyped; an invalid port blocks saving', async () => {
    const { user } = await renderApp()
    await user.click(within(profileRow('Test OBS')).getByRole('button', { name: 'Edit' }))
    const port = document.querySelectorAll('form.connect input')[2] as HTMLInputElement
    await user.clear(port)
    expect(port.value).toBe('') // doesn't snap back to 4455
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    await user.type(port, '70000')
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    await user.clear(port)
    await user.type(port, '4460')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(profileRow('Test OBS').textContent).toContain(':4460')
  })

  test('the show-password button reveals what was typed', async () => {
    const { user } = await renderApp()
    await user.click(within(profileRow('Test OBS')).getByRole('button', { name: 'Edit' }))
    const input = document.querySelector('.password input') as HTMLInputElement
    expect(input.type).toBe('password')
    await user.click(screen.getByTitle('Show password'))
    expect((document.querySelector('.password input') as HTMLInputElement).type).toBe('text')
  })

  test('a connection that does not save its password asks for it, and never stores it', async () => {
    const { obs, user } = await renderApp()
    useProfiles.getState().save({ ...useProfiles.getState().profiles[0], savePassword: false, password: '' })
    expect(JSON.parse(localStorage.getItem('obs-web-controller:profiles')!).profiles[0].password).toBe('')
    await user.click(connectButton('Test OBS'))
    const prompt = profileRow('Test OBS').querySelector('.profile__password') as HTMLElement
    await user.type(within(prompt).getByPlaceholderText('Password'), `${obs.password}{Enter}`)
    await waitFor(() => expect(useConnection.getState().status).toBe('connected'))
  })

  test('editing a connection updates it in place', async () => {
    const { user } = await renderApp()
    await user.click(within(profileRow('Test OBS')).getByRole('button', { name: 'Edit' }))
    const host = document.querySelectorAll('form.connect input')[1] as HTMLInputElement
    await user.clear(host)
    await user.type(host, '10.0.0.99')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(profileRow('Test OBS').textContent).toContain('10.0.0.99:')
  })

  test('deleting asks first, and Cancel keeps it', async () => {
    const { user } = await renderApp()
    await user.click(within(profileRow('Test OBS')).getByRole('button', { name: 'Delete' }))
    expect(profileRow('Test OBS').textContent).toContain('Delete?')
    await user.click(within(profileRow('Test OBS')).getByRole('button', { name: 'Cancel' }))
    await user.click(within(profileRow('Test OBS')).getByRole('button', { name: 'Delete' }))
    await user.click(within(profileRow('Test OBS')).getByRole('button', { name: 'Delete' }))
    expect(document.querySelector('.profile')).toBeNull()
  })
})

test('two mock OBSes can be switched between (profiles are independent)', async () => {
  const { user } = await renderApp()
  const second = await startObs({ password: 'other' })
  useProfiles.getState().save({ id: 'b', name: 'Second', host: '127.0.0.1', port: second.port, password: 'other', savePassword: true })
  await screen.findByText('Second')
  await user.click(connectButton('Second'))
  await waitFor(() => expect(useConnection.getState().settings.profileName).toBe('Second'))
  await waitFor(() => expect(useConnection.getState().status).toBe('connected'))
  expect(second.requestsOf('GetSceneList').length).toBeGreaterThan(0)
})
