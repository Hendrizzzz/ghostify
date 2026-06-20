import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Clock3, History, ShieldCheck } from 'lucide-react';
import {
  STATUS_DATA,
  STATUS_LABELS,
  VerificationEntry,
  formatStatusDate,
  getEffectiveStatus,
  getWorstStatus,
} from '../statusData';

type StatusPageProps = {
  view: 'current' | 'history';
};

const STATUS_STYLE = {
  maintainer_verified: { color: '#6bd081', border: 'rgba(107,208,129,0.34)', bg: 'rgba(107,208,129,0.09)' },
  community_verified_reviewed: { color: '#88d39b', border: 'rgba(136,211,155,0.32)', bg: 'rgba(136,211,155,0.08)' },
  under_review: { color: '#f0c47a', border: 'rgba(240,196,122,0.34)', bg: 'rgba(240,196,122,0.08)' },
  not_recently_verified: { color: '#b8b0ae', border: 'rgba(240,230,210,0.18)', bg: 'rgba(240,230,210,0.04)' },
  known_issue: { color: '#ff8d7f', border: 'rgba(255,141,127,0.34)', bg: 'rgba(255,141,127,0.08)' },
  stale: { color: '#d4a57a', border: 'rgba(212,165,122,0.34)', bg: 'rgba(212,165,122,0.08)' },
  public_status_unavailable: { color: '#b8b0ae', border: 'rgba(240,230,210,0.18)', bg: 'rgba(240,230,210,0.04)' },
} as const;

function groupByPlatform(entries: readonly VerificationEntry[]) {
  return entries.reduce<Record<string, VerificationEntry[]>>((groups, entry) => {
    groups[entry.platform] = groups[entry.platform] || [];
    groups[entry.platform].push(entry);
    return groups;
  }, {});
}

function StatusBadge({ status }: { status: keyof typeof STATUS_LABELS }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 24,
        padding: '4px 8px',
        border: `1px solid ${style.border}`,
        borderRadius: 999,
        color: style.color,
        background: style.bg,
        fontFamily: 'var(--g-mono)',
        fontSize: 10.5,
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function StatusIcon({ status }: { status: keyof typeof STATUS_LABELS }) {
  if (status === 'maintainer_verified' || status === 'community_verified_reviewed') {
    return <CheckCircle2 size={16} strokeWidth={1.7} />;
  }
  if (status === 'known_issue') {
    return <AlertTriangle size={16} strokeWidth={1.7} />;
  }
  if (status === 'stale' || status === 'not_recently_verified') {
    return <Clock3 size={16} strokeWidth={1.7} />;
  }
  return <ShieldCheck size={16} strokeWidth={1.7} />;
}

function CurrentStatus() {
  const now = new Date();
  const worstStatus = getWorstStatus(STATUS_DATA.entries, now);
  const grouped = groupByPlatform(STATUS_DATA.entries);

  return (
    <>
      <div className="status-topline">
        <div>
          <div className="status-eyebrow">Verification Status</div>
          <h1>Ghostify Verification Status</h1>
          <p>
            Public verification separates local extension loading checks from reviewed sender-side or story-owner proof.
            A local popup check means Ghostify is loaded here; it is not a guarantee that every live platform signal was
            just verified.
          </p>
        </div>
        <div className="status-summary-panel">
          <div className="status-summary-head">
            <StatusIcon status={worstStatus} />
            <StatusBadge status={worstStatus} />
          </div>
          <p>{STATUS_DATA.summary.message}</p>
          <div className="status-meta-row">
            <CalendarDays size={14} strokeWidth={1.6} />
            <span>Generated {formatStatusDate(STATUS_DATA.generatedAt)}</span>
          </div>
        </div>
      </div>

      <section className="status-section" aria-labelledby="matrix-heading">
        <div className="status-section-head">
          <h2 id="matrix-heading">Current public checks</h2>
          <a href="/status/history">
            <History size={14} strokeWidth={1.6} />
            History
          </a>
        </div>

        <div className="status-platforms">
          {Object.entries(grouped).map(([platform, entries]) => (
            <div className="status-platform" key={platform}>
              <h3>{platform}</h3>
              {entries.map((entry) => {
                const effectiveStatus = getEffectiveStatus(entry, now);
                return (
                  <div className="status-entry" key={entry.id}>
                    <div>
                      <div className="status-feature">{entry.feature}</div>
                      <p>{entry.notes}</p>
                    </div>
                    <div className="status-entry-meta">
                      <StatusBadge status={effectiveStatus} />
                      <span>Verified: {formatStatusDate(entry.verifiedAt)}</span>
                      <span>Expires: {formatStatusDate(entry.expiresAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="status-section" aria-labelledby="guardrails-heading">
        <div className="status-section-head">
          <h2 id="guardrails-heading">Verification guardrails</h2>
        </div>
        <div className="guardrail-grid">
          <p>Community reports are reviewed before they can make a public status green.</p>
          <p>Contributor credit is opt-in only and handled separately from whether a report is useful.</p>
          <p>Screenshots and recordings must be redacted. Do not include private messages or credentials.</p>
          <p>Automation may flag, summarize, or downgrade status. It cannot mark a live feature verified.</p>
        </div>
        <div className="status-actions-row">
          <a href="https://github.com/Hendrizzzz/Ghostify/issues/new?template=bug_report.yml" target="_blank" rel="noopener noreferrer">
            Report broken
          </a>
          <a href="https://github.com/Hendrizzzz/Ghostify/issues/new?template=help_feedback.yml" target="_blank" rel="noopener noreferrer">
            Help verify
          </a>
        </div>
      </section>
    </>
  );
}

function HistoryStatus() {
  return (
    <>
      <div className="status-topline">
        <div>
          <a className="status-back-link" href="/status">
            <ArrowLeft size={14} strokeWidth={1.7} />
            Current status
          </a>
          <div className="status-eyebrow">Verification History</div>
          <h1>Status history</h1>
          <p>
            Reviewed changes, known limitations, and release verification updates are recorded here. Raw submissions and
            private evidence are not published.
          </p>
        </div>
      </div>

      <section className="status-section" aria-labelledby="history-heading">
        <div className="status-history-list" id="history-heading">
          {STATUS_DATA.history.map((item) => (
            <article className="status-history-item" key={`${item.date}-${item.title}`}>
              <div className="status-history-date">{formatStatusDate(item.date)}</div>
              <div>
                <h2>{item.title}</h2>
                <p>{item.summary}</p>
              </div>
              <StatusBadge status={item.publicStatus} />
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export function StatusPage({ view }: StatusPageProps) {
  return (
    <section className="status-page" aria-label="Ghostify public verification status">
      <a className="status-back-link" href="/">
        <ArrowLeft size={14} strokeWidth={1.7} />
        Ghostify home
      </a>

      {view === 'history' ? <HistoryStatus /> : <CurrentStatus />}

      <style>{`
        .status-page {
          min-height: 100svh;
          width: 100%;
          max-width: 1120px;
          margin: 0 auto;
          padding: 116px clamp(22px, 4vw, 48px) 80px;
          box-sizing: border-box;
        }
        .status-back-link,
        .status-section-head a,
        .status-actions-row a {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: rgba(240,230,210,0.56);
          font-family: var(--g-mono);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-decoration: none;
        }
        .status-back-link:hover,
        .status-section-head a:hover,
        .status-actions-row a:hover {
          color: var(--g-white);
          text-decoration: underline;
          text-underline-offset: 4px;
        }
        .status-topline {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 360px);
          gap: clamp(28px, 5vw, 64px);
          align-items: end;
          margin-top: 28px;
        }
        .status-eyebrow {
          margin-bottom: 14px;
          color: var(--g-dim);
          font-family: var(--g-mono);
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .status-page h1 {
          margin: 0;
          color: var(--g-white);
          font-family: var(--g-sans);
          font-size: clamp(2.1rem, 5vw, 4.35rem);
          font-weight: 500;
          line-height: 0.98;
          letter-spacing: 0;
        }
        .status-page h2,
        .status-page h3 {
          margin: 0;
          color: var(--g-white);
          font-family: var(--g-sans);
          font-weight: 500;
          letter-spacing: 0;
        }
        .status-page h2 {
          font-size: 20px;
        }
        .status-page h3 {
          font-size: 16px;
        }
        .status-page p {
          margin: 16px 0 0;
          max-width: 680px;
          color: var(--g-body);
          font-family: var(--g-sans);
          font-size: 14px;
          line-height: 1.7;
        }
        .status-summary-panel {
          border: 1px solid rgba(240,230,210,0.08);
          border-radius: 8px;
          padding: 16px;
          background: rgba(240,230,210,0.025);
        }
        .status-summary-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: rgba(240,230,210,0.72);
        }
        .status-meta-row {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 16px;
          color: rgba(240,230,210,0.34);
          font-family: var(--g-mono);
          font-size: 10.5px;
          letter-spacing: 0.03em;
        }
        .status-section {
          margin-top: clamp(42px, 7vw, 72px);
        }
        .status-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(240,230,210,0.09);
        }
        .status-platforms {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          margin-top: 18px;
        }
        .status-platform {
          border: 1px solid rgba(240,230,210,0.08);
          border-radius: 8px;
          background: rgba(240,230,210,0.018);
          overflow: hidden;
        }
        .status-platform h3 {
          padding: 14px 14px 12px;
          border-bottom: 1px solid rgba(240,230,210,0.07);
        }
        .status-entry {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 12px;
          padding: 14px;
          border-bottom: 1px solid rgba(240,230,210,0.06);
        }
        .status-entry:last-child {
          border-bottom: 0;
        }
        .status-feature {
          color: rgba(240,230,210,0.88);
          font-family: var(--g-sans);
          font-size: 14px;
          font-weight: 600;
        }
        .status-entry p {
          margin-top: 5px;
          color: rgba(240,230,210,0.46);
          font-size: 12.5px;
          line-height: 1.5;
        }
        .status-entry-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px;
          color: rgba(240,230,210,0.3);
          font-family: var(--g-mono);
          font-size: 10px;
          letter-spacing: 0.02em;
        }
        .guardrail-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1px;
          margin-top: 18px;
          border: 1px solid rgba(240,230,210,0.08);
          border-radius: 8px;
          overflow: hidden;
          background: rgba(240,230,210,0.08);
        }
        .guardrail-grid p {
          min-height: 112px;
          margin: 0;
          padding: 16px;
          background: var(--g-bg);
          font-size: 13px;
          line-height: 1.6;
        }
        .status-actions-row {
          display: flex;
          gap: 18px;
          margin-top: 18px;
          flex-wrap: wrap;
        }
        .status-history-list {
          border-top: 1px solid rgba(240,230,210,0.08);
        }
        .status-history-item {
          display: grid;
          grid-template-columns: 132px minmax(0, 1fr) auto;
          gap: 22px;
          align-items: start;
          padding: 22px 0;
          border-bottom: 1px solid rgba(240,230,210,0.08);
        }
        .status-history-date {
          color: rgba(240,230,210,0.35);
          font-family: var(--g-mono);
          font-size: 11px;
          letter-spacing: 0.04em;
        }
        .status-history-item p {
          margin-top: 8px;
          font-size: 13.5px;
        }
        @media (max-width: 920px) {
          .status-topline,
          .status-platforms,
          .guardrail-grid {
            grid-template-columns: 1fr;
          }
          .guardrail-grid p {
            min-height: 0;
          }
        }
        @media (max-width: 640px) {
          .status-page {
            padding-top: 96px;
          }
          .status-history-item {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }
      `}</style>
    </section>
  );
}
