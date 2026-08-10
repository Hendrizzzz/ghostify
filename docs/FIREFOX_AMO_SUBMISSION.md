# Firefox AMO Submission Packet

This document contains the repository-owned text for Ghostify Firefox Browser
Add-ons submissions. It supports new listings and version updates, but is not
evidence that a submitted version has been approved or is live.
Replace every **OWNER ACTION** placeholder in the private AMO form before
submitting. Never commit account credentials or private reviewer messages.

## Submission Choices

- Distribution: **On this site**
- Platform: **Firefox desktop and Firefox for Android**
- Experimental: **No**
- Requires payment, non-free service, software, or hardware: **No**
- Source code required: **Yes**
- License: **MIT License**
- Categories: **Privacy & Security** and **Social & Communication** when both
  are available in the current AMO form

## Public Listing

### Name

```text
Ghostify | Hide Seen, Typing & Story Views
```

### Summary

```text
Local privacy controls for supported Seen, typing, and story-view signals on Instagram, Facebook, and Messenger web.
```

### Description

```text
Ghostify gives you local privacy controls for supported Instagram, Facebook, and Messenger web signals.

Controls include:
• Hide Seen and supported read receipts
• Hide typing indicators
• Hide supported story-view signals

Ghostify runs inside Firefox and stores preferences locally. It does not require a Ghostify account or ask for your social-media passwords. Privacy patterns ship with the extension; no remote code or remote blocking configuration is loaded.

The Firefox popup reads Ghostify's public verification-status JSON so its date, green or yellow state, and update title stay aligned with the public status page. The privileged request uses no credentials, custom headers, query parameters, or body and does not include extension settings, tab URLs, messages, or social-media activity. Meta changes its web applications frequently, so use the latest release and report regressions through the support link.

Ghostify is an independent open-source project. It is not affiliated with, endorsed by, or sponsored by Meta Platforms, Inc., Instagram, Facebook, Messenger, Mozilla, or Firefox.
```

### Public URLs And Contact

- Homepage: `https://ghostify-extension.vercel.app/`
- Support website: `https://github.com/Hendrizzzz/Ghostify/issues/new?template=help_feedback.yml`
- Privacy policy: `https://github.com/Hendrizzzz/Ghostify/blob/main/PRIVACY.md`
- Support email: **OWNER ACTION — enter a monitored email address in AMO; do
  not use the Gecko add-on ID as an email address unless that mailbox exists.**

## Permission And Data Answers

### Data collection

Select the answer matching the manifest declaration: Ghostify for Firefox does
not collect or transmit user data. The manifest declares
`data_collection_permissions.required: ["none"]`. The popup receives a public,
non-personalized status JSON file through a privileged, credential-free HTTPS
GET with no custom headers, query parameters, or body. It does
not send extension settings, tab URLs, messages, browsing activity, website
content, identifiers, or interaction analytics.

### Permissions explanation

```text
storage: Saves Ghostify privacy-control preferences and bundled configuration locally in Firefox.

declarativeNetRequest: Registers local dynamic rules that block supported privacy-signal requests. Rules and decisions remain in Firefox.

instagram.com host access: Injects the local privacy controls on supported Instagram web pages.

facebook.com host access: Injects the local privacy controls on Facebook pages and Facebook messaging surfaces.

messenger.com host access: Injects the local privacy controls on Messenger web pages.

www.fbsbx.com host access: Covers Facebook Messenger proxy frames. Runtime guards restrict Messenger-specific behavior to supported MAW proxy pages.

ghostify-extension.vercel.app host access: Retrieves the display-only public verification-status JSON used for the popup date, green or yellow state, and update title. The privileged request uses no credentials, custom headers, query parameters, or body and does not send extension settings, tab URLs, messages, or social-media activity.
```

## Source-Code Upload

Answer **Yes** to the source-code question for every version. Upload:

```text
ghostify-vX.Y.Z-firefox-add-ons-source.zip
```

The package contains `FIREFOX_REVIEW_BUILD.md`, `package-lock.json`, source,
static assets, and build scripts. Ghostify uses esbuild 0.28.1:

- Source: `https://github.com/evanw/esbuild`
- npm: `https://www.npmjs.com/package/esbuild`

## Notes For Reviewers

Paste this into AMO's private reviewer-notes field and replace the owner action:

```text
Ghostify is a Manifest V3 extension for Firefox desktop 140 or later and Firefox for Android 142 or later. The submitted package uses background.scripts because Firefox does not run Chromium's MV3 extension service-worker declaration. The authored runtime is under src/. build.js uses esbuild 0.28.1 without minification to generate four bundles under dist/. Exact reproduction steps are in FIREFOX_REVIEW_BUILD.md in the required source archive.

Third-party build library:
Source: https://github.com/evanw/esbuild
npm package: https://www.npmjs.com/package/esbuild

The extension requests storage, declarativeNetRequest, host access for supported Instagram, Facebook, Messenger, and Facebook Messenger proxy surfaces, and ghostify-extension.vercel.app access for the display-only public status JSON. Privacy matching and settings remain local. The privileged status request uses no credentials, custom headers, query parameters, or body and sends no extension settings, tab URLs, messages, or social-media activity. It does not load remote code or remote privacy configuration. External status, homepage, and GitHub links open only after a user activates them.

Functional test outline:
1. Install on Firefox desktop 140 or later, or Firefox for Android 142 or later.
2. Open the toolbar popup and toggle the Instagram and Messenger/Facebook controls. Close and reopen the popup to confirm persistence.
3. Confirm the popup status date, color, and tooltip title match https://ghostify-extension.vercel.app/status and that clicking the pill opens that page.
4. Open an authorized Instagram, Facebook, or Messenger test account and confirm normal navigation and message loading.
5. With Hide Typing enabled, type in an authorized test conversation and verify the other participant does not receive a typing indicator.
6. With Hide Seen enabled, open a fresh authorized test message and verify sender-side Seen is not produced while messages continue to load and send.
7. With Hide Story Views enabled, view an authorized test story and verify the story owner does not receive a view signal while media remains usable.

OWNER ACTION — Provide dedicated non-personal Meta test credentials privately in this reviewer field. If dedicated credentials cannot be provided, coordinate an accepted testing alternative with the reviewer before submission. Never use personal accounts or commit credentials to the source archive.
```

## Maintainer-Only Final Checks

- Confirm the monitored support email.
- Confirm the upload version is greater than any prior AMO version.
- Upload both the extension ZIP and mandatory source ZIP.
- Select both Firefox desktop and Firefox for Android compatibility.
- Re-read the generated manifest and every AMO privacy answer.
- Do not describe the submitted version as approved or live until AMO shows
  that version as approved and live.
