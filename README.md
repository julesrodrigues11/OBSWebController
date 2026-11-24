# OBS Web Controller

A LAN web app for controlling OBS Studio from another computer: "OBS Blade on steroids".
It edits source properties, transforms and visibility through OBS's built-in
obs-websocket v5 server. Nothing extra is installed on the OBS machine.

## Requirements

- **Controller PC:** Node.js 20.19+ or 22.12+ (`node -v` to check)
- **OBS PC (Windows):** OBS Studio with Tools > WebSocket Server Settings > server
  enabled and a password set; Windows Firewall allowing inbound TCP 4455.

## Run it (development)

```powershell
npm install     # first time only
npm run dev     # opens on http://localhost:5173
```

`npm run host` does the same but also serves the app to other machines on the LAN.

## Build

```powershell
npm run build   # outputs static files to dist/
npm run preview # serves dist/ locally to check the build
```

`dist/` uses relative paths, so it can later be copied to and served from the OBS PC.

## Docs

- `docs/requirements.md`: requirements (draft, under discussion)
- `src/README.md`: source folder layout
