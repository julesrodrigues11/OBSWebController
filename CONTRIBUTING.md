# Contributing to Stagehand

Thanks for your interest. Stagehand is a small personal project, built for a specific way of
working with OBS Studio, so a little coordination up front saves everyone time.

## Issues

- **Bugs:** open an issue with the Stagehand version (shown in the app's top bar), your OBS
  version, your browser, the steps to reproduce it, and what you expected to happen. A
  screenshot of any error helps.
- **Ideas and feature requests** are welcome as issues. Some things are out of scope by design:
  audio controls, filters, stream/record controls and OBS settings. Stagehand is meant to
  **augment** OBS, not replace it (see
  [What it is (and isn't) for](README.md#what-it-is-and-isnt-for)).
- **Security problems:** please don't open a public issue. See [SECURITY.md](SECURITY.md).

## Pull requests

Please **open an issue first** to discuss a change before writing code, so you don't spend time
on something that doesn't fit. Small fixes (typos, obvious bugs) can go straight to a pull
request.

### Setting up

You need [Node.js](https://nodejs.org/) **22.12 or newer**. Then:

```
npm ci          # install dependencies exactly as locked
npm run dev     # run the app at http://localhost:5173
```

You don't need a real OBS to work on most things: the tests use a fake OBS (`tests/mock/`). See
[Development](README.md#development) for how the code is organised and
[Testing](README.md#testing) for how the tests work.

### Before opening a pull request

Run the same checks that GitHub runs on every push:

```
npm run typecheck
npm run lint
npm test
npm run build
```

And please follow the project's conventions:

- **Add or update tests** for what you change. Most tests drive the real interface against the
  fake OBS; follow the existing ones in `tests/app/`.
- **Update the README** in the same pull request, so the documentation always matches the app.
- **Add a line to `CHANGELOG.md`** under **Unreleased** (in *Added*, *Changed* or *Fixed*). Don't
  change the version number; that happens when a release is made.
- **Editing behaviour:** fields apply their change on **Enter** or when you leave the field, and
  **Escape** cancels. New fields should work the same way.
- Keep dependencies to a minimum, and keep the hosting server (`host/server.mjs`) to Node's
  built-in modules only.

## Licence

By contributing, you agree that your contributions are released under the project's
[MIT Licence](LICENSE).
