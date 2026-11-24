# Source layout

- `obs/`: the obs-websocket client, input-kind labels, transform maths, value helpers (paths, colours)
- `store/`: Zustand stores. `connection` owns the OBS connection; `profiles` holds saved
  connections; `scenes` holds scene items, transforms and scene create/rename/delete; `inputs` holds
  source settings and media state; `live` works out what's on air; `names` checks name uniqueness;
  `ui` holds the Sources scope
- `components/`: shared UI pieces (inline editors, number fields, toggles, badges)
- `features/scenes/`: Scenes panel (preview, scenes and items, transform editor, add-source,
  new-scene and rename forms)
- `features/sources/`: Sources panel (per-type tables: Browser, Media, Image, Slideshow, Text)
- `presets/`: saved URLs/paths, JSON export/import

Settings belong to inputs; transform and visibility belong to scene items.
