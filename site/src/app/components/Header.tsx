import { GhostMark } from './GhostSVG';
import { Github } from 'lucide-react';

const navItems = [
  { label: 'Features', href: '#features', mobileLabel: 'Features' },
  { label: 'Platforms', href: '#platforms', mobileLabel: 'Apps' },
  { label: 'Privacy', href: '#limits', mobileLabel: 'Privacy' },
];

let activeScrollFrame = 0;
let restoreScrollBehavior: (() => void) | null = null;

function cancelActiveScroll() {
  cancelAnimationFrame(activeScrollFrame);
  activeScrollFrame = 0;

  if (restoreScrollBehavior) {
    restoreScrollBehavior();
    restoreScrollBehavior = null;
  }
}

function smoothScrollTo(targetTop: number, nextUrl: string) {
  cancelActiveScroll();

  const maxScrollTop = document.documentElement.scrollHeight - window.innerHeight;
  const endTop = Math.max(0, Math.min(targetTop, maxScrollTop));
  const startTop = window.scrollY;
  const distance = endTop - startTop;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion || Math.abs(distance) < 1) {
    window.scrollTo(0, endTop);
    window.history.pushState(null, '', nextUrl);
    return;
  }

  const html = document.documentElement;
  const previousScrollBehavior = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  restoreScrollBehavior = () => {
    html.style.scrollBehavior = previousScrollBehavior;
  };

  const startedAt = performance.now();
  const duration = Math.min(950, Math.max(680, Math.abs(distance) * 0.24));

  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = Math.sin((progress * Math.PI) / 2);

    window.scrollTo(0, startTop + distance * eased);

    if (progress < 1) {
      activeScrollFrame = requestAnimationFrame(tick);
      return;
    }

    window.scrollTo(0, endTop);
    cancelActiveScroll();
    window.history.pushState(null, '', nextUrl);
  };

  activeScrollFrame = requestAnimationFrame(tick);
}

function scrollToSection(href: string) {
  if (window.location.pathname !== '/') {
    window.location.href = `/${href}`;
    return;
  }

  const target = document.querySelector<HTMLElement>(href);
  if (!target) {
    return;
  }

  const scrollMarginTop = parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
  const targetTop = target.getBoundingClientRect().top + window.scrollY - scrollMarginTop;
  smoothScrollTo(targetTop, href);
}

export function Header() {
  return (
    <header
      className="site-header"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 500,
        background: 'transparent',
        borderBottom: '1px solid transparent',
        backdropFilter: 'none',
      }}
    >
      <div className="site-header-shade" aria-hidden="true" />
      <div
        className="site-nav-frame"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 28px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          isolation: 'isolate',
        }}
      >
        {/* Logo + wordmark */}
        <button
          type="button"
          onClick={() => {
            if (window.location.pathname !== '/') {
              window.location.href = '/';
              return;
            }
            smoothScrollTo(0, '/');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            textDecoration: 'none',
            position: 'relative',
            zIndex: 1,
            textShadow: '0 1px 14px rgba(0,0,0,0.55)',
          }}
        >
          <GhostMark size={22} />
          <span
            style={{
              fontFamily: 'var(--g-display)',
              fontSize: 18,
              fontWeight: 500,
              color: 'var(--g-white)',
              letterSpacing: '0.01em',
              lineHeight: 1,
            }}
          >
            Ghostify
          </span>
        </button>

        {/* Nav links */}
        <nav
          className="site-nav"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 32,
            height: '100%',
            padding: '0 2px 0 28px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              data-mobile-label={item.mobileLabel}
              onClick={() => scrollToSection(item.href)}
              style={{
                fontFamily: 'var(--g-sans)',
                fontSize: 15,
                fontWeight: 400,
                color: 'rgba(240, 235, 224, 0.52)',
                padding: 0,
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                textDecoration: 'none',
                letterSpacing: '0.01em',
                transition: 'color 0.18s ease',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.color = 'rgba(240, 235, 224, 0.9)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.color = 'rgba(240, 235, 224, 0.52)';
              }}
            >
              {item.label}
            </button>
          ))}
          <a
            href="https://github.com/Hendrizzzz/Ghostify"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--g-sans)',
              fontSize: 15,
              fontWeight: 400,
              color: 'rgba(240, 235, 224, 0.52)',
              textDecoration: 'none',
              letterSpacing: '0.01em',
              transition: 'color 0.18s ease',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = 'rgba(240, 235, 224, 0.9)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = 'rgba(240, 235, 224, 0.52)';
            }}
          >
            <Github size={14} strokeWidth={1.5} />
            GitHub
          </a>
        </nav>
      </div>
      <style>{`
        .site-header-shade {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 56px;
          background:
            linear-gradient(180deg, rgba(var(--g-bg-rgb), 0.66) 0%, rgba(var(--g-bg-rgb), 0.48) 64%, rgba(var(--g-bg-rgb), 0.12) 100%);
          box-shadow:
            0 4px 12px rgba(0, 0, 0, 0.1);
          pointer-events: none;
          z-index: 0;
        }
        .site-nav-frame > button,
        .site-nav button,
        .site-nav a {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
        }
        @media (max-width: 640px) {
          .site-header-shade {
            top: 0;
            height: 56px;
            background:
              linear-gradient(180deg, rgba(var(--g-bg-rgb), 0.7) 0%, rgba(var(--g-bg-rgb), 0.5) 66%, rgba(var(--g-bg-rgb), 0.1) 100%);
          }
          .site-nav-frame {
            padding: 0 18px !important;
          }
          .site-nav {
            gap: 10px !important;
            padding-left: 12px !important;
          }
          .site-nav button,
          .site-nav a {
            font-size: 12px !important;
          }
          .site-nav a:last-child {
            display: none !important;
          }
        }
        @media (max-width: 560px) {
          .site-nav button:nth-of-type(3) {
            display: none !important;
          }
        }
        @media (max-width: 520px) {
          .site-nav-frame {
            padding: 0 14px !important;
          }
          .site-nav {
            display: none !important;
          }
        }
        @media (max-width: 360px) {
          .site-nav-frame {
            padding: 0 10px !important;
          }
          .site-nav {
            gap: 2px !important;
            padding-left: 4px !important;
          }
          .site-nav button[data-mobile-label] {
            padding: 0 2px !important;
          }
          .site-nav button[data-mobile-label]::before {
            font-size: 10.5px;
          }
        }
        @media (max-width: 430px) {
          .site-nav {
            display: none !important;
          }
          .site-nav button:nth-of-type(3),
          .site-nav a:last-child {
            display: none !important;
          }
        }
        @media (max-width: 340px) {
          .site-nav-frame > button {
            min-width: 44px !important;
          }
          .site-nav-frame > button span {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
