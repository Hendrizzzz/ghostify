import { motion } from 'motion/react';
import { GhostMark } from './GhostSVG';

const LIMITS = [
  {
    index: '01',
    className: 'limit-nw',
    title: 'Web only.',
    body: 'Ghostify works on messenger.com, facebook.com, and instagram.com. Native iOS and Android apps operate independently; the extension has no access there.',
  },
  {
    index: '02',
    className: 'limit-ne',
    title: 'Platform updates can break things.',
    body: 'Meta changes their interfaces regularly. Some controls may stop working after an update. We fix them when we can, but there is no guarantee of instant coverage.',
  },
  {
    index: '03',
    className: 'limit-sw',
    title: 'Already-sent signals stay sent.',
    body: 'Ghostify cannot retroactively suppress read receipts or typing indicators that left the browser before it was enabled. It only intercepts from the moment it is active.',
  },
  {
    index: '04',
    className: 'limit-se',
    title: 'Server-side tracking is out of scope.',
    body: "Ghostify controls browser-tab signals, not platform infrastructure. Meta's own analytics run server-side and are outside what a browser extension can touch.",
  },
];

function BoundaryDiagram() {
  return (
    <div className="limits-boundary" aria-hidden="true">
      <svg className="limits-boundary-svg" viewBox="0 0 520 520" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g className="boundary-orbit">
          <circle cx="260" cy="260" r="186" className="boundary-perimeter" />
          <path className="boundary-tick" d="M260 62v20M260 438v20M62 260h20M438 260h20" />
          <circle cx="260" cy="74" r="3" className="boundary-dot" />
          <circle cx="260" cy="446" r="3" className="boundary-dot" />
          <circle cx="74" cy="260" r="3" className="boundary-dot" />
          <circle cx="446" cy="260" r="3" className="boundary-dot" />
        </g>
        <circle cx="260" cy="260" r="106" className="boundary-core-ring" />
      </svg>

      <div className="limits-core">
        <div className="limits-core-word">Ghostify</div>
        <GhostMark size={96} />
        <div className="limits-core-sub">Scope boundary</div>
        <div className="limits-core-dots">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export function LimitsSection() {
  return (
    <section id="limits" className="snap-start limits-section">
      <div className="limits-shell">
        <motion.div
          className="limits-intro"
          initial={false}
        >
          <div className="limits-eyebrow" aria-hidden="true">
            <span />
            <i />
          </div>
          <h2>No magic cloak.</h2>
          <p>Ghostify does one thing well. Here's what falls outside that boundary.</p>
          <a
            className="limits-source-link"
            href="https://github.com/Hendrizzzz/Ghostify"
            target="_blank"
            rel="noopener noreferrer"
          >
            read the source →
          </a>
        </motion.div>

        <div className="limits-map">
          <BoundaryDiagram />

          {LIMITS.map((limit) => (
            <motion.article
              key={limit.title}
              className={`limit-callout ${limit.className}`}
              initial={false}
            >
              <div className="limit-index-row">
                <span>{limit.index}</span>
                <i />
              </div>
              <h3>{limit.title}</h3>
              <p>{limit.body}</p>
            </motion.article>
          ))}
        </div>
      </div>

      <style>{`
        .limits-section {
          position: relative;
          isolation: isolate;
          min-height: auto;
          display: block;
          overflow: hidden;
          padding: clamp(72px, 5.8vw, 92px) clamp(28px, 4.4vw, 64px);
          background:
            linear-gradient(180deg, rgba(var(--g-bg-rgb),0.72), var(--g-bg) 22%, #100D0B 76%, rgba(var(--g-bg-rgb),0.94)),
            radial-gradient(ellipse at 67% 48%, rgba(212,106,82,0.035), transparent 46%);
        }
        .limits-section::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: -2;
          opacity: 0.26;
          background-image:
            repeating-linear-gradient(0deg, rgba(240,235,224,0.022) 0 1px, transparent 1px 5px),
            repeating-linear-gradient(90deg, rgba(240,235,224,0.012) 0 1px, transparent 1px 4px);
          mix-blend-mode: soft-light;
        }
        .limits-section::after {
          content: "held";
          position: absolute;
          left: 0;
          top: auto;
          bottom: clamp(1.5rem, 4vw, 4.5rem);
          pointer-events: none;
          z-index: -1;
          transform: none;
          font-family: var(--g-watermark);
          font-size: clamp(9rem, 15vw, 17rem);
          font-style: italic;
          font-weight: 400;
          line-height: 0.78;
          color: rgba(240,235,224,0.022);
          white-space: nowrap;
        }
        .limits-shell {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(360px, 0.62fr) minmax(960px, 1.38fr);
          gap: clamp(72px, 6.8vw, 124px);
          align-items: center;
        }
        .limits-intro {
          position: relative;
          z-index: 2;
          width: min(100%, 480px);
          margin-left: 0;
        }
        .limits-eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }
        .limits-eyebrow span {
          width: 54px;
          height: 1px;
          background: rgba(240,235,224,0.24);
        }
        .limits-eyebrow i {
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: #D46A52;
          box-shadow: 0 0 16px rgba(212,106,82,0.34);
        }
        .limits-intro h2 {
          margin: 0 0 26px;
          font-family: var(--g-display);
          font-size: clamp(2.65rem, 3.2vw, 4rem);
          font-weight: 400;
          line-height: 0.98;
          color: var(--g-white);
          letter-spacing: 0;
          white-space: nowrap;
        }
        .limits-intro p {
          max-width: 390px;
          margin: 0;
          font-family: var(--g-sans);
          font-size: clamp(1.03rem, 1.08vw, 1.18rem);
          line-height: 1.52;
          color: rgba(240,235,224,0.62);
          letter-spacing: 0;
        }
        .limits-source-link {
          display: inline-flex;
          align-items: center;
          margin-top: 24px;
          font-family: var(--g-sans);
          font-size: 0.84rem;
          line-height: 1;
          letter-spacing: 0;
          text-transform: none;
          font-weight: 600;
          color: rgba(228,139,109,0.82);
          text-decoration: none;
          border-bottom: 1px solid rgba(212,106,82,0.28);
          padding-bottom: 4px;
          transition: color 0.18s ease, border-color 0.18s ease;
        }
        .limits-source-link:hover {
          color: rgba(240,235,224,0.9);
          border-color: rgba(240,235,224,0.36);
        }
        .limits-map {
          position: relative;
          width: 100%;
          max-width: 1040px;
          min-height: 0;
          justify-self: center;
          display: grid;
          grid-template-columns: minmax(310px, 1fr) auto minmax(310px, 1fr);
          grid-template-rows: auto auto;
          column-gap: clamp(56px, 4vw, 84px);
          row-gap: clamp(42px, 4vw, 58px);
          align-items: center;
        }
        .limits-boundary {
          --boundary-size: clamp(12.75rem, 12.5vw, 15rem);
          --core-size: 48%;
          --mascot-size: clamp(1.65rem, 1.9vw, 2.05rem);
          position: relative;
          grid-column: 2;
          grid-row: 1 / 3;
          justify-self: center;
          align-self: center;
          width: var(--boundary-size);
          max-width: 100%;
          aspect-ratio: 1;
          transform: none;
          display: grid;
          place-items: center;
          pointer-events: none;
          z-index: 1;
        }
        .limits-boundary-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .boundary-orbit {
          transform-box: view-box;
          transform-origin: center;
          animation: limitsBoundaryOrbit 34s linear infinite;
          will-change: transform;
        }
        .boundary-perimeter {
          fill: rgba(var(--g-bg-rgb),0.08);
          stroke: rgba(240,235,224,0.13);
          stroke-width: 1;
          vector-effect: non-scaling-stroke;
        }
        .boundary-tick {
          stroke: rgba(212,106,82,0.42);
          stroke-width: 1;
          vector-effect: non-scaling-stroke;
        }
        .boundary-dot {
          fill: #D46A52;
          opacity: 0.62;
        }
        .boundary-core-ring {
          fill: rgba(var(--g-bg-rgb),0.42);
          stroke: rgba(240,235,224,0.22);
          stroke-width: 1;
        }
        .limits-core {
          position: relative;
          z-index: 2;
          width: var(--core-size);
          aspect-ratio: 1;
          display: grid;
          place-items: center;
          text-align: center;
        }
        .limits-core svg {
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--mascot-size);
          height: var(--mascot-size);
          transform: translate(-50%, -50%);
          opacity: 0.72;
          filter: drop-shadow(0 18px 36px rgba(0,0,0,0.45));
        }
        .limits-core-word {
          position: absolute;
          left: 50%;
          top: 3%;
          transform: translateX(-50%);
          font-family: var(--g-mono);
          font-size: clamp(0.48rem, 0.55vi, 0.58rem);
          letter-spacing: 0.48em;
          text-transform: uppercase;
          color: rgba(240,235,224,0.66);
          padding-left: 0.48em;
        }
        .limits-core-sub {
          position: absolute;
          left: 50%;
          bottom: 8%;
          transform: translateX(-50%);
          white-space: nowrap;
          font-family: var(--g-sans);
          font-size: clamp(0.62rem, 0.72vi, 0.74rem);
          font-style: italic;
          font-weight: 500;
          color: rgba(228,139,109,0.72);
        }
        .limits-core-dots {
          position: absolute;
          left: 50%;
          bottom: -5%;
          transform: translateX(-50%);
          display: flex;
          gap: 0.58rem;
        }
        .limits-core-dots span {
          width: 0.18rem;
          height: 0.18rem;
          border-radius: 999px;
          background: rgba(212,106,82,0.72);
        }
        .limit-callout {
          position: relative;
          z-index: 2;
          width: min(100%, 310px);
          color: var(--g-white);
        }
        .limit-nw {
          grid-column: 1;
          grid-row: 1;
          align-self: center;
          justify-self: end;
        }
        .limit-ne {
          grid-column: 3;
          grid-row: 1;
          align-self: center;
          justify-self: start;
        }
        .limit-sw {
          grid-column: 1;
          grid-row: 2;
          align-self: center;
          justify-self: end;
        }
        .limit-se {
          grid-column: 3;
          grid-row: 2;
          align-self: center;
          justify-self: start;
        }
        .limit-index-row {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 12px;
        }
        .limit-index-row span {
          width: 34px;
          height: 34px;
          display: inline-grid;
          place-items: center;
          border-radius: 999px;
          border: 1px solid rgba(240,235,224,0.24);
          color: rgba(240,235,224,0.76);
          font-family: var(--g-mono);
          font-size: 0.72rem;
          letter-spacing: 0.02em;
        }
        .limit-index-row i {
          display: block;
          width: 30px;
          height: 1px;
          background: rgba(212,106,82,0.42);
        }
        .limit-callout h3 {
          margin: 0 0 12px;
          font-family: var(--g-display);
          font-size: clamp(1.32rem, 1.55vw, 1.68rem);
          font-weight: 400;
          line-height: 1.08;
          color: var(--g-white);
          letter-spacing: 0;
        }
        .limit-callout p {
          margin: 0;
          font-family: var(--g-sans);
          font-size: 0.94rem;
          line-height: 1.52;
          color: rgba(240,235,224,0.62);
          letter-spacing: 0;
        }
        @keyframes limitsBoundaryOrbit {
          to {
            transform: rotate(360deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .boundary-orbit {
            animation: none;
          }
        }
        @media (max-width: 1480px) {
          .limits-shell {
            max-width: 1240px;
            grid-template-columns: minmax(280px, 0.54fr) minmax(800px, 1.46fr);
            gap: clamp(56px, 5.6vw, 78px);
          }
          .limits-section::after {
            font-size: clamp(8rem, 16vw, 14rem);
          }
          .limits-intro {
            max-width: 410px;
            margin-left: 0;
          }
          .limits-intro p {
            max-width: 360px;
          }
          .limits-map {
            max-width: 960px;
            min-height: 0;
            grid-template-columns: minmax(260px, 1fr) auto minmax(260px, 1fr);
            column-gap: clamp(44px, 4vw, 64px);
            row-gap: clamp(34px, 4vw, 48px);
          }
        }
        @media (max-width: 1200px) {
          .limits-shell {
            max-width: 1040px;
            grid-template-columns: 1fr;
            gap: 48px;
          }
          .limits-intro {
            max-width: 480px;
          }
          .limits-map {
            max-width: 960px;
            grid-template-columns: minmax(260px, 1fr) auto minmax(260px, 1fr);
          }
        }
        @media (max-width: 1040px) {
          .limits-shell {
            max-width: 940px;
            grid-template-columns: 1fr;
            gap: 42px;
          }
          .limits-map {
            max-width: 860px;
            min-height: 0;
            grid-template-columns: minmax(210px, 1fr) auto minmax(210px, 1fr);
            column-gap: 34px;
            row-gap: 42px;
          }
          .limits-boundary {
            --boundary-size: clamp(12.5rem, 25vi, 14.5rem);
            --mascot-size: clamp(1.65rem, 3.2vi, 2.05rem);
          }
          .limit-callout {
            width: min(100%, 238px);
          }
          .limit-callout h3 {
            font-size: clamp(1.2rem, 1.9vw, 1.42rem);
          }
          .limit-callout p {
            font-size: 0.8rem;
          }
        }
        @media (max-width: 880px) {
          .limits-section {
            min-height: auto;
            padding: 96px clamp(38px, 5.8vw, 50px) 84px;
          }
          .limits-shell {
            max-width: 760px;
            gap: 34px;
          }
          .limits-section::after {
            font-size: clamp(8rem, 20vw, 11rem);
            color: rgba(240,235,224,0.018);
          }
          .limits-intro h2 {
            font-size: clamp(2.05rem, 4.8vw, 2.7rem);
          }
          .limits-map {
            min-height: 0;
            display: grid;
            grid-template-columns: minmax(15.5rem, 0.86fr) minmax(0, 1.14fr);
            grid-template-rows: repeat(4, auto);
            gap: 20px clamp(34px, 6vw, 52px);
            align-items: center;
          }
          .limits-boundary {
            --boundary-size: clamp(14rem, 34vi, 16rem);
            --mascot-size: clamp(1.65rem, 3.8vi, 2.1rem);
            width: var(--boundary-size);
            max-width: 100%;
            margin: 0;
            grid-column: 1;
            grid-row: 1 / 5;
          }
          .limit-callout {
            position: relative;
            inset: auto !important;
            width: auto;
            justify-self: stretch;
            align-self: start;
          }
          .limit-callout p {
            font-size: 0.8rem;
            line-height: 1.55;
            color: rgba(240,235,224,0.62);
          }
          .limit-callout h3 {
            font-size: clamp(1.06rem, 2vw, 1.22rem);
          }
          .limit-index-row {
            margin-bottom: 9px;
          }
          .limit-index-row span {
            width: 30px;
            height: 30px;
            font-size: 0.66rem;
          }
          .limit-index-row i {
            width: 24px;
          }
          .limit-nw,
          .limit-ne,
          .limit-sw,
          .limit-se {
            grid-column: 2;
          }
          .limit-nw { grid-row: 1; }
          .limit-ne { grid-row: 2; }
          .limit-sw { grid-row: 3; }
          .limit-se { grid-row: 4; }
        }
        @media (max-width: 620px) {
          .limits-section {
            padding: 82px 24px 76px;
          }
          .limits-intro h2 {
            font-size: clamp(1.92rem, 8.6vw, 2.34rem);
          }
          .limits-section::after {
            left: 0;
            bottom: 2rem;
            font-size: 9rem;
            color: rgba(240,235,224,0.018);
          }
          .limits-map {
            grid-template-columns: 1fr;
            grid-template-rows: auto;
            gap: 30px;
          }
          .limits-boundary {
            --boundary-size: clamp(12.75rem, 60vi, 15rem);
            --core-size: 48%;
            --mascot-size: clamp(1.6rem, 6vi, 2rem);
            width: var(--boundary-size);
            max-width: 100%;
            margin-bottom: 0;
            grid-column: 1;
            grid-row: auto;
          }
          .limit-callout p {
            font-size: 0.86rem;
          }
          .limit-callout h3 {
            font-size: 1.22rem;
          }
          .limit-nw,
          .limit-ne,
          .limit-sw,
          .limit-se {
            grid-column: 1;
            grid-row: auto;
          }
        }
      `}</style>
    </section>
  );
}
