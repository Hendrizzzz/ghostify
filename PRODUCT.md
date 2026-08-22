# PRODUCT.md

Product truth for Ghostify. Design decisions in [DESIGN.md](DESIGN.md) defer to
this file.

## What Ghostify is

A free, open-source browser extension that holds supported **Seen**, **Typing**,
and **Story View** signals on Instagram, Messenger, and Facebook web apps. The
user reads and browses on their own schedule; the other side does not get a
receipt. Everything runs browser-locally.

## Users

People who use Meta's web apps and want control over when their attention is
announced: readers who feel pressure to reply, people managing expectations at
work or in personal relationships. They are not necessarily technical; trust is
the product's second feature after the core controls.

## Product principles

1. **Local by default.** No accounts, no servers for settings, no telemetry of
   conversations or tab URLs. The single network call is the popup fetching a
   display-only public status JSON.
2. **Honest verification, not promises.** Coverage claims are dated and
   published (`verified` / `manual-pending` / `gap` vocabulary). The UI must
   never claim a control is working without proof; on feed failure it shows
   "Review", never "working".
3. **Fail open, never break the host page.** If Ghostify errors, Instagram /
   Facebook / Messenger must keep working. Silent `catch` blocks are intentional.
4. **Narrow scope.** Only supported Meta web surfaces; only signals the engine
   can verifiably hold. Feature requests outside this scope are declined
   (see CONTRIBUTING.md scope policy).
5. **Quiet presence.** The product recedes: small popup, restrained motion, no
   badges, no upsells inside the browsing experience.

## Surfaces

| Surface | Path | Notes |
| --- | --- | --- |
| Core engines | `src/ghost.js`, `src/messenger_patch.js`, interceptors | MAIN-world, hold signals |
| Bridge/config | `src/content.js`, `src/background.js` | ISOLATED world + DNR rules |
| Popup | `dist/popup.html/css/js` (no source dir) | 6 toggles, status pill |
| Marketing site | `site/` (React 19 + Vite) | landing + `/status` |

## Non-goals (deliberately removed — do not reintroduce)

- Local tab checker / "works here" refresh prompts (`GHOSTIFY_STATUS_CHECK`,
  `chrome.tabs.reload`) — tests forbid them.
- Labs, surveys, or any third-party survey UI.
- Red alert tones in the popup status system (green/yellow/neutral only).
- Native `title=` tooltips.
- Mobile apps (extension is web-only by definition).
