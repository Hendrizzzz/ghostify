import { useLayoutEffect } from 'react';
import { ensureGsap, gsap, prefersReducedMotion } from './gsapSetup';

/**
 * FAQ stagger + Ask-AI restrained entrance.
 * Both are once (not scrub): the FAQ cards settle, the question sheet tilts
 * a touch as the card comes into view. Native <details> toggle is untouched.
 */
export function FaqAskAiScene() {
  useLayoutEffect(() => {
    ensureGsap();

    const faq = document.querySelector<HTMLElement>('.faq-flat');
    const details = faq?.querySelectorAll<HTMLElement>('.faq-flat-list details') ?? null;
    const askSection = document.querySelector<HTMLElement>('.ask-ai-section');
    const sheet = document.querySelector<HTMLElement>('.ask-ai-question-sheet');
    const tab = document.querySelector<HTMLElement>('.ask-ai-source-tab');
    const stack = document.querySelector<HTMLElement>('.ask-ai-source-stack');
    const ghost = document.querySelector<HTMLElement>('.ask-ai-ghost');

    const hasFaq = !!(faq && details && details.length > 0);
    const hasAsk = !!(askSection && sheet);

    if (!hasFaq && !hasAsk) return;

    if (prefersReducedMotion()) {
      if (details) gsap.set(details, { opacity: 1, y: 0, clearProps: 'transform' });
      if (sheet) gsap.set(sheet, { opacity: 1, y: 0, rotation: 0, clearProps: 'transform' });
      if (tab) gsap.set(tab, { opacity: 1, y: 0, rotation: 0, clearProps: 'transform' });
      if (stack) gsap.set(stack, { clearProps: 'transform' });
      if (ghost) gsap.set(ghost, { opacity: 1, clearProps: 'transform' });
      return;
    }

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        // --- FAQ: stagger the cards on first scroll-in -------------------
        if (hasFaq && faq && details) {
          // Set initial dropped state; context will revert on unmount.
          gsap.set(details, { y: 14, opacity: 0 });

          gsap.to(details, {
            y: 0,
            opacity: 1,
            duration: 0.62,
            stagger: 0.07,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: faq,
              start: 'top 78%',
              once: true,
            },
          });
        }

        // --- Ask-AI: restrained sheet tilt/draw --------------------------
        // Keep the existing Reveal (copy + visual delay 140) untouched;
        // this adds a second layer: the paper itself draws in a touch.
        if (hasAsk && askSection && sheet) {
          // Baseline matches landing.css rotate(-2.2deg) on .ask-ai-source-stack.
          // We animate the sheet inner, not the stack offset, so Reveal's
          // translate/opacity composes cleanly.
          gsap.set(sheet, { y: 14, rotation: -0.8 });
          if (tab) gsap.set(tab, { y: 8, rotation: 1.2 });
          if (ghost) gsap.set(ghost, { y: 10, opacity: 0 });

          const askTl = gsap.timeline({
            scrollTrigger: {
              trigger: askSection,
              start: 'top 76%',
              once: true,
            },
            defaults: { ease: 'power3.out' },
          });

          askTl.to(sheet, { y: 0, rotation: 0, duration: 0.7 }, 0);
          if (tab) askTl.to(tab, { y: 0, rotation: 4, duration: 0.65 }, 0.12);
          if (stack) {
            // Subtle stack settle — restrained, secondary beat.
            askTl.fromTo(
              stack,
              { rotation: -2.6 },
              { rotation: -2.2, duration: 0.7, ease: 'power3.out' },
              0,
            );
          }
          if (ghost) {
            askTl.to(ghost, { y: 0, opacity: 1, duration: 0.6 }, 0.22);
          }
        }
      });

      return () => ctx.revert();
    });

    // Desktop vs all hook for parity (no divergent values needed now,
    // but proves the responsive branching without layout thrash).
    mm.add('(min-width: 861px) and (prefers-reduced-motion: no-preference)', () => {
      return () => {};
    });

    return () => mm.revert();
  }, []);

  return null;
}
