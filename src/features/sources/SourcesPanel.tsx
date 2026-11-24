import { useMemo, useState, type ComponentType } from 'react'
import { useInputs, type Category, type Settings } from '../../store/inputs'
import { sourcesInScene, useOnAirSources } from '../../store/live'
import { useConnection } from '../../store/connection'
import { useScenes } from '../../store/scenes'
import { useUi } from '../../store/ui'
import { BrowserRow, ImageRow, MediaRow, SlideshowRow, TextRow } from './rows'
import { OtherRow } from './OtherRow'

type TypeKey = Category | 'other'
const TYPES_KEY = 'obs-web-controller:source-types'

function loadTypes(): Set<TypeKey> {
  try { return new Set(JSON.parse(localStorage.getItem(TYPES_KEY) ?? '[]')) } catch { return new Set() }
}
function saveTypes(s: Set<TypeKey>) {
  try { localStorage.setItem(TYPES_KEY, JSON.stringify([...s])) } catch { /* ignore */ }
}

interface SectionDef {
  category: Category
  title: string
  /** Column headers after Name; the last (actions) column is added automatically. */
  headers: string[]
  /** CSS grid columns for everything between Name and actions. */
  columns: string
  Row: ComponentType<{ name: string; s: Settings; live: boolean; dim?: boolean }>
  /** Extra text the filter should match (URL, path, text…). */
  search: (s: Settings) => string
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

const SECTIONS: SectionDef[] = [
  {
    category: 'browser', title: 'Browser', headers: ['URL / local file', '', 'Size', ''],
    columns: 'minmax(200px, 1fr) auto auto auto', Row: BrowserRow,
    search: (s) => `${str(s.url)} ${str(s.local_file)}`,
  },
  {
    category: 'media', title: 'Media', headers: ['File / URL', '', 'Playback'],
    columns: 'minmax(200px, 1fr) auto auto', Row: MediaRow,
    search: (s) => `${str(s.local_file)} ${str(s.input)}`,
  },
  {
    category: 'image', title: 'Image', headers: ['File'],
    columns: 'minmax(200px, 1fr)', Row: ImageRow,
    search: (s) => str(s.file),
  },
  {
    category: 'slideshow', title: 'Image Slideshow', headers: ['Images', 'Timing', 'Playback'],
    columns: 'minmax(160px, 1fr) auto auto', Row: SlideshowRow,
    search: (s) => (Array.isArray(s.files) ? s.files.map((f: { value?: string }) => f.value ?? '').join(' ') : ''),
  },
  {
    category: 'text', title: 'Text', headers: ['Text', 'Size / colour'],
    columns: 'minmax(200px, 1fr) auto', Row: TextRow,
    search: (s) => `${str(s.text)} ${str(s.file)}`,
  },
]

export function SourcesPanel() {
  const inputs = useInputs((s) => s.inputs)
  const settings = useInputs((s) => s.settings)
  const rowErrors = useInputs((s) => s.rowErrors)
  const loading = useInputs((s) => s.loading)
  const error = useInputs((s) => s.error)
  const clearError = useInputs((s) => s.clearError)
  const onAir = useOnAirSources()
  const scope = useUi((s) => s.scope)
  const setScope = useUi((s) => s.setScope)
  const scenes = useConnection((s) => s.scenes)
  const programScene = useConnection((s) => s.programScene)
  const sceneItems = useScenes((s) => s.items)

  // A chosen scene that no longer exists (deleted/renamed) falls back to the live scene.
  const chosenMissing = scope.mode === 'scene' && scenes.length > 0 && !scenes.some((s) => s.sceneName === scope.scene)
  const scopeScene = scope.mode === 'live' || chosenMissing ? programScene : scope.mode === 'scene' ? scope.scene : null
  /** Sources in scope (name → visible there), or null for "all sources". */
  const inScope = useMemo(
    () => (scope.mode === 'all' || !scopeScene ? null : sourcesInScene(scopeScene, sceneItems)),
    [scope.mode, scopeScene, sceneItems],
  )
  const dimOf = (name: string) => (inScope ? inScope.get(name) === false : false)
  const [filter, setFilter] = useState('')
  /** Selected source types; empty = show all. */
  const [types, setTypes] = useState<Set<TypeKey>>(loadTypes)
  const q = filter.trim().toLowerCase()
  const showType = (t: TypeKey) => types.size === 0 || types.has(t)

  function toggleType(t: TypeKey, only: boolean) {
    // Click = toggle this type; Ctrl/Cmd+click = show only this type.
    const next = only ? new Set<TypeKey>([t]) : new Set(types)
    if (!only) {
      if (next.has(t)) next.delete(t)
      else next.add(t)
    }
    setTypes(next)
    saveTypes(next)
  }
  function clearTypes() {
    setTypes(new Set())
    saveTypes(new Set())
  }

  const sections = useMemo(
    () =>
      SECTIONS.filter((sec) => types.size === 0 || types.has(sec.category)).map((sec) => ({
        sec,
        rows: inputs.filter((i) => {
          if (i.category !== sec.category || !(settings[i.name] || rowErrors[i.name])) return false
          if (inScope && !inScope.has(i.name)) return false
          if (!q) return true
          return `${i.name} ${settings[i.name] ? sec.search(settings[i.name]) : ''}`.toLowerCase().includes(q)
        }),
      })).filter((x) => x.rows.length > 0),
    [inputs, settings, rowErrors, q, types, inScope],
  )
  const others = inputs.filter(
    (i) => !i.category && (!inScope || inScope.has(i.name)) && (!q || `${i.name} ${i.kind}`.toLowerCase().includes(q)),
  )

  // Counts for the type buttons (within the scope, ignoring the type filter itself).
  const counts: Record<TypeKey, number> = { browser: 0, media: 0, image: 0, slideshow: 0, text: 0, other: 0 }
  for (const i of inputs) if (!inScope || inScope.has(i.name)) counts[i.category ?? 'other']++

  return (
    <section className="panel sources">
      <div className="panel__head">
        <h2>Sources</h2>
        <select
          className="scope"
          value={scope.mode === 'scene' ? `scene:${scope.scene}` : scope.mode}
          onChange={(e) => {
            const v = e.target.value
            setScope(v === 'all' || v === 'live' ? { mode: v } : { mode: 'scene', scene: v.slice(6) })
          }}
          title="Which sources to show"
        >
          <option value="all">All sources</option>
          <option value="live">Live scene{programScene ? ` (${programScene})` : ''}</option>
          <optgroup label="Scene">
            {scenes.map((s) => <option key={s.sceneUuid} value={`scene:${s.sceneName}`}>{s.sceneName}</option>)}
            {scope.mode === 'scene' && chosenMissing && <option value={`scene:${scope.scene}`}>{scope.scene} (gone)</option>}
          </optgroup>
        </select>
        <input
          className="filter"
          type="search"
          placeholder="Filter by name, URL, path or text…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
        />
      </div>

      <div className="typefilter" role="group" aria-label="Filter by source type">
        <button className={`chip ${types.size === 0 ? 'is-active' : ''}`} onClick={clearTypes}>All</button>
        {([...SECTIONS.map((s) => [s.category, s.title] as const), ['other', 'Other'] as const]).map(([key, title]) =>
          counts[key] > 0 && (
            <button
              key={key}
              className={`chip ${types.has(key) ? 'is-active' : ''}`}
              onClick={(e) => toggleType(key, e.ctrlKey || e.metaKey)}
              title="Click to add/remove this type · Ctrl+click to show only this type"
            >
              {title} <span className="muted">{counts[key]}</span>
            </button>
          ),
        )}
      </div>

      {chosenMissing && <p className="muted">Scene “{scope.mode === 'scene' ? scope.scene : ''}” no longer exists: showing the live scene.</p>}
      {inScope && !loading && sections.length === 0 && others.length === 0 && !q && (
        <p className="placeholder">No sources in {scopeScene}.</p>
      )}

      {error && (
        <p className="error" role="alert">
          {error} <button className="button--link" onClick={clearError}>Dismiss</button>
        </p>
      )}
      {loading && inputs.length === 0 && <p className="placeholder">Loading…</p>}
      {q && sections.length === 0 && others.length === 0 && <p className="placeholder">Nothing matches “{filter}”.</p>}

      {sections.map(({ sec, rows }) => (
        <div
          key={sec.category}
          className="stable"
          style={{ gridTemplateColumns: `minmax(140px, 220px) ${sec.columns} auto` }}
        >
          <div className="stable__title">
            {sec.title} <span className="muted">{rows.length}</span>
          </div>
          <div className="stable__head">
            <span>Name</span>
            {sec.headers.map((h, i) => <span key={i}>{h}</span>)}
            <span />
          </div>
          {rows.map((i) =>
            settings[i.name] ? (
              <sec.Row key={i.uuid} name={i.name} s={settings[i.name]} live={onAir.has(i.name)} dim={dimOf(i.name)} />
            ) : (
              <div key={i.uuid} className="srow">
                <div className="srow__name" title={i.name}><span className="srow__label">{i.name}</span></div>
                <div className="error srow__error">Couldn't read settings: {rowErrors[i.name]}</div>
              </div>
            ),
          )}
        </div>
      ))}

      {showType('other') && others.length > 0 && (
        <div className="stable" style={{ gridTemplateColumns: 'minmax(140px, 220px) 1fr auto' }}>
          <div className="stable__title">
            Other <span className="muted">{others.length}</span>
            <span className="muted stable__note"> · no editor yet; {'{ }'} shows stored settings</span>
          </div>
          <div className="stable__head"><span>Name</span><span>Type</span><span /></div>
          {others.map((i) => <OtherRow key={i.uuid} name={i.name} kind={i.kind} live={onAir.has(i.name)} dim={dimOf(i.name)} />)}
        </div>
      )}
    </section>
  )
}
