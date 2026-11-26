import { describe, expect, test } from 'vitest'
import type { Profile } from '../../src/store/profiles'
import { applyImport, buildExport, exportFileName, parseImport, planImport } from '../../src/store/settingsFile'

const profile = (name: string, over: Partial<Profile> = {}): Profile => ({
  id: `id-${name}`, name, host: '192.168.1.50', port: 4455, password: 'secret', savePassword: true, ...over,
})

describe('export', () => {
  const profiles = [profile('Studio PC'), profile('Laptop', { host: '10.0.0.5', password: '', savePassword: false })]

  test('leaves passwords out by default', () => {
    const file = buildExport(profiles, false, new Date('2026-11-26T12:00:00Z'))
    expect(file).toEqual({
      app: 'stagehand-obs', kind: 'settings', version: 1, exportedAt: '2026-11-26T12:00:00.000Z',
      connections: [
        { name: 'Studio PC', host: '192.168.1.50', port: 4455 },
        { name: 'Laptop', host: '10.0.0.5', port: 4455 },
      ],
    })
  })

  test('includes saved passwords only when asked, and never unsaved ones', () => {
    const typedButNotSaved = profile('Typed', { password: 'in-memory-only', savePassword: false })
    const file = buildExport([...profiles, typedButNotSaved], true)
    expect(file.connections.map((c) => c.password)).toEqual(['secret', undefined, undefined])
  })

  test('file name includes the date', () => {
    expect(exportFileName(new Date('2026-11-26T12:00:00Z'))).toBe('stagehand-connections-2026-11-26.json')
  })
})

describe('reading a file', () => {
  const file = (connections: unknown[], extra = {}) => JSON.stringify({ app: 'stagehand-obs', kind: 'settings', version: 1, connections, ...extra })

  test('round-trips what export writes', () => {
    const exported = JSON.stringify(buildExport([profile('Studio PC')], true))
    expect(parseImport(exported).connections).toEqual([{ name: 'Studio PC', host: '192.168.1.50', port: 4455, password: 'secret' }])
  })

  test('files exported before the rename (as OBS Web Controller) still import', () => {
    const old = JSON.stringify({ app: 'obs-web-controller', kind: 'settings', version: 1, connections: [{ name: 'Studio PC', host: '192.168.1.50', port: 4455 }] })
    expect(parseImport(old).connections.map((c) => c.name)).toEqual(['Studio PC'])
  })

  test('explains what is wrong with bad files', () => {
    expect(() => parseImport('not json')).toThrow(/isn’t valid JSON/)
    expect(() => parseImport('{"hello":1}')).toThrow(/isn’t a Stagehand connections file/)
    expect(() => parseImport(file([], { version: 99 }))).toThrow(/newer version/)
    expect(() => parseImport(file([]))).toThrow(/no connections/)
  })

  test('skips unusable entries and fills in missing names', () => {
    const parsed = parseImport(file([
      { name: 'Good', host: '10.0.0.1', port: 4455 },
      { name: 'No host', port: 4455 },
      { name: 'Bad port', host: '10.0.0.2', port: 99999 },
      { host: ' 10.0.0.3 ', port: 4460 },
    ]))
    expect(parsed.connections).toEqual([
      { name: 'Good', host: '10.0.0.1', port: 4455 },
      { name: '10.0.0.3', host: '10.0.0.3', port: 4460 },
    ])
    expect(parsed.skipped).toBe(2)
  })
})

describe('importing', () => {
  const mine = [profile('Studio PC'), profile('Laptop', { host: '10.0.0.5', password: '', savePassword: false })]

  test('matches by name, ignoring case and spaces', () => {
    const plan = planImport(mine, [
      { name: ' studio pc ', host: '192.168.1.99', port: 4455 }, // same name, new address
      { name: 'LAPTOP', host: '10.0.0.5', port: 4455 }, // identical
      { name: 'Rehearsal', host: '10.0.0.9', port: 4455 }, // new
    ])
    expect(plan.conflicts.map((c) => c.existing.name)).toEqual(['Studio PC'])
    expect(plan.unchanged.map((c) => c.name)).toEqual(['LAPTOP'])
    expect(plan.added.map((c) => c.name)).toEqual(['Rehearsal'])
  })

  test('"Update them" takes the file’s address but keeps my saved password if the file has none', () => {
    const plan = planImport(mine, [{ name: 'Studio PC', host: '192.168.1.99', port: 4460 }])
    const [studio] = applyImport(mine, plan, true)
    expect(studio).toMatchObject({ id: 'id-Studio PC', host: '192.168.1.99', port: 4460, password: 'secret', savePassword: true })
  })

  test('"Update them" uses the file’s password when it has one', () => {
    const plan = planImport(mine, [{ name: 'Laptop', host: '10.0.0.5', port: 4455, password: 'new' }])
    expect(applyImport(mine, plan, true)[1]).toMatchObject({ password: 'new', savePassword: true })
  })

  test('"Keep mine" leaves existing connections untouched but still adds new ones', () => {
    const plan = planImport(mine, [
      { name: 'Studio PC', host: '192.168.1.99', port: 4455 },
      { name: 'Rehearsal', host: '10.0.0.9', port: 4455 },
    ])
    const result = applyImport(mine, plan, false)
    expect(result[0]).toEqual(mine[0])
    expect(result.map((p) => p.name)).toEqual(['Studio PC', 'Laptop', 'Rehearsal'])
  })

  test('new connections without a password ask for it; with one, it is saved', () => {
    const plan = planImport([], [
      { name: 'A', host: '10.0.0.1', port: 4455 },
      { name: 'B', host: '10.0.0.2', port: 4455, password: 'pw' },
    ])
    const [a, b] = applyImport([], plan, true)
    expect(a).toMatchObject({ savePassword: false, password: '' })
    expect(b).toMatchObject({ savePassword: true, password: 'pw' })
    expect(a.id).not.toBe(b.id)
  })

  test('duplicate names inside one file: the first wins', () => {
    const plan = planImport([], [{ name: 'X', host: '1.1.1.1', port: 1 }, { name: 'x', host: '2.2.2.2', port: 2 }])
    expect(plan.added).toEqual([{ name: 'X', host: '1.1.1.1', port: 1 }])
  })
})
