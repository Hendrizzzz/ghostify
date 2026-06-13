# Ghostify

<div align="center">

Privacy controls for Instagram, Facebook, and Messenger web.

[Website](https://ghostify-extension.vercel.app) |
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
| Hide story-view signals | Yes | Yes | Yes |

Facebook and Messenger share the same Messenger / Facebook controls in the popup.

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

Use the Chrome Web Store badge above or [Releases](https://github.com/Hendrizzzz/Ghostify/releases) for the current published version and release notes.

## How It Works

Ghostify runs locally through browser extension APIs:

- `declarativeNetRequest` rules block known privacy-related endpoints where static rules are reliable.
- Content scripts and page-context patches handle modern Meta web app behavior that cannot be covered by static rules alone.
- User settings are saved in extension storage and synced to open Instagram, Facebook, and Messenger tabs.

Ghostify does not run a tracking server and does not collect, sell, or share user activity.

## Privacy

Ghostify is designed to work entirely inside your browser.

It does not:

- collect your messages
- require a Ghostify account
- ask for Instagram, Facebook, or Messenger passwords
- send your browsing activity to a Ghostify server

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Known Behavior

On `facebook.com`, Facebook may sometimes make an unread chat look read locally after you open it. Ghostify still blocks the Seen/read receipt signal. Refreshing Facebook or checking Messenger can confirm that the chat remains unread.

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

Screenshots or short screen recordings are welcome when they help explain the issue. Helpful confirmed reports can be credited in Ghostify release notes and on the website, with permission.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for reporting bugs, suggesting features, and submitting code.

## Disclaimer

Ghostify is an independent open-source project. It is not affiliated with, endorsed by, or sponsored by Meta Platforms, Inc., Instagram, Facebook, or Messenger.

Use this extension at your own discretion and follow the terms of the platforms you use.

## License

Ghostify is distributed under the [MIT License](LICENSE).
