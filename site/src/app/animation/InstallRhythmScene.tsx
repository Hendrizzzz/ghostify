import { useLayoutEffect } from 'react';
import { ensureGsap, gsap, prefersReducedMotion } from './gsapSetup';

/**
 * Install rhythm path drawing.
 * Scrubbed DrawSVG + staggered rise for the four steps. Ghost rides the
 * same line via MotionPath when available. Fail-open everywhere.
 */
export function InstallRhythmScene() {
  useLayoutEffect(() => {
    ensureGsap();

    const section = document.querySelector<HTMLElement>('.install-rhythm');
    const path = document.querySelector<SVGPathElement>('.install-path-line path');
    const items = document.querySelectorAll<HTMLElement>('.install-rhythm-path ol li');
    const ghost = document.querySelector<HTMLElement>('.install-path-ghost');

    if (!section || !path || items.length === 0) return;

    // Reduced motion: show finished state immediately, no ScrollTrigger.
    if (prefersReducedMotion()) {
      try {
        gsap.set(path, { drawSVG: '0% 100%' });
      } catch {
        // DrawSVG may not be available in test env; fall back to opacity.
        (path as unknown as HTMLElement).style.opacity = '1';
      }
      gsap.set(items, { opacity: 1, y: 0, clearProps: 'transform' });
      if (ghost) gsap.set(ghost, { opacity: 1, clearProps: 'transform' });
      return;
    }

    const mm = gsap.matchMedia();

    // One media query covers both mobile and desktop; the SVG uses
    // preserveAspectRatio="none" so the same vertical line (x ~7%) stretches
    // correctly in both the 2×2 desktop grid and the single-column mobile stack.
    // A separate desktop query is kept for future stepped-path variants without
    // duplicating the scrub setup.
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        // Initial state: path empty, steps slightly dropped.
        try {
          gsap.set(path, { drawSVG: '0% 0%' });
        } catch {
          gsap.set(path, { opacity: 0 });
        }
        gsap.set(items, { y: 18, opacity: 0 });
        if (ghost) gsap.set(ghost, { opacity: 1 });

        // Scrubbed timeline — path draws as steps rise in its wake.
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top 65%',
            end: 'bottom 55%',
            scrub: 0.6,
            // refresh hygiene: no extra listeners, context owns invalidation
            invalidateOnRefresh: true,
          },
        });

        // Draw the line
        try {
          tl.to(path, { drawSVG: '0% 100%', ease: 'none', duration: 1 }, 0);
        } catch {
          tl.to(path, { opacity: 1, ease: 'none', duration: 1 }, 0);
        }

        // Steps stagger in as the ink reaches them
        tl.to(
          items,
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            stagger: 0.14,
            ease: 'power3.out',
          },
          0.12,
        );

        // Ghost rides the line — optional, fail-open if MotionPath missing.
        if (ghost) {
          try {
            // MotionPath aligns the ghost to the SVG path; the ghost's
            // container (.install-rhythm-path) is position:relative so the
            // transform is relative to that box. Align origin centered keeps
            // the mark sitting on the line rather than offset.
            tl.to(
              ghost,
              {
                motionPath: {
                  path: path,
                  align: path,
                  alignOrigin: [0.5, 0.5],
                  autoRotate: false,
                },
                ease: 'none',
                duration: 1,
              },
              0,
            );
          } catch {
            // Fallback: subtle y drift tied to the same scrub, no hard failure.
            tl.to(ghost, { y: 10, ease: 'none', duration: 1 }, 0);
          }
        }
      });

      return () => ctx.revert();
    });

    // Desktop refinement hook (kept for parity with spec's matchMedia ask).
    // Currently no divergent values; placeholder ensures the matchMedia
    // branching is exercised without duplicating work.
    mm.add('(min-width: 861px) and (prefers-reduced-motion: no-preference)', () => {
      // No extra tweens — the base scrub already adapts via preserveAspectRatio.
      // Return noop cleanup so media query owns no context.
      return () => {};
    });

    return () => mm.revert();
  }, []);

  return null;
}
