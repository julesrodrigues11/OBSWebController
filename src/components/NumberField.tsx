import { useRef, useState } from 'react'
import { fmt } from '../obs/transform'

interface Props {
  label: string
  value: number
  onCommit: (n: number) => void
  /** Optional check; return false to reject the typed value (field reverts). */
  validate?: (n: number) => boolean
  unit?: string
  disabled?: boolean
  title?: string
}

/**
 * Number input that only applies on Enter or when the field loses focus.
 * Escape discards the edit. While a typed value differs from OBS, the field is highlighted.
 */
export function NumberField({ label, value, onCommit, validate, unit, disabled, title }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const skipBlur = useRef(false)
  const shown = draft ?? fmt(value)
  const dirty = draft !== null && draft.trim() !== fmt(value)

  function commit() {
    if (draft === null) return
    const n = Number(draft.trim().replace(',', '.'))
    setDraft(null)
    if (draft.trim() === '' || !Number.isFinite(n) || (validate && !validate(n))) return // revert
    if (fmt(n) !== fmt(value)) onCommit(n)
  }

  return (
    <label className={`numfield ${dirty ? 'is-dirty' : ''}`} title={title}>
      <span className="numfield__label">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        disabled={disabled}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit()
            ;(e.target as HTMLInputElement).select()
          } else if (e.key === 'Escape') {
            skipBlur.current = true
            setDraft(null)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        onBlur={() => {
          if (skipBlur.current) skipBlur.current = false
          else commit()
        }}
      />
      {unit && <span className="numfield__unit">{unit}</span>}
    </label>
  )
}
