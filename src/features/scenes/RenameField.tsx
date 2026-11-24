import { useRef, useState } from 'react'
import { useScenes } from '../../store/scenes'
import { useTakenNames } from '../../store/names'

/**
 * Inline scene-name editor. Enter or leaving the field applies; Escape cancels.
 * An empty or already-used name can't be applied: Enter shows why, leaving the field cancels.
 */
export function RenameField({ name, onDone }: { name: string; onDone: (newName: string | null) => void }) {
  const renameScene = useScenes((s) => s.renameScene)
  const taken = useTakenNames()
  const [value, setValue] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const done = useRef(false)

  const trimmed = value.trim()
  const problem = !trimmed ? 'Name can’t be empty.' : trimmed !== name && taken.has(trimmed) ? 'That name is already used.' : null

  async function apply(fromBlur: boolean) {
    if (done.current) return
    if (trimmed === name) { done.current = true; return onDone(null) }
    if (problem) {
      if (fromBlur) { done.current = true; return onDone(null) } // leaving with an invalid name cancels
      return setError(problem)
    }
    done.current = true
    const err = await renameScene(name, trimmed)
    if (err) { done.current = false; setError(err) }
    else onDone(trimmed)
  }

  return (
    <span className="rename">
      <input
        className={`field rename__input ${problem && trimmed !== name ? 'is-invalid' : ''}`}
        autoFocus
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => { setValue(e.target.value); setError(null) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void apply(false) }
          else if (e.key === 'Escape') { done.current = true; onDone(null) }
        }}
        onBlur={() => void apply(true)}
        title="Enter or click away to rename · Esc to cancel"
      />
      {error && <span className="error rename__error">{error}</span>}
    </span>
  )
}
