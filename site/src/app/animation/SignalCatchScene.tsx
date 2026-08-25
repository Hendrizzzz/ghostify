import { useLayoutEffect, useRef } from 'react';
import { GhostMark } from '../components/GhostSVG';
import { gsap, ensureGsap, prefersReducedMotion } from './gsapSetup';

const PATHS = {
  seen: 'M 90 96 C 400 96, 600 210, 780 316',
  typing: 'M 60 330 C 380 330, 580 330, 780 330',
  story: 'M 90 564 C 400 564, 600 450, 780 344',
};

export function SignalCatchScene() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    ensureGsap();
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;

        const ctx = gsap.context(() => {
      const paths = Array.from(root.querySelectorAll<SVGPathElement>('path.net-path'));
      const pills = Array.from(root.querySelectorAll<HTMLElement>('.catch-pill'));
      const ring = root.querySelector<HTMLElement>('.catch-ring');
      const stamp = root.querySelector<HTMLElement>('.catch-stamp');
      const ghost = root.querySelector<HTMLElement>('.signal-catch-ghost');
      const captionLines = root.querySelectorAll<HTMLElement>('.signal-catch-caption span');
      const railFill = root.querySelector<HTMLElement>('.signal-catch-rail i');
      const steps = root.querySelectorAll<HTMLElement>('.signal-catch-rail .rail-step');

      paths.forEach((path) => {
        const length = path.getTotalLength();
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length}`;
      });

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.55,
          onUpdate: (self) => {
            const step = self.progress < 0.34 ? 0 : self.progress < 0.68 ? 1 : 2;
            steps.forEach((item, index) => {
              item.classList.toggle('is-active', index === step);
            });
            if (railFill) railFill.style.transform = `scaleY(${self.progress.toFixed(4)})`;
          },
        },
      });

      const pathById: Record<string, SVGPathElement> = {};
      paths.forEach((path) => {
        pathById[path.getAttribute('id') || ''] = path;
      });

      paths.forEach((path, index) => {
        tl.to(path, { strokeDashoffset: 0, duration: 0.18 }, index * 0.045);
      });

      const travel = 0.34;
      pills.forEach((pill, index) => {
        const pathId = ['seen', 'typing', 'story'][index];
        const pathEl = pathById[`catch-path-${pathId}`];
        tl.fromTo(
          pill,
          { opacity: 0, scale: 0.6 },
          { opacity: 1, scale: 1, duration: 0.05 },
          0.14 + index * 0.045,
        );
        if (pathEl) {
          tl.to(
            pill,
            {
              motionPath: {
                path: pathEl,
                align: pathEl,
                alignOrigin: [0.5, 0.5],
                autoRotate: false,
              },
              duration: travel,
              ease: 'power1.inOut',
            },
            0.18 + index * 0.045,
          );
        }
        tl.to(
          pill,
          { opacity: 0, scale: 0.25, duration: 0.06, ease: 'power2.in' },
          0.18 + index * 0.045 + travel - 0.02,
        );
      });

      tl.fromTo(
        ghost,
        { scale: 0.94 },
        { scale: 1.06, duration: 0.08, ease: 'power2.out' },
        0.5,
      ).to(ghost, { scale: 1, duration: 0.1, ease: 'power2.inOut' }, 0.58);

      if (ring) {
        tl.fromTo(
          ring,
          { opacity: 0.25, scale: 0.7 },
          { opacity: 0.85, scale: 1.25, duration: 0.1, ease: 'power2.out' },
          0.52,
        ).to(ring, { opacity: 0.35, scale: 1.05, duration: 0.12 }, 0.62);
      }

      if (stamp) {
        tl.fromTo(
          stamp,
          { opacity: 0, scale: 1.9, rotation: -18 },
          { opacity: 1, scale: 1, rotation: -8, duration: 0.09, ease: 'power3.in' },
          0.62,
        ).to(stamp, { rotation: -6, duration: 0.05, ease: 'power1.out' }, 0.71);
      }

      captionLines.forEach((line, index) => {
        tl.fromTo(
          line,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.07, ease: 'power2.out' },
          0.72 + index * 0.075,
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
            <g className="net-lines">
              <path id="catch-path-seen" className="net-path" d={PATHS.seen} />
              <path id="catch-path-typing" className="net-path" d={PATHS.typing} />
              <path id="catch-path-story" className="net-path" d={PATHS.story} />
            </g>
            <g className="net-nodes">
              <circle cx="90" cy="96" r="5" />
              <circle cx="60" cy="330" r="5" />
              <circle cx="90" cy="564" r="5" />
            </g>
            <g className="net-labels">
              <text x="104" y="82">seen</text>
              <text x="74" y="316">typing</text>
              <text x="104" y="586">story view</text>
            </g>
          </svg>

          <div className="catch-pill catch-pill-seen">seen</div>
          <div className="catch-pill catch-pill-typing">
            typing
            <i className="catch-pill-dots">
              <b />
              <b />
              <b />
            </i>
          </div>
          <div className="catch-pill catch-pill-story">story view</div>

          <div className="signal-catch-ghost" aria-hidden="true">
            <span className="catch-ring" />
            <GhostMark size={168} bodyColor="#0f0f0d" eyeColor="#ffffff" />
            <span className="catch-stamp">
              <b>held</b>
              <small>in this browser</small>
            </span>
          </div>

          <p className="signal-catch-caption">
            <span>Three signals try to leave your tabs.</span>
            <span>Ghostify holds them before they do.</span>
            <span>Nothing is delivered. Nobody knows.</span>
          </p>
        </div>
      </div>
    </section>
  );
}

