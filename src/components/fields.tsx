import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cleanPath } from '../obs/values'

/**
 * Shared draft/commit behaviour for typed fields:
 * edits apply on Enter (or Ctrl+Enter when multiline) or when the field loses focus;
 * Escape discards. `dirty` is true while the typed value differs from OBS.
 */
function useDraft(value: string, onCommit: (v: string) => void, opts: { multiline?: boolean; clean?: (v: string) => string } = {}) {
  const [draft, setDraft] = useState<string | null>(null)
  const skipBlur = useRef(false)
  const shown = draft ?? value
  const dirty = draft !== null && draft !== value

  function commit() {
    if (draft === null) return
    const v = opts.clean ? opts.clean(draft) : draft
    setDraft(null)
    if (v !== value) onCommit(v)
  }

  return {
    shown,
    dirty,
    onChange: (v: string) => setDraft(v),
    onKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const submit = opts.multiline ? e.key === 'Enter' && (e.ctrlKey || e.metaKey) : e.key === 'Enter'
      if (submit) {
        e.preventDefault()
        commit()
      } else if (e.key === 'Escape') {
        skipBlur.current = true
        setDraft(null)
        e.currentTarget.blur()
      }
    },
    onBlur: () => {
      if (skipBlur.current) skipBlur.current = false
      else commit()
    },
  }
}

interface TextProps {
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  /** Monospace + quote stripping, for file paths. */
  path?: boolean
  title?: string
  disabled?: boolean
}

export function TextField({ value, onCommit, placeholder, path, title, disabled }: TextProps) {
  const d = useDraft(value, onCommit, { clean: path ? cleanPath : (s) => s.trim() })
  return (
    <input
      className={`field ${path ? 'field--mono' : ''} ${d.dirty ? 'is-dirty' : ''}`}
      type="text"
      spellCheck={false}
      value={d.shown}
      placeholder={placeholder}
      title={title ?? (d.shown || undefined)}
      disabled={disabled}
      onChange={(e) => d.onChange(e.target.value)}
      onKeyDown={d.onKeyDown}
      onBlur={d.onBlur}
    />
  )
}

/** Multi-line text: Enter adds a new line; Ctrl+Enter or leaving the field applies. */
export function TextAreaField({ value, onCommit, placeholder }: Omit<TextProps, 'path'>) {
  const d = useDraft(value, onCommit, { multiline: true })
  const lines = Math.min(6, Math.max(1, d.shown.split('\n').length))
  return (
    <textarea
      className={`field field--area ${d.dirty ? 'is-dirty' : ''}`}
      rows={lines}
      value={d.shown}
      placeholder={placeholder}
      title="Ctrl+Enter or click away to apply · Esc to cancel"
      onChange={(e) => d.onChange(e.target.value)}
      onKeyDown={d.onKeyDown}
      onBlur={d.onBlur}
    />
  )
}

/** Checkboxes apply immediately. */
export function CheckboxField({ checked, onChange, label, title }: { checked: boolean; onChange: (v: boolean) => void; label: string; title?: string }) {
  return (
    <label className="check" title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

/**
 * Colour swatch. Applies when the picker is closed (native `change`), not while dragging.
 * (React's onChange fires continuously for colour inputs, so the native event is used.)
 */
export function ColorField({ value, onCommit, title }: { value: string; onCommit: (hex: string) => void; title?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const commitRef = useRef(onCommit)
  useEffect(() => {
    commitRef.current = onCommit
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = () => commitRef.current(el.value)
    el.addEventListener('change', handler)
    return () => el.removeEventListener('change', handler)
  }, [])

  // Uncontrolled so dragging in the picker doesn't fight React; sync when OBS changes.
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) ref.current.value = value
  }, [value])

  return <input ref={ref} className="swatch" type="color" defaultValue={value} title={title ?? value} />
}
