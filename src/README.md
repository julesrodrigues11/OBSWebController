# Source layout

- `obs/`: the obs-websocket client, input-kind labels, transform maths, value helpers (paths, colours)
- `store/`: Zustand stores. `connection` owns the OBS connection; `scenes` holds scene items and
  transforms; `inputs` holds source settings and media state; `live` works out what's on air
- `components/`: shared UI pieces (inline editors, number fields, toggles, badges)
- `features/scenes/`: Scenes panel (scene items: visibility, lock, transform)
- `features/sources/`: Sources panel (per-type tables: Browser, Media, Image, Slideshow, Text)
- `presets/`: saved URLs/paths, JSON export/import

Settings belong to inputs; transform and visibility belong to scene items.
