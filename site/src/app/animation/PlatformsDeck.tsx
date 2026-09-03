import { useEffect, useLayoutEffect } from 'react';
import { ensureGsap, gsap, prefersReducedMotion } from './gsapSetup';

/* Scroll-driven deck for `.platforms-flat` — a desktop storytelling beat.
   Desktop-only, scrubbed, fail-open. Three cards rise like being dealt:
   y + rotation + scale resolved sequentially. Previous cards settle
   slightly as the next arrives. Mobile keeps the existing Reveal grid. */
export function PlatformsDeck() {
  useLayoutEffect(() => {
    try {
      ensureGsap();
      if (prefersReducedMotion()) return;

      const mm = gsap.matchMedia();

      mm.add(
        '(min-width: 1081px) and (min-height: 760px) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
        () => {
          const ctx = gsap.context(() => {
            const section = document.querySelector<HTMLElement>('.platforms-flat');
            if (!section) return;
            const cards = Array.from(section.querySelectorAll<HTMLElement>('.platform-card'));
            if (cards.length < 3) return;
            // A pin freezes the panel at the viewport top. Fall back to the
            // normal reveal when a short window cannot show all of its content.
            if (Math.ceil(section.getBoundingClientRect().height) > window.innerHeight) return;
            const grid = section.querySelector<HTMLElement>('.platform-card-grid');
            const status = section.querySelector<HTMLElement>('.platforms-status');
            const header = section.querySelector<HTMLElement>('.platforms-flat > header');

            // Neutralize Reveal entrance on desktop — the scrub owns it.
            cards.forEach((card) => {
              card.classList.add('is-instant', 'is-revealed');
              card.style.setProperty('--reveal-delay', '0ms');
            });
            const statusReveal = status?.closest<HTMLElement>('.reveal');
            if (statusReveal) statusReveal.classList.add('is-instant', 'is-revealed');
            const headerReveal = section.querySelector<HTMLElement>(
              '.platforms-flat > header.reveal',
            );
            if (headerReveal) headerReveal.classList.add('is-instant', 'is-revealed');

            // Card personalities: subtle different rotations like a dealt hand.
            const rotations = [-3.4, 2.8, -2.2];

            gsap.set(cards, {
              transformOrigin: 'center bottom',
              // No `filter` here on purpose: scrubbed blur on three large
              // cards forces repaints every scroll frame and reads as lag.
              willChange: 'transform, opacity',
            });
            if (grid) gsap.set(grid, { perspective: 900 });
            cards.forEach((card, i) => {
              gsap.set(card, {
                y: 74 + i * 7,
                rotation: rotations[i] ?? (i % 2 ? 2.6 : -2.6),
                scale: 0.97,
                opacity: 0.55,
              });
            });
            if (status) {
              gsap.set(status, { opacity: 0, y: 14 });
            }

            // Hold the compact content panel just long enough for the dealt-card
            // sequence to resolve. The panel keeps its natural content height;
            // pinning controls the scroll narrative, not the visual dimensions.
            const getPinDistance = () =>
              Math.round(Math.min(Math.max(window.innerHeight * 1.3, 760), 1160));

            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: section,
                start: 'top top',
                end: () => `+=${getPinDistance()}`,
                pin: section,
                pinSpacing: true,
                scrub: 0.8,
                anticipatePin: 1,
                invalidateOnRefresh: true,
              },
            });

            // Gentle header drift — stays readable while the panel is held.
            if (header) {
              tl.fromTo(header, { y: 0 }, { y: -8, ease: 'none', duration: 1 }, 0);
              const notes = header.querySelectorAll<HTMLElement>('.control-map-note');
              notes.forEach((note, idx) => {
                const dir = idx === 0 ? -1 : 1;
                tl.fromTo(note, { y: 0 }, { y: dir * 6, ease: 'none', duration: 1 }, 0);
              });
            }

            // Sequential card rise — each gets ~32% of the scroll, overlapping 10%.
            cards.forEach((card, i) => {
              const start = 0.06 + i * 0.22;
              tl.to(
                card,
                {
                  y: 0,
                  rotation: 0,
                  scale: 1,
                  opacity: 1,
                  ease: 'none',
                  duration: 0.32,
                },
                start,
              );

              // Previous card settles/dims as next arrives.
              if (i > 0) {
                const prev = cards[i - 1];
                tl.to(
                  prev,
                  {
                    scale: 0.985,
                    opacity: 0.92,
                    ease: 'none',
                    duration: 0.2,
                  },
                  start + 0.09,
                );
              }
            });

            // Final settle — all cards perfect again for the unpin.
            tl.to(cards, { scale: 1, opacity: 1, ease: 'none', duration: 0.22 }, 0.78);

            if (status) {
              tl.to(
                status,
                {
                  opacity: 1,
                  y: 0,
                  ease: 'none',
                  duration: 0.18,
                },
                0.83,
              );
            }
          });

          return () => {
            ctx.revert();
          };
        },
      );

      mm.add('(max-width: 1080px), (pointer: coarse), (prefers-reduced-motion: reduce)', () => {
        const cards = document.querySelectorAll<HTMLElement>('.platform-card');
        if (cards.length) gsap.set(cards, { clearProps: 'all' });
        const statuses = document.querySelectorAll<HTMLElement>('.platforms-status');
        statuses.forEach((el) => gsap.set(el, { clearProps: 'all' }));
        return () => {};
      });

      return () => mm.revert();
    } catch {
      // fail-open: never break host page
    }
  }, []);

  return null;
}

/* The Hide Seen / Hide Typing / Hide Story Views rows on each platform card
   flip themselves on and off. Every row runs its own timer with a fresh
   random interval, so no two rows — and no two cards — ever move in sync.
   Flips pause while the grid is off-screen, the tab is hidden, or the user
   prefers reduced motion. Renders nothing. */
export function PlatformControlAutoplay() {
  useEffect(() => {
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>('.platform-card-controls > div'),
    );
    if (!rows.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let inView = true;
    const grid = document.querySelector<HTMLElement>('.platform-card-grid');
    const observer =
      typeof IntersectionObserver !== 'undefined' && grid
        ? new IntersectionObserver(
            (entries) => {
              inView = entries[0]?.isIntersecting ?? true;
            },
            { rootMargin: '120px' },
          )
        : null;
    if (observer && grid) observer.observe(grid);

    const timers = new Set<number>();
    const loop = (row: HTMLElement) => {
      const id = window.setTimeout(
        () => {
          timers.delete(id);
          if (inView && !document.hidden) row.classList.toggle('is-off');
          loop(row);
        },
        2400 + Math.random() * 5600,
      );
      timers.add(id);
    };
    // Staggered first flips so the deck never starts in lockstep.
    rows.forEach((row, index) => {
      const id = window.setTimeout(
        () => {
          timers.delete(id);
          loop(row);
        },
        1400 + Math.random() * 3800 + index * 240,
      );
      timers.add(id);
    });

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      observer?.disconnect();
    };
  }, []);

  return null;
}
