#!/usr/bin/env node
/**
 * CHANGELOG.md helpers (format: https://keepachangelog.com).
 *
 *   node scripts/changelog.mjs release [version]   Move "Unreleased" notes into a dated version section.
 *                                                   Run automatically by `npm version` (version taken
 *                                                   from npm_package_version if not given).
 *   node scripts/changelog.mjs notes <version>     Print one version's notes (used for GitHub releases).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const UNRELEASED = /^## \[Unreleased\][^\n]*\n/m

/** The text of a section (without its heading), up to the next "## " heading. */
export function sectionBody(changelog, heading) {
  const start = changelog.search(heading)
  if (start < 0) return null
  const afterHeading = changelog.indexOf('\n', start) + 1
  const next = changelog.slice(afterHeading).search(/^## /m)
  return (next < 0 ? changelog.slice(afterHeading) : changelog.slice(afterHeading, afterHeading + next)).trim()
}

/** Returns the changelog with Unreleased notes moved under "## [version] - date". */
export function release(changelog, version, date = new Date().toISOString().slice(0, 10)) {
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`"${version}" isn't a semantic version (e.g. 1.2.3).`)
  if (!UNRELEASED.test(changelog)) throw new Error('CHANGELOG.md has no "## [Unreleased]" section.')
  if (new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm').test(changelog)) throw new Error(`CHANGELOG.md already has a section for ${version}.`)
  const notes = sectionBody(changelog, UNRELEASED)
  if (!notes) throw new Error('The "Unreleased" section of CHANGELOG.md is empty: describe the changes before releasing.')
  return changelog.replace(UNRELEASED, (h) => `${h}\n## [${version}] - ${date}\n`)
}

/** The notes for one version, or throws if there's no such section. */
export function notesFor(changelog, version) {
  const body = sectionBody(changelog, new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\][^\\n]*$`, 'm'))
  if (body === null) throw new Error(`CHANGELOG.md has no section for ${version}.`)
  return body
}

// ---- command line ----
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, arg] = process.argv.slice(2)
  const file = new URL('../CHANGELOG.md', import.meta.url)
  try {
    const text = readFileSync(file, 'utf8')
    if (cmd === 'release') {
      const version = arg ?? process.env.npm_package_version
      if (!version) throw new Error('No version given.')
      writeFileSync(file, release(text, version))
      console.log(`CHANGELOG.md: Unreleased notes moved to ${version}.`)
    } else if (cmd === 'notes') {
      if (!arg) throw new Error('Usage: node scripts/changelog.mjs notes <version>')
      process.stdout.write(notesFor(text, arg.replace(/^v/, '')) + '\n')
    } else {
      throw new Error('Usage: node scripts/changelog.mjs release [version] | notes <version>')
    }
  } catch (e) {
    console.error(`Error: ${e.message}`)
    process.exit(1)
  }
}
