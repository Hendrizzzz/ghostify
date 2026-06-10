# Ghostify Release Checklist

Use this checklist for every Chrome Web Store release, including small hotfixes.
The goal is to keep the repository, built extension, Chrome Web Store package, and
public release notes aligned.

## 1. Release Scope

- Release owner:
- Target version:
- Release type: patch / minor / major / emergency hotfix
- Target channel: Chrome Web Store public listing
- Linked issues or PRs:
- User-visible risk summary:
- Platform areas touched: Instagram / Messenger / Facebook / popup / website / build only

## 2. Repository Preflight

- Confirm the branch is current before preparing the release:

```bash
git fetch origin
git status --short
git branch --show-current
git log --oneline --decorate --max-count=5
```

- Do not release from a branch that is behind `origin/main`.
- Keep local-only artifacts out of commits and release PRs, including
  `AGENTS.local.md`, `tmp/`, `*.zip`, `*.log`, and local design/export files.
- Use explicit path staging for releases. Do not use `git add .` from a dirty
  workspace.
- Confirm the intended code changes are already reviewed or intentionally included.
- Confirm no unrelated tracked file changes are mixed into the release.

## 3. Version Synchronization

Update the same version everywhere before building:

- `package.json`
- `package-lock.json`
- `dist/manifest.json`
- `dist/config/patterns.json`
- `src/content.js` fallback config
- `CHANGELOG.md` release heading
- Chrome Web Store ZIP filename

When privacy patterns change, keep `dist/config/patterns.json` and the
`FALLBACK_CONFIG` object in `src/content.js` synchronized. CI validates this,
but it is cheaper to check it during review.

The Chrome Web Store requires a newly uploaded extension version to be greater
than the currently published version. Do not reuse a version number for a second
upload.

Before packaging, record the currently published versions:

- Chrome Web Store version:
- Chrome Web Store updated date:
- Latest GitHub Release:
- Latest local Git tag:

The target version must be greater than the Chrome Web Store version and should
match the GitHub Release/tag you are preparing. If the repository version is
behind the live Store version, stop and reconcile the repo before building a
release package.

Run this internal version check before packaging:

```powershell
@'
const fs = require('fs');

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const manifest = readJson('dist/manifest.json');
const patterns = readJson('dist/config/patterns.json');
const content = fs.readFileSync('src/content.js', 'utf8');
const fallback = content.match(/version:\s*["']([^"']+)/)?.[1];

const versions = {
    'package-lock.json': lock.version,
    'package-lock root package': lock.packages?.['']?.version,
    'dist/manifest.json': manifest.version,
    'dist/config/patterns.json': patterns.version,
    'src/content.js fallback': fallback
};

for (const [name, value] of Object.entries(versions)) {
    if (value !== pkg.version) {
        throw new Error(`${name} version ${value || '<missing>'} does not match package.json ${pkg.version}`);
    }
}

console.log(`version ${pkg.version} is synchronized`);
'@ | node
```

## 4. Changelog And Release Notes

- Move user-facing entries from `CHANGELOG.md` `Unreleased` into a dated version section.
- Keep release notes written for users first, not just contributors.
- Include sections only when they apply: `Added`, `Changed`, `Fixed`,
  `Privacy / Compliance`, `Verification`, and `Credits`.
- Chrome Web Store release notes should be a short excerpt from the changelog.
- GitHub Release notes can be longer, but should still match the changelog facts.
- Only credit users who explicitly gave permission in an issue, email, or other
  durable record.

## 5. Automated Checks

Install from the lockfile and run the full extension test command:

```bash
npm ci
npm test
```

`npm test` runs `npm run build` first. After it finishes, confirm generated
extension files are committed:

```bash
git diff --exit-code -- dist/background.js dist/js/content.js dist/js/ghost.js dist/js/messenger_patch.js
```

Do not package or upload if CI or local tests fail.

## 6. Manual Extension Smoke Test

Load `dist/` as an unpacked extension in Chrome or a Chromium-based browser:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the repository `dist/` folder.

Verify:

- Popup opens without errors.
- Popup displays the expected manifest version.
- Toggles persist after popup close and page refresh.
- Existing open Meta tabs receive setting changes or are refreshed after install.
- Extension service worker has no relevant runtime errors.
- Browser console has no repeated Ghostify errors on tested sites.

## 7. Platform Smoke Matrix

Test only with accounts and conversations you are allowed to use.

### Instagram

- Hide typing is enabled and typing indicators are not sent.
- Hide Seen is enabled and read receipt writes are blocked.
- Hide story-view signals is enabled and story/reel view writes are blocked.
- Messages, stories, reels, and normal navigation still load.

### Messenger

- Hide typing is enabled and typing indicators are not sent.
- Hide Seen is enabled and read receipt writes are blocked.
- Sending a normal message still succeeds.
- Message requests open and hydrate correctly.
- Conversation navigation, media, and reload behavior remain usable.

### Facebook

- Feed mini-chat and `/messages` or Messenger surfaces still load.
- Hide Seen blocks read receipt writes.
- Message requests open correctly.
- Facebook local read-state behavior is documented and not mistaken for a sent Seen signal.
- Video and media playback still work on non-message surfaces.

Record any platform limitation in the GitHub Release notes and, when user-facing,
in the website or README known-issues section.

## 8. Privacy And Compliance Review

Confirm the release still matches `PRIVACY.md` and Chrome Web Store disclosures:

- No Ghostify tracking server was added.
- No remote code execution or remotely hosted extension logic was added.
- Every manifest permission and host permission is still justified in
  `PRIVACY.md` and in the Chrome Web Store dashboard.
- No new host permissions were added without a clear user-facing reason.
- `declarativeNetRequest` is still used only for local dynamic privacy rules.
- User preferences remain in `chrome.storage.local`.
- Bundled privacy patterns remain in `dist/config/patterns.json`.
- No messages, credentials, browsing history, or social media content are collected.
- Chrome Web Store privacy fields still match actual behavior.
- Reviewer test instructions are updated if behavior or permissions changed.

## 9. Package For Chrome Web Store

Create the package with `manifest.json` at the ZIP root:

```powershell
$version = (Get-Content package.json | ConvertFrom-Json).version
$zip = "ghostify-v$version-chrome-web-store.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path dist\* -DestinationPath $zip
Get-FileHash $zip -Algorithm SHA256
```

Verify the package contents before upload using a temporary directory outside
the repository:

```powershell
$version = (Get-Content package.json | ConvertFrom-Json).version
$zip = "ghostify-v$version-chrome-web-store.zip"
$releaseCheck = Join-Path $env:TEMP "ghostify-release-check-$version"
if (Test-Path $releaseCheck) { Remove-Item $releaseCheck -Recurse -Force }
Expand-Archive $zip -DestinationPath $releaseCheck -Force
(Get-Content (Join-Path $releaseCheck "manifest.json") | ConvertFrom-Json).version
```

The extracted manifest version must equal the target release version.

## 10. Chrome Web Store Submission

- Upload the ZIP in the Chrome Web Store Developer Dashboard.
- Update listing copy only when behavior changed.
- Update privacy fields if permissions or data handling changed.
- Add reviewer test instructions for Meta-platform flows when helpful.
- Prefer a controlled publish time for larger releases.
- Save the package filename, SHA-256 hash, upload time, and review status.

## 11. Post-Approval

- Verify the Store listing shows the approved version.
- Install or update from the Store and perform a brief popup/load smoke test.
- Create or update the Git tag `vX.Y.Z`.
- Create a GitHub Release using the matching `CHANGELOG.md` section.
- Attach or reference the release ZIP checksum as appropriate.
- Close linked issues and thank reporters only when public credit permission exists.
- Watch new issues for platform regressions after publication.

## 12. Rollback And Hotfix

- If review has not completed, cancel or replace the pending submission.
- If the release is live and harmful, prepare a patch version with the fix.
- Use Chrome Web Store rollback only when it is safer than a forward hotfix.
- Document the incident, affected surfaces, and mitigation in the GitHub Release.
- Keep the changelog honest about regressions and fixes.
