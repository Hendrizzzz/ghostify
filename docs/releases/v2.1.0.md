# Ghostify 2.1.0 store submission

Prepared on October 15, 2026. The maintainer confirms that Chrome Web Store,
Microsoft Edge Add-ons, and Firefox Add-ons all approved version 2.1.0 on
October 16, 2026. All three public listings now serve 2.1.0.

## Scope

- Fix Facebook group-chat messages remaining in Sending with Hide Seen enabled,
  including after Facebook reloads (PR #246, issue #145).
- Refresh the popup and add automatic seasonal looks, a once-per-day opening
  animation, optional quiet sounds that are off by default, and Help & feedback
  through GitHub or a copyable email address (PRs #249, #251, #252).
- Keep the shared runtime, permissions, permanent Firefox identity, and local
  privacy settings unchanged by this release-preparation change.

The maintainer confirms all supported controls are working, including Facebook
Hide Seen. Facebook may temporarily show a conversation as read locally while
Seen receipts remain blocked; reloading restores its unread appearance.
Account-switch behavior
from issue #197 and independent recipient-side Seen privacy have not been
re-verified by these sending tests.

## Store versions checked before submission

| Store | Public version | Listing updated | Target version |
| --- | --- | --- | --- |
| [Chrome Web Store](https://chromewebstore.google.com/detail/flpnibonbhdmnpgflnbemgghghhblmpm) | 2.0.10 | August 29, 2026 | 2.1.0 |
| [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/mgbppdkolkeelimnemlbpmfdddhoeeal) | 2.0.10 | August 29, 2026 | 2.1.0 |
| [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/ghostify-privacy-controls/) | 2.0.10 | August 29, 2026 | 2.1.0 |

These listings were checked on October 15, 2026. A public listing does not show
unpublished submissions already pending in the owner's dashboard; confirm
there is no conflicting pending 2.1.0 upload before submitting.

## Approval and current verification

- All three stores approved 2.1.0 on October 16, 2026, confirmed by the maintainer.
- Public listings independently checked on October 17, 2026 Asia/Manila show
  version 2.1.0 on Chrome, Edge, and Firefox. Each listing displays an updated
  date of October 15; that listing date is distinct from the maintainer's
  confirmed approval date.
- The maintainer confirms all supported controls are working. This is a
  maintainer confirmation, not a new automated live privacy test.
- Canonical status dates use UTC: the October 17 Asia/Manila confirmation is
  recorded on October 16 UTC.

## Files to upload

| Destination | File |
| --- | --- |
| Chrome Web Store and Microsoft Edge Add-ons | `ghostify-v2.1.0-chrome-web-store.zip` (the same ZIP for both stores) |
| Firefox Add-ons extension upload | `ghostify-v2.1.0-firefox-add-ons.zip` |
| Firefox Add-ons source-code upload | `ghostify-v2.1.0-firefox-add-ons-source.zip` |

Each ZIP has an adjacent `.sha256` file. Retain those exact files and hashes
through review. Do not upload the Firefox source ZIP as the extension or
describe the unsigned upload ZIP as a signed public Firefox download.

Build with `npm run package:extension` and `npm run package:firefox` from the
finalized tree. The source ZIP includes `FIREFOX_REVIEW_BUILD.md`; reproduce
the Firefox upload from that archive and compare the SHA-256 before submission.

## Paste-ready release notes (all three stores)

```text
Ghostify 2.1.0

• Fixed Facebook group-chat messages getting stuck in Sending when Hide Seen is enabled, including after reloading Facebook.
• Refreshed the popup with automatic Halloween, Christmas, New Year, and Valentine's looks, plus a seasonal opening animation limited to once per day.
• Added optional quiet popup sounds, off by default. Animations respect reduced motion.
• Added Help & feedback through GitHub or a copyable email address, without opening an email-app picker.
• Improved the Facebook/Messenger Hide Seen row's click area and removed its group-chat warning badge.
```

The dated 2.1.0 section of `CHANGELOG.md` is the source for longer GitHub Release
notes. Use `node scripts/extract-release-notes.js 2.1.0` after store approval.

## Submission guidance

Use the existing store listings and update their versions. Permission and data
declarations remain aligned with `PRIVACY.md`. Optional sound is generated
locally; the extension downloads no audio and adds no analytics.

For Firefox, answer **Yes** to the source-code question and upload both Firefox
ZIPs in their respective fields. Select Firefox desktop and Firefox for Android
(minimum versions 140 and 142). Use `docs/FIREFOX_AMO_SUBMISSION.md` for listing
fields and reviewer notes. Supply any required dedicated test credentials
privately through AMO, never in source files or public release notes.

Record each store's upload time, submitted filename, checksum, review status,
and eventual approval separately. The maintainer has confirmed approval of
2.1.0 on all three stores on October 16, 2026.

## Status and publication

The public status records 2.1.0 as published and verified following the
maintainer's confirmation. It notes Facebook's temporary local read appearance
without marking Hide Seen as broken. The film, reduced-motion landing page,
status page, and popup derive their status from the same canonical record.

After Chrome Web Store approval, follow `RELEASE_CHECKLIST.md` section 11:
confirm the public version, smoke-test the installed Store build, then run
**Publish GitHub Release** on `main` with version `2.1.0`, the SHA-256 of the
exact approved Chromium ZIP, and the approval confirmation. Do not create the
tag or bypass the gated workflow. Update publication and verification records
using the actual results, and record Edge and Firefox approvals independently.
