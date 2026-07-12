# Ghostify

<div align="center">

Privacy controls for Instagram, Facebook, and Messenger web.

[Website](https://ghostify-extension.vercel.app) |
[Status](https://ghostify-extension.vercel.app/status) |
[Chrome Web Store](https://chromewebstore.google.com/detail/flpnibonbhdmnpgflnbemgghghhblmpm) |
[Help & feedback](https://github.com/Hendrizzzz/Ghostify/issues/new?template=help_feedback.yml)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/flpnibonbhdmnpgflnbemgghghhblmpm?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/flpnibonbhdmnpgflnbemgghghhblmpm)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-16a34a)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![License: MIT](https://img.shields.io/github/license/Hendrizzzz/Ghostify)](LICENSE)

</div>

Ghostify is a Manifest V3 browser extension that helps reduce social pressure on Meta web apps. Its privacy controls block supported read receipts, typing indicators, and story-view signals locally in the browser, without requiring a Ghostify account or asking for social media passwords.

## Features

| Privacy control | Instagram | Facebook | Messenger |
| --- | :---: | :---: | :---: |
| Hide Seen / read receipts | Yes | Yes | Yes |
| Hide typing indicators | Yes | Yes | Yes |
| Hide story-view signals | Yes | Yes | Shared Facebook control |

Facebook and Messenger share the same Messenger / Facebook controls in the popup.

## Public Verification Status

Ghostify publishes a public [Verification Status](https://ghostify-extension.vercel.app/status) page for the supported web surfaces. The latest merged maintainer update remains authoritative until a newer status PR is merged; age alone never changes green to yellow.

Community reports can help downgrade or review a status, but public green verification requires maintainer review. Screenshots and recordings must be redacted, private messages should not be submitted, and public credit is opt-in only.

The popup follows the latest dated status record. A working record shows a green
dot with its month and day, regardless of how old that date is. A report,
confirmed issue, work-in-progress, or review record shows a yellow dot with that record's month
and day. A scheduled workflow can prepare a daily verification PR, but it does
not publish green automatically; merging the PR is the maintainer's explicit
confirmation after completing the linked smoke checklist.
The workflow refreshes one pending daily PR instead of creating duplicates, so an unmerged proposal never changes the live website or popup.
Installed popups receive JSON-only status updates after the status-capable
extension build and its website host permission have first been published
through the Chrome Web Store.

## Install

### Chrome Web Store

Install Ghostify from the [Chrome Web Store](https://chromewebstore.google.com/detail/flpnibonbhdmnpgflnbemgghghhblmpm).

### Manual install

1. Clone or download this repository.
2. Run `npm install`.
3. Run `npm run build`.
4. Open `chrome://extensions` in Chrome or a Chromium-based browser.
5. Enable Developer mode.
6. Click Load unpacked and select the `dist/` folder.

## Latest Release

Use the Chrome Web Store badge above for the current published version. GitHub
[Releases](https://github.com/Hendrizzzz/Ghostify/releases) contain source
release notes when a matching GitHub release has been published.

## How It Works

Ghostify's privacy controls run locally through browser extension APIs:

- `declarativeNetRequest` rules block known privacy-related endpoints where static rules are reliable.
- Content scripts and page-context patches handle modern Meta web app behavior that cannot be covered by static rules alone.
- User settings are saved in extension storage and synced to open Instagram, Facebook, and Messenger tabs.

Ghostify does not run a tracking server for extension activity and does not collect, sell, or share user activity through the extension runtime. The popup may request Ghostify's public `status.json` feed to display verification summaries; that request does not include your messages, tab URLs, settings, or social media activity.

## Privacy

Ghostify's privacy controls are designed to work inside your browser.

It does not:

- collect your messages through Ghostify's extension runtime
- require a Ghostify account for these privacy controls
- ask for Instagram, Facebook, or Messenger passwords
- send your browsing activity, messages, tab URLs, or settings to a Ghostify server

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Known Behavior

Facebook’s unread UI bug is fixed. If an unread chat still gets marked as read
with Hide Seen on, let us know.

Meta changes Instagram, Facebook, and Messenger often. If something stops working, update Ghostify to the latest version, reload the affected tab, and report it if the issue continues.

## Development

Requirements:

- Node.js
- npm

Commands:

```bash
npm install
npm run build
npm test
npm run ci
```

`npm run build` compiles the extension into `dist/`, which is the folder loaded by Chrome.
`npm test` rebuilds generated extension bundles and runs the regression harness.
`npm run ci` is the PR-ready check: tests, extension package validation,
generated bundle drift check, and high-severity dependency audit.

## Project Structure

```text
Ghostify/
|-- src/                  Source modules and platform logic
|-- dist/                 Built extension loaded by the browser
|-- test/                 Regression tests
|-- docs/                 QA fixtures and maintainer references
|-- site/                 Public website
|-- build.js              ESBuild build script
|-- CONTRIBUTING.md       Contribution guide
|-- PRIVACY.md            Privacy policy
`-- README.md             Project overview
```

## Feedback and Issues

Found a bug, have an idea, want to share feedback, or need to ask a question?

Use the guided form: [Help & feedback](https://github.com/Hendrizzzz/Ghostify/issues/new?template=help_feedback.yml)

Screenshots or short screen recordings are welcome when they help explain the issue, but do not include private messages, credentials, or account-sensitive details. Helpful confirmed reports can be credited in Ghostify release notes and on the website, with permission.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for reporting bugs, suggesting features, and submitting code.

## Disclaimer

Ghostify is an independent open-source project. It is not affiliated with, endorsed by, or sponsored by Meta Platforms, Inc., Instagram, Facebook, or Messenger.

Use this extension at your own discretion and follow the terms of the platforms you use.

## License

Ghostify is distributed under the [MIT License](LICENSE).
