/**
 * Runs before every test file. Cleans up after each test so tests can't affect each other.
 */
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { useConnection } from '../src/store/connection'
import { stopAllMocks } from './helpers'

afterEach(async () => {
  await useConnection.getState().disconnect() // also clears the scenes/sources stores
  cleanup() // unmount anything rendered
  await stopAllMocks()
  localStorage.clear()
})

// React warns when state changes outside its test helper `act()`. Here those changes come from
// the (mock) OBS over the network, which is exactly what we want to test, so the warning is noise.
const error = console.error
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) return
  error(...args)
}
