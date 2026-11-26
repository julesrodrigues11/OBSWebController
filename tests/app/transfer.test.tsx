import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../src/App'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useProfiles, type Profile } from '../../src/store/profiles'
import { profileRow, renderApp } from '../helpers'

// Capture downloads instead of letting the (simulated) browser try to save a file.
let downloaded: { name: string; blob: Blob }[] = []
beforeEach(() => {
  downloaded = []
  let lastBlob: Blob
  URL.createObjectURL = vi.fn((b: Blob) => { lastBlob = b; return 'blob:test' })
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloaded.push({ name: this.download, blob: lastBlob })
  })
})
afterEach(() => vi.restoreAllMocks())

const saved = (over: Partial<Profile> & { name: string }): Profile => ({
  id: `id-${over.name}`, host: '192.168.1.50', port: 4455, password: 'secret', savePassword: true, ...over,
})
async function setup(profiles: Profile[]) {
  const app = await renderApp()
  useProfiles.getState().setAll(profiles)
  await screen.findByText(profiles[0]?.name ?? 'Connections')
  return app
}
const fileInput = () => screen.getByTestId('import-file') as HTMLInputElement
const settingsFile = (connections: object[]) =>
  new File([JSON.stringify({ app: 'stagehand-obs', kind: 'settings', version: 1, connections })], 'settings.json', { type: 'application/json' })

describe('export', () => {
  test('downloads a file without passwords by default', async () => {
    const { user } = await setup([saved({ name: 'Studio PC' })])
    await user.click(screen.getByRole('button', { name: 'Export' }))
    expect((screen.getByLabelText('Include saved passwords') as HTMLInputElement).checked).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Download file' }))
    expect(downloaded).toHaveLength(1)
    expect(downloaded[0].name).toMatch(/^stagehand-connections-\d{4}-\d{2}-\d{2}\.json$/)
    const content = JSON.parse(await downloaded[0].blob.text())
    expect(content.connections).toEqual([{ name: 'Studio PC', host: '192.168.1.50', port: 4455 }])
    expect(screen.getByRole('status').textContent).toMatch(/Exported 1 connection/)
  })

  test('ticking "Include saved passwords" warns, and the file then contains them', async () => {
    const { user } = await setup([saved({ name: 'Studio PC' })])
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(screen.getByLabelText('Include saved passwords'))
    expect(screen.getByText(/plain text/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Download file' }))
    const content = JSON.parse(await downloaded[0].blob.text())
    expect(content.connections[0].password).toBe('secret')
  })

  test('Export is unavailable with no saved connections', async () => {
    await renderApp()
    useProfiles.getState().setAll([])
    await waitFor(() => expect((screen.getByRole('button', { name: 'Export' }) as HTMLButtonElement).disabled).toBe(true))
  })
})

describe('import', () => {
  test('adds new connections straight away; without a password they ask for one', async () => {
    const { user } = await setup([saved({ name: 'Studio PC' })])
    await user.upload(fileInput(), settingsFile([{ name: 'Rehearsal Room', host: '10.0.0.9', port: 4455 }]))
    await screen.findByText('Rehearsal Room')
    expect(profileRow('Rehearsal Room').textContent).toContain('asks for password')
    expect(screen.getByRole('status').textContent).toMatch(/added 1/)
  })

  test('same name, different details: asks once, and "Update them" takes the file’s address', async () => {
    const { user } = await setup([saved({ name: 'Studio PC' })])
    await user.upload(fileInput(), settingsFile([
      { name: 'Studio PC', host: '192.168.1.99', port: 4455 },
      { name: 'Laptop', host: '10.0.0.5', port: 4455 },
    ]))
    const question = await screen.findByRole('alertdialog')
    expect(question.textContent).toMatch(/same name as yours but different details: Studio PC/)
    expect(question.textContent).toMatch(/1 new will be added/)
    await user.click(within(question).getByRole('button', { name: 'Update them' }))
    expect(profileRow('Studio PC').textContent).toContain('192.168.1.99:4455')
    expect(profileRow('Studio PC').textContent).toContain('password saved') // kept, file had none
    expect(profileRow('Laptop')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/added 1, updated 1/)
  })

  test('"Keep mine" leaves my connection as it was', async () => {
    const { user } = await setup([saved({ name: 'Studio PC' })])
    await user.upload(fileInput(), settingsFile([{ name: 'studio pc', host: '192.168.1.99', port: 4455 }]))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep mine' }))
    expect(profileRow('Studio PC').textContent).toContain('192.168.1.50:4455')
    expect(useProfiles.getState().profiles).toHaveLength(1)
  })

  test('"Cancel import" changes nothing', async () => {
    const { user } = await setup([saved({ name: 'Studio PC' })])
    await user.upload(fileInput(), settingsFile([{ name: 'Studio PC', host: '1.2.3.4', port: 4455 }, { name: 'New', host: '1.2.3.5', port: 4455 }]))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel import' }))
    expect(useProfiles.getState().profiles.map((p) => p.name)).toEqual(['Studio PC'])
  })

  test('a file that isn’t a settings file shows why', async () => {
    const { user } = await setup([saved({ name: 'Studio PC' })])
    await user.upload(fileInput(), new File(['{"something":"else"}'], 'other.json', { type: 'application/json' }))
    expect((await screen.findByText(/isn’t a Stagehand connections file/)).className).toBe('error')
    expect(useProfiles.getState().profiles).toHaveLength(1)
  })

  test('an exported file imports back unchanged', async () => {
    const { user } = await setup([saved({ name: 'Studio PC' }), saved({ name: 'Laptop', host: '10.0.0.5' })])
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(screen.getByRole('button', { name: 'Download file' }))
    await user.upload(fileInput(), new File([await downloaded[0].blob.text()], 'back.json', { type: 'application/json' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/2 already up to date/))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('import on the first-run "New connection" form', () => {
  /** A genuine first run: nothing saved, so the app opens straight onto the New connection form. */
  async function firstRun() {
    useProfiles.setState({ profiles: [], lastUsedId: null })
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'New connection' })
    return { user, input: () => screen.getByTestId('first-run-import-file') as HTMLInputElement }
  }

  test('offers "Import file…"; a good file closes the form and lists the connections', async () => {
    const { user, input } = await firstRun()
    expect(screen.getByRole('button', { name: 'Import file…' })).toBeTruthy()
    await user.upload(input(), settingsFile([
      { name: 'Studio PC', host: '192.168.1.50', port: 4455 },
      { name: 'Lecture hall', host: '192.168.1.60', port: 4455, password: 'pw' },
    ]))
    await screen.findByText('Studio PC')
    expect(screen.queryByRole('heading', { name: 'New connection' })).toBeNull()
    expect(profileRow('Lecture hall')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Import done: added 2.')
    expect(useProfiles.getState().profiles.map((p) => p.name)).toEqual(['Studio PC', 'Lecture hall'])
  })

  test('a bad file shows the error and keeps the form open', async () => {
    const { user, input } = await firstRun()
    await user.upload(input(), new File(['not json'], 'oops.json', { type: 'application/json' }))
    expect((await screen.findByRole('status')).className).toBe('error')
    expect(screen.getByRole('heading', { name: 'New connection' })).toBeTruthy()
    expect(useProfiles.getState().profiles).toEqual([])
  })

  test('is not offered when adding a connection alongside saved ones', async () => {
    const { user } = await setup([saved({ name: 'Studio PC' })])
    await user.click(screen.getByRole('button', { name: '+ New' }))
    await screen.findByRole('heading', { name: 'New connection' })
    expect(screen.queryByRole('button', { name: 'Import file…' })).toBeNull()
  })
})
