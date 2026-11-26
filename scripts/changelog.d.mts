// Types for scripts/changelog.mjs (plain JavaScript so it runs with Node directly).
export function sectionBody(changelog: string, heading: RegExp): string | null
export function release(changelog: string, version: string, date?: string): string
export function notesFor(changelog: string, version: string): string
