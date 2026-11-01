# Ghostify Documentation

Maintainer and contributor references. Start with the project
[README](../README.md) for an overview and [ARCHITECTURE.md](../ARCHITECTURE.md)
for the runtime design, manifest model, build flow, and test layout.

## Guides

| Document | Purpose |
| --- | --- |
| [Browser distribution](BROWSER_DISTRIBUTION.md) | Authoritative map of channels, packages, manifests, and release responsibilities |
| [QA fixtures](QA_FIXTURES.md) | Stable smoke-test IDs and evidence statuses for live browser checks |
| [Public status guide](PUBLIC_STATUS_GUIDE.md) | How the public verification feed and status pages are written |
| [Threat model](THREAT_MODEL.md) | Trust boundaries and residual risks of the extension runtime |
| [Firefox release checklist](FIREFOX_RELEASE_CHECKLIST.md) | Firefox Browser Add-ons submission steps |
| [Firefox AMO submission](FIREFOX_AMO_SUBMISSION.md) | Repository-owned listing and reviewer text for Firefox Add-ons |

## Records

- [`releases/`](releases/) holds store submission and release preparation notes
  per version, named after the release tag (for example `v2.1.1.md`).
- [`verification/`](verification/) holds verification evidence for specific
  fixes and reported issues.

## Root-Level Documents

Some documents stay in the repository root on purpose:

- [`RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md),
  [`FIREFOX_REVIEW_BUILD.md`](../FIREFOX_REVIEW_BUILD.md), and
  [`ARCHITECTURE.md`](../ARCHITECTURE.md) are copied to the root of the Firefox
  reviewer source package by `scripts/package-firefox.js`.
- [`PRIVACY.md`](../PRIVACY.md) is the published privacy policy. Store listings
  and the website link to its `main` branch URL.
- [`PRODUCT.md`](../PRODUCT.md), [`DESIGN.md`](../DESIGN.md), and
  [`AGENTS.md`](../AGENTS.md) are project context files that contributor and
  agent tooling expect at the root.
- Community health files (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md`, `SUPPORT.md`, `MAINTAINERS.md`) follow GitHub's root-level
  convention.
