import { create } from 'zustand'

/**
 * Whether the app is being served by its own host server (host/server.mjs), e.g. on the OBS PC.
 * The server answers /host.json; anything else (dev server, other hosting) means "not hosted".
 */
export interface HostInfo {
  version: string
  /** "same" = OBS runs on the machine serving the app; an address; or null for no suggestion. */
  obsHost: string | null
  obsPort: number
}

interface HostState {
  info: HostInfo | null
  loaded: boolean
}

export const useHost = create<HostState>()(() => ({ info: null, loaded: false }))

/** Ask the server for host.json once at start-up. Never throws. */
export async function loadHostInfo() {
  try {
    const res = await fetch('./host.json', { cache: 'no-cache' })
    const data = res.ok ? ((await res.json()) as Partial<HostInfo> & { app?: string }) : null
    if (data?.app === 'obs-web-controller') {
      useHost.setState({
        info: {
          version: String(data.version ?? ''),
          obsHost: typeof data.obsHost === 'string' && data.obsHost.trim() ? data.obsHost.trim() : null,
          obsPort: Number.isInteger(data.obsPort) ? Number(data.obsPort) : 4455,
        },
        loaded: true,
      })
      return
    }
  } catch {
    /* not hosted (or the response wasn't host.json, e.g. a dev server's index page) */
  }
  useHost.setState({ info: null, loaded: true })
}

/** The OBS address to suggest for new connections, or null. */
export function suggestedObs(info: HostInfo | null, pageHostname = window.location.hostname) {
  if (!info?.obsHost) return null
  return { host: info.obsHost === 'same' ? pageHostname : info.obsHost, port: info.obsPort, same: info.obsHost === 'same' }
}
