import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Code2, Menu, ShieldCheck } from 'lucide-react';
import { getPublicReleaseStatus } from '../statusData';
import { GhostMark } from './GhostSVG';

export const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/ghostify-hide-seen-typing/flpnibonbhdmnpgflnbemgghghhblmpm';
export const EDGE_STORE_URL =
  'https://microsoftedge.microsoft.com/addons/detail/ghostify-hide-seen-typ/mgbppdkolkeelimnemlbpmfdddhoeeal';
export const FIREFOX_STORE_URL =
  'https://addons.mozilla.org/en-US/firefox/addon/ghostify-privacy-controls/';
export const GITHUB_URL = 'https://github.com/Hendrizzzz/Ghostify';

function ChromeLogo() {
  return <img className="browser-logo" src="/chrome-current.svg" alt="" />;
}

function GitHubMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.3c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.4c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
    </svg>
  );
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const mobileNavRef = useRef<HTMLDetailsElement>(null);
  const publicStatus = getPublicReleaseStatus();
  const statusTone =
    publicStatus === 'maintainer_verified' || publicStatus === 'community_verified_reviewed'
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
        <span className="brand-mark">
          <GhostMark size={30} />
        </span>
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
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          <GitHubMark /> GitHub
        </a>
      </nav>

      <details
        className="mobile-nav"
        ref={mobileNavRef}
        onToggle={(event) => setIsMobileNavOpen(event.currentTarget.open)}
      >
        <summary
          aria-label={`${isMobileNavOpen ? 'Close' : 'Open'} navigation menu`}
          aria-expanded={isMobileNavOpen}
        >
          <Menu size={19} aria-hidden="true" />
        </summary>
        <nav
          aria-label="Mobile navigation"
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest('a')) {
              mobileNavRef.current?.removeAttribute('open');
            }
          }}
        >
          <a
            className="mobile-install-link"
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ChromeLogo /> Add to Chrome <ArrowUpRight size={15} aria-hidden="true" />
          </a>
          <a href="/#features">Features</a>
          <a href="/#platforms">Platforms</a>
          <a href="/#privacy">Privacy</a>
          <a href="/status">Status</a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
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
          <span className="brand-mark">
            <GhostMark size={43} bodyColor="#ffffff" eyeColor="#0f0f0d" />
          </span>
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
          <a href={`${GITHUB_URL}/blob/main/PRIVACY.md`} target="_blank" rel="noopener noreferrer">
            Privacy policy
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            Source on GitHub
          </a>
          <a
            href={`${GITHUB_URL}/issues/new?template=help_feedback.yml`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Help &amp; feedback
          </a>
        </div>
        <div>
          <span className="footer-label">Install</span>
          <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">
            Chrome Web Store
          </a>
          <a href={EDGE_STORE_URL} target="_blank" rel="noopener noreferrer">
            Microsoft Edge
          </a>
          <a href={FIREFOX_STORE_URL} target="_blank" rel="noopener noreferrer">
            Firefox Add-ons
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Ghostify</span>
        <span className="footer-open-source">
          <Code2 size={13} aria-hidden="true" /> MIT-licensed Core
        </span>
        <span className="footer-independent">
          <ShieldCheck size={13} aria-hidden="true" /> Independent project — not affiliated with
          Meta
        </span>
      </div>
    </footer>
  );
}
