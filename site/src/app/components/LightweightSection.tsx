import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';

function CountUp({ target, active }: { target: number; active: boolean }) {
  const [value, setValue] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!active) return;
    if (shouldReduceMotion) {
      setValue(target);
      return;
    }

    const duration = 1200;
    const start = performance.now();
    let frame = 0;

    const update = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(ease * target * 100) / 100);
      if (t < 1) frame = requestAnimationFrame(update);
      else setValue(target);
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [active, shouldReduceMotion, target]);

  return (
    <span>
      {target % 1 !== 0 ? value.toFixed(2) : Math.round(value)}
    </span>
  );
}

function StableCount({ target, reserve, active }: { target: number; reserve: string; active: boolean }) {
  return (
    <span className="stable-count" aria-label={reserve}>
      <span className="stable-count-measure" aria-hidden="true">{reserve}</span>
      <span className="stable-count-value" aria-hidden="true">
        <CountUp target={target} active={active} />
      </span>
    </span>
  );
}

export function LightweightSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-80px' });
  const statsInView = useInView(statsRef, { once: true, amount: 0.12, margin: '0px' });

  return (
    <section
      ref={sectionRef}
      className="snap-start"
      style={{
        background:
          'radial-gradient(ellipse at 78% 26%, rgba(212,106,82,0.035), transparent 34%), linear-gradient(180deg, #100D0B 0%, var(--g-bg) 100%)',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '80svh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {/* Top hairline */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--g-border) 20%, var(--g-border) 80%, transparent)' }} />

      {/* Faint grid lines across the full section */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(239,226,208,0.02) 40px)', pointerEvents: 'none' }} />

      {/* Giant watermark — bleeds to edges */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: 'clamp(28px, 7vw, 86px)',
          right: 'clamp(28px, 6vw, 92px)',
          fontFamily: 'var(--g-watermark)',
          fontSize: 'clamp(86px, 17vw, 220px)',
          fontWeight: 400,
          fontStyle: 'italic',
          color: 'rgba(239,226,208,0.024)',
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
          ref={statsRef}
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
                fontWeight: 400,
                color: 'var(--g-white)',
                lineHeight: 0.9,
                letterSpacing: 0,
                marginBottom: 'clamp(16px, 1.4vw, 22px)',
              }}
            >
              <StableCount target={50.28} reserve="50.28" active={statsInView} />
              <span style={{ fontSize: '0.38em', fontWeight: 400, marginLeft: 6, color: 'var(--g-body)' }}>KiB</span>
            </div>
            <div style={{ fontFamily: 'var(--g-mono)', fontSize: 15, color: 'var(--g-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              installed size
            </div>
          </div>

          {/* Stat 2 */}
          <div style={{ padding: 'clamp(20px, 3vw, 32px) 0', paddingLeft: 'clamp(28px, 5vw, 64px)', paddingRight: 'clamp(28px, 5vw, 64px)', borderRight: '1px solid rgba(240,230,210,0.07)', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--g-display)', fontSize: 'clamp(2.8rem, 7vw, 6rem)', fontWeight: 400, color: 'var(--g-white)', lineHeight: 0.9, letterSpacing: 0, marginBottom: 10 }}>
              <CountUp target={0} active={statsInView} />
            </div>
            <div style={{ fontFamily: 'var(--g-mono)', fontSize: 15, color: 'var(--g-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              tracking relays
            </div>
          </div>

          {/* Stat 3 */}
          <div style={{ padding: 'clamp(20px, 3vw, 32px) 0', paddingLeft: 'clamp(28px, 5vw, 64px)', paddingRight: 'clamp(28px, 5vw, 64px)', borderRight: '1px solid rgba(240,230,210,0.07)', flexShrink: 0 }} className="stat-accounts">
            <div style={{ fontFamily: 'var(--g-display)', fontSize: 'clamp(2.8rem, 7vw, 6rem)', fontWeight: 400, color: 'var(--g-white)', lineHeight: 0.9, letterSpacing: 0, marginBottom: 10 }}>
              <CountUp target={0} active={statsInView} />
            </div>
            <div style={{ fontFamily: 'var(--g-mono)', fontSize: 15, color: 'var(--g-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              accounts required
            </div>
          </div>

          {/* Body copy — sits inline with stats on desktop */}
          <div style={{ padding: 'clamp(20px, 3vw, 32px) 0', paddingLeft: 'clamp(28px, 5vw, 64px)', flex: 1, minWidth: 220 }} className="receipt-body">
            <div
              style={{
                fontFamily: 'var(--g-mono)',
                fontSize: 15,
                color: 'rgba(240,230,210,0.2)',
                letterSpacing: '0.03em',
                lineHeight: 1.8,
              }}
            >
              Ghostify runs inside supported tabs you already opened.
              <br />
              No tracking relay in the path.
            </div>
          </div>
        </div>

      </div>

      {/* Bottom hairline */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--g-border) 20%, var(--g-border) 80%, transparent)' }} />

      <style>{`
        .stable-count {
          display: inline-grid;
          grid-template-areas: 'count';
          font-variant-numeric: tabular-nums;
          font-feature-settings: 'tnum' 1;
        }
        .stable-count > span {
          grid-area: count;
        }
        .stable-count-measure {
          visibility: hidden;
        }
        .stable-count-value {
          justify-self: end;
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
