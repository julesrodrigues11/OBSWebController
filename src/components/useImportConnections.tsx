import { useRef, useState, type ChangeEvent } from 'react'
import { useProfiles } from '../store/profiles'
import { ImportError, applyImport, parseImport, planImport, type ImportPlan } from '../store/settingsFile'

/**
 * The "import connections from a file" flow, shared by the connections list and the first-run
 * "New connection" form: pick a file, check it, ask once about same-name connections, apply.
 *
 * Returns a function that opens the file picker, plus elements to render: the hidden file input,
 * the update-or-keep question (when needed) and a result/error message.
 */
export function useImportConnections({ onImported, testId = 'import-file' }: { onImported?: (summary: string) => void; testId?: string } = {}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ plan: ImportPlan; skipped: number } | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  function choose() {
    setMessage(null)
    fileInput.current?.click()
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // so choosing the same file again still triggers
    if (!file) return
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
    const summary = `Import done: ${parts.join(', ')}.`
    setMessage({ text: summary })
    onImported?.(summary)
  }

  const input = (
    <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => void onFile(e)} data-testid={testId} />
  )

  const question = pending && (
    <div className="transfer__panel" role="alertdialog">
      <p>
        {pending.plan.conflicts.length === 1 ? 'A connection' : `${pending.plan.conflicts.length} connections`} in the file{' '}
        {pending.plan.conflicts.length === 1 ? 'has' : 'have'} the same name as yours but different details:{' '}
        <strong>{pending.plan.conflicts.map((c) => c.existing.name).join(', ')}</strong>.
        {pending.plan.added.length > 0 && <> {pending.plan.added.length} new will be added either way.</>}
      </p>
      <div className="transfer__actions">
        <button type="button" className="button--small" onClick={() => setPending(null)}>Cancel import</button>
        <button type="button" className="button--small" onClick={() => finish(pending.plan, false, pending.skipped)}>Keep mine</button>
        <button type="button" onClick={() => finish(pending.plan, true, pending.skipped)}>Update them</button>
      </div>
    </div>
  )

  const notice = message && <p className={message.error ? 'error' : 'transfer__done'} role="status">{message.text}</p>

  return { choose, input, question, notice, clearMessage: () => setMessage(null), setMessage }
}
