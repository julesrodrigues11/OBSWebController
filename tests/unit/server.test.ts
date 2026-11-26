// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createAppServer, loadConfig } from '../../host/server.mjs'

// A fake built app in a temporary folder, with a secret file next to (outside) it.
const base = mkdtempSync(join(tmpdir(), 'owc-'))
const app = join(base, 'app')
mkdirSync(join(app, 'assets'), { recursive: true })
writeFileSync(join(app, 'index.html'), '<!doctype html><title>Stagehand</title>')
writeFileSync(join(app, 'assets', 'index-abc123.js'), 'console.log(1)')
writeFileSync(join(base, 'secret.txt'), 'do not serve')

const server = createAppServer({ dir: app, version: '1.2.3', obsHost: 'same', obsPort: 4455 })
let url = ''
beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

describe('serving the app', () => {
  test('the page, re-checked on every load so updates show up', async () => {
    const res = await fetch(`${url}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('no-cache')
    expect(await res.text()).toContain('Stagehand')
  })

  test('built assets with the right type, cached long-term (their names change each build)', async () => {
    const res = await fetch(`${url}/assets/index-abc123.js`)
    expect(res.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    expect(res.headers.get('cache-control')).toContain('immutable')
  })

  test('host.json tells the app it is hosted, with version and OBS details', async () => {
    expect(await (await fetch(`${url}/host.json`)).json()).toEqual({
      app: 'stagehand-obs', version: '1.2.3', obsHost: 'same', obsPort: 4455,
    })
  })

  test('missing files are 404', async () => {
    expect((await fetch(`${url}/nope.js`)).status).toBe(404)
  })
})

describe('safety', () => {
  test('never serves files outside the app folder', async () => {
    for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/assets/..%2f..%2fsecret.txt', '/..%5csecret.txt']) {
      const res = await fetch(`${url}${path}`)
      expect(await res.text(), path).not.toContain('do not serve')
    }
  })

  test('only allows reading (GET/HEAD)', async () => {
    expect((await fetch(`${url}/`, { method: 'POST' })).status).toBe(405)
    expect((await fetch(`${url}/`, { method: 'HEAD' })).status).toBe(200)
  })
})

describe('host-config.json', () => {
  test('missing file: defaults', () => {
    expect(loadConfig(join(base, 'none.json'))).toEqual({ port: 8080, obsHost: 'same', obsPort: 4455 })
  })
  test('partial file overrides only what it sets; broken file falls back to defaults', () => {
    writeFileSync(join(base, 'c.json'), '{ "port": 9000, "obsHost": "192.168.1.70" }')
    expect(loadConfig(join(base, 'c.json'))).toEqual({ port: 9000, obsHost: '192.168.1.70', obsPort: 4455 })
    writeFileSync(join(base, 'bad.json'), '{ port: ')
    const warn = console.warn
    console.warn = () => {}
    expect(loadConfig(join(base, 'bad.json')).port).toBe(8080)
    console.warn = warn
  })
})
