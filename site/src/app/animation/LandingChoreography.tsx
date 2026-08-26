import { useLayoutEffect } from 'react';
import { gsap, SplitText, ensureGsap, prefersReducedMotion } from './gsapSetup';

/* Page-level choreography that isn't the ghost's journey: the hero's
   on-load cascade, the privacy statement filling with ink as you scroll,
   and the closing beat. Scroll position picks moments; GSAP owns pacing. */
export function LandingChoreography() {
  useLayoutEffect(() => {
    ensureGsap();
    if (prefersReducedMotion()) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        /* -- hero: masked word rise, then copy and actions settle --------- */
        const heroCopy = document.querySelector<HTMLElement>('.home-hero-copy');
        if (heroCopy) {
          const h1 = heroCopy.querySelector('h1');
          const paras = heroCopy.querySelectorAll<HTMLElement>(':scope > p');
          const actions = heroCopy.querySelector<HTMLElement>('.home-hero-actions');
          if (h1) {
            const split = SplitText.create(h1, { type: 'words', mask: 'words' });
            gsap
              .timeline({ defaults: { ease: 'expo.out' } })
              .from(split.words, { yPercent: 118, duration: 1.05, stagger: 0.055 }, 0.08)
              .from(
                paras,
                {
                  y: 26,
                  opacity: 0,
                  filter: 'blur(8px)',
                  duration: 0.85,
                  ease: 'expo.out',
                  stagger: 0.08,
                },
                0.42,
              )
              .from(actions, { y: 22, opacity: 0, duration: 0.75, ease: 'expo.out' }, 0.58);
          }
        }

        /* -- privacy: the statement inks itself in while you scroll ------- */
        const privacyHead = document.querySelector<HTMLElement>('.privacy-band header');
        if (privacyHead) {
          privacyHead.closest<HTMLElement>('.reveal')?.classList.add('is-instant');
          const h2 = privacyHead.querySelector('h2');
          const p = privacyHead.querySelector('p');
          const h2Split = h2 ? SplitText.create(h2, { type: 'words' }) : null;
          const pSplit = p ? SplitText.create(p, { type: 'words' }) : null;
          const words = [...(h2Split?.words ?? []), ...(pSplit?.words ?? [])];
          if (words.length) {
            gsap.set(words, { opacity: 0.13 });
            gsap.to(words, {
              opacity: 1,
              ease: 'none',
              stagger: 0.045,
              scrollTrigger: {
                trigger: privacyHead,
                start: 'top 80%',
                end: 'top 24%',
                scrub: 0.5,
              },
            });
          }
        }

        /* -- closing beat: the promise rises once, then holds ------------- */
        const finalReveal = document.querySelector<HTMLElement>('.home-final .reveal');
        if (finalReveal) {
          finalReveal.classList.add('is-instant');
          const h2 = finalReveal.querySelector('h2');
          const rest = finalReveal.querySelectorAll<HTMLElement>('p, .home-final-actions');
          if (h2) {
            const split = SplitText.create(h2, { type: 'words', mask: 'words' });
            gsap
              .timeline({
                scrollTrigger: { trigger: '.home-final', start: 'top 74%', once: true },
                defaults: { ease: 'expo.out' },
              })
              .from(split.words, { yPercent: 120, duration: 1.0, stagger: 0.06 }, 0)
              .from(
                rest,
                {
                  y: 24,
                  opacity: 0,
                  filter: 'blur(6px)',
                  duration: 0.82,
                  ease: 'expo.out',
                  stagger: 0.09,
                },
                0.38,
              );
          }
        }
      });

      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  return null;
}
