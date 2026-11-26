import { useState } from 'react'
import { downloadText } from '../lib/download'
import { useProfiles } from '../store/profiles'
import { buildExport, exportFileName } from '../store/settingsFile'
import { useImportConnections } from './useImportConnections'

/** Export / Import buttons for the connections list, with the export options. */
export function SettingsTransfer({ disabled }: { disabled?: boolean }) {
  const profiles = useProfiles((s) => s.profiles)
  const [exporting, setExporting] = useState(false)
  const [includePasswords, setIncludePasswords] = useState(false)
  const importer = useImportConnections()

  function doExport() {
    const file = buildExport(profiles, includePasswords)
    downloadText(exportFileName(), JSON.stringify(file, null, 2))
    const n = file.connections.length
    importer.setMessage({ text: `Exported ${n} connection${n === 1 ? '' : 's'}${includePasswords ? ' with saved passwords' : ''}.` })
    setExporting(false)
    setIncludePasswords(false)
  }

  return (
    <div className="transfer">
      <div className="transfer__buttons">
        <button
          className={`button--small ${exporting ? 'is-active' : ''}`}
          onClick={() => { importer.clearMessage(); setExporting(!exporting) }}
          disabled={disabled || profiles.length === 0}
          title="Save your connections to a file"
        >
          Export
        </button>
        <button
          className="button--small"
          onClick={() => { setExporting(false); importer.choose() }}
          disabled={disabled}
          title="Add connections from a file"
        >
          Import
        </button>
        {importer.input}
      </div>

      {exporting && (
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
            <button className="button--small" onClick={() => setExporting(false)}>Cancel</button>
            <button onClick={doExport}>Download file</button>
          </div>
        </div>
      )}

      {importer.question}
      {importer.notice}
    </div>
  )
}
