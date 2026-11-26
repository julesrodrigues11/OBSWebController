import { afterEach, expect, test, vi } from 'vitest'
import { readJson, readString, removeKey, writeJson } from '../../src/lib/storage'

afterEach(() => vi.restoreAllMocks())

test('round-trips JSON', () => {
  writeJson('k', { a: [1, 2] })
  expect(readJson('k', null)).toEqual({ a: [1, 2] })
  removeKey('k')
  expect(readString('k')).toBeNull()
})

test('missing or corrupt values give the fallback', () => {
  expect(readJson('missing', ['default'])).toEqual(['default'])
  localStorage.setItem('broken', '{not json')
  expect(readJson('broken', 42)).toBe(42)
})

test('never throws when storage itself fails', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  expect(readJson('x', 'fallback')).toBe('fallback')
  expect(() => writeJson('x', 1)).not.toThrow()
})
