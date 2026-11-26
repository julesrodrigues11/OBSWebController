import { useRef, useState, type ChangeEvent } from 'react'
import { downloadText } from '../lib/download'
import { useProfiles } from '../store/profiles'
import {
  ImportError, applyImport, buildExport, exportFileName, parseImport, planImport, type ImportPlan,
} from '../store/settingsFile'

/**
 * Export / Import buttons for the connections screen, with the export options and the
 * "update or keep?" question for imports.
 */
export function SettingsTransfer({ disabled }: { disabled?: boolean }) {
  const profiles = useProfiles((s) => s.profiles)
  const [panel, setPanel] = useState<'export' | null>(null)
  const [includePasswords, setIncludePasswords] = useState(false)
  const [pending, setPending] = useState<{ plan: ImportPlan; skipped: number } | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function doExport() {
    const file = buildExport(profiles, includePasswords)
    downloadText(exportFileName(), JSON.stringify(file, null, 2))
    const n = file.connections.length
    setMessage({ text: `Exported ${n} connection${n === 1 ? '' : 's'}${includePasswords ? ' with saved passwords' : ''}.` })
    setPanel(null)
    setIncludePasswords(false)
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // so choosing the same file again still triggers
    if (!file) return
    setPanel(null)
    try {
      const { connections, skipped } = parseImport(await file.text())
      const plan = planImport(useProfiles.getState().profiles, connections)
      if (plan.conflicts.length) setPending({ plan, skipped })
      else finish(plan, false, skipped)
    } catch (err) {
      setPending(null)
      setMessage({ text: err instanceof ImportError ? err.message : 'Couldn’t read that file.', error: true })
    }
  }

  function finish(plan: ImportPlan, update: boolean, skipped: number) {
    const store = useProfiles.getState()
    store.setAll(applyImport(store.profiles, plan, update))
    setPending(null)
    const parts = [
      plan.added.length && `added ${plan.added.length}`,
      plan.conflicts.length && (update ? `updated ${plan.conflicts.length}` : `kept your ${plan.conflicts.length}`),
      plan.unchanged.length && `${plan.unchanged.length} already up to date`,
      skipped && `skipped ${skipped} unusable`,
    ].filter(Boolean)
    setMessage({ text: `Import done: ${parts.join(', ')}.` })
  }

  return (
    <div className="transfer">
      <div className="transfer__buttons">
        <button
          className={`button--small ${panel === 'export' ? 'is-active' : ''}`}
          onClick={() => { setMessage(null); setPanel(panel === 'export' ? null : 'export') }}
          disabled={disabled || profiles.length === 0}
          title="Save your connections to a file"
        >
          Export
        </button>
        <button
          className="button--small"
          onClick={() => { setMessage(null); fileInput.current?.click() }}
          disabled={disabled}
          title="Add connections from a file"
        >
          Import
        </button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => void onFile(e)} data-testid="import-file" />
      </div>

      {panel === 'export' && (
        <div className="transfer__panel">
          <label className="checkbox">
            <input type="checkbox" checked={includePasswords} onChange={(e) => setIncludePasswords(e.target.checked)} />
            <span>Include saved passwords</span>
          </label>
          {includePasswords && (
            <p className="transfer__warning">
              Passwords will be in the file as plain text. Anyone with the file can control OBS.
            </p>
          )}
          <div className="transfer__actions">
            <button className="button--small" onClick={() => setPanel(null)}>Cancel</button>
            <button onClick={doExport}>Download file</button>
          </div>
        </div>
      )}

      {pending && (
        <div className="transfer__panel" role="alertdialog">
          <p>
            {pending.plan.conflicts.length === 1 ? 'A connection' : `${pending.plan.conflicts.length} connections`} in the file{' '}
            {pending.plan.conflicts.length === 1 ? 'has' : 'have'} the same name as yours but different details:{' '}
            <strong>{pending.plan.conflicts.map((c) => c.existing.name).join(', ')}</strong>.
            {pending.plan.added.length > 0 && <> {pending.plan.added.length} new will be added either way.</>}
          </p>
          <div className="transfer__actions">
            <button className="button--small" onClick={() => setPending(null)}>Cancel import</button>
            <button className="button--small" onClick={() => finish(pending.plan, false, pending.skipped)}>Keep mine</button>
            <button onClick={() => finish(pending.plan, true, pending.skipped)}>Update them</button>
          </div>
        </div>
      )}

      {message && <p className={message.error ? 'error' : 'transfer__done'} role="status">{message.text}</p>}
    </div>
  )
}
