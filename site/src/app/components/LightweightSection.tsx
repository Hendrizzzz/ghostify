import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';

function CountUp({ target }: { target: number }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const duration = 1200;
    const start = performance.now();
    const update = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(ease * target * 100) / 100);
      if (t < 1) requestAnimationFrame(update);
      else setValue(target);
    };
    requestAnimationFrame(update);
  }, [inView, target]);

  return (
    <span ref={ref}>
      {target % 1 !== 0 ? value.toFixed(2) : Math.round(value)}
    </span>
  );
}

export function LightweightSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-80px' });

  return (
    <section
      ref={sectionRef}
      className="snap-start"
      style={{
        background: '#0C0B09',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '80svh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {/* Top hairline */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(240,230,210,0.07) 20%, rgba(240,230,210,0.07) 80%, transparent)' }} />

      {/* Faint grid lines across the full section */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(240,230,210,0.018) 40px)', pointerEvents: 'none' }} />

      {/* Giant watermark — bleeds to edges */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: 'clamp(28px, 7vw, 86px)',
          right: 'clamp(28px, 6vw, 92px)',
          fontFamily: 'var(--g-display)',
          fontSize: 'clamp(86px, 17vw, 220px)',
          fontWeight: 700,
          fontStyle: 'italic',
          color: 'rgba(240,230,210,0.014)',
          lineHeight: 0.85,
          userSelect: 'none',
          pointerEvents: 'none',
          letterSpacing: 0,
          whiteSpace: 'nowrap',
        }}
      >
        local
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(60px, 9vw, 100px) clamp(28px, 4vw, 56px)', position: 'relative', zIndex: 1 }}>

        {/* Eyebrow */}
        <div
          style={{
            fontFamily: 'var(--g-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--g-dim)',
            marginBottom: 28,
          }}
        >
          Footprint
        </div>

        {/* Headline — display serif, the one editorial moment */}
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: 'var(--g-display)',
            fontSize: 'clamp(2.4rem, 5.5vw, 4.6rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            color: 'var(--g-white)',
            margin: '0 0 56px',
            lineHeight: 1.06,
            letterSpacing: 0,
            maxWidth: 560,
          }}
        >
          Small enough
          <br />
          to disappear.
        </motion.h2>

        {/* Stats — receipt row, no card wrapper */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 0,
            flexWrap: 'wrap',
            borderTop: '1px solid rgba(240,230,210,0.07)',
            marginBottom: 40,
          }}
          className="receipt-row"
        >
          {/* Stat 1 */}
          <div style={{ padding: 'clamp(20px, 3vw, 32px) 0', paddingRight: 'clamp(28px, 5vw, 64px)', borderRight: '1px solid rgba(240,230,210,0.07)', flexShrink: 0 }}>
            <div
              style={{
                fontFamily: 'var(--g-display)',
                fontSize: 'clamp(2.8rem, 7vw, 6rem)',
                fontWeight: 300,
                color: 'var(--g-white)',
                lineHeight: 0.9,
                letterSpacing: 0,
                marginBottom: 10,
              }}
            >
              Local
            </div>
            <div style={{ fontFamily: 'var(--g-mono)', fontSize: 10.5, color: 'var(--g-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              privacy controls
            </div>
          </div>

          {/* Stat 2 */}
          <div style={{ padding: 'clamp(20px, 3vw, 32px) 0', paddingLeft: 'clamp(28px, 5vw, 64px)', paddingRight: 'clamp(28px, 5vw, 64px)', borderRight: '1px solid rgba(240,230,210,0.07)', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--g-display)', fontSize: 'clamp(2.8rem, 7vw, 6rem)', fontWeight: 300, color: 'var(--g-white)', lineHeight: 0.9, letterSpacing: 0, marginBottom: 10 }}>
              <CountUp target={0} />
            </div>
            <div style={{ fontFamily: 'var(--g-mono)', fontSize: 10.5, color: 'var(--g-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Ghostify servers
            </div>
          </div>

          {/* Stat 3 */}
          <div style={{ padding: 'clamp(20px, 3vw, 32px) 0', paddingLeft: 'clamp(28px, 5vw, 64px)', paddingRight: 'clamp(28px, 5vw, 64px)', borderRight: '1px solid rgba(240,230,210,0.07)', flexShrink: 0 }} className="stat-accounts">
            <div style={{ fontFamily: 'var(--g-display)', fontSize: 'clamp(2.8rem, 7vw, 6rem)', fontWeight: 300, color: 'var(--g-white)', lineHeight: 0.9, letterSpacing: 0, marginBottom: 10 }}>
              <CountUp target={0} />
            </div>
            <div style={{ fontFamily: 'var(--g-mono)', fontSize: 10.5, color: 'var(--g-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              accounts required
            </div>
          </div>

          {/* Body copy — sits inline with stats on desktop */}
          <div style={{ padding: 'clamp(20px, 3vw, 32px) 0', paddingLeft: 'clamp(28px, 5vw, 64px)', flex: 1, minWidth: 220 }} className="receipt-body">
            <p
              style={{
                fontFamily: 'var(--g-sans)',
                fontSize: 14,
                lineHeight: 1.65,
                color: 'var(--g-body)',
                margin: '0 0 16px',
                maxWidth: 340,
              }}
            >
              Built to feel like a browser control, not another app to manage. No Ghostify cloud sync. No update nag.
            </p>
            <div
              style={{
                fontFamily: 'var(--g-mono)',
                fontSize: 10.5,
                color: 'rgba(240,230,210,0.2)',
                letterSpacing: '0.03em',
                lineHeight: 1.8,
              }}
            >
              Ghostify runs inside supported tabs you already opened.
              <br />
              No Ghostify server in the path.
            </div>
          </div>
        </div>

      </div>

      {/* Bottom hairline */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(240,230,210,0.07) 20%, rgba(240,230,210,0.07) 80%, transparent)' }} />

      <style>{`
        @media (max-width: 900px) {
          .stat-accounts { display: none !important; }
        }
        @media (max-width: 700px) {
          .receipt-row { flex-direction: column !important; border-top: 1px solid rgba(240,230,210,0.07); }
          .receipt-row > div { border-right: none !important; border-bottom: 1px solid rgba(240,230,210,0.07); padding-left: 0 !important; padding-right: 0 !important; width: 100%; }
          .receipt-body { padding-left: 0 !important; }
        }
      `}</style>
    </section>
  );
}
