# DESIGN.md

The visual system for Ghostify's two UI surfaces: the extension popup and the
marketing/status site. Product truth lives in [PRODUCT.md](PRODUCT.md). This
file records the incumbent system; treat it as the authority when refining, and
update it deliberately when replacing parts.

## Brand core (shared)

- **Identity:** a quiet ghost — privacy that recedes. Friendly, calm, honest.
- **Palette:** warm paper cream `#f3eee2`, near-black ink `#0f0f0d`, violet
  accent `#8873cf` (deep `#6856b0`, lavender tint `#d8d2ff`). Status greens
  `#27835f` / `#287a50` and amber `#c98b20` are reserved for verification
  semantics; never decorative.
- **Type:** Uncut Sans Variable (brand sans, wired via `@font-face` in
  `site/src/styles/index.css`), Newsreader Variable italic for editorial
  watermarks, Commit Mono for data/receipts/labels.
- **Voice:** short, plain, first-person-plural-free. "Read now. Reply when
  you're ready."

## Popup (`dist/popup.html/css/js`)

Dark-first, low-glare, fixed 320px shell.

- Tokens live in `:root` of `dist/css/popup.css` (`--ghost-*`, `--status-*`).
  Do not introduce one-off hexes; extend the ramp instead.
- Rows are `<label>` elements: the whole row toggles its switch; visible text
  is the accessible label alongside each input's `aria-label` (QA fixtures pin
  those strings).
- Status pill semantics: green dot = verified with date, amber = review, neutral
  dashed pill + dimmed dot = feed fallback (`.is-fallback`). No red tones, ever
  (test-pinned).
- Tooltips: DOM tooltip pattern for the status pill; CSS `::after/data-tooltip`
  for footer links. No native `title=` attributes (test-pinned).
- Motion: micro-lifts use 140–160ms cubic-bezier(0.2, 0.8, 0.2, 1); a few plain
  `ease` transitions remain for color fades.
  `prefers-reduced-motion` resets all of them.

## Site (`site/`)

**World:** quiet analog stationery-editorialism on warm paper — taped sheets,
hard offset shadows, dashed stamp circles, oversized italic serif ghost-words
("held", "quiet", "local") drifting behind sections, mono uppercase evidence
tags ("SOURCE / CORE / CHECKS"). One identity, not several: prefer extending
this world over importing new material languages.

### Tokens

Root tokens in `site/src/styles/globals.css`; landing-page tokens in
`site/src/styles/landing.css` (`--home-*`, including `--home-edge` container
gutter). Known legacy alias: `--coral` is actually the violet accent — use
`--accent` / `--accent-strong` in new work. The status page carries its own
compatibility token layer (`--g-*` plus `.is-status-view` overrides); keep
status restyling inside that layer until it is consolidated.

### Layout

- Landing container edge padding: `var(--edge-pad)` (header/footer) and
  `var(--home-edge)` (sections) — never paste the raw `calc()` again.
- Breakpoints in force: 390 / 620 / 820 / 1060 px (globals) plus landing-page
  steps around 360–1081. Collapse duplicates opportunistically; do not add new ones.

### Type scale

Hero/section/subsection sizes are fluid clamps (`--type-hero-size`,
`--type-section-size`, ... in `landing.css`). Minimum body-label size is 11px;
informational text must hold ≥4.5:1 contrast against its surface. Decorative
illustration micro-type (mock browser chrome, calendar cells) may stay smaller.

### Motion

- Scroll engine: hand-rolled rAF progress vars (`--scene-progress`,
  `--feature-progress`); Lenis smooth scroll disabled for touch and
  reduced-motion users.
- Every animation pauses off-screen (IntersectionObserver) and under
  `visibilitychange`.
- Global `prefers-reduced-motion` kill switch in globals.css is load-bearing —
  keep it last in cascade order.

### Accessibility floor

44px hit targets, `:focus-visible` rings in accent violet, skip link, semantic
landmarks, `aria-live` on async status regions, explicit width/height on media.

### Roadmap (agreed gaps, in order)

1. Convert demo GIFs (~29 MB total) to muted looping `<video>` with posters.
2. Consolidate the status page token layer into one file and flatten its
   specificity war.
3. True dark mode via semantic token swap (the dark footer/privacy panels are
   the reference palette).
4. Popup source migration into `src/popup/` with build integration.
5. Split `HomePage.tsx` into section components; unify platform logos.
