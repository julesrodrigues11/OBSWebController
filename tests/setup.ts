/**
 * Runs before every test file. Cleans up after each test so tests can't affect each other.
 */
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { useConnection } from '../src/store/connection'
import { useHost } from '../src/store/host'
import { useShowMode } from '../src/store/showMode'
import { stopAllMocks } from './helpers'

// The app asks for ./host.json at start-up (to see if it's hosted on the OBS PC). By default tests
// behave like the dev server: not hosted. Tests can set `hostJsonResponse` to pretend otherwise.
const realFetch = globalThis.fetch
export const hostJson: { response: (() => Promise<Response>) | null } = { response: null }
beforeEach(() => {
  hostJson.response = null
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url === 'http://localhost/host.json' || url === './host.json') {
      return hostJson.response ? hostJson.response() : Promise.resolve(new Response('Not found', { status: 404 }))
    }
    return realFetch(input, init)
  }) as typeof fetch
})

afterEach(async () => {
  await useConnection.getState().disconnect() // also clears the scenes/sources stores
  cleanup() // unmount anything rendered
  await stopAllMocks()
  // Tests that run without the simulated browser (e.g. script tests) have no localStorage.
  if (typeof localStorage !== 'undefined') localStorage.clear()
  globalThis.fetch = realFetch
  useHost.setState({ info: null, loaded: false })
  useShowMode.setState({ on: false })
})

// React warns when state changes outside its test helper `act()`. Here those changes come from
// the (mock) OBS over the network, which is exactly what we want to test, so the warning is noise.
const error = console.error
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) return
  error(...args)
}
