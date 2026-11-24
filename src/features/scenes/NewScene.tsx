import { useState, type FormEvent } from 'react'
import { useScenes } from '../../store/scenes'
import { uniqueName, useTakenNames } from '../../store/names'

/** Inline form at the top of the Scenes panel for creating an empty scene. */
export function NewScene({ onClose }: { onClose: () => void }) {
  const createScene = useScenes((s) => s.createScene)
  const taken = useTakenNames()
  const [name, setName] = useState<string | null>(null) // null = use the suggestion
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const suggested = uniqueName('Scene', taken)
  const finalName = (name ?? suggested).trim()
  const clash = taken.has(finalName)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!finalName || clash || busy) return
    setBusy(true)
    const err = await createScene(finalName)
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <form className="newscene" onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <span className="newscene__label">New scene</span>
      <input
        className={`field ${clash ? 'is-invalid' : ''}`}
        autoFocus
        value={name ?? suggested}
        onFocus={(e) => e.target.select()}
        onChange={(e) => { setName(e.target.value); setError(null) }}
        placeholder="Scene name"
        title={clash ? 'A source or scene with this name already exists' : 'Scene name (must be unique)'}
      />
      <button type="submit" disabled={busy || !finalName || clash}>{busy ? 'Creating…' : 'Create'}</button>
      <button type="button" className="button--small" onClick={onClose}>Cancel</button>
      {(clash || error) && <span className="error newscene__error">{clash ? 'That name is already used.' : error}</span>}
    </form>
  )
}
