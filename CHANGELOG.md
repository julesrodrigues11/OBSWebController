# Changelog

All notable changes to Stagehand (formerly OBS Web Controller) are listed here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/): **MAJOR** for changes that break existing use,
**MINOR** for new features, **PATCH** for fixes.

Add changes under **Unreleased** as they're made. `npm version` moves them into a dated version
section when a release is made (see "Releasing" in the README).

## [Unreleased]

## [0.3.1] - 2026-11-26

### Added

- The project is now released under the **MIT Licence** (`LICENSE`); the hosting zip includes it
  as `LICENSE.txt`.

## [0.3.0] - 2026-11-26

### Changed

- The app is now called **Stagehand** (formerly OBS Web Controller), with its own icon. The
  release zip and folder are now `stagehand-obs`, and exported connections files are named
  `stagehand-connections-<date>.json`.
- Updating a hosted copy: run `install-autostart.bat` and `add-firewall-rule.bat` again; they
  replace the old-named start-up shortcut and firewall rules.

Nothing is lost when updating: saved connections and settings stay in each browser, and
connections files exported under the old name still import.

## [0.2.0] - 2026-11-26

### Added

- The first-run **New connection** form has an **Import file…** option, so a connections file
  exported elsewhere can be loaded straight away instead of typing a connection in.

## [0.1.0] - 2026-11-26

First release.

### Added

- Saved connections (name, address, port, optional saved password), with export and import as
  a file; automatic reconnection; clear connection errors.
- Scenes panel: every scene with its sources, groups and nested scenes; Go live; show/hide;
  reorder (top, up, down, bottom); transform editor (position, rotation, size or bounds, crop);
  add new or existing sources; remove/delete items, sources and scenes; create and rename
  scenes; collapsible live preview.
- Sources panel: editable tables for Browser, Media, Image, Image Slideshow and Text sources,
  plus an Other table; scope (all / live scene / chosen scene), type and text filters; LIVE
  badges; raw settings view.
- Hosting package for the OBS PC: a small web server, start and start-on-login scripts, and a
  firewall-rule helper. When hosted there, new connections default to that PC's address.
- Version number shown in the top bar.
- Automated tests (fake OBS + simulated browser) and GitHub Actions checks on every push;
  releases built automatically from version tags.
