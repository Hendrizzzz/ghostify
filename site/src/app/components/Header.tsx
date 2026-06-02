import { GhostMark } from './GhostSVG';
import { Github } from 'lucide-react';

const navItems = [
  { label: 'Features', href: '#features', mobileLabel: 'Features' },
  { label: 'Platforms', href: '#platforms', mobileLabel: 'Apps' },
  { label: 'Privacy', href: '#privacy', mobileLabel: 'Privacy' },
];

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
        <a
          href="#hero"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
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
        </a>

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
            <a
              key={item.label}
              href={item.href}
              data-mobile-label={item.mobileLabel}
              style={{
                fontFamily: 'var(--g-sans)',
                fontSize: 13.5,
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
              {item.label}
            </a>
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
            linear-gradient(180deg, rgba(8, 8, 7, 0.56) 0%, rgba(8, 8, 7, 0.42) 64%, rgba(8, 8, 7, 0.1) 100%);
          box-shadow:
            0 4px 12px rgba(0, 0, 0, 0.1);
          pointer-events: none;
          z-index: 0;
        }
        .site-nav-frame > a,
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
              linear-gradient(180deg, rgba(8, 8, 7, 0.6) 0%, rgba(8, 8, 7, 0.44) 66%, rgba(8, 8, 7, 0.08) 100%);
          }
          .site-nav-frame {
            padding: 0 18px !important;
          }
          .site-nav {
            gap: 10px !important;
            padding-left: 12px !important;
          }
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
          .site-nav a {
            justify-content: center !important;
          }
          .site-nav a[data-mobile-label] {
            min-width: 44px !important;
            padding: 0 3px !important;
            font-size: 0 !important;
          }
          .site-nav a[data-mobile-label]::before {
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
          .site-nav a[data-mobile-label] {
            padding: 0 2px !important;
          }
          .site-nav a[data-mobile-label]::before {
            font-size: 10.5px;
          }
        }
        @media (max-width: 340px) {
          .site-nav-frame > a {
            min-width: 44px !important;
          }
          .site-nav-frame > a span {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
