# AGENTS.md

Guidance for AI coding agents and human contributors working in this repository.

Ghostify is a Manifest V3 browser extension that holds supported Seen / Typing /
Story View signals on Instagram, Messenger, and Facebook. Vanilla JS core in
`src/`, esbuild bundling via `build.js`, a React 19 + Vite marketing/status site
in `site/`.

## Non-negotiable invariants

1. **`dist/` is committed.** The four bundles (`dist/background.js`,
   `dist/js/content.js`, `dist/js/ghost.js`, `dist/js/messenger_patch.js`) are
   build artifacts tracked in git. After changing `src/`, run `npm run build`
   and commit the rebuilt bundles together with the source change.
   `npm run verify:dist` fails CI if they drift.
2. **The popup has no source directory.** `dist/popup.html`, `dist/css/popup.css`,
   and `dist/js/popup.js` are hand-maintained package assets (see
   ARCHITECTURE.md, "Build Flow"). Edit them directly; never "rebuild" them.
3. **Version sync.** A release bumps the files listed in ARCHITECTURE.md's
   "Version values must stay synchronized across" section: `package.json`,
   `package-lock.json`, `dist/manifest.json`,
   `dist/config/patterns.json` (`version`), `src/content.js`
   `FALLBACK_CONFIG.version`, and `CHANGELOG.md`. The Firefox overlay carries no
   version field; it inherits one from `dist/manifest.json` during packaging.
   `validate:tag-integrity` blocks identity-path changes under existing tags.
4. **Pattern vocabulary lockstep.** `dist/config/patterns.json`,
   `src/content.js` `FALLBACK_CONFIG`, and the term lists in
   `src/utils/network.js` / `src/messenger_patch.js` must stay semantically in
   sync. Changing one means reviewing all of them.
5. **Never commit `tmp/`.** It is throwaway staging for Firefox packaging.
6. **Tests pin exact strings.** `test/messenger-send-stability.test.js` asserts
   literal popup CSS/HTML fragments (tooltip widths, status colors, z-index,
   absence of `title=` attributes, no red status tones). Read the pinned
   assertions before restyling the popup; update tests deliberately, never
   accidentally.
7. **Deliberate product removals stay removed.** No local tab checker
   (`GHOSTIFY_STATUS_CHECK`, `chrome.tabs.reload` in popup), no Labs/survey UI,
   no `--status-red` tone, no native `title=` tooltips. Tests enforce these.
8. **Firefox packaging is script-driven.** Chromium files are the source of
   truth; `scripts/prepare-firefox-extension.js` merges
   `browser-targets/firefox/manifest.overlay.json`. Do not hand-edit Firefox
   output.

## Commands

| Task | Command |
| --- | --- |
| Build extension bundles | `npm run build` |
| Full test suite | `npm test` |
| Lint + format check | `npm run lint` / `npm run format:check` |
| Format | `npm run format` |
| Site typecheck/dev/build | `cd site && npm run typecheck` / `dev` / `build` |
| Pre-PR gate (all browsers) | `npm run ci` |

## Conventions

- Branch names: `<type>/<short-kebab-description>`, using a standard type such as
  `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`, `ci/`, `build/`, or
  `perf/`. Do not prefix branches with an agent, tool, or username.
- Commit messages: Conventional Commits, `<type>(<optional-scope>): <imperative summary>`
  (for example, `fix(status): credit maintainer on daily verification commits`).
- PR titles: use the same Conventional Commit format as commit messages so the
  squash-merge commit is correctly named (for example, `fix(status): credit maintainer on daily verification commits`).
- Keep branch names, commit messages, and PR titles specific to one logical change;
  avoid vague labels such as `update`, `changes`, `misc`, or `fix stuff`.
- Squash-merge PRs.
- 4-space indent for extension JS, 2-space for `site/`; Prettier + ESLint run in CI.
  Markdown, YAML, and everything under `.github/` are excluded from Prettier on
  purpose — docs contain validator-pinned phrases.
- Fail-open error handling in content scripts is intentional: Ghostify must
  never break the host page. Keep `catch` blocks quiet unless behind debug flags.
- Zero runtime dependencies; devDependencies only.

## Documentation map

- [ARCHITECTURE.md](ARCHITECTURE.md) — runtime design, manifest model, build flow
- [CONTRIBUTING.md](CONTRIBUTING.md) — scope policy, change-risk tiers, PR expectations
- [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) + [docs/FIREFOX_RELEASE_CHECKLIST.md](docs/FIREFOX_RELEASE_CHECKLIST.md)
- [docs/QA_FIXTURES.md](docs/QA_FIXTURES.md) — smoke IDs (`GH-IG-TYPING-001`, ...)
- [docs/BROWSER_DISTRIBUTION.md](docs/BROWSER_DISTRIBUTION.md) — channels & manifests
- [PRIVACY.md](PRIVACY.md) / [SECURITY.md](SECURITY.md) / [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)
- [PRODUCT.md](PRODUCT.md) / [DESIGN.md](DESIGN.md) — product truth and visual system
