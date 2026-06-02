import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe } from 'lucide-react';
import { GhostMark } from './GhostSVG';

type Platform = 'messenger' | 'facebook' | 'instagram';

interface Controls {
  instagram: { seen: boolean; typing: boolean; story: boolean };
  messengerFacebook: { seen: boolean; typing: boolean; story: boolean };
}

type ControlGroup = keyof Controls;
type TypingSignal = 'start' | 'active' | 'stop';

const PLATFORM_URLS: Record<Platform, string> = {
  messenger: 'messenger.com',
  facebook: 'facebook.com/messages',
  instagram: 'instagram.com/direct',
};

function dispatchMascot(type: string) {
  window.dispatchEvent(new CustomEvent('ghostify:mascot', { detail: { type } }));
}

function useTypingActivity(onType: (signal: TypingSignal) => void) {
  const isTyping = useRef(false);
  const onTypeRef = useRef(onType);
  const stopTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    onTypeRef.current = onType;
  }, [onType]);

  useEffect(() => () => {
    clearTimeout(stopTimer.current);
    if (isTyping.current) {
      isTyping.current = false;
      onTypeRef.current('stop');
    }
  }, []);

  return useCallback((value: string) => {
    clearTimeout(stopTimer.current);

    if (!value) {
      if (isTyping.current) {
        isTyping.current = false;
        onTypeRef.current('stop');
      }
      return;
    }

    onTypeRef.current(isTyping.current ? 'active' : 'start');
    isTyping.current = true;
    stopTimer.current = setTimeout(() => {
      isTyping.current = false;
      onTypeRef.current('stop');
    }, 850);
  }, []);
}

/* ── Toggle ──────────────────────────────────────────── */
function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      className="demo-toggle"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width: 32,
        height: 18,
        borderRadius: 9,
        background: on ? 'var(--g-accent)' : 'rgba(240,230,210,0.14)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s ease',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 15 : 3,
          width: 12,
          height: 12,
          borderRadius: 6,
          background: 'white',
          transition: 'left 0.18s var(--g-spring)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
      />
    </button>
  );
}

/* ── Ghostify controls panel ─────────────────────────── */
function GhostifyPanel({
  platform,
  controls,
  onToggle,
}: {
  platform: Platform;
  controls: Controls;
  onToggle: (group: ControlGroup, key: string, value: boolean) => void;
}) {
  const groups: Array<{
    groupKey: ControlGroup;
    label: string;
    items: { key: string; label: string }[];
    activePlatforms: Platform[];
  }> = [
    {
      groupKey: 'instagram',
      label: 'Instagram',
      activePlatforms: ['instagram'],
      items: [
        { key: 'seen', label: 'Hide Seen' },
        { key: 'typing', label: 'Hide Typing' },
        { key: 'story', label: 'Hide Story Views' },
      ],
    },
    {
      groupKey: 'messengerFacebook',
      label: 'Messenger / Facebook',
      activePlatforms: ['messenger', 'facebook'],
      items: [
        { key: 'seen', label: 'Hide Seen' },
        { key: 'typing', label: 'Hide Typing' },
        { key: 'story', label: 'Hide Story Views' },
      ],
    },
  ];

  return (
    <div
      style={{
        width: 220,
        background: '#141210',
        border: '1px solid rgba(240,230,210,0.09)',
        borderRadius: 10,
        overflow: 'hidden',
        flexShrink: 0,
        alignSelf: 'flex-start',
        marginTop: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid rgba(240,230,210,0.06)',
        }}
      >
        <GhostMark size={16} />
        <span
          style={{
            fontFamily: 'var(--g-display)',
            fontSize: 13.5,
            fontWeight: 500,
            color: 'var(--g-white)',
            letterSpacing: '0.02em',
          }}
        >
          Ghostify
        </span>
        <div
          style={{
            marginLeft: 'auto',
            width: 7,
            height: 7,
            borderRadius: 4,
            background: 'var(--g-accent)',
            boxShadow: '0 0 6px var(--g-accent)',
          }}
        />
      </div>

      {/* Groups */}
      {groups.map((group, gi) => {
        const grpControls = controls[group.groupKey] as Record<string, boolean>;
        const isActive = group.activePlatforms.includes(platform);
        return (
          <div
            key={group.groupKey}
            style={{
              borderBottom:
                gi < groups.length - 1
                  ? '1px solid rgba(240,230,210,0.05)'
                  : 'none',
              opacity: isActive ? 1 : 0.5,
              transition: 'opacity 0.2s ease',
            }}
          >
            <div
              style={{
                padding: '8px 14px 4px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--g-mono)',
                  fontSize: 8.5,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isActive
                    ? 'rgba(196,72,48,0.7)'
                    : 'rgba(240,230,210,0.26)',
                }}
              >
                {group.label}
              </span>
            </div>
            {group.items.map((item) => (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 14px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--g-sans)',
                    fontSize: 11.5,
                    color: 'rgba(240,230,210,0.7)',
                  }}
                >
                  {item.label}
                </span>
                <Toggle
                  on={grpControls[item.key] ?? false}
                  onChange={(v) => onToggle(group.groupKey, item.key, v)}
                />
              </div>
            ))}
            <div style={{ height: 6 }} />
          </div>
        );
      })}
    </div>
  );
}

/* ── Messenger view ──────────────────────────────────── */
const MESSENGER_CHATS = [
  { id: 'alex', name: 'Alex Chen', msg: 'sounds good for Saturday', time: '9:41', unread: 2, color: '#7C4DFF' },
  { id: 'maria', name: 'Maria Santos', msg: 'did you see that thing I sent', time: '9:22', active: true, color: '#0082FB' },
  { id: 'jordan', name: 'Jordan Lee', msg: 'ok sure', time: 'Mon', color: '#00BFA5' },
  { id: 'priya', name: 'Priya K.', msg: 'lol same', time: 'Sun', color: '#FF6D00' },
];

const MESSENGER_THREAD: Record<string, { them: boolean; text: string }[]> = {
  maria: [
    { them: true, text: 'hey did you see that reel I sent' },
    { them: false, text: 'just opened it, give me a sec' },
    { them: true, text: 'no rush!! also are you free this weekend?' },
    { them: false, text: 'yeah Saturday works, what time were you thinking' },
    { them: true, text: 'did you see that thing I sent' },
  ],
  alex: [
    { them: false, text: 'are you still down for Saturday?' },
    { them: true, text: 'yes! sounds good for Saturday' },
    { them: true, text: 'should I bring anything?' },
  ],
  jordan: [
    { them: true, text: 'can you cover me tomorrow?' },
    { them: false, text: 'yeah of course' },
    { them: true, text: 'ok sure' },
  ],
  priya: [
    { them: true, text: 'work is so chaotic rn' },
    { them: false, text: 'lol same' },
  ],
};

function MessengerView({
  unreadMap,
  onOpenChat,
  onType,
}: {
  unreadMap: Record<string, boolean>;
  onOpenChat: (id: string) => void;
  onType: (signal: TypingSignal) => void;
}) {
  const [activeChat, setActiveChat] = useState('maria');
  const [composerText, setComposerText] = useState('');
  const signalTyping = useTypingActivity(onType);

  const handleChatOpen = (id: string) => {
    setActiveChat(id);
    onOpenChat(id);
  };

  const handleType = (v: string) => {
    setComposerText(v);
    signalTyping(v);
  };

  const chat = MESSENGER_CHATS.find((c) => c.id === activeChat);
  const messages = MESSENGER_THREAD[activeChat] || [];

  return (
    <div style={{ height: '100%', display: 'flex', background: '#1A1E2B' }}>
      {/* Chat list */}
      <div
        className="demo-chat-list demo-chat-list-messenger"
        style={{
          width: 210,
          borderRight: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            padding: '12px 14px 8px',
            fontFamily: 'var(--g-sans)',
            fontSize: 18,
            fontWeight: 700,
            color: 'white',
          }}
        >
          Chats
        </div>
        <div style={{ padding: '0 6px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {MESSENGER_CHATS.map((ch) => (
            <button
              key={ch.id}
              onClick={() => handleChatOpen(ch.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '7px 8px',
                borderRadius: 8,
                background: ch.id === activeChat ? 'rgba(0,130,251,0.16)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  background: ch.color,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'white',
                  fontFamily: 'var(--g-sans)',
                }}
              >
                {ch.name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'var(--g-sans)',
                    fontSize: 12.5,
                    fontWeight: (ch.unread !== undefined && unreadMap[ch.id]) ? 600 : 400,
                    color: 'rgba(255,255,255,0.9)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ch.name}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--g-sans)',
                    fontSize: 11,
                    color: (ch.unread !== undefined && unreadMap[ch.id]) ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ch.msg}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <span style={{ fontSize: 10, color: (ch.unread !== undefined && unreadMap[ch.id]) ? '#0082FB' : 'rgba(255,255,255,0.28)', fontFamily: 'var(--g-sans)' }}>
                  {ch.time}
                </span>
                {ch.unread !== undefined && unreadMap[ch.id] && (
                  <div
                    style={{
                      width: 17,
                      height: 17,
                      borderRadius: 9,
                      background: '#0082FB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9.5,
                      fontWeight: 700,
                      color: 'white',
                      fontFamily: 'var(--g-sans)',
                    }}
                  >
                    {ch.unread}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="demo-thread" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              background: chat?.color ?? '#0082FB',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: 'white',
              fontFamily: 'var(--g-sans)',
            }}
          >
            {chat?.name[0]}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--g-sans)', fontSize: 13, fontWeight: 600, color: 'white' }}>
              {chat?.name}
            </div>
            <div style={{ fontFamily: 'var(--g-sans)', fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>
              Active now
            </div>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            overflowY: 'auto',
          }}
        >
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.them ? 'flex-start' : 'flex-end' }}>
              <div
                style={{
                  maxWidth: '70%',
                  padding: '7px 11px',
                  borderRadius: msg.them ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                  background: msg.them ? 'rgba(255,255,255,0.1)' : '#0082FB',
                  fontFamily: 'var(--g-sans)',
                  fontSize: 12.5,
                  color: 'white',
                  lineHeight: 1.4,
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <input
            value={composerText}
            onChange={(e) => handleType(e.target.value)}
            placeholder="Aa"
            style={{
              width: '100%',
              height: 34,
              borderRadius: 17,
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              outline: 'none',
              padding: '0 14px',
              fontFamily: 'var(--g-sans)',
              fontSize: 12.5,
              color: 'white',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Facebook demo threads ───────────────────────────── */
// them: true = outgoing (blue, right), them: false = incoming (grey, left)
const FB_DEMO_THREADS: Record<string, { them: boolean; text: string }[]> = {
  natalie: [
    { them: false, text: 'are you joining tonight?' },
    { them: true,  text: 'yeah I think so, what time?' },
    { them: false, text: 'we said 8 but people are always late lol' },
    { them: true,  text: 'ok I\'ll aim for 8:30 then' },
  ],
  tom: [
    { them: true,  text: 'just saw this, sorry for the late reply' },
    { them: false, text: 'yeah just got your message' },
    { them: true,  text: 'no worries, free tomorrow?' },
  ],
  group: [
    { them: false, text: 'what time is everyone arriving?' },
    { them: false, text: 'Chris: I\'m in' },
    { them: true,  text: 'same, see you all Saturday' },
  ],
};

/* ── Facebook view ───────────────────────────────────── */
function FacebookStoryViewer({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 200,
          height: 280,
          background: 'linear-gradient(160deg, #2d1b4e 0%, #1a3050 100%)',
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          gap: 10,
          position: 'relative',
          cursor: 'default',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }}>
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 5, ease: 'linear' }}
            style={{ height: '100%', background: 'white', borderRadius: 2 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'white', fontFamily: 'var(--g-sans)' }}>
            L
          </div>
          <div>
            <div style={{ fontFamily: 'var(--g-sans)', fontSize: 12, fontWeight: 600, color: 'white' }}>
              Laura Kim
            </div>
            <div style={{ fontFamily: 'var(--g-sans)', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
              3 hours ago
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'var(--g-display)', fontSize: 22, fontStyle: 'italic', color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>
            weekend vibes
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            alignSelf: 'center',
            padding: '6px 16px',
            borderRadius: 16,
            background: 'rgba(255,255,255,0.14)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--g-sans)',
            fontSize: 11.5,
            color: 'white',
          }}
        >
          Close story
        </button>
      </div>
    </motion.div>
  );
}

function FacebookView({
  controls,
  unreadMap,
  onOpenChat,
  onType,
  onStoryView,
  storyViewedSet,
}: {
  controls: { seen: boolean; typing: boolean; story: boolean };
  unreadMap: Record<string, boolean>;
  onOpenChat: (id: string) => void;
  onType: (signal: TypingSignal) => void;
  onStoryView: (name: string) => void;
  storyViewedSet: Record<string, boolean>;
}) {
  const [storyOpen, setStoryOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [activeChat, setActiveChat] = useState('natalie');
  const signalTyping = useTypingActivity(onType);

  const chats = [
    { id: 'natalie', name: 'Natalie Park', msg: 'are you joining tonight?', time: '8:55', color: '#E91E63', unread: 2 },
    { id: 'tom', name: 'Tom Reyes', msg: 'yeah just got your message', time: '8:30', color: '#FF5722' },
    { id: 'group', name: 'Weekend Plans', msg: 'Chris: I\'m in', time: '8:10', color: '#4CAF50' },
  ];

  const stories = [
    { name: 'Laura', color: '#7C4DFF' },
    { name: 'James', color: '#FF6D00' },
    { name: 'Mei', color: '#00BFA5' },
  ];

  const handleStory = (name: string) => {
    setStoryOpen(true);
    onStoryView(name);
  };

  const handleType = (v: string) => {
    setComposerText(v);
    signalTyping(v);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#18191A', position: 'relative' }}>
      {/* FB top nav */}
      <div
        style={{
          height: 40,
          background: '#242526',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: 14,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--g-sans)',
            fontSize: 22,
            fontWeight: 900,
            color: '#1877F2',
            letterSpacing: '-1px',
          }}
        >
          f
        </span>
        <div
          style={{
            flex: 1,
            height: 26,
            borderRadius: 13,
            background: 'rgba(255,255,255,0.08)',
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span style={{ fontFamily: 'var(--g-sans)', fontSize: 11.5, color: 'rgba(255,255,255,0.3)' }}>
            Search Facebook
          </span>
        </div>
        {['Home', 'Watch', 'Messages'].map((item, i) => (
          <div
            key={item}
            style={{
              padding: '0 10px',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              borderBottom: i === 2 ? '2px solid #1877F2' : 'none',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--g-sans)',
                fontSize: 11,
                color: i === 2 ? '#1877F2' : 'rgba(255,255,255,0.5)',
              }}
            >
              {item}
            </span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: chat list + stories */}
        <div
          className="demo-chat-list demo-chat-list-facebook"
          style={{
            width: 240,
            borderRight: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              padding: '10px 12px 6px',
              fontFamily: 'var(--g-sans)',
              fontSize: 14,
              fontWeight: 700,
              color: 'white',
            }}
          >
            Messages
          </div>

          {/* Story row */}
          <div style={{ padding: '4px 12px 10px', display: 'flex', gap: 8 }}>
            {stories.map((s) => (
              <button
                key={s.name}
                onClick={() => handleStory(s.name)}
                style={{
                  width: 52,
                  height: 72,
                  borderRadius: 10,
                  background: s.color,
                  border: storyViewedSet[s.name] ? '2px solid rgba(255,255,255,0.15)' : '2px solid rgba(24,119,242,0.6)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  padding: '0 0 6px',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    background: s.color,
                    border: '2px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'white',
                    fontFamily: 'var(--g-sans)',
                  }}
                >
                  {s.name[0]}
                </div>
                <span style={{ fontFamily: 'var(--g-sans)', fontSize: 9, color: 'white', fontWeight: 600 }}>
                  {s.name}
                </span>
              </button>
            ))}
          </div>

          {/* Chats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 6px' }}>
            {chats.map((ch) => {
              const hasUnread = ch.unread !== undefined && unreadMap[ch.id];
              return (
                <button
                  key={ch.id}
                  onClick={() => { setActiveChat(ch.id); onOpenChat(ch.id); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 8px',
                    borderRadius: 7,
                    background: ch.id === activeChat ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      background: ch.color,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'white',
                      fontFamily: 'var(--g-sans)',
                    }}
                  >
                    {ch.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--g-sans)', fontSize: 12, fontWeight: hasUnread ? 600 : 500, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ch.name}
                    </div>
                    <div style={{ fontFamily: 'var(--g-sans)', fontSize: 10.5, color: hasUnread ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.38)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ch.msg}
                    </div>
                  </div>
                  {hasUnread && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        background: '#1877F2',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: chat thread */}
        <div className="demo-thread" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Thread header */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: chats.find(c => c.id === activeChat)?.color ?? '#E91E63', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'white', fontFamily: 'var(--g-sans)' }}>
              {chats.find(c => c.id === activeChat)?.name[0] ?? 'N'}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--g-sans)', fontSize: 13, fontWeight: 600, color: 'white' }}>{chats.find(c => c.id === activeChat)?.name ?? 'Natalie Park'}</div>
              <div style={{ fontFamily: 'var(--g-sans)', fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>Active now</div>
            </div>
          </div>
          <div style={{ flex: 1, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto' }}>
            <AnimatePresence mode="wait">
              <motion.div key={activeChat} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {FB_DEMO_THREADS[activeChat]?.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.them ? 'flex-end' : 'flex-start' }}>
                    <div
                      style={{
                        maxWidth: '68%',
                        padding: '7px 11px',
                        borderRadius: msg.them ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                        background: msg.them ? '#1877F2' : 'rgba(255,255,255,0.1)',
                        fontFamily: 'var(--g-sans)',
                        fontSize: 12,
                        color: 'white',
                        lineHeight: 1.4,
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
          <div style={{ flex: 0 }} />
          <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              value={composerText}
              onChange={(e) => handleType(e.target.value)}
              placeholder="Aa"
              style={{
                width: '100%',
                height: 34,
                borderRadius: 17,
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                outline: 'none',
                padding: '0 14px',
                fontFamily: 'var(--g-sans)',
                fontSize: 12.5,
                color: 'white',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* Story overlay */}
      <AnimatePresence>
        {storyOpen && <FacebookStoryViewer onClose={() => setStoryOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

/* ── Instagram view ──────────────────────────────────── */
function InstagramStoryViewer({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.9)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 180,
          height: 260,
          background: 'linear-gradient(170deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          padding: 12,
          gap: 8,
          position: 'relative',
          cursor: 'default',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ height: 3, background: 'rgba(255,255,255,0.25)', borderRadius: 2 }}>
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 5, ease: 'linear' }}
            style={{ height: '100%', background: 'white', borderRadius: 2 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 24, height: 24, borderRadius: 12, background: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', fontFamily: 'var(--g-sans)' }}>
            C
          </div>
          <span style={{ fontFamily: 'var(--g-sans)', fontSize: 11, fontWeight: 600, color: 'white' }}>
            cami.v
          </span>
          <span style={{ fontFamily: 'var(--g-sans)', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>
            5m
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--g-display)', fontSize: 18, fontStyle: 'italic', color: 'white', textAlign: 'center' }}>
            golden hour
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '5px 14px',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.18)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--g-sans)',
            fontSize: 11,
            color: 'white',
            alignSelf: 'center',
          }}
        >
          Close
        </button>
      </div>
    </motion.div>
  );
}

/* ── Instagram demo threads ──────────────────────────── */
const IG_DEMO_THREADS: Record<string, { them: boolean; text: string }[]> = {
  cami: [
    { them: true,  text: 'omg you have to watch this' },
    { them: false, text: 'on it right now' },
    { them: true,  text: 'the ending is SO good' },
    { them: false, text: 'ok finishing the episode first no spoilers' },
  ],
  marco: [
    { them: true,  text: 'sent you something' },
    { them: false, text: 'ooh what is it' },
    { them: true,  text: 'check your notifications' },
  ],
  hana: [
    { them: true,  text: 'we should actually plan something soon' },
    { them: false, text: 'yeah for sure, let me check my schedule' },
    { them: true,  text: 'lol no rush' },
    { them: false, text: 'ok sorry been busy' },
    { them: true,  text: 'haha yeah same' },
  ],
};

const IG_NAV_ITEMS = ['Home', 'Search', 'Explore', 'Reels', 'Messages', 'Notifications', 'Create'];

function InstagramView({
  controls,
  unreadMap,
  onOpenChat,
  onType,
  onStoryView,
  storyViewedSet,
}: {
  controls: { seen: boolean; typing: boolean; story: boolean };
  unreadMap: Record<string, boolean>;
  onOpenChat: (id: string) => void;
  onType: (signal: TypingSignal) => void;
  onStoryView: (name: string) => void;
  storyViewedSet: Record<string, boolean>;
}) {
  const [storyOpen, setStoryOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [activeChat, setActiveChat] = useState('cami');
  const signalTyping = useTypingActivity(onType);

  const stories = [
    { name: 'cami.v', color: '#E1306C' },
    { name: 'marco_p', color: '#FF6D00' },
    { name: 'h.nakano', color: '#7C4DFF' },
    { name: 'sol.r', color: '#00BFA5' },
  ];

  const dms = [
    { id: 'cami',  handle: 'cami.v',   msg: 'omg you have to watch this', time: '2m',  color: '#E1306C' },
    { id: 'marco', handle: 'marco_p',  msg: 'sent you something',          time: '14m', color: '#FF6D00', unread: 2 },
    { id: 'hana',  handle: 'h.nakano', msg: 'haha yeah same',              time: '1h',  color: '#7C4DFF' },
  ];

  const activeDm = dms.find(dm => dm.id === activeChat) ?? dms[0];
  const thread = IG_DEMO_THREADS[activeChat] ?? IG_DEMO_THREADS.cami;

  const handleStory = (name: string) => {
    setStoryOpen(true);
    onStoryView(name);
  };

  const handleType = (v: string) => {
    setComposerText(v);
    signalTyping(v);
  };

  return (
    <div style={{ height: '100%', display: 'flex', background: '#000', position: 'relative' }}>
      {/* Left nav rail */}
      <div
        className="demo-ig-rail"
        style={{
          width: 60,
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          gap: 4,
          flexShrink: 0,
        }}
      >
        <div style={{ marginBottom: 16, fontFamily: 'var(--g-sans)', fontSize: 20, fontWeight: 700, color: 'white', fontStyle: 'italic' }}>
          IG
        </div>
        {IG_NAV_ITEMS.map((item, i) => (
          <div
            key={item}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: i === 4 ? 'rgba(255,255,255,0.1)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title={item}
          >
            <span style={{ fontSize: 16, color: i === 4 ? 'white' : 'rgba(255,255,255,0.4)' }}>
              {['⌂', '⌕', '#', '▷', '✉', '♡', '+'][i]}
            </span>
          </div>
        ))}
      </div>

      {/* DM list */}
      <div
        className="demo-chat-list demo-chat-list-instagram"
        style={{
          width: 200,
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: '12px 14px 8px', fontFamily: 'var(--g-sans)', fontSize: 14, fontWeight: 700, color: 'white' }}>
          Messages
        </div>

        {/* Story row */}
        <div style={{ padding: '4px 12px 10px', display: 'flex', gap: 6, overflowX: 'auto' }}>
          {stories.map((s) => (
            <button
              key={s.name}
              onClick={() => handleStory(s.name)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: storyViewedSet[s.name]
                    ? 'rgba(255,255,255,0.2)'
                    : `linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)`,
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    background: s.color,
                    border: '2px solid #000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'white',
                    fontFamily: 'var(--g-sans)',
                  }}
                >
                  {s.name[0].toUpperCase()}
                </div>
              </div>
              <span style={{ fontFamily: 'var(--g-sans)', fontSize: 9, color: 'rgba(255,255,255,0.5)', maxWidth: 36, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name.split('.')[0]}
              </span>
            </button>
          ))}
        </div>

        {/* DMs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {dms.map((dm) => {
            const hasUnread = dm.unread !== undefined && unreadMap[dm.id];
            return (
              <button
                key={dm.id}
                onClick={() => { setActiveChat(dm.id); onOpenChat(dm.id); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  background: dm.id === activeChat ? 'rgba(255,255,255,0.07)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 16, background: dm.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'white', fontFamily: 'var(--g-sans)' }}>
                  {dm.handle[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--g-sans)', fontSize: 12, fontWeight: hasUnread ? 600 : 500, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dm.handle}
                  </div>
                  <div style={{ fontFamily: 'var(--g-sans)', fontSize: 10.5, color: hasUnread ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dm.msg}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                  <span style={{ fontFamily: 'var(--g-sans)', fontSize: 9.5, color: 'rgba(255,255,255,0.28)' }}>
                    {dm.time}
                  </span>
                  {hasUnread && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        background: 'linear-gradient(135deg, #833ab4, #fd1d1d)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Thread */}
      <div className="demo-thread" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: activeDm.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'white', fontFamily: 'var(--g-sans)' }}>
            {activeDm.handle[0].toUpperCase()}
          </div>
          <span style={{ fontFamily: 'var(--g-sans)', fontSize: 13, fontWeight: 600, color: 'white' }}>{activeDm.handle}</span>
        </div>

        <div style={{ flex: 1, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto' }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeChat} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {thread.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.them ? 'flex-start' : 'flex-end' }}>
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: '7px 11px',
                      borderRadius: msg.them ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                      background: msg.them ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #833ab4, #fd1d1d)',
                      fontFamily: 'var(--g-sans)',
                      fontSize: 12.5,
                      color: 'white',
                      lineHeight: 1.4,
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <input
            value={composerText}
            onChange={(e) => handleType(e.target.value)}
            placeholder="Message..."
            style={{
              width: '100%',
              height: 34,
              borderRadius: 17,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              outline: 'none',
              padding: '0 14px',
              fontFamily: 'var(--g-sans)',
              fontSize: 12.5,
              color: 'white',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Story overlay */}
      <AnimatePresence>
        {storyOpen && <InstagramStoryViewer onClose={() => setStoryOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

/* ── Demo section ────────────────────────────────────── */
export function DemoSection() {
  const [platform, setPlatform] = useState<Platform>('messenger');
  const [controls, setControls] = useState<Controls>({
    instagram: { seen: true, typing: true, story: true },
    messengerFacebook: { seen: true, typing: true, story: true },
  });
  const [msgrUnread, setMsgrUnread] = useState<Record<string, boolean>>({ alex: true });
  const [fbUnread, setFbUnread] = useState<Record<string, boolean>>({ natalie: true });
  const [igUnread, setIgUnread] = useState<Record<string, boolean>>({ marco: true });
  const [fbStorySeen, setFbStorySeen] = useState<Record<string, boolean>>({});
  const [igStorySeen, setIgStorySeen] = useState<Record<string, boolean>>({});

  const handleToggle = (group: ControlGroup, key: string, value: boolean) => {
    setControls((prev) => ({
      ...prev,
      [group]: { ...prev[group], [key]: value },
    }));
  };

  const getActiveControls = () =>
    platform === 'instagram' ? controls.instagram : controls.messengerFacebook;

  const handleType = (signal: TypingSignal) => {
    const ctrl = getActiveControls();
    if (ctrl.typing) {
      dispatchMascot(`typing-${signal}`);
    } else if (signal === 'start') {
      dispatchMascot('feature-off');
    }
  };

  const handleOpenChat = (id: string) => {
    const ctrl = getActiveControls();
    if (ctrl.seen) {
      // Ghostify holds receipt — badge stays
      dispatchMascot('chat-open');
    } else {
      // Receipt sent — clear badge
      if (platform === 'messenger') setMsgrUnread(prev => ({ ...prev, [id]: false }));
      if (platform === 'facebook') setFbUnread(prev => ({ ...prev, [id]: false }));
      if (platform === 'instagram') setIgUnread(prev => ({ ...prev, [id]: false }));
      dispatchMascot('feature-off');
    }
  };

  const handleStoryView = (who: string) => {
    const ctrl = getActiveControls();
    if (ctrl.story) {
      dispatchMascot('story-view');
      // Story ring stays colored — view held
    } else {
      // Story view sent — ring turns grey
      if (platform === 'facebook') setFbStorySeen(prev => ({ ...prev, [who]: true }));
      if (platform === 'instagram') setIgStorySeen(prev => ({ ...prev, [who]: true }));
      dispatchMascot('feature-off');
    }
  };

  const tabs: { id: Platform; label: string; url: string }[] = [
    { id: 'messenger', label: 'Messenger', url: 'messenger.com' },
    { id: 'facebook', label: 'Facebook', url: 'facebook.com' },
    { id: 'instagram', label: 'Instagram', url: 'instagram.com' },
  ];

  const PLATFORM_COLORS = { messenger: '#0082FB', facebook: '#1877F2', instagram: '#E1306C' };

  return (
    <section
      id="demo"
      className="snap-start demo-section"
      style={{
        padding: 'clamp(60px, 10vw, 100px) 28px',
        maxWidth: 1440,
        margin: '0 auto',
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {/* Section heading */}
      <div className="demo-section-heading" style={{ marginBottom: 36 }}>
        <div
          style={{
            fontFamily: 'var(--g-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--g-dim)',
            marginBottom: 10,
          }}
        >
          Interactive demo
        </div>
        <h2
          style={{
            fontFamily: 'var(--g-sans)',
            fontSize: 'clamp(1.4rem, 2.2vw, 1.9rem)',
            fontWeight: 500,
            color: 'var(--g-white)',
            margin: 0,
            lineHeight: 1.2,
            letterSpacing: 0,
          }}
        >
          Try it. Switch surfaces. Toggle controls.
        </h2>
      </div>

      {/* Browser chrome wrapper */}
      <div
        className="demo-browser"
        style={{
          background: '#1C1A17',
          borderRadius: 12,
          border: '1px solid rgba(240,230,210,0.08)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Window chrome */}
        <div style={{ height: 36, background: '#141210', borderBottom: '1px solid rgba(240,230,210,0.06)', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: '#FF5F57' }} />
            <div style={{ width: 10, height: 10, borderRadius: 5, background: '#FFBD2E' }} />
            <div style={{ width: 10, height: 10, borderRadius: 5, background: '#28CA41' }} />
          </div>
        </div>

        {/* Tab bar */}
        <div className="demo-tabbar" style={{ background: '#141210', display: 'flex', alignItems: 'flex-end', padding: '0 12px', height: 32 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className="demo-tab-button"
              onClick={() => setPlatform(tab.id)}
              style={{
                height: 26,
                padding: '0 14px',
                borderRadius: '5px 5px 0 0',
                background: platform === tab.id ? '#1C1A17' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                fontFamily: 'var(--g-sans)',
                fontSize: 11,
                color: platform === tab.id ? 'rgba(240,230,210,0.85)' : 'rgba(240,230,210,0.32)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: 4, background: PLATFORM_COLORS[tab.id], opacity: platform === tab.id ? 1 : 0.35 }} />
              {tab.label}
            </button>
          ))}

          {/* Address bar filler */}
          <div className="demo-address" style={{ flex: 1, display: 'flex', alignItems: 'center', paddingBottom: 4, paddingLeft: 12 }}>
            <div style={{ flex: 1, height: 20, borderRadius: 10, background: 'rgba(240,230,210,0.04)', border: '1px solid rgba(240,230,210,0.05)', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 5 }}>
              <Globe size={9} color="rgba(240,230,210,0.25)" />
              <span style={{ fontFamily: 'var(--g-mono)', fontSize: 9.5, color: 'rgba(240,230,210,0.3)' }}>
                {tabs.find((t) => t.id === platform)?.url}
              </span>
            </div>
          </div>

          {/* Extension icon */}
          <div className="demo-extension-tab-icon" style={{ paddingBottom: 6, paddingLeft: 8, display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(196,72,48,0.18)', border: '1px solid rgba(196,72,48,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GhostMark size={12} />
            </div>
          </div>
        </div>

        {/* Content area: platform UI + ghostify panel */}
        <div className="demo-content" style={{ display: 'flex', height: 480 }}>
          {/* Platform view */}
          <div className="demo-platform" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={platform}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{ height: '100%' }}
              >
                {platform === 'messenger' && (
                  <MessengerView
                    unreadMap={msgrUnread}
                    onOpenChat={handleOpenChat}
                    onType={handleType}
                  />
                )}
                {platform === 'facebook' && (
                  <FacebookView
                    controls={controls.messengerFacebook}
                    unreadMap={fbUnread}
                    onOpenChat={handleOpenChat}
                    onStoryView={handleStoryView}
                    storyViewedSet={fbStorySeen}
                    onType={handleType}
                  />
                )}
                {platform === 'instagram' && (
                  <InstagramView
                    controls={controls.instagram}
                    unreadMap={igUnread}
                    onOpenChat={handleOpenChat}
                    onStoryView={handleStoryView}
                    storyViewedSet={igStorySeen}
                    onType={handleType}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Ghostify panel */}
          <div
            className="demo-panel"
            style={{
              padding: '12px 12px 12px 0',
              borderLeft: '1px solid rgba(240,230,210,0.05)',
              background: '#141210',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'flex-start',
              paddingLeft: 12,
            }}
          >
            <GhostifyPanel
              platform={platform}
              controls={controls}
              onToggle={handleToggle}
            />
          </div>
        </div>
      </div>

      <p
        style={{
          fontFamily: 'var(--g-mono)',
          fontSize: 11,
          color: 'var(--g-dim)',
          textAlign: 'center',
          marginTop: 16,
          letterSpacing: '0.04em',
        }}
      >
        Toggle controls · type in a composer · open a story — watch the ghost react
      </p>

      <style>{`
        @media (max-width: 900px) {
          .demo-section {
            padding-left: clamp(18px, 4vw, 28px) !important;
            padding-right: clamp(18px, 4vw, 28px) !important;
          }
          .demo-content {
            height: 440px !important;
          }
          .demo-chat-list-messenger {
            width: 180px !important;
            flex-basis: 180px !important;
          }
          .demo-chat-list-facebook {
            width: 190px !important;
            flex-basis: 190px !important;
          }
          .demo-chat-list-instagram {
            width: 168px !important;
            flex-basis: 168px !important;
          }
        }
        @media (max-width: 640px) {
          .demo-section {
            min-height: auto !important;
            justify-content: flex-start !important;
            padding: 76px 18px 52px !important;
          }
          .demo-section-heading {
            margin-bottom: 22px !important;
          }
          .demo-browser {
            border-radius: 10px !important;
          }
          .demo-toggle::before,
          .demo-tab-button::before {
            content: "";
            position: absolute;
            inset: -10px -7px;
          }
          .demo-tabbar {
            padding: 0 8px !important;
            overflow: hidden !important;
          }
          .demo-tab-button {
            padding: 0 8px !important;
            font-size: 10.5px !important;
            min-width: 0 !important;
          }
          .demo-address {
            display: none !important;
          }
          .demo-extension-tab-icon {
            margin-left: auto !important;
            padding-left: 6px !important;
          }
          .demo-content { flex-direction: column !important; height: auto !important; }
          .demo-platform {
            flex: 0 0 min(58svh, 440px) !important;
            height: min(58svh, 440px) !important;
            min-height: min(360px, 58svh) !important;
          }
          .demo-panel {
            border-left: none !important;
            border-top: 1px solid rgba(240,230,210,0.05) !important;
            padding: 12px !important;
            justify-content: center !important;
          }
          .demo-chat-list {
            width: 124px !important;
            flex-basis: 124px !important;
          }
          .demo-chat-list-messenger {
            width: 128px !important;
            flex-basis: 128px !important;
          }
          .demo-chat-list-facebook {
            width: 130px !important;
            flex-basis: 130px !important;
          }
          .demo-chat-list-instagram {
            width: 118px !important;
            flex-basis: 118px !important;
          }
          .demo-ig-rail {
            width: 38px !important;
            flex-basis: 38px !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          .demo-thread {
            min-width: 0 !important;
            flex: 1 1 auto !important;
          }
        }
        @media (max-width: 430px) {
          .demo-section {
            padding-left: 14px !important;
            padding-right: 14px !important;
          }
          .demo-platform {
            flex-basis: min(54svh, 420px) !important;
            height: min(54svh, 420px) !important;
            min-height: min(330px, 54svh) !important;
          }
          .demo-chat-list {
            width: 116px !important;
            flex-basis: 116px !important;
          }
          .demo-chat-list-messenger,
          .demo-chat-list-facebook {
            width: 120px !important;
            flex-basis: 120px !important;
          }
          .demo-chat-list-instagram {
            width: 112px !important;
            flex-basis: 112px !important;
          }
          .demo-ig-rail {
            width: 34px !important;
            flex-basis: 34px !important;
          }
          .demo-tab-button {
            padding: 0 7px !important;
            font-size: 10px !important;
          }
        }
        @media (max-width: 360px) {
          .demo-tab-button {
            padding: 0 5px !important;
            font-size: 9.5px !important;
          }
          .demo-chat-list,
          .demo-chat-list-messenger,
          .demo-chat-list-facebook {
            width: 108px !important;
            flex-basis: 108px !important;
          }
          .demo-chat-list-instagram {
            width: 104px !important;
            flex-basis: 104px !important;
          }
        }
      `}</style>
    </section>
  );
}
