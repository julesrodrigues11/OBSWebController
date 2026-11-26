// Types for host/server.mjs (plain JavaScript so it runs with Node directly on the OBS PC).
import type { Server } from 'node:http'
export const DEFAULTS: { port: number; obsHost: string; obsPort: number }
export function loadConfig(file?: string): { port: number; obsHost: string | null; obsPort: number }
export function createAppServer(opts: { dir: string; version?: string; obsHost?: string | null; obsPort?: number }): Server
export function lanAddresses(): string[]
