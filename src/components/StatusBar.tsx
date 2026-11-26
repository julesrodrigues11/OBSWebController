import { useConnection } from '../store/connection'
import { APP_VERSION } from '../version'

const LABELS = {
  disconnected: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  error: 'Error',
} as const

export function StatusBar() {
  const status = useConnection((s) => s.status)
  const settings = useConnection((s) => s.settings)
  const server = useConnection((s) => s.server)
  const disconnect = useConnection((s) => s.disconnect)

  const online = status === 'connected' || status === 'reconnecting'

  return (
    <header className="topbar">
      <h1>
        Stagehand <span className="topbar__version" title="App version">v{APP_VERSION}</span>
      </h1>
      <div className="topbar__right">
        {online && (
          <span className="muted">
            {settings.profileName && <strong className="statusbar__profile">{settings.profileName}</strong>}{' '}
            {settings.host}:{settings.port}
            {server && ` · OBS ${server.obsVersion} · ws ${server.obsWebSocketVersion}`}
          </span>
        )}
        <span className={`status status--${status}`}>{LABELS[status]}</span>
        {online && (
          <button className="button--small" onClick={() => void disconnect()}>
            Disconnect
          </button>
        )}
      </div>
    </header>
  )
}
