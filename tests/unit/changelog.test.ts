// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { notesFor, release } from '../../scripts/changelog.mjs'

const log = `# Changelog

Intro text.

## [Unreleased]

### Fixed

- The port field.

## [0.1.0] - 2026-11-20

### Added

- Everything.
`

describe('release', () => {
  test('moves Unreleased notes under a dated version heading, leaving Unreleased empty', () => {
    const out = release(log, '0.1.1', '2026-11-26')
    expect(out).toContain('## [Unreleased]\n\n## [0.1.1] - 2026-11-26\n\n### Fixed\n\n- The port field.')
    expect(notesFor(out, '0.1.1')).toBe('### Fixed\n\n- The port field.')
    expect(notesFor(out, '0.1.0')).toBe('### Added\n\n- Everything.')
  })

  test('refuses an empty Unreleased section, a duplicate version, or a non-semver version', () => {
    const released = release(log, '0.1.1')
    expect(() => release(released, '0.1.2')).toThrow(/empty/)
    expect(() => release(log, '0.1.0')).toThrow(/already has a section/)
    expect(() => release(log, 'v1')).toThrow(/semantic version/)
    expect(() => release('# Changelog\n', '1.0.0')).toThrow(/no "## \[Unreleased\]"/)
  })
})

test('notesFor explains when a version has no section', () => {
  expect(() => notesFor(log, '9.9.9')).toThrow(/no section for 9.9.9/)
})
