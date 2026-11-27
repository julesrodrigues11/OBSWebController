import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { ErrorBoundary } from '../../src/components/ErrorBoundary'

function Broken(): never {
  throw new Error('boom')
}

test('an error inside the boundary hides only that part, not the whole page', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  render(
    <div>
      <ErrorBoundary name="Test part"><Broken /></ErrorBoundary>
      <p>Rest of the page</p>
    </div>,
  )
  expect(screen.getByText('Rest of the page')).toBeTruthy()
  expect(log.mock.calls.some((c) => String(c[0]).includes('Test part stopped working'))).toBe(true)
  log.mockRestore()
})
