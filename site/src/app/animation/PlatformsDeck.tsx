import { useLayoutEffect } from 'react';
import { ensureGsap, gsap, prefersReducedMotion } from './gsapSetup';

/* Pinned deck for `.platforms-flat` — awwwards scroll-storytelling beat.
   Desktop-only, scrubbed, fail-open. Three cards rise like being dealt:
   y + rotation + scale + blur resolved sequentially. Previous cards settle
   slightly as the next arrives. A minimal progress rail lives at the
   bottom of the pinned section. Mobile keeps the existing Reveal grid. */
export function PlatformsDeck() {
  useLayoutEffect(() => {
    try {
      ensureGsap();
      if (prefersReducedMotion()) return;

      const mm = gsap.matchMedia();

      mm.add(
        '(min-width: 1081px) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
        () => {
          const ctx = gsap.context(() => {
            const section = document.querySelector<HTMLElement>('.platforms-flat');
            if (!section) return;
            const cards = Array.from(section.querySelectorAll<HTMLElement>('.platform-card'));
            if (cards.length < 3) return;
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
              willChange: 'transform, opacity, filter',
            });
            if (grid) gsap.set(grid, { perspective: 900 });
            cards.forEach((card, i) => {
              gsap.set(card, {
                y: 74 + i * 7,
                rotation: rotations[i] ?? (i % 2 ? 2.6 : -2.6),
                scale: 0.97,
                opacity: 0.72,
                filter: 'blur(3px)',
              });
            });
            if (status) {
              gsap.set(status, { opacity: 0, y: 14, filter: 'blur(6px)' });
            }

            // Progress rail — minimal, premium, non-interactive.
            let progress = section.querySelector<HTMLElement>('.platforms-deck-progress');
            if (!progress) {
              progress = document.createElement('div');
              progress.className = 'platforms-deck-progress';
              progress.setAttribute('aria-hidden', 'true');
              progress.innerHTML =
                '<span class="deck-track"><i></i></span><span class="deck-dots"><b></b><b></b><b></b></span><small>hold to read</small>';
              section.appendChild(progress);
            }
            const progressFill = progress.querySelector<HTMLElement>('.deck-track i');
            const progressDots = Array.from(progress.querySelectorAll<HTMLElement>('.deck-dots b'));
            if (progressFill) {
              gsap.set(progressFill, { scaleX: 0, transformOrigin: 'left center' });
            }
            if (progress) gsap.set(progress, { opacity: 0, y: 8 });

            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: section,
                start: 'top top',
                end: () => `+=${Math.round(window.innerHeight * 1.95)}`,
                pin: section,
                pinSpacing: true,
                scrub: 0.8,
                anticipatePin: 1,
                invalidateOnRefresh: true,
              },
            });

            // Reveal rail immediately as pin locks.
            if (progress) {
              tl.to(progress, { opacity: 1, y: 0, duration: 0.22, ease: 'none' }, 0);
            }

            // Gentle header drift — stays readable while pin holds.
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
                  filter: 'blur(0px)',
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
                  filter: 'blur(0px)',
                  ease: 'none',
                  duration: 0.18,
                },
                0.83,
              );
            }

            // Progress scrub — continuous.
            if (progressFill) {
              tl.to(progressFill, { scaleX: 1, ease: 'none', duration: 1 }, 0);
            }
            // Dots follow scroll progress; keep in sync on scrub.
            if (progressDots.length) progressDots[0]?.classList.add('is-active');
            tl.eventCallback('onUpdate', () => {
              const st = tl.scrollTrigger;
              if (!st) return;
              const p = st.progress;
              progressDots.forEach((dot, i) => {
                const threshold = 0.08 + i * 0.22;
                if (p >= threshold) dot.classList.add('is-active');
                else dot.classList.remove('is-active');
              });
            });
          });

          return () => {
            ctx.revert();
            // Clean rail when this media branch tears down (unmatch / unmount).
            const rail = document.querySelector('.platforms-flat .platforms-deck-progress');
            if (rail) rail.remove();
          };
        },
      );

      mm.add('(max-width: 1080px), (pointer: coarse), (prefers-reduced-motion: reduce)', () => {
        const cards = document.querySelectorAll<HTMLElement>('.platform-card');
        if (cards.length) gsap.set(cards, { clearProps: 'all' });
        const section = document.querySelector<HTMLElement>('.platforms-flat');
        if (section) {
          const rail = section.querySelector('.platforms-deck-progress');
          if (rail) rail.remove();
        }
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
