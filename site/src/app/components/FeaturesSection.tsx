import { useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GhostMark } from './GhostSVG';

const H = '1px solid rgba(240,230,210,0.06)';
const FEATURE_SCENE_HEIGHT = 190;

function SceneStage({
  children,
  name,
  align = 'flex-start',
}: {
  children: ReactNode;
  name: string;
  align?: 'flex-start' | 'center';
}) {
  return (
    <div
      className="feature-scene-stage"
      data-feature-scene={name}
      style={{
        width: '100%',
        height: FEATURE_SCENE_HEIGHT,
        minHeight: FEATURE_SCENE_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align,
      }}
    >
      {children}
    </div>
  );
}

/* ── Mini product evidence scenes ──────────────────────── */

function ReadScene() {
  const [phase, setPhase] = useState<'list' | 'thread'>('list');

  useEffect(() => {
    // cycle: list (2.8s) → thread (3.2s) → repeat
    const durations = { list: 2800, thread: 3200 };
    let tid: ReturnType<typeof setTimeout>;
    const tick = () => {
      setPhase(p => {
        const next = p === 'list' ? 'thread' : 'list';
        tid = setTimeout(tick, durations[next]);
        return next;
      });
    };
    tid = setTimeout(tick, durations.list);
    return () => clearTimeout(tid);
  }, []);

  return (
    <div style={{ background: '#18202E', borderRadius: 10, overflow: 'hidden', width: 'min(100%, 320px)', height: 182, position: 'relative', flexShrink: 0 }}>
      <AnimatePresence mode="wait">
        {phase === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ position: 'absolute', inset: 0, height: '100%', boxSizing: 'border-box', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}
          >
            {[
              { name: 'Sofia 💕', preview: 'ok fine whatever 🙄', color: '#FF6D00', unread: 3, active: true },
              { name: 'Jamie',    preview: 'ok but we need to talk 👀', color: '#7C4DFF' },
              { name: 'Alex',     preview: 'did you see what happened', color: '#0082FB' },
            ].map((ch) => (
              <div key={ch.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 7px', borderRadius: 7, background: ch.active ? 'rgba(255,109,0,0.12)' : 'transparent' }}>
                <div style={{ width: 30, height: 30, borderRadius: 15, background: ch.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'white', fontFamily: 'var(--g-sans)' }}>{ch.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--g-sans)', fontSize: 12, fontWeight: ch.unread ? 700 : 400, color: 'rgba(255,255,255,0.88)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</div>
                  <div style={{ fontFamily: 'var(--g-sans)', fontSize: 10.5, color: ch.unread ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.32)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.preview}</div>
                </div>
                {ch.unread && <div style={{ width: 17, height: 17, borderRadius: 9, background: '#FF6D00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, color: 'white', fontFamily: 'var(--g-sans)', flexShrink: 0 }}>{ch.unread}</div>}
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="thread"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ position: 'absolute', inset: 0, height: '100%', boxSizing: 'border-box', padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            {/* Matches Sofia's last 3 messages: she sent these while you were "online" */}
            <div style={{ alignSelf: 'flex-end', padding: '7px 11px', borderRadius: '14px 4px 14px 14px', background: '#0082FB', fontFamily: 'var(--g-sans)', fontSize: 12.5, color: 'white', lineHeight: 1.4 }}>
              lol yeah I know right 😂
            </div>
            <div style={{ alignSelf: 'flex-start', padding: '7px 11px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,255,255,0.08)', fontFamily: 'var(--g-sans)', fontSize: 12.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.4, maxWidth: '82%' }}>
              hey are you ignoring me
            </div>
            <div style={{ alignSelf: 'flex-start', padding: '7px 11px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,255,255,0.08)', fontFamily: 'var(--g-sans)', fontSize: 12.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.4 }}>
              ok fine whatever 🙄
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, alignSelf: 'flex-end', marginTop: 1 }}>
              <span style={{ fontFamily: 'var(--g-mono)', fontSize: 9, color: 'rgba(255,255,255,0.15)', textDecoration: 'line-through' }}>Seen 9:41 AM</span>
              <GhostMark size={10} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TypingScene() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 330, background: '#18202E', borderRadius: 10, padding: '16px 18px' }}>
      {/* Chat header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <div style={{ width: 26, height: 26, borderRadius: 13, background: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', fontFamily: 'var(--g-sans)', flexShrink: 0 }}>D</div>
        <span style={{ fontFamily: 'var(--g-sans)', fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>David Park</span>
        <span style={{ fontFamily: 'var(--g-sans)', fontSize: 10.5, color: 'rgba(255,255,255,0.3)', marginLeft: 2 }}>Active now</span>
      </div>
      {/* Their message */}
      <div style={{ alignSelf: 'flex-start', padding: '7px 11px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,255,255,0.08)', fontFamily: 'var(--g-sans)', fontSize: 12.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4, maxWidth: '82%' }}>
        did you read my last message?
      </div>
      {/* Your typing indicator (right side) — blocked by Ghostify */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, alignSelf: 'flex-end' }}>
        <div style={{ position: 'relative', padding: '8px 14px', borderRadius: '14px 4px 14px 14px', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.1)' }}>
          {/* Red strikethrough over the dots */}
          <div style={{ position: 'absolute', left: 8, right: 8, top: '50%', height: 1.5, background: 'rgba(212,106,82,0.72)', transform: 'translateY(-50%)', borderRadius: 1, zIndex: 1 }} />
          <div style={{ display: 'flex', gap: 5 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', animation: `typingBounce 1.1s ease-in-out ${i * 0.18}s infinite` }} />
            ))}
          </div>
        </div>
        <div style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(212,106,82,0.11)', border: '1px solid rgba(212,106,82,0.3)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <GhostMark size={9} />
          <span style={{ fontFamily: 'var(--g-mono)', fontSize: 9, color: 'rgba(228,139,109,0.88)', letterSpacing: '0.04em' }}>typing held</span>
        </div>
      </div>
      {/* Composer — you are actively typing */}
      <div style={{ height: 32, borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', padding: '0 13px', display: 'flex', alignItems: 'center', marginTop: 2 }}>
        <span style={{ fontFamily: 'var(--g-sans)', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>ok let me find it—</span>
        <span style={{ display: 'inline-block', width: 1, height: 13, background: '#0082FB', marginLeft: 1, animation: 'ghostBlink 1s ease-in-out infinite', verticalAlign: 'middle' }} />
      </div>
    </div>
  );
}

function StoryScene() {
  const [phase, setPhase] = useState<'rings' | 'viewer'>('rings');
  const [watched, setWatched] = useState(false); // ring stays pink after viewing

  useEffect(() => {
    // rings (2.4s) → viewer (3.6s) → rings (stay pink) → repeat
    const durations = { rings: 2400, viewer: 3600 };
    let tid: ReturnType<typeof setTimeout>;
    const tick = () => {
      setPhase(p => {
        const next = p === 'rings' ? 'viewer' : 'rings';
        if (next === 'viewer') setWatched(true); // mark ring as watched
        tid = setTimeout(tick, durations[next]);
        return next;
      });
    };
    tid = setTimeout(tick, durations.rings);
    return () => clearTimeout(tid);
  }, []);

  const stories = [
    { name: 'yuki', color: '#C62828', active: true },
    { name: 'leo', color: '#FF6D00' },
    { name: 'mei', color: '#7C4DFF' },
  ];

  return (
    <div style={{ width: 182, height: 124, position: 'relative', flexShrink: 0 }}>
      <AnimatePresence mode="wait">
        {phase === 'rings' ? (
          <motion.div key="rings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <div style={{ display: 'flex', gap: 8, padding: '8px 0' }}>
              {stories.map((s, i) => (
                <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 22, padding: 2,
                    background: (i === 0 && watched)
                      ? 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #bc1888)' // stays pink after watch
                      : i === 0
                      ? 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #bc1888)' // unread pink
                      : 'rgba(255,255,255,0.08)',
                  }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 18, background: s.color, border: '2px solid #0f0e0c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'var(--g-sans)' }}>
                      {s.name[0].toUpperCase()}
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--g-sans)', fontSize: 8.5, color: 'rgba(255,255,255,0.4)' }}>{s.name}</span>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--g-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.22)', paddingLeft: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <GhostMark size={8} />
              {watched ? 'view held back' : 'tap to view'}
            </div>
          </motion.div>
        ) : (
          <motion.div key="viewer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <div style={{ display: 'flex', gap: 3, marginBottom: 9 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ flex: 1, height: 2, borderRadius: 1, background: i === 0 ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.18)' }} />
              ))}
            </div>
            <div style={{ height: 98, borderRadius: 9, background: 'linear-gradient(155deg, rgba(131,58,180,0.7) 0%, rgba(193,53,132,0.6) 55%, rgba(245,96,64,0.5) 100%)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 8, left: 9, display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 20, height: 20, borderRadius: 10, background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.5)' }} />
                <span style={{ fontFamily: 'var(--g-sans)', fontSize: 9.5, fontWeight: 500, color: 'white' }}>yuki.photo</span>
              </div>
              <div style={{ position: 'absolute', bottom: 7, left: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <GhostMark size={9} />
                <span style={{ fontFamily: 'var(--g-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.45)' }}>story stayed quiet.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExtensionScene() {
  // 4-step cycle: exactly ONE toggle changes per step, step 3→0 is seamless
  const steps = [
    [true, true,  false],  // 0: Seen=ON Typing=ON Story=OFF  (start & end state)
    [true, true,  true ],  // 1: Story ON
    [true, false, true ],  // 2: Typing OFF
    [true, false, false],  // 3: Story OFF  →  next: step 0 (Typing ON = single change)
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const tid = setInterval(() => {
      setStep(s => (s + 1) % steps.length);
    }, 3000);
    return () => clearInterval(tid);
  }, []);

  const [seen, typing, story] = steps[step];
  const rows = [
    { label: 'Hide Seen',        on: seen },
    { label: 'Hide Typing',      on: typing },
    { label: 'Hide Story Views', on: story },
  ];

  return (
    <div style={{ width: 176, background: 'var(--g-surface)', border: '1px solid var(--g-border)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 10px 32px rgba(0,0,0,0.55)' }}>
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 7, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'var(--g-surface-2)' }}>
        <GhostMark size={14} />
        <span style={{ fontFamily: 'var(--g-sans)', fontSize: 12.5, fontWeight: 500, color: 'var(--g-white)', lineHeight: 1, letterSpacing: 0 }}>Ghostify</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--g-mono)', fontSize: 8.5, color: 'rgba(240,230,210,0.22)' }}>local</span>
      </div>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5.5px 12px' }}>
          <span style={{ fontFamily: 'var(--g-sans)', fontSize: 11, color: 'rgba(240,230,210,0.62)' }}>{row.label}</span>
          <div style={{ width: 26, height: 16, borderRadius: 8, backgroundColor: row.on ? '#D46A52' : 'rgba(240,230,210,0.13)', position: 'relative', flexShrink: 0, overflow: 'hidden', contain: 'paint', transition: 'background-color 0.48s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div
              style={{
                position: 'absolute', top: 3,
                left: 3,
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
                transform: row.on ? 'translate3d(10px, 0, 0)' : 'translate3d(0, 0, 0)',
                transition: 'transform 0.48s cubic-bezier(0.16, 1, 0.3, 1)',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
              }}
            />
          </div>
        </div>
      ))}
      <div style={{ height: 6 }} />
    </div>
  );
}

function FeatureCopy({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--g-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--g-dim)', marginBottom: 10 }}>
        {tag}
      </div>
      <h3 style={{ fontFamily: 'var(--g-sans)', fontSize: 21, fontWeight: 500, color: 'var(--g-white)', margin: '0 0 10px', lineHeight: 1.2, letterSpacing: 0 }}>
        {title}
      </h3>
      <p style={{ fontFamily: 'var(--g-sans)', fontSize: 15, lineHeight: 1.65, color: 'var(--g-body)', margin: 0 }}>
        {body}
      </p>
    </div>
  );
}

/* ── Section ────────────────────────────────────────────── */
export function FeaturesSection() {
  const CELL_PAD = 'clamp(32px, 3.5vw, 52px) clamp(28px, 3.5vw, 52px)';
  const FV = { once: true as const, margin: '-60px' };
  const FT = { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };

  return (
    <section id="features" className="snap-start features-section" style={{ position: 'relative', minHeight: '90svh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', background: 'transparent', marginTop: 0, scrollMarginTop: 76 }}>
      {/* Section heading */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.7, margin: '0px 0px -18% 0px' }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{ padding: 'clamp(16px, 2.4vw, 28px) clamp(28px, 4vw, 56px) clamp(20px, 3vw, 32px)' }}
      >
        <h2 style={{ fontFamily: 'var(--g-sans)', fontSize: 'clamp(1.4rem, 2.2vw, 1.9rem)', fontWeight: 500, color: 'var(--g-white)', margin: 0, lineHeight: 1.2, letterSpacing: 0 }}>
          Quiet controls for noisy apps.
        </h2>
      </motion.div>

      {/* Asymmetric 4-up grid — full viewport width, no maxWidth cage */}
      <div className="feat-outer" style={{ display: 'grid', gridTemplateColumns: '42% 58%', flex: 1 }}>

        {/* Feature 1 — left column, full height */}
        <motion.div
          className="feat-cell feat-f1"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={FV}
          transition={FT}
          style={{ padding: CELL_PAD, borderRight: H, display: 'flex', flexDirection: 'column', gap: 48, justifyContent: 'center' }}
        >
          <SceneStage name="read">
            <ReadScene />
          </SceneStage>
          <FeatureCopy
            tag="read receipts"
            title="Hide read receipts"
            body="Open messages without instantly sending a signal. No Seen labels, no timestamp pressure."
          />
        </motion.div>

        {/* Right column: Features 2, 3, 4 */}
        <div className="feat-col" style={{ display: 'flex', flexDirection: 'column' }}>

          {/* Feature 2 */}
          <motion.div
            className="feat-cell"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={FV}
            transition={{ ...FT, delay: 0.07 }}
            style={{ padding: CELL_PAD, borderBottom: H, display: 'flex', flexDirection: 'column', gap: 32, flex: 1, justifyContent: 'center' }}
          >
            <SceneStage name="typing">
              <TypingScene />
            </SceneStage>
            <FeatureCopy
              tag="typing indicators"
              title="Pause typing indicators"
              body="Draft, delete, rethink, and reply when you are ready."
            />
          </motion.div>

          {/* Features 3 + 4 — side by side */}
          <div className="feat-bottom" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1 }}>
            <motion.div
              className="feat-cell feat-f3"
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={FV}
              transition={{ ...FT, delay: 0.14 }}
              style={{ padding: CELL_PAD, borderRight: H, display: 'flex', flexDirection: 'column', gap: 28, justifyContent: 'center' }}
            >
              <SceneStage name="story">
                <StoryScene />
              </SceneStage>
              <FeatureCopy
                tag="story views"
                title="Reduce watch signals"
                body="Browse stories with less unwanted visibility where supported."
              />
            </motion.div>

            <motion.div
              className="feat-cell"
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={FV}
              transition={{ ...FT, delay: 0.21 }}
              style={{ padding: CELL_PAD, display: 'flex', flexDirection: 'column', gap: 28, justifyContent: 'center' }}
            >
              <SceneStage name="extension">
                <ExtensionScene />
              </SceneStage>
              <FeatureCopy
                tag="controls"
                title="Toggle each signal"
                body="Enable seen, typing, and story view protection independently. Mix and match exactly what stays hidden."
              />
            </motion.div>
          </div>
        </div>
      </div>

      <style>{`
        .features-section > * {
          position: relative;
          z-index: 1;
        }
        @media (max-width: 900px) {
          #features > div:first-child,
          .feat-outer {
            width: min(100%, 700px) !important;
            max-width: 700px !important;
            margin-left: auto !important;
            margin-right: auto !important;
            box-sizing: border-box !important;
          }
          .feat-outer {
            grid-template-columns: 1fr !important;
          }
          .feat-col,
          .feat-bottom {
            width: 100% !important;
          }
          .feat-f1 { border-right: none !important; border-bottom: ${H} !important; }
          .feat-bottom { grid-template-columns: 1fr !important; }
          .feat-f3 { border-right: none !important; border-bottom: ${H} !important; }
        }
        @media (max-height: 820px) and (min-width: 901px) {
          #features > div:first-child {
            padding-top: 30px !important;
            padding-bottom: 14px !important;
          }
          .feat-cell { padding: 18px 32px !important; gap: 18px !important; }
          .feat-f1 { gap: 26px !important; }
          .feature-scene-stage {
            height: 150px !important;
            min-height: 150px !important;
            overflow: visible !important;
          }
          .feature-scene-stage > * {
            transform: scale(0.88);
            transform-origin: left center;
          }
          .feat-cell h3 {
            font-size: 19px !important;
            margin-bottom: 8px !important;
          }
          .feat-cell p {
            font-size: 15px !important;
            line-height: 1.48 !important;
          }
        }
        @media (max-width: 480px) {
          #features > div:first-child {
            padding-top: 44px !important;
          }
          .feat-cell { padding: 28px 22px !important; }
        }
      `}</style>
    </section>
  );
}
