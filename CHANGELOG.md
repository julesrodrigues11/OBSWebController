# Changelog

All notable changes to OBS Web Controller are listed here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/): **MAJOR** for changes that break existing use,
**MINOR** for new features, **PATCH** for fixes.

Add changes under **Unreleased** as they're made. `npm version` moves them into a dated version
section when a release is made (see "Releasing" in the README).

## [Unreleased]

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
