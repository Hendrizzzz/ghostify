# Ghostify QA Fixtures

Use these IDs in PRs, release notes, and bug-fix verification when live browser
behavior matters. Keep screenshots, captures, and account-specific details out
of the repository unless they are redacted and intentionally published.

## Evidence Status

| Status | Meaning |
| --- | --- |
| `verified` | The automated command or manual smoke test passed for the stated version/build. |
| `manual-pending` | A live account, browser profile, or platform state is required and has not been checked yet. |
| `gap` | The behavior is important but has no reliable coverage yet. |
| `not applicable` | The check does not apply to the change. |

## Smoke IDs

| ID | Surface | Expected proof |
| --- | --- | --- |
| `GH-POPUP-001` | Extension popup | Popup opens, shows the manifest version, and toggle changes persist after popup close and page refresh. |
| `GH-IG-TYPING-001` | Instagram | With Hide typing enabled, typing in a DM does not send a typing indicator and normal messaging still works. |
| `GH-IG-SEEN-001` | Instagram | With Hide Seen enabled, opening a DM blocks read-receipt writes while conversation navigation still works. |
| `GH-IG-STORY-001` | Instagram | With Hide story-view signals enabled, viewing a story or reel blocks supported story-view writes and media still plays. |
| `GH-MSG-TYPING-001` | Messenger | With Hide typing enabled, typing does not send a typing indicator and message sending still succeeds. |
| `GH-MSG-SEEN-001` | Messenger | With Hide Seen enabled, opening a conversation blocks read-receipt writes and normal sends still succeed. |
| `GH-MSG-STORY-001` | Messenger | With Hide Story Views enabled, supported Messenger/Facebook story-view writes are blocked where the web surface exposes them, and normal navigation still works. |
| `GH-MSG-REQUESTS-001` | Messenger | Message requests open, hydrate, and navigate without being blocked by privacy matchers. |
| `GH-FB-SEEN-001` | Facebook | Feed mini-chat or `/messages` blocks Seen-style writes without breaking conversation navigation. |
| `GH-FB-TYPING-001` | Facebook | With Hide Typing enabled on Facebook messaging surfaces, typing does not send a typing indicator and normal messaging still works. |
| `GH-FB-STORY-001` | Facebook | With Hide Story Views enabled, supported Facebook story-view writes are blocked and story media still loads. |
| `GH-FB-LOCAL-READ-001` | Facebook | Local read-state UI behavior is not mistaken for sender-side Seen proof; verify with refresh or Messenger cross-check. |
| `GH-FB-MEDIA-001` | Facebook | Video and media playback still works on non-message surfaces after focus/visibility changes. |
| `GH-STATUS-001` | Public verification status | `/status`, `/status/history`, and `/status.json` load; expired verified entries downgrade; popup links to the public status page without changing extension behavior. |
| `GH-PKG-001` | Release package | Chrome Web Store ZIP has `manifest.json` at the root, matches `package.json` version, and has a recorded SHA-256 checksum. |
| `GH-PRIVACY-001` | Privacy review | Manifest permissions and host permissions match the allowlist and remain justified by `PRIVACY.md`. |

## Reporting Format

Use a short evidence table for high-risk fixes and releases:

| Check | Status | Evidence |
| --- | --- | --- |
| `npm run ci` | `verified` | Passed locally on commit/branch. |
| `GH-MSG-SEEN-001` | `manual-pending` | Requires live Messenger account verification. |
| `GH-PRIVACY-001` | `verified` | `npm run validate:extension` passed; no manifest permission drift. |

Do not report a live platform fix as fully verified unless the relevant smoke
ID is `verified`. Automated tests can prove local matching behavior; live
platform behavior still needs a browser smoke test when the change depends on
third-party app behavior.
