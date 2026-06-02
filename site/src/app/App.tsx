import { GhostMascot } from './components/GhostMascot';
import { useEffect } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { DemoSection } from './components/DemoSection';
import { FeaturesSection } from './components/FeaturesSection';
import { PlatformSection } from './components/PlatformSection';
import { PersonalityBand } from './components/PersonalityBand';
import { PrivacySection } from './components/PrivacySection';
import { LightweightSection } from './components/LightweightSection';
import { LimitsSection } from './components/LimitsSection';
import { FAQSection } from './components/FAQSection';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';

const NAV_ANCHOR_OFFSET = 0;

export default function App() {
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
      <GhostMascot />

      {/* Navigation */}
      <Header />

      {/* Page sections */}
      <main>
        <HeroSection />
        <DemoSection />
        <FeaturesSection />
        <PlatformSection />
        <PersonalityBand />
        <PrivacySection />
        <LightweightSection />
        <LimitsSection />
        <FAQSection />
        <FinalCTA />
      </main>

      <Footer />

      <style>{`
        @media (max-width: 640px) {
          body { overflow-x: hidden; }
        }
        *:focus-visible {
          outline: 2px solid rgba(196,72,48,0.6);
          outline-offset: 3px;
          border-radius: 4px;
        }
        ::selection {
          background: rgba(196,72,48,0.25);
          color: var(--g-white);
        }
      `}</style>
    </div>
  );
}
