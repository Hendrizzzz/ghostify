import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  CircleCheck,
  EyeOff,
  CirclePlay,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { formatStatusDate, getLastVerifiedAt } from '../statusData';
import { GhostMark } from './GhostSVG';
import { PlatformLogo, type MetaPlatform } from './PlatformLogo';
import { Reveal } from './Reveal';
import { SignalCatchScene } from '../animation/SignalCatchScene';
import { GhostJourney } from '../animation/GhostJourney';
import { LandingChoreography } from '../animation/LandingChoreography';
import { PlatformsDeck } from '../animation/PlatformsDeck';
import { InstallRhythmScene } from '../animation/InstallRhythmScene';
import { FaqAskAiScene } from '../animation/FaqAskAiScene';
import { EDGE_STORE_URL, FIREFOX_STORE_URL, GITHUB_URL, StoreCta } from './SiteChrome';

const FEATURES: Array<{
  platform: MetaPlatform;
  name: string;
  title: string;
  body: string;
  webm: string;
  mp4: string;
  poster: string;
  width: number;
  height: number;
}> = [
  {
    platform: 'messenger',
    name: 'Messenger',
    title: 'Read it. Leave the reply for later.',
    body: 'Read the message when it arrives; reply when it suits you. Ghostify holds the Seen signal in your browser while Messenger keeps working normally.',
    webm: '/media/messenger-hide-seen.webm',
    mp4: '/media/messenger-hide-seen.mp4',
    poster: '/media/messenger-hide-seen-poster.webp',
    width: 864,
    height: 782,
  },
  {
    platform: 'instagram',
    name: 'Instagram',
    title: 'Watch the story. Stay off the list.',
    body: 'Watch stories as usual while your name stays off the viewer list. The control lives on your device; the rest of Instagram stays familiar.',
    webm: '/media/instagram-hide-story.webm',
    mp4: '/media/instagram-hide-story.mp4',
    poster: '/media/instagram-hide-story-poster.webp',
    width: 859,
    height: 782,
  },
  {
    platform: 'facebook',
    name: 'Facebook',
    title: 'Bring the same quiet control to Facebook.',
    body: 'Story-view, typing, and Seen controls share one setting group with Messenger — the privacy choice follows you across Meta’s web messaging.',
    webm: '/media/facebook-hide-story.webm',
    mp4: '/media/facebook-hide-story.mp4',
    poster: '/media/facebook-hide-story-poster.webp',
    width: 844,
    height: 782,
  },
];

function FeatureRecording({ feature }: { feature: (typeof FEATURES)[number] }) {
  return (
    <video
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={feature.poster}
      aria-label={`${feature.name} running with Ghostify in the browser`}
      width={feature.width}
      height={feature.height}
    >
      <source src={feature.webm} type="video/webm" />
      <source src={feature.mp4} type="video/mp4" />
    </video>
  );
}

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
  {
    platform: 'instagram',
    name: 'Instagram',
    url: 'instagram.com',
    qualifier: 'Its own control group',
  },
  {
    platform: 'messenger',
    name: 'Messenger',
    url: 'messenger.com',
    qualifier: 'Shared settings with Facebook',
  },
  {
    platform: 'facebook',
    name: 'Facebook',
    url: 'facebook.com',
    qualifier: 'Shared settings with Messenger',
  },
];

const AI_PROMPT =
  'Is the Ghostify browser extension by Hendrizzzz right for me? Use only its official Chrome Web Store listing, Firefox Add-ons listing, and GitHub documentation. Explain in plain English what it helps me do, what stays on my device, why it needs access to Instagram, Facebook, and Messenger, and its real limitations. Ignore unrelated Ghostify products and third-party directories. Keep it short.';

const AI_LINKS = [
  { name: 'ChatGPT', href: `https://chatgpt.com/?q=${encodeURIComponent(AI_PROMPT)}` },
  { name: 'Claude', href: `https://claude.ai/new?q=${encodeURIComponent(AI_PROMPT)}` },
  {
    name: 'Perplexity',
    href: `https://www.perplexity.ai/search/new?q=${encodeURIComponent(AI_PROMPT)}`,
  },
];

const EXTENSION_FOOTPRINT_KIB = 64.57;

const FAQS = [
  {
    q: 'Why does Chrome say Ghostify can read and change data on these sites?',
    a: 'Ghostify needs access to supported Instagram, Messenger, and Facebook tabs so it can identify and hold the privacy signals you switch off. That access is limited to those Meta web apps and Meta’s own web-messaging proxy — it is not a window into everything you do.',
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
          const repelX = (dx / distance) * repel;
          const repelY = (dy / distance) * repel;
          tile.style.setProperty('--mouse-x', `${(x * depth + repelX).toFixed(2)}px`);
          tile.style.setProperty('--mouse-y', `${(y * depth + repelY).toFixed(2)}px`);
          tile.classList.toggle('is-avoiding', proximity > 0.12);
        });
      });
    };
    const reset = () =>
      tiles.forEach((tile) => {
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
      <span className="hero-detail hero-detail-instagram">
        <i className="hero-detail-stage">
          <PlatformLogo platform="instagram" size={34} />
        </i>
      </span>
      <span className="hero-detail hero-detail-messenger">
        <i className="hero-detail-stage">
          <PlatformLogo platform="messenger" size={36} />
        </i>
      </span>
      <span className="hero-detail hero-detail-facebook">
        <i className="hero-detail-stage">
          <PlatformLogo platform="facebook" size={36} />
        </i>
      </span>
      <span className="hero-detail hero-detail-seen">
        <i className="hero-detail-stage">
          <EyeOff size={27} />
        </i>
      </span>
      <span className="hero-detail hero-detail-typing">
        <i className="hero-detail-stage">
          <MessageCircle size={27} />
        </i>
      </span>
      <span className="hero-detail hero-detail-story">
        <i className="hero-detail-stage">
          <CirclePlay size={28} />
        </i>
      </span>
      <span className="hero-detail hero-detail-local">
        <i className="hero-detail-stage">
          <ShieldCheck size={27} />
        </i>
      </span>
      <span className="hero-detail hero-detail-browser">
        <i className="hero-detail-stage">
          <img src="/edge-current.svg" alt="" />
        </i>
      </span>
      <span className="hero-detail hero-detail-chrome">
        <i className="hero-detail-stage">
          <img src="/chrome-current.svg" alt="" />
        </i>
      </span>
      <span className="hero-detail hero-detail-brave">
        <i className="hero-detail-stage">
          <img src="/brave-current.svg?v=2" alt="" />
        </i>
      </span>
      <span className="hero-detail hero-detail-opera">
        <i className="hero-detail-stage">
          <img src="/opera-current.svg?v=2" alt="" />
        </i>
      </span>
      <span className="hero-detail hero-detail-arc">
        <i className="hero-detail-stage">
          <img src="/arc-current.svg" alt="" />
        </i>
      </span>
      <span className="hero-detail hero-detail-vivaldi">
        <i className="hero-detail-stage">
          <img src="/vivaldi-current.svg" alt="" />
        </i>
      </span>
      <span className="hero-detail hero-detail-opera-gx">
        <i className="hero-detail-stage">
          <img src="/opera-gx-current.svg" alt="" />
        </i>
      </span>
      <span className="hero-detail hero-detail-dia">
        <i className="hero-detail-stage">
          <img src="/dia-current.svg" alt="" />
        </i>
      </span>
      <span className="hero-detail hero-detail-opera-air">
        <i className="hero-detail-stage">
          <img src="/opera-air-current.svg" alt="" />
        </i>
      </span>
      <span className="hero-detail hero-detail-yandex">
        <i className="hero-detail-stage">
          <img src="/yandex-current.svg" alt="" />
        </i>
      </span>
      <span className="hero-detail hero-detail-firefox">
        <i className="hero-detail-stage">
          <img src="/firefox-current.svg" alt="" />
        </i>
      </span>
    </div>
  );
}

function PlatformControlMap() {
  return (
    <div
      className="platform-control-map"
      aria-label="Instagram has its own controls. Messenger and Facebook share a control group."
    >
      <article className="control-map-note control-map-note-own">
        <span className="control-map-word" aria-hidden="true">
          own
        </span>
        <PlatformLogo platform="instagram" size={36} />
        <span>
          <small>Instagram</small>
          <strong>Its own switches.</strong>
        </span>
      </article>
      <article className="control-map-note control-map-note-shared">
        <span className="control-map-word" aria-hidden="true">
          together
        </span>
        <span className="control-map-pair">
          <i>
            <PlatformLogo platform="messenger" size={32} />
          </i>
          <i>
            <PlatformLogo platform="facebook" size={32} />
          </i>
        </span>
        <span>
          <small>Messenger + Facebook</small>
          <strong>One shared set.</strong>
        </span>
      </article>
    </div>
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
    const observer = new IntersectionObserver(
      ([entry]) => {
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
      },
      { threshold: 0.45 },
    );

    observer.observe(metric);
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const displayValue = value === 0 ? '0' : value.toFixed(2);

  return (
    <article
      ref={metricRef}
      aria-label={`${EXTENSION_FOOTPRINT_KIB.toFixed(2)} KiB extension footprint`}
    >
      <strong aria-hidden="true">
        {displayValue}
        <span>KiB</span>
      </strong>
      <small aria-hidden="true">extension footprint</small>
    </article>
  );
}

function FootprintSection() {
  return (
    <section className="footprint-section" data-scroll-scene>
      <Reveal tag="header">
        <h2>Built to stay out of your way.</h2>
        <p>
          A compact footprint, no tracking relays, and no account standing between you and the
          controls.
        </p>
      </Reveal>
      <div className="footprint-metrics">
        <article>
          <strong>MV3</strong>
          <small>extension architecture</small>
        </article>
        <AnimatedFootprintMetric />
        <article>
          <strong>0</strong>
          <small>tracking relays</small>
        </article>
        <article>
          <strong>0</strong>
          <small>Ghostify accounts required</small>
        </article>
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
        const progress = Math.min(
          1,
          Math.max(0, (window.innerHeight - rect.top) / Math.max(1, distance)),
        );
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
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { rootMargin: '120px 0px' },
    );
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
        <GhostMark size={42} bodyColor="#f3eee2" eyeColor="#0f0f0d" />
        <span>
          <small>Ghostify</small>
          <strong>quiet by design.</strong>
        </span>
      </div>
      <div className="fact-marquee-viewport">
        <div className="fact-marquee-track">
          {[0, 1].map((copy) => (
            <div
              className="fact-marquee-group"
              aria-hidden={copy === 1 ? 'true' : undefined}
              key={copy}
            >
              {FACTS.map(({ label, text }) => (
                <span className="fact-marquee-phrase" key={label}>
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
      <Reveal tag="header">
        <h2 id="install-rhythm-title">
          One minute.
          <br />
          Then it disappears.
        </h2>
        <p>Four small moves, then Ghostify settles into the background.</p>
      </Reveal>
      <div className="install-rhythm-path">
        <svg
          className="install-path-line"
          aria-hidden="true"
          viewBox="0 0 100 400"
          preserveAspectRatio="none"
        >
          <path d="M 7 14 L 7 386" />
        </svg>
        <span className="install-path-ghost" aria-hidden="true">
          <GhostMark size={58} bodyColor="#0f0f0d" eyeColor="#f3eee2" />
        </span>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>Add Ghostify</strong>
              <small>Install from Chrome, Edge, or Firefox.</small>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Pin Ghostify</strong>
              <small>Open Extensions, then pin Ghostify for quick access.</small>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Reload your Meta tabs</strong>
              <small>Let Ghostify start before the page does.</small>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <strong>Choose your quiet</strong>
              <small>Switch Seen, Typing, and Story Views independently.</small>
            </div>
          </li>
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
          <Reveal className="ask-ai-copy">
            <div className="ask-ai-lead">
              <h2 data-split>
                Don&apos;t take
                <br />
                our word for it.
              </h2>
              <p>
                Open a prepared question in the model you already use. It asks for a plain-English
                answer grounded in Ghostify&apos;s public documentation.
              </p>
            </div>
            <nav className="ask-ai-actions" aria-label="Ask an AI assistant about Ghostify">
              {AI_LINKS.map((item) => (
                <a href={item.href} target="_blank" rel="noopener noreferrer" key={item.name}>
                  <strong>Ask {item.name}</strong>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </a>
              ))}
            </nav>
          </Reveal>
          <Reveal className="ask-ai-visual" delay={140} aria-hidden="true">
            <div className="ask-ai-source-stack">
              <div className="ask-ai-question-sheet">
                <div className="ask-ai-sheet-meta">
                  <span>From your browser</span>
                  <span>To any model</span>
                </div>
                <strong>
                  &ldquo;Explain Ghostify
                  <br />
                  in plain English.&rdquo;
                </strong>
              </div>
              <div className="ask-ai-source-tab">
                <small>Sources</small>
                <strong>attached</strong>
              </div>
            </div>
            <span className="ask-ai-ghost">
              <GhostMark size={112} />
            </span>
          </Reveal>
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
    <div
      className={`feature-signal-rail feature-signal-focus-${focus}`}
      aria-label="Supported controls shown in this recording"
    >
      {signals.map((signal) => (
        <span className={signal.key === focus ? 'is-active' : undefined} key={signal.key}>
          {signal.icon}
          {signal.label}
        </span>
      ))}
    </div>
  );
}

function FeatureScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeFeature = FEATURES[activeIndex];
  const signalNote =
    activeFeature.platform === 'messenger' ? 'Seen stays here.' : 'Story view stays here.';
  const atmosphereWord =
    activeFeature.platform === 'messenger'
      ? 'held'
      : activeFeature.platform === 'instagram'
        ? 'quiet'
        : 'local';

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / distance));
      const nextIndex = Math.min(FEATURES.length - 1, Math.floor(progress * FEATURES.length));
      section.style.setProperty('--feature-progress', progress.toFixed(3));
      setActiveIndex((current) => (current === nextIndex ? current : nextIndex));
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
    const progress = FEATURES.length === 0 ? 0 : (index + 0.5) / FEATURES.length;
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
            <a href="/status">
              See current verification <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>

        <figure className="feature-scroll-media" key={`media-${activeFeature.platform}`}>
          <div className="feature-media-frame">
            <div
              className={`feature-signal-note feature-signal-note-${activeFeature.platform}`}
              aria-hidden="true"
            >
              <span className="feature-note-source">
                <PlatformLogo platform={activeFeature.platform} size={25} />
                <small>{activeFeature.name} on the web</small>
              </span>
              <strong>{signalNote}</strong>
            </div>
            <div className={`feature-media-crop feature-media-crop-${activeFeature.platform}`}>
              <FeatureRecording feature={activeFeature} />
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
            <FeatureRecording feature={feature} />
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
      <GhostJourney />
      <LandingChoreography />
      <PlatformsDeck />
      <InstallRhythmScene />
      <FaqAskAiScene />
      <section className="home-hero">
        <HeroDetails />
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <h1>
              No{' '}
              <em className="hero-seen">
                <span className="hero-seen-word">seen.</span>
                <i className="hero-seen-strike" aria-hidden="true" />
              </em>
              <br className="hero-title-break" aria-hidden="true" /> No pressure.
            </h1>
            <p>
              Ghostify gives you control over supported Seen, Typing, and Story View signals on
              Instagram, Messenger, and Facebook — directly in your browser.
            </p>
            <div className="home-hero-actions">
              <StoreCta />
              <a href="#features">
                See it in action <ArrowDown size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <SignalCatchScene />

      <FeatureScroll />

      <section className="platforms-flat is-dark" id="platforms" data-scroll-scene>
        <Reveal tag="header">
          <h2 data-split>
            Three controls.
            <br />
            <span>Two groups. Three places.</span>
          </h2>
          <PlatformControlMap />
        </Reveal>
        <div className="platform-card-grid">
          {PLATFORMS.map((item, index) => (
            <Reveal
              tag="article"
              className={`platform-card platform-card-${item.platform}`}
              delay={index * 90}
              key={item.platform}
            >
              <header>
                <PlatformLogo platform={item.platform} size={54} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.url}</small>
                </span>
              </header>
              <div className="platform-card-controls">
                {['Hide Seen', 'Hide Typing', 'Hide Story Views'].map((control) => (
                  <div key={control}>
                    <span>{control}</span>
                    <i aria-hidden="true">
                      <b />
                    </i>
                  </div>
                ))}
              </div>
              <footer>
                <Check size={16} aria-hidden="true" />
                {item.qualifier}
              </footer>
            </Reveal>
          ))}
        </div>
        <Reveal delay={180}>
          <a className="platforms-status" href="/status">
            Coverage changes with the platforms. See verification dated {lastVerified}.{' '}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </Reveal>
      </section>

      <section className="privacy-band" id="privacy" data-scroll-scene>
        <Reveal tag="header">
          <h2>
            Local by default.
            <br />
            <span>Open to inspection.</span>
          </h2>
          <p>
            The controls run inside your browser. Nothing about your messages, tabs, or settings
            reaches a Ghostify server — there is no Ghostify server to reach.
          </p>
        </Reveal>
        <Reveal className="privacy-band-panel" delay={120}>
          <ul>
            <li>
              <Check size={17} aria-hidden="true" />
              <span>
                <strong>No Ghostify account</strong>
                <small>Nothing new to sign into. Install and switch it on.</small>
              </span>
            </li>
            <li>
              <Check size={17} aria-hidden="true" />
              <span>
                <strong>No messages through Ghostify</strong>
                <small>
                  Signals are held on your device; conversations stay between you and the app.
                </small>
              </span>
            </li>
            <li>
              <Check size={17} aria-hidden="true" />
              <span>
                <strong>No social passwords</strong>
                <small>Ghostify never asks for your Instagram, Facebook, or Messenger login.</small>
              </span>
            </li>
          </ul>
          <div className="privacy-band-links">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              Read the source
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            <a
              href={`${GITHUB_URL}/blob/main/PRIVACY.md`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Review every permission
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
        </Reveal>
      </section>

      <FootprintSection />
      <InstallRhythm />
      <FactMarquee />

      <section className="faq-flat" data-scroll-scene>
        <Reveal tag="header">
          <h2 data-split>Before you install.</h2>
          <p>Plain answers, without the disappearing fine print.</p>
        </Reveal>
        <div className="faq-flat-list">
          {FAQS.map((item, index) => (
            <details key={item.q}>
              <summary>
                <span className="faq-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <strong className="faq-question">{item.q}</strong>
                <span className="faq-toggle" aria-hidden="true">
                  <i />
                  <i />
                </span>
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <AskAiSection />

      <section className="home-final" data-scroll-scene>
        <Reveal>
          <h2>
            <span className="home-final-brand">Ghostify,</span>
            <span className="home-final-promise">wherever you browse.</span>
          </h2>
          <p>One extension, three platforms, zero accounts. Free for Chrome, Edge, and Firefox.</p>
          <div className="home-final-actions">
            <StoreCta />
            <a
              className="browser-store-link"
              href={EDGE_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img className="browser-logo" src="/edge-current.svg" alt="" />
              Get for Edge
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            <a
              className="browser-store-link"
              href={FIREFOX_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img className="browser-logo" src="/firefox-current.svg" alt="" />
              Get for Firefox
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
