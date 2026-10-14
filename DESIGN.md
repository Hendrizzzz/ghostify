# DESIGN.md

The visual system for Ghostify's two UI surfaces: the extension popup and the
marketing/status site. Product truth lives in [PRODUCT.md](PRODUCT.md). This
file records the incumbent system; treat it as the authority when refining, and
update it deliberately when replacing parts.

## Brand core (shared)

- **Identity:** a quiet ghost — privacy that recedes. Friendly, calm, honest.
- **Palette:** both surfaces are dark-first. Site ink `#050506` / `#070607`,
  text `#f4f1ea`, violet light `#aa98ee` / `#b9a8ff` / `#8873cf`. Status ok
  `#4fb487`, review `#e0a63a`, issue `#e2725b` are reserved for verification
  semantics; never decorative.
- **Type:** the system UI stack only (`-apple-system`, Segoe UI Variable,
  `system-ui`). No webfonts, serif accents, mono eyebrows or numbered labels.
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

**World:** a short film. The ghost is the only character; the footage is real
Ghostify recordings, cropped, never a reconstructed Meta interface. The popup
shot embeds the shipped `dist/popup.html` + `dist/css/popup.css` 1:1.

### Structure

All site code lives in `site/src/cinema/`; `site/src/app/statusData.*` is the
status feed source.

- `Film.tsx` — the stepped film: one wheel, swipe or key gesture moves exactly
  one shot (GSAP Observer + ScrollTrigger), with a cooldown that absorbs
  trackpad momentum. Native scroll is released before the first and after the
  last shot. Esc / Skip / End jump to the end card; each shot has a URL hash.
- Shot order: opener ("Press anywhere to begin") → cold open → receipt → dots
  → story → switches → wide (official platform marks) → privacy → end card.
- `Stills.tsx` — the film as still frames for `prefers-reduced-motion` or a
  film that cannot start. Sound stays off there.
- `sound.ts` — procedural Web Audio score, no audio files. On by default, but
  only starts on a real user activation (press, key, tap); it never claims to
  be on before the context is running. Muting is remembered in localStorage.
- `Ghost.tsx` — the vector mark: SMIL hem, CSS blink, pointer-following eyes,
  plus the back-lit silhouette and poses.
- `Landing.tsx` (film + FAQ as end credits), `Status.tsx` (current + history),
  `Shell.tsx` (store links, header, footer).

### Layout and motion

- Landscape screens get the widescreen cut; phones and portrait tablets get the
  vertical cut, chosen by aspect ratio, not device sniffing.
- Letterbox bars, grain, a subtitle scrim and light spill from the footage are
  the whole material language. Do not add glass, gradients-as-decoration or
  beams.
- Inactive shots use `content-visibility` so only the live shot lays out.

### Accessibility and performance floor

44px hit targets, `:focus-visible` rings, skip link, semantic landmarks,
reduced-motion stills, ≥4.5:1 text contrast. Lighthouse target is ≥90 in every
category on mobile and desktop.
