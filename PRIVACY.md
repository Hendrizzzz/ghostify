# Privacy Policy for Ghostify

**Last Updated:** June 20, 2026

## 1. Introduction
Ghostify ("we," "our," or "the Extension") is a browser extension designed to enhance user privacy on social media platforms by preventing the transmission of "read receipts," "typing indicators," and "story view" telemetry. We are committed to protecting your personal information and your right to privacy.

Ghostify's extension runtime does not collect or transmit messages, credentials, social media content, browsing activity, tab URLs, or settings to Ghostify or to Ghostify-operated services. The popup may request Ghostify's public `status.json` feed to display verification summaries; that request is display-only and does not include extension settings, tab URLs, messages, or social media activity. We are not affiliated with Meta Platforms, Inc.

## 2. Data Collection and Usage
**Ghostify's extension runtime does not collect, store, share, or sell your personal data.**

The Extension operates entirely locally on your device ("client-side"). Ghostify transiently inspects request URLs, request payloads, and supported page or worker messages inside your browser to identify privacy signals such as read receipts, typing indicators, and story-view writes. Ghostify does not send this inspected data to a Ghostify server and does not store raw messages, credentials, browsing history, or social media content.

The popup can fetch a public verification-status JSON file from Ghostify's website so it can show whether supported features are verified, under review, stale, or unavailable. This status feed is not personalized and is not used to collect your social media activity.

### 2.1. Permissions Justification
To function correctly, the Extension requires specific permissions:
*   **Instagram host permission (`https://*.instagram.com/*`):** Required to inject local privacy controls on Instagram pages and block supported read receipt, typing, and story-view signals before they leave your browser.
*   **Messenger host permission (`https://*.messenger.com/*`):** Required to inject local privacy controls on Messenger pages and block supported read receipt, typing, and story-view signals before they leave your browser.
*   **Facebook host permission (`https://*.facebook.com/*`):** Required to inject local privacy controls on Facebook pages, including Messenger surfaces inside Facebook.
*   **Facebook Messenger proxy frame host permission (`https://www.fbsbx.com/*`):** Required for Messenger proxy frames used by Facebook. The host permission is broader than the proxy path, so Ghostify limits Messenger-specific runtime behavior to supported Messenger proxy pages.
*   **Storage permission (`storage`):** Used to save your preferences (e.g., "Hide Seen: ON") and cached bundled configuration locally in your browser's `chrome.storage.local`.
*   **Declarative Net Request permission (`declarativeNetRequest`):** Used to register local browser rules that block supported privacy signals without sending your data to a Ghostify server.

### 2.2. Chrome Web Store Limited Use
Ghostify uses handled data only to provide or improve its single purpose: blocking supported read receipts, typing indicators, and story-view signals in your browser. Ghostify does not transfer, sell, or use user data for advertising, credit, or unrelated purposes. Ghostify's use of information received through Chrome extension APIs and supported website surfaces adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## 3. Configuration
The Extension uses configuration files bundled with the installed extension package.
*   **How it works:** Blocking patterns are shipped locally and updated through extension releases.
*   **Data transmitted:** No blocking-pattern configuration fetch is made to a third-party server. The separate public status feed described above is display-only and does not configure privacy blocking behavior.

## 4. Voluntary Feedback and Verification Reports
The extension may link to GitHub issue forms or Tally forms for optional feedback, feature surveys, bug reports, and public verification reports. Those pages open outside the extension runtime and are governed by the privacy practices of GitHub or Tally. Do not submit private messages, credentials, or account-sensitive details in feedback forms.

Verification evidence is reviewed before it can affect public green status. Screenshots or recordings should be redacted before submission, and public contributor credit is used only when the reporter explicitly opts in.

## 5. Third-Party Accounts
This Extension interacts with third-party websites (Instagram, Facebook, Messenger). We are not affiliated with Meta Platforms, Inc. The Extension does not bypass authentication or gain access to your account credentials. You are subject to the Terms of Service and Privacy Policy of the respective platforms while using them.

## 6. Changes to This Policy
We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.

## 7. Contact Us
If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact us via our [GitHub Repository](https://github.com/Hendrizzzz/Ghostify).
