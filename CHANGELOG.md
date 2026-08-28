# Changelog

All notable changes to Ghostify are documented here.

This changelog is the source of truth for future user-facing release notes.
Chrome Web Store notes should be short excerpts from the relevant release
section, and GitHub Releases should match the facts recorded here.

The format follows the spirit of Keep a Changelog: human-written entries,
grouped by version, with the most recent changes first.

## [2.0.9] - 2026-08-29

### Added

- Added a compact popup warning beside Facebook/Messenger Hide Seen for the
  known Facebook.com group-chat sending issue, with a workaround to use
  messenger.com or turn Hide Seen off and refresh.

## [2.0.8] - 2026-08-23

### Added

- Added agent and design context documents (`AGENTS.md`, `PRODUCT.md`,
  `DESIGN.md`), a pull-request template, a Code of Conduct, and a support
  guide, plus a README documentation index.
- Added ESLint, Prettier, and EditorConfig for the extension sources with a
  matching CI lint gate, and TypeScript checking for the website build.

### Changed

- Made the whole popup row clickable for each privacy toggle instead of only
  the small switch track, kept the visible labels programmatically associated
  with their switches, and announced public status updates politely to screen
  readers.
- Wired the bundled Uncut Sans typeface into the website so headlines no longer
  depend on operating-system fonts, tokenized the repeated section gutters,
  strengthened muted-text contrast, restored visible page scrollbars, and
  removed forced single-line headings.
- Deferred loading of the large feature demo recordings until visitors scroll
  near them instead of prefetching all three on page load, and added an error
  boundary around the website app.
- Added social preview metadata (generated og image, Twitter card summary,
  structured SoftwareApplication and FAQ data), robots.txt, and a sitemap for
  the website.

### Fixed

- Fixed the public status pill in the popup looking identical when the status
  feed was unavailable by giving the fallback state a dashed border and dimmed
  indicator dot.
- Restricted the extension's configuration bridge to post to the page's own
  origin, shared the duplicated diagnostic version constant, and removed dead
  helper functions without changing interception behavior.
- Removed roughly 1,250 lines of unused legacy website styles left over from
  the previous design generation and fixed two latent website type errors.

## [2.0.7] - 2026-08-11

### Added

- Added captured WebLite regression coverage for Facebook mobile story views,
  including explicit fail-open cases for unrelated story traffic.

### Fixed

- Fixed Facebook group messages that could remain stuck in Sending when Meta
  bundled queue-routed sends with typing or Seen metadata. Ghostify now
  preserves the message and exact routing identifiers while removing only the
  blocked privacy metadata.
- Added a narrowly scoped Firefox Android block for the captured Facebook
  mobile-site WebLite story-view receipt while preserving story navigation,
  media playback, and visibility telemetry. Packaged-emulator checks covered
  the captured Facebook and Instagram mobile privacy paths on Firefox Android.
- Corrected the Chromium 48px icon asset and routed the popup rating link to
  Microsoft Edge Add-ons when Ghostify runs in Edge.
- Aligned the Firefox release and reviewer documents with the package's Firefox
  desktop and Firefox for Android compatibility declarations.

## [2.0.6] - 2026-07-22

### Added

- Added an explicit Chrome Web Store artifact confirmation to the maintainer's
  live-verification checklist so an unpacked development build cannot be
  mistaken for the published package.
- Added Firefox desktop package preparation, validation, linting, deterministic
  extension and reviewer-source archives, and AMO submission documentation.
- Added maintainer ownership, private vulnerability reporting, and threat-model
  documentation for the project's security and release boundaries.

### Changed

- Changed daily verification into one Store-version-specific, refreshable pull
  request: merging remains an explicit maintainer attestation, while Store
  publication or public-status changes immediately refresh the proposal.
- Added a one-checkbox path when every live check passes, while retaining the
  detailed matrix for recording individual failures without publishing a
  misleading green status.
- Split daily status validation from proposal publishing so third-party build
  dependencies run with read-only repository access, and bot-created proposals
  explicitly approve required pull-request CI for their exact commit.
- Kept status-only verification pull requests mergeable when an unrelated
  development-tool advisory appears: runtime audits and all functional package
  checks remain blocking, while complete dependency audits remain blocking for
  other changes and run on a separate schedule.
- Advanced the repository package identity to `2.0.6` so changes made after
  the published `2.0.5` tag cannot produce a second, different `2.0.5` ZIP.
- Replaced the legacy persisted configuration path with packaged,
  version-checked configuration and restricted page-bridge inputs to known
  settings and runtime pattern keys.
- Strengthened release checks with deterministic cross-platform ZIP output,
  exact approved-artifact hash matching, pinned Firefox tooling, dependency
  audits, and deploy-time website security headers.
- Reworked the website's privacy and verification evidence to link directly to
  public project records.

### Fixed

- Kept daily verification proposals available across app-version changes and
  yellow public states, targeting the recorded Store build without changing the
  public status until the maintainer merges the completed checklist.
- Made GitHub CLI operations repository-explicit so proposal maintenance still
  works in write-only jobs that intentionally do not check out repository code.
- Preserved queue-routed Facebook group-message sends while removing bundled
  typing and Seen metadata, preventing affected messages from remaining stuck
  in the Sending state.
- Updated the Firefox development toolchain to the patched `shell-quote`
  release. Complete dependency reviews remain visible on daily proposals,
  website runtime advisories block proposal creation, and required pull-request
  CI keeps runtime advisories blocking while performing complete reviews on
  non-status changes.
- Updated the development toolchain to patched `brace-expansion` `1.1.18` and
  removed its temporary audit allowance now that a compatible remediation is
  available; complete high-severity audits again use npm's native blocking
  result.
- Replaced production-shaped conversation labels and identifiers in Messenger
  regression fixtures with clearly synthetic values.
- Separated the published verification target from the repository version so
  reviewed status updates can remain accurate without requiring an extension
  release, and product-update history no longer overrides popup verification.
- Removed the redundant Chrome Web Store link and version-mismatch warning from
  the status summary card; the header remains the single installation action.

## [2.0.5] - 2026-07-17

### Added

- Added a discreet popup link that takes users directly to Ghostify's Chrome
  Web Store reviews page.
- Added a guarded manual GitHub Release workflow that validates the approved
  Store version, reruns CI, rebuilds the release package, extracts matching
  changelog notes, creates the version tag, and publishes the ZIP and checksum.

### Changed

- Refined the popup branding, status presentation, control icons, platform
  links, and footer spacing for a calmer and more legible layout.
- Balanced short, medium, and long tooltip text within the compact popup while
  keeping status details above the controls.
- Added a Pin Ghostify step to the website installation guide and tightened its
  desktop spacing.

### Fixed

- Prevented duplicate public-status history entries during repeated proposals.
- Removed unnecessary platform-link hover motion and corrected the Facebook
  icon's optical size.
- Prevented long popup tooltips from overflowing or leaving one-sided empty
  space at the supported popup width.

## [2.0.4] - 2026-07-14

### Added

- Added a daily GitHub Actions workflow that proposes dated public verification
  updates in a pull request for explicit maintainer approval.
- Added a manual known-issue mode that can propose a yellow popup status for
  selected supported controls without exposing raw reports in the extension.
- Added report and work-in-progress status modes and a single refreshable daily
  verification PR for explicit maintainer approval.
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

- Restored the popup to the focused privacy-control layout by removing Labs and
  the feature survey.
- Simplified popup status to the latest dated status record: green for working,
  or yellow for reports, confirmed issues, and review states.
- Made the latest merged status authoritative indefinitely and consolidated the
  website and popup feed onto one canonical committed JSON source.
- Added the exact website host permission required for the popup's status fetch
  and kept green verification blocked until the published Store build matches.
- Redesigned the popup with a low-glare dark palette, clearer control grouping,
  calmer active states, and improved text and icon contrast.
- Removed the outdated Facebook Hide Seen information tooltip so the control
  remains focused and uncluttered.
- Added a delayed status-pill description sourced from the latest public status
  title, without repeating the compact verification date.
- Updated the extension version to `2.0.4` across package metadata,
  Manifest V3 metadata, bundled privacy patterns, and generated scripts.
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
