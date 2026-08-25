import { useLayoutEffect, useRef } from 'react';
import { GhostMark } from '../components/GhostSVG';
import { gsap, ensureGsap, prefersReducedMotion } from './gsapSetup';

const ROUTES = {
  seen: 'M -80 128 C 150 104, 300 190, 460 168 C 580 152, 660 226, 708 282',
  typing: 'M -80 330 C 170 310, 320 350, 480 330 C 590 316, 650 324, 704 330',
  story: 'M -80 532 C 160 520, 300 442, 460 468 C 590 490, 660 414, 708 378',
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
        <span className="envelope-stamp postmark">
          <small>Ghostify post</small>
          <b>Held</b>
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
      const inners = envelopes.map((envelope) =>
        envelope.querySelector<HTMLElement>('.envelope-inner'),
      );
      const stamps = Array.from(root.querySelectorAll<HTMLElement>('.envelope-stamp'));
      const trayStamp = root.querySelector<HTMLElement>('.catch-stamp');
      const counter = root.querySelector<HTMLElement>('.catch-tray-count');
      const ghost = root.querySelector<HTMLElement>('.signal-catch-ghost');
      const ghostInner = ghost?.querySelector<HTMLElement>('.journey-ghost-inner');
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
          scrub: 0.7,
          onUpdate: (self) => {
            const progress = self.progress;
            const step = progress < 0.24 ? 0 : progress < 0.68 ? 1 : 2;
            steps.forEach((item, index) => {
              item.classList.toggle('is-active', index === step);
            });
            if (railFill) railFill.style.transform = `scaleY(${progress.toFixed(4)})`;
            if (counter) {
              const held =
                (progress > 0.3 ? 1 : 0) + (progress > 0.48 ? 1 : 0) + (progress > 0.66 ? 1 : 0);
              const next = `Held ${held} / 3`;
              if (counter.textContent !== next) counter.textContent = next;
            }
          },
        },
      });

      tl.fromTo(
        intro,
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.045, ease: 'power2.out', stagger: 0.012 },
        0,
      );

      const pressGhost = (at: number) => {
        const target = ghostInner ?? ghost;
        if (!target) return;
        tl.to(target, { scale: 0.92, duration: 0.022, ease: 'power2.in' }, at).to(
          target,
          { scale: 1, duration: 0.034, ease: 'power2.out' },
          at + 0.022,
        );
      };

      envelopes.forEach((envelope, index) => {
        const kind = ['seen', 'typing', 'story'][index];
        const route = root.querySelector<SVGPathElement>(`#catch-route-${kind}`);
        const inner = inners[index];
        if (!route || !inner) return;

        const moveStart = 0.055 + index * 0.185;
        const moveDur = 0.185;

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

        tl.to(inner, { rotation: 5, duration: moveDur * 0.38, ease: 'sine.in' }, moveStart)
          .to(
            inner,
            { rotation: -4, duration: moveDur * 0.36, ease: 'sine.inOut' },
            moveStart + moveDur * 0.38,
          )
          .to(
            inner,
            { rotation: 0, duration: moveDur * 0.26, ease: 'sine.out' },
            moveStart + moveDur * 0.74,
          );

        const stampAt = moveStart + moveDur + 0.008;
        tl.fromTo(
          stamps[index],
          { opacity: 0, scale: 2.2, rotation: -30 },
          { opacity: 1, scale: 1, rotation: -9, duration: 0.032, ease: 'power3.in' },
          stampAt,
        );
        tl.to(inner, { scaleY: 0.9, duration: 0.018, ease: 'power2.in' }, stampAt).to(
          inner,
          { scaleY: 1, duration: 0.03, ease: 'power2.out' },
          stampAt + 0.018,
        );
        pressGhost(stampAt);

        tl.to(
          inner,
          { rotation: -5 + index * 4, y: index * 4, duration: 0.03, ease: 'power2.out' },
          stampAt + 0.045,
        );
      });

      if (trayStamp) {
        tl.fromTo(
          trayStamp,
          { opacity: 0, scale: 2.4, rotation: -24 },
          { opacity: 1, scale: 1, rotation: -6, duration: 0.036, ease: 'power3.in' },
          0.72,
        );
        pressGhost(0.72);
      }

      captionLines.forEach((line, index) => {
        tl.fromTo(
          line,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.05, ease: 'power2.out' },
          0.8 + index * 0.055,
        );
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section className="signal-catch" aria-label="How Ghostify holds signals" ref={rootRef}>
      <div className="signal-catch-sticky">
        <div className="catch-grid-bg" aria-hidden="true" />

        <div className="signal-catch-rail" aria-hidden="true">
          <span className="rail-track">
            <i />
          </span>
          <span className="rail-step is-active">Catch</span>
          <span className="rail-step">Hold</span>
          <span className="rail-step">Quiet</span>
        </div>

        <h2 className="catch-headline catch-intro">
          Nothing leaves <em>this desk.</em>
        </h2>

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
              <small className="catch-tray-label">outgoing tray</small>
              <small className="catch-tray-count">Held 0 / 3</small>
            </span>
            <span className="catch-stamp postmark catch-intro">
              <small>Ghostify post</small>
              <b>Held</b>
              <small className="postmark-foot">in this browser</small>
            </span>
            <span className="signal-catch-ghost catch-intro">
              <span className="journey-ghost-inner">
                <GhostMark size={188} bodyColor="#0f0f0d" eyeColor="#ffffff" />
              </span>
            </span>
          </div>

          <CatchEnvelope kind="seen" />
          <CatchEnvelope kind="typing" />
          <CatchEnvelope kind="story" />
        </div>

        <p className="signal-catch-caption">
          <span>Three letters try to leave your tabs.</span>
          <span>The ghost postmaster holds every one.</span>
          <span>Delivered: nothing.</span>
        </p>
      </div>
    </section>
  );
}
