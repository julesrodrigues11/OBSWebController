/**
 * Pure helpers for the stats strip: what OBS reports (GetStats, GetStreamStatus, GetRecordStatus)
 * and how to judge it. Kept free of React so the rules can be unit-tested.
 */

/**
 * Every value can be null: OBS reports some as null when it can't measure them (CPU use, for
 * example, on some systems), and older versions may leave fields out.
 */
export interface ObsStats {
  cpuUsage: number | null // OBS process CPU use, %
  memoryUsage: number | null // MB
  availableDiskSpace: number | null // MB, on the recording drive
  activeFps: number | null
  averageFrameRenderTime: number | null // ms
  renderSkippedFrames: number | null
  renderTotalFrames: number | null
  outputSkippedFrames: number | null // skipped while encoding
  outputTotalFrames: number | null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Read GetStats' answer defensively: anything that isn't a real number becomes null. */
export function toStats(raw: unknown): ObsStats {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    cpuUsage: num(r.cpuUsage),
    memoryUsage: num(r.memoryUsage),
    availableDiskSpace: num(r.availableDiskSpace),
    activeFps: num(r.activeFps),
    averageFrameRenderTime: num(r.averageFrameRenderTime),
    renderSkippedFrames: num(r.renderSkippedFrames),
    renderTotalFrames: num(r.renderTotalFrames),
    outputSkippedFrames: num(r.outputSkippedFrames),
    outputTotalFrames: num(r.outputTotalFrames),
  }
}

export interface OutputStatus {
  active: boolean
  paused?: boolean
  /** "HH:MM:SS.mmm" */
  timecode: string
  /** Stream only: frames dropped because of the network. */
  skippedFrames?: number | null
  totalFrames?: number | null
}

export interface Snapshot {
  stats: ObsStats
  stream: OutputStatus | null
  record: OutputStatus | null
}

export type Level = 'ok' | 'warn' | 'bad'

/** Disk space below these (MB) is worth a warning: amber under 10 GB, red under 2 GB. */
const DISK_WARN_MB = 10 * 1024
const DISK_BAD_MB = 2 * 1024

/** Share of frames lost since the previous reading: any loss is amber, over 5% red. */
function lossLevel(skipped: number, total: number): Level {
  if (total <= 0 || skipped <= 0) return 'ok'
  return skipped / total > 0.05 ? 'bad' : 'warn'
}

/** The difference between two cumulative counters, ignoring resets (e.g. a new stream). */
function delta(now: number | null | undefined, before: number | null | undefined) {
  if (now == null || before == null || now < before) return 0
  return now - before
}

export interface Assessment {
  /** Frames OBS couldn't render in time, since the last reading. */
  render: Level
  /** Frames the encoder skipped (CPU/GPU overloaded), since the last reading. */
  encode: Level
  /** Stream frames dropped because of the network, since the last reading. */
  network: Level
  disk: Level
  /** The worst of the above. */
  overall: Level
}

const worst = (...levels: Level[]): Level => (levels.includes('bad') ? 'bad' : levels.includes('warn') ? 'warn' : 'ok')

/** Judge the latest reading against the previous one (counters are cumulative in OBS). */
export function assess(now: Snapshot, before: Snapshot | null): Assessment {
  const s = now.stats
  const p = before?.stats
  const render = p ? lossLevel(delta(s.renderSkippedFrames, p.renderSkippedFrames), delta(s.renderTotalFrames, p.renderTotalFrames)) : 'ok'
  const encode = p ? lossLevel(delta(s.outputSkippedFrames, p.outputSkippedFrames), delta(s.outputTotalFrames, p.outputTotalFrames)) : 'ok'
  const network = now.stream?.active && before?.stream?.active
    ? lossLevel(delta(now.stream.skippedFrames, before.stream.skippedFrames), delta(now.stream.totalFrames, before.stream.totalFrames))
    : 'ok'
  // Free space only matters for recording, but warn either way so it's noticed before pressing Record.
  const free = s.availableDiskSpace
  const disk: Level = free === null ? 'ok' : free < DISK_BAD_MB ? 'bad' : free < DISK_WARN_MB ? 'warn' : 'ok'
  return { render, encode, network, disk, overall: worst(render, encode, network, disk) }
}

/** "01:02:33.123" -> "1:02:33"; "00:04:10.000" -> "4:10". */
export function shortTimecode(timecode: string | null | undefined): string {
  if (typeof timecode !== 'string') return ''
  const [h = '0', m = '0', sec = '0'] = timecode.split('.')[0].split(':')
  const hours = Number(h)
  return hours > 0 ? `${hours}:${m.padStart(2, '0')}:${sec.padStart(2, '0')}` : `${Number(m)}:${sec.padStart(2, '0')}`
}

/** 12345 MB -> "12.1 GB"; 800 MB -> "800 MB". */
export function formatMb(mb: number | null): string {
  if (mb === null) return '?'
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}

/** A number for display with a fixed number of decimals, or "?" when OBS didn't report it. */
export function fmt(n: number | null, decimals = 0): string {
  return n === null ? '?' : n.toFixed(decimals)
}
