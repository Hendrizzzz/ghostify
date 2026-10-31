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
- Look: flat and quiet. Solid surfaces, hairline borders, no gradients, glows
  or tinted shadows. Feature icons are 18px line glyphs on 28px chips that
  take a flat accent tint when their switch is on.
- Seasonal themes: `popup.js` sets `html[data-theme]` from the user's local
  date every time the popup opens, so the switchover is automatic and nothing
  is changed by hand. The calendar lives in `getSeasonalTheme()` (and is
  pinned by `test/popup-theme.test.js`):

  | Dates (inclusive) | Look |
  | --- | --- |
  | Sep 29 – Nov 4 | Halloween |
  | Nov 5 – Nov 28 | default |
  | Nov 29 – Dec 27 | Christmas |
  | Dec 28 – Jan 31 | New Year |
  | Feb 1 – Feb 7 | default |
  | Feb 8 – Feb 15 | Valentine's |
  | Feb 16 – Sep 28 | default |

  Each season starts two days before its calendar date so store-review lag does
  not eat into it.

  `popup.html?theme=<name>` previews any of them. A theme swaps surface
  and accent tokens, adds one small line mark in the header and a few flat
  effects. It never touches `--status-*` or layout. Every animated piece stops
  under `prefers-reduced-motion`.
- Halloween is the festive one, by choice: bats cross the header, a spider
  drops on a thread, ghosts peek over the cards, a pumpkin patch sits on the
  footer line and the tally is three pumpkins. Its story: ghost visible means
  you are still visible. As more switches are on the header ghost fades, the
  room darkens, the moon brightens and rows light up like candles
  (`--on-ratio` on `<html>`). Hovering the logo shows the ghost. Idle motion
  is deliberately rare (bats every ~34s, spider ~52s).
- Each season is built on the ghost, so it reads at first glance:
  - Christmas: deep pine green with red and gold; a Santa hat on the ghost, a
    pine garland with berries and baubles across the top, snow on the cards and
    snow drifting behind the UI. Story: a small tree gets one ornament per
    switch that is on and its star at all six. Sound: music-box notes climbing a
    pentatonic line, then a soft chord.
  - New Year: midnight navy with gold; a party hat on the ghost, pennant
    bunting across the top, the coming year in gold beside the wordmark and
    confetti drifting behind the UI. Story: a clock creeps toward 12 as more
    switches are on and strikes midnight at all six. Sound: glass clinks that
    rise, then a low bell and a few clinks.
  - Valentine's: wine and rose; the ghost blushes, hearts hang from the top and
    rise behind the UI. Story: six hearts fill as you hide more and the ghost
    gets heart-eyes at all six. Sound: warm plucked notes, then a soft
    heartbeat and a shimmer.
- Opening shower: the first time the popup opens each day in Christmas, New
  Year or Valentine's, a short shower (snow and stars, confetti, rising hearts)
  crosses the popup. After that it stays calm. `?flourish=always` forces it for
  previews; stored under `ghostifyFlourishDay`.
- Like Halloween, neither theme adds popup height (decor sits in the footer
  gap) and all motion stops under `prefers-reduced-motion`.
- Sound (opt-in, footer speaker): the default theme is a soft sine tick.
  Halloween uses breath, a low hollow note and a synthesized room, never above
  a whisper (a test caps voice level), plus one distant bell when the last
  switch hides the ghost. Synthesized only, no audio files.
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
  The two shots that run straight on with no cut (receipt, privacy) are left
  the way they came: stepping back plays them backwards, a little faster, so
  the way back retraces the way in instead of cutting.
- Shot order: opener ("Press anywhere to begin") → cold open → receipt →
  typing (a reply typed in the dark and erased) → story → switches → wide
  (official platform marks) → privacy → end card.
- `Stills.tsx` — the film as still frames for `prefers-reduced-motion` or a
  film that cannot start. Sound stays off there.
- `sound.ts` — procedural Web Audio score, no audio files. On by default, but
  only starts on a real user activation (press, key, tap); it never claims to
  be on before the context is running. Muting is remembered in localStorage.
  Every effect is a cue on its shot's timeline (`sfx(at, …)` in `Film.tsx`);
  the shot's cues are scheduled on the audio clock when it starts, so a sound
  lands on the frame it belongs to. A shot cut short drops its sounds; one
  that played out lets its tail ring under the next cut. Effects play at full
  level at once; only the drone bed fades in. The header's meter reads the
  real output level.
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
- No dots or boxes in the film: no keycap hints, chips, cards, dot separators,
  outlined pills or drawn frames. Hints are plain text, separators are space,
  and the world fades into the dark instead of sitting in a frame.
- Inactive shots use `content-visibility` so only the live shot lays out.

### Accessibility and performance floor

44px hit targets, `:focus-visible` rings, skip link, semantic landmarks,
reduced-motion stills, ≥4.5:1 text contrast. Lighthouse target is ≥90 in every
category on mobile and desktop.
