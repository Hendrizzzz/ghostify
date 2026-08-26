import { useLayoutEffect, useRef } from 'react';
import { GhostMark } from '../components/GhostSVG';
import {
  gsap,
  ScrollTrigger,
  ensureGsap,
  prefersReducedMotion,
  CustomWiggle,
  SplitText,
} from './gsapSetup';

const KINDS = ['seen', 'typing', 'story'] as const;
type Kind = (typeof KINDS)[number];

/* Stage coordinates (viewBox 900 x 620). The approach/exit paths are
   INVISIBLE guides — the only visible ink is the comet trail that rides a
   path while its pulse is in flight, then erases itself. No drawn lines,
   ever: the connection is communicated by motion, not by diagram wires. */
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

/* Discrete story beats. Scroll position only chooses WHICH beat is on
   stage (beatFor); each beat then plays at its own fixed, choreographed
   pace — scroll velocity can never race, smear, or zap the animation. */
const BEAT_LINES = [0.13, 0.34, 0.55, 0.73, 0.88] as const;
const ADDR_AT_BEAT_START = [
  'instagram.com',
  'instagram.com',
  'instagram.com',
  'messenger.com',
  'instagram.com',
  'instagram.com',
];
const RAIL_STEP_FOR_BEAT = [0, 0, 0, 0, 1, 2];
const RAIL_FILL_FOR_BEAT = [0.02, 0.2, 0.42, 0.62, 0.8, 1];

function beatFor(progress: number): number {
  for (let i = 0; i < BEAT_LINES.length; i += 1) {
    if (progress < BEAT_LINES[i]) return i;
  }
  return BEAT_LINES.length;
}

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

    CustomWiggle.create('ghostRecoil', { wiggles: 4, type: 'easeOut' });

    const ctx = gsap.context(() => {
      const ghost = root.querySelector<HTMLElement>('.signal-catch-ghost');
      const ghostInner = ghost?.querySelector<HTMLElement>('.journey-ghost-inner');
      const serverDot = root.querySelector<HTMLElement>('.catch-server-dot');
      const serverCard = root.querySelector<HTMLElement>('.catch-server-card');
      const counter = root.querySelector<HTMLElement>('.catch-tray-count');
      const intro = root.querySelectorAll<HTMLElement>('.catch-intro');
      const railFill = root.querySelector<HTMLElement>('.signal-catch-rail i');
      const steps = root.querySelectorAll<HTMLElement>('.signal-catch-rail .rail-step');
      const captions = root.querySelectorAll<HTMLElement>('.signal-catch-caption span');
      const addrText = root.querySelector<HTMLElement>('.catch-addr-text');
      const rows = KINDS.map((k) => root.querySelector<HTMLElement>(`.catch-row-${k}`));
      const chips = KINDS.map((k) => root.querySelector<HTMLElement>(`.catch-chip-${k}`));
      const pulses = KINDS.map((k) => root.querySelector<HTMLElement>(`.catch-pulse-${k}`));
      const trails = KINDS.map((k) => root.querySelector<SVGPathElement>(`#trail-${k}`));
      const glows = KINDS.map((k) => root.querySelector<SVGPathElement>(`#trail-glow-${k}`));
      const ripples = KINDS.map((k) => root.querySelector<SVGCircleElement>(`#ripple-${k}`));
      const exitTrail = root.querySelector<SVGPathElement>('#trail-exit');
      const exitGlow = root.querySelector<SVGPathElement>('#trail-glow-exit');
      const calmRipple = root.querySelector<SVGCircleElement>('#ripple-calm');
      const spark = root.querySelector<HTMLElement>('.catch-spark');

      // Initial state: stage hidden; trails zero-length (they are the only
      // visible ink on a path, and only while a pulse is in flight).
      gsap.set(intro, { opacity: 0, y: 18 });
      [...trails, ...glows, exitTrail, exitGlow].forEach((path) => {
        if (path) gsap.set(path, { visibility: 'visible', drawSVG: '0% 0%' });
      });

      /* ---- beat plumbing ------------------------------------------------ */
      const beats: gsap.core.Timeline[] = [];

      // Rewind the whole stage to the state this beat starts from, so any
      // jump (fast flick up/down, refresh mid-pin) lands deterministically.
      const normalize = (tl: gsap.core.Timeline, beat: number) => {
        const caught = Math.max(0, Math.min(3, beat - 1));
        const dotOp = beat >= 5 ? 0.08 : 1 - 0.25 * caught;
        const capOn = beat >= 5 ? 1 : 0;
        rows.forEach((row, i) => {
          if (row) {
            tl.to(row, { opacity: i < caught ? 1 : 0.5, duration: 0.2, ease: 'power1.out' }, 0);
          }
        });
        chips.forEach((chip, i) => {
          if (!chip) return;
          if (i < caught) {
            tl.to(chip, { y: 0, scale: 1, opacity: 1, duration: 0.2, ease: 'power1.out' }, 0);
          } else {
            tl.to(chip, { y: 22, scale: 0.7, opacity: 0, duration: 0.18, ease: 'power1.out' }, 0);
          }
        });
        if (counter) tl.set(counter, { textContent: `held ${caught} / 3` }, 0);
        if (serverDot) tl.to(serverDot, { opacity: dotOp, duration: 0.25, ease: 'power1.out' }, 0);
        if (serverCard) tl.to(serverCard, { opacity: beat >= 5 ? 0.6 : 1, duration: 0.25 }, 0);
        if (addrText) tl.set(addrText, { textContent: ADDR_AT_BEAT_START[beat] }, 0);
        captions.forEach((cap, i) => {
          tl.to(
            cap,
            {
              opacity: i === capOn ? 1 : 0,
              y: i === capOn ? 0 : i < capOn ? -10 : 14,
              duration: 0.22,
              ease: 'power1.out',
            },
            0,
          );
        });
        if (ghost) {
          tl.to(
            ghost,
            { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0, duration: 0.2, ease: 'power1.out' },
            0,
          );
        }
        pulses.forEach((p) => p && tl.set(p, { opacity: 0, y: 0 }, 0));
        if (spark) tl.set(spark, { opacity: 0, y: 0, scale: 1 }, 0);
        [...trails, ...glows, exitTrail, exitGlow].forEach((path) => {
          if (path) tl.set(path, { drawSVG: '0% 0%' }, 0);
        });
        [...ripples, calmRipple].forEach((r) => r && tl.set(r, { scale: 0.35, opacity: 0 }, 0));
      };

      const buildBeat = (beat: number, action: (tl: gsap.core.Timeline) => void) => {
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
        normalize(tl, beat);
        const act = gsap.timeline({ defaults: { ease: 'power2.out' } });
        action(act);
        tl.add(act, 0.32);
        tl.to({}, { duration: 0.35 }); // tail room so a beat never clips
        beats.push(tl);
      };

      /* ---- the catch, choreographed once per signal ---------------------- */
      const buildCatch = (tl: gsap.core.Timeline, kind: Kind, beat: number) => {
        const i = KINDS.indexOf(kind);
        const row = rows[i];
        const pulse = pulses[i];
        const pair = [trails[i], glows[i]].filter(Boolean) as SVGPathElement[];
        const chip = chips[i];
        const ripple = ripples[i];
        const lean = kind === 'seen' ? -6 : kind === 'story' ? 6 : -3;

        // The row wakes and fires.
        if (row) tl.fromTo(row, { opacity: 0.5 }, { opacity: 1, duration: 0.18 }, 0);

        // Pulse launches; the comet trail draws behind it, then erases.
        if (pulse) {
          tl.set(pulse, { opacity: 0, scale: 0.5 }, 0)
            .to(pulse, { opacity: 1, scale: 1.05, duration: 0.16 }, 0.02)
            .to(
              pulse,
              {
                motionPath: {
                  path: `#route-${kind}`,
                  align: `#route-${kind}`,
                  alignOrigin: [0.5, 0.5],
                },
                duration: 0.85,
                ease: 'power1.inOut',
              },
              0.12,
            )
            .to(pulse, { scale: 0.2, opacity: 0, duration: 0.16, ease: 'power3.in' }, 0.97);
        }
        if (pair.length) {
          tl.set(pair, { drawSVG: '0% 0%' }, 0)
            .to(pair, { drawSVG: '0% 100%', duration: 0.85, ease: 'power1.inOut' }, 0.12)
            .to(pair, { drawSVG: '100% 100%', duration: 0.4, ease: 'power1.in' }, 1.0);
        }

        // The ghost leans in, squashes, swallows, and recoils.
        if (ghost) {
          tl.to(ghost, { rotation: lean, duration: 0.22 }, 0.72)
            .to(ghost, { scaleY: 0.84, scaleX: 1.12, duration: 0.14 }, 0.97)
            .to(ghost, { scaleY: 1, scaleX: 1, duration: 0.55, ease: 'ghostRecoil' }, 1.12)
            .to(ghost, { rotation: 0, duration: 0.8, ease: 'ghostRecoil' }, 0.98);
        }
        if (ghostInner) {
          tl.to(ghostInner, { scaleY: 1.14, scaleX: 0.94, duration: 0.14 }, 1.0).to(
            ghostInner,
            { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'power2.inOut' },
            1.16,
          );
        }
        if (ripple) {
          tl.fromTo(
            ripple,
            { scale: 0.35, opacity: 0.9 },
            { scale: 1.7, opacity: 0, duration: 0.6, ease: 'power1.out', immediateRender: false },
            0.98,
          );
        }

        // The signal lands in the held tray; the server waits a little less.
        if (chip) {
          tl.fromTo(
            chip,
            {
              y: -56,
              scale: 0.55,
              opacity: 0,
              rotation: kind === 'seen' ? -10 : kind === 'story' ? 10 : 0,
            },
            {
              y: 0,
              scale: 1,
              opacity: 1,
              rotation: 0,
              duration: 0.55,
              ease: 'bounce.out',
              immediateRender: false,
            },
            1.05,
          );
        }
        if (counter) {
          tl.set(counter, { textContent: `held ${beat} / 3` }, 1.2).fromTo(
            counter,
            { scale: 1.3 },
            { scale: 1, duration: 0.3, immediateRender: false },
            1.2,
          );
        }
        if (serverDot) tl.to(serverDot, { opacity: 1 - 0.25 * beat, duration: 0.4 }, 1.05);

        // The address bar follows whichever tab is firing.
        if (addrText && beat === 2) {
          tl.to(
            addrText,
            {
              scrambleText: { text: 'messenger.com', chars: 'lowerCase', speed: 1.4 },
              duration: 0.55,
            },
            0.05,
          );
        }
        if (addrText && beat === 3) {
          tl.to(
            addrText,
            {
              scrambleText: { text: 'instagram.com', chars: 'lowerCase', speed: 1.4 },
              duration: 0.55,
            },
            0.05,
          );
        }
      };

      /* ---- the six beats -------------------------------------------------- */
      // 0 — the desk assembles.
      buildBeat(0, (tl) => {
        tl.fromTo(
          intro,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.55, stagger: 0.05 },
          0,
        );
      });

      // 1-3 — seen, typing, story: fired, caught, held.
      buildBeat(1, (tl) => buildCatch(tl, 'seen', 1));
      buildBeat(2, (tl) => buildCatch(tl, 'typing', 2));
      buildBeat(3, (tl) => buildCatch(tl, 'story', 3));

      // 4 — HOLD: one spark makes a run for the server and dies mid-air.
      buildBeat(4, (tl) => {
        if (captions[0]) {
          tl.to(captions[0], { opacity: 0, y: -10, duration: 0.3, ease: 'power1.in' }, 0);
        }
        if (captions[1]) {
          tl.fromTo(captions[1], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4 }, 0.25);
        }
        if (spark) {
          tl.to(spark, { opacity: 1, scale: 1, duration: 0.12 }, 0.35)
            .to(
              spark,
              {
                motionPath: {
                  path: '#route-exit',
                  align: '#route-exit',
                  alignOrigin: [0.5, 0.5],
                  start: 0,
                  end: 0.45,
                },
                duration: 0.75,
                ease: 'power1.in',
              },
              0.4,
            )
            .to(spark, { opacity: 0.25, duration: 0.07, yoyo: true, repeat: 5, ease: 'none' }, 1.15)
            .to(
              spark,
              { y: '+=18', scale: 0.2, opacity: 0, duration: 0.35, ease: 'power2.in' },
              1.55,
            );
        }
        const exitPair = [exitTrail, exitGlow].filter(Boolean) as SVGPathElement[];
        if (exitPair.length) {
          tl.set(exitPair, { drawSVG: '0% 0%' }, 0.35)
            .to(exitPair, { drawSVG: '0% 45%', duration: 0.75, ease: 'power1.in' }, 0.4)
            .to(exitPair, { drawSVG: '0% 0%', duration: 0.5, ease: 'power2.in' }, 1.35);
        }
        if (serverDot) tl.to(serverDot, { opacity: 0.08, duration: 0.5 }, 1.2);
        if (serverCard) {
          tl.to(serverCard, { keyframes: { x: [-3, 3, -2, 2, 0] }, duration: 0.45 }, 1.2);
        }
        if (ghost) {
          tl.to(ghost, { y: -8, duration: 0.25 }, 1.1).to(
            ghost,
            { y: 0, duration: 0.5, ease: 'power2.inOut' },
            1.4,
          );
        }
      });

      // 5 — QUIET: nothing arrived. The desk rests.
      buildBeat(5, (tl) => {
        if (captions[1]) {
          tl.to(captions[1], { opacity: 0, y: -10, duration: 0.3, ease: 'power1.in' }, 0);
        }
        if (captions[2]) {
          tl.fromTo(captions[2], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45 }, 0.3);
        }
        if (calmRipple) {
          tl.fromTo(
            calmRipple,
            { scale: 0.4, opacity: 0.55 },
            { scale: 2.4, opacity: 0, duration: 1.3, ease: 'power1.out', immediateRender: false },
            0.4,
          );
        }
        if (ghost) {
          tl.to(ghost, { y: -6, duration: 0.6, ease: 'sine.inOut' }, 0.2).to(
            ghost,
            { y: 0, duration: 1.0, ease: 'sine.inOut' },
            0.9,
          );
        }
      });

      /* ---- scroll wiring: position picks the beat, never the pace -------- */
      let currentBeat = -1;
      const goToBeat = (index: number) => {
        if (index === currentBeat || !beats[index]) return;
        currentBeat = index;
        steps.forEach((el, i) => el.classList.toggle('is-active', i === RAIL_STEP_FOR_BEAT[index]));
        if (railFill) {
          gsap.to(railFill, {
            scaleY: RAIL_FILL_FOR_BEAT[index],
            duration: 0.5,
            ease: 'power2.out',
          });
        }
        beats.forEach((b, i) => {
          if (i !== index) b.pause();
        });
        beats[index].restart();
      };

      // Pre-assemble the normalized beat-0 stage so the pin never shows a
      // half-built scene; the first scroll step into the pin replays intro.
      beats[0].pause(0.31);

      const st = ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => goToBeat(beatFor(self.progress)),
      });
      if (st.progress > 0) goToBeat(beatFor(st.progress));

      /* ---- headline: masked word rise on first approach ------------------- */
      const headline = root.querySelector<HTMLElement>('.catch-headline');
      if (headline) {
        const split = new SplitText(headline, {
          type: 'lines,words',
          linesClass: 'catch-split-line',
        });
        gsap.set(split.words, { yPercent: 115 });
        gsap.to(split.words, {
          yPercent: 0,
          duration: 0.9,
          ease: 'power4.out',
          stagger: 0.05,
          scrollTrigger: {
            trigger: root,
            start: 'top 60%',
            toggleActions: 'play none none reverse',
          },
        });
      }

      // Idle life on separate layers/properties so it never fights the beats.
      if (ghostInner) {
        gsap.to(ghostInner, { y: -10, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      }
      const tray = root.querySelector<HTMLElement>('.catch-tray');
      if (tray) {
        gsap.to(tray, {
          scale: 1.02,
          duration: 2.8,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          transformOrigin: 'center bottom',
        });
      }
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

        <h2 className="catch-headline">
          Nothing leaves <em>this desk.</em>
        </h2>

        <div className="signal-catch-stage">
          <svg
            className="signal-catch-net"
            viewBox="0 0 900 620"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="catch-trail-grad"
                x1="180"
                y1="0"
                x2="800"
                y2="0"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0" stopColor="#6f59c8" stopOpacity="0" />
                <stop offset="0.3" stopColor="#6f59c8" stopOpacity="0.85" />
                <stop offset="0.42" stopColor="#6f59c8" stopOpacity="1" />
                <stop offset="0.75" stopColor="#6f59c8" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g className="catch-routes">
              {KINDS.map((kind) => (
                <path
                  key={`guide-${kind}`}
                  id={`route-${kind}`}
                  d={APPROACH[kind]}
                  className="catch-route-guide"
                />
              ))}
              {KINDS.map((kind) => (
                <path
                  key={`glow-${kind}`}
                  id={`trail-glow-${kind}`}
                  d={APPROACH[kind]}
                  className="catch-trail-glow"
                />
              ))}
              {KINDS.map((kind) => (
                <path
                  key={`trail-${kind}`}
                  id={`trail-${kind}`}
                  d={APPROACH[kind]}
                  className="catch-trail"
                />
              ))}
              <path id="route-exit" d={EXIT} className="catch-route-guide" />
              <path id="trail-glow-exit" d={EXIT} className="catch-trail-glow" />
              <path id="trail-exit" d={EXIT} className="catch-trail" />
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
              <circle id="ripple-calm" className="catch-ripple" cx={478} cy={300} r={46} />
            </g>
          </svg>

          <div className="catch-tab" aria-hidden="true">
            <small className="catch-micro catch-micro-tab catch-intro">your tab</small>
            <div className="catch-tab-card catch-intro">
              <div className="catch-chrome" aria-hidden="true">
                <span className="catch-lights">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="catch-addr">
                  <span className="catch-addr-text">instagram.com</span>
                </span>
              </div>
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
            <small className="catch-tray-count">held 3 / 3</small>
          </div>

          <div className="catch-server catch-intro" aria-hidden="true">
            <div className="catch-server-card">
              <small className="catch-server-title">Meta server</small>
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
