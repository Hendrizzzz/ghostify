import { motion } from 'motion/react';

const LINES = [
  { label: 'Signal control', text: 'Seen signals stay quiet.'           },
  { label: 'Architecture',   text: 'Local-only. No Ghostify relay.'     },
  { label: 'Footprint',      text: 'Local controls. Zero Ghostify servers.' },
  { label: 'Trust model',    text: 'Open source. Read it yourself.'     },
];

export function PersonalityBand() {
  return (
    <section
      style={{
        position: 'relative',
        borderTop: '1px solid rgba(240,230,210,0.06)',
        borderBottom: '1px solid rgba(240,230,210,0.06)',
        background: '#0D0C0A',
        overflow: 'hidden',
      }}
    >
      {/* Subtle horizontal grid lines */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 24%, rgba(240,230,210,0.012) 25%)', pointerEvents: 'none' }} />

      <div
        className="band-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
        }}
      >
        {LINES.map((line, i) => (
          <motion.div
            key={line.label}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.45, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
            style={{
              padding: 'clamp(28px, 3.5vw, 40px) clamp(24px, 3vw, 36px)',
              borderRight: i < 3 ? '1px solid rgba(240,230,210,0.05)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Receipt chip */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
              <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(196,72,48,0.5)', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--g-mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(240,230,210,0.22)' }}>
                {line.label}
              </span>
            </div>

            {/* Punchy line */}
            <div
              style={{
                fontFamily: 'var(--g-sans)',
                fontSize: 'clamp(0.95rem, 1.2vw, 1.08rem)',
                fontWeight: 500,
                color: 'var(--g-white)',
                lineHeight: 1.3,
                letterSpacing: 0,
              }}
            >
              {line.text}
            </div>
          </motion.div>
        ))}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .band-grid { grid-template-columns: 1fr 1fr !important; }
          .band-grid > *:nth-child(2) { border-right: none !important; }
          .band-grid > *:nth-child(3) { border-right: 1px solid rgba(240,230,210,0.05) !important; border-top: 1px solid rgba(240,230,210,0.05); }
          .band-grid > *:nth-child(4) { border-top: 1px solid rgba(240,230,210,0.05); }
        }
        @media (max-width: 540px) {
          .band-grid { grid-template-columns: 1fr !important; }
          .band-grid > * { border-right: none !important; border-top: 1px solid rgba(240,230,210,0.05) !important; }
          .band-grid > *:first-child { border-top: none !important; }
        }
      `}</style>
    </section>
  );
}
