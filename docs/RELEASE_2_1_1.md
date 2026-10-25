# Ghostify 2.1.1 release preparation

Prepared October 26, 2026, Asia/Manila. Release owner: Hendrizzzz.

## Scope and maintainer confirmation

This patch includes the encrypted Messenger history-loading correction for
issue 259 and the Facebook local unread-indicator correction. The existing
issue 145 pre-enqueue receipt guard remains intact. See
`ISSUE_259_VERIFICATION.md` and `FACEBOOK_UNREAD_VERIFICATION.md` for evidence.

The maintainer confirmed in this task that all supported features worked in
their own normal-use testing and authorized shipping. This is a general manual
smoke check, not exhaustive testing of every browser, account, conversation,
instance, or case. It supplements the targeted Chrome/Brave and automated
regressions; it does not establish live Firefox/Zen or the exact issue 197
account-switch sequence as verified.

The canonical status history uses UTC dates: this confirmation is October 26
in Asia/Manila and October 25 UTC. Historical status records remain unchanged.
The public note identifies the tested 2.1.1 candidate separately from the
published store build; it does not declare a new store version live.

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

The owner submitted 2.1.1 to Firefox and Chrome. The public Firefox Add-ons API
now lists 2.1.1 (updated October 26 Asia/Manila, October 25 UTC). The owner
clarified that Chrome is submitted and under review, and its public listing
still shows 2.1.0. Edge's update state has not been confirmed.

The public status now describes that rollout in everyday English. The GitHub
Release remains at v2.1.0 until Chrome approval and availability satisfy the
existing release workflow. The uploaded artifacts and their saved checksums
have not been replaced by these wording changes.

The owner will upload these artifacts and submit them to all three stores.
Keep package readiness separate from store submission and approval, and follow
the repository's store-approval release gate for the GitHub Release.

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

Fixed encrypted Messenger conversations failing to load with Hide Typing on.
Facebook now keeps local unread dots and bold chat names with Hide Seen on.
Seen/Typing protection and normal message sending remain supported. The
maintainer checked all supported features in normal use and found no issues;
this was not an exhaustive check of every possible case.

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
