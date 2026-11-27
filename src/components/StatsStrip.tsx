import { useEffect, useRef, useState } from 'react'
import { obs } from '../obs/client'
import { assess, fmt, formatMb, shortTimecode, toStats, type Assessment, type Snapshot } from '../obs/stats'
import { useConnection } from '../store/connection'

const INTERVAL_MS = 2000

/** Polls OBS's stats and output status every 2 s while connected and the tab is visible. */
function useObsStats() {
  const status = useConnection((s) => s.status)
  const [reading, setReading] = useState<{ snap: Snapshot; health: Assessment } | null>(null)
  const previous = useRef<Snapshot | null>(null)

  useEffect(() => {
    if (status !== 'connected') return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    previous.current = null

    async function tick() {
      if (stopped) return
      if (document.visibilityState === 'visible') {
        try {
          // Stream/record status can fail on unusual setups; the stats still count.
          const [stats, stream, record] = await Promise.all([
            obs.call('GetStats'),
            obs.call('GetStreamStatus').catch(() => null),
            obs.call('GetRecordStatus').catch(() => null),
          ])
          const snap: Snapshot = {
            stats: toStats(stats),
            stream: stream && {
              active: stream.outputActive,
              timecode: stream.outputTimecode,
              skippedFrames: stream.outputSkippedFrames,
              totalFrames: stream.outputTotalFrames,
            },
            record: record && { active: record.outputActive, paused: record.outputPaused, timecode: record.outputTimecode },
          }
          if (!stopped) {
            setReading({ snap, health: assess(snap, previous.current) })
            previous.current = snap
          }
        } catch {
          // Leave the last reading up; the connection banner covers real disconnects.
        }
      }
      if (!stopped) timer = setTimeout(tick, INTERVAL_MS)
    }
    void tick()
    return () => { stopped = true; clearTimeout(timer) }
  }, [status])

  return status === 'connected' ? reading : null
}

/**
 * Compact OBS health in the top bar: FPS, CPU, stream/recording time, and warnings (amber/red)
 * for skipped or dropped frames and low disk space. Read-only: Stagehand never starts or stops
 * streaming or recording. Hover for details.
 */
export function StatsStrip() {
  const reading = useObsStats()
  if (!reading) return null
  const { snap, health } = reading
  const s = snap.stats

  const problems = [
    health.render !== 'ok' && 'OBS is skipping frames while rendering (the PC can’t keep up)',
    health.encode !== 'ok' && 'The encoder is skipping frames (overloaded)',
    health.network !== 'ok' && 'The stream is dropping frames (network)',
    health.disk !== 'ok' && `Low disk space: ${formatMb(s.availableDiskSpace)} free`,
  ].filter(Boolean)

  const details = [
    `FPS ${fmt(s.activeFps, 1)} · render ${fmt(s.averageFrameRenderTime, 1)} ms per frame`,
    `CPU ${s.cpuUsage === null ? 'not reported by OBS' : `${fmt(s.cpuUsage, 1)}%`} · memory ${formatMb(s.memoryUsage)}`,
    `Skipped: ${fmt(s.renderSkippedFrames)} rendering, ${fmt(s.outputSkippedFrames)} encoding` +
      (snap.stream?.active ? `, ${snap.stream.skippedFrames ?? 0} dropped (network)` : ''),
    `Disk: ${formatMb(s.availableDiskSpace)} free`,
    ...problems.map((p) => `⚠ ${p}`),
  ].join('\n')

  const frameLevel = [health.render, health.encode].includes('bad') ? 'bad' : [health.render, health.encode].includes('warn') ? 'warn' : 'ok'

  return (
    <div className={`stats stats--${health.overall}`} title={details} aria-label="OBS stats">
      {s.activeFps !== null && <span className={`stats__item stats--${frameLevel}`}>{fmt(s.activeFps)} fps</span>}
      {s.cpuUsage !== null && <span className="stats__item">CPU {fmt(s.cpuUsage)}%</span>}
      {health.disk !== 'ok' && <span className={`stats__item stats--${health.disk}`}>Disk {formatMb(s.availableDiskSpace)}</span>}
      {snap.stream?.active && (
        <span className={`stats__item stats__out stats--${health.network}`}>
          <span className="stats__dot" /> STREAM {shortTimecode(snap.stream.timecode)}
        </span>
      )}
      {snap.record?.active && (
        <span className="stats__item stats__out">
          <span className="stats__dot" /> {snap.record.paused ? 'REC (paused)' : 'REC'} {shortTimecode(snap.record.timecode)}
        </span>
      )}
      {problems.length > 0 && <span className={`stats__item stats--${health.overall}`}>⚠ {problems.length === 1 ? problems[0] : `${problems.length} problems`}</span>}
    </div>
  )
}
