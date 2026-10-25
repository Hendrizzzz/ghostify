# Issue 259 verification

Date: 2026-10-26. Base: the current 2.1.0 release on `main`.

## Cause and relationship to PR 246

Ghostify classified `MAWBridgeTypingIndicatorSenderId` as an outgoing typing
module because its name contains both `typing` and `send` (inside `Sender`).
Its export matcher also treated any function containing `typingindicator` as
an outgoing operation. With Hide Typing enabled, the wrapped
`normalizeTypingIndicatorSenderId` returned `undefined`.

Meta's native helper converts a sender string to an I64 identifier. The native
`MAWBridgeNewMsgHandler` uses this helper when inserting encrypted messages,
including history, into the local database. Suppressing the conversion breaks
history hydration and produces the reported “Couldn’t load chat” screen.
`MAWBridgeReceivedChatStateHandler` also uses the same conversion.

This was reproduced on Chrome with Web Store Ghostify 2.1.0 and all six privacy
controls enabled. A debugger trace identified the suppressed helper and its
native history consumer. The normalized SHA-256 of the installed patch bundle
matched `main`:
`2402b6f4c65f22f8b5546904fa5380fc2cf34ff24c855ab10fca997c68196562`.

The new encrypted-hydration regression fails against both `6029f16^` and
`6029f16`, and passes with this fix. PR 246 did not introduce this defect.
Its Facebook-only receipt-task interception remains intact. The evidence does
not establish when Meta started exercising the affected helper on this account.

## Change

Require a send operation preceding typing, or the existing explicit chat-state
send operation, when selecting typing dependencies and exports. Use the same
predicate for both paths. Keep ID normalization and incoming/query helpers
native, including when they share a module with actual typing send exports.

The tests cover encrypted hydration with Hide Typing on and off across
Messenger, Facebook, and the MAW proxy; native helper identity, receiver and
return value; and six outgoing module naming forms across Messenger and the
proxy. Outgoing typing calls remain suppressed while enabled, and retain native
return values and `this` after disabling the toggle. Rebuild the tracked bundle.

A separate development-dependency change advances only `undici` from 7.30.0 to
7.30.1 in the lockfile. This clears a newly reported audit failure without
extending the existing exception policy. There are no runtime dependencies.

## Automated evidence

| Check | Status | Evidence |
| --- | --- | --- |
| Original defect | verified | New fixture fails against the pre-246 and merged-246 bundles and the unmodified starting bundle. |
| Fixed hydration and typing selection | verified | Both new regression matrices pass against the rebuilt bundle. |
| Existing messaging/privacy regressions | verified | Full send-stability harness passes, including mixed batches, workers, transferables, requests, settings, and Instagram guards. |
| Issue 145 queue fix | verified | Existing tests preserve local read work, suppress only the receipt enqueue, complete the native transaction, and keep subsequent sends moving. |
| Full repository gate | verified | `npm run ci` passes on the 2.1.0 base, including package tests, both browser validators, tag integrity, bundle consistency, Firefox lint, and governed dependency audit. |
| Runtime dependency audit | verified | `npm run audit:runtime` reports zero vulnerabilities. |
| JavaScript lint | verified | ESLint passes for all 57 tracked JavaScript files. |
| Changed-file formatting | verified | Prettier passes for the changed source, regression tests, and lockfile. |

Whole-workspace `npm run lint` and `npm run format:check` also inspect existing
local generated/tooling files and checkout line endings. Those broad commands
reported existing issues. These files were preserved; they are not part of the
fix. Firefox package lint reported zero errors, notices, or warnings.

## Live evidence and remaining checks

Live checks use the Codex Desktop Browser harness. The Web Store copy was
disabled by the user before loading the local build. All six privacy controls
remained enabled in the protected Chrome session.

| Scenario | Status | Evidence |
| --- | --- | --- |
| Previously failing Messenger encrypted conversation | verified | The error disappears with the local fix; history and the composer render. |
| Facebook encrypted conversation | verified | History and the composer render without the chat-loading error. |
| Native helper versus outgoing typing entry points | verified | Live I64 normalization returns a two-part ID and is unwrapped; both `LSSendTypingIndicator` entry points remain wrapped and suppressed with counter increments. |
| Messenger delivery | verified | Authorized self-chat and group test messages were submitted; group acknowledgements reached Sent. |
| Facebook group delivery | verified | Group messages were submitted from Facebook to each of the three authorized conversations, with all protections enabled. Sent/Seen acknowledgements and fresh-history checks confirm the messages left Sending. |
| Independent Messenger typing | verified | A second account in Brave showed the native typing indicator with Hide Typing temporarily disabled in the protected page. After restoring it and letting the indicator expire, further typing produced no remote indicator and incremented blocked-worker counters. |
| Independent Messenger Seen | verified | A controlled incoming message stayed unacknowledged while rendered in the protected page. Temporarily disabling Hide Seen in that page produced a remote Seen marker. After restoring protection, a fresh incoming message could be read and replied to without advancing the remote Seen marker. |
| Facebook privacy and receipt queue | verified | A fresh controlled incoming message rendered in Facebook. Reading and replying produced no remote Seen update. Explicit Mark as read updated local unread state and incremented the blocked receipt-enqueue counter; the next send arrived in the independent account. Typing in the protected Facebook composer produced no observed remote typing indicator. |
| Alternate-account messaging | verified | Both signed-in accounts successfully sent and received controlled test messages across Chrome and Brave with privacy enabled. |
| Exact issue 197 account-switch sequence | manual-pending | Separate signed-in browser accounts do not reproduce switching accounts within one session; no claim is made that issue 197 is fully resolved. |
| Zen/Firefox live encrypted-chat session | manual-pending | No live session was exercised; the user elected to continue with Chrome and Brave. Firefox packaging and shared-runtime tests pass. |
| Instagram/story/media live smoke | manual-pending | Covered by existing automated regressions; live accounts and complete smoke scenarios have not been exercised for this patch. |

The positive controls changed only the current test page's in-memory settings,
using the existing settings bridge. All six protections were restored afterward;
persistent extension preferences were not changed. The two-account probes used
only the user's authorized test accounts. Group messages were sent only to the
three conversations explicitly authorized by the user.

Do not treat entry-point suppression, sender-side counters, or the absence of a
network event in the main frame as independent recipient-side privacy proof.
Keep account-specific screenshots and captures outside Git. Release publication
remains a separate maintainer action after additional live testing.
