import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { suggestedObs, useHost } from '../store/host'
import { useConnection } from '../store/connection'
import { EyeIcon, EyeOffIcon } from './icons'
import { SettingsTransfer } from './SettingsTransfer'
import { useImportConnections } from './useImportConnections'
import { newProfileId, useProfiles, type Profile } from '../store/profiles'

/** Connect using a saved profile. `password` overrides the stored one (for profiles that don't save it). */
async function connectProfile(p: Profile, password: string) {
  useConnection.getState().setSettings({ host: p.host.trim(), port: p.port, password, profileId: p.id, profileName: p.name })
  useProfiles.getState().markUsed(p.id)
  await useConnection.getState().connect()
}

const blankProfile = (): Profile => ({ id: newProfileId(), name: '', host: '', port: 4455, password: '', savePassword: true })

/** Connection screen: saved connections, plus add/edit/delete. */
export function ConnectForm() {
  const profiles = useProfiles((s) => s.profiles)
  const lastUsedId = useProfiles((s) => s.lastUsedId)
  const status = useConnection((s) => s.status)
  const error = useConnection((s) => s.error)
  const attemptedId = useConnection((s) => s.settings.profileId)

  const [editing, setEditing] = useState<Profile | null>(() => (profiles.length === 0 ? blankProfile() : null))
  const [askingPassword, setAskingPassword] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  /** Result of an import made from the first-run form, shown above the list. */
  const [notice, setNotice] = useState<string | null>(null)
  const busy = status === 'connecting'

  function startConnect(p: Profile) {
    setConfirmDelete(null)
    if (p.savePassword) void connectProfile(p, p.password)
    else setAskingPassword(p.id)
  }

  if (editing) {
    return (
      <ProfileEditor
        profile={editing}
        isNew={!profiles.some((p) => p.id === editing.id)}
        canCancel={profiles.length > 0}
        onCancel={() => setEditing(null)}
        // First run (nothing saved yet): offer importing a connections file instead.
        onImported={profiles.length === 0 ? (summary) => { setEditing(null); setNotice(summary) } : undefined}
        onSave={(p, andConnect) => {
          useProfiles.getState().save(p)
          setEditing(null)
          if (andConnect) startConnect(p)
        }}
      />
    )
  }

  return (
    <div className="connect">
      <div className="connect__head">
        <h2>Connections</h2>
        <SettingsTransfer disabled={busy} />
        <button className="button--small" onClick={() => setEditing(blankProfile())} disabled={busy}>
          + New
        </button>
      </div>
      {notice && <p className="transfer__done connect__notice" role="status">{notice}</p>}

      <ul className="profiles">
        {profiles.map((p) => {
          const attempted = attemptedId === p.id
          return (
            <li key={p.id} className={`profile ${p.id === lastUsedId ? 'is-last' : ''}`}>
              <div className="profile__main">
                <div className="profile__info">
                  <span className="profile__name">{p.name || p.host}</span>
                  <span className="muted">
                    {p.host}:{p.port} · {p.savePassword ? 'password saved' : 'asks for password'}
                    {p.id === lastUsedId && ' · last used'}
                  </span>
                </div>
                {confirmDelete === p.id ? (
                  <div className="profile__actions">
                    <span className="muted">Delete?</span>
                    <button className="button--small button--danger" onClick={() => { useProfiles.getState().remove(p.id); setConfirmDelete(null) }}>
                      Delete
                    </button>
                    <button className="button--small" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  </div>
                ) : (
                  <div className="profile__actions">
                    <button className="button--small" onClick={() => setEditing({ ...p })} disabled={busy}>Edit</button>
                    <button className="button--small" onClick={() => setConfirmDelete(p.id)} disabled={busy}>Delete</button>
                    <button onClick={() => startConnect(p)} disabled={busy}>
                      {busy && attempted ? 'Connecting…' : 'Connect'}
                    </button>
                  </div>
                )}
              </div>

              {askingPassword === p.id && (
                <PasswordPrompt
                  busy={busy}
                  onCancel={() => setAskingPassword(null)}
                  onSubmit={(pw) => { setAskingPassword(null); void connectProfile(p, pw) }}
                />
              )}
              {attempted && error && status === 'error' && <p className="error" role="alert">{error}</p>}
            </li>
          )
        })}
      </ul>

      <p className="hint">
        In OBS: Tools → WebSocket Server Settings → enable the server. “Show Connect Info” there gives the IP and
        password. Connections are saved in this browser only; use Export to copy them to another one.
      </p>
    </div>
  )
}

/** Password input with a show/hide button (handy for checking what was typed). */
function PasswordInput({ value, onChange, autoFocus, disabled, placeholder, autoComplete, onKeyDown }: {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
  disabled?: boolean
  placeholder?: string
  autoComplete?: string
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
}) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="password">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="icon-button"
        onClick={() => setVisible(!visible)}
        disabled={disabled}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </span>
  )
}

function PasswordPrompt({ busy, onSubmit, onCancel }: { busy: boolean; onSubmit: (pw: string) => void; onCancel: () => void }) {
  const [pw, setPw] = useState('')
  return (
    <form className="profile__password" onSubmit={(e) => { e.preventDefault(); onSubmit(pw) }}>
      <PasswordInput
        autoFocus placeholder="Password" value={pw} autoComplete="current-password"
        onChange={setPw} onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      />
      <button type="submit" disabled={busy}>Connect</button>
      <button type="button" className="button--small" onClick={onCancel}>Cancel</button>
    </form>
  )
}

interface EditorProps {
  profile: Profile
  isNew: boolean
  canCancel: boolean
  /** When set, the form offers importing a connections file (first run). */
  onImported?: (summary: string) => void
  onSave: (p: Profile, andConnect: boolean) => void
  onCancel: () => void
}

function ProfileEditor({ profile, isNew, canCancel, onSave, onCancel, onImported }: EditorProps) {
  const [draft, setDraft] = useState(profile)
  // Port is kept as typed text so the field can be cleared and retyped; it's checked on save.
  const [portDraft, setPortDraft] = useState(String(profile.port))
  /** Fields the user has typed in (suggestions never overwrite those). */
  const [edited, setEdited] = useState<Set<'name' | 'host' | 'port'>>(() => new Set())
  const touch = (f: 'name' | 'host' | 'port') => setEdited((s) => new Set(s).add(f))
  const set = (patch: Partial<Profile>) => setDraft({ ...draft, ...patch })

  // When the app is hosted (e.g. on the OBS PC), a new connection starts with that PC's address
  // and OBS port filled in, until the user types their own.
  const hostInfo = useHost((s) => s.info)
  const suggestion = isNew ? suggestedObs(hostInfo) : null
  const suggest = <T,>(field: 'name' | 'host' | 'port', current: T, empty: T, value: T | undefined): T =>
    suggestion && !edited.has(field) && current === empty && value !== undefined ? value : current
  const p = {
    ...draft,
    host: suggest('host', draft.host, '', suggestion?.host),
    name: suggest('name', draft.name, '', suggestion?.same ? 'OBS PC' : undefined),
  }
  const portText = suggest('port', portDraft, String(profile.port), suggestion ? String(suggestion.port) : undefined)
  const prefilled = !!suggestion && p.host === suggestion.host

  const port = Number(portText)
  const portValid = Number.isInteger(port) && port >= 1 && port <= 65535
  const valid = p.host.trim() !== '' && portValid

  function submit(e: FormEvent, andConnect: boolean) {
    e.preventDefault()
    if (!valid) return
    onSave({ ...p, port, host: p.host.trim(), name: p.name.trim() || p.host.trim() }, andConnect)
  }

  return (
    <form className="connect" onSubmit={(e) => submit(e, true)}>
      <h2>{isNew ? 'New connection' : `Edit “${profile.name}”`}</h2>
      {onImported && <FirstRunImport onImported={onImported} />}
      {prefilled && (
        <p className="hint connect__prefilled">
          {suggestion!.same
            ? 'This app is running on the OBS PC, so its address is filled in: just enter the OBS WebSocket password.'
            : 'The OBS PC’s address is filled in from the host settings: just enter the OBS WebSocket password.'}
        </p>
      )}

      <label>
        <span>Name</span>
        <input autoFocus placeholder="e.g. Studio PC" value={p.name} onChange={(e) => { touch('name'); set({ name: e.target.value }) }} />
      </label>
      <label>
        <span>OBS PC address</span>
        <input placeholder="e.g. 192.168.1.50" value={p.host} onChange={(e) => { touch('host'); set({ host: e.target.value }) }} />
      </label>
      <label>
        <span>Port</span>
        <input
          type="number" min={1} max={65535} value={portText} placeholder="4455"
          className={portValid ? '' : 'is-invalid'}
          title={portValid ? undefined : 'Port must be a number from 1 to 65535'}
          onChange={(e) => { touch('port'); setPortDraft(e.target.value) }}
        />
      </label>
      <label>
        <span>Password</span>
        <PasswordInput
          autoComplete="new-password" value={p.password}
          placeholder={p.savePassword ? '' : 'Asked for each time you connect'}
          disabled={!p.savePassword}
          onChange={(v) => set({ password: v })}
        />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={p.savePassword} onChange={(e) => set({ savePassword: e.target.checked, password: e.target.checked ? p.password : '' })} />
        <span>Save password in this browser</span>
      </label>
      {p.savePassword && (
        <p className="hint">Stored unencrypted in this browser's storage. Untick on shared computers.</p>
      )}

      <div className="connect__buttons">
        {canCancel && <button type="button" className="button--small" onClick={onCancel}>Cancel</button>}
        <button type="button" className="button--small" disabled={!valid} onClick={(e) => submit(e, false)}>Save</button>
        <button type="submit" disabled={!valid}>Save &amp; connect</button>
      </div>
    </form>
  )
}

/** "Already have a connections file?" on the first-run form. */
function FirstRunImport({ onImported }: { onImported: (summary: string) => void }) {
  const importer = useImportConnections({ onImported, testId: 'first-run-import-file' })
  return (
    <div className="connect__import">
      <div className="connect__import-row">
        <span>Already have a connections file (e.g. exported on another computer)?</span>
        <button type="button" className="button--small" onClick={importer.choose}>Import file…</button>
        {importer.input}
      </div>
      {importer.question}
      {importer.notice}
    </div>
  )
}
