import { useLayoutEffect, useRef } from 'react';
import { GhostMark } from '../components/GhostSVG';
import { gsap, ScrollTrigger, SplitText, ensureGsap, prefersReducedMotion } from './gsapSetup';

type Waypoint = {
  selector: string;
  hide?: boolean;
  x: () => number;
  y: () => number;
  scale?: number;
};

const gutterX = () => window.innerWidth - 118;
const vw = () => window.innerWidth;
const vh = () => window.innerHeight;

const WAYPOINTS: Waypoint[] = [
  { selector: '.home-hero', x: gutterX, y: () => vh() * 0.24, scale: 1 },
  { selector: '.signal-catch', hide: true, x: gutterX, y: () => vh() * 0.5 },
  { selector: '.feature-scroll', x: gutterX, y: () => vh() * 0.36, scale: 0.85 },
  { selector: '.platforms-flat', x: gutterX, y: () => vh() * 0.44, scale: 0.9 },
  { selector: '.privacy-band', x: () => vw() * 0.8, y: () => vh() * 0.4, scale: 1 },
  { selector: '.footprint-section', x: gutterX, y: () => vh() * 0.4, scale: 0.9 },
  { selector: '.install-rhythm', hide: true, x: gutterX, y: () => vh() * 0.4 },
  { selector: '.faq-flat', x: () => vw() * 0.16, y: () => vh() * 0.55, scale: 1.05 },
  { selector: '.home-final', x: () => vw() * 0.74, y: () => vh() * 0.32, scale: 1 },
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
          const first = WAYPOINTS[0];
          gsap.set(ghost, { x: first.x(), y: first.y(), scale: first.scale ?? 1 });

          let journey: gsap.core.Timeline | null = null;
          let lastFingerprint = '';

          const documentTop = (selector: string) => {
            const section = document.querySelector<HTMLElement>(selector);
            if (!section) return null;
            return section.getBoundingClientRect().top + window.scrollY;
          };

          const buildJourney = () => {
            const maxScroll = Math.max(1, ScrollTrigger.maxScroll(window));
            const points = WAYPOINTS.map((waypoint) => ({
              waypoint,
              top: documentTop(waypoint.selector),
            })).filter((point): point is { waypoint: Waypoint; top: number } => point.top !== null);
            if (points.length < 2) return;

            // Skip the rebuild when the route hasn't moved — unrelated
            // ScrollTrigger refreshes (reveals, images, Lenis) would otherwise
            // kill and recreate the timeline mid-flight for no reason.
            const fingerprint = `${points.map((point) => Math.round(point.top)).join(',')}|${Math.round(maxScroll)}|${Math.round(vw())}x${Math.round(vh())}`;
            if (fingerprint === lastFingerprint) return;
            lastFingerprint = fingerprint;

            journey?.scrollTrigger?.kill();
            journey?.kill();

            journey = gsap.timeline({
              scrollTrigger: {
                trigger: document.body,
                start: 'top top',
                end: 'bottom bottom',
                scrub: 1.1,
              },
            });

            // Max ghost pixels traveled per scrolled pixel. Long sweeps get a
            // proportionally longer slice of the timeline instead of racing
            // across the viewport in a short scroll gap.
            const maxSpeed = 2.0;
            let cursor = Math.max(0, points[0].top - vh() * 0.5);

            for (let index = 0; index < points.length - 1; index += 1) {
              const current = points[index];
              const next = points[index + 1];
              const naturalEnd = Math.max(cursor + 1, next.top - vh() * 0.5);
              const distance = Math.hypot(
                next.waypoint.x() - current.waypoint.x(),
                next.waypoint.y() - current.waypoint.y(),
              );
              const duration = Math.max(naturalEnd - cursor, distance / maxSpeed);
              const fade = Math.max(1, duration * 0.28);

              journey.to(
                ghost,
                {
                  x: next.waypoint.x(),
                  y: next.waypoint.y(),
                  scale: next.waypoint.scale ?? 1,
                  ease: 'power1.inOut',
                  duration,
                },
                cursor,
              );

              // Fade only near the segment edges so the ghost is never a
              // half-transparent blur drifting across the page mid-travel.
              if (next.waypoint.hide) {
                journey.to(ghost, { opacity: 0, ease: 'power1.out', duration: fade }, cursor);
              } else if (current.waypoint.hide) {
                journey.to(
                  ghost,
                  { opacity: 1, ease: 'power1.in', duration: fade },
                  cursor + duration - fade,
                );
              }

              cursor += duration;
            }

            // Render the full path once so every tween captures its true start
            // value along the route, then land on the current scroll position.
            // Without this, a rebuild while scrolled down records the ghost's
            // mid-flight position as a segment start and bends the route.
            const progress = journey.scrollTrigger?.progress ?? 0;
            journey.progress(1).progress(0).progress(progress);
          };

          buildJourney();
          ScrollTrigger.addEventListener('refresh', buildJourney);

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
            ScrollTrigger.removeEventListener('refresh', buildJourney);
            journey?.scrollTrigger?.kill();
            journey?.kill();
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
