import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Chrome, Github, Globe } from 'lucide-react';
import { GhostMark } from './GhostSVG';

type HeroPlatform = 'messenger' | 'facebook' | 'instagram';

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
          <div style={{ position: 'absolute', top: -5, right: 8, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '6px solid #141210', zIndex: 2 }} />

          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: 220, background: '#141210', border: '1px solid rgba(240,230,210,0.09)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', position: 'relative', zIndex: 3 }}
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
                    <span style={{ fontFamily: 'var(--g-mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: isActive ? 'rgba(196,72,48,0.7)' : 'rgba(240,230,210,0.26)' }}>
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
                  <div style={{ maxWidth: '72%', padding: '7px 11px', borderRadius: msg.them ? '4px 16px 16px 16px' : '16px 4px 16px 16px', background: msg.them ? 'rgba(255,255,255,0.09)' : '#0082FB', fontFamily: 'var(--g-sans)', fontSize: 12.5, color: 'white', lineHeight: 1.4 }}>
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
        background: '#141210', borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(240,230,210,0.08)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35)',
        pointerEvents: 'none', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Window chrome */}
      <div style={{ height: 36, background: '#141210', borderBottom: '1px solid rgba(240,230,210,0.06)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: '#FF5F57' }} />
          <div style={{ width: 10, height: 10, borderRadius: 5, background: '#FEBC2E' }} />
          <div style={{ width: 10, height: 10, borderRadius: 5, background: '#28C840' }} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="hero-tabbar" style={{ background: '#141210', display: 'flex', alignItems: 'flex-end', padding: '0 10px', gap: 2, height: 32, borderBottom: '1px solid rgba(240,230,210,0.05)', flexShrink: 0 }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="hero-tab"
            data-cursor-target={tab.id === 'messenger' ? 'msgTab' : tab.id === 'facebook' ? 'fbTab' : 'igTab'}
            style={{
              height: 27, padding: '0 12px', borderRadius: '6px 6px 0 0',
              background: activePlatform === tab.id ? '#1C1A17' : 'transparent',
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
          <div data-cursor-target="extIcon" style={{ width: 21, height: 21, borderRadius: 5, background: popupOpen ? 'rgba(196,72,48,0.22)' : 'rgba(196,72,48,0.12)', border: `1px solid ${popupOpen ? 'rgba(196,72,48,0.45)' : 'rgba(196,72,48,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
            <GhostMark size={13} />
          </div>
        </div>
      </div>

      {/* Address bar */}
      <div className="hero-address" style={{ background: '#1C1A17', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid rgba(240,230,210,0.04)', flexShrink: 0 }}>
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
export function HeroSection() {
  return (
    <section
      id="hero"
      className="snap-start hero-section"
      style={{ height: '100svh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden', paddingTop: 60 }}
    >
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 90% 70% at 65% 55%, rgba(24,18,10,0.9) 0%, var(--g-bg) 100%)', zIndex: 0, pointerEvents: 'none' }} />
      <div className="hero-glow" aria-hidden style={{ position: 'absolute', left: '5%', top: '20%', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,72,48,0.035) 0%, transparent 68%)', pointerEvents: 'none', zIndex: 0 }} />

      <div
        className="hero-grid"
        style={{
          width: '100%', maxWidth: 1480, margin: '0 auto',
          padding: '0 clamp(22px, 3vw, 48px)',
          display: 'grid', gridTemplateColumns: '42fr 58fr',
          gap: 'clamp(32px, 4vw, 56px)',
          alignItems: 'center', position: 'relative', zIndex: 1,
        }}
      >
        {/* Left: copy */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <div style={{ width: 5, height: 5, borderRadius: 3, background: 'var(--g-accent)', opacity: 0.75 }} />
            <span style={{ fontFamily: 'var(--g-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--g-dim)' }}>
              Open source browser extension
            </span>
          </div>

          <h1 style={{ fontFamily: 'var(--g-display)', fontSize: 'clamp(2.8rem, 4.4vw, 4.4rem)', fontWeight: 400, fontStyle: 'italic', lineHeight: 1.06, letterSpacing: 0, color: 'var(--g-white)', margin: '0 0 8px' }}>
            Read it.
          </h1>
          <h1 style={{ fontFamily: 'var(--g-display)', fontSize: 'clamp(2.8rem, 4.4vw, 4.4rem)', fontWeight: 400, fontStyle: 'italic', lineHeight: 1.06, letterSpacing: 0, color: 'rgba(240,235,224,0.45)', margin: '0 0 28px' }}>
            Don't announce it.
          </h1>

          <p style={{ fontFamily: 'var(--g-sans)', fontSize: 'clamp(0.88rem, 1.05vw, 0.98rem)', lineHeight: 1.65, color: 'var(--g-body)', margin: '0 0 10px', maxWidth: 400 }}>
            Ghostify locally hides read receipts, typing indicators, and supported story-view signals on Messenger, Facebook, and Instagram.
          </p>
          <p style={{ fontFamily: 'var(--g-sans)', fontSize: 'clamp(0.82rem, 0.95vw, 0.9rem)', lineHeight: 1.65, color: 'rgba(240,235,224,0.3)', margin: '0 0 32px', maxWidth: 400 }}>
            No account login. No cloud relay. Just your browser quietly refusing to snitch.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <a
              href="https://chromewebstore.google.com/detail/ghostify-hide-seen-typing/flpnibonbhdmnpgflnbemgghghhblmpm?utm_source=item-share-cb"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 7, background: 'var(--g-white)', color: '#0B0A08', fontFamily: 'var(--g-sans)', fontSize: 14, fontWeight: 500, textDecoration: 'none', letterSpacing: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.28)', transition: 'opacity 0.18s ease, transform 0.15s ease' }}
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
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 7, background: 'transparent', color: 'var(--g-white-dim)', fontFamily: 'var(--g-sans)', fontSize: 14, fontWeight: 400, textDecoration: 'none', letterSpacing: 0, border: '1px solid rgba(240,230,210,0.13)', transition: 'border-color 0.18s ease, color 0.18s ease' }}
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

        {/* Right: browser autoplay */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.78, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: 'min(calc(100svh - 104px), 600px)', position: 'relative' }}
        >
          <HeroBrowserScene />
        </motion.div>
      </div>

      <style>{`
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
          .hero-grid > :last-child {
            width: 100% !important;
            max-width: 640px !important;
            height: min(48svh, 340px) !important;
            justify-self: center !important;
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
          .hero-grid > :last-child {
            height: clamp(320px, 54svh, 340px) !important;
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
