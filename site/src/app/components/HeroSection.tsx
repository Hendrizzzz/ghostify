import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Chrome, Github, Globe } from 'lucide-react';
import { GhostMark, GhostSVG } from './GhostSVG';

type HeroPlatform = 'messenger' | 'facebook' | 'instagram';
type HeroProofKind = 'messenger' | 'instagram' | 'facebook' | 'local' | 'source';

interface MsgControls {
  seen: boolean;
  typing: boolean;
  story: boolean;
}
interface UnreadBadges {
  sofia: boolean;
}

function dispatchMascot(type: string) {
  window.dispatchEvent(new CustomEvent('ghostify:mascot', { detail: { type } }));
}

function HeroProofIcon({ kind, label }: { kind: HeroProofKind; label: string }) {
  if (kind === 'messenger') {
    return (
      <svg width="19" height="19" viewBox="0 0 32 32" fill="none" aria-label={label}>
        <path
          d="M16 4C9.1 4 4 8.75 4 15.15c0 3.45 1.48 6.45 3.95 8.45v4.1c0 .72.77 1.18 1.39.82l3.55-2.05c1 .25 2.05.38 3.11.38 6.9 0 12-4.75 12-11.7S22.9 4 16 4Z"
          fill="url(#heroMessengerGradient)"
        />
        <path d="M9.2 18.8 14 13.7l3.42 3.52 5.38-5.52-4.8 7.88-3.52-3.52-5.28 2.74Z" fill="white" />
        <defs>
          <linearGradient id="heroMessengerGradient" x1="5" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0078FF" />
            <stop offset="0.55" stopColor="#00C6FF" />
            <stop offset="1" stopColor="#A033FF" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (kind === 'instagram') {
    return (
      <svg width="19" height="19" viewBox="0 0 32 32" fill="none" aria-label={label}>
        <rect x="3" y="3" width="26" height="26" rx="8" fill="url(#heroInstagramGradient)" />
        <rect x="9.4" y="9.4" width="13.2" height="13.2" rx="4" stroke="white" strokeWidth="2.2" />
        <circle cx="16" cy="16" r="3.8" stroke="white" strokeWidth="2.2" />
        <circle cx="21.2" cy="10.9" r="1.45" fill="white" />
        <defs>
          <linearGradient id="heroInstagramGradient" x1="6" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FEDA75" />
            <stop offset="0.32" stopColor="#FA7E1E" />
            <stop offset="0.62" stopColor="#D62976" />
            <stop offset="1" stopColor="#4F5BD5" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (kind === 'facebook') {
    return (
      <svg width="19" height="19" viewBox="0 0 32 32" fill="none" aria-label={label}>
        <rect x="4" y="4" width="24" height="24" rx="7" fill="#1877F2" />
        <path
          d="M18.25 27.2v-9.55h3.2l.48-3.72h-3.68v-2.38c0-1.08.3-1.82 1.85-1.82h1.98V6.4c-.34-.05-1.52-.15-2.88-.15-2.85 0-4.8 1.74-4.8 4.94v2.74h-3.23v3.72h3.23v9.55h3.85Z"
          fill="white"
        />
      </svg>
    );
  }

  return kind === 'local' ? <Globe size={16} aria-label={label} /> : <Github size={15} aria-label={label} />;
}

/* ── Cursor waypoints (% of browser container dims) ──── */
const P = {
  rest:        { x: 60, y: 72 },
  extIcon:     { x: 96.4, y: 10 }, // far-right tab bar, extension icon
  msgTab:      { x: 9,  y: 10 },
  fbTab:       { x: 22, y: 10 },
  igTab:       { x: 34, y: 10 },
  sofiaChat:   { x: 14, y: 34 },   // first chat in messenger list
  igUnreadDM:  { x: 4,  y: 54 },   // h.nakano DM (3rd item in IG left rail)
  fbUnreadDM:  { x: 14, y: 30 },   // ryan DM (first item in FB list)
  composer:    { x: 56, y: 95 },
  storyBubble: { x: 4,  y: 23 },   // first story circle in IG left rail
  chatArea:    { x: 56, y: 64 },
  mfSeenToggle:{ x: 95, y: 54 },   // "Hide Seen" toggle in M/F popup group
} as const;

type CursorTarget = keyof typeof P;

const CURSOR_ANCHORS: Partial<Record<CursorTarget, { x: number; y: number }>> = {
  composer: { x: 0.5, y: 0.52 },
  chatArea: { x: 0.58, y: 0.56 },
  extIcon: { x: 0.5, y: 0.52 },
  mfSeenToggle: { x: 0.5, y: 0.5 },
};

/* ── Demo cursor ─────────────────────────────────────── */
function DemoCursor({ x, y, clickKey, target }: { x: number; y: number; clickKey: number; target: CursorTarget }) {
  return (
    <div
      data-hero-cursor
      data-current-target={target}
      data-click-key={clickKey}
      style={{
        position: 'absolute',
        left: `${x}%`, top: `${y}%`,
        transform: 'translate(-2px, -2px)',
        transition: 'left 0.72s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.72s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        zIndex: 50, pointerEvents: 'none',
      }}
    >
      <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
        <path d="M2 2L2 19L6 15L9 22L11.5 21L8.5 14L14.5 14L2 2Z" fill="white" stroke="rgba(0,0,0,0.55)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={clickKey}
          initial={{ scale: 0.2, opacity: 0.85 }}
          animate={{ scale: 3.2, opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          style={{ position: 'absolute', top: -9, left: -9, width: 22, height: 22, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.75)', pointerEvents: 'none' }}
        />
      </AnimatePresence>
    </div>
  );
}

/* ── Visual toggle (display-only, state-driven) ─────── */
function PopupToggle({ on, cursorTarget }: { on: boolean; cursorTarget?: CursorTarget }) {
  return (
    <div data-cursor-target={cursorTarget} style={{ width: 32, height: 18, borderRadius: 9, backgroundColor: on ? 'var(--g-accent)' : 'rgba(240,230,210,0.14)', position: 'relative', flexShrink: 0, overflow: 'hidden', contain: 'paint', transition: 'background-color 0.42s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      <div style={{ position: 'absolute', top: 3, left: 3, width: 12, height: 12, borderRadius: 6, backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transform: on ? 'translate3d(14px, 0, 0)' : 'translate3d(0, 0, 0)', transition: 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)', willChange: 'transform', backfaceVisibility: 'hidden' }} />
    </div>
  );
}

/* ── Ghostify popup — matches demo panel style ───────── */
function GhostifyHeroPopup({
  open, platform, msControls, igControls,
}: {
  open: boolean;
  platform: HeroPlatform;
  msControls: MsgControls;
  igControls: MsgControls;
}) {
  const groups = [
    { label: 'Instagram', platforms: ['instagram'] as HeroPlatform[], controls: igControls },
    { label: 'Messenger / Facebook', platforms: ['messenger', 'facebook'] as HeroPlatform[], controls: msControls },
  ];

  return (
    <AnimatePresence>
      {open && (
        <div style={{ position: 'absolute', top: 68, right: 6, zIndex: 30 }}>
          {/* Caret */}
          <div style={{ position: 'absolute', top: -6, right: 8, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '6px solid rgba(240,230,210,0.09)', zIndex: 1 }} />
          <div style={{ position: 'absolute', top: -5, right: 8, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '6px solid var(--g-surface)', zIndex: 2 }} />

          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: 220, background: 'var(--g-surface)', border: '1px solid var(--g-border)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', position: 'relative', zIndex: 3 }}
          >
            {/* Header */}
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(240,230,210,0.06)' }}>
              <GhostMark size={16} />
              <span style={{ fontFamily: 'var(--g-display)', fontSize: 13.5, fontWeight: 500, color: 'var(--g-white)', letterSpacing: '0.02em' }}>Ghostify</span>
              <div style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: 4, background: 'var(--g-accent)', boxShadow: '0 0 6px var(--g-accent)' }} />
            </div>

            {/* Groups */}
            {groups.map((group, gi) => {
              const isActive = group.platforms.includes(platform);
              return (
                <div key={group.label} style={{ borderBottom: gi < groups.length - 1 ? '1px solid rgba(240,230,210,0.05)' : 'none', opacity: isActive ? 1 : 0.48, transition: 'opacity 0.2s ease' }}>
                  <div style={{ padding: '8px 14px 4px' }}>
                    <span style={{ fontFamily: 'var(--g-mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: isActive ? 'rgba(228,139,109,0.82)' : 'rgba(240,230,210,0.26)' }}>
                      {group.label}
                    </span>
                  </div>
                  {[
                    { key: 'seen' as const, label: 'Hide Seen' },
                    { key: 'typing' as const, label: 'Hide Typing' },
                    { key: 'story' as const, label: 'Hide Story Views' },
                  ].map((item) => (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 14px' }}>
                      <span style={{ fontFamily: 'var(--g-sans)', fontSize: 11.5, color: 'rgba(240,230,210,0.7)' }}>{item.label}</span>
                      <PopupToggle
                        on={group.controls[item.key]}
                        cursorTarget={group.label === 'Messenger / Facebook' && item.key === 'seen' ? 'mfSeenToggle' : undefined}
                      />
                    </div>
                  ))}
                  <div style={{ height: 6 }} />
                </div>
              );
            })}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ── Messenger chat data ──────────────────────────────── */
const CHATS = [
  { id: 'sofia',  name: 'Sofia 💕',   preview: 'ok fine whatever 🙄',              time: '9:41', color: '#FF6D00', unreadCount: 3 },
  { id: 'jamie',  name: 'Jamie',      preview: 'ok but we need to talk 👀',         time: '9:22', color: '#7C4DFF' },
  { id: 'alex',   name: 'Alex Chen',  preview: 'did you see what just happened',    time: 'Mon',  color: '#0082FB' },
  { id: 'priya',  name: 'Priya K.',   preview: 'ok send me everything',             time: 'Sun',  color: '#00BFA5' },
];

const THREADS: Record<string, { them: boolean; text: string }[]> = {
  sofia: [
    { them: false, text: 'lol yeah I know right 😂' },
    { them: true,  text: 'hey are you ignoring me' },
    { them: true,  text: 'I know you\'re online' },
    { them: true,  text: 'ok fine whatever 🙄' },
  ],
  jamie: [
    { them: true,  text: 'stop you\'re so bad 😭' },
    { them: false, text: 'haha okay okay' },
    { them: true,  text: 'last night was actually so fun' },
    { them: false, text: 'tell me about it 😏' },
    { them: true,  text: 'ok but we need to talk 👀' },
  ],
  alex: [
    { them: true,  text: 'bro what are you doing tonight' },
    { them: false, text: 'nothing why' },
    { them: true,  text: 'did you see what just happened' },
  ],
  priya: [
    { them: true,  text: 'the drama today omg 💀' },
    { them: false, text: 'RIGHT' },
    { them: true,  text: 'ok send me everything' },
  ],
};

function MessengerView({
  activeChatId, typingText, unreadBadges, composerFocused,
}: {
  activeChatId: string;
  typingText: string;
  unreadBadges: UnreadBadges;
  composerFocused: boolean;
}) {
  const activeChat = CHATS.find((c) => c.id === activeChatId) ?? CHATS[0];
  const messages = THREADS[activeChatId] ?? THREADS.alex;

  return (
    <div style={{ height: '100%', display: 'flex', background: '#18202E', overflow: 'hidden' }}>
      {/* Chat list */}
      <div className="hero-chat-list hero-chat-list-messenger" style={{ width: 196, borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px 8px', fontFamily: 'var(--g-sans)', fontSize: 17, fontWeight: 700, color: 'white' }}>Chats</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 6px', overflow: 'hidden' }}>
          {CHATS.map((chat) => {
            const hasBadge = chat.unreadCount && (chat.id === 'sofia' ? unreadBadges.sofia : false);
            return (
              <div
                key={chat.id}
                data-cursor-target={chat.id === 'sofia' ? 'sofiaChat' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 8,
                  background: chat.id === activeChatId ? 'rgba(0,130,251,0.15)' : 'transparent',
                  flexShrink: 0,
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 33, height: 33, borderRadius: 17, background: chat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'white', fontFamily: 'var(--g-sans)' }}>
                    {chat.name[0]}
                  </div>
                  {chat.id === activeChatId && (
                    <div style={{ position: 'absolute', bottom: 1, right: 1, width: 8, height: 8, borderRadius: 4, background: '#44b244', border: '1.5px solid #18202E' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--g-sans)', fontSize: 12.5, fontWeight: hasBadge ? 700 : (chat.id === activeChatId ? 600 : 400), color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {chat.name}
                  </div>
                  <div style={{ fontFamily: 'var(--g-sans)', fontSize: 11, color: hasBadge ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {chat.preview}
                  </div>
                </div>
                {hasBadge && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: 9.5, color: '#0082FB', fontFamily: 'var(--g-sans)' }}>{chat.time}</span>
                    <div style={{ width: 17, height: 17, borderRadius: 9, background: '#0082FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, color: 'white', fontFamily: 'var(--g-sans)' }}>
                      {chat.unreadCount}
                    </div>
                  </div>
                )}
                {!hasBadge && (
                  <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--g-sans)', flexShrink: 0 }}>{chat.time}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Thread */}
      <div className="hero-thread" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: activeChat.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'white', fontFamily: 'var(--g-sans)' }}>
            {activeChat.name[0]}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--g-sans)', fontSize: 13, fontWeight: 600, color: 'white' }}>{activeChat.name}</div>
            <div style={{ fontFamily: 'var(--g-sans)', fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>Active now</div>
          </div>
        </div>

        <div data-cursor-target="chatArea" style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7, overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeChatId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.them ? 'flex-start' : 'flex-end' }}>
                  <div style={{ maxWidth: '72%', padding: '7px 11px', borderRadius: msg.them ? '4px 16px 16px 16px' : '16px 4px 16px 16px', background: msg.them ? 'rgba(239,226,208,0.09)' : '#0082FB', fontFamily: 'var(--g-sans)', fontSize: 12.5, color: 'white', lineHeight: 1.4 }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Composer */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div data-cursor-target="composer" style={{ height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.07)', padding: '0 13px', fontFamily: 'var(--g-sans)', fontSize: 12.5, color: typingText ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center' }}>
            {typingText || (composerFocused ? '' : 'Aa')}
            {(typingText || composerFocused) && <span style={{ display: 'inline-block', width: 1, height: 14, background: '#0082FB', marginLeft: typingText ? 1 : 0, animation: 'ghostBlink 1s ease-in-out infinite', verticalAlign: 'middle' }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Instagram DM threads for hero ─────────────────────── */
const HERO_IG_THREADS: Record<string, { them: boolean; text: string }[]> = {
  'cami.v':   [
    { them: true,  text: 'ok ok ok' },
    { them: true,  text: 'watch her story RIGHT NOW' },
    { them: false, text: 'omg' },
    { them: true,  text: 'RIGHT??' },
    { them: false, text: 'I\'m watching' },
  ],
  'h.nakano': [
    { them: false, text: 'did you see what happened' },
    { them: true,  text: 'WAIT' },
    { them: true,  text: 'no way are you serious' },
    { them: true,  text: 'wait did you see that??' },
  ],
  'marco_p':  [
    { them: true,  text: 'ok I sent it' },
    { them: false, text: 'checking now' },
    { them: true,  text: 'lmk what you think' },
  ],
  'sol.r':    [
    { them: true,  text: 'omg no way' },
    { them: false, text: 'I know right' },
  ],
};

/* ── Instagram view ───────────────────────────────────── */
function InstagramView({ showStory, igUnreadBadge, activeIgDm }: { showStory: boolean; igUnreadBadge: boolean; activeIgDm: string }) {
  const stories = [
    { name: 'cami.v',   color: '#E1306C' },
    { name: 'marco_p',  color: '#FF6D00' },
    { name: 'h.nakano', color: '#7C4DFF' },
    { name: 'sol.r',    color: '#00BFA5' },
  ];
  const dms = [
    { name: 'cami.v',   msg: 'You: I\'m watching',      color: '#E1306C', unreadCount: 0 },
    { name: 'marco_p',  msg: 'ok I sent it',             color: '#FF6D00', unreadCount: 0 },
    { name: 'h.nakano', msg: 'wait did you see that??',  color: '#7C4DFF', unreadCount: 2 },
    { name: 'sol.r',    msg: 'omg no way',               color: '#00BFA5', unreadCount: 0 },
  ];
  const activeDm = dms.find(d => d.name === activeIgDm) ?? dms[0];
  const thread = HERO_IG_THREADS[activeIgDm] ?? HERO_IG_THREADS['cami.v'];

  return (
    <div style={{ height: '100%', display: 'flex', background: '#000', overflow: 'hidden', position: 'relative' }}>
      <AnimatePresence>
        {showStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{ position: 'absolute', inset: 0, background: 'linear-gradient(170deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: 3 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.3)', borderRadius: 1, overflow: 'hidden' }}>
                  {i === 1 && <motion.div initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 5, ease: 'linear' }} style={{ height: '100%', background: 'white', borderRadius: 1 }} />}
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', top: 22, left: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 26, height: 26, borderRadius: 13, background: 'rgba(255,255,255,0.25)', border: '1.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', fontFamily: 'var(--g-sans)' }}>C</div>
              <div>
                <div style={{ fontFamily: 'var(--g-sans)', fontSize: 11.5, fontWeight: 600, color: 'white' }}>cami.v</div>
                <div style={{ fontFamily: 'var(--g-sans)', fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>5m ago</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '0 20px' }}>
              <div style={{ fontFamily: 'var(--g-display)', fontSize: 28, fontStyle: 'italic', color: 'white', fontWeight: 300, lineHeight: 1.2 }}>golden hour</div>
              <div style={{ fontFamily: 'var(--g-sans)', fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>kyoto → everywhere</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left panel: story row + DM list */}
      <div className="hero-chat-list hero-chat-list-instagram" style={{ width: 210, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
        {/* Story circles */}
        <div style={{ padding: '8px 8px 6px', display: 'flex', gap: 6, flexShrink: 0 }}>
          {stories.map((s, i) => (
            <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div data-cursor-target={i === 0 ? 'storyBubble' : undefined} style={{ width: 36, height: 36, borderRadius: 18, padding: s.active ? 2 : 0, background: s.active ? 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #bc1888)' : 'rgba(255,255,255,0.06)' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: 16, background: s.color, border: s.active ? '1.5px solid #000' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'white', fontFamily: 'var(--g-sans)' }}>
                  {s.name[0].toUpperCase()}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--g-sans)', fontSize: 8.5, color: 'rgba(255,255,255,0.38)' }}>{s.name.split('.')[0]}</div>
            </div>
          ))}
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 8px 4px', flexShrink: 0 }} />
        {/* DM list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 5px', overflow: 'hidden' }}>
          {dms.map((dm) => {
            const showBadge = dm.unreadCount > 0 && dm.name === 'h.nakano' && igUnreadBadge;
            return (
              <div key={dm.name} data-cursor-target={dm.name === 'h.nakano' ? 'igUnreadDM' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 6px', borderRadius: 8, background: dm.name === activeIgDm ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
                <div style={{ width: 33, height: 33, borderRadius: 17, background: dm.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'white', fontFamily: 'var(--g-sans)' }}>
                  {dm.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--g-sans)', fontSize: 12.5, fontWeight: (dm.active || showBadge) ? 600 : 400, color: 'rgba(255,255,255,0.88)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dm.name}</div>
                  <div style={{ fontFamily: 'var(--g-sans)', fontSize: 11, color: showBadge ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.32)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dm.msg}</div>
                </div>
                {showBadge && (
                  <div style={{ width: 17, height: 17, borderRadius: 9, background: '#E1306C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, color: 'white', fontFamily: 'var(--g-sans)', flexShrink: 0 }}>
                    {dm.unreadCount}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active thread */}
      <div className="hero-thread" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 13px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: activeDm.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'white', fontFamily: 'var(--g-sans)' }}>{activeDm.name[0].toUpperCase()}</div>
          <div>
            <div style={{ fontFamily: 'var(--g-sans)', fontSize: 13, fontWeight: 600, color: 'white' }}>{activeDm.name}</div>
            <div style={{ fontFamily: 'var(--g-sans)', fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>Active now</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7, overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeIgDm} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {thread.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.them ? 'flex-start' : 'flex-end' }}>
                  <div style={{ maxWidth: '72%', padding: '7px 11px', borderRadius: msg.them ? '4px 16px 16px 16px' : '16px 4px 16px 16px', background: msg.them ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #833ab4, #fd1d1d)', fontFamily: 'var(--g-sans)', fontSize: 12.5, color: 'white', lineHeight: 1.4 }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
        <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div style={{ height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.07)', padding: '0 13px', fontFamily: 'var(--g-sans)', fontSize: 12.5, color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center' }}>Message...</div>
        </div>
      </div>
    </div>
  );
}

/* ── Facebook view ────────────────────────────────────── */
const FB_CHATS = [
  { id: 'ryan',   name: 'Ryan M.',       preview: 'you need to see this',         time: '3:44', color: '#1877F2', unreadCount: 2 },
  { id: 'claire', name: 'Claire B.',     preview: 'okay but that was funny',      time: '2:11', color: '#9C5CF5' },
  { id: 'group',  name: 'Friend group',  preview: 'nobody asked lmao',            time: '1:30', color: '#E9376C' },
];

const FB_THREADS: Record<string, { them: boolean; text: string }[]> = {
  ryan: [
    { them: false, text: 'what happened at the party' },
    { them: true,  text: 'ok so' },
    { them: true,  text: 'you need to see this' },
  ],
  claire: [
    { them: true,  text: 'did you tell anyone yet' },
    { them: false, text: 'obviously not' },
    { them: true,  text: 'okay but that was funny' },
  ],
  group: [
    { them: true,  text: 'someone show up late again' },
    { them: false, text: 'it was NOT me this time' },
    { them: true,  text: 'nobody asked lmao' },
  ],
};

function FacebookView({ activeChatId, fbUnreadBadge }: { activeChatId: string; fbUnreadBadge: boolean }) {
  const activeChat = FB_CHATS.find(c => c.id === activeChatId) ?? FB_CHATS[1];
  const messages = FB_THREADS[activeChatId] ?? FB_THREADS.claire;

  return (
    <div style={{ height: '100%', display: 'flex', background: '#18191A', overflow: 'hidden' }}>
      {/* Chat list */}
      <div className="hero-chat-list hero-chat-list-facebook" style={{ width: 196, borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px 8px', fontFamily: 'var(--g-sans)', fontSize: 16, fontWeight: 700, color: 'white' }}>Chats</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 6px', overflow: 'hidden' }}>
          {FB_CHATS.map((chat) => {
            const showBadge = chat.unreadCount && chat.id === 'ryan' && fbUnreadBadge;
            return (
              <div key={chat.id} data-cursor-target={chat.id === 'ryan' ? 'fbUnreadDM' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 8, background: chat.id === activeChatId ? 'rgba(24,119,242,0.14)' : 'transparent', flexShrink: 0 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 33, height: 33, borderRadius: 17, background: chat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'white', fontFamily: 'var(--g-sans)' }}>
                    {chat.name[0]}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--g-sans)', fontSize: 12.5, fontWeight: showBadge ? 700 : (chat.id === activeChatId ? 600 : 400), color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {chat.name}
                  </div>
                  <div style={{ fontFamily: 'var(--g-sans)', fontSize: 11, color: showBadge ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {chat.preview}
                  </div>
                </div>
                {showBadge ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: 9.5, color: '#1877F2', fontFamily: 'var(--g-sans)' }}>{chat.time}</span>
                    <div style={{ width: 17, height: 17, borderRadius: 9, background: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, color: 'white', fontFamily: 'var(--g-sans)' }}>
                      {chat.unreadCount}
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--g-sans)', flexShrink: 0 }}>{chat.time}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Thread */}
      <div className="hero-thread" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: activeChat.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'white', fontFamily: 'var(--g-sans)' }}>
            {activeChat.name[0]}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--g-sans)', fontSize: 13, fontWeight: 600, color: 'white' }}>{activeChat.name}</div>
            <div style={{ fontFamily: 'var(--g-sans)', fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>Active now</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7, overflow: 'hidden', justifyContent: 'flex-end' }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeChatId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.them ? 'flex-start' : 'flex-end' }}>
                  <div style={{ maxWidth: '72%', padding: '7px 11px', borderRadius: msg.them ? '4px 16px 16px 16px' : '16px 4px 16px 16px', background: msg.them ? 'rgba(255,255,255,0.08)' : '#1877F2', fontFamily: 'var(--g-sans)', fontSize: 12.5, color: 'white', lineHeight: 1.4 }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
        <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div style={{ height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.07)', padding: '0 13px', fontFamily: 'var(--g-sans)', fontSize: 12.5, color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center' }}>
            Aa
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Browser scene with autoplay ─────────────────────── */
function HeroBrowserScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(false);

  // Intersection observer — stops autoplay when hero scrolls out of view
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0.3 }
    );
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const [popupOpen, setPopupOpen]         = useState(false);
  const [msControls, setMsControls]       = useState<MsgControls>({ seen: true, typing: true, story: true });
  const [igControls]                      = useState<MsgControls>({ seen: true, typing: true, story: true });
  const [activePlatform, setActivePlat]   = useState<HeroPlatform>('messenger');
  const [activeChatId, setActiveChatId]   = useState('jamie');
  const [fbActiveChatId, setFbActiveChatId] = useState('claire');
  const [activeIgDm, setActiveIgDm]       = useState('cami.v');
  const [typingText, setTypingText]       = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [showStory, setShowStory]         = useState(false);
  const [cursorPos, setCursorPos]         = useState(P.rest);
  const [clickKey, setClickKey]           = useState(0);
  const [unreadBadges, setUnreadBadges]   = useState<UnreadBadges>({ sofia: true });
  const [igUnreadBadge, setIgUnreadBadge] = useState(true);
  const [fbUnreadBadge, setFbUnreadBadge] = useState(true);

  const typingTimer = useRef<ReturnType<typeof setInterval>>();
  const [cursorTarget, setCursorTarget] = useState<CursorTarget>('rest');

  const resolveCursorTarget = useCallback((target: CursorTarget) => {
    const fallback = P[target];
    const root = containerRef.current;
    const el = root?.querySelector<HTMLElement>(`[data-cursor-target="${target}"]`);
    if (!root || !el) return fallback;

    const rootRect = root.getBoundingClientRect();
    const targetRect = el.getBoundingClientRect();
    if (!rootRect.width || !rootRect.height || !targetRect.width || !targetRect.height) return fallback;

    const anchor = CURSOR_ANCHORS[target] ?? { x: 0.5, y: 0.5 };
    const x = ((targetRect.left - rootRect.left + targetRect.width * anchor.x) / rootRect.width) * 100;
    const y = ((targetRect.top - rootRect.top + targetRect.height * anchor.y) / rootRect.height) * 100;

    return {
      x: Math.max(0.75, Math.min(99.25, x)),
      y: Math.max(0.75, Math.min(99.25, y)),
    };
  }, []);

  const moveCursor = useCallback((target: CursorTarget) => {
    setCursorTarget(target);
    setCursorPos(resolveCursorTarget(target));
    requestAnimationFrame(() => setCursorPos(resolveCursorTarget(target)));
    window.setTimeout(() => setCursorPos(resolveCursorTarget(target)), 80);
  }, [resolveCursorTarget]);

  useEffect(() => {
    const syncCursorToLayout = () => setCursorPos(resolveCursorTarget(cursorTarget));
    window.addEventListener('resize', syncCursorToLayout);
    return () => window.removeEventListener('resize', syncCursorToLayout);
  }, [cursorTarget, resolveCursorTarget]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setCursorPos(resolveCursorTarget(cursorTarget)));
    const timer = window.setTimeout(() => setCursorPos(resolveCursorTarget(cursorTarget)), 90);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [activeChatId, activeIgDm, activePlatform, composerFocused, cursorTarget, fbActiveChatId, popupOpen, resolveCursorTarget]);

  // Autoplay loop — restarts when heroVisible changes to true
  useEffect(() => {
    if (!heroVisible) {
      setPopupOpen(false);
      setTypingText('');
      setComposerFocused(false);
      setShowStory(false);
      clearInterval(typingTimer.current);
      dispatchMascot('typing-stop');
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const t = (ms: number, fn: () => void) => { timers.push(setTimeout(fn, ms)); };

    const TYPING_TEXT = 'babe I was literally just about to text you';

    const startTyping = (text: string, speed = 90) => {
      clearInterval(typingTimer.current);
      setTypingText('');
      dispatchMascot('typing-start');
      let i = 0;
      typingTimer.current = setInterval(() => {
        i++;
        setTypingText(text.slice(0, i));
        dispatchMascot('typing-active');
        if (i >= text.length) clearInterval(typingTimer.current);
      }, speed);
    };

    const startDeleting = (speed = 55) => {
      clearInterval(typingTimer.current);
      dispatchMascot('typing-active');
      typingTimer.current = setInterval(() => {
        setTypingText(prev => {
          dispatchMascot('typing-active');
          if (prev.length <= 1) {
            clearInterval(typingTimer.current);
            dispatchMascot('typing-stop');
            return '';
          }
          return prev.slice(0, -1);
        });
      }, speed);
    };

    // Typing duration: 45 chars * 90ms = 4050ms
    // Deleting duration: 45 chars * 55ms = 2475ms
    const TYPING_MS  = TYPING_TEXT.length * 90;
    const DELETING_MS = TYPING_TEXT.length * 55;
    const TYPING_START_AT = 10700;
    const COMPOSER_FOCUS_AT = TYPING_START_AT - 400;

    function loop() {
      /* ── Full reset ─────────────────────────────────── */
      setPopupOpen(false);
      setActivePlat('messenger');
      setActiveChatId('jamie');
      setFbActiveChatId('claire');
      setActiveIgDm('cami.v');
      setTypingText('');
      setComposerFocused(false);
      setShowStory(false);
      moveCursor('rest');
      setMsControls({ seen: true, typing: true, story: true });
      setUnreadBadges({ sofia: true });
      setIgUnreadBadge(true);
      setFbUnreadBadge(true);
      dispatchMascot('typing-stop');

      /* ── Beat 1: Open Ghostify popup ─────────────── */
      // Start on Jamie's chat (the fling), cursor moves to extension icon
      t(1200, () => moveCursor('extIcon'));
      t(2500, () => { setPopupOpen(true); setClickKey(k => k + 1); });
      // popup open ~2s — user sees all controls are ON

      /* ── Beat 2: Close popup, open Sofia's chat ──── */
      // Sofia = GF, 3 unread. Badge stays because Ghostify holds the receipt
      // Cursor is already at extIcon — click it again to dismiss the popup
      t(4500, () => setClickKey(k => k + 1));          // click ext icon
      t(4650, () => setPopupOpen(false));              // popup closes
      t(5100, () => moveCursor('chatArea'));           // cursor drifts into chat area
      t(6000, () => moveCursor('sofiaChat'));
      t(6800, () => {
        setActiveChatId('sofia');
        setClickKey(k => k + 1);
        dispatchMascot('chat-open'); // "seen stayed back."
      });

      /* ── Beat 3: Type then DELETE in Sofia's composer ─ */
      t(9500, () => moveCursor('composer'));
      t(COMPOSER_FOCUS_AT, () => {
        setComposerFocused(true);
        setClickKey(k => k + 1);
      });
      t(TYPING_START_AT, () => {
        setComposerFocused(true);
        startTyping(TYPING_TEXT, 90);
      });
      // Typing finishes at ~10000 + TYPING_MS — pause before deleting
      t(TYPING_START_AT + TYPING_MS + 1000, () => startDeleting(55));
      // Deletion finishes — cursor rests, then after a beat moves to Instagram tab
      t(TYPING_START_AT + TYPING_MS + DELETING_MS + 1400, () => {
        clearInterval(typingTimer.current);
        setTypingText('');
        setComposerFocused(false);
        moveCursor('chatArea'); // rest in chat area first
        dispatchMascot('typing-stop');
      });
      t(TYPING_START_AT + TYPING_MS + DELETING_MS + 2800, () => moveCursor('igTab')); // then drift to tab

      const afterDelete = TYPING_START_AT + TYPING_MS + DELETING_MS + 3600;

      /* ── Beat 4: Instagram — click unread DM ──────── */
      t(afterDelete,        () => { setActivePlat('instagram'); setClickKey(k => k + 1); });
      t(afterDelete + 1200, () => moveCursor('igUnreadDM'));
      t(afterDelete + 1900, () => {
        setActiveIgDm('h.nakano'); // switch to the unread DM thread
        setClickKey(k => k + 1);
        dispatchMascot('chat-open'); // "seen stayed back."
      });

      /* ── Beat 4b: Instagram — watch story ──────────── */
      t(afterDelete + 4500, () => moveCursor('storyBubble'));
      t(afterDelete + 5200, () => {
        setShowStory(true);
        setClickKey(k => k + 1);
        dispatchMascot('story-view'); // "story stayed quiet."
      });
      t(afterDelete + 10200, () => setShowStory(false));

      /* ── Beat 5: Disable seen, switch to Facebook ─── */
      t(afterDelete + 11500, () => moveCursor('extIcon'));
      t(afterDelete + 12400, () => { setPopupOpen(true); setClickKey(k => k + 1); });
      t(afterDelete + 13700, () => moveCursor('mfSeenToggle')); // cursor moves inside popup
      t(afterDelete + 14800, () => { setMsControls(prev => ({ ...prev, seen: false })); setClickKey(k => k + 1); }); // click toggle
      // Close popup: cursor moves back to ext icon, clicks to close
      t(afterDelete + 16100, () => moveCursor('extIcon'));
      t(afterDelete + 17000, () => { setClickKey(k => k + 1); setPopupOpen(false); });
      // Switch to Facebook tab
      t(afterDelete + 17900, () => moveCursor('fbTab'));
      t(afterDelete + 18800, () => { setActivePlat('facebook'); setClickKey(k => k + 1); });

      /* ── Beat 6: Click FB unread — badge disappears ─ */
      // seen is now OFF — receipt gets sent normally
      t(afterDelete + 20200, () => moveCursor('fbUnreadDM'));
      t(afterDelete + 21100, () => {
        setFbActiveChatId('ryan');
        setFbUnreadBadge(false); // badge gone — receipt sent
        setClickKey(k => k + 1);
        dispatchMascot('feature-off'); // "that one went through."
      });

      /* ── Beat 7: Re-enable seen, close popup, loop ── */
      t(afterDelete + 24600, () => moveCursor('extIcon'));
      t(afterDelete + 25500, () => { setPopupOpen(true); setClickKey(k => k + 1); });
      t(afterDelete + 26800, () => moveCursor('mfSeenToggle')); // cursor moves to toggle
      t(afterDelete + 27900, () => { setMsControls(prev => ({ ...prev, seen: true })); setClickKey(k => k + 1); }); // click toggle
      // Close popup: cursor back to ext icon, click to close
      t(afterDelete + 29200, () => moveCursor('extIcon'));
      t(afterDelete + 30100, () => { setClickKey(k => k + 1); setPopupOpen(false); });
      t(afterDelete + 31000, () => moveCursor('rest')); // cursor drifts to rest

      t(afterDelete + 33000, () => {
        timers.forEach(clearTimeout);
        timers.length = 0;
        clearInterval(typingTimer.current);
        dispatchMascot('typing-stop');
        loop();
      });
    }

    const init = setTimeout(loop, 500);
    return () => {
      clearTimeout(init);
      timers.forEach(clearTimeout);
      clearInterval(typingTimer.current);
      dispatchMascot('typing-stop');
    };
  }, [heroVisible, moveCursor]);

  const tabs: { id: HeroPlatform; label: string; url: string }[] = [
    { id: 'messenger', label: 'Messenger', url: 'messenger.com' },
    { id: 'facebook',  label: 'Facebook',  url: 'facebook.com/messages' },
    { id: 'instagram', label: 'Instagram', url: 'instagram.com/direct' },
  ];

  const PLATFORM_COLORS: Record<HeroPlatform, string> = {
    messenger: '#0082FB', facebook: '#1877F2', instagram: '#E1306C',
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', width: '100%', height: '100%',
        background: 'var(--g-surface)', borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(240,230,210,0.08)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35)',
        pointerEvents: 'none', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Window chrome */}
      <div style={{ height: 36, background: 'var(--g-surface)', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: '#FF5F57' }} />
          <div style={{ width: 10, height: 10, borderRadius: 5, background: '#FEBC2E' }} />
          <div style={{ width: 10, height: 10, borderRadius: 5, background: '#28C840' }} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="hero-tabbar" style={{ background: 'var(--g-surface)', display: 'flex', alignItems: 'flex-end', padding: '0 10px', gap: 2, height: 32, borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="hero-tab"
            data-cursor-target={tab.id === 'messenger' ? 'msgTab' : tab.id === 'facebook' ? 'fbTab' : 'igTab'}
            style={{
              height: 27, padding: '0 12px', borderRadius: '6px 6px 0 0',
              background: activePlatform === tab.id ? 'var(--g-surface-2)' : 'transparent',
              fontFamily: 'var(--g-sans)', fontSize: 11,
              color: activePlatform === tab.id ? 'rgba(240,230,210,0.88)' : 'rgba(240,230,210,0.32)',
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all 0.22s ease', whiteSpace: 'nowrap',
            }}
          >
            <div style={{ width: 7, height: 7, borderRadius: 4, background: PLATFORM_COLORS[tab.id], opacity: activePlatform === tab.id ? 1 : 0.35, transition: 'opacity 0.22s ease' }} />
            {tab.label}
          </div>
        ))}
        {/* Extension icon */}
        <div className="hero-extension-tab-icon" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingBottom: 3 }}>
          <div data-cursor-target="extIcon" style={{ width: 21, height: 21, borderRadius: 5, background: popupOpen ? 'rgba(212,106,82,0.18)' : 'rgba(212,106,82,0.1)', border: `1px solid ${popupOpen ? 'rgba(212,106,82,0.42)' : 'rgba(212,106,82,0.24)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
            <GhostMark size={13} />
          </div>
        </div>
      </div>

      {/* Address bar */}
      <div className="hero-address" style={{ background: 'var(--g-surface-2)', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.055)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          <span style={{ color: 'rgba(240,230,210,0.18)', fontSize: 12, lineHeight: '18px', width: 18, textAlign: 'center' }}>‹</span>
          <span style={{ color: 'rgba(240,230,210,0.1)', fontSize: 12, lineHeight: '18px', width: 18, textAlign: 'center' }}>›</span>
        </div>
        <div style={{ flex: 1, height: 24, borderRadius: 12, background: 'rgba(240,230,210,0.05)', border: '1px solid rgba(240,230,210,0.06)', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 5 }}>
          <Globe size={9} color="rgba(240,230,210,0.25)" />
          <span style={{ fontFamily: 'var(--g-mono)', fontSize: 10, color: 'rgba(240,230,210,0.35)' }}>
            {tabs.find((t) => t.id === activePlatform)?.url}
          </span>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence mode="wait">
          <motion.div key={activePlatform} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} style={{ height: '100%' }}>
            {activePlatform === 'messenger' && (
              <MessengerView activeChatId={activeChatId} typingText={typingText} unreadBadges={unreadBadges} composerFocused={composerFocused} />
            )}
            {activePlatform === 'instagram' && (
              <InstagramView showStory={showStory} igUnreadBadge={igUnreadBadge} activeIgDm={activeIgDm} />
            )}
            {activePlatform === 'facebook' && (
              <FacebookView activeChatId={fbActiveChatId} fbUnreadBadge={fbUnreadBadge} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Ghostify popup — positioned at browser container level, just below the tab bar (36px chrome + 32px tabs = 68px) */}
      <GhostifyHeroPopup
        open={popupOpen}
        platform={activePlatform}
        msControls={msControls}
        igControls={igControls}
      />

      {/* Cursor */}
      <DemoCursor x={cursorPos.x} y={cursorPos.y} clickKey={clickKey} target={cursorTarget} />
    </div>
  );
}

/* ── Hero section ─────────────────────────────────────── */
const heroSignalRows = [
  { word: 'seen', output: 'seen-receipt blocked' },
  { word: 'typing', output: 'typing' },
  { word: 'story-view', output: 'story-view blocked' },
] as const;
type HeroSignalWord = (typeof heroSignalRows)[number]['word'];
type HeroSignalOutput = (typeof heroSignalRows)[number]['output'];
type SignalDirection = 'input' | 'output';

const routeKeys: Record<HeroSignalWord, string> = {
  seen: 'seen',
  typing: 'typing',
  'story-view': 'story',
};

const signalMotionConfig = {
  seen: { inputCount: 9, outputCount: 4, inputDuration: 18, outputDuration: 20, phase: 0 },
  typing: { inputCount: 10, outputCount: 10, inputDuration: 16, outputDuration: 16, phase: 0.35 },
  'story-view': { inputCount: 7, outputCount: 4, inputDuration: 19, outputDuration: 20, phase: 0.7 },
} satisfies Record<HeroSignalWord, {
  inputCount: number;
  outputCount: number;
  inputDuration: number;
  outputDuration: number;
  phase: number;
}>;

function TypingLetters({ crossed = false }: { crossed?: boolean }) {
  return (
    <>
      {'typing'.split('').map((letter, letterIndex) => (
        <tspan
          className={crossed ? 'hpv-type-crossed' : undefined}
          key={`${letter}-${letterIndex}`}
        >
          {!crossed && (
            <animate
              attributeName="baseline-shift"
              values="0;0.08em;0;0"
              dur="1.24s"
              begin={`${(letterIndex * 0.08).toFixed(2)}s`}
              repeatCount="indefinite"
            />
          )}
          {letter}
        </tspan>
      ))}
    </>
  );
}

function MotionSignalToken({
  row,
  direction,
  index,
}: {
  row: (typeof heroSignalRows)[number];
  direction: SignalDirection;
  index: number;
}) {
  const routeKey = routeKeys[row.word];
  const routeId = direction === 'input' ? `hpv-route-${routeKey}` : `hpv-out-${routeKey}`;
  const label = direction === 'input' ? row.word : row.output;
  const config = signalMotionConfig[row.word];
  const count = direction === 'input' ? config.inputCount : config.outputCount;
  const duration = direction === 'input' ? config.inputDuration : config.outputDuration;
  const begin = -((duration / count) * index + config.phase);
  const className = [
    'hpv-path-text',
    `hpv-${direction}-text`,
    `hpv-${direction}-${row.word.replace(/[^a-z0-9]/g, '-')}`,
  ].join(' ');

  return (
    <text className={className} textAnchor={direction === 'output' ? 'end' : 'middle'}>
      <animateMotion
        dur={`${duration}s`}
        begin={`${begin.toFixed(2)}s`}
        repeatCount="indefinite"
        rotate="auto"
      >
        <mpath href={`#${routeId}`} />
      </animateMotion>
      {row.word === 'typing' ? (
        <TypingLetters crossed={direction === 'output'} />
      ) : (
        label
      )}
    </text>
  );
}

function MotionSignalStream({ row, direction }: { row: (typeof heroSignalRows)[number]; direction: SignalDirection }) {
  const config = signalMotionConfig[row.word];
  const count = direction === 'input' ? config.inputCount : config.outputCount;

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <MotionSignalToken
          key={`${direction}-${row.word}-${index}`}
          row={row}
          direction={direction}
          index={index}
        />
      ))}
    </>
  );
}

function PrivacySignalConsole() {
  return (
    <div className="hpv-scene">
      <svg className="hpv-routes" viewBox="0 0 1600 360" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hpvLineSeen" x1="-220" y1="92" x2="820" y2="180" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F0EBE0" stopOpacity="0" />
            <stop offset="0.12" stopColor="#F0EBE0" stopOpacity="0.2" />
            <stop offset="0.76" stopColor="#F0EBE0" stopOpacity="0.46" />
            <stop offset="1" stopColor="#F0EBE0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hpvLineTyping" x1="-220" y1="180" x2="820" y2="180" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D46A52" stopOpacity="0" />
            <stop offset="0.12" stopColor="#D46A52" stopOpacity="0.2" />
            <stop offset="0.76" stopColor="#D46A52" stopOpacity="0.46" />
            <stop offset="1" stopColor="#F0EBE0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hpvLineStory" x1="-220" y1="270" x2="820" y2="190" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D46A52" stopOpacity="0" />
            <stop offset="0.12" stopColor="#D46A52" stopOpacity="0.2" />
            <stop offset="0.74" stopColor="#D46A52" stopOpacity="0.43" />
            <stop offset="1" stopColor="#F0EBE0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hpvFlowFade" x1="-220" y1="0" x2="900" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="black" stopOpacity="0" />
            <stop offset="0.08" stopColor="white" stopOpacity="1" />
            <stop offset="0.9" stopColor="white" stopOpacity="1" />
            <stop offset="1" stopColor="black" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="hpvCoreHalo" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(790 160) rotate(90) scale(124)">
            <stop stopColor="#F0EBE0" stopOpacity="0.06" />
            <stop offset="0.4" stopColor="#D46A52" stopOpacity="0.035" />
            <stop offset="1" stopColor="#0B0A08" stopOpacity="0" />
          </radialGradient>
          <mask id="hpvFlowMask" maskUnits="userSpaceOnUse" x="-240" y="0" width="1160" height="360">
            <rect x="-240" y="0" width="1160" height="360" fill="url(#hpvFlowFade)" />
          </mask>
          <clipPath id="hpvOutputClip" clipPathUnits="userSpaceOnUse">
            <rect x="806" y="0" width="980" height="360" />
          </clipPath>
        </defs>

        <path id="hpv-route-seen" d="M-260 86C114 86 398 102 600 128C682 139 742 142 810 132" />
        <path id="hpv-route-typing" d="M-260 160C114 160 398 160 602 160C690 160 748 160 812 160" />
        <path id="hpv-route-story" d="M-260 244C116 244 400 226 604 198C684 187 742 184 810 196" />
        <path id="hpv-out-seen" d="M806 132C996 102 1302 78 1740 70" />
        <path id="hpv-out-typing" d="M812 160C1010 160 1304 160 1740 160" />
        <path id="hpv-out-story" d="M806 196C998 228 1302 260 1740 286" />

        <g className="hpv-flow-field" mask="url(#hpvFlowMask)">
          <path className="hpv-lane hpv-lane-a" d="M-260 86C114 86 398 102 600 128C682 139 742 142 810 132" />
          <path className="hpv-lane hpv-lane-b" d="M-260 160C114 160 398 160 602 160C690 160 748 160 812 160" />
          <path className="hpv-lane hpv-lane-c" d="M-260 244C116 244 400 226 604 198C684 187 742 184 810 196" />

          <g className="hpv-input-signals" aria-hidden="true">
            {heroSignalRows.map((row) => (
              <MotionSignalStream key={`input-${row.word}`} row={row} direction="input" />
            ))}
          </g>
        </g>

        <g className="hpv-output-signals" clipPath="url(#hpvOutputClip)" aria-hidden="true">
          {heroSignalRows.map((row) => (
            <MotionSignalStream key={`output-${row.word}`} row={row} direction="output" />
          ))}
        </g>

        <g className="hpv-core-burst" aria-hidden="true">
          <circle cx="790" cy="160" r="124" fill="url(#hpvCoreHalo)" />
          <path d="M612 126C680 136 734 138 806 132C730 152 678 154 612 160" />
          <path d="M617 160C686 160 738 160 812 160" />
          <path d="M612 198C680 188 734 190 806 196C730 172 678 170 612 160" />
          {Array.from({ length: 18 }, (_, index) => {
            const x = 618 + (index % 6) * 30;
            const y = 116 + Math.floor(index / 6) * 42 + (index % 2) * 8;
            return <circle key={index} cx={x} cy={y} r={index % 3 === 0 ? 2 : 1.35} />;
          })}
        </g>

        <g className="hpv-output-lines" aria-hidden="true">
          <path d="M806 132C996 102 1302 78 1740 70" />
          <path d="M812 160C1010 160 1304 160 1740 160" />
          <path d="M806 196C998 228 1302 260 1740 286" />
        </g>
      </svg>

      <div className="hpv-core" aria-hidden="true">
        <GhostSVG size={232} className="hpv-core-ghost" eyeColor="#11131D" bodyColor="#F4F0EA" />
      </div>
    </div>
  );
}

export function HeroSection() {
  const proofItems = [
    { title: 'Messenger', kind: 'messenger' as const },
    { title: 'Instagram', kind: 'instagram' as const },
    { title: 'Facebook', kind: 'facebook' as const },
    { title: 'Local-only', kind: 'local' as const },
    { title: 'Open source', kind: 'source' as const },
  ];

  return (
    <section
      id="hero"
      className="snap-start hero-section"
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: 60,
        background: 'var(--g-bg)',
      }}
    >
      <div aria-hidden className="hero-backdrop" />
      <div aria-hidden className="hero-texture" />
      <div aria-hidden className="hero-vignette" />

      <div
        className="hero-grid"
        style={{
          width: '100%',
          maxWidth: 1560,
          margin: '0 auto',
          padding: 'clamp(28px, 5vw, 56px) clamp(24px, 5vw, 96px) clamp(8px, 1.4vw, 20px)',
          display: 'grid',
          gridTemplateRows: 'auto auto',
          gap: 'clamp(12px, 1.8vw, 20px)',
          alignItems: 'start',
          alignContent: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 920, justifySelf: 'center', textAlign: 'center' }}
        >
          <h1 className="hero-title">
            No <span>seen.</span> No pressure.
          </h1>

          <p className="hero-subcopy">
            Ghostify hides seen receipts, typing indicators, and story-view signals on Messenger, Instagram, and Facebook, locally in your browser.
          </p>

          <div className="hero-action-row">
            <a
              href="https://chromewebstore.google.com/detail/ghostify-hide-seen-typing/flpnibonbhdmnpgflnbemgghghhblmpm?utm_source=item-share-cb"
              target="_blank"
              rel="noopener noreferrer"
              className="hero-primary-cta"
            >
              <Chrome size={14} />
              Get Ghostify
            </a>
            <a
              href="/status"
              className="hero-secondary-cta"
            >
              <Activity size={15} strokeWidth={1.7} />
              View status
            </a>
          </div>

          <div className="hero-proof-row">
            {proofItems.map((item) => (
              <div key={item.title} className="hero-proof-item">
                <div className="hero-proof-icon">
                  <HeroProofIcon kind={item.kind} label={item.title} />
                </div>
                <div className="hero-proof-title">{item.title}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="hero-privacy-visual"
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden
        >
          <PrivacySignalConsole />
        </motion.div>
      </div>

      <style>{`
        .hero-backdrop {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(ellipse at 50% 26%, rgba(239,226,208,0.055), transparent 34%),
            radial-gradient(ellipse at 18% 82%, rgba(212,106,82,0.055), transparent 31%),
            radial-gradient(ellipse at 74% 82%, rgba(217,166,109,0.055), transparent 34%),
            linear-gradient(180deg, rgba(11,10,8,0.98) 0%, var(--g-bg) 62%, var(--g-bg) 100%);
        }
        .hero-section::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: clamp(72px, 10vh, 128px);
          z-index: 0;
          pointer-events: none;
          opacity: 0.82;
          background: linear-gradient(180deg, rgba(var(--g-bg-rgb),0) 0%, rgba(var(--g-bg-rgb),0.72) 68%, var(--g-bg) 100%);
        }
        .hero-texture {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0.24;
          background-image:
            repeating-linear-gradient(0deg, rgba(240,235,224,0.024) 0 1px, transparent 1px 5px),
            repeating-linear-gradient(90deg, rgba(240,235,224,0.014) 0 1px, transparent 1px 4px);
          mix-blend-mode: soft-light;
        }
        .hero-vignette {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(0,0,0,0.44), transparent 24%, transparent 78%, rgba(0,0,0,0.2) 100%),
            radial-gradient(ellipse at center, transparent 44%, rgba(0,0,0,0.56) 100%);
        }
        .hero-title {
          font-family: var(--g-display);
          font-size: clamp(3.25rem, 5.8vw, 6.15rem);
          font-weight: 400;
          line-height: 0.92;
          letter-spacing: 0;
          color: var(--g-white);
          margin: 0 0 20px;
          text-wrap: nowrap;
          white-space: nowrap;
        }
        .hero-title span {
          color: #D46A52;
          font-style: italic;
          font-weight: 400;
          text-shadow: 0 0 32px rgba(212,106,82,0.16);
        }
        .hero-subcopy {
          width: min(100%, 760px);
          max-width: 740px;
          margin: 0 auto 22px;
          color: rgba(240,235,224,0.76);
          font-family: var(--g-sans);
          font-size: 1.08rem;
          line-height: 1.5;
        }
        .hero-action-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }
        .hero-primary-cta,
        .hero-secondary-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.44rem;
          min-height: 2.3rem;
          min-width: 9.35rem;
          padding: 0 0.92rem;
          border-radius: 6px;
          font-family: var(--g-sans);
          font-size: 0.82rem;
          font-weight: 600;
          text-decoration: none;
          letter-spacing: 0;
          box-sizing: border-box;
          transition: transform 0.16s ease, border-color 0.18s ease, background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }
        .hero-primary-cta {
          background: linear-gradient(135deg, #F1DFCA, #D46A52 118%);
          color: #0B0A08;
          box-shadow: 0 18px 46px rgba(212,106,82,0.16);
        }
        .hero-secondary-cta {
          color: rgba(240,235,224,0.9);
          border: 1px solid rgba(240,235,224,0.22);
          background: rgba(240,235,224,0.025);
        }
        .hero-primary-cta:hover,
        .hero-secondary-cta:hover {
          transform: translateY(-1px);
        }
        .hero-primary-cta:hover {
          box-shadow: 0 20px 54px rgba(212,106,82,0.22);
        }
        .hero-secondary-cta:hover {
          border-color: rgba(240,235,224,0.38);
          color: var(--g-white);
          background: rgba(240,235,224,0.045);
        }
        .hero-proof-row {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 0.44rem;
          max-width: min(100%, 660px);
          margin: 0 auto;
        }
        .hero-proof-item {
          min-height: 1.82rem;
          display: inline-flex;
          align-items: center;
          gap: 0.42rem;
          padding: 0 0.58rem;
          border: 1px solid rgba(240,235,224,0.12);
          border-radius: 6px;
          background: rgba(20,18,16,0.42);
          box-shadow: inset 0 1px 0 rgba(240,235,224,0.035);
        }
        .hero-proof-icon {
          width: 1.02rem;
          height: 1.02rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(212,106,82,0.1);
          color: #E48B6D;
          border: 1px solid rgba(212,106,82,0.18);
          flex: 0 0 auto;
        }
        .hero-proof-title {
          font-family: var(--g-sans);
          font-size: 0.72rem;
          line-height: 1;
          color: rgba(240,235,224,0.9);
          white-space: nowrap;
        }
        .hero-privacy-visual {
          position: relative;
          width: 100vw;
          height: clamp(236px, 21vw, 300px);
          min-height: 0;
          margin-top: clamp(88px, 8.2vw, 132px);
          margin-left: calc(50% - 50vw);
          align-self: start;
          pointer-events: none;
          z-index: 1;
        }
        .hpv-scene {
          position: absolute;
          inset: 0;
          overflow: visible;
          pointer-events: none;
          isolation: isolate;
        }
        .hpv-routes {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
          transform: none;
          transform-origin: 50% 52%;
          z-index: 2;
        }
        .hpv-flow-field {
          opacity: 0.96;
        }
        .hpv-lane {
          fill: none;
          stroke-width: 1.2;
          stroke-linecap: round;
          opacity: 0.72;
        }
        .hpv-lane-a { stroke: url(#hpvLineSeen); }
        .hpv-lane-b { stroke: url(#hpvLineTyping); stroke-width: 1.35; }
        .hpv-lane-c { stroke: url(#hpvLineStory); }
        .hpv-input-signals,
        .hpv-output-signals {
          pointer-events: none;
        }
        .hpv-path-text {
          font-family: var(--g-sans);
          font-size: clamp(0.76rem, 1.1vw, 1.04rem);
          font-weight: 650;
          letter-spacing: 0;
          dominant-baseline: middle;
          paint-order: stroke;
          stroke: rgba(11,10,8,0.72);
          stroke-width: 3px;
          stroke-linejoin: round;
        }
        .hpv-input-seen {
          fill: rgba(240,235,224,0.76);
        }
        .hpv-input-typing {
          fill: rgba(228,139,109,0.9);
        }
        .hpv-input-story-view {
          fill: rgba(212,106,82,0.82);
        }
        .hpv-output-text {
          fill: rgba(228,139,109,0.9);
          stroke-width: 3.25px;
        }
        .hpv-output-seen {
          fill: rgba(228,139,109,0.88);
        }
        .hpv-output-typing {
          fill: rgba(240,235,224,0.86);
        }
        .hpv-output-story-view {
          fill: rgba(228,139,109,0.88);
        }
        .hpv-type-crossed {
          text-decoration-line: line-through;
          text-decoration-thickness: 0.12em;
        }
        .hpv-core-burst path {
          fill: none;
          stroke: rgba(212,106,82,0.14);
          stroke-width: 1;
          stroke-linecap: round;
          stroke-dasharray: 2 7;
        }
        .hpv-core-burst > circle:first-child {
          fill: transparent;
          filter: none;
        }
        .hpv-core-burst > circle:not(:first-child) {
          fill: rgba(212,106,82,0.24);
          filter: none;
        }
        .hpv-output-lines {
          opacity: 0.82;
        }
        .hpv-output-lines path {
          fill: none;
          stroke: rgba(212,106,82,0.35);
          stroke-width: 1.25;
          stroke-linecap: round;
          stroke-dasharray: 2 9;
        }
        .hpv-core {
          position: absolute;
          left: 49.4%;
          top: 44%;
          width: clamp(250px, 22vw, 340px);
          height: clamp(250px, 22vw, 340px);
          transform: translate(-50%, -50%);
          z-index: 4;
          isolation: isolate;
        }
        .hpv-core-ghost {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 76%;
          height: 76%;
          transform: translate(-50%, -48%);
          filter: drop-shadow(0 22px 34px rgba(0,0,0,0.42));
          z-index: 2;
        }
        @media (prefers-reduced-motion: reduce) {
          .hpv-input-signals,
          .hpv-output-signals {
            display: none;
          }
          .hpv-routes,
          .hpv-core,
          .hpv-core::after {
            transition: none !important;
          }
        }

        @media (max-width: 1180px) {
          .hero-grid {
            padding-left: 32px !important;
            padding-right: 32px !important;
            gap: 14px !important;
          }
          .hero-title { font-size: clamp(3rem, 5.8vw, 5.25rem); }
          .hero-subcopy { max-width: 680px; }
          .hero-privacy-visual { height: 238px; }
        }
        @media (max-width: 900px) {
          .hero-grid {
            grid-template-rows: auto auto !important;
            padding: 30px 28px 18px !important;
            gap: 14px !important;
          }
          .hero-title { font-size: clamp(2.85rem, 7.4vw, 4.3rem); }
          .hero-subcopy { max-width: 600px; }
          .hero-action-row { margin-bottom: 0.9rem; }
          .hero-proof-row { max-width: 590px; }
          .hero-privacy-visual {
            height: 250px;
            margin-top: 48px;
          }
        }
        @media (max-width: 640px) {
          .hero-grid {
            padding: 24px 18px 18px !important;
            grid-template-rows: auto auto !important;
            gap: 14px !important;
          }
          .hero-title {
            font-size: clamp(2.05rem, 8.2vw, 2.48rem);
            line-height: 0.98;
            margin-bottom: 18px;
          }
          .hero-subcopy {
            max-width: 350px;
            margin-bottom: 20px;
            line-height: 1.45;
          }
          .hero-action-row {
            gap: 0.55rem;
            margin-bottom: 0.85rem;
          }
          .hero-primary-cta,
          .hero-secondary-cta {
            min-height: 2.38rem;
            width: min(100%, 240px);
            min-width: 0;
          }
          .hero-proof-row {
            display: flex;
            width: min(100%, 320px);
            gap: 0.44rem;
          }
          .hero-proof-item {
            min-height: 1.9rem;
            padding: 0 0.52rem;
            justify-content: center;
          }
          .hero-proof-title { font-size: 0.72rem; }
          .hero-proof-icon { width: 1.02rem; height: 1.02rem; }
          .hero-privacy-visual {
            height: 238px;
            margin-top: 14px;
            overflow: hidden;
            align-self: start;
          }
          .hpv-routes {
            width: 164%;
            left: -36%;
            transform: none;
          }
          .hpv-core {
            left: 50%;
            top: 44%;
            width: 170px;
            height: 170px;
          }
          .hpv-path-text {
            font-size: clamp(0.64rem, 2.8vw, 0.82rem);
            stroke-width: 2.4px;
          }
          .hpv-output-text {
            stroke-width: 2.6px;
          }
        }
        @media (max-width: 400px) {
          .hero-grid { padding-left: 16px !important; padding-right: 16px !important; }
          .hero-title { font-size: clamp(1.92rem, 7.5vw, 2.26rem); }
          .hero-subcopy { max-width: 320px; }
          .hero-primary-cta,
          .hero-secondary-cta { width: min(100%, 232px); }
          .hero-proof-row { width: min(100%, 292px); }
          .hero-proof-item { padding: 0 0.46rem; gap: 0.36rem; }
          .hero-privacy-visual { height: 226px; margin-top: 12px; }
          .hpv-core { width: 156px; height: 156px; }
        }
        @media (max-width: 640px) and (max-height: 700px) {
          .hero-grid {
            padding-top: 18px !important;
            padding-bottom: 10px !important;
            gap: 10px !important;
          }
          .hero-title {
            font-size: clamp(1.86rem, 7.2vw, 2.18rem);
            margin-bottom: 14px;
          }
          .hero-subcopy {
            max-width: 286px;
            margin-bottom: 16px;
            font-size: 0.92rem;
            line-height: 1.38;
          }
          .hero-action-row {
            margin-bottom: 0.7rem;
          }
          .hero-primary-cta,
          .hero-secondary-cta {
            min-height: 2.22rem;
            width: min(100%, 230px);
          }
          .hero-proof-row {
            width: min(100%, 286px);
            gap: 0.34rem;
          }
          .hero-proof-item {
            min-height: 1.72rem;
          }
          .hero-privacy-visual {
            height: 196px !important;
            margin-top: 10px !important;
          }
          .hpv-core {
            width: 140px;
            height: 140px;
          }
          .hpv-path-text {
            font-size: clamp(0.56rem, 2.5vw, 0.7rem);
          }
        }
        @media (min-width: 901px) and (max-height: 820px) {
          .hero-grid {
            padding-top: 22px !important;
            padding-bottom: 10px !important;
            gap: 8px !important;
          }
          .hero-title {
            font-size: clamp(2.85rem, 5vw, 4.35rem);
            margin-bottom: 14px;
          }
          .hero-subcopy {
            max-width: 720px;
            margin-bottom: 16px;
            font-size: 0.92rem;
            line-height: 1.42;
          }
          .hero-action-row {
            gap: 0.55rem;
            margin-bottom: 0.72rem;
          }
          .hero-primary-cta,
          .hero-secondary-cta {
            min-height: 2.12rem;
            min-width: 8.7rem;
            padding: 0 0.78rem;
            font-size: 0.72rem;
          }
          .hero-proof-row {
            gap: 0.34rem;
            max-width: min(100%, 600px);
          }
          .hero-proof-item {
            min-height: 1.56rem;
            gap: 0.32rem;
            padding: 0 0.46rem;
          }
          .hero-proof-icon {
            width: 0.92rem;
            height: 0.92rem;
          }
          .hero-proof-title {
            font-size: 0.64rem;
          }
          .hero-privacy-visual {
            height: 212px !important;
            margin-top: 50px !important;
          }
          .hpv-core {
            top: 52%;
            width: 220px;
            height: 220px;
          }
          .hpv-path-text {
            font-size: clamp(0.58rem, 0.9vw, 0.78rem);
            stroke-width: 2.45px;
          }
          .hpv-output-text {
            stroke-width: 2.65px;
          }
        }
        @media (min-width: 500px) and (max-width: 640px) and (min-height: 701px) and (max-height: 760px) {
          .hero-grid {
            padding-top: 22px !important;
            padding-bottom: 18px !important;
            gap: 12px !important;
          }
          .hero-privacy-visual {
            height: 214px !important;
            margin-top: 12px !important;
          }
          .hpv-core {
            top: 46%;
            width: 152px;
            height: 152px;
          }
        }
        @media (min-width: 760px) and (max-height: 720px) {
          .hero-grid {
            padding-top: 22px !important;
            padding-bottom: 10px !important;
            gap: 8px !important;
          }
          .hero-title {
            font-size: clamp(2.85rem, 5vw, 4.3rem);
            margin-bottom: 14px;
          }
          .hero-subcopy {
            max-width: 720px;
            margin-bottom: 16px;
            font-size: 0.92rem;
            line-height: 1.42;
          }
          .hero-action-row {
            gap: 0.55rem;
            margin-bottom: 0.72rem;
          }
          .hero-primary-cta,
          .hero-secondary-cta {
            min-height: 2.12rem;
            min-width: 8.7rem;
            padding: 0 0.78rem;
            font-size: 0.72rem;
          }
          .hero-proof-row {
            gap: 0.34rem;
            max-width: min(100%, 600px);
          }
          .hero-proof-item {
            min-height: 1.56rem;
            gap: 0.32rem;
            padding: 0 0.46rem;
          }
          .hero-proof-icon {
            width: 0.92rem;
            height: 0.92rem;
          }
          .hero-proof-title {
            font-size: 0.64rem;
          }
          .hero-privacy-visual {
            height: 180px !important;
            margin-top: 42px !important;
          }
          .hpv-core {
            top: 50%;
            width: 204px;
            height: 204px;
          }
          .hpv-path-text {
            font-size: clamp(0.58rem, 0.9vw, 0.78rem);
            stroke-width: 2.45px;
          }
          .hpv-output-text {
            stroke-width: 2.65px;
          }
        }

      `}</style>
    </section>
  );
}

function LegacyHeroSection() {
  return (
    <section
      id="hero"
      className="snap-start hero-section"
      style={{ height: '100svh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden', paddingTop: 60, background: 'var(--g-bg)' }}
    >
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(var(--g-bg-rgb),0.96) 0%, rgba(var(--g-bg-rgb),0.9) 36%, rgba(var(--g-bg-rgb),0.72) 68%, rgba(var(--g-bg-rgb),0.94) 100%)', zIndex: 0, pointerEvents: 'none' }} />
      <div aria-hidden className="hero-grain" />

      <div
        className="hero-grid"
        style={{
          width: '100%', maxWidth: 1440, margin: '0 auto',
          padding: '0 clamp(24px, 4vw, 72px)',
          display: 'grid', gridTemplateColumns: 'minmax(360px, 0.82fr) minmax(0, 1.18fr)',
          gap: 'clamp(28px, 3vw, 48px)',
          alignItems: 'center', position: 'relative', zIndex: 1,
        }}
      >
        {/* Left: copy */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'relative', zIndex: 2, maxWidth: 480 }}
        >
          <h1 style={{ fontFamily: 'var(--g-display)', fontSize: 'clamp(2.8rem, 4.4vw, 4.4rem)', fontWeight: 400, fontStyle: 'italic', lineHeight: 1.06, letterSpacing: 0, color: 'var(--g-white)', margin: '0 0 8px' }}>
            Read it.
          </h1>
          <h1 style={{ fontFamily: 'var(--g-display)', fontSize: 'clamp(2.8rem, 4.4vw, 4.4rem)', fontWeight: 400, fontStyle: 'italic', lineHeight: 1.06, letterSpacing: 0, color: 'rgba(240,235,224,0.45)', margin: '0 0 28px' }}>
            Don't announce it.
          </h1>

          <p style={{ fontFamily: 'var(--g-sans)', fontSize: 15, lineHeight: 1.65, color: 'var(--g-body)', margin: '0 0 10px', maxWidth: 400 }}>
            Ghostify locally hides read receipts, typing indicators, and supported story-view signals on Messenger, Facebook, and Instagram.
          </p>
          <p style={{ fontFamily: 'var(--g-sans)', fontSize: 15, lineHeight: 1.65, color: 'rgba(240,235,224,0.3)', margin: '0 0 32px', maxWidth: 400 }}>
            No account login. No cloud relay. Just your browser quietly refusing to snitch.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <a
              href="https://chromewebstore.google.com/detail/ghostify-hide-seen-typing/flpnibonbhdmnpgflnbemgghghhblmpm?utm_source=item-share-cb"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 7, background: 'var(--g-white)', color: '#0B0A08', fontFamily: 'var(--g-sans)', fontSize: 15, fontWeight: 500, textDecoration: 'none', letterSpacing: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.28)', transition: 'opacity 0.18s ease, transform 0.15s ease' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
            >
              <Chrome size={14} />
              Get Ghostify
            </a>
            <a
              href="https://github.com/Hendrizzzz/Ghostify"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 7, background: 'transparent', color: 'var(--g-white-dim)', fontFamily: 'var(--g-sans)', fontSize: 15, fontWeight: 400, textDecoration: 'none', letterSpacing: 0, border: '1px solid rgba(240,230,210,0.13)', transition: 'border-color 0.18s ease, color 0.18s ease' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,230,210,0.28)'; (e.currentTarget as HTMLElement).style.color = 'var(--g-white)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,230,210,0.13)'; (e.currentTarget as HTMLElement).style.color = 'var(--g-white-dim)'; }}
            >
              <Github size={14} strokeWidth={1.5} />
              View source
            </a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {['Open source', 'Runs locally', 'No account credentials', 'Browser extension'].map((item, i) => (
              <span key={item} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--g-mono)', fontSize: 10, color: 'var(--g-dim)', letterSpacing: '0.02em' }}>{item}</span>
                {i < 3 && <span style={{ color: 'rgba(240,230,210,0.15)', fontSize: 10 }}>·</span>}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Right: laptop product visual */}
        <motion.div
          className="hero-laptop-visual"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.78, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: 'min(calc(100svh - 96px), 640px)', minHeight: 460, position: 'relative', pointerEvents: 'none' }}
        >
          <div aria-hidden className="hero-laptop-shadow" />
          <div
            aria-hidden
            className="hero-laptop-haze"
            style={{
              position: 'absolute',
              width: 'min(58vw, 900px)',
              height: 'min(42vw, 620px)',
              right: 'clamp(-94px, -6vw, -36px)',
              bottom: 'clamp(-72px, -4vw, -30px)',
              background: 'linear-gradient(135deg, rgba(240,235,224,0.13), rgba(240,235,224,0.02) 38%, transparent 72%)',
              filter: 'blur(22px)',
              opacity: 0.34,
            }}
          />
          <picture
            className="hero-laptop-picture"
            style={{
              position: 'absolute',
              width: 'clamp(520px, 55vw, 900px)',
              maxWidth: 'none',
              right: 'clamp(-86px, -5.4vw, -32px)',
              bottom: 'clamp(-98px, -5.8vw, -42px)',
              filter: 'brightness(1.24) contrast(1.08) saturate(1.04)',
              userSelect: 'none',
            }}
          >
            <source media="(max-width: 900px)" srcSet="/hero-laptop-scene-tight.webp" />
            <img
              src="/hero-laptop-scene.webp"
              alt="Ghostify privacy controls shown in a laptop browser."
              className="hero-laptop-image"
              draggable={false}
            />
          </picture>
        </motion.div>
      </div>

      <style>{`
        .hero-grain {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0.18;
          background-image:
            repeating-linear-gradient(0deg, rgba(240,235,224,0.025) 0 1px, transparent 1px 3px),
            repeating-linear-gradient(90deg, rgba(240,235,224,0.018) 0 1px, transparent 1px 4px);
          mix-blend-mode: soft-light;
        }
        .hero-laptop-visual {
          mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 96%, transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 96%, transparent 100%);
        }
        .hero-laptop-picture {
          display: block;
          line-height: 0;
          mask-image: radial-gradient(ellipse at 57% 57%, #000 0 66%, rgba(0,0,0,0.96) 80%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse at 57% 57%, #000 0 66%, rgba(0,0,0,0.96) 80%, transparent 100%);
        }
        .hero-laptop-image {
          display: block;
          width: 100%;
          height: auto;
        }
        .hero-laptop-shadow {
          position: absolute;
          width: min(54vw, 860px);
          height: min(18vw, 230px);
          right: clamp(-80px, -5vw, -28px);
          bottom: clamp(-30px, -2vw, -12px);
          background: radial-gradient(closest-side, rgba(0,0,0,0.66), transparent 72%);
          filter: blur(14px);
          opacity: 0.78;
        }
        @media (max-width: 1100px) and (min-width: 901px) {
          .hero-grid {
            grid-template-columns: minmax(320px, 0.9fr) minmax(470px, 1.1fr) !important;
            gap: 28px !important;
            padding: 0 32px !important;
          }
          .hero-laptop-visual {
            min-height: 430px !important;
            height: min(calc(100svh - 104px), 560px) !important;
          }
          .hero-laptop-picture {
            width: clamp(560px, 58vw, 660px) !important;
            right: clamp(-92px, -7vw, -54px) !important;
            bottom: clamp(-76px, -7vh, -42px) !important;
          }
        }
        @media (max-width: 900px) {
          .hero-section {
            height: auto !important;
            min-height: 100svh !important;
            align-items: flex-start !important;
            overflow: visible !important;
            padding-top: 82px !important;
            padding-bottom: 48px !important;
          }
          .hero-grid {
            grid-template-columns: 1fr !important;
            max-width: 780px !important;
            box-sizing: border-box !important;
            padding: 0 24px !important;
            gap: 28px !important;
            align-items: start !important;
          }
          .hero-grid > * {
            min-width: 0 !important;
          }
          .hero-laptop-visual {
            width: 100% !important;
            max-width: 760px !important;
            min-height: 330px !important;
            height: min(44svh, 380px) !important;
            justify-self: center !important;
            overflow: hidden !important;
            mask-image: linear-gradient(180deg, #000 0 88%, transparent 100%) !important;
            -webkit-mask-image: linear-gradient(180deg, #000 0 88%, transparent 100%) !important;
          }
          .hero-laptop-visual > div {
            width: 100% !important;
            height: 70% !important;
            right: 0 !important;
            bottom: 0 !important;
            filter: blur(20px) !important;
            opacity: 0.34 !important;
          }
          .hero-laptop-picture {
            width: min(96vw, 640px) !important;
            left: 50% !important;
            right: auto !important;
            bottom: -4% !important;
            transform: translateX(-50%) !important;
            mask-image: none !important;
            -webkit-mask-image: none !important;
          }
        }
        @media (max-width: 768px) {
          .hero-section {
            height: auto !important;
            min-height: 100svh !important;
            align-items: flex-start !important;
            overflow: visible !important;
            padding-top: 76px !important;
            padding-bottom: 44px !important;
          }
          .hero-grid {
            grid-template-columns: 1fr !important;
            box-sizing: border-box !important;
            padding: 0 18px !important;
            gap: 24px !important;
            align-items: start !important;
          }
          .hero-grid > * {
            min-width: 0 !important;
          }
          .hero-glow {
            display: none !important;
          }
          .hero-laptop-visual {
            width: 100% !important;
            max-width: 640px !important;
            min-height: 270px !important;
            height: min(42svh, 340px) !important;
            justify-self: center !important;
            overflow: hidden !important;
          }
          .hero-laptop-visual > div {
            width: 100% !important;
            height: 72% !important;
            right: 0 !important;
            bottom: 0 !important;
            filter: blur(18px) !important;
            opacity: 0.34 !important;
          }
          .hero-laptop-visual img {
            width: min(116vw, 680px) !important;
            right: 50% !important;
            bottom: -16% !important;
            transform: translateX(50%) !important;
          }
          .hero-tabbar {
            padding-left: 8px !important;
            padding-right: 8px !important;
            gap: 1px !important;
            overflow: hidden !important;
          }
          .hero-tab {
            padding-left: 8px !important;
            padding-right: 8px !important;
            min-width: 0 !important;
            flex: 0 1 auto !important;
            font-size: 10.5px !important;
            gap: 4px !important;
          }
          .hero-extension-tab-icon {
            padding-left: 4px !important;
          }
          .hero-address {
            padding-left: 8px !important;
            padding-right: 8px !important;
          }
          .hero-chat-list {
            width: clamp(112px, 34%, 156px) !important;
            flex-basis: clamp(112px, 34%, 156px) !important;
          }
          .hero-thread {
            min-width: 0 !important;
            flex: 1 1 auto !important;
          }
        }
        @media (max-width: 420px) {
          .hero-laptop-visual {
            height: clamp(220px, 34svh, 280px) !important;
            min-height: 220px !important;
          }
          .hero-laptop-picture {
            width: min(108vw, 430px) !important;
            bottom: 0 !important;
          }
          .hero-chat-list {
            width: clamp(108px, 35%, 126px) !important;
            flex-basis: clamp(108px, 35%, 126px) !important;
          }
          .hero-tab {
            padding-left: 6px !important;
            padding-right: 6px !important;
            font-size: 9.5px !important;
          }
          .hero-extension-tab-icon {
            padding-left: 3px !important;
          }
        }
        @media (max-width: 340px) {
          .hero-tab {
            padding-left: 4px !important;
            padding-right: 4px !important;
            font-size: 9px !important;
            gap: 3px !important;
          }
          .hero-address > div:first-child {
            display: none !important;
          }
        }
      `}</style>
    </section>
  );
}
