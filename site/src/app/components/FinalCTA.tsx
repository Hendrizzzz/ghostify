import { motion } from 'motion/react';
import { Chrome, Github } from 'lucide-react';
import { GhostMark } from './GhostSVG';

export function FinalCTA() {
  return (
    <section
      className="snap-start"
      style={{ position: 'relative', minHeight: '100svh', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}
    >
      {/* Top line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(240,230,210,0.08) 20%, rgba(240,230,210,0.08) 80%, transparent)' }} />

      {/* Faint glow */}
      <div aria-hidden style={{ position: 'absolute', top: '50%', left: 0, right: 0, transform: 'translateY(-50%)', height: 380, background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(196,72,48,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Giant watermark */}
      <div aria-hidden style={{ position: 'absolute', bottom: 'clamp(30px, 8vw, 96px)', right: 'clamp(24px, 5vw, 72px)', fontFamily: 'var(--g-display)', fontSize: 'clamp(96px, 18vw, 240px)', fontWeight: 700, fontStyle: 'italic', color: 'rgba(240,230,210,0.012)', lineHeight: 0.85, userSelect: 'none', pointerEvents: 'none', letterSpacing: 0, whiteSpace: 'nowrap' }}>
        quiet
      </div>

      <div style={{ padding: 'clamp(72px, 10vw, 120px) clamp(28px, 5vw, 80px)', maxWidth: 1280, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
        <div className="cta-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(48px, 7vw, 96px)', alignItems: 'center' }}>

          {/* Left: headline */}
          <motion.div
            initial={{ opacity: 0, x: -14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{ fontFamily: 'var(--g-mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--g-dim)', marginBottom: 22 }}>
              Install
            </div>
            <h2 style={{ fontFamily: 'var(--g-display)', fontSize: 'clamp(2.4rem, 4.2vw, 4rem)', fontWeight: 400, fontStyle: 'italic', color: 'var(--g-white)', margin: '0 0 22px', lineHeight: 1.06, letterSpacing: 0 }}>
              Stop letting apps announce every tiny move.
            </h2>
            <p style={{ fontFamily: 'var(--g-sans)', fontSize: 15, lineHeight: 1.65, color: 'var(--g-body)', margin: 0, maxWidth: 380 }}>
              Give yourself space to read, think, and reply without turning every action into a social broadcast.
            </p>
          </motion.div>

          {/* Right: CTAs + identity */}
          <motion.div
            initial={{ opacity: 0, x: 14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}
          >
            {/* Identity chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(240,230,210,0.03)', border: '1px solid rgba(240,230,210,0.07)', borderRadius: 8, marginBottom: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(196,72,48,0.15)', border: '1px solid rgba(196,72,48,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GhostMark size={15} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--g-sans)', fontSize: 12, fontWeight: 500, color: 'var(--g-white)', letterSpacing: 0 }}>Ghostify</div>
                <div style={{ fontFamily: 'var(--g-mono)', fontSize: 9.5, color: 'var(--g-dim)' }}>open source · local-only</div>
              </div>
              <div style={{ marginLeft: 'auto', fontFamily: 'var(--g-mono)', fontSize: 10, color: 'rgba(196,72,48,0.7)', letterSpacing: '0.04em' }}>
                Free
              </div>
            </div>

            {/* Primary CTA */}
            <a
              href="https://chromewebstore.google.com/detail/ghostify-hide-seen-typing/flpnibonbhdmnpgflnbemgghghhblmpm?utm_source=item-share-cb"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '14px 28px', borderRadius: 9, background: 'var(--g-white)', color: '#0B0A08', fontFamily: 'var(--g-sans)', fontSize: 15, fontWeight: 500, textDecoration: 'none', letterSpacing: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.35)', transition: 'transform 0.15s ease, box-shadow 0.2s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.4)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.35)'; }}
            >
              <Chrome size={16} />
              Get Ghostify
            </a>

            {/* Secondary */}
            <a
              href="https://github.com/Hendrizzzz/Ghostify"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 9, background: 'transparent', color: 'var(--g-white-dim)', fontFamily: 'var(--g-sans)', fontSize: 14, fontWeight: 400, textDecoration: 'none', letterSpacing: 0, border: '1px solid rgba(240,230,210,0.14)', transition: 'border-color 0.18s ease, color 0.18s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,230,210,0.3)'; (e.currentTarget as HTMLElement).style.color = 'var(--g-white)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,230,210,0.14)'; (e.currentTarget as HTMLElement).style.color = 'var(--g-white-dim)'; }}
            >
              <Github size={14} strokeWidth={1.5} />
              View source
            </a>

            {/* Edge — quiet tertiary */}
            <div style={{ marginTop: 2 }}>
              <a
                href="https://microsoftedge.microsoft.com/addons/detail/ghostify-hide-seen-typ/mgbppdkolkeelimnemlbpmfdddhoeeal"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: 'var(--g-mono)', fontSize: 11, color: 'var(--g-dim)', textDecoration: 'none', letterSpacing: '0.04em', borderBottom: '1px solid rgba(240,230,210,0.12)', paddingBottom: 2, transition: 'color 0.18s ease, border-color 0.18s ease' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--g-body)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,230,210,0.25)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--g-dim)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,230,210,0.12)'; }}
              >
                Also available for Edge →
              </a>
            </div>

            <p style={{ fontFamily: 'var(--g-mono)', fontSize: 10, color: 'rgba(240,230,210,0.18)', margin: '6px 0 0', letterSpacing: '0.03em', lineHeight: 1.7 }}>
              Free · Open source · No account required
              <br />
              Messenger · Facebook · Instagram
            </p>
          </motion.div>

        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .cta-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
      `}</style>
    </section>
  );
}
