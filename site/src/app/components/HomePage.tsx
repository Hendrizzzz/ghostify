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
  STATUS_LABELS,
  formatStatusDate,
  getLastVerifiedAt,
  getPublicReleaseStatus,
} from '../statusData';
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

const EVIDENCE_LINKS = [
  { name: 'Privacy policy', href: `${GITHUB_URL}/blob/main/PRIVACY.md` },
  { name: 'Threat model', href: `${GITHUB_URL}/blob/main/docs/THREAT_MODEL.md` },
  { name: 'Release checksums', href: `${GITHUB_URL}/releases/latest` },
];

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
    a: 'Chrome and Microsoft Edge are Ghostify\'s official store builds. Opera, Opera GX, Opera Air, Brave, Vivaldi, Arc, Dia, Yandex Browser, and NAVER Whale can use the Chrome build where the browser permits Chrome Web Store extensions; browser-specific policies can change.',
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
        <span className="signal-catch-stamp"><b>held</b><small>in this browser</small></span>
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
        <PlatformLogo platform="instagram" size={36} />
        <span><small>Instagram</small><strong>Keeps its own switches.</strong></span>
        <em>separate, on purpose</em>
      </article>
      <article className="control-map-note control-map-note-shared">
        <span className="control-map-pair">
          <i><PlatformLogo platform="messenger" size={32} /></i>
          <i><PlatformLogo platform="facebook" size={32} /></i>
        </span>
        <span><small>Messenger + Facebook</small><strong>Move together.</strong></span>
        <em>one shared set</em>
      </article>
      <span className="control-map-pencil" aria-hidden="true">two rhythms, three places</span>
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

function AnimatedFootprintMetric() {
  const metricRef = useRef<HTMLElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const metric = metricRef.current;
    if (!metric) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setValue(63.09);
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
        setValue(63.09 * eased);
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
    <article ref={metricRef} aria-label="63.09 KiB extension footprint">
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
    const reveals = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

    if (reducedMotion) {
      reveals.forEach((item) => item.classList.add('is-visible'));
      scenes.forEach((scene) => scene.style.setProperty('--scene-progress', '0.5'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach((item) => observer.observe(item));

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
      observer.disconnect();
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
      <header data-reveal>
        <h2 id="install-rhythm-title">One minute.<br />Then it disappears.</h2>
        <p>Four small moves, then Ghostify settles into the background.</p>
      </header>
      <div className="install-rhythm-path" data-reveal>
        <span className="install-path-line" aria-hidden="true"><i /></span>
        <span className="install-path-ghost" aria-hidden="true"><GhostMark size={58} bodyColor="#0f0f0d" eyeColor="#f3eee2" /></span>
        <ol>
        <li><span>01</span><div><strong>Add Ghostify</strong><small>Install from Chrome or Edge.</small></div></li>
        <li><span>02</span><div><strong>Pin Ghostify</strong><small>Open Extensions, then pin Ghostify for quick access.</small></div></li>
        <li><span>03</span><div><strong>Reload your Meta tabs</strong><small>Let Ghostify start before the page does.</small></div></li>
        <li><span>04</span><div><strong>Choose your quiet</strong><small>Switch Seen, Typing, and Story Views independently.</small></div></li>
        </ol>
      </div>
    </section>
  );
}

function EvidenceSection() {
  return (
    <section className="evidence-section" data-scroll-scene>
      <div className="evidence-card" data-reveal>
        <div className="evidence-lead">
          <h2>Inspect the<br />public evidence.</h2>
          <p>Review what Ghostify can access, where its trust boundaries sit, and how release artifacts are published.</p>
        </div>
        <div className="evidence-actions">
          {EVIDENCE_LINKS.map((item) => (
            <a href={item.href} target="_blank" rel="noopener noreferrer" key={item.name}>
              {item.name}
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          ))}
        </div>
        <div className="evidence-proof" aria-label="Ghostify public evidence">
          <span><Code2 size={20} aria-hidden="true" /><strong>Open source</strong></span>
          <span><LockKeyhole size={20} aria-hidden="true" /><strong>Clear permissions</strong></span>
          <span><ShieldCheck size={20} aria-hidden="true" /><strong>Latest checks</strong></span>
        </div>
        <span className="evidence-ghost" aria-hidden="true"><GhostMark size={170} /></span>
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
              <span className="feature-note-tape" />
              <span className="feature-note-source"><PlatformLogo platform={activeFeature.platform} size={25} /><small>{activeFeature.name} on the web</small></span>
              <strong>{signalNote}</strong>
              <em>Ghostify holds it in this browser.</em>
              <span className="feature-note-stamp"><GhostMark size={25} bodyColor="#f3eee2" eyeColor="#0f0f0d" /><b>local</b></span>
              <svg className="feature-note-arrow" viewBox="0 0 120 64" preserveAspectRatio="none">
                <path className="feature-note-arrow-halo" d="M8 8C34 10 50 22 63 43C73 56 91 57 108 48" />
                <path className="feature-note-arrow-halo" d="M97 42L109 48L101 58" />
                <path className="feature-note-arrow-ink" d="M8 8C34 10 50 22 63 43C73 56 91 57 108 48" />
                <path className="feature-note-arrow-ink" d="M97 42L109 48L101 58" />
              </svg>
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
  const releaseStatus = getPublicReleaseStatus();
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
            <p className="home-hero-fineprint">No Ghostify account or social password required.</p>
            <div className="hero-trust-row" aria-label="Ghostify trust summary">
              <span><Code2 size={14} aria-hidden="true" />Open source</span>
              <span><LockKeyhole size={14} aria-hidden="true" />Browser-local controls</span>
              <a href="/status"><ShieldCheck size={14} aria-hidden="true" />Checked {lastVerified}</a>
            </div>
          </div>

          <div className="home-hero-art">
            <HeroSignalFlow />
          </div>
        </div>
      </section>

      <FeatureScroll />

      <section className="platforms-flat" id="platforms" data-scroll-scene>
        <header data-reveal>
          <h2>Three controls.<br /><span>Two groups. Three places.</span></h2>
          <PlatformControlMap />
        </header>
        <div className="platform-card-grid">
          {PLATFORMS.map((item) => (
            <article className={`platform-card platform-card-${item.platform}`} key={item.platform} data-reveal>
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

      <section className="privacy-flat" id="privacy" data-scroll-scene>
        <div className="privacy-flat-lead" data-reveal>
          <h2>Local by default.<br />Open to inspection.</h2>
          <div className="privacy-flat-aside">
            <PrivacyIllustration />
          </div>
        </div>
        <div className="privacy-flat-points" data-reveal>
          <article tabIndex={0}>
            <ShieldCheck size={26} aria-hidden="true" />
            <div><h3>You choose each signal.</h3><p>Seen, typing, and story-view controls stay separate.</p></div>
          </article>
          <article tabIndex={0}>
            <LockKeyhole size={26} aria-hidden="true" />
            <div><h3>Designed to preserve normal browsing.</h3><p>Regression tests and live checks cover messages, navigation, and media while supported privacy signals are targeted.</p></div>
          </article>
          <article tabIndex={0}>
            <Code2 size={26} aria-hidden="true" />
            <div><h3>The evidence is public.</h3><p>Read the source and check dated verification whenever Meta changes its web apps.</p></div>
          </article>
        </div>
        <div className="privacy-flat-links" data-reveal>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"><Code2 size={22} aria-hidden="true" /><span><strong>Read the source</strong>Ghostify Core is MIT licensed.</span><ArrowUpRight size={17} aria-hidden="true" /></a>
          <a href={`${GITHUB_URL}/blob/main/PRIVACY.md`} target="_blank" rel="noopener noreferrer"><LockKeyhole size={22} aria-hidden="true" /><span><strong>Review every permission</strong>See what runs locally and why.</span><ArrowUpRight size={17} aria-hidden="true" /></a>
          <a href="/status"><ShieldCheck size={22} aria-hidden="true" /><span><strong>Check public status</strong>{STATUS_LABELS[releaseStatus]}.</span><ArrowUpRight size={17} aria-hidden="true" /></a>
        </div>
      </section>

      <FootprintSection />
      <InstallRhythm />
      <FactMarquee />

      <section className="faq-flat" data-scroll-scene>
        <header data-reveal>
          <h2>Before you install.</h2>
          <p>Plain answers, without the disappearing fine print.</p>
        </header>
        <div className="faq-flat-list" data-reveal>
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

      <EvidenceSection />

      <section className="home-final" data-scroll-scene>
        <div data-reveal>
          <div className="home-final-badges">
            <span><img className="browser-logo" src="/chrome-current.svg" alt="" />Chrome</span>
            <span><img className="browser-logo" src="/edge-current.svg" alt="" />Edge</span>
            <span><img className="browser-logo" src="/firefox-current.svg" alt="" />Firefox</span>
          </div>
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
          <div className="home-final-details">
            <span><Globe2 size={19} aria-hidden="true" /><b>Meta web apps</b><small>Chrome · Edge · Firefox</small></span>
            <span><ShieldCheck size={19} aria-hidden="true" /><b>Core controls</b><small>No Ghostify account</small></span>
            <span><Code2 size={19} aria-hidden="true" /><b>Open source</b><small>MIT-licensed Core</small></span>
          </div>
        </div>
      </section>
    </div>
  );
}
