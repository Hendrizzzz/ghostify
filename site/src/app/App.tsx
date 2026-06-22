import { GhostMascot } from './components/GhostMascot';
import { useEffect } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { FeaturesSection } from './components/FeaturesSection';
import { PlatformSection } from './components/PlatformSection';
import { PersonalityBand } from './components/PersonalityBand';
import { LightweightSection } from './components/LightweightSection';
import { LimitsSection } from './components/LimitsSection';
import { FAQSection } from './components/FAQSection';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';
import { StatusPage } from './components/StatusPage';

const NAV_ANCHOR_OFFSET = 0;

export default function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const statusView = pathname === '/status/history' ? 'history' : pathname === '/status' ? 'current' : null;

  useEffect(() => {
    const scrollToHash = (nextHash = window.location.hash) => {
      const hash = nextHash;
      if (!hash) return;
      const target = hash.startsWith('#') ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
      if (!target) return;

      const scroll = () => {
        const currentTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        const targetTop = Math.max(0, target.getBoundingClientRect().top + currentTop - NAV_ANCHOR_OFFSET);

        const htmlScrollBehavior = document.documentElement.style.scrollBehavior;
        const bodyScrollBehavior = document.body.style.scrollBehavior;
        const htmlScrollSnap = document.documentElement.style.scrollSnapType;
        const bodyScrollSnap = document.body.style.scrollSnapType;
        document.documentElement.style.scrollBehavior = 'auto';
        document.body.style.scrollBehavior = 'auto';
        document.documentElement.style.scrollSnapType = 'none';
        document.body.style.scrollSnapType = 'none';
        window.scrollTo({ top: targetTop, left: 0, behavior: 'auto' });
        document.documentElement.scrollTop = targetTop;
        document.body.scrollTop = targetTop;
        window.dispatchEvent(new CustomEvent('ghostify:anchor-jump', { detail: { hash } }));
        requestAnimationFrame(() => {
          document.documentElement.style.scrollBehavior = htmlScrollBehavior;
          document.body.style.scrollBehavior = bodyScrollBehavior;
          document.documentElement.style.scrollSnapType = htmlScrollSnap;
          document.body.style.scrollSnapType = bodyScrollSnap;
        });
      };

      requestAnimationFrame(() => requestAnimationFrame(scroll));
      window.setTimeout(scroll, 100);
      window.setTimeout(scroll, 350);
    };

    const onAnchorClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const anchor = target?.closest('a[href^="#"]');
      const hash = anchor?.getAttribute('href');
      if (!hash || hash === '#') return;
      event.preventDefault();
      window.history.pushState(null, '', hash);
      scrollToHash(hash);
    };

    const onHashChange = () => scrollToHash();

    scrollToHash();
    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('click', onAnchorClick, true);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      document.removeEventListener('click', onAnchorClick, true);
    };
  }, []);

  return (
    <div
      className="site-shell"
      style={{
        minHeight: '100vh',
        background: 'var(--g-bg)',
        color: 'var(--g-white)',
        position: 'relative',
      }}
    >
      {/* Grain overlay */}
      <div className="grain-layer" aria-hidden="true" />

      {/* Draggable mascot — sits above everything */}
      <div className="mascot-stage">
        <GhostMascot />
      </div>

      {/* Navigation */}
      <Header />

      {/* Page sections */}
      {statusView ? (
        <main>
          <StatusPage view={statusView} />
        </main>
      ) : (
        <main>
          <SiteAtmosphere />
          <HeroSection />
          <FeaturesSection />
          <PlatformSection />
          <PersonalityBand />
          <LightweightSection />
          <LimitsSection />
          <FAQSection />
          <FinalCTA />
        </main>
      )}

      <Footer />

      <style>{`
        .site-shell {
          isolation: isolate;
          overflow-x: hidden;
        }
        .site-shell > header,
        .site-shell > footer,
        .mascot-stage {
          position: relative;
          z-index: 2;
        }
        .site-shell main {
          position: relative;
          z-index: 1;
          overflow: hidden;
          background: var(--g-bg);
        }
        .site-atmosphere {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .site-atmosphere svg {
          display: block;
          width: 100%;
          height: 100%;
          min-height: 100%;
        }
        .site-smoke-soft path,
        .site-smoke-lines path {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .site-smoke-soft {
          opacity: 0.08;
          mix-blend-mode: screen;
        }
        .site-smoke-lines {
          opacity: 0.28;
          mix-blend-mode: screen;
        }
        .site-smoke-lines path {
          stroke-width: 1;
          stroke-dasharray: 1 18;
        }
        .site-stars {
          fill: rgba(239,226,208,0.34);
        }
        .site-stars circle:nth-child(even) {
          fill: rgba(212,106,82,0.32);
        }
        .site-bg-ghosts {
          color: rgba(239,226,208,0.032);
        }
        .site-shell main > section:not(.status-page) {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          background: transparent !important;
        }
        .site-shell main > section:not(.status-page) > * {
          position: relative;
          z-index: 1;
        }
        .site-shell #features {
          margin-top: 0 !important;
        }
        .site-shell #hero .hero-backdrop {
          display: none !important;
        }
        .site-shell #hero.hero-section::after {
          display: none !important;
        }
        .site-shell #hero .hero-texture {
          display: none !important;
        }
        .site-shell #hero .hero-vignette {
          display: none !important;
        }
        .site-shell .status-page {
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }
        .site-shell .status-page::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0.2;
          background:
            radial-gradient(circle at 84% 16%, rgba(239,226,208,0.18) 0 1.1px, transparent 1.7px),
            radial-gradient(circle at 18% 82%, rgba(212,106,82,0.14) 0 1px, transparent 1.6px),
            radial-gradient(ellipse at 6% 88%, rgba(239,226,208,0.045), transparent 34%),
            radial-gradient(ellipse at 92% 18%, rgba(212,106,82,0.04), transparent 34%);
        }
        .site-shell .status-page > * {
          position: relative;
          z-index: 1;
        }
        .site-shell .status-page::after {
          content: "";
          position: absolute;
          right: max(-3.6rem, -3vw);
          top: 12rem;
          z-index: 0;
          pointer-events: none;
          width: clamp(7rem, 11vw, 12rem);
          aspect-ratio: 0.8;
          opacity: 0.052;
          border-radius: 48% 48% 20% 20% / 34% 34% 20% 20%;
          background:
            radial-gradient(ellipse at 37% 38%, rgba(0,0,0,0.42) 0 8%, transparent 9.5%),
            radial-gradient(ellipse at 63% 38%, rgba(0,0,0,0.42) 0 8%, transparent 9.5%),
            radial-gradient(circle at 16% 100%, transparent 0 12%, rgba(239,226,208,0.9) 13% 100%),
            radial-gradient(circle at 38% 100%, transparent 0 12%, rgba(239,226,208,0.9) 13% 100%),
            radial-gradient(circle at 62% 100%, transparent 0 12%, rgba(239,226,208,0.9) 13% 100%),
            radial-gradient(circle at 84% 100%, transparent 0 12%, rgba(239,226,208,0.9) 13% 100%),
            linear-gradient(rgba(239,226,208,0.9), rgba(239,226,208,0.9));
          filter: blur(0.25px);
          transform: rotate(4deg);
        }
        html {
          scroll-padding-top: 76px;
        }
        @media (max-width: 640px) {
          .site-smoke-soft {
            opacity: 0.07;
          }
          .site-smoke-lines {
            opacity: 0.2;
          }
          .site-bg-ghosts {
            color: rgba(239,226,208,0.026);
          }
          html { scroll-padding-top: 68px; }
          body { overflow-x: hidden; }
        }
      `}</style>
    </div>
  );
}

function SiteAtmosphere() {
  return (
    <div className="site-atmosphere" aria-hidden="true">
      <svg viewBox="0 0 1600 4200" preserveAspectRatio="none" role="presentation">
        <defs>
          <filter id="siteSmokeSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="11" />
          </filter>
          <linearGradient id="siteSmokeWarm" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#efe2d0" stopOpacity="0" />
            <stop offset="0.18" stopColor="#efe2d0" stopOpacity="0.22" />
            <stop offset="0.52" stopColor="#d46a52" stopOpacity="0.12" />
            <stop offset="0.84" stopColor="#efe2d0" stopOpacity="0.16" />
            <stop offset="1" stopColor="#efe2d0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="siteSmokeCool" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#efe2d0" stopOpacity="0" />
            <stop offset="0.24" stopColor="#efe2d0" stopOpacity="0.16" />
            <stop offset="0.7" stopColor="#efe2d0" stopOpacity="0.07" />
            <stop offset="1" stopColor="#efe2d0" stopOpacity="0" />
          </linearGradient>
          <symbol id="siteAtmosphereGhost" viewBox="0 0 92 112">
            <path d="M8 94V43C8 19.7 24.3 4 46 4s38 15.7 38 39v51c0 6.5-7.2 10.4-12.6 6.7l-7.1-4.8-8.8 6.1a10.2 10.2 0 0 1-11.3 0l-8.7-6.1-7.1 4.8C23 104.4 8 100.5 8 94Z" fill="currentColor" />
            <ellipse cx="34" cy="43" rx="8" ry="13" fill="#070605" />
            <ellipse cx="59" cy="43" rx="8" ry="13" fill="#070605" />
          </symbol>
        </defs>

        <g className="site-smoke-soft" filter="url(#siteSmokeSoft)">
          <path d="M-220 520C140 462 322 584 620 514 930 442 1120 408 1820 510" stroke="url(#siteSmokeWarm)" strokeWidth="24" />
          <path d="M-260 1040C190 980 390 1080 690 1000 980 924 1180 930 1840 1034" stroke="url(#siteSmokeCool)" strokeWidth="22" />
          <path d="M-260 1640C110 1540 400 1608 690 1564 990 1518 1200 1450 1840 1528" stroke="url(#siteSmokeWarm)" strokeWidth="24" />
          <path d="M-280 2390C180 2480 470 2328 760 2394 1040 2460 1250 2540 1860 2478" stroke="url(#siteSmokeCool)" strokeWidth="26" />
          <path d="M-240 3300C170 3200 410 3344 760 3266 1070 3190 1290 3210 1840 3310" stroke="url(#siteSmokeWarm)" strokeWidth="24" />
        </g>

        <g className="site-smoke-lines">
          <path d="M-240 720C160 660 350 770 628 702 922 630 1110 620 1840 710" stroke="url(#siteSmokeCool)" />
          <path d="M-220 1320C160 1240 400 1360 720 1285 1020 1214 1210 1238 1840 1310" stroke="url(#siteSmokeWarm)" />
          <path d="M-260 2120C110 2030 410 2160 700 2070 1030 1966 1240 2038 1840 2140" stroke="url(#siteSmokeCool)" />
          <path d="M-260 2920C90 2830 410 2970 690 2890 990 2804 1180 2810 1840 2910" stroke="url(#siteSmokeWarm)" />
        </g>

        <g className="site-stars">
          <circle cx="730" cy="540" r="1.5" />
          <circle cx="806" cy="620" r="2.2" />
          <circle cx="1134" cy="810" r="1.6" />
          <circle cx="1330" cy="1240" r="1.2" />
          <circle cx="216" cy="1780" r="1.5" />
          <circle cx="1220" cy="2060" r="1.8" />
          <circle cx="670" cy="2760" r="1.2" />
          <circle cx="1420" cy="3500" r="1.7" />
        </g>

        <g className="site-bg-ghosts">
          <use href="#siteAtmosphereGhost" x="1472" y="430" width="150" height="184" />
          <use href="#siteAtmosphereGhost" x="-58" y="1860" width="142" height="174" />
          <use href="#siteAtmosphereGhost" x="1388" y="2870" width="164" height="200" />
        </g>
      </svg>
    </div>
  );
}
