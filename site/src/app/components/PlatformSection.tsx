import { motion } from 'motion/react';
import { GhostMark } from './GhostSVG';

const CHECK = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="6.5" stroke="rgba(91,173,106,0.35)" />
    <path d="M4 7l2 2 4-4" stroke="#5BAD6A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DASH = () => (
  <span style={{ fontFamily: 'var(--g-mono)', fontSize: 13, color: 'rgba(240,230,210,0.18)' }}>—</span>
);

/* Evidence chips — small artifact fragments showing a suppressed signal */
function EvidenceChip({ text, accent = false }: { text: string; accent?: boolean }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px',
      background: accent ? 'rgba(196,72,48,0.08)' : 'rgba(240,230,210,0.04)',
      border: `1px solid ${accent ? 'rgba(196,72,48,0.2)' : 'rgba(240,230,210,0.07)'}`,
      borderRadius: 4,
    }}>
      {accent && <GhostMark size={9} />}
      <span style={{ fontFamily: 'var(--g-mono)', fontSize: 10, color: accent ? 'rgba(196,72,48,0.7)' : 'rgba(240,230,210,0.32)', letterSpacing: '0.02em' }}>
        {text}
      </span>
    </div>
  );
}

/* Messenger artifact fragment */
function MessengerFragment() {
  return (
    <div style={{ background: '#18202E', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', maxWidth: 340 }}>
      <div style={{ padding: '8px 11px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 24, height: 24, borderRadius: 12, background: '#0082FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', fontFamily: 'var(--g-sans)' }}>M</div>
        <div>
          <div style={{ fontFamily: 'var(--g-sans)', fontSize: 12.5, fontWeight: 600, color: 'white' }}>Maria Santos</div>
          <div style={{ fontFamily: 'var(--g-sans)', fontSize: 10.5, color: 'rgba(255,255,255,0.32)' }}>Active now</div>
        </div>
      </div>
      <div style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ alignSelf: 'flex-end', padding: '6px 10px', borderRadius: '11px 3px 11px 11px', background: '#0082FB', fontFamily: 'var(--g-sans)', fontSize: 12, color: 'white', lineHeight: 1.4 }}>
          yeah Saturday should work
        </div>
        <div style={{ alignSelf: 'flex-start', padding: '6px 10px', borderRadius: '3px 11px 11px 11px', background: 'rgba(255,255,255,0.08)', fontFamily: 'var(--g-sans)', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4, maxWidth: '80%' }}>
          wait are you free this weekend??
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-end' }}>
          <span style={{ fontFamily: 'var(--g-mono)', fontSize: 8, color: 'rgba(255,255,255,0.12)', textDecoration: 'line-through' }}>Seen 9:41 AM</span>
          <GhostMark size={8} />
        </div>
      </div>
    </div>
  );
}

/* Facebook artifact fragment — matches FeaturesSection TypingScene */
function FacebookFragment() {
  return (
    <div style={{ background: '#18202E', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', maxWidth: 340 }}>
      <div style={{ padding: '8px 11px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 24, height: 24, borderRadius: 12, background: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', fontFamily: 'var(--g-sans)' }}>D</div>
        <div>
          <div style={{ fontFamily: 'var(--g-sans)', fontSize: 12.5, fontWeight: 600, color: 'white' }}>David Park</div>
          <div style={{ fontFamily: 'var(--g-sans)', fontSize: 10.5, color: 'rgba(255,255,255,0.32)' }}>Active now</div>
        </div>
      </div>
      <div style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ alignSelf: 'flex-start', padding: '6px 10px', borderRadius: '3px 11px 11px 11px', background: 'rgba(255,255,255,0.08)', fontFamily: 'var(--g-sans)', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4, maxWidth: '82%' }}>
          did you read my last message?
        </div>
        {/* Typing indicator (right-aligned) — blocked by Ghostify */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
          <div style={{ position: 'relative', padding: '7px 12px', borderRadius: '11px 3px 11px 11px', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <div style={{ position: 'absolute', left: 7, right: 7, top: '50%', height: 1.5, background: 'rgba(196,72,48,0.7)', transform: 'translateY(-50%)', borderRadius: 1, zIndex: 1 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.45)', animation: `typingBounce 1.1s ease-in-out ${i * 0.18}s infinite` }} />)}
            </div>
          </div>
          <EvidenceChip text="typing held" accent />
        </div>
        {/* Composer with text being typed */}
        <div style={{ height: 28, borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', padding: '0 11px', display: 'flex', alignItems: 'center', marginTop: 2 }}>
          <span style={{ fontFamily: 'var(--g-sans)', fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>ok let me find it—</span>
          <span style={{ display: 'inline-block', width: 1, height: 11, background: '#1877F2', marginLeft: 1, animation: 'ghostBlink 1s ease-in-out infinite' }} />
        </div>
      </div>
    </div>
  );
}

/* Instagram artifact fragment */
function InstagramFragment() {
  return (
    <div style={{ background: '#000', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', maxWidth: 340 }}>
      {/* Story ring */}
      <div style={{ padding: '8px 11px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 13, background: 'linear-gradient(135deg, #833AB4, #C13584, #F56040)', padding: 2 }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 11, background: '#C13584', border: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', fontFamily: 'var(--g-sans)' }}>Y</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--g-sans)', fontSize: 12.5, fontWeight: 600, color: 'white' }}>yuki.photo</div>
          <div style={{ fontFamily: 'var(--g-sans)', fontSize: 10.5, color: 'rgba(255,255,255,0.32)' }}>story · 3h ago</div>
        </div>
      </div>
      <div style={{ padding: '8px 11px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Story thumbnail */}
        <div style={{ height: 64, borderRadius: 6, background: 'linear-gradient(155deg, rgba(131,58,180,0.5) 0%, rgba(193,53,132,0.45) 55%, rgba(245,96,64,0.38) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--g-display)', fontSize: 15, fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', fontWeight: 300 }}>golden hour</span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <EvidenceChip text="story view held" accent />
          <EvidenceChip text="no viewer signal" />
        </div>
      </div>
    </div>
  );
}

const ROWS = [
  {
    name: 'Messenger',
    color: '#0082FB',
    read: true, typing: true, story: false,
    notes: 'Works on messenger.com',
    Fragment: MessengerFragment,
  },
  {
    name: 'Facebook',
    color: '#1877F2',
    read: true, typing: true, story: true,
    notes: 'Messages + story surfaces',
    Fragment: FacebookFragment,
  },
  {
    name: 'Instagram',
    color: '#C13584',
    read: true, typing: true, story: true,
    notes: 'DMs + supported story views',
    Fragment: InstagramFragment,
  },
];

export function PlatformSection() {
  return (
    <section
      id="platforms"
      className="snap-start"
      style={{
        position: 'relative',
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 'clamp(56px, 8vw, 96px) 0',
      }}
    >
      {/* Top hairline */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(240,230,210,0.06) 20%, rgba(240,230,210,0.06) 80%, transparent)' }} />

      <div className="platform-inner" style={{ padding: '0 clamp(28px, 4vw, 56px)', maxWidth: 1380, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* Heading */}
        <div style={{ marginBottom: 'clamp(36px, 5vw, 56px)' }}>
          <div style={{ fontFamily: 'var(--g-mono)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--g-dim)', marginBottom: 12 }}>
            Compatibility
          </div>
          <h2 style={{ fontFamily: 'var(--g-sans)', fontSize: 'clamp(1.65rem, 2.6vw, 2.25rem)', fontWeight: 500, color: 'var(--g-white)', margin: 0, lineHeight: 1.16, letterSpacing: 0 }}>
            One layer. Three surfaces.
          </h2>
        </div>

        {/* Matrix + fragments */}
        <div className="platform-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(32px, 5vw, 64px)', alignItems: 'start' }}>

          {/* Left: compatibility matrix */}
          <div>
            {/* Column headers */}
            <div className="platform-matrix-row platform-matrix-head" style={{ display: 'grid', gridTemplateColumns: '136px repeat(3, 1fr) 1.4fr', gap: 0, marginBottom: 0 }}>
              <div />
              {[
                { label: 'Read receipts', short: 'Read' },
                { label: 'Typing', short: 'Type' },
                { label: 'Story views', short: 'Story' },
              ].map((col) => (
                <div key={col.label} style={{ padding: '10px 8px', fontFamily: 'var(--g-mono)', fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(240,230,210,0.3)', textAlign: 'center' }}>
                  <span className="platform-head-full">{col.label}</span>
                  <span className="platform-head-short">{col.short}</span>
                </div>
              ))}
              <div style={{ padding: '10px 8px', fontFamily: 'var(--g-mono)', fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(240,230,210,0.3)' }}>Notes</div>
            </div>

            {/* Header underline */}
            <div style={{ height: 1, background: 'rgba(240,230,210,0.07)', marginBottom: 0 }} />

            {/* Rows */}
            {ROWS.map((row, i) => (
              <motion.div
                key={row.name}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="platform-matrix-row" style={{ display: 'grid', gridTemplateColumns: '136px repeat(3, 1fr) 1.4fr', gap: 0, borderBottom: '1px solid rgba(240,230,210,0.06)', alignItems: 'center' }}>
                  {/* Platform name */}
                  <div style={{ padding: 'clamp(14px, 1.8vw, 20px) 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: row.color, flexShrink: 0 }} />
                    <span className="platform-name" style={{ fontFamily: 'var(--g-sans)', fontSize: 15.5, fontWeight: 500, color: 'var(--g-white)', letterSpacing: 0 }}>{row.name}</span>
                  </div>
                  {/* Check cells */}
                  {[row.read, row.typing, row.story].map((val, ci) => (
                    <div key={ci} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(14px, 1.8vw, 20px) 0' }}>
                      {val ? <CHECK /> : <DASH />}
                    </div>
                  ))}
                  {/* Notes */}
                  <div className="platform-notes-cell" style={{ padding: 'clamp(14px, 1.8vw, 20px) 8px', fontFamily: 'var(--g-mono)', fontSize: 10.5, color: 'rgba(240,230,210,0.32)', letterSpacing: '0.02em', lineHeight: 1.5 }}>
                    {row.notes}
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Footer note */}
            <p style={{ fontFamily: 'var(--g-mono)', fontSize: 10.5, color: 'rgba(240,230,210,0.24)', margin: '18px 0 0', letterSpacing: '0.02em', lineHeight: 1.7 }}>
              Controls are applied locally per browser tab.<br />
              Story view coverage varies by platform version.
            </p>
          </div>

          {/* Right: artifact evidence fragments */}
          <div className="platform-fragments" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(14px, 2vw, 20px)' }}>
            {ROWS.map((row, i) => (
              <motion.div
                key={row.name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.45, delay: i * 0.1 + 0.1, ease: [0.16, 1, 0.3, 1] }}
              >
                <row.Fragment />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <p style={{ fontFamily: 'var(--g-mono)', fontSize: 10, color: 'rgba(240,230,210,0.18)', marginTop: 'clamp(28px, 4vw, 48px)', letterSpacing: '0.03em', lineHeight: 1.8, maxWidth: 680 }}>
          Ghostify is not affiliated with Meta, Facebook, Messenger, or Instagram. Platform names are used as factual compatibility descriptors only.
        </p>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .platform-layout { grid-template-columns: 1fr !important; }
          .platform-fragments { display: grid !important; grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .platform-inner {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          .platform-matrix-row {
            grid-template-columns: minmax(86px, 0.9fr) repeat(3, minmax(34px, 0.38fr)) minmax(82px, 0.85fr) !important;
          }
          .platform-matrix-head > div {
            padding-left: 4px !important;
            padding-right: 4px !important;
            font-size: 8px !important;
          }
          .platform-name {
            font-size: 14px !important;
          }
          .platform-notes-cell {
            overflow-wrap: anywhere !important;
          }
        }
        @media (max-width: 560px) {
          .platform-fragments { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 360px) {
          .platform-inner {
            padding-left: 14px !important;
            padding-right: 14px !important;
          }
          .platform-matrix-row {
            grid-template-columns: minmax(94px, 1fr) repeat(3, 26px) minmax(54px, 0.75fr) !important;
          }
          .platform-name {
            font-size: 13px !important;
          }
          .platform-matrix-head > div {
            font-size: 7px !important;
            letter-spacing: 0.01em !important;
            line-height: 1.1 !important;
          }
          .platform-head-full {
            display: none !important;
          }
          .platform-head-short {
            display: inline !important;
          }
          .platform-notes-cell {
            padding-left: 4px !important;
            padding-right: 0 !important;
            font-size: 8px !important;
            line-height: 1.35 !important;
          }
        }
        .platform-head-short {
          display: none;
        }
      `}</style>
    </section>
  );
}
