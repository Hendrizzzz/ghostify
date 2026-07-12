import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  CircleCheck,
  Code2,
  EyeOff,
  Globe2,
  CirclePlay,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  STATUS_DATA,
  STATUS_LABELS,
  formatStatusDate,
  getLastVerifiedAt,
  getPublicReleaseStatus,
} from '../statusData';
import { GhostMark } from './GhostSVG';
import { PlatformLogo, type MetaPlatform } from './PlatformLogo';
import { EDGE_STORE_URL, GITHUB_URL, StoreCta } from './SiteChrome';

const FEATURES: Array<{
  platform: MetaPlatform;
  name: string;
  title: string;
  body: string;
  src: string;
  width: number;
  height: number;
}> = [
  {
    platform: 'messenger',
    name: 'Messenger',
    title: 'Read it. Leave the reply for later.',
    body: 'Open supported conversations without turning the moment you read into a demand to answer. Ghostify holds the supported Seen signal while Messenger keeps working normally.',
    src: '/messenger-hide-seen.gif',
    width: 864,
    height: 782,
  },
  {
    platform: 'instagram',
    name: 'Instagram',
    title: 'Watch the story. Stay off the list where supported.',
    body: 'Ghostify keeps the story experience intact while holding the supported viewer signal locally. You choose the control; the rest of Instagram stays familiar.',
    src: '/instagram-hide-story.gif',
    width: 859,
    height: 782,
  },
  {
    platform: 'facebook',
    name: 'Facebook',
    title: 'Bring the same quiet control to Facebook.',
    body: 'Supported story-view, typing, and Seen controls share one setting group with Messenger, so the privacy choice follows the way Meta’s web messaging works.',
    src: '/facebook-hide-story.gif',
    width: 844,
    height: 782,
  },
];

const FACTS = [
  'Open source. Read it yourself.',
  'Instagram, Messenger, Facebook.',
  'No Ghostify account required.',
  'Supported tabs only.',
  'Seen, typing, story views.',
  'Preferences stay in your browser.',
];

const PLATFORMS: Array<{
  platform: MetaPlatform;
  name: string;
  url: string;
  qualifier: string;
}> = [
  { platform: 'instagram', name: 'Instagram', url: 'instagram.com', qualifier: 'Its own control group' },
  { platform: 'messenger', name: 'Messenger', url: 'messenger.com', qualifier: 'Shared settings with Facebook' },
  { platform: 'facebook', name: 'Facebook', url: 'facebook.com', qualifier: 'Shared settings with Messenger' },
];

const AI_PROMPT = [
  'Give me an independent assessment of Ghostify, a browser extension for supported Seen, Typing, and Story View controls on Instagram, Messenger, and Facebook.',
  'Review its public website at https://ghostify-extension.vercel.app and source at https://github.com/Hendrizzzz/Ghostify.',
  'Explain what it does, its privacy model, important limitations, and whether its public claims are supported by the available evidence.',
].join(' ');

const AI_LINKS = [
  { name: 'ChatGPT', href: `https://chatgpt.com/?q=${encodeURIComponent(AI_PROMPT)}` },
  { name: 'Claude', href: `https://claude.ai/new?q=${encodeURIComponent(AI_PROMPT)}` },
  { name: 'Perplexity', href: `https://www.perplexity.ai/search/new?q=${encodeURIComponent(AI_PROMPT)}` },
];

const FAQS = [
  {
    q: 'Does Ghostify read my messages?',
    a: 'Ghostify transiently inspects supported request URLs, payloads, and page or worker messages locally to identify privacy signals. It does not send conversations to Ghostify, store raw messages, or ask for social media passwords.',
  },
  {
    q: 'Does it work in the mobile apps?',
    a: 'No. Ghostify is a browser extension for the web versions of Instagram, Facebook, and Messenger. It cannot affect the native iOS or Android apps.',
  },
  {
    q: 'Can I choose different controls for each platform?',
    a: 'Yes. Instagram has its own controls. Messenger and Facebook share a second group, and each supported signal can be switched independently.',
  },
  {
    q: 'Can a platform update break a control?',
    a: 'Yes. Meta changes its web apps frequently. Ghostify publishes dated verification instead of promising permanent coverage and investigates credible reports when a control needs review.',
  },
  {
    q: 'What should I do after installing or updating?',
    a: 'Reload any open instagram.com, messenger.com, or facebook.com tabs so the current extension code starts before the page loads.',
  },
];

function SignalPill({
  label,
  pathId,
  width,
  begin,
  kind,
  compact = false,
}: {
  label: string;
  pathId: string;
  width: number;
  begin: string;
  kind: 'input' | 'output';
  compact?: boolean;
}) {
  const isTyping = label === 'typing';
  const height = compact ? 44 : 36;
  const opacityValues = kind === 'input' ? '0;0;1;1;0;0' : '0;0;1;1;0;0';
  const opacityKeyTimes = kind === 'input'
    ? '0;0.006;0.02;0.25;0.29;1'
    : '0;0.02;0.04;0.2917;0.3194;1';
  return (
    <g className={`signal-svg-pill signal-svg-pill-${kind}${compact ? ' signal-svg-pill-compact' : ''}${isTyping ? ' signal-svg-pill-typing' : ''}`} opacity="0">
      <rect x={width / -2} y={height / -2} width={width} height={height} rx={height / 2} />
      <text x={isTyping ? -12 : 0} textAnchor="middle" dominantBaseline="middle">{label}</text>
      {isTyping && (
        <g className="signal-typing-dots" transform={`translate(${compact ? 25 : 29} 0)`}>
          {[0, 1, 2].map((dot) => (
            <circle cx={dot * 6} cy="0" r="1.8" key={dot} style={{ animationDelay: `${dot * 0.14}s` }} />
          ))}
        </g>
      )}
      <animateMotion
        dur="7.2s"
        begin={begin}
        repeatCount="indefinite"
        calcMode="linear"
        keyPoints="0;1;1"
        keyTimes="0;0.3194;1"
      >
        <mpath href={`#${pathId}`} />
      </animateMotion>
      <animate
        attributeName="opacity"
        values={opacityValues}
        keyTimes={opacityKeyTimes}
        dur="7.2s"
        begin={begin}
        repeatCount="indefinite"
      />
    </g>
  );
}

function SignalDiagram({ compact = false }: { compact?: boolean }) {
  const prefix = compact ? 'signal-compact' : 'signal-desktop';
  const paths = compact
    ? {
        inSeen: 'M62 54C82 142 138 126 200 202',
        inTyping: 'M200 28C200 94 200 148 200 202',
        inStory: 'M338 54C318 142 262 126 200 202',
        outSeen: 'M200 222C224 276 250 304 260 370',
        outTyping: 'M200 222C200 284 200 326 200 388',
        outStory: 'M200 222C176 276 150 304 140 370',
      }
    : {
        inSeen: 'M72 70C300 70 420 145 600 210',
        inTyping: 'M36 210C300 210 440 210 600 210',
        inStory: 'M72 350C300 350 420 275 600 210',
        outSeen: 'M600 210C780 275 900 350 1128 350',
        outTyping: 'M600 210C820 210 970 210 1164 210',
        outStory: 'M600 210C780 145 900 70 1128 70',
      };

  return (
    <svg
      className={`signal-network signal-network-${compact ? 'compact' : 'desktop'}`}
      viewBox={compact ? '0 0 400 420' : '0 0 1200 420'}
      preserveAspectRatio="xMidYMid meet"
    >
        <defs>
          <path id={`${prefix}-in-seen`} d={paths.inSeen} />
          <path id={`${prefix}-in-typing`} d={paths.inTyping} />
          <path id={`${prefix}-in-story`} d={paths.inStory} />
          <path id={`${prefix}-out-seen`} d={paths.outSeen} />
          <path id={`${prefix}-out-typing`} d={paths.outTyping} />
          <path id={`${prefix}-out-story`} d={paths.outStory} />
          <clipPath id={`${prefix}-input-clip`}>
            <rect x="0" y="0" width={compact ? 400 : 604} height={compact ? 210 : 420} />
          </clipPath>
          <linearGradient
            id={`${prefix}-output-zone-fill`}
            x1={compact ? '200' : '600'}
            y1={compact ? '210' : '210'}
            x2={compact ? '200' : '1200'}
            y2={compact ? '420' : '210'}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#8b70dd" stopOpacity="0.13" />
            <stop offset="1" stopColor="#8b70dd" stopOpacity="0.025" />
          </linearGradient>
          <linearGradient
            id={`${prefix}-output-band-stroke`}
            x1={compact ? '200' : '600'}
            y1={compact ? '210' : '210'}
            x2={compact ? '200' : '1200'}
            y2={compact ? '420' : '210'}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#8b70dd" stopOpacity="0.18" />
            <stop offset="1" stopColor="#8b70dd" stopOpacity="0.045" />
          </linearGradient>
        </defs>

        <path
          className="signal-output-zone"
          fill={`url(#${prefix}-output-zone-fill)`}
          d={compact
            ? 'M200 210C154 268 94 318 38 398C140 378 260 378 362 398C306 318 246 268 200 210Z'
            : 'M600 210C760 116 930 34 1180 44C1210 148 1210 272 1180 376C930 386 760 304 600 210Z'}
        />

        <g className="signal-output-bands" stroke={`url(#${prefix}-output-band-stroke)`}>
          <use href={`#${prefix}-out-seen`} />
          <use href={`#${prefix}-out-typing`} />
          <use href={`#${prefix}-out-story`} />
        </g>

        <g className="signal-network-lines">
          <use href={`#${prefix}-in-seen`} /><use href={`#${prefix}-in-typing`} /><use href={`#${prefix}-in-story`} />
          <use href={`#${prefix}-out-seen`} />
          <use href={`#${prefix}-out-typing`} />
          <use href={`#${prefix}-out-story`} />
        </g>

        <g className="signal-route-nodes">
          {compact ? (
            <>
              <circle cx="62" cy="54" r="4" /><circle cx="200" cy="28" r="4" /><circle cx="338" cy="54" r="4" />
              <circle className="signal-route-node-output" cx="260" cy="370" r="4" /><circle className="signal-route-node-output" cx="200" cy="388" r="4" /><circle className="signal-route-node-output" cx="140" cy="370" r="4" />
            </>
          ) : (
            <>
              <circle cx="72" cy="70" r="5" /><circle cx="36" cy="210" r="5" /><circle cx="72" cy="350" r="5" />
              <circle className="signal-route-node-output" cx="1128" cy="350" r="5" /><circle className="signal-route-node-output" cx="1164" cy="210" r="5" /><circle className="signal-route-node-output" cx="1128" cy="70" r="5" />
            </>
          )}
        </g>

        <g className="signal-motion">
          <g clipPath={`url(#${prefix}-input-clip)`}>
            <SignalPill label="seen" pathId={`${prefix}-in-seen`} width={compact ? 70 : 104} begin="-7.2s" kind="input" compact={compact} />
            <SignalPill label="story-view" pathId={`${prefix}-in-story`} width={compact ? 104 : 150} begin="-6s" kind="input" compact={compact} />
            <SignalPill label="typing" pathId={`${prefix}-in-typing`} width={compact ? 108 : 150} begin="-4.8s" kind="input" compact={compact} />
            <SignalPill label="seen" pathId={`${prefix}-in-seen`} width={compact ? 70 : 104} begin="-3.6s" kind="input" compact={compact} />
            <SignalPill label="story-view" pathId={`${prefix}-in-story`} width={compact ? 104 : 150} begin="-2.4s" kind="input" compact={compact} />
            <SignalPill label="typing" pathId={`${prefix}-in-typing`} width={compact ? 108 : 150} begin="-1.2s" kind="input" compact={compact} />
          </g>

          <g>
            <SignalPill label="seen-receipt blocked" pathId={`${prefix}-out-seen`} width={compact ? 164 : 205} begin="-4.9s" kind="output" compact={compact} />
            <SignalPill label="story-view blocked" pathId={`${prefix}-out-story`} width={compact ? 158 : 190} begin="-3.7s" kind="output" compact={compact} />
            <SignalPill label="typing blocked" pathId={`${prefix}-out-typing`} width={compact ? 132 : 160} begin="-2.5s" kind="output" compact={compact} />
            <SignalPill label="seen-receipt blocked" pathId={`${prefix}-out-seen`} width={compact ? 164 : 205} begin="-1.3s" kind="output" compact={compact} />
            <SignalPill label="story-view blocked" pathId={`${prefix}-out-story`} width={compact ? 158 : 190} begin="-0.1s" kind="output" compact={compact} />
            <SignalPill label="typing blocked" pathId={`${prefix}-out-typing`} width={compact ? 132 : 160} begin="-6.1s" kind="output" compact={compact} />
          </g>
        </g>

        <g className="signal-static-labels">
          {compact ? (
            <><text x="62" y="50">seen</text><text x="200" y="24">typing</text><text x="338" y="50">story-view</text>
            <text x="260" y="388">seen-receipt blocked</text><text x="200" y="410">typing blocked</text><text x="140" y="388">story-view blocked</text></>
          ) : (
            <><text x="72" y="58">seen</text><text x="36" y="196">typing</text><text x="72" y="338">story-view</text>
            <text x="1128" y="338">seen-receipt blocked</text><text x="1164" y="196">typing blocked</text><text x="1128" y="58">story-view blocked</text></>
          )}
        </g>
      </svg>
  );
}

function HeroSignalFlow() {
  return (
    <div className="hero-signal-flow" aria-hidden="true">
      <SignalDiagram />
      <SignalDiagram compact />

      <div className="signal-processor">
        <GhostMark size={148} bodyColor="#0f0f0d" eyeColor="#ffffff" />
      </div>
    </div>
  );
}

function HeroDetails() {
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse), (prefers-reduced-motion: reduce)').matches) return;
    const details = detailsRef.current;
    if (!details) return;
    const tiles = Array.from(details.querySelectorAll<HTMLElement>('.hero-detail'));
    let frame = 0;
    const update = (event: PointerEvent) => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const x = event.clientX / window.innerWidth - 0.5;
        const y = event.clientY / window.innerHeight - 0.5;
        const detailsBox = details.getBoundingClientRect();
        tiles.forEach((tile, index) => {
          const depth = 7 + (index % 4) * 3;
          const centerX = detailsBox.left + tile.offsetLeft + tile.offsetWidth / 2;
          const centerY = detailsBox.top + tile.offsetTop + tile.offsetHeight / 2;
          const dx = centerX - event.clientX;
          const dy = centerY - event.clientY;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const proximity = Math.max(0, 1 - distance / 150);
          const repel = proximity * proximity * 34;
          const repelX = dx / distance * repel;
          const repelY = dy / distance * repel;
          tile.style.setProperty('--mouse-x', `${(x * depth + repelX).toFixed(2)}px`);
          tile.style.setProperty('--mouse-y', `${(y * depth + repelY).toFixed(2)}px`);
          tile.classList.toggle('is-avoiding', proximity > 0.12);
        });
      });
    };
    const reset = () => tiles.forEach((tile) => {
      tile.style.setProperty('--mouse-x', '0px');
      tile.style.setProperty('--mouse-y', '0px');
      tile.classList.remove('is-avoiding');
    });
    window.addEventListener('pointermove', update, { passive: true });
    document.documentElement.addEventListener('mouseleave', reset);
    return () => {
      window.removeEventListener('pointermove', update);
      document.documentElement.removeEventListener('mouseleave', reset);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="hero-details" aria-hidden="true" ref={detailsRef}>
      <span className="hero-detail hero-detail-instagram"><i className="hero-detail-stage"><PlatformLogo platform="instagram" size={34} /></i></span>
      <span className="hero-detail hero-detail-messenger"><i className="hero-detail-stage"><PlatformLogo platform="messenger" size={36} /></i></span>
      <span className="hero-detail hero-detail-facebook"><i className="hero-detail-stage"><PlatformLogo platform="facebook" size={36} /></i></span>
      <span className="hero-detail hero-detail-seen"><i className="hero-detail-stage"><EyeOff size={27} /></i></span>
      <span className="hero-detail hero-detail-typing"><i className="hero-detail-stage"><MessageCircle size={27} /></i></span>
      <span className="hero-detail hero-detail-story"><i className="hero-detail-stage"><CirclePlay size={28} /></i></span>
      <span className="hero-detail hero-detail-local"><i className="hero-detail-stage"><ShieldCheck size={27} /></i></span>
      <span className="hero-detail hero-detail-browser"><i className="hero-detail-stage"><img src="/edge-current.svg" alt="" /></i></span>
      <span className="hero-detail hero-detail-chrome"><i className="hero-detail-stage"><img src="/chrome-current.svg" alt="" /></i></span>
      <span className="hero-detail hero-detail-brave"><i className="hero-detail-stage"><img src="/brave-current.svg?v=2" alt="" /></i></span>
      <span className="hero-detail hero-detail-opera"><i className="hero-detail-stage"><img src="/opera-current.svg?v=2" alt="" /></i></span>
      <span className="hero-detail hero-detail-arc"><i className="hero-detail-stage"><img src="/arc-current.svg" alt="" /></i></span>
      <span className="hero-detail hero-detail-vivaldi"><i className="hero-detail-stage"><img src="/vivaldi-current.svg" alt="" /></i></span>
    </div>
  );
}

function PlatformControlMap() {
  return (
    <div className="platform-control-map" aria-label="Instagram has its own controls. Messenger and Facebook share a control group.">
      <div className="control-map-lane control-map-lane-own">
        <span className="control-map-logo"><PlatformLogo platform="instagram" size={30} /></span>
        <i aria-hidden="true" />
        <span className="control-map-label"><b>Own controls</b><small>Instagram</small></span>
      </div>
      <div className="control-map-lane control-map-lane-shared">
        <span className="control-map-logo"><PlatformLogo platform="messenger" size={30} /></span>
        <i aria-hidden="true" />
        <span className="control-map-label"><b>Shared group</b><small>one switch state</small></span>
        <i aria-hidden="true" />
        <span className="control-map-logo"><PlatformLogo platform="facebook" size={30} /></span>
      </div>
    </div>
  );
}

function PrivacyIllustration() {
  return (
    <div className="privacy-illustration" aria-hidden="true">
      <div className="privacy-browser">
        <div className="privacy-browser-bar">
          <span className="privacy-window-dots"><i /><i /><i /></span>
          <span className="privacy-browser-url"><LockKeyhole size={11} /> supported tab</span>
        </div>
        <div className="privacy-browser-body">
          <div className="privacy-signal-list">
            <span><EyeOff size={15} /><b>Seen receipt</b><CircleCheck size={15} /></span>
            <span><MessageCircle size={15} /><b>Typing signal</b><CircleCheck size={15} /></span>
            <span><CirclePlay size={15} /><b>Story view</b><CircleCheck size={15} /></span>
          </div>
          <span className="privacy-browser-ghost"><GhostMark size={76} bodyColor="#0f0f0d" eyeColor="#ffffff" /></span>
        </div>
      </div>
      <span className="privacy-visual-chip privacy-visual-chip-local">stays local</span>
      <span className="privacy-visual-chip privacy-visual-chip-account">no account</span>
    </div>
  );
}

function FactMarquee() {
  return (
    <section className="fact-marquee" aria-label="Ghostify facts">
      <div className="fact-marquee-track">
        {[0, 1].map((copy) => (
          <div className="fact-marquee-group" aria-hidden={copy === 1 ? 'true' : undefined} key={copy}>
            {FACTS.map((fact) => (
              <span key={fact}><i aria-hidden="true" />{fact}</span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function FootprintSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const hasRun = useRef(false);
  const [packageSize, setPackageSize] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let frame = 0;
    const finish = () => setPackageSize(258.8);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || hasRun.current) return;
      hasRun.current = true;
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / 1600);
        setPackageSize(258.8 * progress);
        if (progress < 1) frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
      observer.disconnect();
    }, { threshold: 0.35 });
    observer.observe(section);
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const runtimeSize = packageSize * (36.5 / 258.8);

  return (
    <section className="footprint-section" ref={sectionRef}>
      <header>
        <h2>Small enough to stay out of the way.</h2>
        <p>Measured from the current 2.0.4 build—not an old marketing number.</p>
      </header>
      <div className="footprint-metrics">
        <article><strong>{packageSize.toFixed(1)}<span>KiB</span></strong><small>installed package</small></article>
        <article><strong>{runtimeSize.toFixed(1)}<span>KiB</span></strong><small>runtime JavaScript, gzip</small></article>
        <article><strong>0</strong><small>tracking relays</small></article>
        <article><strong>0</strong><small>Ghostify accounts required</small></article>
      </div>
    </section>
  );
}

function FeatureSignalRail({ platform }: { platform: MetaPlatform }) {
  const focus = platform === 'messenger' ? 'seen' : 'story';
  const signals = [
    { key: 'seen', label: 'Seen', icon: <EyeOff size={15} /> },
    { key: 'typing', label: 'Typing', icon: <MessageCircle size={15} /> },
    { key: 'story', label: 'Story views', icon: <CirclePlay size={15} /> },
  ];

  return (
    <div className={`feature-signal-rail feature-signal-focus-${focus}`} aria-label="Supported controls shown in this recording">
      {signals.map((signal) => (
        <span className={signal.key === focus ? 'is-active' : undefined} key={signal.key}>
          {signal.icon}{signal.label}
        </span>
      ))}
    </div>
  );
}

function FeatureScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeFeature = FEATURES[activeIndex];

  useEffect(() => {
    const preload = () => {
      FEATURES.forEach((feature) => {
        const image = new Image();
        image.src = feature.src;
      });
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(preload, { timeout: 1800 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(preload, 500);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / distance));
      const nextIndex = Math.min(FEATURES.length - 1, Math.round(progress * (FEATURES.length - 1)));
      section.style.setProperty('--feature-progress', progress.toFixed(3));
      setActiveIndex((current) => current === nextIndex ? current : nextIndex);
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    return () => {
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const moveToFeature = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const sectionTop = window.scrollY + section.getBoundingClientRect().top;
    const distance = Math.max(0, section.offsetHeight - window.innerHeight);
    const progress = FEATURES.length === 1 ? 0 : index / (FEATURES.length - 1);
    window.scrollTo({ top: sectionTop + distance * progress, behavior: 'smooth' });
  };

  return (
    <section className="feature-scroll" id="features" ref={sectionRef}>
      <div className="feature-scroll-sticky">
        <div className="feature-scroll-copy">
          <div className="feature-copy-changing" key={`copy-${activeFeature.platform}`}>
            <div className="feature-platform-name">
              <PlatformLogo platform={activeFeature.platform} size={38} />
              <span>{activeFeature.name}</span>
            </div>
            <h2>{activeFeature.title}</h2>
            <p>{activeFeature.body}</p>
          </div>
          <div className="feature-scroll-tools">
            <FeatureSignalRail platform={activeFeature.platform} />
            <a href="/status">See current verification <ArrowUpRight size={16} aria-hidden="true" /></a>
          </div>
        </div>

        <figure className="feature-scroll-media" key={`media-${activeFeature.platform}`}>
          <div className="feature-media-frame">
            <div className="feature-media-meta" aria-hidden="true">
              <span><ShieldCheck size={14} />Signal held before send</span>
              <span><i />Original Ghostify capture</span>
            </div>
            <img
              src={activeFeature.src}
              alt={`${activeFeature.name} running with Ghostify in the browser`}
              width={activeFeature.width}
              height={activeFeature.height}
              decoding="async"
            />
          </div>
        </figure>

        <div className="feature-scroll-nav" role="group" aria-label="Jump to a platform recording">
          {FEATURES.map((feature, index) => (
            <button
              type="button"
              className={index === activeIndex ? 'is-active' : undefined}
              aria-pressed={index === activeIndex}
              onClick={() => moveToFeature(index)}
              key={feature.platform}
            >
              <PlatformLogo platform={feature.platform} size={22} />
              {feature.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mobile-feature-list">
        {FEATURES.map((feature) => (
          <article key={feature.platform} data-platform={feature.platform}>
            <div className="feature-platform-name">
              <PlatformLogo platform={feature.platform} size={34} />
              <span>{feature.name}</span>
            </div>
            <h2>{feature.title}</h2>
            <p>{feature.body}</p>
            <FeatureSignalRail platform={feature.platform} />
            <img
              src={feature.src}
              alt={`${feature.name} running with Ghostify in the browser`}
              width={feature.width}
              height={feature.height}
              loading="lazy"
              decoding="async"
            />
          </article>
        ))}
      </div>
    </section>
  );
}

export function HomePage() {
  const releaseStatus = getPublicReleaseStatus();
  const lastVerified = formatStatusDate(getLastVerifiedAt());

  return (
    <div className="home-page">
      <section className="home-hero">
        <HeroDetails />
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <h1>No <em>seen.</em><br className="hero-title-break" aria-hidden="true" /> No pressure.</h1>
            <p>Ghostify gives you control over supported Seen, Typing, and Story View signals on Instagram, Messenger, and Facebook — directly in your browser.</p>
            <div className="home-hero-actions">
              <StoreCta />
              <a href="#features">See it in action <ArrowDown size={16} aria-hidden="true" /></a>
            </div>
            <p className="home-hero-fineprint">No Ghostify account or social password required.</p>
          </div>

          <div className="home-hero-art">
            <HeroSignalFlow />
          </div>
        </div>
      </section>

      <FeatureScroll />

      <section className="platforms-flat" id="platforms">
        <header>
          <h2>Six switches.<br />Three familiar places.</h2>
          <PlatformControlMap />
        </header>
        <div className="platform-card-grid">
          {PLATFORMS.map((item) => (
            <article className={`platform-card platform-card-${item.platform}`} key={item.platform}>
              <header>
                <PlatformLogo platform={item.platform} size={54} />
                <span><strong>{item.name}</strong><small>{item.url}</small></span>
              </header>
              <div className="platform-card-controls">
                {['Hide Seen', 'Hide Typing', 'Hide Story Views'].map((control) => (
                  <div key={control}><span>{control}</span><i aria-hidden="true"><b /></i></div>
                ))}
              </div>
              <footer><Check size={16} aria-hidden="true" />{item.qualifier}</footer>
            </article>
          ))}
        </div>
        <a className="platforms-status" href="/status">Coverage changes with the platforms. See verification dated {lastVerified}. <ArrowUpRight size={16} aria-hidden="true" /></a>
      </section>

      <section className="privacy-flat" id="privacy">
        <div className="privacy-flat-lead">
          <h2>Local by default.<br />Open to inspection.</h2>
          <div className="privacy-flat-aside">
            <PrivacyIllustration />
            <p>Ghostify checks supported signal traffic inside the browser tab. Conversations are not sent to Ghostify, and the free controls need no Ghostify account.</p>
          </div>
        </div>
        <div className="privacy-flat-points">
          <article>
            <ShieldCheck size={26} aria-hidden="true" />
            <div><h3>You choose each signal.</h3><p>Seen, typing, and story-view controls stay separate.</p></div>
          </article>
          <article>
            <LockKeyhole size={26} aria-hidden="true" />
            <div><h3>Normal browsing stays intact.</h3><p>Messages, navigation, and media continue while supported privacy signals are targeted.</p></div>
          </article>
          <article>
            <Code2 size={26} aria-hidden="true" />
            <div><h3>The evidence is public.</h3><p>Read the source and check dated verification whenever Meta changes its web apps.</p></div>
          </article>
        </div>
        <div className="privacy-flat-links">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"><Code2 size={22} aria-hidden="true" /><span><strong>Read the source</strong>Ghostify Core is MIT licensed.</span><ArrowUpRight size={17} aria-hidden="true" /></a>
          <a href={`${GITHUB_URL}/blob/main/PRIVACY.md`} target="_blank" rel="noopener noreferrer"><LockKeyhole size={22} aria-hidden="true" /><span><strong>Review every permission</strong>See what runs locally and why.</span><ArrowUpRight size={17} aria-hidden="true" /></a>
          <a href="/status"><ShieldCheck size={22} aria-hidden="true" /><span><strong>Check public status</strong>{STATUS_LABELS[releaseStatus]}.</span><ArrowUpRight size={17} aria-hidden="true" /></a>
        </div>
      </section>

      <FootprintSection />
      <FactMarquee />

      <section className="faq-flat">
        <header>
          <h2>Before you install.</h2>
          <p>Plain answers, without the disappearing fine print.</p>
        </header>
        <div className="faq-flat-list">
          {FAQS.map((item) => (
            <details key={item.q}>
              <summary>{item.q}<span aria-hidden="true">+</span></summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="ai-opinion">
        <div>
          <h2>Let your favorite AI take an independent look.</h2>
          <p>Open a ready-made prompt asking it to review Ghostify’s public website, source, privacy model, and current limitations.</p>
          <div className="ai-opinion-actions">
            {AI_LINKS.map((item) => (
              <a href={item.href} target="_blank" rel="noopener noreferrer" key={item.name}>
                Ask {item.name}<ArrowUpRight size={16} aria-hidden="true" />
              </a>
            ))}
          </div>
          <div className="ai-opinion-proof" aria-label="What the prompt asks the AI to review">
            <span><Code2 size={18} aria-hidden="true" />Public source</span>
            <span><LockKeyhole size={18} aria-hidden="true" />Permission boundary</span>
            <span><ShieldCheck size={18} aria-hidden="true" />Dated verification</span>
          </div>
          <span className="ai-opinion-ghost" aria-hidden="true"><GhostMark size={180} /></span>
        </div>
      </section>

      <section className="home-final">
        <div>
          <div className="home-final-badges">
            <span><img className="browser-logo" src="/chrome-current.svg" alt="" />Chrome</span>
            <span><img className="browser-logo" src="/edge-current.svg" alt="" />Edge</span>
            <span><ShieldCheck size={15} aria-hidden="true" />Free</span>
          </div>
          <h2>Ghostify, wherever you browse.</h2>
          <p>Quiet privacy controls for supported Meta web apps, ready in the browser you already use.</p>
          <div className="home-final-actions">
            <StoreCta />
            <a href={EDGE_STORE_URL} target="_blank" rel="noopener noreferrer">Also available for Edge <ArrowUpRight size={15} aria-hidden="true" /></a>
          </div>
          <div className="home-final-details">
            <span><Globe2 size={19} aria-hidden="true" /><b>Web only</b><small>Chrome &amp; Edge</small></span>
            <span><ShieldCheck size={19} aria-hidden="true" /><b>Core controls</b><small>No Ghostify account</small></span>
            <span><Code2 size={19} aria-hidden="true" /><b>Open source</b><small>MIT-licensed Core</small></span>
          </div>
        </div>
      </section>
    </div>
  );
}
