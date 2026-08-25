import { useLayoutEffect, useRef } from 'react';
import { GhostMark } from '../components/GhostSVG';
import { gsap, ScrollTrigger, SplitText, ensureGsap, prefersReducedMotion } from './gsapSetup';

type Waypoint = {
  selector: string;
  dark?: boolean;
  hide?: boolean;
  x: () => number;
  y: () => number;
  scale?: number;
};

const gutterX = () => window.innerWidth - 118;
const vw = () => window.innerWidth;
const vh = () => window.innerHeight;

const WAYPOINTS: Waypoint[] = [
  { selector: '.home-hero', x: gutterX, y: () => vh() * 0.22, scale: 1 },
  { selector: '.signal-catch', hide: true, x: gutterX, y: () => vh() * 0.5 },
  { selector: '.feature-scroll', x: gutterX, y: () => vh() * 0.32, scale: 0.82 },
  { selector: '.platforms-flat', dark: true, x: gutterX, y: () => vh() * 0.44, scale: 0.9 },
  { selector: '.privacy-band', x: () => vw() * 0.68, y: () => vh() * 0.38, scale: 1 },
  { selector: '.footprint-section', x: gutterX, y: () => vh() * 0.34, scale: 0.88 },
  { selector: '.install-rhythm', x: () => vw() * 0.3, y: () => vh() * 0.62, scale: 0.9 },
  { selector: '.fact-marquee', dark: true, hide: true, x: gutterX, y: () => vh() * 0.5 },
  { selector: '.faq-flat', x: () => vw() * 0.13, y: () => vh() * 0.56, scale: 1.05 },
  { selector: '.ask-ai-section', x: gutterX, y: () => vh() * 0.36, scale: 0.92 },
  { selector: '.home-final', x: () => vw() * 0.74, y: () => vh() * 0.3, scale: 1 },
];

export function GhostJourney() {
  const ghostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    ensureGsap();
    if (prefersReducedMotion()) return;

    const ghost = ghostRef.current;
    if (!ghost) return;

    const mm = gsap.matchMedia();

    mm.add(
      '(min-width: 1081px) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
      () => {
        const ctx = gsap.context(() => {
          const setX = gsap.quickTo(ghost, 'x', { duration: 0.9, ease: 'power3.out' });
          const setY = gsap.quickTo(ghost, 'y', { duration: 0.9, ease: 'power3.out' });
          const setScale = gsap.quickTo(ghost, 'scale', { duration: 0.9, ease: 'power3.out' });
          const setOpacity = gsap.quickTo(ghost, 'opacity', { duration: 0.4, ease: 'power2.out' });

          const first = WAYPOINTS[0];
          gsap.set(ghost, { x: first.x(), y: first.y(), scale: first.scale ?? 1 });

          const applyWaypoint = (waypoint: Waypoint) => {
            setX(waypoint.x());
            setY(waypoint.y());
            setScale(waypoint.scale ?? 1);
            setOpacity(waypoint.hide ? 0 : 1);
            ghost.classList.toggle('is-on-dark', !!waypoint.dark);
          };

          const journeyTriggers: ScrollTrigger[] = WAYPOINTS.map((waypoint) => {
            const section = document.querySelector<HTMLElement>(waypoint.selector);
            if (!section) return null as unknown as ScrollTrigger;
            return ScrollTrigger.create({
              trigger: section,
              start: 'top 55%',
              end: 'bottom 55%',
              onEnter: () => applyWaypoint(waypoint),
              onEnterBack: () => applyWaypoint(waypoint),
            });
          }).filter(Boolean);

          const inner = ghost.querySelector<HTMLElement>('.journey-ghost-inner');
          if (inner) {
            gsap.to(inner, {
              y: -9,
              rotation: 2.5,
              duration: 2.4,
              ease: 'sine.inOut',
              yoyo: true,
              repeat: -1,
            });
          }

          let lastY = window.scrollY;
          let lastTime = performance.now();
          const leanTo = inner
            ? gsap.quickTo(inner, 'rotation', { duration: 0.5, ease: 'power2.out' })
            : null;
          const stretchTo = inner
            ? gsap.quickTo(inner, 'scaleY', { duration: 0.4, ease: 'power2.out' })
            : null;
          let marqueeAnimation: Animation | null = null;

          const tick = () => {
            const now = performance.now();
            const delta = Math.max(1, now - lastTime);
            const velocity = ((window.scrollY - lastY) / delta) * 1000;
            lastY = window.scrollY;
            lastTime = now;

            const lean = gsap.utils.clamp(-14, 14, velocity * 0.028);
            leanTo?.(lean);
            stretchTo?.(1 + Math.min(0.14, Math.abs(velocity) * 0.00035));

            if (!marqueeAnimation) {
              marqueeAnimation =
                document
                  .getAnimations()
                  .find(
                    (animation) =>
                      animation instanceof CSSAnimation &&
                      animation.animationName === 'factMarquee',
                  ) ?? null;
            }
            if (marqueeAnimation) {
              marqueeAnimation.playbackRate = 1 + Math.min(2.2, Math.abs(velocity) * 0.004);
            }
          };
          gsap.ticker.add(tick);

          return () => {
            gsap.ticker.remove(tick);
            journeyTriggers.forEach((trigger) => trigger.kill());
          };
        });

        return () => ctx.revert();
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
                trigger: '.signal-catch',
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
              trigger: '.signal-catch',
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
          const split = SplitText.create(heading, { type: 'words', mask: 'words' });
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

  return (
    <div className="journey-layer" aria-hidden="true">
      <div className="journey-ghost" ref={ghostRef}>
        <div className="journey-ghost-inner">
          <GhostMark size={62} bodyColor="#0f0f0d" eyeColor="#ffffff" />
        </div>
      </div>
    </div>
  );
}
