import { useLayoutEffect, useRef } from 'react';
import { GhostMark } from '../components/GhostSVG';
import { gsap, ensureGsap, prefersReducedMotion } from './gsapSetup';

const KINDS = ['seen', 'typing', 'story'] as const;
type Kind = (typeof KINDS)[number];

/* Stage coordinates (viewBox 900 x 620). The ghost sits at the checkpoint. */
const APPROACH: Record<Kind, string> = {
  seen: 'M 215 160 C 330 148, 392 232, 464 286',
  typing: 'M 215 300 C 330 300, 396 302, 460 301',
  story: 'M 215 440 C 330 452, 392 368, 464 316',
};
const EXIT = 'M 494 300 C 590 296, 678 292, 770 288';
const ROW_TOP: Record<Kind, string> = { seen: '25.8%', typing: '48.4%', story: '71%' };
const ROW_LABEL: Record<Kind, string> = { seen: 'Seen', typing: 'Typing…', story: 'Story view' };
const RIPPLE_AT: Record<Kind, { cx: number; cy: number }> = {
  seen: { cx: 464, cy: 286 },
  typing: { cx: 460, cy: 301 },
  story: { cx: 464, cy: 316 },
};

function SignalIcon({ kind }: { kind: Kind }) {
  if (kind === 'seen') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M2 12c2.7-4.7 6-7 10-7s7.3 2.3 10 7c-2.7 4.7-6 7-10 7s-7.3-2.3-10-7Z" />
        <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === 'typing') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="2.3" />
        <circle cx="12" cy="12" r="2.3" />
        <circle cx="19" cy="12" r="2.3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
      <circle cx="12" cy="12" r="8" strokeDasharray="42 9" strokeLinecap="round" />
    </svg>
  );
}

export function SignalCatchScene() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    ensureGsap();
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const ghost = root.querySelector<HTMLElement>('.signal-catch-ghost');
      const ghostInner = ghost?.querySelector<HTMLElement>('.journey-ghost-inner');
      const serverDot = root.querySelector<HTMLElement>('.catch-server-dot');
      const counter = root.querySelector<HTMLElement>('.catch-tray-count');
      const intro = root.querySelectorAll<HTMLElement>('.catch-intro');
      const railFill = root.querySelector<HTMLElement>('.signal-catch-rail i');
      const steps = root.querySelectorAll<HTMLElement>('.signal-catch-rail .rail-step');
      const captions = root.querySelectorAll<HTMLElement>('.signal-catch-caption span');
      const exitPath = root.querySelector<SVGPathElement>('#route-exit');
      const litPaths = KINDS.map((kind) =>
        root.querySelector<SVGPathElement>(`#route-lit-${kind}`),
      );
      const pulses = KINDS.map(
        (kind) => root.querySelector<HTMLElement>(`.catch-pulse-${kind}`),
      );
      const spark = root.querySelector<HTMLElement>('.catch-spark');

      // Solid lit overlays are drawn on in sync with each pulse; the exit
      // wire is a dim dashed hope that gets severed in the HOLD phase.
      litPaths.forEach((path) => {
        if (!path) return;
        const len = path.getTotalLength();
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      });
      pulses.forEach((pulse, index) => {
        if (!pulse) return;
        gsap.set(pulse, {
          motionPath: {
            path: `#route-${KINDS[index]}`,
            align: `#route-${KINDS[index]}`,
            alignOrigin: [0.5, 0.5],
          },
          scale: 0.4,
          opacity: 0,
        });
      });
      if (spark && exitPath) {
        gsap.set(spark, {
          motionPath: { path: exitPath, align: exitPath, alignOrigin: [0.5, 0.5], start: 0, end: 0 },
          opacity: 0,
        });
      }

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.7,
          onUpdate: (self) => {
            const progress = self.progress;
            const step = progress < 0.68 ? 0 : progress < 0.87 ? 1 : 2;
            steps.forEach((item, index) => {
              item.classList.toggle('is-active', index === step);
            });
            if (railFill) railFill.style.transform = `scaleY(${progress.toFixed(4)})`;
            if (counter) {
              const held =
                (progress > 0.25 ? 1 : 0) + (progress > 0.41 ? 1 : 0) + (progress > 0.56 ? 1 : 0);
              const next = `held ${held} / 3`;
              if (counter.textContent !== next) counter.textContent = next;
            }
          },
        },
      });

      // Intro — the stage assembles.
      tl.fromTo(
        intro,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.05, ease: 'power2.out', stagger: 0.008 },
        0,
      );

      KINDS.forEach((kind, index) => {
        const row = root.querySelector<HTMLElement>(`.catch-row-${kind}`);
        const pulse = pulses[index];
        const chip = root.querySelector<HTMLElement>(`.catch-chip-${kind}`);
        const ripple = root.querySelector<SVGPathElement>(`#ripple-${kind}`);
        const lit = litPaths[index];
        if (!pulse || !lit) return;

        const start = 0.1 + index * 0.155;
        const travel = 0.105;
        const catchAt = start + travel + 0.005;

        // The row fires.
        if (row) {
          tl.fromTo(
            row,
            { opacity: 0.5 },
            { opacity: 1, duration: 0.012, ease: 'power1.out' },
            start,
          );
        }

        // Pulse launches and rides the wire; the wire lights up behind it.
        tl.set(pulse, { opacity: 1, scale: 1 }, start).to(
          pulse,
          {
            motionPath: {
              path: `#route-${kind}`,
              align: `#route-${kind}`,
              alignOrigin: [0.5, 0.5],
            },
            ease: 'power1.inOut',
            duration: travel,
          },
          start,
        );
        tl.to(lit, { strokeDashoffset: 0, ease: 'power1.inOut', duration: travel }, start);

        // The ghost leans into the catch.
        if (ghost) {
          tl.to(
            ghost,
            { x: -12, rotation: -5, duration: travel * 0.45, ease: 'power1.out' },
            start + travel * 0.55,
          );
        }

        // Caught — the pulse is absorbed, the wire ripples.
        tl.to(pulse, { scale: 0.15, opacity: 0, duration: 0.018, ease: 'power3.in' }, catchAt);
        if (ripple) {
          tl.fromTo(
            ripple,
            { opacity: 0.55, scale: 0.3 },
            { opacity: 0, scale: 2.4, duration: 0.05, ease: 'power1.out' },
            catchAt,
          );
        }
        if (ghost) {
          tl.to(ghost, { scaleX: 1.14, scaleY: 0.84, duration: 0.006, ease: 'power2.in' }, catchAt)
            .to(
              ghost,
              { scaleX: 1, scaleY: 1, duration: 0.02, ease: 'power2.out' },
              catchAt + 0.006,
            )
            .to(ghost, { x: 0, rotation: 0, duration: 0.03, ease: 'power1.inOut' }, catchAt + 0.008);
        }

        // A spark escapes down the exit wire — and dies mid-flight.
        if (spark && exitPath) {
          tl.to(
            spark,
            {
              motionPath: {
                path: exitPath,
                align: exitPath,
                alignOrigin: [0.5, 0.5],
                start: 0,
                end: 0.24,
              },
              opacity: 0,
              scale: 0.4,
              duration: 0.035,
              ease: 'power1.out',
            },
            catchAt + 0.004,
          );
        }

        // The held chip drops into the local tray.
        if (chip) {
          tl.fromTo(
            chip,
            { opacity: 0, scale: 1.8, rotation: -14 },
            { opacity: 1, scale: 1, rotation: -3, duration: 0.012, ease: 'power3.in' },
            catchAt + 0.008,
          );
        }

        // The server's waiting dot dims another step.
        if (serverDot) {
          tl.to(serverDot, { opacity: 1 - (index + 1) * 0.27, duration: 0.02 }, catchAt + 0.01);
        }
      });

      // HOLD — the exit wire visibly breaks apart; nothing will ever cross it.
      if (exitPath) {
        tl.to(
          exitPath,
          { strokeDasharray: '2 44', opacity: 0.12, duration: 0.04, ease: 'power1.inOut' },
          0.74,
        );
      }
      if (serverDot) {
        tl.to(serverDot, { opacity: 0.1, duration: 0.03 }, 0.76);
      }
      if (ghost) {
        tl.to(ghost, { y: -9, duration: 0.04, ease: 'sine.inOut' }, 0.76).to(
          ghost,
          { y: 0, duration: 0.05, ease: 'sine.inOut' },
          0.8,
        );
      }

      // Captions crossfade — one line at a time, never a wall of text.
      const captionAt: Array<[number, number]> = [
        [0.04, 0.64],
        [0.68, 0.83],
        [0.87, 2],
      ];
      captions.forEach((caption, index) => {
        const [inAt, outAt] = captionAt[index];
        tl.fromTo(
          caption,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.03, ease: 'power2.out' },
          inAt,
        );
        if (outAt < 2) {
          tl.to(caption, { opacity: 0, y: -10, duration: 0.025, ease: 'power1.in' }, outAt);
        }
      });

      // Idle hover on the ghost's inner layer so it never fights the scrub.
      if (ghostInner) {
        gsap.to(ghostInner, {
          y: -8,
          rotation: 2,
          duration: 2.2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      }

      // Pad the timeline so the QUIET payoff holds until the pin releases.
      tl.to({}, { duration: 0.07 }, 0.93);
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
            viewBox="0 0 900 620"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <g className="catch-routes">
              {KINDS.map((kind) => (
                <path
                  key={`base-${kind}`}
                  id={`route-${kind}`}
                  d={APPROACH[kind]}
                  className="catch-route-base catch-intro"
                />
              ))}
              {KINDS.map((kind) => (
                <path
                  key={`lit-${kind}`}
                  id={`route-lit-${kind}`}
                  d={APPROACH[kind]}
                  className="catch-route-lit"
                />
              ))}
              <path id="route-exit" d={EXIT} className="catch-route-exit catch-intro" />
            </g>
            <g className="catch-ripples">
              {KINDS.map((kind) => (
                <circle
                  key={kind}
                  id={`ripple-${kind}`}
                  className="catch-ripple"
                  cx={RIPPLE_AT[kind].cx}
                  cy={RIPPLE_AT[kind].cy}
                  r={30}
                />
              ))}
            </g>
          </svg>

          <div className="catch-tab" aria-hidden="true">
            <small className="catch-micro catch-micro-tab catch-intro">your tab</small>
            <div className="catch-tab-card catch-intro">
              {KINDS.map((kind) => (
                <div
                  key={kind}
                  className={`catch-row catch-row-${kind}`}
                  style={{ top: ROW_TOP[kind] }}
                >
                  <span className="catch-row-icon">
                    <SignalIcon kind={kind} />
                  </span>
                  <small>{ROW_LABEL[kind]}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="catch-checkpoint" aria-hidden="true">
            <span className="signal-catch-ghost catch-intro">
              <span className="journey-ghost-inner">
                <GhostMark size={150} bodyColor="#0f0f0d" eyeColor="#ffffff" />
              </span>
            </span>
            <small className="catch-micro catch-micro-ghost catch-intro">ghostify</small>
          </div>

          <div className="catch-tray catch-intro" aria-hidden="true">
            <small className="catch-tray-label">held in this browser</small>
            <div className="catch-chips">
              {KINDS.map((kind) => (
                <span key={kind} className={`catch-chip catch-chip-${kind}`}>
                  <SignalIcon kind={kind} />
                  <b>held</b>
                </span>
              ))}
            </div>
            <small className="catch-tray-count">held 0 / 3</small>
          </div>

          <div className="catch-server catch-intro" aria-hidden="true">
            <small className="catch-micro">meta server</small>
            <div className="catch-server-stack">
              <i />
              <i />
              <i />
            </div>
            <span className="catch-server-dot-wrap">
              <span className="catch-server-dot" />
            </span>
            <small className="catch-server-status">delivered: 0</small>
          </div>

          {KINDS.map((kind) => (
            <div key={kind} className={`catch-pulse catch-pulse-${kind}`} aria-hidden="true">
              <SignalIcon kind={kind} />
            </div>
          ))}
          <div className="catch-spark" aria-hidden="true" />
        </div>

        <p className="signal-catch-caption">
          <span>You read. You type. You watch.</span>
          <span>Every reply signal stops at the ghost.</span>
          <span>The server waits. Nothing arrives.</span>
        </p>
      </div>
    </section>
  );
}
