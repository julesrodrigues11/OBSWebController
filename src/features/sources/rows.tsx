import { useInputs, type Settings } from '../../store/inputs'
import { CheckboxField, ColorField, TextAreaField, TextField } from '../../components/fields'
import { hexToObsColor, obsColorToHex } from '../../obs/values'
import { NumberField } from '../../components/NumberField'
import { SourceRow } from './SourceRow'
import { SlideshowFiles, type SlideshowFile } from './SlideshowFiles'

// Settings are untyped JSON from OBS; read them defensively.
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const bool = (v: unknown) => v === true
const posInt = (n: number) => n >= 1 && Number.isInteger(n)

interface RowProps {
  name: string
  s: Settings
  live: boolean
  dim?: boolean
}

function useActions(name: string) {
  const setSettings = useInputs((st) => st.setSettings)
  const pressButton = useInputs((st) => st.pressButton)
  const mediaAction = useInputs((st) => st.mediaAction)
  return {
    set: (patch: Settings) => void setSettings(name, patch),
    press: (prop: string) => void pressButton(name, prop),
    media: (a: Parameters<typeof mediaAction>[1]) => void mediaAction(name, a),
  }
}

// ---------- Browser ----------

export function BrowserRow({ name, s, live, dim }: RowProps) {
  const a = useActions(name)
  const local = bool(s.is_local_file)
  return (
    <SourceRow name={name} live={live} dim={dim} settings={s}>
      <div>
        {local ? (
          <TextField path value={str(s.local_file)} onCommit={(v) => a.set({ local_file: v })} placeholder="C:\path\to\page.html" />
        ) : (
          <TextField path value={str(s.url)} onCommit={(v) => a.set({ url: v })} placeholder="https://…" />
        )}
      </div>
      <div>
        <CheckboxField label="Local file" checked={local} onChange={(v) => a.set({ is_local_file: v })} />
      </div>
      <div className="cell-row">
        <NumberField label="W" value={num(s.width)} validate={posInt} onCommit={(n) => a.set({ width: n })} />
        <NumberField label="H" value={num(s.height)} validate={posInt} onCommit={(n) => a.set({ height: n })} />
      </div>
      <div>
        <button className="chip" onClick={() => a.press('refreshnocache')} title="Refresh cache of current page">
          Refresh
        </button>
      </div>
    </SourceRow>
  )
}

// ---------- Media ----------

const STATE_LABELS: Record<string, string> = {
  OBS_MEDIA_STATE_PLAYING: 'Playing',
  OBS_MEDIA_STATE_PAUSED: 'Paused',
  OBS_MEDIA_STATE_STOPPED: 'Stopped',
  OBS_MEDIA_STATE_ENDED: 'Ended',
  OBS_MEDIA_STATE_OPENING: 'Opening',
  OBS_MEDIA_STATE_BUFFERING: 'Buffering',
  OBS_MEDIA_STATE_ERROR: 'Error',
  OBS_MEDIA_STATE_NONE: '—',
}

function MediaControls({ name, prevNext }: { name: string; prevNext?: boolean }) {
  const a = useActions(name)
  const state = useInputs((st) => st.mediaState[name]) ?? 'OBS_MEDIA_STATE_NONE'
  const playing = state === 'OBS_MEDIA_STATE_PLAYING'
  return (
    <div className="cell-row media">
      {prevNext && <button className="chip" onClick={() => a.media('previous')} title="Previous">◀◀</button>}
      {playing ? (
        <button className="chip" onClick={() => a.media('pause')} title="Pause">❚❚</button>
      ) : (
        <button className="chip" onClick={() => a.media('play')} title="Play">▶</button>
      )}
      {prevNext && <button className="chip" onClick={() => a.media('next')} title="Next">▶▶</button>}
      <button className="chip" onClick={() => a.media('restart')} title="Restart">↺</button>
      <button className="chip" onClick={() => a.media('stop')} title="Stop">■</button>
      <span className={`media__state media__state--${playing ? 'on' : 'off'}`}>{STATE_LABELS[state] ?? state}</span>
    </div>
  )
}

export function MediaRow({ name, s, live, dim }: RowProps) {
  const a = useActions(name)
  // OBS default for media sources is a local file.
  const local = s.is_local_file !== false
  return (
    <SourceRow name={name} live={live} dim={dim} settings={s}>
      <div>
        {local ? (
          <TextField path value={str(s.local_file)} onCommit={(v) => a.set({ local_file: v })} placeholder="C:\path\to\video.mp4" />
        ) : (
          <TextField path value={str(s.input)} onCommit={(v) => a.set({ input: v })} placeholder="rtmp:// / https:// / srt://…" />
        )}
      </div>
      <div className="cell-row">
        <CheckboxField label="Local file" checked={local} onChange={(v) => a.set({ is_local_file: v })} />
        <CheckboxField label="Loop" checked={bool(s.looping)} onChange={(v) => a.set({ looping: v })} />
      </div>
      <MediaControls name={name} />
    </SourceRow>
  )
}

// ---------- Image ----------

export function ImageRow({ name, s, live, dim }: RowProps) {
  const a = useActions(name)
  return (
    <SourceRow name={name} live={live} dim={dim} settings={s}>
      <div>
        <TextField path value={str(s.file)} onCommit={(v) => a.set({ file: v })} placeholder="C:\path\to\image.png" />
      </div>
    </SourceRow>
  )
}

// ---------- Slideshow ----------

/**
 * Read a slideshow's file list defensively: entries are normally { value, hidden, selected },
 * but tolerate plain strings or a `path` key in case an OBS version stores them differently.
 */
function readFiles(v: unknown): SlideshowFile[] {
  if (!Array.isArray(v)) return []
  return v.map((e) => {
    if (typeof e === 'string') return { value: e, hidden: false, selected: false }
    const o = (e ?? {}) as Record<string, unknown>
    return { value: str(o.value) || str(o.path), hidden: o.hidden === true, selected: o.selected === true }
  })
}

export function SlideshowRow({ name, s, live, dim }: RowProps) {
  const a = useActions(name)
  const files = readFiles(s.files)
  const shown = files.filter((f) => !f.hidden).length
  const manual = str(s.slide_mode) === 'mode_manual'
  return (
    <SourceRow
      name={name}
      live={live}
      dim={dim}
      settings={s}
      extra={{
        label: 'Edit files',
        title: 'Edit the image/folder list',
        render: () => <SlideshowFiles files={files} onChange={(next) => a.set({ files: next })} />,
      }}
    >
      {({ openExtra }) => (<>
      <button className="slides__summary" onClick={openExtra} title={files.map((f) => f.value).join('\n') || 'Add images or folders'}>
        {files.length === 0 ? 'No images: click to add' : `${files.length} item${files.length === 1 ? '' : 's'}${shown !== files.length ? ` (${shown} shown)` : ''}`}
        {files[0] && <span className="slides__first"> · {files[0].value}{files.length > 1 ? ' …' : ''}</span>}
      </button>
      <div className="cell-row">
        <NumberField
          label="Every"
          unit="s"
          value={num(s.slide_time, 8000) / 1000}
          validate={(n) => n >= 0.05}
          onCommit={(n) => a.set({ slide_time: Math.round(n * 1000) })}
          disabled={manual}
          title={manual ? 'Manual mode: slides only change with Next/Previous' : 'Time between slides'}
        />
        <CheckboxField label="Loop" checked={s.loop !== false} onChange={(v) => a.set({ loop: v })} />
      </div>
      <MediaControls name={name} prevNext />
      </>)}
    </SourceRow>
  )
}

// ---------- Text ----------

export function TextRow({ name, s, live, dim }: RowProps) {
  const a = useActions(name)
  const font = (s.font && typeof s.font === 'object' ? s.font : {}) as Record<string, unknown>
  // GDI+ (Windows) uses `color`; FreeType uses `color1`. Both are 0xAABBGGRR.
  const colorKey = 'color' in s ? 'color' : 'color1'
  const color = num(s[colorKey], 0xffffffff)
  const fromFile = bool(s.read_from_file)
  return (
    <SourceRow name={name} live={live} dim={dim} settings={s}>
      <div>
        {fromFile ? (
          <TextField path value={str(s.file)} onCommit={(v) => a.set({ file: v })} title="Text is read from this file" />
        ) : (
          <TextAreaField value={str(s.text)} onCommit={(v) => a.set({ text: v })} />
        )}
      </div>
      <div className="cell-row">
        <NumberField
          label="Size"
          value={num(font.size, 36)}
          validate={posInt}
          // `font` is a nested object: send it whole or the other font settings are lost.
          onCommit={(n) => a.set({ font: { ...font, size: n } })}
          title={str(font.face) || undefined}
        />
        <ColorField value={obsColorToHex(color)} onCommit={(hex) => a.set({ [colorKey]: hexToObsColor(hex, color) })} />
      </div>
    </SourceRow>
  )
}
