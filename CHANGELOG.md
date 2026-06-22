# Changelog

All notable changes to Ghostify are documented here.

This changelog is the source of truth for future user-facing release notes.
Chrome Web Store notes should be short excerpts from the relevant release
section, and GitHub Releases should match the facts recorded here.

The format follows the spirit of Keep a Changelog: human-written entries,
grouped by version, with the most recent changes first.

## [Unreleased]

- No unreleased changes yet.

## [2.0.4] - 2026-06-20

### Added

- Added GitHub Actions CI for the root extension package. The workflow installs
  dependencies with `npm ci`, runs `npm test`, validates extension package
  metadata, and verifies generated `dist/` bundles are committed.
- Added workflow linting, site build checks, high-severity npm audit gates, and
  Dependabot version-update automation for GitHub Actions, extension
  dependencies, and website dependencies.
- Added `RELEASE_CHECKLIST.md` to make version synchronization, automated tests,
  manual Meta-platform smoke tests, Chrome Web Store packaging, privacy review,
  and post-release steps explicit.
- Added `ARCHITECTURE.md` documenting the Manifest V3 runtime model, build flow,
  settings/config flow, blocking strategy, platform modules, tests, and
  platform-change risks.
- Added `docs/QA_FIXTURES.md` with stable smoke-test IDs and evidence statuses
  for high-risk fixes and releases.
- Added manifest permission and host-permission drift validation to the
  extension package checks.
- Added release ZIP dry-run tooling that verifies the Chrome Web Store package
  shape and writes a SHA-256 checksum.
- Added secret scanning configuration for CI and optional local pre-commit use.
- Added this changelog so future release notes are kept in the repository before
  they are copied to Chrome Web Store and GitHub Releases.
- Added ignore rules for local-only notes and temporary release/test artifacts
  so they are not accidentally included in release changes.
- Added public Verification Status pages at `/status` and `/status/history`,
  plus a display-only `/status.json` feed for compact public status summaries.
- Added a popup Public Verification summary link to the Status page.
- Added public verification guardrails for reviewed proof, redacted screenshots,
  opt-in credit, and automation that can flag or downgrade but cannot mark a
  live feature verified.

### Changed

- Updated the extension version to `2.0.4` across package metadata,
  Manifest V3 metadata, bundled privacy patterns, generated scripts, and popup
  survey links.
- Changed the popup trust surface so public Verification is the only
  persistent trust row, while local refresh guidance appears only when a
  supported tab needs reload.
- Simplified the popup Labs vote list, aligned control label weight, and
  kept the Release 1 survey choices focused on non-content-retention ideas.
- Aligned README, website, privacy, and feedback-form copy around local
  request/payload inspection and optional external feedback forms.
- Documented the popup's display-only public status feed and clarified that it
  does not send messages, tab URLs, settings, or social media activity to
  Ghostify.
- Clarified the privacy-policy justification for the local
  `declarativeNetRequest` permission.
- Updated the website Compatibility section, footer, and FAQ to point users to
  public verification status without putting Status in the hero.

### Fixed

- Added platform-specific popup status checks so Instagram, Messenger, and
  Facebook readiness no longer passes on core hooks alone.
- Replaced unsupported issue-form upload fields with safe screenshot/video
  guidance.
- Added stale-status handling so old verified public statuses downgrade after
  their `expiresAt` value.

### Verification

- Automated: run `npm test`, `npm run validate:extension`, root/site
  high-severity audits, site build, and `npm run package:extension` before
  release.
- Manual: complete the Instagram, Messenger, and Facebook smoke matrix in
  `RELEASE_CHECKLIST.md` before Chrome Web Store upload.

### Credits

- Public user credits must only be added when the user explicitly gave
  permission.

## [2.0.3]

- Chrome Web Store maintenance release before the changelog was fully
  backfilled in the repository.

## Historical Releases

Releases before this changelog was introduced were documented separately.
Do not backfill historical changelog entries without verifying the released
version, date, package contents, and user-facing notes from the release record.
