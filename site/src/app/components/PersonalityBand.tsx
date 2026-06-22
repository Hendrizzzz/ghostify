const LINES = [
  { label: 'Signal control', text: 'Seen signals stay quiet.' },
  { label: 'Architecture', text: 'Local-only. No Ghostify relay.' },
  { label: 'Footprint', text: 'No tracking or message relay.' },
  { label: 'Trust model', text: 'Open source. Read it yourself.' },
  { label: 'Platform scope', text: 'Instagram, Messenger, Facebook.' },
  { label: 'Account model', text: 'No Ghostify account required.' },
  { label: 'Tab behavior', text: 'Supported tabs only.' },
  { label: 'Signal types', text: 'Seen, typing, story views.' },
  { label: 'Storage', text: 'Preferences stay in your browser.' },
  { label: 'Verification', text: 'Public status stays visible.' },
];

export function PersonalityBand() {
  const renderLine = (line: typeof LINES[number]) => (
    <div className="band-card" key={line.label}>
      <div className="band-chip">
        <div className="band-dot" />
        <span>{line.label}</span>
      </div>
      <div className="band-copy">{line.text}</div>
    </div>
  );

  return (
    <section
      aria-label="Ghostify privacy and trust highlights"
      style={{
        position: 'relative',
        borderTop: '1px solid rgba(240,230,210,0.06)',
        borderBottom: '1px solid rgba(240,230,210,0.06)',
        background: '#0D0C0A',
        overflow: 'hidden',
      }}
    >
      <div className="band-marquee">
        <div className="band-track">
          <div className="band-group">{LINES.map(renderLine)}</div>
          <div className="band-group" aria-hidden="true">{LINES.map(renderLine)}</div>
        </div>
      </div>

      <style>{`
        .band-marquee {
          position: relative;
          z-index: 1;
          overflow: hidden;
          width: 100%;
        }

        .band-marquee::before,
        .band-marquee::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          z-index: 2;
          width: min(120px, 12vw);
          pointer-events: none;
        }

        .band-marquee::before {
          left: 0;
          background: linear-gradient(90deg, #0D0C0A, rgba(13,12,10,0));
        }

        .band-marquee::after {
          right: 0;
          background: linear-gradient(270deg, #0D0C0A, rgba(13,12,10,0));
        }

        .band-track {
          display: flex;
          width: max-content;
          animation: ghostify-band-scroll 44s linear infinite;
          will-change: transform;
        }

        .band-group {
          display: flex;
          flex-shrink: 0;
        }

        .band-card {
          width: clamp(220px, 23vw, 340px);
          min-height: 116px;
          box-sizing: border-box;
          padding: clamp(28px, 3.5vw, 40px) clamp(24px, 3vw, 36px);
          border-right: 1px solid rgba(240,230,210,0.05);
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
        }

        .band-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          align-self: flex-start;
          white-space: nowrap;
        }

        .band-dot {
          width: 4px;
          height: 4px;
          border-radius: 2px;
          background: rgba(212,106,82,0.55);
          flex-shrink: 0;
        }

        .band-chip span {
          font-family: var(--g-mono);
          font-size: 8.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(240,230,210,0.22);
        }

        .band-copy {
          font-family: var(--g-sans);
          font-size: clamp(0.95rem, 1.2vw, 1.08rem);
          font-weight: 500;
          color: var(--g-white);
          line-height: 1.3;
          letter-spacing: 0;
        }

        @keyframes ghostify-band-scroll {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }

        @media (max-width: 540px) {
          .band-track { animation-duration: 36s; }
          .band-card {
            width: 230px;
            min-height: 108px;
            padding: 24px 22px;
          }
        }
      `}</style>
    </section>
  );
}
