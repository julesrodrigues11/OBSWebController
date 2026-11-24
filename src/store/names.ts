import { useMemo } from 'react'
import { useConnection } from './connection'
import { useInputs } from './inputs'
import { useScenes } from './scenes'

/** OBS names must be unique across all sources, scenes and groups. */
export function useTakenNames(): Set<string> {
  const inputs = useInputs((s) => s.inputs)
  const scenes = useConnection((s) => s.scenes)
  const groups = useScenes((s) => s.groups)
  return useMemo(
    () => new Set([...inputs.map((i) => i.name), ...scenes.map((s) => s.sceneName), ...groups]),
    [inputs, scenes, groups],
  )
}

/** First "Base", "Base 2", "Base 3"… not in `taken`. */
export function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`
}
