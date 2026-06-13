# Changelog

All notable changes to Ghostify are documented here.

This changelog is the source of truth for future user-facing release notes.
Chrome Web Store notes should be short excerpts from the relevant release
section, and GitHub Releases should match the facts recorded here.

The format follows the spirit of Keep a Changelog: human-written entries,
grouped by version, with the most recent changes first.

## [Unreleased]

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

### Changed

- Clarified the privacy-policy justification for the local
  `declarativeNetRequest` permission.

### Verification

- Automated: run `npm run ci` and `npm run package:extension` before release.
- Manual: complete the Instagram, Messenger, and Facebook smoke matrix in
  `RELEASE_CHECKLIST.md` before Chrome Web Store upload.

### Credits

- Public user credits must only be added when the user explicitly gave
  permission.

## Historical Releases

Releases before this changelog was introduced were documented in
[GitHub Releases](https://github.com/Hendrizzzz/Ghostify/releases). Do not
backfill historical changelog entries without verifying the released version,
date, package contents, and user-facing notes from the release record.
