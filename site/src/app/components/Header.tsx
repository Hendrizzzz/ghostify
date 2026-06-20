import { GhostMark } from './GhostSVG';
import { Github } from 'lucide-react';

const navItems = [
  { label: 'Features', href: '#features', mobileLabel: 'Features' },
  { label: 'Platforms', href: '#platforms', mobileLabel: 'Apps' },
  { label: 'Privacy', href: '#privacy', mobileLabel: 'Privacy' },
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
          maxWidth: 1120,
          margin: '14px auto 0',
          padding: '0 18px',
          height: 58,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          isolation: 'isolate',
          background: 'rgba(247, 244, 232, 0.92)',
          border: '1px solid rgba(20, 18, 14, 0.14)',
          borderRadius: 10,
          boxShadow: '0 14px 42px rgba(21, 17, 11, 0.12), 0 1px 0 rgba(255,255,255,0.56) inset',
          backdropFilter: 'blur(14px)',
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
            textShadow: 'none',
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: '#17130F',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 0 rgba(255,255,255,0.1) inset',
            }}
          >
            <GhostMark size={17} />
          </span>
          <span
            style={{
              fontFamily: 'var(--g-display)',
              fontSize: 18,
              fontWeight: 500,
              color: '#17130F',
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
                fontSize: 13.5,
                fontWeight: 400,
                color: 'rgba(23, 19, 15, 0.62)',
                padding: 0,
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                textDecoration: 'none',
                letterSpacing: '0.01em',
                transition: 'color 0.18s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'rgba(23, 19, 15, 0.94)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'rgba(23, 19, 15, 0.62)';
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
              fontSize: 13.5,
              fontWeight: 400,
              color: 'rgba(23, 19, 15, 0.62)',
              textDecoration: 'none',
              letterSpacing: '0.01em',
              transition: 'color 0.18s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'rgba(23, 19, 15, 0.94)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'rgba(23, 19, 15, 0.62)';
            }}
          >
            <Github size={14} strokeWidth={1.5} />
            GitHub
          </a>
        </nav>
      </div>
      <style>{`
        .site-header-shade {
          display: none;
        }
        .site-nav-frame > button,
        .site-nav button,
        .site-nav a {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
        }
        @media (max-width: 640px) {
          .site-nav-frame {
            margin: 10px 10px 0 !important;
            padding: 0 14px !important;
            height: 54px !important;
          }
          .site-nav {
            gap: 10px !important;
            padding-left: 12px !important;
          }
          .site-nav button,
          .site-nav a {
            font-size: 12px !important;
          }
        }
        @media (max-width: 520px) {
          .site-nav-frame {
            padding: 0 14px !important;
          }
          .site-nav {
            gap: 5px !important;
            padding-left: 8px !important;
          }
          .site-nav button,
          .site-nav a {
            justify-content: center !important;
          }
          .site-nav button[data-mobile-label] {
            min-width: 44px !important;
            padding: 0 3px !important;
            font-size: 0 !important;
          }
          .site-nav button[data-mobile-label]::before {
            content: attr(data-mobile-label);
            font-size: 11px;
            line-height: 1;
          }
          .site-nav a:last-child {
            width: 44px !important;
            min-height: 44px !important;
            justify-content: center !important;
            gap: 0 !important;
            font-size: 0 !important;
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
