import { useEffect } from 'react'
import { useConnection } from './store/connection'
import { loadHostInfo } from './store/host'
import { StatusBar } from './components/StatusBar'
import { ConnectForm } from './components/ConnectForm'
import { ScenesPanel } from './features/scenes/ScenesPanel'
import { SourcesPanel } from './features/sources/SourcesPanel'

export default function App() {
  const status = useConnection((s) => s.status)
  const server = useConnection((s) => s.server)
  const error = useConnection((s) => s.error)

  // Find out whether we're served by the host server (e.g. on the OBS PC).
  useEffect(() => {
    void loadHostInfo()
  }, [])

  // Keep showing the (stale) panels while reconnecting, with a banner on top.
  const showPanels = status === 'connected' || status === 'reconnecting'

  return (
    <div className="app">
      <StatusBar />

      {status === 'reconnecting' && (
        <div className="banner banner--warn">
          Lost connection to OBS. Reconnecting… {error && <span className="muted">({error})</span>}
        </div>
      )}
      {status === 'connected' && server && !server.supportsSettingsEvents && (
        <div className="banner">
          This OBS has obs-websocket {server.obsWebSocketVersion}. Changes made directly in OBS won’t
          appear here live. Updating OBS fixes this.
        </div>
      )}

      {showPanels ? (
        <main className="panels">
          <ScenesPanel />
          <SourcesPanel />
        </main>
      ) : (
        <main className="center">
          <ConnectForm />
        </main>
      )}
    </div>
  )
}
