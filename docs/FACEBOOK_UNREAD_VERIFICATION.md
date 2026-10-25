# Facebook local unread indicators

Date: 2026-10-26 (Asia/Manila). Source build: 2.1.1 release candidate.

## Confirmed cause

The published status note describes a local display limitation: opening a
Facebook conversation can clear its bold text and blue unread dot while outgoing
Seen receipts remain blocked. This is separate from a false Seen label below an
outgoing message.

The native `LSOptimisticMarkThreadReadV2` consumer calls `LSMarkThreadRead`, which
advances the local read watermark and clears the unread count, then enqueues the
receipt task. The existing issue 145 fix correctly suppresses that enqueue
before it enters the persistent send queue, while preserving local changes.
A live baseline trace confirmed the local mutation and disappearing dot.

## Implementation

Inside only the top-frame Facebook `useMWPSafelyMarkThreadAsRead` consumer,
guard the deferred read callback passed to
`useMWMarkThreadAsReadWhenNewMessagesArrive`. Execute the native React hook on
every call and preserve its return value, receiver, other argument identities,
and metadata.
Cache callback wrappers to preserve memoization identity across renders.

With Hide Seen enabled, the automatic callback stops before local or parent
read state changes and before a receipt is created. Explicit Mark as read uses
the native transaction and the existing pre-enqueue receipt guard. Settings-off,
kill-switch, request-route, and native request-grace behavior remains native.
Unknown non-function callback shapes pass through. The shared hook export and
lookalike consumers remain untouched.

## Verification

| Scenario | Status | Evidence |
| --- | --- | --- |
| Baseline | verified | The native local read leaf ran after opening a controlled unread chat, and the blue dot disappeared while the receipt enqueue was suppressed. |
| Automatic read callback | verified | New regression fails against the original bundle and passes with the rebuilt candidate. Local and parent read mutations and receipt enqueue stay absent during automatic reads. |
| React hook safety | verified | Native hooks execute, preserve their return values/receivers/arguments, retain stable wrapped callbacks, and receive native sibling dependencies. |
| Manual read and send queue | verified | The regression preserves manual local updates and suppresses receipt enqueue; following sends progress. |
| Toggles and bypasses | verified | Settings-off, kill-switch, request routes, and native request grace execute the native callback. Protection resumes after grace expiry. |
| Scope | verified | The shared hook module and lookalike consumers keep native factories; existing Messenger, proxy, worker, and typing regressions pass. |
| Full repository CI | verified | `npm run ci` passes, including both browser package checks, Firefox lint, tag integrity, bundle consistency, and governed dependency audit. |
| Live full-page Facebook | verified | After the user reloaded the unpacked extension and the test pages were refreshed, encrypted history and composer loaded. The target row retained one native blue dot and font weight 600 after reload and conversation switching. |
| Live manual Mark as read | verified | The native menu changed from Mark as read to a read row and the blue dot cleared. The next protected reply arrived on the independent Brave account on facebook.com. The sender retained its old Seen timestamp rather than a receipt for the new probe. |
| Draft preservation | verified | After the extension reload, a temporary draft survived switching to self-chat and back. The dot and bold name remained; the draft was cleared afterward. |
| Feed mini-chat | verified | Opening the unread mini-chat preserved its dot. A new controlled incoming message arrived while it was open, and the popover still showed Unread message, one blue dot, and font weight 600. Explicit marking cleared it and the following reply delivered. |
| Brave Chats popover | verified | The screenshot account was still running its existing local 2.0.10 copy. Computer Use reloaded that copy to 2.1.1; all six switches were ON. Opening its mini-chat retained the popover's blue dot and bold name. The automatic-read counter advanced while the receipt-enqueue counter remained zero. A fresh message independently arrived from Chrome and stayed unread while Chrome showed Sent. |
| Brave explicit read and following send | verified | Explicit Mark as read advanced the blocked receipt-enqueue counter from zero to one. The following protected reply reached Sent and independently arrived in Chrome, preserving the #145 pre-enqueue behavior. |
| Live settings control | verified (page-only) | Temporarily disabling msgSeen in the controlled Brave page allowed the native unread dot to clear. Restoring it, marking the test chat unread, and reopening preserved the dot again; the automatic-read counter advanced. All six switches were restored to ON. This control checked local unread behavior; the wider privacy positive controls are in the issue 259 report. |
| Live group unread styling and send | verified (bounded) | An authorized group marked locally unread retained its dot through switching away and reopening. Explicit Mark as read remained available. A subsequent labeled test message reached Sent. This is a sender-side acknowledgement, not independent confirmation from a group recipient. The complete group/browser matrix was not repeated. |
| Live runtime diagnostics | verified (bounded) | Chrome's tested full-page and mini-chat tabs reported no error-level console entries. Brave's feed reported procedural filter errors with matches-path/has-text selectors; those literals are absent from all 27 Ghostify source/package JS files checked. Their precise external source was not established. Chrome's retained extension diagnostics concerned Instagram unload/CSP warnings in the unchanged ghost.js bundle. Those unrelated diagnostics were not cleared or changed. |
| Firefox basic checks | maintainer-confirmed (basic) | The maintainer reports that basic checks across all features passed using Firefox and the Firefox Add-ons build. The agent did not repeat its full targeted Chrome/Brave matrix in Firefox. |
| Zen-specific checks | manual-pending | No Zen-specific result has been confirmed. |

The earlier mini-chat failure was observed before confirming that Chrome had
registered the rebuilt content script; it is not evidence against this candidate.
The final Chrome live checks above followed the user's explicit extension reload;
Brave's local copy was subsequently reloaded with the user's authorized Computer
Use workflow. Raw CDP diagnostics remained unavailable for Chrome. Brave provided
the additional runtime-counter evidence alongside visible UI, DOM styling, and
the independent recipient account. Seen/Typing positive controls and the wider #145,
#197, and #259 checks are recorded in `ISSUE_259_VERIFICATION.md`; this follow-up
repeated the affected Facebook flows rather than claiming a new complete live
Instagram/Messenger/story matrix. The Brave page-only control additionally
confirmed native local-read behavior with Hide Seen disabled; request and
kill-switch bypasses are covered by the automated regression.

Only authorized test accounts are used for the new live messages. The published
store status and its historical local-display limitation remain unchanged until
a separate release and verification update. Account-specific captures remain in
ignored `tmp/`, outside Git. This follow-up was developed on
`fix/facebook-unread-indicators` and is included in the 2.1.1 release preparation.
See `RELEASE_2_1_1.md` for the maintainer's subsequent smoke-test confirmation and
the distinction between package readiness and store publication.
