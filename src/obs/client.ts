import OBSWebSocket from 'obs-websocket-js'

/**
 * The single obs-websocket client for the whole app.
 * Only the connection store should call connect()/disconnect() on it;
 * features call `obs.call(...)` and subscribe to events via the store.
 */
export const obs = new OBSWebSocket()

/** First obs-websocket version that emits InputSettingsChanged (live sync of source edits). */
export const MIN_RECOMMENDED_WS_VERSION = '5.4.0'

/** Compare dotted versions: returns true if `a` >= `b`. */
export function versionAtLeast(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x > y
  }
  return true
}

/**
 * Turn obs-websocket / browser WebSocket close codes into messages an operator can act on.
 * https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md#websocketclosecode
 */
export function describeCloseCode(code: number | undefined, fallback?: string): string {
  switch (code) {
    case 4009:
      return 'Wrong password (authentication failed).'
    case 4010:
      return 'OBS and this app disagree on the websocket protocol version. Update OBS.'
    case 4011:
      return 'Disconnected by OBS (another session may have kicked this one).'
    case -1: // socket-level failure reported by obs-websocket-js
    case 1006:
      return 'Could not reach OBS. Check the IP and port, that the WebSocket server is enabled in OBS, and that Windows Firewall allows inbound TCP 4455.'
    case 1000:
    case 1001:
      return 'OBS closed the connection (OBS may have been shut down).'
    default:
      return fallback || `Connection failed${code ? ` (code ${code})` : ''}.`
  }
}

/** Readable text for a failed request, including OBS's status code when there is one. */
export function errorText(e: unknown): string {
  const err = e as { message?: string; code?: number } | undefined
  const msg = err?.message?.trim() || 'OBS gave no details'
  return typeof err?.code === 'number' && err.code > 0 ? `${msg} (code ${err.code})` : msg
}

/** Wraps a request so its error says which request (and source) failed. */
export async function labelled<T>(label: string, p: Promise<T>): Promise<T> {
  try {
    return await p
  } catch (e) {
    console.error(`[OBS] ${label} failed:`, e)
    throw new Error(`${label}: ${errorText(e)}`)
  }
}
