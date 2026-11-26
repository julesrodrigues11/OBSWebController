# Requirements (DRAFT, to be refined)

Status: decisions agreed in discussion so far. Open questions at the end.

## Context
- Single operator at a time (one main operator, occasionally a trained colleague).
- LAN only. OBS runs on Windows.
- Desktop-first, high-pixel-density screen; mobile later, if at all.
- The operator can usually see the OBS output; a low-rate preview is optional (see below).
- Phase 1 only (pure client, no OBS plugin).

## Architecture
- Vite + React + TypeScript, obs-websocket-js, Zustand.
- Static app; browser connects directly to `ws://<obs-ip>:4455`.
- Develop on the controller PC first; hosting on the OBS PC planned later.
- OBS address and password entered on a connect screen (not hardcoded).
- Saved connections (built): password show/hide toggle; list of named profiles (name, IP, port, password); add, edit,
  delete (with confirm), connect from the list. Password saved per profile or asked each time.
  Stored in this browser's localStorage (unencrypted). Last-used connection highlighted.
- Loading is fault-tolerant: one unreadable source shows its own error row; errors name the
  request, the source and OBS's error code (also logged to the browser console).

## Core concept
- Input settings (URL, file, text) are per input: editing affects every scene using it.
- Transform and visibility are per scene item.

## Features (Phase 1)
- **Scenes panel:** scene tree, item visibility, lock, transform (X, Y, scale, rotation, crop).
  - Built: all scenes listed in OBS order, expanded by default (collapse state remembered);
    items top-to-bottom as in the Sources dock; groups shown nested; nested scenes labelled.
  - Built: eye toggle per item (applies immediately, reverts with an error if OBS refuses);
    lock shown read-only; live sync of changes made in OBS.
  - Built: filter box matches scene names, source names and type labels (Escape clears).
  - Built: "Go live" button per scene header (switches Program; Studio Mode not used, so
    the full-screen Preview projector follows). Clicking the header only collapses/expands.
  - Built: transform toggle per item opens an inline editor below it (several can be open):
    position, rotation, size (or bounds box when bounds are active), crop. Aspect lock on by default.
  - Next: lock toggle; possibly alignment/bounds type editing.
- **Sources panel (built):** inline-editable tables grouped by type, all visible at once:
  - Browser: URL, width/height, refresh
  - Media: file or URL, loop, play/pause/restart
  - Image: file
  - Image Slideshow: file list, slide time, prev/next
  - Text (GDI+): text, font size, colour
  - Built extras: Browser local-file toggle; Media local/URL toggle and loop; Slideshow loop,
    full file-list editor (add, edit, include/exclude, reorder, remove); Text read-from-file shown as path.
  - Multi-line text applies with Ctrl+Enter or by leaving the field (Enter = new line).
  - Path fields strip the quotes Windows adds with "Copy as path".
  - Each row has a raw settings view (read-only JSON) to check what OBS stores.
  - Filter matches names plus URL, file path, slideshow paths and text content.
- Name filter across both panels (each panel has its own filter).
- Sources type filter (built): buttons per type with counts; click toggles, Ctrl+click shows
  only that type; remembered. "Other" table lists every other source (kind + raw settings).
- Sources scope (built): dropdown "All sources / Live scene / <scene>"; default Live scene;
  includes groups and nested scenes; sources hidden in that scene are greyed ("hidden here");
  list button on each scene header jumps the Sources panel to that scene; a deleted chosen
  scene falls back to Live. Type filter counts follow the scope.
- Deleting (built), all with an inline two-step confirm (nothing can be undone):
  - Scene item (Scenes panel bin): "Remove from <scene>"; if the source is used in several
    places, also "Delete from all N". Groups/nested scenes: remove only.
  - Source (Sources panel bin): deletes from every scene; the confirm lists where it's used.
  - Scene (scene header bin): disabled for the live scene and for the last scene; warns if
    the scene is nested inside others.
- Adding sources (built): "+" on each scene header opens an inline form.
  - New source: type (Browser, Media, Image, Image Slideshow, Text), unique name (suggested,
    clashes blocked), main setting; Browser size defaults to the canvas; Media local file or URL.
    Uses the newest kind ID the OBS offers (e.g. slideshow_v2, text_gdiplus_v3).
  - Existing source: searchable list of sources and other scenes; marks ones already in it.
  - "Start hidden" is ticked by default when the scene is live. New items go on top (OBS default).
- Scenes (built): "+ Scene" in the panel header creates an empty scene (unique-name check,
  suggested "Scene N"); rename via pencil on the header or double-clicking the name (Enter or
  blur applies, Escape cancels, duplicates blocked; blur with an invalid name cancels). Collapsed
  state and the Sources scope follow a rename. No reorder/duplicate (not in obs-websocket).
- Ordering (built): per item ⤒ ▲ ▼ ⤓ (top, up, down, bottom), also inside groups; buttons
  fade in on hover. Top of the list = drawn above everything else.
- Program preview (built): collapsible snapshot of the live scene at the top of the Scenes
  panel; 640px JPEG every 0.5/1/2/5 s (default 1 s); polls only while open and tab visible.
- Slideshow: file list tolerant of other storage formats; clicking the summary opens the editor.
  Listing the images inside a folder isn't possible over obs-websocket (no file access).
- "LIVE" badge on sources actually visible on air (enabled in the Program scene, through
  enabled groups and nested scenes). Badge only, no confirm step (for now).
- Presets: saved URLs/paths per field; JSON export/import.

## Editing behaviour
- Edits apply only on Enter or when the field loses focus, never while typing.
- Escape cancels an edit; a field with an unapplied edit is highlighted (amber).
- Toggles and buttons (visibility, Go live) apply immediately on click.

## Testing (built)
- Vitest + Testing Library + jsdom; a fake obs-websocket server (`tests/mock`) with demo content,
  request log, failure injection and connection drops. 127 tests (unit + app).
- GitHub Actions CI on every push: npm ci, typecheck, lint, test, build (Node 22, Ubuntu).
- Real-OBS behaviour is checked by hand: `docs/manual-test-checklist.md`.
- Minimum Node.js 22.12 (Vitest). jsdom kept at 28: jsdom 30+ needs Node 22.22+/24.15+ and fails on
  older Node 22 with "Cannot read properties of undefined (reading 'bind')".
- Found by the tests: the connection form's Port field snapped back to 4455 when cleared (fixed:
  the field now holds text and is validated on save).

## Export / import (built)
- "Export" / "Import" on the connections screen. JSON file: `{ app: "obs-web-controller",
  kind: "settings", version: 1, exportedAt, connections: [{ name, host, port, password? }] }`;
  room for presets later. Newer-version files are refused with a clear message.
- Passwords left out unless "Include saved passwords" is ticked (plain-text warning shown);
  passwords that weren't saved are never exported.
- Import matches by name (case/space-insensitive): new ones added (asking for a password if
  none in the file); differing ones → one question: Update them / Keep mine / Cancel import;
  identical ones left alone. Updating keeps the saved password if the file has none.

## Code structure
- ScenesPanel split (Nov 2026) into SceneSection, SceneHeader, ItemRow, OrderButtons, with
  panel-wide state in panelState.ts, filter rules in rows.ts and useCollapsed.ts; browser storage
  goes through src/lib/storage.ts. Behaviour unchanged (all tests passed unmodified).

## Later
- Advanced Scene Switcher integration (trigger macros via websocket messages).
- Hosting the built app on the OBS PC.
- Shared presets file.

## Open questions
- (to fill in during requirements design)
