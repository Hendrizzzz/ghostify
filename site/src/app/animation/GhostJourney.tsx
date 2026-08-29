import { useLayoutEffect } from 'react';
import {
  gsap,
  ScrollTrigger,
  SplitText,
  ensureGsap,
  prefersReducedMotion,
  keepSplitDescenders,
} from './gsapSetup';

/* The traveling scroll-ghost was retired — the page mascot is the
   draggable, talking ghost in components/GhostMascot.tsx now. This scene
   keeps the ambient work that never belonged to the ghost: the
   scroll-velocity marquee, the privacy stamps, the hero strike, and the
   split headlines. It renders nothing. */
export function GhostJourney() {
  useLayoutEffect(() => {
    ensureGsap();
    if (prefersReducedMotion()) return;

    const mm = gsap.matchMedia();

    mm.add(
      '(min-width: 1081px) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
      () => {
        let lastY = window.scrollY;
        let lastTime = performance.now();
        let marqueeRate = 1;
        let marqueeDirection = 1;
        let marqueeAnimation: Animation | null = null;
        // document.getAnimations() walks every live animation — too hot to
        // run each frame. Scan on a cooldown until the marquee is found.
        let scanCooldown = 0;

        const tick = () => {
          const now = performance.now();
          const delta = Math.max(1, now - lastTime);
          const velocity = ((window.scrollY - lastY) / delta) * 1000;
          lastY = window.scrollY;
          lastTime = now;

          if (!marqueeAnimation) {
            scanCooldown -= 1;
            if (scanCooldown <= 0) {
              marqueeAnimation =
                document
                  .getAnimations()
                  .find(
                    (animation) =>
                      animation instanceof CSSAnimation &&
                      animation.animationName === 'factMarquee',
                  ) ?? null;
              scanCooldown = 45;
            }
          }
          if (marqueeAnimation) {
            // The marquee flows with you: scroll direction steers it, speed
            // amplifies it, and the rate eases so flips never pop.
            if (velocity > 0.2) marqueeDirection = 1;
            else if (velocity < -0.2) marqueeDirection = -1;
            const target = marqueeDirection * (1 + Math.min(2.2, Math.abs(velocity) * 0.004));
            marqueeRate += (target - marqueeRate) * 0.08;
            marqueeAnimation.playbackRate = marqueeRate;
          }
        };
        gsap.ticker.add(tick);

        return () => {
          gsap.ticker.remove(tick);
        };
      },
    );

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        document.querySelectorAll<HTMLElement>('.privacy-band-panel li').forEach((item) => {
          const stamp = item.querySelector<HTMLElement>('svg');
          if (!stamp) return;
          gsap.fromTo(
            stamp,
            { opacity: 0, scale: 1.8, rotation: 16 },
            {
              opacity: 1,
              scale: 1,
              rotation: 0,
              duration: 0.55,
              ease: 'power3.in',
              scrollTrigger: {
                trigger: item,
                start: 'top 74%',
                toggleActions: 'play none none reverse',
              },
              onComplete: () => gsap.set(stamp, { clearProps: 'transform,opacity' }),
            },
          );
        });

        const strike = document.querySelector<HTMLElement>('.hero-seen-strike');
        const word = document.querySelector<HTMLElement>('.hero-seen-word');
        if (strike && word) {
          gsap.fromTo(
            strike,
            { scaleX: 0 },
            {
              scaleX: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: '.feature-scroll',
                start: 'top 90%',
                end: 'top 38%',
                scrub: 0.4,
              },
            },
          );
          gsap.to(word, {
            opacity: 0.28,
            ease: 'none',
            scrollTrigger: {
              trigger: '.feature-scroll',
              start: 'top 90%',
              end: 'top 38%',
              scrub: 0.4,
            },
          });
        }

        document.querySelectorAll<HTMLElement>('h2[data-split]').forEach((heading) => {
          const holder = heading.closest<HTMLElement>('.reveal');
          if (holder) {
            holder.classList.add('is-revealed', 'is-instant');
          }
          const split = keepSplitDescenders(
            SplitText.create(heading, { type: 'words', mask: 'words' }),
          );
          gsap.from(split.words, {
            yPercent: 118,
            duration: 0.7,
            ease: 'power4.out',
            stagger: 0.05,
            scrollTrigger: {
              trigger: heading,
              start: 'top 82%',
              once: true,
            },
          });
        });
      });

      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  return null;
}
