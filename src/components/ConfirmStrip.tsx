import { useEffect, useRef, type ReactNode } from 'react'

export interface ConfirmAction {
  label: string
  onClick: () => void
  danger?: boolean
}

/**
 * Inline "are you sure?" bar used for deletes (nothing can be undone over obs-websocket).
 * The first action gets focus, so a deliberate second click or Enter confirms; Escape cancels.
 */
export function ConfirmStrip({ message, actions, onCancel }: { message: ReactNode; actions: ConfirmAction[]; onCancel: () => void }) {
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => first.current?.focus(), [])

  return (
    <div className="confirm" role="alertdialog" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <span className="confirm__msg">{message}</span>
      <span className="confirm__actions">
        {actions.map((a, i) => (
          <button
            key={a.label}
            ref={i === 0 ? first : undefined}
            className={`button--small ${a.danger ? 'button--danger' : ''}`}
            onClick={() => { a.onClick(); onCancel() }}
          >
            {a.label}
          </button>
        ))}
        <button className="button--small" onClick={onCancel}>Cancel</button>
      </span>
    </div>
  )
}
