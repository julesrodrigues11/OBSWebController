import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { obs } from '../../obs/client'
import { cleanPath } from '../../obs/values'
import { kindLabel } from '../../obs/kinds'
import { useConnection } from '../../store/connection'
import { useInputs, type Category, type Settings } from '../../store/inputs'
import { useScenes } from '../../store/scenes'
import { uniqueName, useTakenNames } from '../../store/names'

const TYPES: { category: Category; title: string; field: string; placeholder: string }[] = [
  { category: 'browser', title: 'Browser', field: 'URL', placeholder: 'https://…' },
  { category: 'media', title: 'Media', field: 'File', placeholder: 'D:\\Media\\video.mp4' },
  { category: 'image', title: 'Image', field: 'File', placeholder: 'D:\\Media\\image.png' },
  { category: 'slideshow', title: 'Image Slideshow', field: 'Image or folder', placeholder: 'D:\\Slides' },
  { category: 'text', title: 'Text', field: 'Text', placeholder: 'Your text' },
]

/** Inline form under a scene header: create a new source, or add an existing one. */
export function AddSource({ sceneName, onClose }: { sceneName: string; onClose: () => void }) {
  const live = useConnection((s) => s.programScene === sceneName)
  const scenes = useConnection((s) => s.scenes)
  const inputs = useInputs((s) => s.inputs)
  const createInput = useInputs((s) => s.createInput)
  const items = useScenes((s) => s.items)
  const addExisting = useScenes((s) => s.addExisting)

  const [tab, setTab] = useState<'new' | 'existing'>('new')
  // Starting hidden is the safe default when adding to the scene that's on air.
  const [hidden, setHidden] = useState(live)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const taken = useTakenNames()

  // ---- new source
  const [category, setCategory] = useState<Category>('browser')
  const type = TYPES.find((t) => t.category === category)!
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [value, setValue] = useState('')
  const [mediaUrl, setMediaUrl] = useState(false)
  const [size, setSize] = useState({ w: 1920, h: 1080 })

  // Suggest a name from the type until the user types their own.
  const suggested = uniqueName(type.title, taken)
  const finalName = (nameTouched ? name : suggested).trim()
  const nameClash = taken.has(finalName)

  // Browser sources default to the canvas size, so they fill the screen.
  useEffect(() => {
    obs.call('GetVideoSettings').then((v) => setSize({ w: v.baseWidth, h: v.baseHeight })).catch(() => {})
  }, [])

  function settingsFor(): Settings {
    const v = category === 'text' ? value : cleanPath(value)
    switch (category) {
      case 'browser': return { url: v, width: size.w, height: size.h }
      case 'media': return mediaUrl ? { is_local_file: false, input: v } : { is_local_file: true, local_file: v }
      case 'image': return { file: v }
      case 'slideshow': return v ? { files: [{ value: v, hidden: false, selected: false }] } : {}
      case 'text': return { text: v }
    }
  }

  async function submitNew(e: FormEvent) {
    e.preventDefault()
    if (!finalName || nameClash || busy) return
    setBusy(true)
    const err = await createInput(sceneName, finalName, category, settingsFor(), !hidden)
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  // ---- existing source
  const [search, setSearch] = useState('')
  const inScene = useMemo(() => new Set((items[sceneName] ?? []).map((i) => i.sourceName)), [items, sceneName])
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    // Inputs plus other scenes (nesting a scene is allowed); never the scene itself.
    const all = [
      ...inputs.map((i) => ({ name: i.name, label: kindLabel(i.kind) })),
      ...scenes.filter((s) => s.sceneName !== sceneName).map((s) => ({ name: s.sceneName, label: 'Scene' })),
    ]
    return all.filter((c) => !q || `${c.name} ${c.label}`.toLowerCase().includes(q))
  }, [inputs, scenes, sceneName, search])

  async function addOne(sourceName: string) {
    if (busy) return
    setBusy(true)
    const err = await addExisting(sceneName, sourceName, !hidden)
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <div className="addsrc" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="addsrc__tabs">
        <button className={`chip ${tab === 'new' ? 'is-active' : ''}`} onClick={() => setTab('new')}>New source</button>
        <button className={`chip ${tab === 'existing' ? 'is-active' : ''}`} onClick={() => setTab('existing')}>Existing source</button>
        <label className="check addsrc__hidden" title="Add it hidden, then show it with the eye when ready">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
          <span>Start hidden{live ? ' (scene is live)' : ''}</span>
        </label>
        <button className="button--small" onClick={onClose}>Cancel</button>
      </div>

      {tab === 'new' ? (
        <form className="addsrc__form" onSubmit={submitNew}>
          <div className="addsrc__row">
            <select value={category} onChange={(e) => { setCategory(e.target.value as Category); setValue('') }} className="scope">
              {TYPES.map((t) => <option key={t.category} value={t.category}>{t.title}</option>)}
            </select>
            <input
              className={`field ${nameClash ? 'is-invalid' : ''}`}
              placeholder="Name"
              value={nameTouched ? name : suggested}
              onChange={(e) => { setNameTouched(true); setName(e.target.value) }}
              title={nameClash ? 'A source or scene with this name already exists' : 'Source name (must be unique)'}
            />
          </div>
          <div className="addsrc__row">
            <span className="addsrc__label">{category === 'media' && mediaUrl ? 'URL' : type.field}</span>
            {category === 'text' ? (
              <textarea className="field field--area" rows={2} value={value} placeholder={type.placeholder} onChange={(e) => setValue(e.target.value)} />
            ) : (
              <input
                className={`field ${category === 'browser' || (category === 'media' && mediaUrl) ? '' : 'field--mono'}`}
                value={value}
                spellCheck={false}
                placeholder={category === 'media' && mediaUrl ? 'rtmp:// / srt:// / https://…' : type.placeholder}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
          </div>
          {category === 'browser' && (
            <div className="addsrc__row">
              <span className="addsrc__label">Size</span>
              <input className="field addsrc__num" type="number" min={1} value={size.w} onChange={(e) => setSize({ ...size, w: Number(e.target.value) || 1 })} />
              <span className="muted">×</span>
              <input className="field addsrc__num" type="number" min={1} value={size.h} onChange={(e) => setSize({ ...size, h: Number(e.target.value) || 1 })} />
            </div>
          )}
          {category === 'media' && (
            <div className="addsrc__row">
              <span className="addsrc__label" />
              <label className="check">
                <input type="checkbox" checked={mediaUrl} onChange={(e) => setMediaUrl(e.target.checked)} />
                <span>Network stream / URL instead of a local file</span>
              </label>
            </div>
          )}
          <div className="addsrc__row addsrc__actions">
            {nameClash && <span className="error">That name is already used.</span>}
            {error && <span className="error">{error}</span>}
            <button type="submit" disabled={busy || !finalName || nameClash}>{busy ? 'Adding…' : `Add to ${sceneName}`}</button>
          </div>
        </form>
      ) : (
        <div className="addsrc__form">
          <input className="field" autoFocus placeholder="Search sources and scenes…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ul className="addsrc__list">
            {candidates.length === 0 && <li className="placeholder">Nothing matches.</li>}
            {candidates.map((c) => (
              <li key={`${c.label}:${c.name}`}>
                <button className="addsrc__pick" onClick={() => void addOne(c.name)} disabled={busy}>
                  <span className="item__name">{c.name}</span>
                  <span className="item__kind">{c.label}</span>
                  {inScene.has(c.name) && <span className="muted addsrc__already">already in this scene</span>}
                </button>
              </li>
            ))}
          </ul>
          {error && <span className="error">{error}</span>}
        </div>
      )}
    </div>
  )
}
