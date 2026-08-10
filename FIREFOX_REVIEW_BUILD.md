# Firefox Reviewer Build Instructions

This source archive reproduces Ghostify's Firefox Browser Add-ons upload ZIP.
It contains the original source, checked-in static package assets, generated
bundle references, package scripts, tests, and npm lockfile. No private
repository or commercial build tool is required.

The generated manifest targets Firefox desktop 140 or later and Firefox for
Android 142 or later from the same shared runtime.

## Environment

- Ubuntu 24.04 or another current Linux distribution
- Node.js 24.x
- npm 11.x
- Network access to the public npm registry for `npm ci`

The build uses the open-source [`esbuild`](https://github.com/evanw/esbuild)
package ([npm package](https://www.npmjs.com/package/esbuild)) pinned by
`package-lock.json`.
Mozilla's `web-ext` is used only for repository linting and is not required to
reproduce the upload ZIP.

## Reproduce The Firefox Upload ZIP

From the archive root, run:

```bash
npm ci
npm run build
npm run validate:firefox
npm run package:firefox
```

The AMO upload artifact is:

```text
ghostify-v<package-version>-firefox-add-ons.zip
```

The command also creates a reviewer source ZIP and SHA-256 checksum files. ZIP
entries use a fixed timestamp and stable lexical ordering so identical source
and dependency inputs produce an identical upload artifact.

## Source And Generated Files

- `src/` contains the authored runtime modules.
- `build.js` bundles four entry points into `dist/` without minification.
- `dist/` also contains authored popup files, icons, the Chromium manifest, and
  bundled privacy configuration.
- `browser-targets/firefox/manifest.overlay.json` contains only the Firefox
  manifest differences.
- `scripts/prepare-firefox-extension.js` creates the final Firefox manifest and
  staging directory.
- `scripts/package-firefox.js` creates the upload and reviewer source archives.

Live Instagram, Facebook, and Messenger privacy behavior requires authorized
test accounts and is documented separately in `docs/QA_FIXTURES.md`.
