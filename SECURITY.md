# Security policy

Stagehand controls OBS Studio, and the OBS WebSocket password it uses gives full control of OBS,
including file paths on the OBS PC. Security reports are taken seriously, even though this is a
small, single-maintainer project.

## Supported versions

Only the **latest release** gets security fixes. Fixes are published as a new release (usually a
patch version) and noted in [CHANGELOG.md](CHANGELOG.md). If you host Stagehand, update to the
latest release before reporting, in case the problem is already fixed.

## Reporting a vulnerability

**Please don't report security problems in public issues.** Instead, use GitHub's private
reporting: go to the repository's **Security** tab and choose **Report a vulnerability**. Only
the maintainer can see the report.

Please include:

- the Stagehand version (shown next to the name in the app's top bar);
- how Stagehand was run (the hosting package on a PC, `npm run dev`, or something else);
- the steps to reproduce it, and what someone could do by exploiting it.

This is maintained in spare time, so please allow up to **two weeks** for a first reply. You'll
be told whether the report is accepted, and credited in the release notes if you'd like to be.

## What counts as a vulnerability

Stagehand is designed for a **trusted local network**. Some trade-offs are deliberate and
documented in the README's [Security](README.md#security) section, so they aren't treated as
vulnerabilities:

- The Stagehand page has **no login of its own**. Anyone on the network can open it, but they
  need the OBS WebSocket password to do anything.
- The connection to OBS is **unencrypted** (`ws://`), as is the page itself (`http://`).
- Saved passwords are kept **unencrypted** in the browser's storage, and exports made with
  *Include saved passwords* contain them as plain text.
- Problems caused by exposing Stagehand or OBS's WebSocket port to the internet, which the README
  advises against.

Examples of what **is** in scope:

- the hosting server (`host/server.mjs`) serving files outside the app folder, or crashing on
  crafted requests;
- content from OBS (source names, settings, text) or from an imported connections file being
  run as code in the page (cross-site scripting);
- Stagehand revealing a saved password somewhere the README doesn't say it does;
- Stagehand sending anything to a host other than the OBS PC you connected to.

Problems in **OBS Studio** or **obs-websocket** themselves should be reported to the
[OBS Project](https://github.com/obsproject/obs-studio/security) instead.
