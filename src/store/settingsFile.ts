/**
 * Export / import of the app's settings as a JSON file.
 *
 * File format (version 1):
 *   {
 *     "app": "obs-web-controller",
 *     "kind": "settings",
 *     "version": 1,
 *     "exportedAt": "2026-11-26T12:00:00.000Z",
 *     "connections": [{ "name": "Studio PC", "host": "192.168.1.50", "port": 4455, "password": "…" }]
 *   }
 * "password" is only present when the user chose to include passwords. Later versions can add
 * more sections (e.g. presets) alongside "connections".
 */
import { newProfileId, type Profile } from './profiles'

export const FILE_APP = 'obs-web-controller'
export const FILE_VERSION = 1

export interface ExportedConnection {
  name: string
  host: string
  port: number
  password?: string
}

export interface SettingsFile {
  app: typeof FILE_APP
  kind: 'settings'
  version: number
  exportedAt: string
  connections: ExportedConnection[]
}

/** Build the file contents. Passwords only if asked, and only those the user chose to save. */
export function buildExport(profiles: Profile[], includePasswords: boolean, now = new Date()): SettingsFile {
  return {
    app: FILE_APP,
    kind: 'settings',
    version: FILE_VERSION,
    exportedAt: now.toISOString(),
    connections: profiles.map((p) => ({
      name: p.name,
      host: p.host,
      port: p.port,
      ...(includePasswords && p.savePassword && p.password ? { password: p.password } : {}),
    })),
  }
}

export function exportFileName(now = new Date()) {
  return `obs-web-controller-connections-${now.toISOString().slice(0, 10)}.json`
}

/** Thrown with a message that can be shown to the user as-is. */
export class ImportError extends Error {}

export interface ParsedImport {
  connections: ExportedConnection[]
  /** Entries in the file that were unusable and skipped. */
  skipped: number
}

/** Check and read a settings file's text. Throws ImportError with a readable reason. */
export function parseImport(text: string): ParsedImport {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('That file isn’t valid JSON.')
  }
  const d = data as Partial<SettingsFile> | null
  if (!d || typeof d !== 'object' || d.app !== FILE_APP) {
    throw new ImportError('That file isn’t an OBS Web Controller settings file.')
  }
  if (typeof d.version !== 'number' || d.version > FILE_VERSION) {
    throw new ImportError('That file was made by a newer version of OBS Web Controller. Update the app to import it.')
  }
  const list = Array.isArray(d.connections) ? d.connections : []
  const connections: ExportedConnection[] = []
  for (const c of list as Partial<ExportedConnection>[]) {
    const host = typeof c?.host === 'string' ? c.host.trim() : ''
    const port = Number(c?.port)
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) continue
    const name = typeof c.name === 'string' && c.name.trim() ? c.name.trim() : host
    connections.push({ name, host, port, ...(typeof c.password === 'string' && c.password ? { password: c.password } : {}) })
  }
  if (connections.length === 0) throw new ImportError('That file has no connections in it.')
  return { connections, skipped: list.length - connections.length }
}

const key = (name: string) => name.trim().toLowerCase()

export interface ImportPlan {
  /** Connections not in the app yet. */
  added: ExportedConnection[]
  /** Same name as an existing connection, with different details. */
  conflicts: { existing: Profile; incoming: ExportedConnection }[]
  /** Same name and same details: nothing to do. */
  unchanged: ExportedConnection[]
}

/** Work out what importing would do, matching connections by name (ignoring case). */
export function planImport(existing: Profile[], incoming: ExportedConnection[]): ImportPlan {
  const plan: ImportPlan = { added: [], conflicts: [], unchanged: [] }
  const seen = new Set<string>()
  for (const c of incoming) {
    if (seen.has(key(c.name))) continue // duplicate names within the file: first one wins
    seen.add(key(c.name))
    const match = existing.find((p) => key(p.name) === key(c.name))
    if (!match) plan.added.push(c)
    else if (match.host === c.host && match.port === c.port && (c.password === undefined || c.password === match.password)) plan.unchanged.push(c)
    else plan.conflicts.push({ existing: match, incoming: c })
  }
  return plan
}

/**
 * Apply a plan. `updateExisting` decides conflicts: true = take the file's address/port (and
 * password, if the file has one); false = keep the app's version.
 * Without a password in the file, an existing saved password is kept, and new connections ask
 * for the password when connecting.
 */
export function applyImport(existing: Profile[], plan: ImportPlan, updateExisting: boolean): Profile[] {
  let result = existing
  if (updateExisting) {
    result = existing.map((p) => {
      const conflict = plan.conflicts.find((c) => c.existing.id === p.id)
      if (!conflict) return p
      const { host, port, password } = conflict.incoming
      return password !== undefined ? { ...p, host, port, password, savePassword: true } : { ...p, host, port }
    })
  }
  const added = plan.added.map((c): Profile => ({
    id: newProfileId(),
    name: c.name,
    host: c.host,
    port: c.port,
    password: c.password ?? '',
    savePassword: c.password !== undefined,
  }))
  return [...result, ...added]
}
