/**
 * Demo OBS content used by the tests (the same show as the README screenshots).
 * Lists are written TOP-FIRST, as you'd see them in OBS's Sources dock.
 */

export interface FixtureItem {
  name: string
  /** Input kind, or 'group' / 'scene' for groups and nested scenes. */
  kind: string
  hidden?: boolean
  locked?: boolean
  transform?: Partial<MockTransform>
  /** Group contents (top-first), only for kind 'group'. */
  children?: FixtureItem[]
}

export interface MockTransform {
  positionX: number
  positionY: number
  rotation: number
  scaleX: number
  scaleY: number
  sourceWidth: number
  sourceHeight: number
  alignment: number
  boundsType: string
  boundsAlignment: number
  boundsWidth: number
  boundsHeight: number
  cropLeft: number
  cropRight: number
  cropTop: number
  cropBottom: number
}

export interface FixtureInput {
  kind: string
  settings: Record<string, unknown>
  mediaState?: string
}

export interface Fixture {
  /** Scenes top-first, as in OBS's Scenes dock. */
  scenes: { name: string; items: FixtureItem[] }[]
  program: string
  inputs: Record<string, FixtureInput>
  defaults: Record<string, Record<string, unknown>>
}

const WHITE = 0xffffffff

export function demoFixture(): Fixture {
  return {
    program: 'Main',
    scenes: [
      {
        name: 'Starting Soon',
        items: [
          { name: 'Countdown', kind: 'browser_source' },
          { name: 'Starting Soon Title', kind: 'text_gdiplus_v3' },
          { name: 'Background Loop', kind: 'ffmpeg_source' },
        ],
      },
      {
        name: 'Main',
        items: [
          {
            name: 'Lower Third',
            kind: 'group',
            children: [
              { name: 'LT Name', kind: 'text_gdiplus_v3' },
              { name: 'LT Bar', kind: 'color_source_v3' },
            ],
          },
          { name: 'Chat Overlay', kind: 'browser_source', transform: { positionX: 1310, positionY: 120, sourceWidth: 480, sourceHeight: 720 } },
          { name: 'Logo', kind: 'image_source', locked: true, transform: { sourceWidth: 240, sourceHeight: 180, scaleX: 0.5, scaleY: 0.5 } },
          { name: 'Camera', kind: 'dshow_input', transform: { scaleX: 0.5, scaleY: 0.5 } },
          { name: 'Background Loop', kind: 'ffmpeg_source' },
        ],
      },
      {
        name: 'Interview',
        items: [
          { name: 'Guest Name', kind: 'text_gdiplus_v3' },
          { name: 'Main', kind: 'scene' }, // nested scene
        ],
      },
      {
        name: 'BRB',
        items: [
          { name: 'BRB Title', kind: 'text_gdiplus_v3' },
          { name: 'BRB Slides', kind: 'slideshow_v2' },
          { name: 'Music', kind: 'ffmpeg_source', hidden: true },
        ],
      },
    ],
    inputs: {
      Countdown: { kind: 'browser_source', settings: { url: 'https://example.com/overlays/countdown', width: 1920, height: 1080 } },
      'Chat Overlay': { kind: 'browser_source', settings: { url: 'https://example.com/overlays/chat', width: 480, height: 720 } },
      'Background Loop': { kind: 'ffmpeg_source', settings: { local_file: 'D:\\Show\\media\\background-loop.mp4', looping: true }, mediaState: 'OBS_MEDIA_STATE_PLAYING' },
      Music: { kind: 'ffmpeg_source', settings: { local_file: 'D:\\Show\\audio\\music.mp3' }, mediaState: 'OBS_MEDIA_STATE_STOPPED' },
      Logo: { kind: 'image_source', settings: { file: 'D:\\Show\\graphics\\logo.png' } },
      'BRB Slides': {
        kind: 'slideshow_v2',
        settings: {
          files: [
            { value: 'D:\\Show\\slides\\brb', hidden: false, selected: false },
            { value: 'D:\\Show\\slides\\sponsor.png', hidden: false, selected: false },
          ],
        },
        mediaState: 'OBS_MEDIA_STATE_PLAYING',
      },
      'Starting Soon Title': { kind: 'text_gdiplus_v3', settings: { text: 'Starting soon', font: { face: 'Segoe UI', size: 96, style: 'Bold', flags: 1 }, color: WHITE } },
      'LT Name': { kind: 'text_gdiplus_v3', settings: { text: 'Alex Morgan\nHost', font: { face: 'Segoe UI', size: 48, style: 'Bold', flags: 1 }, color: 0xff0000ff } },
      'Guest Name': { kind: 'text_gdiplus_v3', settings: { text: 'Sam Lee' } },
      'BRB Title': { kind: 'text_gdiplus_v3', settings: { text: 'Be right back' } },
      Camera: { kind: 'dshow_input', settings: { video_device_id: 'Demo Webcam' } },
      'LT Bar': { kind: 'color_source_v3', settings: { color: 0xff4d48e5 } },
      Microphone: { kind: 'wasapi_input_capture', settings: { device_id: 'default' } },
    },
    defaults: {
      browser_source: { url: 'https://obsproject.com/browser-source', width: 800, height: 600, is_local_file: false },
      ffmpeg_source: { is_local_file: true, looping: false },
      image_source: { unload: false },
      slideshow_v2: { slide_time: 8000, loop: true, slide_mode: 'mode_auto' },
      text_gdiplus_v3: { font: { face: 'Arial', size: 256, style: 'Regular', flags: 0 }, color: WHITE },
    },
  }
}
