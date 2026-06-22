import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GhostSVG } from './GhostSVG';

const EVENT_PHRASES: Record<string, string> = {
  typing: 'typing stayed quiet.',
  'chat-open': 'seen stayed back.',
  'story-view': 'story stayed quiet.',
  'feature-off': 'that one went through.',
};

const FRICTION  = 0.974;
const GRAVITY   = 0.16;
const BOUNCE    = 0.82;
const MIN_SPEED = 0.12;
const THROW_POWER = 36;
const MAX_THROW_SPEED = 64;
const GHOST_W   = 64;
const GHOST_H   = 64;
const GLIDE_K   = 0.045;
const BUBBLE_W  = 200;
const BUBBLE_MIN_W = 158;
const DANCE_DURATION_MS = 1740;
const TYPING_SETTLE_MS = 420;
const IDLE_MESSAGE_MS = 5200;
const IDLE_PROMPT_MS  = 14000;
const IDLE_PHRASES = [
  'No login. No cloud relay.',
  'Read receipts stay local.',
  'Typing indicators stay quiet.',
  'Messenger, Facebook, Instagram.',
  "move me. i'll settle.",
];
const THROW_PHRASES = [
  'nice throw.',
  'good toss.',
  'whee. local-only flight.',
  'that had range.',
];

export function GhostMascot() {
  const [message, setMessage]         = useState<string | null>(null);
  const [isFlying, setIsFlying]       = useState(false);
  const [typingMotion, setTypingMotion] = useState<'idle' | 'burst' | 'active' | 'settling'>('idle');
  const [bubbleBelow, setBubbleBelow] = useState(false);
  const [mounted, setMounted]         = useState(false);

  const pos           = useRef({ x: 200, y: 200 });
  const visualPos     = useRef({ x: -200, y: -200 });
  const vel           = useRef({ x: 0, y: 0 });
  const isDragging    = useRef(false);
  const isFlyingRef   = useRef(false);
  const lastPointerAt = useRef(0);
  const dragOffset    = useRef({ x: 0, y: 0 });
  const lastPointers  = useRef<{ x: number; y: number; t: number }[]>([]);
  const rafRef        = useRef<number>();
  const msgTimer      = useRef<ReturnType<typeof setTimeout>>();
  const danceTimer    = useRef<ReturnType<typeof setTimeout>>();
  const settleTimer   = useRef<ReturnType<typeof setTimeout>>();
  const idleTimer     = useRef<ReturnType<typeof setInterval>>();
  const idlePhase     = useRef(Math.random() * Math.PI * 2);
  const idleT         = useRef(0);
  const idlePhrase    = useRef(0);
  const lastTouched   = useRef(Date.now());
  const ghostRef      = useRef<HTMLDivElement>(null);
  const bubbleRef     = useRef<HTMLDivElement>(null);
  const bubbleLayout  = useRef({ below: false, left: 0, top: -200, width: BUBBLE_W });
  const typingActive  = useRef(false);
  const typingBurstUntil = useRef(0);

  // Hold-center state
  const isHoldingCenter  = useRef(false);
  const holdCenterUntil  = useRef(0);
  const centerTarget     = useRef({ x: 0, y: 0 });

  const safeMascotPos = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw <= 640) {
      const x = vw - GHOST_W - 14;
      const y = Math.min(vh - GHOST_H - 16, Math.max(318, vh * 0.8));

      return {
        x: Math.max(12, x),
        y: Math.max(140, y),
      };
    }

    const rightInset = vw <= 640 ? 18 : 88;
    const minY = vw <= 640 ? 150 : 112;
    const preferredY = vw <= 640 ? vh * 0.3 : vh * 0.22;

    return {
      x: Math.max(16, Math.min(vw - GHOST_W - 16, vw - GHOST_W - rightInset)),
      y: Math.max(minY, Math.min(vh - GHOST_H - 88, preferredY)),
    };
  }, []);

  const setFlying = useCallback((next: boolean) => {
    if (isFlyingRef.current === next) return;
    isFlyingRef.current = next;
    setIsFlying(next);
  }, []);

  const updateBubblePos = useCallback((px: number, py: number) => {
    const vw = window.innerWidth;
    const margin = 14;
    const width = Math.min(BUBBLE_W, Math.max(BUBBLE_MIN_W, vw - margin * 2));
    let left = px + GHOST_W / 2 - width / 2;
    left = Math.max(margin, Math.min(vw - width - margin, left));
    const below = py < 112;
    const top = py + (below ? GHOST_H + 10 : -50);
    const bubble = bubbleRef.current;

    bubbleLayout.current = { below, left, top, width };

    if (bubble) {
      bubble.style.transform = `translate3d(${left.toFixed(2)}px, ${top.toFixed(2)}px, 0)`;
      bubble.style.width = `${width.toFixed(2)}px`;
    }

    setBubbleBelow((current) => (current === below ? current : below));
  }, []);

  const applyVisualPos = useCallback((x: number, y: number) => {
    visualPos.current = { x, y };
    const ghost = ghostRef.current;

    if (ghost) {
      ghost.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    }

    updateBubblePos(x, y);
  }, [updateBubblePos]);

  const parkAtSafeEdge = useCallback(() => {
    const next = safeMascotPos();
    pos.current = next;
    vel.current = { x: 0, y: 0 };
    isHoldingCenter.current = false;
    setFlying(false);
    applyVisualPos(next.x, next.y);
  }, [safeMascotPos, setFlying, applyVisualPos]);

  const showMessage = useCallback((msg: string, duration = IDLE_MESSAGE_MS) => {
    clearTimeout(msgTimer.current);
    setMessage(msg);
    msgTimer.current = setTimeout(() => setMessage(null), duration);
  }, []);

  const heroIsVisible = useCallback(() => {
    const hero = document.getElementById('hero');
    if (!hero) return false;
    const rect = hero.getBoundingClientRect();
    return rect.top < window.innerHeight * 0.75 && rect.bottom > window.innerHeight * 0.2;
  }, []);

  const glideToHeroCallout = useCallback((type: string) => {
    const parked = window.innerWidth <= 640 ? safeMascotPos() : null;
    const heroBrowser = document.querySelector<HTMLElement>('[data-hero-cursor]')?.parentElement;
    const rect = heroBrowser?.getBoundingClientRect();
    const useHeroSpot = !parked && rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    const demoBrowser = document.querySelector<HTMLElement>('.demo-browser');
    const demoRect = demoBrowser?.getBoundingClientRect();
    const useDemoSpot = !parked && !useHeroSpot && demoRect && demoRect.width > 0 && demoRect.height > 0 && demoRect.bottom > 0 && demoRect.top < window.innerHeight;
    const xRatio = type === 'story-view' ? 0.72 : 0.68;
    const yRatio = type === 'story-view' ? 0.3 : 0.28;
    const demoYMax = Math.max(170, window.innerHeight - GHOST_H - 96);
    const cx = parked
      ? parked.x
      : useHeroSpot
        ? rect.left + rect.width * xRatio - GHOST_W / 2
        : useDemoSpot
          ? demoRect.left + demoRect.width * (type === 'story-view' ? 0.78 : 0.82) - GHOST_W / 2
        : window.innerWidth / 2 - GHOST_W / 2;
    const cy = parked
      ? parked.y
      : useHeroSpot
        ? rect.top + rect.height * yRatio - GHOST_H / 2
        : useDemoSpot
          ? Math.max(170, Math.min(demoYMax, demoRect.top - GHOST_H - 28))
        : Math.max(170, window.innerHeight * 0.32 - GHOST_H / 2);
    const maxX = window.innerWidth - GHOST_W - 16;
    const maxY = window.innerHeight - GHOST_H - 16;
    centerTarget.current  = { x: cx, y: cy };
    centerTarget.current = {
      x: Math.max(16, Math.min(maxX, centerTarget.current.x)),
      y: Math.max(useHeroSpot ? 64 : 150, Math.min(maxY, centerTarget.current.y)),
    };
    isHoldingCenter.current = true;
    holdCenterUntil.current = Date.now() + 5800;
  }, [safeMascotPos]);

  const extendHoldCenter = useCallback((ms = 5500) => {
    if (isHoldingCenter.current) {
      holdCenterUntil.current = Math.max(holdCenterUntil.current, Date.now() + ms);
    }
  }, []);

  const settleTypingMotion = useCallback(() => {
    clearTimeout(danceTimer.current);
    clearTimeout(settleTimer.current);
    setTypingMotion('settling');
    settleTimer.current = setTimeout(() => setTypingMotion('idle'), TYPING_SETTLE_MS);
  }, []);

  const startTypingMotion = useCallback(() => {
    typingActive.current = true;
    typingBurstUntil.current = Date.now() + DANCE_DURATION_MS;
    clearTimeout(danceTimer.current);
    clearTimeout(settleTimer.current);
    setTypingMotion('burst');
    danceTimer.current = setTimeout(() => {
      if (typingActive.current) setTypingMotion('active');
      else settleTypingMotion();
    }, DANCE_DURATION_MS);
  }, [settleTypingMotion]);

  const continueTypingMotion = useCallback(() => {
    if (!typingActive.current) {
      startTypingMotion();
      return;
    }
    clearTimeout(settleTimer.current);
    extendHoldCenter(2200);
  }, [extendHoldCenter, startTypingMotion]);

  const stopTypingMotion = useCallback(() => {
    if (!typingActive.current && Date.now() >= typingBurstUntil.current) return;
    typingActive.current = false;
    const remainingBurst = Math.max(0, typingBurstUntil.current - Date.now());
    clearTimeout(danceTimer.current);
    danceTimer.current = setTimeout(settleTypingMotion, remainingBurst);
  }, [settleTypingMotion]);

  // RAF physics + hold-center glide
  const tick = useCallback(() => {
    if (!isDragging.current) {
      if (isHoldingCenter.current) {
        if (Date.now() < holdCenterUntil.current) {
          const cx = centerTarget.current.x;
          const cy = centerTarget.current.y;
          const dx = cx - pos.current.x;
          const dy = cy - pos.current.y;
          if (Math.sqrt(dx * dx + dy * dy) > 1.5) {
            pos.current.x += dx * GLIDE_K;
            pos.current.y += dy * GLIDE_K;
          } else {
            pos.current.x = cx;
            pos.current.y = cy;
          }
          vel.current = { x: 0, y: 0 };
          applyVisualPos(pos.current.x, pos.current.y);
          setFlying(false);
        } else {
          isHoldingCenter.current = false;
        }
      } else {
        const vx = vel.current.x;
        const vy = vel.current.y;
        const speed = Math.sqrt(vx * vx + vy * vy);

        if (speed > MIN_SPEED) {
          vel.current.x *= FRICTION;
          vel.current.y  = vel.current.y * FRICTION + GRAVITY;

          const vw = window.innerWidth  - GHOST_W;
          const vh = window.innerHeight - GHOST_H;

          pos.current.x += vel.current.x;
          pos.current.y += vel.current.y;

          if (pos.current.x <= 0)  { pos.current.x = 0;  vel.current.x *= -BOUNCE; }
          if (pos.current.x >= vw) { pos.current.x = vw; vel.current.x *= -BOUNCE; }
          if (pos.current.y <= 0)  { pos.current.y = 0;  vel.current.y *= -BOUNCE; }
          if (pos.current.y >= vh) {
            pos.current.y   = vh;
            vel.current.y  *= -BOUNCE;
            vel.current.x  *= 0.94;
          }

          applyVisualPos(pos.current.x, pos.current.y);
          setFlying(true);
        } else {
          // Idle drift — very slow
          idleT.current += 0.007;
          const dx = Math.sin(idleT.current * 0.22 + idlePhase.current) * 0.08;
          const dy = Math.cos(idleT.current * 0.16 + idlePhase.current + 1) * 0.05;
          pos.current.x = Math.max(0, Math.min(window.innerWidth  - GHOST_W, pos.current.x + dx));
          pos.current.y = Math.max(0, Math.min(window.innerHeight - GHOST_H, pos.current.y + dy));
          vel.current = { x: 0, y: 0 };
          applyVisualPos(pos.current.x, pos.current.y);
          setFlying(false);
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [applyVisualPos, setFlying]);

  useEffect(() => {
    pos.current = safeMascotPos();
    visualPos.current = { x: pos.current.x, y: pos.current.y };
    updateBubblePos(pos.current.x, pos.current.y);
    setMounted(true);

    rafRef.current = requestAnimationFrame(tick);

    // No idle phrase cycle — mascot is silent unless triggered by events

    return () => {
      clearTimeout(msgTimer.current);
      clearTimeout(danceTimer.current);
      clearTimeout(settleTimer.current);
      clearInterval(idleTimer.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [safeMascotPos, tick, showMessage, updateBubblePos]);

  useEffect(() => {
    if (!message) return;
    updateBubblePos(pos.current.x, pos.current.y);
  }, [message, bubbleBelow, updateBubblePos]);

  useEffect(() => {
    const moveToSafeEdge = (clearBubble = false) => {
      if (isDragging.current) return;
      if (clearBubble) {
        clearTimeout(msgTimer.current);
        setMessage(null);
      }
      stopTypingMotion();
      parkAtSafeEdge();
    };

    const onResize = () => {
      if (Date.now() - lastTouched.current < 900) return;
      moveToSafeEdge(false);
    };

    const onAnchorJump = () => {
      lastTouched.current = Date.now();
      moveToSafeEdge(true);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('hashchange', onAnchorJump);
    window.addEventListener('popstate', onAnchorJump);
    window.addEventListener('ghostify:anchor-jump', onAnchorJump);
    if (window.location.hash) window.setTimeout(onAnchorJump, 0);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('hashchange', onAnchorJump);
      window.removeEventListener('popstate', onAnchorJump);
      window.removeEventListener('ghostify:anchor-jump', onAnchorJump);
    };
  }, [parkAtSafeEdge, stopTypingMotion]);

  useEffect(() => {
    idleTimer.current = setInterval(() => {
      if (isDragging.current || isHoldingCenter.current || heroIsVisible()) return;
      if (Date.now() - lastTouched.current < IDLE_PROMPT_MS) return;

      const phrase = IDLE_PHRASES[idlePhrase.current % IDLE_PHRASES.length];
      idlePhrase.current += 1;
      lastTouched.current = Date.now();
      showMessage(phrase, IDLE_MESSAGE_MS);
    }, 3000);

    return () => clearInterval(idleTimer.current);
  }, [heroIsVisible, showMessage]);

  // React to hero browser events
  useEffect(() => {
    const handler = (e: Event) => {
      const type = (e as CustomEvent<{ type: string }>).detail?.type;
      if (!type) return;

      if (type === 'typing' || type === 'typing-start') {
        if (!isHoldingCenter.current && !heroIsVisible()) glideToHeroCallout(type);
        extendHoldCenter(5500);
        startTypingMotion();
        showMessage(EVENT_PHRASES.typing, 4000);
        return;
      }

      if (type === 'typing-active') {
        continueTypingMotion();
        return;
      }

      if (type === 'typing-stop') {
        stopTypingMotion();
        return;
      }

      const phrase = EVENT_PHRASES[type];
      if (!phrase) return;

      if ((type === 'chat-open' || type === 'story-view') && window.innerWidth <= 640) {
        stopTypingMotion();
        parkAtSafeEdge();
      } else if (type === 'chat-open' || type === 'story-view') {
        stopTypingMotion();
        glideToHeroCallout(type);
      }

      showMessage(phrase, 4000);
    };

    window.addEventListener('ghostify:mascot', handler);
    return () => window.removeEventListener('ghostify:mascot', handler);
  }, [showMessage, glideToHeroCallout, extendHoldCenter, parkAtSafeEdge, heroIsVisible, startTypingMotion, continueTypingMotion, stopTypingMotion]);

  const beginDragAt = useCallback((clientX: number, clientY: number, timeStamp: number) => {
    lastTouched.current = Date.now();
    isDragging.current = true;
    isHoldingCenter.current = false;
    dragOffset.current = { x: clientX - pos.current.x, y: clientY - pos.current.y };
    lastPointers.current = [{ x: clientX, y: clientY, t: timeStamp }];
    setFlying(false);
    typingActive.current = false;
    clearTimeout(danceTimer.current);
    clearTimeout(settleTimer.current);
    setTypingMotion('idle');
    clearTimeout(msgTimer.current);
    setMessage(null);
  }, [setFlying]);

  const dragAt = useCallback((clientX: number, clientY: number, timeStamp: number) => {
    if (!isDragging.current) return;
    const nx = clientX - dragOffset.current.x;
    const ny = clientY - dragOffset.current.y;
    pos.current = { x: nx, y: ny };
    applyVisualPos(nx, ny);
    lastPointers.current.push({ x: clientX, y: clientY, t: timeStamp });
    if (lastPointers.current.length > 6) lastPointers.current.shift();
  }, [applyVisualPos]);

  const finishDrag = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    lastTouched.current = Date.now();
    const pts = lastPointers.current;
    let releasedSpeed = 0;
    if (pts.length >= 2) {
      const last = pts[pts.length - 1];
      const prev = pts[Math.max(0, pts.length - 2)];
      const dt = Math.max(last.t - prev.t, 16);
      const rawVel = {
        x: ((last.x - prev.x) / dt) * THROW_POWER,
        y: ((last.y - prev.y) / dt) * THROW_POWER,
      };
      const rawSpeed = Math.sqrt(rawVel.x * rawVel.x + rawVel.y * rawVel.y);
      const scale = rawSpeed > MAX_THROW_SPEED ? MAX_THROW_SPEED / rawSpeed : 1;
      vel.current = { x: rawVel.x * scale, y: rawVel.y * scale };
      releasedSpeed = Math.sqrt(vel.current.x * vel.current.x + vel.current.y * vel.current.y);
    }
    lastPointers.current = [];
    const throwLine = THROW_PHRASES[Math.floor(Math.random() * THROW_PHRASES.length)];
    showMessage(releasedSpeed > 1.1 ? throwLine : 'parked.', 4500);
  }, [showMessage]);

  // Pointer drag
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    lastPointerAt.current = Date.now();
    e.preventDefault();
    beginDragAt(e.clientX, e.clientY, e.timeStamp);
    ghostRef.current?.setPointerCapture(e.pointerId);
  }, [beginDragAt]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    lastPointerAt.current = Date.now();
    dragAt(e.clientX, e.clientY, e.timeStamp);
  }, [dragAt]);

  const onPointerUp = useCallback(() => {
    lastPointerAt.current = Date.now();
    finishDrag();
  }, [finishDrag]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || Date.now() - lastPointerAt.current < 700) return;
    e.preventDefault();
    beginDragAt(e.clientX, e.clientY, e.timeStamp);

    const onWindowMove = (event: MouseEvent) => {
      dragAt(event.clientX, event.clientY, event.timeStamp);
    };
    const onWindowUp = () => {
      window.removeEventListener('mousemove', onWindowMove);
      window.removeEventListener('mouseup', onWindowUp);
      finishDrag();
    };

    window.addEventListener('mousemove', onWindowMove);
    window.addEventListener('mouseup', onWindowUp);
  }, [beginDragAt, dragAt, finishDrag]);

  if (!mounted) return null;

  const mascotAnimation = isFlying
    ? 'ghostFlightTumble 0.72s ease-in-out infinite'
    : typingMotion === 'burst'
      ? 'ghostOrbit 0.85s ease-in-out 2 both'
      : typingMotion === 'active'
        ? 'ghostTypingActive 1.45s ease-in-out infinite'
        : typingMotion === 'settling'
          ? `ghostSettle ${TYPING_SETTLE_MS}ms ease-out 1 both`
          : 'ghostFloat 6.5s ease-in-out infinite';

  return (
    <>
      {/* Speech bubble */}
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              zIndex: 10000,
              pointerEvents: 'none',
              willChange: 'opacity',
            }}
          >
            <div
              ref={bubbleRef}
              style={{
                position: 'relative',
                width: bubbleLayout.current.width,
                transform: `translate3d(${bubbleLayout.current.left.toFixed(2)}px, ${bubbleLayout.current.top.toFixed(2)}px, 0)`,
                willChange: 'transform',
                contain: 'layout paint style',
                backfaceVisibility: 'hidden',
              }}
            >
              <motion.div
                initial={{ y: bubbleBelow ? -8 : 8, scale: 0.9 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ scale: 0.94 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: 'rgba(18,18,19,0.97)', border: '1px solid var(--g-border)', borderRadius: 9, padding: '7px 13px', boxShadow: '0 4px 18px rgba(0,0,0,0.42)', willChange: 'transform', backfaceVisibility: 'hidden' }}
              >
                <span style={{ fontFamily: 'var(--g-mono)', fontSize: 11.5, letterSpacing: '0.01em', color: 'rgba(240,235,224,0.9)', display: 'block', textAlign: 'center' }}>
                  {message}
                </span>
              </motion.div>
              {!bubbleBelow && <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid rgba(18,18,19,0.94)' }} />}
              {bubbleBelow  && <div style={{ position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '5px solid rgba(18,18,19,0.94)' }} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ghost */}
      <div
        className="ghost-mascot-shell"
        ref={ghostRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onMouseDown={onMouseDown}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: GHOST_W,
          height: GHOST_H,
          transform: `translate3d(${visualPos.current.x.toFixed(2)}px, ${visualPos.current.y.toFixed(2)}px, 0)`,
          zIndex: 10000,
          cursor: isDragging.current ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
          willChange: 'transform',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backfaceVisibility: 'hidden',
          contain: 'layout paint style',
        }}
      >
        <div style={{ animation: mascotAnimation, willChange: 'transform', transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}>
          <GhostSVG
            size={GHOST_W}
            style={{
              width: 'var(--ghost-mascot-size, 64px)',
              height: 'var(--ghost-mascot-size, 64px)',
              display: 'block',
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes ghostTypingActive {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
          50% { transform: translateY(-4px) rotate(1.1deg) scale(1.012); }
        }
        @keyframes ghostSettle {
          0% { transform: translateY(-2px) rotate(0.35deg) scale(1.006); }
          100% { transform: translateY(0) rotate(0deg) scale(1); }
        }
        @keyframes ghostFlightTumble {
          0%, 100% { transform: translateY(0) rotate(-4deg) scale(1); }
          45% { transform: translateY(-3px) rotate(7deg) scale(1.025); }
          75% { transform: translateY(1px) rotate(2deg) scale(0.995); }
        }
        @media (max-width: 480px) {
          .ghost-mascot-shell {
            --ghost-mascot-size: 54px;
          }
        }
        @media (max-width: 360px) {
          .ghost-mascot-shell {
            --ghost-mascot-size: 44px;
          }
        }
      `}</style>
    </>
  );
}
