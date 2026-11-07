# Contributing to CF Helper

## Source layout

- `firefox/` is the Firefox extension.
- `chromium/` is the Chromium extension for Chrome, Edge and other compatible browsers.
- Each folder is independently loadable and contains its own `manifest.json`.

Apply shared feature changes and bug fixes to both versions. Keep browser-specific differences: Firefox uses `browser` APIs and background scripts; Chromium uses `chrome` APIs and a service worker with `core.js` imported explicitly. Chromium's message listener uses `sendResponse` and returns `true` for asynchronous replies.

## Work directly on the extension

Node.js is not required to edit or load either extension. Use Firefox's `about:debugging#/runtime/this-firefox` to load `firefox/manifest.json`, or a Chromium browser's extensions page to load the `chromium/` folder with Developer mode enabled.

After changes, reload the extension and the Codeforces problemset page. Check:

- Filters, sorting, presets and bookmarks.
- Popup and page settings, including language and page size.
- Public Codeforces handle sync and solved/attempted filters.
- Exporting results and bookmarks.
- Saved preferences and bookmarks after reloading and restarting the browser.
- Returning to the original archive and any errors in the extension/background console.

Test shared changes in both Firefox and a Chromium browser. Edge is useful when Chrome is unavailable; test Chrome itself before claiming Chrome release compatibility. Close service worker DevTools when testing idle/restart behavior.

## Development tooling

`package.json`, `package-lock.json`, `scripts/` and `tests/` belong in Git so contributors and CI can use the same development tools and checks. `node_modules/` and generated `dist/` files stay ignored.

Install Node.js 20+ with npm, then run:

```sh
npm ci
npm test
npm run lint:extension
npm run build
```

The extension itself does not depend on Node.js or npm at runtime.

### Tests and build scripts

The repository includes regression tests in `tests/` and packaging/browser-check scripts in `scripts/`:

| Command | Purpose |
| --- | --- |
| `npm test` | Run regression tests for worker messaging, caching, failures and package entry points |
| `npm run test:edge` | Check the worker, popup, storage and messaging in headless Edge using an isolated temporary profile |
| `npm run build` | Package both browser versions into ZIPs |
| `npm run build:firefox` | Package Firefox only |
| `npm run build:chromium` | Package Chromium only (`build:chrome` is an alias) |

Run the regression tests and Firefox validator after relevant code changes. Run the Edge smoke test when changing Chromium worker, popup or messaging behavior. The Edge test uses cached fixture data; manual testing on Codeforces is still needed.

The Edge helper requires Node.js 22.4+ for its built-in WebSocket client and an installed Edge browser. Set `EDGE_BINARY` if Edge is installed outside the helper's default Windows path.

`npm run build` creates separate ZIPs in `dist/`, named using each manifest's version, for example `cfhelper-firefox-1.0.0.zip` and `cfhelper-chromium-1.0.0.zip`. To invoke the underlying packaging tool directly:

```sh
npx web-ext build --source-dir firefox --artifacts-dir dist --filename cfhelper-firefox.zip --overwrite-dest
npx web-ext build --source-dir chromium --artifacts-dir dist --filename cfhelper-chromium.zip --overwrite-dest
```

Each resulting ZIP must contain `manifest.json` at its root. For store updates, increase the relevant manifest version before packaging.

## Changes and pull requests

Describe the problem, the resulting behavior, affected browsers and the checks you actually ran. Include screenshots for visible UI changes. Keep unrelated changes out of the patch and report any browser you could not test.
