import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  CircleCheck,
  EyeOff,
  CirclePlay,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { formatStatusDate, getLastVerifiedAt } from '../statusData';
import { GhostMark } from './GhostSVG';
import { PlatformLogo, type MetaPlatform } from './PlatformLogo';
import {
  EDGE_STORE_URL,
  FIREFOX_STORE_URL,
  GITHUB_URL,
  StoreCta,
} from './SiteChrome';

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
    title: 'Watch the story. Stay off the list.',
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
  { label: 'Source open', text: 'Read every line.' },
  { label: 'No Ghostify account', text: 'Nothing new to sign into.' },
  { label: 'Narrow access', text: 'Only on supported Meta tabs.' },
  { label: 'Supported signals', text: 'Seen. Typing. Story views.' },
  { label: 'Settings', text: 'Your switches stay on this device.' },
  { label: 'Three places', text: 'Instagram / Messenger / Facebook.' },
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

const AI_PROMPT = 'Is the Ghostify browser extension by Hendrizzzz right for me? Use only its official Chrome Web Store listing, Firefox Add-ons listing, and GitHub documentation. Explain in plain English what it helps me do, what stays on my device, why it needs access to Instagram, Facebook, and Messenger, and its real limitations. Ignore unrelated Ghostify products and third-party directories. Keep it short.';

const AI_LINKS = [
  { name: 'ChatGPT', href: `https://chatgpt.com/?q=${encodeURIComponent(AI_PROMPT)}` },
  { name: 'Claude', href: `https://claude.ai/new?q=${encodeURIComponent(AI_PROMPT)}` },
  { name: 'Perplexity', href: `https://www.perplexity.ai/search/new?q=${encodeURIComponent(AI_PROMPT)}` },
];

const EXTENSION_FOOTPRINT_KIB = 64.57;

const FAQS = [
  {
    q: 'Why does Chrome say Ghostify can read and change data on these sites?',
    a: 'Ghostify needs access to supported Instagram, Messenger, and Facebook tabs so it can identify and hold the privacy signals you switch off. That access is limited to those Meta web apps and Meta’s own web-messaging proxy; Ghostify does not send your conversations, social activity, or tab URLs to a Ghostify server.',
  },
  {
    q: 'Does Ghostify read my messages?',
    a: 'Ghostify transiently inspects supported request URLs, payloads, and page or worker messages locally to identify privacy signals. It does not send conversations to Ghostify, store raw messages, or ask for social media passwords.',
  },
  {
    q: 'Does it work in the mobile apps?',
    a: 'No. Ghostify is a browser extension for the web versions of Instagram, Facebook, and Messenger. It cannot affect the native iOS or Android apps.',
  },
  {
    q: 'Which browsers are officially supported?',
    a: 'Ghostify officially supports Google Chrome, Microsoft Edge, and Mozilla Firefox. Opera, Opera GX, Opera Air, Brave, Vivaldi, Arc, Dia, Yandex Browser, and NAVER Whale may also run the Chrome build when they permit Chrome Web Store extensions, but browser-specific policies can change.',
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

function SignalStreams() {
  return (
    <div className="signal-streams">
      <span className="signal-stream signal-stream-seen">seen</span>
      <span className="signal-stream signal-stream-typing">
        typing
        <i className="signal-stream-dots"><b /><b /><b /></i>
      </span>
      <span className="signal-stream signal-stream-story">story view</span>
    </div>
  );
}

function HeroSignalFlow() {
  const flowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const flow = flowRef.current;
    if (!flow) return;
    let visible = true;
    const sync = () => {
      const shouldPlay = visible && !document.hidden;
      flow.classList.toggle('is-motion-paused', !shouldPlay);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }, { rootMargin: '140px 0px' });
    observer.observe(flow);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return (
    <div className="hero-signal-flow" aria-hidden="true" ref={flowRef}>
      <SignalStreams />

      <div className="signal-processor">
        <span className="signal-catch-ring" />
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
      <span className="hero-detail hero-detail-opera-gx"><i className="hero-detail-stage"><img src="/opera-gx-current.svg" alt="" /></i></span>
      <span className="hero-detail hero-detail-dia"><i className="hero-detail-stage"><img src="/dia-current.svg" alt="" /></i></span>
      <span className="hero-detail hero-detail-opera-air"><i className="hero-detail-stage"><img src="/opera-air-current.svg" alt="" /></i></span>
      <span className="hero-detail hero-detail-yandex"><i className="hero-detail-stage"><img src="/yandex-current.svg" alt="" /></i></span>
      <span className="hero-detail hero-detail-firefox"><i className="hero-detail-stage"><img src="/firefox-current.svg" alt="" /></i></span>
    </div>
  );
}

function PlatformControlMap() {
  return (
    <div className="platform-control-map" aria-label="Instagram has its own controls. Messenger and Facebook share a control group.">
      <article className="control-map-note control-map-note-own">
        <span className="control-map-word" aria-hidden="true">own</span>
        <PlatformLogo platform="instagram" size={36} />
        <span><small>Instagram</small><strong>Its own switches.</strong></span>
      </article>
      <article className="control-map-note control-map-note-shared">
        <span className="control-map-word" aria-hidden="true">together</span>
        <span className="control-map-pair">
          <i><PlatformLogo platform="messenger" size={32} /></i>
          <i><PlatformLogo platform="facebook" size={32} /></i>
        </span>
        <span><small>Messenger + Facebook</small><strong>One shared set.</strong></span>
      </article>
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
          <span className="privacy-browser-ghost"><GhostMark size={82} bodyColor="#f3eee2" eyeColor="#0f0f0d" /></span>
        </div>
      </div>
    </div>
  );
}

const PRIVACY_TOPICS = [
  {
    label: 'Your controls',
    title: 'Each signal stays in your hands.',
    body: 'Seen, typing, and story-view controls remain separate, so you decide exactly what changes.',
    href: `${GITHUB_URL}/blob/main/PRIVACY.md`,
    cta: 'Review every permission',
    external: true,
  },
  {
    label: 'Normal browsing',
    title: 'Privacy without breaking the conversation.',
    body: 'Regression checks cover messages, navigation, and media while supported signals are held back.',
    href: '/status',
    cta: 'See the latest checks',
    external: false,
  },
  {
    label: 'Public evidence',
    title: 'Nothing important is hidden.',
    body: 'The Core source and release history stay public when Meta changes its web apps.',
    href: GITHUB_URL,
    cta: 'Read the source',
    external: true,
  },
];

function PrivacyNoteVisual({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="privacy-note-art privacy-note-art-controls" aria-hidden="true">
        <svg viewBox="0 0 340 166" role="presentation">
          <path className="privacy-art-wash" d="M21 113C54 34 204 10 318 61c-32 70-185 105-297 52Z" />
          <path className="privacy-art-paper" d="m42 35 240-13 18 112-246 14Z" />
          <path className="privacy-art-tape" d="m131 22 63-4 3 16-64 4Z" />
          <g className="privacy-art-slider privacy-art-slider-seen" transform="translate(60 61) rotate(-2)">
            <text x="0" y="5">SEEN</text>
            <path d="M57 0h139" />
            <circle cx="91" cy="0" r="13" />
            <text className="privacy-art-state" x="211" y="5">YOURS</text>
          </g>
          <g className="privacy-art-slider privacy-art-slider-typing" transform="translate(57 94) rotate(1)">
            <text x="0" y="5">TYPING</text>
            <path d="M57 0h139" />
            <circle cx="153" cy="0" r="13" />
            <text className="privacy-art-state" x="211" y="5">YOURS</text>
          </g>
          <g className="privacy-art-slider privacy-art-slider-story" transform="translate(63 126) rotate(-1)">
            <text x="0" y="5">STORY VIEW</text>
            <path d="M57 0h139" />
            <circle cx="125" cy="0" r="13" />
            <text className="privacy-art-state" x="211" y="5">YOURS</text>
          </g>
        </svg>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="privacy-note-art privacy-note-art-conversation" aria-hidden="true">
        <svg viewBox="0 0 340 166" role="presentation">
          <path className="privacy-art-wash" d="M17 101c47-68 193-89 308-20-46 66-204 96-308 20Z" />
          <path className="privacy-chat-route" d="M31 111c60 48 214 49 280-18" />
          <path className="privacy-chat-shape privacy-chat-shape-one" d="M34 27h135a18 18 0 0 1 18 18v35a18 18 0 0 1-18 18H91l-33 24 8-24H34A18 18 0 0 1 16 80V45a18 18 0 0 1 18-18Z" />
          <text className="privacy-chat-label" x="42" y="54">CONVERSATION</text>
          <text className="privacy-chat-copy" x="42" y="77">keeps moving</text>
          <path className="privacy-chat-shape privacy-chat-shape-two" d="M192 45h116a18 18 0 0 1 18 18v28a18 18 0 0 1-18 18h-24l8 24-35-24h-65a18 18 0 0 1-18-18V63a18 18 0 0 1 18-18Z" />
          <text className="privacy-chat-label privacy-chat-label-dark" x="201" y="72">PRIVACY</text>
          <text className="privacy-chat-copy privacy-chat-copy-dark" x="201" y="94">stays local</text>
          <circle className="privacy-chat-route-dot" cx="51" cy="122" r="4" />
          <circle className="privacy-chat-route-dot" cx="290" cy="111" r="4" />
        </svg>
        <span className="privacy-conversation-ghost">
          <GhostMark size={54} bodyColor="#f3eee2" eyeColor="#0f0f0d" />
        </span>
      </div>
    );
  }

  const verifiedDate = formatStatusDate(getLastVerifiedAt()).toUpperCase();

  return (
    <div className="privacy-note-art privacy-note-art-proof" aria-hidden="true">
      <svg viewBox="0 0 340 166" role="presentation">
        <path className="privacy-art-wash" d="M18 113c29-76 183-110 306-54-23 76-188 116-306 54Z" />
        <path className="privacy-art-tape privacy-proof-tape" transform="rotate(2 170 22)" d="m136 14 68-2 1 17-67 2Z" />
        <g className="privacy-proof-sheet privacy-proof-sheet-source" transform="rotate(-7 101 83)">
          <rect x="37" y="35" width="128" height="96" rx="9" />
          <text x="53" y="61">SOURCE</text>
          <text className="privacy-proof-kind" x="53" y="82">CORE</text>
          <path d="M53 96h83M53 108h67M53 120h76" />
        </g>
        <g className="privacy-proof-sheet privacy-proof-sheet-check" transform="rotate(5 191 73)">
          <rect x="127" y="22" width="128" height="102" rx="9" />
          <text x="144" y="50">CHECKS</text>
          <text className="privacy-proof-date" x="144" y="73">{verifiedDate}</text>
          <path className="privacy-proof-tick" d="m188 91 10 10 23-28" />
        </g>
        <g className="privacy-proof-release">
          <path d="m231 49 78 13-12 75-79-14Z" />
          <text x="247" y="83">RELEASES</text>
          <text x="248" y="102">PUBLIC</text>
        </g>
        <circle className="privacy-proof-stamp" cx="282" cy="126" r="24" />
      </svg>
    </div>
  );
}

function PrivacySection() {
  return (
    <section className="privacy-flat" id="privacy" data-scroll-scene>
      <div className="privacy-flat-panel">
        <div className="privacy-showcase-lead">
          <div className="privacy-showcase-copy">
            <h2>Made for privacy<br />that stays <em>yours.</em></h2>
            <p>Three ways Ghostify keeps control close to you.</p>
          </div>
          <div className="privacy-showcase-visual">
            <PrivacyIllustration />
          </div>
        </div>

        <div className="privacy-principles-static" aria-label="Ghostify privacy principles">
          {PRIVACY_TOPICS.map((topic, index) => (
            <article className={`privacy-static-note privacy-static-note-${index + 1}`} key={topic.label}>
              <PrivacyNoteVisual index={index} />
              <h3>{topic.title}</h3>
              <p>{topic.body}</p>
              <a
                href={topic.href}
                target={topic.external ? '_blank' : undefined}
                rel={topic.external ? 'noopener noreferrer' : undefined}
              >
                {topic.cta} <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AnimatedFootprintMetric() {
  const metricRef = useRef<HTMLElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const metric = metricRef.current;
    if (!metric) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setValue(EXTENSION_FOOTPRINT_KIB);
      return;
    }

    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();

      const startedAt = performance.now();
      const update = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / 900);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(EXTENSION_FOOTPRINT_KIB * eased);
        if (progress < 1) frame = window.requestAnimationFrame(update);
      };

      frame = window.requestAnimationFrame(update);
    }, { threshold: 0.45 });

    observer.observe(metric);
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const displayValue = value === 0 ? '0' : value.toFixed(2);

  return (
    <article ref={metricRef} aria-label={`${EXTENSION_FOOTPRINT_KIB.toFixed(2)} KiB extension footprint`}>
      <strong aria-hidden="true">{displayValue}<span>KiB</span></strong>
      <small aria-hidden="true">extension footprint</small>
    </article>
  );
}

function FootprintSection() {
  return (
    <section className="footprint-section" data-scroll-scene>
      <header>
        <h2>Built to stay out of your way.</h2>
        <p>A compact footprint, no tracking relays, and no account standing between you and the controls.</p>
      </header>
      <div className="footprint-metrics">
        <article><strong>MV3</strong><small>extension architecture</small></article>
        <AnimatedFootprintMetric />
        <article><strong>0</strong><small>tracking relays</small></article>
        <article><strong>0</strong><small>Ghostify accounts required</small></article>
      </div>
    </section>
  );
}

function ScrollChoreography() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scenes = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-scene]'));

    if (reducedMotion) {
      scenes.forEach((scene) => scene.style.setProperty('--scene-progress', '0.5'));
      return;
    }

    const sceneStates = scenes.map((scene) => ({ scene, current: 0, target: 0 }));
    const measure = () => {
      sceneStates.forEach((state) => {
        const { scene } = state;
        const rect = scene.getBoundingClientRect();
        const distance = window.innerHeight + rect.height;
        const progress = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / Math.max(1, distance)));
        state.target = progress;
      });
    };

    measure();
    sceneStates.forEach((state) => {
      state.current = state.target;
      state.scene.style.setProperty('--scene-progress', state.current.toFixed(3));
    });

    let frame = 0;
    let needsMeasure = false;
    let lastTime = performance.now();
    const update = (now: number) => {
      frame = 0;
      if (needsMeasure) {
        measure();
        needsMeasure = false;
      }

      const elapsed = Math.min(64, Math.max(0, now - lastTime));
      const blend = 1 - Math.exp(-elapsed / 150);
      let isSettling = false;
      sceneStates.forEach((state) => {
        const difference = state.target - state.current;
        if (Math.abs(difference) > 0.0005) {
          state.current += difference * blend;
          isSettling = true;
        } else {
          state.current = state.target;
        }
        state.scene.style.setProperty('--scene-progress', state.current.toFixed(3));
      });
      lastTime = now;
      if (isSettling) frame = window.requestAnimationFrame(update);
    };
    const requestUpdate = () => {
      needsMeasure = true;
      if (!frame) {
        lastTime = performance.now();
        frame = window.requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    return () => {
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}

function FactMarquee() {
  const marqueeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const marquee = marqueeRef.current;
    if (!marquee) return;
    const track = marquee.querySelector<HTMLElement>('.fact-marquee-track');
    if (!track) return;
    let visible = true;
    const sync = () => {
      track.style.animationPlayState = visible && !document.hidden ? 'running' : 'paused';
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }, { rootMargin: '120px 0px' });
    observer.observe(marquee);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return (
    <section className="fact-marquee" aria-label="Ghostify at a glance" ref={marqueeRef}>
      <div className="fact-marquee-signature">
        <GhostMark size={42} bodyColor="#d8d2ff" eyeColor="#0f0f0d" />
        <span><small>Ghostify</small><strong>quiet by design.</strong></span>
      </div>
      <div className="fact-marquee-viewport">
        <div className="fact-marquee-track">
          {[0, 1].map((copy) => (
            <div className="fact-marquee-group" aria-hidden={copy === 1 ? 'true' : undefined} key={copy}>
              {FACTS.map(({ label, text }) => (
                <span className="fact-marquee-phrase" key={label}>
                  <small>{label}</small>
                  <strong>{text}</strong>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InstallRhythm() {
  return (
    <section className="install-rhythm" aria-labelledby="install-rhythm-title" data-scroll-scene>
      <header>
        <h2 id="install-rhythm-title">One minute.<br />Then it disappears.</h2>
        <p>Four small moves, then Ghostify settles into the background.</p>
      </header>
      <div className="install-rhythm-path">
        <span className="install-path-line" aria-hidden="true"><i /></span>
        <span className="install-path-ghost" aria-hidden="true"><GhostMark size={58} bodyColor="#0f0f0d" eyeColor="#f3eee2" /></span>
        <ol>
        <li><span>01</span><div><strong>Add Ghostify</strong><small>Install from Chrome, Edge, or Firefox.</small></div></li>
        <li><span>02</span><div><strong>Pin Ghostify</strong><small>Open Extensions, then pin Ghostify for quick access.</small></div></li>
        <li><span>03</span><div><strong>Reload your Meta tabs</strong><small>Let Ghostify start before the page does.</small></div></li>
        <li><span>04</span><div><strong>Choose your quiet</strong><small>Switch Seen, Typing, and Story Views independently.</small></div></li>
        </ol>
      </div>
    </section>
  );
}

function AskAiSection() {
  return (
    <section className="ask-ai-section" data-scroll-scene>
      <div className="ask-ai-card">
        <div className="ask-ai-composition">
          <div className="ask-ai-copy">
            <div className="ask-ai-lead">
              <h2>Don&apos;t take<br />our word for it.</h2>
              <p>Open a prepared question in the model you already use. It asks for a plain-English answer grounded in Ghostify&apos;s public documentation.</p>
            </div>
            <nav className="ask-ai-actions" aria-label="Ask an AI assistant about Ghostify">
              {AI_LINKS.map((item) => (
                <a href={item.href} target="_blank" rel="noopener noreferrer" key={item.name}>
                  <strong>Ask {item.name}</strong>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </a>
              ))}
            </nav>
          </div>
          <div className="ask-ai-visual" aria-hidden="true">
            <div className="ask-ai-source-stack">
              <span className="ask-ai-tape" />
              <div className="ask-ai-question-sheet">
                <div className="ask-ai-sheet-meta">
                  <span>Prepared question</span>
                  <span>Public documentation</span>
                </div>
                <strong>Explain Ghostify<br />in plain English.</strong>
                <div className="ask-ai-source-list">
                  <span>Store listings</span>
                  <span>Public source</span>
                  <span>Known limits</span>
                </div>
              </div>
              <div className="ask-ai-source-tab">
                <small>Sources</small>
                <strong>attached</strong>
              </div>
            </div>
            <span className="ask-ai-ghost"><GhostMark size={112} /></span>
          </div>
        </div>
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
  const signalNote = activeFeature.platform === 'messenger' ? 'Seen stays here.' : 'Story view stays here.';
  const atmosphereWord = activeFeature.platform === 'messenger'
    ? 'held'
    : activeFeature.platform === 'instagram'
      ? 'quiet'
      : 'local';

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
      <div className="feature-scroll-sticky" data-atmosphere={atmosphereWord}>
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
            <div className={`feature-signal-note feature-signal-note-${activeFeature.platform}`} aria-hidden="true">
              <span className="feature-note-source"><PlatformLogo platform={activeFeature.platform} size={25} /><small>{activeFeature.name} on the web</small></span>
              <strong>{signalNote}</strong>
            </div>
            <div className={`feature-media-crop feature-media-crop-${activeFeature.platform}`}>
              <img
                src={activeFeature.src}
                alt={`${activeFeature.name} running with Ghostify in the browser`}
                width={activeFeature.width}
                height={activeFeature.height}
                decoding="async"
              />
            </div>
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
  const lastVerified = formatStatusDate(getLastVerifiedAt());

  return (
    <div className="home-page">
      <ScrollChoreography />
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
          </div>

          <div className="home-hero-art">
            <HeroSignalFlow />
          </div>
        </div>
      </section>

      <FeatureScroll />

      <section className="platforms-flat" id="platforms" data-scroll-scene>
        <header>
          <h2>Three controls.<br /><span>Two groups. Three places.</span></h2>
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

      <PrivacySection />

      <FootprintSection />
      <InstallRhythm />
      <FactMarquee />

      <section className="faq-flat" data-scroll-scene>
        <header>
          <h2>Before you install.</h2>
          <p>Plain answers, without the disappearing fine print.</p>
        </header>
        <div className="faq-flat-list">
          {FAQS.map((item, index) => (
            <details key={item.q}>
              <summary>
                <span className="faq-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <strong className="faq-question">{item.q}</strong>
                <span className="faq-toggle" aria-hidden="true"><i /><i /></span>
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <AskAiSection />

      <section className="home-final" data-scroll-scene>
        <div>
          <h2>
            <span className="home-final-brand">Ghostify,</span>
            <span className="home-final-promise">wherever you browse.</span>
          </h2>
          <p>Quiet privacy controls for supported Meta web apps, available for Chrome, Edge, and Firefox.</p>
          <div className="home-final-actions">
            <StoreCta />
            <a className="browser-store-link" href={EDGE_STORE_URL} target="_blank" rel="noopener noreferrer">
              <img className="browser-logo" src="/edge-current.svg" alt="" />
              Get for Edge
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            <a className="browser-store-link" href={FIREFOX_STORE_URL} target="_blank" rel="noopener noreferrer">
              <img className="browser-logo" src="/firefox-current.svg" alt="" />
              Get for Firefox
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
