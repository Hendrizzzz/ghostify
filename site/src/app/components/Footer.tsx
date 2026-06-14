import { GhostMark } from './GhostSVG';
import { Github } from 'lucide-react';

export function Footer() {
  return (
    <footer
      style={{
        padding: '32px 28px',
        borderTop: '1px solid rgba(240,230,210,0.05)',
        maxWidth: 1280,
        margin: '0 auto',
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
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GhostMark size={18} />
          <span
            style={{
              fontFamily: 'var(--g-display)',
              fontSize: 16,
              fontWeight: 500,
              color: 'rgba(240,230,210,0.4)',
              letterSpacing: '0.01em',
            }}
          >
            Ghostify
          </span>
        </div>

        {/* Center: tagline */}
        <span
          style={{
            fontFamily: 'var(--g-mono)',
            fontSize: 11,
            color: 'var(--g-dim)',
            letterSpacing: '0.06em',
            textAlign: 'center',
          }}
        >
          open source · no account · local controls · no tracking server
        </span>

        {/* GitHub */}
        <a
          href="https://github.com/Hendrizzzz/Ghostify"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--g-mono)',
            fontSize: 11,
            color: 'var(--g-dim)',
            textDecoration: 'none',
            letterSpacing: '0.04em',
            transition: 'color 0.18s ease',
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.color = 'var(--g-body)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.color = 'var(--g-dim)')
          }
        >
          <Github size={13} strokeWidth={1.5} />
          GitHub
        </a>
      </div>

      <div
        style={{
          marginTop: 20,
          fontFamily: 'var(--g-mono)',
          fontSize: 10,
          color: 'rgba(240,230,210,0.15)',
          letterSpacing: '0.04em',
          textAlign: 'center',
        }}
      >
        Not affiliated with Meta · Independent open-source project
      </div>
    </footer>
  );
}
