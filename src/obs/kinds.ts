/**
 * Short, human labels for OBS input kinds. Matched by prefix because some kinds
 * carry version suffixes that change between OBS releases (e.g. text_gdiplus_v2/_v3).
 */
const KIND_LABELS: [prefix: string, label: string][] = [
  ['browser_source', 'Browser'],
  ['image_source', 'Image'],
  ['slideshow', 'Slideshow'],
  ['ffmpeg_source', 'Media'],
  ['vlc_source', 'VLC'],
  ['text_gdiplus', 'Text'],
  ['text_ft2_source', 'Text'],
  ['color_source', 'Colour'],
  ['window_capture', 'Window'],
  ['monitor_capture', 'Display'],
  ['game_capture', 'Game'],
  ['dshow_input', 'Video device'],
  ['wasapi_input_capture', 'Audio in'],
  ['wasapi_output_capture', 'Audio out'],
  ['wasapi_process_output_capture', 'App audio'],
  ['ndi_source', 'NDI'],
]

export function kindLabel(inputKind: string | null, opts: { isGroup?: boolean; isScene?: boolean } = {}): string {
  if (opts.isGroup) return 'Group'
  if (opts.isScene) return 'Scene'
  if (!inputKind) return ''
  return KIND_LABELS.find(([p]) => inputKind.startsWith(p))?.[1] ?? inputKind
}
