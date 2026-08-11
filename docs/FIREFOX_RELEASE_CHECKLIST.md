# Firefox Add-ons Release Checklist

Use this checklist for every submission to Firefox Browser Add-ons
(addons.mozilla.org, or AMO). It supplements the shared Meta smoke fixtures and
does not change the Chromium release workflow.

## 1. Release Identity

- Target version:
- AMO listing status: new listing / version update
- Permanent Gecko ID: `ghostify@ghostify-extension.vercel.app`
- Firefox minimum version: `140.0`
- Firefox for Android minimum version: `142.0`
- Linked issue or PR:
- User-visible changes:

Stop if the Gecko ID differs from an already-submitted AMO listing.

## 2. Repository And Version Preflight

- Work from a reviewed branch based on current `origin/main`.
- Confirm version synchronization using the shared release checklist.
- Confirm the Chromium manifest still owns `background.service_worker`.
- Confirm the Firefox overlay owns `background.scripts` and retains the exact
  Ghostify status-feed host permission used by Chromium.
- Confirm generated ZIPs, checksums, `tmp/`, logs, and reviewer communications
  are not staged.

## 3. Automated Validation

Run one command at a time and stop on failure:

```bash
npm ci
npm run ci
npm run package:firefox
npm run test:package
```

Record the upload ZIP and reviewer source ZIP filenames and SHA-256 hashes.

## 4. Temporary Firefox Smoke

Run `npm run prepare:firefox`, open `about:debugging#/runtime/this-firefox`,
choose **Load Temporary Add-on**, and select
`tmp/firefox-extension/manifest.json`.

- `GH-POPUP-001` and `GH-FF-POPUP-001`: popup opens, version is correct,
  toggles persist, and Firefox-specific links behave correctly.
- The popup fetches `ghostify-extension.vercel.app/status.json` and matches the
  latest public date, green/yellow state, and update title.
- Inspect the status request and confirm it uses privileged XHR with no
  credentials, custom headers, query parameters, body, or extension Origin.
- The background page has no relevant errors.
- Instagram, Messenger, Facebook, and MAW proxy frames receive the intended
  content scripts at document start.
- Complete all affected smoke IDs from `docs/QA_FIXTURES.md`, including
  sender-side or story-owner proof when applicable.
- On Firefox for Android 142 or later, repeat the affected mobile-web smoke
  checks with the exact packaged build and record the Firefox/Android versions.

Do not claim Firefox support verified from automated tests alone.

## 5. Privacy And Reviewer Source

- Confirm `PRIVACY.md` describes the Firefox no-data declaration accurately.
- Confirm the Firefox package has the justified Ghostify website host permission
  and uses it only for the display-only public status feed.
- Confirm no remote code, telemetry, analytics, or remote privacy configuration
  was added.
- Open the reviewer source ZIP and confirm it includes
  `FIREFOX_REVIEW_BUILD.md`, source files, build scripts, and lockfile.
- Reproduce the upload ZIP from the reviewer source instructions before upload.
- Record `GH-FF-PKG-001` as `verified` only after package, lint, checksum, and
  reviewer-source reproduction checks pass.

## 6. AMO Submission

The maintainer performs these external steps:

1. Sign in to the AMO Developer Hub with the owning Mozilla account.
2. Choose **On this site** for a public AMO listing.
3. Upload `ghostify-vX.Y.Z-firefox-add-ons.zip`.
4. Answer **Yes** when AMO asks whether source code is required, then upload
   `ghostify-vX.Y.Z-firefox-add-ons-source.zip`. Ghostify uses esbuild, so this
   source archive and its build instructions are mandatory for every version.
5. Select both Firefox desktop and Firefox for Android compatibility. The
   generated manifest enforces minimum versions 140 and 142 respectively.
6. Use the paste-ready fields and reviewer notes in
   `docs/FIREFOX_AMO_SUBMISSION.md`; replace every owner-action placeholder in
   the private AMO form before submission.
7. Review every permission and data declaration, accept the applicable
   agreements, and submit the version.

Never provide personal Meta credentials. Provide dedicated reviewer accounts
privately in AMO, or coordinate an accepted testing alternative with the
reviewer before submission.

## 7. Post-Submission

- Record AMO validation warnings and reviewer requests.
- Do not describe the submitted version as approved or live before AMO approval.
- After approval, install the Mozilla-signed version and repeat the popup and
  affected Meta smoke checks.
- Record approved version, listing URL, approval date, Firefox version, OS,
  and remaining manual evidence.
- Update `docs/BROWSER_DISTRIBUTION.md`, README publication state, and release
  records in a separate reviewed change.
