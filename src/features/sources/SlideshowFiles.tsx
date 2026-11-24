import { TextField } from '../../components/fields'
import { cleanPath } from '../../obs/values'
import { EyeIcon, EyeOffIcon } from '../../components/icons'

export interface SlideshowFile {
  value: string
  hidden: boolean
  selected: boolean
}

/**
 * Editor for a slideshow's `files` list. OBS replaces the whole array on each change,
 * so every edit sends the complete list.
 */
export function SlideshowFiles({ files, onChange }: { files: SlideshowFile[]; onChange: (next: SlideshowFile[]) => void }) {
  const update = (i: number, patch: Partial<SlideshowFile>) =>
    onChange(files.map((f, n) => (n === i ? { ...f, ...patch } : f)))
  const remove = (i: number) => onChange(files.filter((_, n) => n !== i))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= files.length) return
    const next = [...files]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const add = (v: string) => {
    const value = cleanPath(v)
    if (value) onChange([...files, { value, hidden: false, selected: false }])
  }

  return (
    <div className="slides">
      {files.map((f, i) => (
        <div key={i} className={`slides__item ${f.hidden ? 'is-hidden' : ''}`}>
          <span className="slides__n">{i + 1}</span>
          <button
            className={`icon-button ${f.hidden ? 'is-off' : ''}`}
            onClick={() => update(i, { hidden: !f.hidden })}
            title={f.hidden ? 'Excluded from the slideshow: click to include' : 'Included: click to exclude'}
          >
            {f.hidden ? <EyeOffIcon /> : <EyeIcon />}
          </button>
          <TextField path value={f.value} onCommit={(v) => (v ? update(i, { value: v }) : remove(i))} />
          <button className="chip" onClick={() => move(i, -1)} disabled={i === 0} title="Move up">↑</button>
          <button className="chip" onClick={() => move(i, 1)} disabled={i === files.length - 1} title="Move down">↓</button>
          <button className="chip chip--danger" onClick={() => remove(i)} title="Remove from list (doesn't delete the file)">✕</button>
        </div>
      ))}
      <div className="slides__item slides__add">
        <span className="slides__n">+</span>
        {/* Keyed on length so the field clears after adding. */}
        <TextField key={files.length} path value="" onCommit={add} placeholder="Add an image or folder path, then press Enter" />
      </div>
    </div>
  )
}
