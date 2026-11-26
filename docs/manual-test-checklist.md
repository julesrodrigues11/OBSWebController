# Manual test checklist (real OBS)

The automated tests use a fake OBS, which proves the app sends the right requests and reacts to
OBS's events correctly. They can't prove what **real OBS** does with those requests. Run through
this list after upgrading OBS, after larger changes, or before relying on the app for a show.

Use a **test scene collection** in OBS (*Scene Collection → New*), not your live one: some steps
delete things.

Tick each item; note anything unexpected (and the OBS version) under *Findings* at the end.

## Connection

- [ ] Connect from another PC on the LAN using a saved connection.
- [ ] Wrong password: the app says so under the connection and doesn't keep retrying.
- [ ] Close OBS while connected: the *Reconnecting* banner appears. Reopen OBS: the app
      reconnects by itself and the scenes reload.
- [ ] Status bar shows the correct OBS and obs-websocket versions.

## Defaults and stored settings

For one source of each type (Browser, Media, Image, Image Slideshow, Text), open `{ }` in the
Sources panel and compare with OBS's own Properties window.

- [ ] Browser: URL / local file, width, height match.
- [ ] Media: *Local file* matches; file path or URL matches; *Loop* matches.
- [ ] Image: file path matches.
- [ ] Image Slideshow: the file list (including folders) and seconds per slide match.
- [ ] Text: text, font size and colour match. Sources never edited (all defaults) don't show
      blank fields.

## Editing (check the result in OBS's preview or Properties)

- [ ] Browser: change the URL → OBS loads the new page. *Refresh* reloads it.
- [ ] Browser: change W × H → OBS's browser source changes size.
- [ ] Media: change the file → the new file plays. Play / pause / restart / stop work and the
      status in the app follows (also when a non-looping file reaches its end).
- [ ] Image: change the file → new image shows.
- [ ] Slideshow: add a folder and an image, exclude one, reorder → OBS's list matches.
      Previous / next change the slide. Seconds per slide take effect.
- [ ] Text: change text (multi-line with Ctrl+Enter) and font size → OBS updates; the font
      face and style are unchanged.
- [ ] Text colour: pick a clear colour (e.g. pure red) → OBS shows **red** (not blue). Then change
      the colour in OBS → the swatch in the app matches.
- [ ] Paste a path from Explorer's *Copy as path* (with quotes) → OBS gets the path without quotes.

## Scenes and items

- [ ] Go live switches the scene on the stream/projector.
- [ ] Eye button hides/shows; also for an item inside a group.
- [ ] Order buttons: OBS's Sources dock shows the same order as the app afterwards.
- [ ] Transform: position, rotation, size and crop change the item as expected in OBS's preview.
- [ ] Transform on an item with a bounding box (*Edit Transform → Bounding Box Type*): the app
      shows *Bounds* and editing it changes the box.
- [ ] Drag an item in OBS while its transform editor is open in the app → numbers update.

## Adding, removing, deleting

- [ ] Add a new source of each of the five types: it appears in OBS at the top of the scene,
      hidden if *Start hidden* was ticked, and renders correctly when shown.
- [ ] Add an existing source to another scene → OBS shows the same source in both.
- [ ] Remove a source that is in two scenes from one of them → still present in the other.
- [ ] **Remove a source from the only scene it's in.** Does OBS delete the source, or keep it
      unused (still listed under *All sources* in the app)? Record which under *Findings*.
- [ ] Delete a source from the Sources panel → gone from every scene in OBS.

## Scenes

- [ ] *+ Scene* creates a scene; note where OBS places it in its Scenes dock.
- [ ] Rename a scene (pencil and double-click) → OBS shows the new name; a scene that is nested
      in another scene shows the new name there too.
- [ ] Rename the live scene → it stays live.
- [ ] Delete a scene → removed in OBS; the live scene's delete button is disabled.

## Preview

- [ ] Expanded preview shows the live scene, refreshing at the chosen rate.
- [ ] At *every 0.5s*, OBS's own stats (*Docks → Stats*) show no dropped/lagged frames.
- [ ] Collapsing it (or switching to another browser tab) stops the snapshots.

## Hosting package (on the OBS PC)

- [ ] Download the release zip, unblock it, extract it. `start.bat` starts and lists the
      addresses; the app opens at `http://localhost:8080` on the OBS PC.
- [ ] `add-firewall-rule.bat` (as administrator) → another PC can open
      `http://<obs-pc>:8080` and connect to OBS.
- [ ] On another PC, **+ New** shows the OBS PC's address and port filled in.
- [ ] The top bar shows the release's version.
- [ ] `install-autostart.bat` → log out and in → the server starts minimised.
      `remove-autostart.bat` → it no longer starts.
- [ ] Start a second `start.bat` while one is running → "port 8080 is already in use".
- [ ] Update to a newer release (replace the folder) → after a reload, the top bar shows the new
      version.

## Findings

| Date | OBS version | Item | What happened |
|---|---|---|---|
|  |  |  |  |
