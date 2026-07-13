import { useEffect, useState } from 'react';
import { ArrowUpRight, Github, Menu, ShieldCheck } from 'lucide-react';
import { getPublicReleaseStatus } from '../statusData';
import { GhostMark } from './GhostSVG';

export const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/ghostify-hide-seen-typing/flpnibonbhdmnpgflnbemgghghhblmpm';
export const EDGE_STORE_URL =
  'https://microsoftedge.microsoft.com/addons/detail/ghostify-hide-seen-typ/mgbppdkolkeelimnemlbpmfdddhoeeal';
export const GITHUB_URL = 'https://github.com/Hendrizzzz/Ghostify';

function ChromeLogo() {
  return <img className="browser-logo" src="/chrome-current.svg" alt="" />;
}

export function StoreCta({
  compact = false,
  label = 'Add to Chrome',
  showFree = false,
}: {
  compact?: boolean;
  label?: string;
  showFree?: boolean;
}) {
  return (
    <a
      className={`store-cta${compact ? ' store-cta-compact' : ''}`}
      href={CHROME_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      <ChromeLogo />
      {label}
      {showFree && <span aria-hidden="true">— Free</span>}
      <ArrowUpRight size={compact ? 15 : 17} strokeWidth={1.8} aria-hidden="true" />
    </a>
  );
}

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const publicStatus = getPublicReleaseStatus();
  const statusTone = publicStatus === 'maintainer_verified' || publicStatus === 'community_verified_reviewed'
    ? 'good'
    : 'warn';

  useEffect(() => {
    const update = () => setIsScrolled(window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <header className={`site-header${isScrolled ? ' is-scrolled' : ''}`}>
      <a className="brand-lockup" href="/" aria-label="Ghostify home">
        <span className="brand-mark"><GhostMark size={30} /></span>
        <span>Ghostify</span>
      </a>

      <nav className="primary-nav" aria-label="Primary navigation">
        <a href="/#features">Features</a>
        <a href="/#platforms">Platforms</a>
        <a href="/#privacy">Privacy</a>
        <a href="/status">
          <span className={`nav-status-dot nav-status-${statusTone}`} aria-hidden="true" />
          Status
        </a>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"><Github size={14} aria-hidden="true" /> GitHub</a>
      </nav>

      <details className="mobile-nav">
        <summary aria-label="Open navigation menu"><Menu size={19} aria-hidden="true" /></summary>
        <nav aria-label="Mobile navigation">
          <a className="mobile-install-link" href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer"><ChromeLogo /> Add to Chrome <ArrowUpRight size={15} aria-hidden="true" /></a>
          <a href="/#features">Features</a>
          <a href="/#platforms">Platforms</a>
          <a href="/#privacy">Privacy</a>
          <a href="/status">Status</a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
      </details>

      <StoreCta compact />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-lead">
        <a className="brand-lockup brand-lockup-footer" href="/" aria-label="Ghostify home">
          <span className="brand-mark"><GhostMark size={43} bodyColor="#ffffff" eyeColor="#0f0f0d" /></span>
          <span>Ghostify</span>
        </a>
        <p>Quiet, browser-local privacy controls for Meta web apps.</p>
      </div>

      <div className="footer-links">
        <div>
          <span className="footer-label">Product</span>
          <a href="/#features">Features</a>
          <a href="/#platforms">Platforms</a>
          <a href="/status">Verification status</a>
        </div>
        <div>
          <span className="footer-label">Trust</span>
          <a href={`${GITHUB_URL}/blob/main/PRIVACY.md`} target="_blank" rel="noopener noreferrer">Privacy policy</a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">Source on GitHub</a>
          <a href={`${GITHUB_URL}/issues/new?template=help_feedback.yml`} target="_blank" rel="noopener noreferrer">Help &amp; feedback</a>
        </div>
        <div>
          <span className="footer-label">Install</span>
          <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">Chrome Web Store</a>
          <a href={EDGE_STORE_URL} target="_blank" rel="noopener noreferrer">Microsoft Edge</a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Ghostify</span>
        <span className="footer-open-source"><Github size={13} aria-hidden="true" /> MIT-licensed Core</span>
        <span className="footer-independent"><ShieldCheck size={13} aria-hidden="true" /> Independent project — not affiliated with Meta</span>
      </div>
    </footer>
  );
}
