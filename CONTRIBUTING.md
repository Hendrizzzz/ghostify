# Contributing to Ghostify

Thanks for your interest in contributing. Here's how you can help.

## Reporting Bugs

Found something broken? Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser version and OS

## Suggesting Features

Have an idea? Open an issue and describe:
- The problem you're trying to solve
- How you envision the solution
- Why this would benefit other users

### Project scope

Ghostify accepts user-controlled privacy features that limit supported outgoing
interaction signals produced by the user's own browser. It does not accept
features intended to:

- preserve, download, or replay ephemeral or view-once media against the
  sender's intended restriction
- bypass authentication, access controls, moderation, or account restrictions
- expose content the signed-in user could not ordinarily access
- harvest or monitor other people's private data

Maintainers may close requests outside this scope even when they are technically
possible.

## Submitting Code

1. Fork the repo
2. Create a branch using the [Git naming policy](#git-naming-policy)
3. Make source changes in `src/` when editing bundled scripts, then run `npm run build`
4. Edit `dist/` directly only for popup/static assets that do not have a source counterpart
5. Test on Instagram, Messenger, and Facebook pages affected by the change
6. Run `npm run ci` before submitting a PR
7. Submit a PR with a clear description

## Git Naming Policy

Use one shared convention for branches, commits, and pull-request titles. This
keeps the history readable and ensures the squash commit describes the change
accurately.

### Branches

Create a short, descriptive lowercase branch using this form:

```text
<type>/<short-kebab-case-summary>
```

Use a Conventional Commit type for `<type>`: `feat`, `fix`, `docs`, `chore`,
`refactor`, `test`, `ci`, `build`, or `perf`. Use only lowercase letters,
numbers, hyphens, and the single separating slash. Do not prefix a branch with
a tool, person, or machine name.

Examples:

```text
fix/responsive-viewport-layout
feat/firefox-install-guidance
docs/release-checklist
```

### Commits and pull-request titles

Use the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
subject format for every commit and PR title:

```text
<type>(<optional-scope>): <imperative lowercase summary>
```

Use a scope when it makes the affected area clearer, such as `site`, `status`,
`popup`, or `messenger`. A `fix` corrects a bug, while a `feat` adds a
user-facing capability. Keep the PR title identical to the intended squash
commit title; merge PRs with **Squash and merge**.

Examples:

```text
fix(site): harden responsive viewport layouts
feat(popup): add keyboard shortcut hint
docs: clarify Firefox release checklist
```

This repository policy applies GitHub Flow's recommendation for short,
descriptive branches and GitHub-safe branch characters. It supplements
Conventional Commits, which standardizes commit subjects but does not prescribe
branch names.

## Browser Targets

Ghostify has one shared runtime and two packaging targets:

- Chromium: Chrome Web Store and Microsoft Edge Add-ons use `dist/` and
  `npm run package:extension`.
- Firefox: Firefox Browser Add-ons uses the manifest overlay under
  `browser-targets/firefox/` and `npm run package:firefox`.

Do not copy runtime code into browser-specific directories. Do not edit a
generated manifest under `tmp/`. Browser-specific manifest, permission, or
release changes must update the validators, packaging tests, privacy policy,
and [browser distribution contract](docs/BROWSER_DISTRIBUTION.md).

## Change Workflow

Use the lightest workflow that still proves the change.

| Tier | Examples | Required checks |
| --- | --- | --- |
| Small | Copy, docs, static popup text, issue-template edits | Self-review and any directly affected command |
| Normal | Runtime bug fix, feature toggle behavior, website UI change | Reproduce or understand the issue, implement narrowly, run relevant automated checks |
| High risk | Manifest permissions, host permissions, privacy matching, Messenger/Facebook module patches, release packaging | Write down the plan before implementation, review privacy and compatibility risk, run full validation, complete manual smoke tests when live behavior matters |

For bug fixes, understand the failure before changing code. Prefer adding or
updating a regression test when the behavior can be modeled locally.

For new features, keep the implementation local to the smallest surface that
owns the behavior. Update popup/settings/config/docs together when user-visible
behavior changes.

Use these evidence statuses when reporting validation:

- `verified`: checked by an automated command or manual smoke test
- `manual-pending`: requires a live account or browser state that was not available
- `gap`: known behavior is not covered yet
- `not applicable`: the check does not apply to the change

PR descriptions should include files changed, commands run, whether `dist/`
was rebuilt, manual smoke tests performed or still pending, and known risks.

Scheduled verification PRs are deliberately not auto-merged. One pending daily
PR is refreshed until the maintainer completes the live checks and merges it.
While the latest merged state is yellow, scheduled automation cannot propose a
green replacement. Manual `reported`, `in-progress`, and `known-issue` modes
publish yellow only after review and merge. The latest merged update remains
active regardless of age. A green proposal is rejected when the recorded Store
version differs from the verification build.

Public status headlines, summaries, history entries, and calendar semantics
must follow [docs/PUBLIC_STATUS_GUIDE.md](docs/PUBLIC_STATUS_GUIDE.md). The
public page describes user impact; internal release instructions and evidence
language stay in structured fields or maintainer-only workflow.

Optional local guard:

```bash
pre-commit install
pre-commit run --all-files
```

The pre-commit configuration runs the same secret scanner used by CI.

## Finding New Patterns

When Instagram, Facebook, or Messenger updates break the extension:

1. Open DevTools Network with Preserve log enabled
2. Perform the action that should be blocked: read a message, type, or view a story
3. Filter for GraphQL, XHR/fetch, websocket, and beacon traffic
4. Find the smallest stable operation or payload token that identifies the privacy signal
5. Prove the matcher is privacy-specific; avoid broad blocking of generic fields such as queue names or task IDs
6. Submit a PR updating `dist/config/patterns.json`, the `src/content.js` fallback config, and the relevant guard in `src/utils/network.js`
7. Update `src/messenger_patch.js` when workers, shared workers, module patches, MAW proxy behavior, message requests, media playback, or local read-state behavior are involved
8. Add or update regression coverage when feasible

See [docs/QA_FIXTURES.md](docs/QA_FIXTURES.md) for the manual smoke IDs used in releases and high-risk fixes.

## Code Style

- No unnecessary comments
- Keep functions small and focused
- Test before submitting
- Do not include ZIP packages, logs, temporary captures, local-only notes, or private browser/account data in commits

## Questions?

Open an issue with the `question` label.
