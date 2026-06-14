import { motion } from 'motion/react';
import { UserX, Server, HardDrive, Code, Lock, Eye } from 'lucide-react';

const PILLARS = [
  {
    index: '01',
    icon: UserX,
    title: 'No Ghostify account',
    body: 'There\'s no login, no sign-up, no profile. Ghostify doesn\'t know who you are. That\'s the point.',
  },
  {
    index: '02',
    icon: Server,
    title: 'No Ghostify server',
    body: 'Your settings live in your browser. Nothing passes through our infrastructure — because there isn\'t any.',
  },
  {
    index: '03',
    icon: HardDrive,
    title: 'Local settings',
    body: 'Every toggle you flip is stored in your browser. Changes are broadcast to open supported tabs, not synced to a Ghostify cloud.',
  },
  {
    index: '04',
    icon: Code,
    title: 'Open source',
    body: 'The full source is on GitHub. Read it, audit it, build from it. Trust shouldn\'t require faith.',
  },
  {
    index: '05',
    icon: Lock,
    title: 'No social password required',
    body: 'Ghostify never asks for your passwords, tokens, or login credentials. It works entirely at the browser layer.',
  },
  {
    index: '06',
    icon: Eye,
    title: 'Built for visibility control',
    body: 'Ghostify locally checks supported signal traffic so read receipts, typing indicators, and story-view writes can be blocked before they leave the tab.',
  },
];

export function PrivacySection() {
  return (
    <section
      id="privacy"
      className="snap-start"
      style={{
        padding: 'clamp(60px, 10vw, 120px) 28px',
        position: 'relative',
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        <div style={{ borderTop: '1px solid rgba(240,230,210,0.07)', paddingTop: 'clamp(40px, 6vw, 72px)' }}>

          {/* Heading */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 56, flexWrap: 'wrap', gap: 24 }}>
            <h2 style={{ fontFamily: 'var(--g-display)', fontSize: 'clamp(2rem, 4vw, 3.6rem)', fontWeight: 300, color: 'var(--g-white)', margin: 0, lineHeight: 1.1, letterSpacing: 0, maxWidth: 520 }}>
              Boring in{' '}
              <em style={{ fontStyle: 'italic', fontWeight: 400 }}>the right places.</em>
            </h2>
            <p style={{ fontFamily: 'var(--g-mono)', fontSize: 12, lineHeight: 1.6, color: 'var(--g-dim)', maxWidth: 300, margin: 0, letterSpacing: '0.02em' }}>
              No login. No profile. No Ghostify cloud relay.
              <br />
              Your switches live in your browser.
            </p>
          </div>

          {/* 6 pillars — 3-column on desktop, 2-column on tablet */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }} className="privacy-grid">
            {PILLARS.map((pillar, i) => {
              const Icon = pillar.icon;
              const isTopRow = i < 3;
              return (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    padding: 'clamp(20px, 3vw, 30px)',
                    borderLeft: (i % 3) > 0 ? '1px solid rgba(240,230,210,0.06)' : 'none',
                    borderTop: !isTopRow ? '1px solid rgba(240,230,210,0.06)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={15} color="var(--g-accent)" strokeWidth={1.5} />
                    <div style={{ width: 14, height: 1, background: 'rgba(196,72,48,0.35)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--g-mono)', fontSize: 9, color: 'rgba(196,72,48,0.4)', letterSpacing: '0.08em' }}>{pillar.index}</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--g-sans)', fontSize: 'clamp(0.88rem, 1.1vw, 1rem)', fontWeight: 500, color: 'var(--g-white)', marginBottom: 8, lineHeight: 1.3, letterSpacing: 0 }}>
                      {pillar.title}
                    </div>
                    <p style={{ fontFamily: 'var(--g-sans)', fontSize: 13, lineHeight: 1.6, color: 'var(--g-body)', margin: 0 }}>
                      {pillar.body}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Separator */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(240,230,210,0.07) 30%, rgba(240,230,210,0.07) 70%, transparent)', margin: '0' }} />

          {/* Trust statement */}
          <div style={{ padding: 'clamp(24px, 3vw, 36px) 0', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--g-mono)', fontSize: 11.5, letterSpacing: '0.04em', color: 'var(--g-dim)', lineHeight: 1.8, maxWidth: 560 }}>
              Ghostify modifies which supported social signals leave the browser tab.
              It does not store messages, transmit conversations to Ghostify, or ask for credentials.
              The extension activates on supported Messenger, Facebook, Instagram, and Facebook/Messenger proxy-frame surfaces.
            </div>
            <a
              href="https://github.com/Hendrizzzz/Ghostify"
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: 'auto', fontFamily: 'var(--g-mono)', fontSize: 12, color: 'var(--g-dim)', textDecoration: 'none', letterSpacing: '0.04em', borderBottom: '1px solid rgba(240,230,210,0.15)', paddingBottom: 2, transition: 'color 0.18s ease, border-color 0.18s ease', whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--g-body)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,230,210,0.3)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--g-dim)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,230,210,0.15)'; }}
            >
              read the source →
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .privacy-grid { grid-template-columns: 1fr 1fr !important; }
          .privacy-grid > *:nth-child(2n+1) { border-left: none !important; }
          .privacy-grid > *:nth-child(n+3) { border-top: 1px solid rgba(240,230,210,0.06) !important; }
        }
        @media (max-width: 520px) {
          .privacy-grid { grid-template-columns: 1fr !important; }
          .privacy-grid > * { border-left: none !important; border-top: 1px solid rgba(240,230,210,0.06) !important; }
          .privacy-grid > *:first-child { border-top: none !important; }
        }
      `}</style>
    </section>
  );
}
