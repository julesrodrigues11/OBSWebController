/** Removes surrounding quotes, which Windows adds with "Copy as path". */
export const cleanPath = (s: string) => s.trim().replace(/^"(.*)"$/, '$1')

/** OBS stores colours as 0xAABBGGRR integers. */
export function obsColorToHex(c: number): string {
  const r = c & 0xff, g = (c >>> 8) & 0xff, b = (c >>> 16) & 0xff
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
}
export function hexToObsColor(hex: string, previous: number): number {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff
  const alpha = previous & 0xff000000 // keep whatever alpha OBS had
  return (alpha | (b << 16) | (g << 8) | r) >>> 0
}
