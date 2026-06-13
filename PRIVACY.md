# Privacy Policy for Ghostify

**Last Updated:** June 13, 2026

## 1. Introduction
Ghostify ("we," "our," or "the Extension") is a browser extension designed to enhance user privacy on social media platforms by preventing the transmission of "read receipts," "typing indicators," and "story view" telemetry. We are committed to protecting your personal information and your right to privacy.

Ghostify does not collect or transmit any personal data to third parties. We are not affiliated with Meta Platforms, Inc.

## 2. Data Collection and Usage
**We do not collect, store, share, or sell your personal data.**

The Extension operates entirely locally on your device ("client-side"). All data processing happens within your web browser's isolated environment. No user activity, browsing history, or login credentials are transmitted to our servers or any third-party servers.

### 2.1. Permissions Justification
To function correctly, the Extension requires specific permissions:
*   **Host Permissions (`https://*.instagram.com/*`, etc.):** This is required to inject the content script that intercepts specific network requests (e.g., `mark_seen`) before they leave your browser. This interception happens locally.
*   **Storage Permission:** Used to save your preferences (e.g., "Hide Seen: ON") locally in your browser's `chrome.storage.local`.
*   **Declarative Net Request Permission:** Used to register local browser rules that block supported privacy signals without sending your data to a Ghostify server.

## 3. Configuration
The Extension uses configuration files bundled with the installed extension package.
*   **How it works:** Blocking patterns are shipped locally and updated through extension releases.
*   **Data transmitted:** No configuration fetch is made to a third-party server.

## 4. Third-Party Accounts
This Extension interacts with third-party websites (Instagram, Facebook, Messenger). We are not affiliated with Meta Platforms, Inc. The Extension does not bypass authentication or gain access to your account credentials. You are subject to the Terms of Service and Privacy Policy of the respective platforms while using them.

## 5. Changes to This Policy
We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.

## 6. Contact Us
If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact us via our [GitHub Repository](https://github.com/Hendrizzzz/Ghostify).
