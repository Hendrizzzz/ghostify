import { motion } from 'motion/react';
import { Chrome, Github } from 'lucide-react';

export function FinalCTA() {
  return (
    <section
      className="snap-start"
      style={{ position: 'relative', minHeight: '100svh', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 23% 42%, rgba(212,106,82,0.065), transparent 30%), radial-gradient(ellipse at 82% 74%, rgba(239,226,208,0.035), transparent 36%), var(--g-bg)' }}
    >
      {/* Top line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--g-border) 20%, var(--g-border) 80%, transparent)' }} />

      {/* Giant watermark */}
      <div aria-hidden style={{ position: 'absolute', bottom: 'clamp(30px, 8vw, 96px)', right: 'clamp(24px, 5vw, 72px)', fontFamily: 'var(--g-watermark)', fontSize: 'clamp(96px, 18vw, 240px)', fontWeight: 400, fontStyle: 'italic', color: 'rgba(239,226,208,0.025)', lineHeight: 0.85, userSelect: 'none', pointerEvents: 'none', letterSpacing: 0, whiteSpace: 'nowrap' }}>
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
            <h2 style={{ fontFamily: 'var(--g-display)', fontSize: 'clamp(2.4rem, 4.2vw, 4rem)', fontWeight: 400, fontStyle: 'italic', color: 'var(--g-white)', margin: '0 0 22px', lineHeight: 1.02, letterSpacing: 0 }}>
              Stop letting apps announce every tiny move.
            </h2>
            <p style={{ fontFamily: 'var(--g-sans)', fontSize: 15, lineHeight: 1.65, color: 'var(--g-body)', margin: 0, maxWidth: 380 }}>
              Give yourself space to read, think, and reply without turning every action into a social broadcast.
            </p>
          </motion.div>

          {/* Right: CTAs */}
          <motion.div
            initial={{ opacity: 0, x: 14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}
          >
            {/* Primary CTA */}
            <a
              href="https://chromewebstore.google.com/detail/ghostify-hide-seen-typing/flpnibonbhdmnpgflnbemgghghhblmpm?utm_source=item-share-cb"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '14px 28px', borderRadius: 9, background: 'linear-gradient(135deg, var(--g-white), rgba(212,106,82,0.82))', color: 'var(--g-bg)', fontFamily: 'var(--g-sans)', fontSize: 15, fontWeight: 500, textDecoration: 'none', letterSpacing: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.35)', transition: 'transform 0.15s ease, box-shadow 0.2s ease' }}
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
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 9, background: 'transparent', color: 'var(--g-white-dim)', fontFamily: 'var(--g-sans)', fontSize: 15, fontWeight: 400, textDecoration: 'none', letterSpacing: 0, border: '1px solid rgba(240,230,210,0.14)', transition: 'border-color 0.18s ease, color 0.18s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,230,210,0.3)'; (e.currentTarget as HTMLElement).style.color = 'var(--g-white)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,230,210,0.14)'; (e.currentTarget as HTMLElement).style.color = 'var(--g-white-dim)'; }}
            >
              <Github size={14} strokeWidth={1.5} />
              View source
            </a>

            {/* Edge tertiary */}
            <div style={{ marginTop: 2 }}>
              <a
                href="https://microsoftedge.microsoft.com/addons/detail/ghostify-hide-seen-typ/mgbppdkolkeelimnemlbpmfdddhoeeal"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: 'var(--g-mono)', fontSize: 15, color: 'var(--g-dim)', textDecoration: 'none', letterSpacing: '0.04em', borderBottom: '1px solid rgba(240,230,210,0.12)', paddingBottom: 2, transition: 'color 0.18s ease, border-color 0.18s ease' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--g-body)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,230,210,0.25)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--g-dim)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,230,210,0.12)'; }}
              >
                Also available for Edge &rarr;
              </a>
            </div>

            <p style={{ fontFamily: 'var(--g-mono)', fontSize: 10, color: 'var(--g-dim)', margin: '6px 0 0', letterSpacing: '0.02em', lineHeight: 1.7 }}>
              Free &middot; Open source &middot; No account required
              <br />
              Messenger &middot; Facebook &middot; Instagram
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
