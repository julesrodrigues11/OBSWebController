/**
 * Helpers that make tests read like what you'd do in the app:
 * "connect", "find the Main scene", "find the Chat Overlay row"…
 */
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect } from 'vitest'
import App from '../src/App'
import { useConnection } from '../src/store/connection'
import { useInputs } from '../src/store/inputs'
import { useProfiles } from '../src/store/profiles'
import { useScenes } from '../src/store/scenes'
import { useUi, type SourceScope } from '../src/store/ui'
import { startMockObs, type MockObs, type MockOptions } from './mock/mockObs'

const running: MockObs[] = []

/** Start a mock OBS that's stopped automatically after the test. */
export async function startObs(opts?: MockOptions) {
  const obs = await startMockObs(opts)
  running.push(obs)
  return obs
}

export async function stopAllMocks() {
  await Promise.all(running.splice(0).map((m) => m.stop()))
}

interface Options {
  /** Sources panel scope (default: all sources). */
  scope?: SourceScope
  /** Program preview expanded (default: collapsed, so tests don't poll screenshots). */
  preview?: boolean
  /** Scenes to start collapsed. */
  collapsed?: string[]
  mock?: MockOptions
}

/** Render the app with one saved connection pointing at a fresh mock OBS. Doesn't connect. */
export async function renderApp(opts: Options = {}) {
  const obs = await startObs(opts.mock)
  localStorage.setItem('obs-web-controller:preview-open', String(!!opts.preview))
  localStorage.setItem('obs-web-controller:collapsed-scenes', JSON.stringify(opts.collapsed ?? []))
  useUi.getState().setScope(opts.scope ?? { mode: 'all' })
  useProfiles.setState({
    profiles: [{ id: 'test', name: 'Test OBS', host: '127.0.0.1', port: obs.port, password: obs.password, savePassword: true }],
    lastUsedId: 'test',
  })
  const user = userEvent.setup()
  const view = render(<App />)
  return { obs, user, ...view }
}

/** Render the app, click Connect, and wait until scenes and sources have loaded. */
export async function renderConnected(opts: Options = {}) {
  const app = await renderApp(opts)
  await app.user.click(within(profileRow('Test OBS')).getByRole('button', { name: 'Connect' }))
  await waitForLoaded()
  return app
}

export async function waitForLoaded() {
  await waitFor(() => {
    expect(useConnection.getState().status).toBe('connected')
    expect(Object.keys(useScenes.getState().items).length).toBeGreaterThan(0)
    expect(Object.keys(useInputs.getState().settings).length).toBeGreaterThan(0)
    expect(document.querySelector('.stable')).not.toBeNull()
  })
}

// ---------- finding things on screen ----------

const byText = (selector: string, textSelector: string, text: string, root: ParentNode = document) =>
  [...root.querySelectorAll<HTMLElement>(selector)].find((el) => el.querySelector(textSelector)?.textContent === text)

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Couldn't find ${what} on screen`)
  return value
}

/** A saved connection in the connection list. */
export const profileRow = (name: string) => required(byText('.profile', '.profile__name', name), `connection "${name}"`)

/** A scene's box in the Scenes panel. */
export const sceneBox = (name: string) => required(byText('.scene', '.scene__name', name), `scene "${name}"`)

/** An item row inside a scene (includes its transform editor / confirm bar when open). */
export const itemRow = (scene: string, name: string) =>
  required(byText('.item-wrap', '.item__name', name, sceneBox(scene)), `item "${name}" in "${scene}"`)

/** A source's row in the Sources panel. */
export const sourceRow = (name: string) => required(byText('.sources .srow', '.srow__label', name), `source row "${name}"`)

/** Item names shown in a scene, top-first. */
export const shownItems = (scene: string) =>
  [...sceneBox(scene).querySelectorAll('.item__name')].map((e) => e.textContent)

/** Scene names shown, top-first. */
export const shownScenes = () => [...document.querySelectorAll('.scene .scene__name')].map((e) => e.textContent)

/** Source names shown in the Sources panel, top to bottom. */
export const shownSources = () => [...document.querySelectorAll('.sources .srow__label')].map((e) => e.textContent)

/** Titles of the Sources tables shown (e.g. "Browser"). */
export const shownTables = () =>
  [...document.querySelectorAll('.sources .stable__title')].map((e) => e.firstChild?.textContent?.trim())

/** A button by its tooltip (title), inside an element. */
export function buttonTitled(root: HTMLElement, title: string | RegExp): HTMLButtonElement {
  const match = (t: string) => (typeof title === 'string' ? t === title : title.test(t))
  return required(
    [...root.querySelectorAll<HTMLButtonElement>('button[title]')].find((b) => match(b.title)),
    `button titled ${title}`,
  )
}

/** Wait until the mock OBS has received a request of this type, and return its data. */
export async function waitForRequest(obs: MockObs, type: string, count = 1) {
  await waitFor(() => expect(obs.requestsOf(type).length).toBeGreaterThanOrEqual(count))
  return obs.requestsOf(type)[count - 1]
}
