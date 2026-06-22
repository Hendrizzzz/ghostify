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

Ghostify is a Manifest V3 browser extension that helps reduce social pressure on Meta web apps. It blocks supported read receipts, typing indicators, and story-view signals locally in the browser, without requiring a Ghostify account or asking for social media passwords.

## Features

| Privacy control | Instagram | Facebook | Messenger |
| --- | :---: | :---: | :---: |
| Hide Seen / read receipts | Yes | Yes | Yes |
| Hide typing indicators | Yes | Yes | Yes |
| Hide story-view signals | Yes | Yes | Shared Facebook control |

Facebook and Messenger share the same Messenger / Facebook controls in the popup.

## Public Verification Status

Ghostify publishes a public [Verification Status](https://ghostify-extension.vercel.app/status) page for the supported web surfaces. Status entries separate local extension checks from reviewed sender-side or story-owner verification, and verified entries expire instead of staying green indefinitely.

Community reports can help downgrade or review a status, but public green verification requires maintainer review. Screenshots and recordings must be redacted, private messages should not be submitted, and public credit is opt-in only.

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

Ghostify runs locally through browser extension APIs:

- `declarativeNetRequest` rules block known privacy-related endpoints where static rules are reliable.
- Content scripts and page-context patches handle modern Meta web app behavior that cannot be covered by static rules alone.
- User settings are saved in extension storage and synced to open Instagram, Facebook, and Messenger tabs.

Ghostify does not run a tracking server and does not collect, sell, or share user activity through the extension runtime. The popup may request Ghostify's public `status.json` feed to display verification summaries; that request does not include your messages, tab URLs, settings, or social media activity.

## Privacy

Ghostify is designed to work entirely inside your browser.

It does not:

- collect your messages through Ghostify's extension runtime
- require a Ghostify account
- ask for Instagram, Facebook, or Messenger passwords
- send your browsing activity, messages, tab URLs, or settings to a Ghostify server

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Known Behavior

On `facebook.com`, Facebook may sometimes make an unread chat look read locally after you open it. That local display state is not proof that the sender received a Seen/read marker. Sender-side Seen state is the authoritative verification; refreshed Facebook/Messenger UI is only supporting context.

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
