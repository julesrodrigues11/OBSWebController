# Source layout

- `obs/`: the obs-websocket client, input-kind labels, transform maths, value helpers (paths, colours)
- `store/`: Zustand stores. `connection` owns the OBS connection; `profiles` holds saved
  connections; `scenes` holds scene items, transforms and scene create/rename/delete; `inputs`
  holds source settings and media state; `live` works out what's on air; `names` checks name
  uniqueness; `settingsFile` builds and reads export files; `ui` holds the Sources scope
- `lib/`: `storage.ts` (safe browser-storage helpers, every stored key in one list) and
  `download.ts` (save text as a file)
- `components/`: shared UI pieces (inline editors, number fields, toggles, badges), the connection
  screen and its export/import (`SettingsTransfer`)
- `features/scenes/`: Scenes panel. `ScenesPanel` (panel + shared state in `panelState.ts`) →
  `SceneSection` (one scene) → `SceneHeader` and `ItemRow` (one item) → `OrderButtons`. Also the
  preview, transform editor, add-source, new-scene and rename forms, filter rules (`rows.ts`) and
  remembered collapsed state (`useCollapsed.ts`)
- `features/sources/`: Sources panel (per-type tables: Browser, Media, Image, Slideshow, Text)
- `presets/`: placeholder for future presets (saved URLs/paths)

Settings belong to inputs; transform and visibility belong to scene items.
