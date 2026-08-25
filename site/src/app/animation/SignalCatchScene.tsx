import { useLayoutEffect, useRef } from 'react';
import { GhostMark } from '../components/GhostSVG';
import { gsap, ensureGsap, prefersReducedMotion } from './gsapSetup';

const ROUTES = {
  seen: 'M -80 150 C 150 128, 300 205, 460 185 C 580 170, 660 240, 706 290',
  typing: 'M -80 330 C 170 312, 320 348, 480 330 C 590 318, 650 326, 702 330',
  story: 'M -80 510 C 160 498, 300 428, 460 452 C 590 472, 660 402, 706 370',
};

function CatchEnvelope({ kind }: { kind: 'seen' | 'typing' | 'story' }) {
  const label = kind === 'seen' ? 'Seen receipt' : kind === 'typing' ? 'Typing signal' : 'Story view';
  return (
    <div className={`catch-envelope catch-envelope-${kind}`}>
      <div className="envelope-inner">
        <span className="envelope-flap" aria-hidden="true" />
        <span className="envelope-postage" aria-hidden="true" />
        <span className="envelope-lines" aria-hidden="true">
          <i />
          <i />
        </span>
        <strong className="envelope-label">{label}</strong>
        <small className="envelope-sub">for: you only</small>
        <span className="envelope-stamp">
          <b>held</b>
        </span>
      </div>
    </div>
  );
}

export function SignalCatchScene() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    ensureGsap();
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const envelopes = Array.from(root.querySelectorAll<HTMLElement>('.catch-envelope'));
      const inners = envelopes.map((envelope) => envelope.querySelector<HTMLElement>('.envelope-inner'));
      const stamps = Array.from(root.querySelectorAll<HTMLElement>('.envelope-stamp'));
      const trayStamp = root.querySelector<HTMLElement>('.catch-stamp');
      const ghost = root.querySelector<HTMLElement>('.signal-catch-ghost');
      const routes = root.querySelectorAll<SVGPathElement>('.catch-route');
      const intro = root.querySelectorAll<HTMLElement>('.catch-intro');
      const captionLines = root.querySelectorAll<HTMLElement>('.signal-catch-caption span');
      const railFill = root.querySelector<HTMLElement>('.signal-catch-rail i');
      const steps = root.querySelectorAll<HTMLElement>('.signal-catch-rail .rail-step');

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.55,
          onUpdate: (self) => {
            const step = self.progress < 0.3 ? 0 : self.progress < 0.72 ? 1 : 2;
            steps.forEach((item, index) => {
              item.classList.toggle('is-active', index === step);
            });
            if (railFill) railFill.style.transform = `scaleY(${self.progress.toFixed(4)})`;
          },
        },
      });

      tl.fromTo(
        intro,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.05, ease: 'power2.out', stagger: 0.012 },
        0,
      );

      const pressGhost = (at: number) => {
        if (!ghost) return;
        tl.to(ghost, { scale: 0.93, duration: 0.025, ease: 'power2.in' }, at).to(
          ghost,
          { scale: 1, duration: 0.035, ease: 'power2.out' },
          at + 0.025,
        );
      };

      envelopes.forEach((envelope, index) => {
        const kind = ['seen', 'typing', 'story'][index];
        const route = root.querySelector<SVGPathElement>(`#catch-route-${kind}`);
        const inner = inners[index];
        if (!route || !inner) return;

        const moveStart = 0.07 + index * 0.185;
        const moveDur = 0.155;

        gsap.set(envelope, {
          motionPath: { path: route, align: route, alignOrigin: [0.5, 0.5] },
        });

        tl.to(
          envelope,
          {
            motionPath: {
              path: route,
              align: route,
              alignOrigin: [0.5, 0.5],
              autoRotate: false,
            },
            duration: moveDur,
            ease: 'power1.inOut',
          },
          moveStart,
        );

        if (inner) {
          tl.to(inner, { rotation: 4.5, duration: moveDur * 0.4, ease: 'sine.in' }, moveStart)
            .to(inner, { rotation: -3.5, duration: moveDur * 0.35, ease: 'sine.inOut' }, moveStart + moveDur * 0.4)
            .to(inner, { rotation: 0, duration: moveDur * 0.25, ease: 'sine.out' }, moveStart + moveDur * 0.75);
        }

        const stampAt = moveStart + moveDur + 0.005;
        tl.fromTo(
          stamps[index],
          { opacity: 0, scale: 1.9, rotation: -26 },
          { opacity: 1, scale: 1, rotation: -11, duration: 0.035, ease: 'power3.in' },
          stampAt,
        );
        pressGhost(stampAt);

        if (inner) {
          tl.to(inner, { rotation: -4 + index * 3.5, y: index * 3, duration: 0.03, ease: 'power2.out' }, stampAt + 0.04);
        }
      });

      if (trayStamp) {
        tl.fromTo(
          trayStamp,
          { opacity: 0, scale: 2.1, rotation: -20 },
          { opacity: 1, scale: 1, rotation: -7, duration: 0.04, ease: 'power3.in' },
          0.8,
        );
        pressGhost(0.8);
      }

      captionLines.forEach((line, index) => {
        tl.fromTo(
          line,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.055, ease: 'power2.out' },
          0.85 + index * 0.05,
        );
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section className="signal-catch" aria-label="How Ghostify holds signals" ref={rootRef}>
      <div className="signal-catch-sticky">
        <div className="signal-catch-rail" aria-hidden="true">
          <span className="rail-track">
            <i />
          </span>
          <span className="rail-step is-active">Catch</span>
          <span className="rail-step">Hold</span>
          <span className="rail-step">Quiet</span>
        </div>

        <div className="signal-catch-stage">
          <svg
            className="signal-catch-net"
            viewBox="0 0 900 660"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <g className="catch-routes">
              <path id="catch-route-seen" className="catch-route" d={ROUTES.seen} />
              <path id="catch-route-typing" className="catch-route" d={ROUTES.typing} />
              <path id="catch-route-story" className="catch-route" d={ROUTES.story} />
            </g>
          </svg>

          <div className="catch-desk" aria-hidden="true">
            <span className="catch-tray catch-intro">
              <small className="catch-tray-label">outgoing tray — nothing leaves</small>
            </span>
            <span className="catch-stamp catch-intro">
              <b>held</b>
              <small>in this browser</small>
            </span>
            <span className="signal-catch-ghost catch-intro">
              <GhostMark size={148} bodyColor="#0f0f0d" eyeColor="#ffffff" />
            </span>
          </div>

          <CatchEnvelope kind="seen" />
          <CatchEnvelope kind="typing" />
          <CatchEnvelope kind="story" />

          <p className="signal-catch-caption">
            <span>Three letters try to leave your tabs.</span>
            <span>The ghost postmaster holds every one.</span>
            <span>Delivered: nothing.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
