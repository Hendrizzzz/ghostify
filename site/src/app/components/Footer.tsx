import { Github, ShieldCheck } from 'lucide-react';
import { GhostMark } from './GhostSVG';

const footerLinkStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontFamily: 'var(--g-mono)',
  fontSize: 11,
  color: 'var(--g-dim)',
  textDecoration: 'none',
  letterSpacing: '0.04em',
  transition: 'color 0.18s ease',
};

function setHoverColor(element: HTMLElement, active: boolean) {
  element.style.color = active ? 'var(--g-body)' : 'var(--g-dim)';
}

export function Footer() {
  return (
    <footer
      style={{
        padding: '32px 28px',
        borderTop: '1px solid var(--g-border-dim)',
        maxWidth: 1280,
        margin: '0 auto',
        background: 'var(--g-bg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GhostMark size={18} />
          <span
            style={{
              fontFamily: 'var(--g-display)',
              fontSize: 16,
              fontWeight: 500,
              color: 'var(--g-body)',
              letterSpacing: '0.01em',
            }}
          >
            Ghostify
          </span>
        </div>

        <span
          style={{
            fontFamily: 'var(--g-mono)',
            fontSize: 11,
            color: 'var(--g-dim)',
            letterSpacing: '0.06em',
            textAlign: 'center',
          }}
        >
          open source - no account - local controls - no tracking server
        </span>

        <nav
          aria-label="Footer links"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <a
            href="/status"
            style={footerLinkStyle}
            onMouseEnter={(e) => setHoverColor(e.currentTarget as HTMLElement, true)}
            onMouseLeave={(e) => setHoverColor(e.currentTarget as HTMLElement, false)}
          >
            <ShieldCheck size={13} strokeWidth={1.5} />
            Status
          </a>
          <a
            href="https://github.com/Hendrizzzz/Ghostify"
            target="_blank"
            rel="noopener noreferrer"
            style={footerLinkStyle}
            onMouseEnter={(e) => setHoverColor(e.currentTarget as HTMLElement, true)}
            onMouseLeave={(e) => setHoverColor(e.currentTarget as HTMLElement, false)}
          >
            <Github size={13} strokeWidth={1.5} />
            GitHub
          </a>
        </nav>
      </div>

      <div
        style={{
          marginTop: 20,
          fontFamily: 'var(--g-mono)',
          fontSize: 10,
          color: 'var(--g-dim)',
          letterSpacing: '0.04em',
          textAlign: 'center',
        }}
      >
        Not affiliated with Meta - Independent open-source project
      </div>
    </footer>
  );
}
