# Ghostify 2.1.1 release preparation

Prepared October 26, 2026, Asia/Manila. Release owner: Hendrizzzz.

## Scope and maintainer confirmation

This patch includes the encrypted Messenger history-loading correction for
issue 259 and the Facebook local unread-indicator correction. The existing
issue 145 pre-enqueue receipt guard remains intact. See
`ISSUE_259_VERIFICATION.md` and `FACEBOOK_UNREAD_VERIFICATION.md` for evidence.

The maintainer confirmed basic normal-use checks across all supported features
in Chrome, Brave, and Firefox, including the Firefox Add-ons build, and
authorized shipping. Targeted Chrome/Brave checks and automated regressions
provide additional evidence. Zen confirmation and the exact issue 197
account-switch sequence remain pending.

The canonical status history uses UTC dates: this confirmation is October 26
in Asia/Manila and October 25 UTC. Related 2.1.1 rollout updates are grouped in
one release entry, with the testing record kept separate.

## Publication state before store submission

- Chrome Web Store: 2.1.0, listing updated October 15, 2026.
- Latest GitHub Release: v2.1.0, published October 17, 2026 Asia/Manila
  (October 16 UTC).
- Firefox Add-ons: 2.1.0, checked through the public AMO API.
- Microsoft Edge Add-ons: the public page was reachable, but its current
  version was not independently extracted during this preparation.
- Target package/source version: 2.1.1. All version identities are synchronized.
- No 2.1.1 store upload, submission, approval, tag, or GitHub Release is claimed.

## Store update: October 26, 2026 Asia/Manila

The public Chrome Web Store listing and Firefox Add-ons API both show 2.1.1,
confirmed October 26 Asia/Manila (October 25 UTC). The owner also confirmed
basic checks using the Firefox Add-ons version. Edge's update state has not
been confirmed.

The public status groups Chrome and Firefox availability in one release entry.
When Edge is confirmed, update that same entry. Chrome approval now satisfies
the GitHub Release gate; use the existing workflow with the exact uploaded
Chromium ZIP checksum:

```text
527e9ca664f8af2231dc09b19a32b8e30ecbc7a79701726b322e42eda5d1e23c
```

The uploaded artifacts and their saved checksums remain unchanged.

## Package and submission handoff

Run the gates and deterministic packagers from the merged release-preparation
commit, following `RELEASE_CHECKLIST.md` and `FIREFOX_RELEASE_CHECKLIST.md`:

```sh
npm ci
npm run ci
npm run package:extension
npm run package:firefox
```

The Chromium ZIP serves Chrome and Edge as independent store submissions.
The Firefox upload ZIP and reviewer source ZIP must both be supplied to AMO;
the raw upload ZIP is not a Mozilla-signed installable XPI. Keep ZIPs and SHA-256
sidecars outside Git. Preserve the checksum of each exact uploaded artifact.

### Store release notes

Fixed Messenger chats not loading with Hide Typing enabled. Facebook's unread
indicators now remain visible when opening chats with Hide Seen enabled.
Mark as read and normal message sending continue to work.

All supported features were tested during normal use, with no issues found.

### Reviewer checks

1. Enable Hide Typing and Hide Seen. Load an encrypted Messenger conversation,
   switch conversations, and send a normal message.
2. On Facebook messages and feed mini-chat, open an unread conversation. Its
   local unread styling should remain, and the other account should receive no
   Seen or typing signal while protection is enabled.
3. Use explicit Mark as read, then send another message. Local unread styling
   should clear; the receipt must remain suppressed and sending must complete.
4. Disable Hide Seen and confirm automatic local reads remain native. Restore
   the privacy settings after testing.

## After store approval

Record each channel's actual approved version and date separately. After Chrome
Web Store 2.1.1 is approved and live, verify the installed store build, update
the canonical publication/status record, and run `Publish GitHub Release` on
main with version `2.1.1`, approval confirmed, and the SHA-256 of the exact
approved Chromium ZIP. Do not create the tag manually or claim approval before
the store confirms it.
