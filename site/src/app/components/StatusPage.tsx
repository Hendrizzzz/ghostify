import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  HelpCircle,
  History,
  Info,
} from 'lucide-react';
import {
  STATUS_DATA,
  STATUS_LABELS,
  formatStatusDate,
  getEffectiveStatus,
  getPublicReleaseStatus,
  getWorstStatus,
  type PublicVerificationStatus,
  type VerificationEntry,
} from '../statusData';

type StatusPageProps = {
  view: 'current' | 'history';
};

type PlatformName = VerificationEntry['platform'];
type FeatureName = VerificationEntry['feature'];

const PLATFORMS: Array<{ name: PlatformName; componentLabel: string }> = [
  { name: 'Instagram', componentLabel: '3 controls' },
  { name: 'Messenger', componentLabel: '3 controls' },
  { name: 'Facebook', componentLabel: '3 controls' },
];

const FEATURES: FeatureName[] = ['Hide Seen', 'Hide Typing', 'Hide Story Views'];

const STATUS_META: Record<
  PublicVerificationStatus,
  {
    short: string;
    tone: 'ok' | 'warn' | 'bad' | 'muted';
  }
> = {
  maintainer_verified: { short: 'Working', tone: 'ok' },
  community_verified_reviewed: { short: 'Working', tone: 'ok' },
  under_review: { short: 'Under review', tone: 'warn' },
  work_in_progress: { short: 'Working on it', tone: 'warn' },
  known_issue: { short: 'Known issue', tone: 'warn' },
  public_status_unavailable: { short: 'Unavailable', tone: 'muted' },
};

function groupByPlatform(entries: readonly VerificationEntry[]) {
  return entries.reduce<Record<PlatformName, VerificationEntry[]>>(
    (groups, entry) => {
      groups[entry.platform].push(entry);
      return groups;
    },
    { Instagram: [], Messenger: [], Facebook: [] },
  );
}

function getPlatformWorstStatus(entries: readonly VerificationEntry[]) {
  return getWorstStatus(entries);
}

function getFeatureEntry(entries: readonly VerificationEntry[], feature: FeatureName) {
  return entries.find((entry) => entry.feature === feature) || null;
}

function formatStatusDetail(entry: VerificationEntry | null) {
  if (!entry) return 'No public record';
  const status = getEffectiveStatus(entry);
  const isVerified = status === 'maintainer_verified' || status === 'community_verified_reviewed';
  if (entry.verifiedAt) return `${isVerified ? 'Verified' : 'Last verified'} ${formatStatusDate(entry.verifiedAt)}`;
  return STATUS_META[status].short;
}

function PlatformLogo({ platform }: { platform: PlatformName }) {
  if (platform === 'Instagram') {
    return (
      <svg className="status-platform-logo" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="26" height="26" rx="8" fill="url(#statusInstagramGradient)" />
        <rect x="9.4" y="9.4" width="13.2" height="13.2" rx="4" stroke="white" strokeWidth="2.2" />
        <circle cx="16" cy="16" r="3.8" stroke="white" strokeWidth="2.2" />
        <circle cx="21.2" cy="10.9" r="1.45" fill="white" />
        <defs>
          <linearGradient id="statusInstagramGradient" x1="6" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FEDA75" />
            <stop offset="0.32" stopColor="#FA7E1E" />
            <stop offset="0.62" stopColor="#D62976" />
            <stop offset="1" stopColor="#4F5BD5" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (platform === 'Messenger') {
    return (
      <svg className="status-platform-logo" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M16 4C9.1 4 4 8.75 4 15.15c0 3.45 1.48 6.45 3.95 8.45v4.1c0 .72.77 1.18 1.39.82l3.55-2.05c1 .25 2.05.38 3.11.38 6.9 0 12-4.75 12-11.7S22.9 4 16 4Z"
          fill="url(#statusMessengerGradient)"
        />
        <path d="M9.2 18.8 14 13.7l3.42 3.52 5.38-5.52-4.8 7.88-3.52-3.52-5.28 2.74Z" fill="white" />
        <defs>
          <linearGradient id="statusMessengerGradient" x1="5" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0078FF" />
            <stop offset="0.55" stopColor="#00C6FF" />
            <stop offset="1" stopColor="#A033FF" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  return (
    <svg className="status-platform-logo" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="7" fill="#1877F2" />
      <path
        d="M18.25 27.2v-9.55h3.2l.48-3.72h-3.68v-2.38c0-1.08.3-1.82 1.85-1.82h1.98V6.4c-.34-.05-1.52-.15-2.88-.15-2.85 0-4.8 1.74-4.8 4.94v2.74h-3.23v3.72h3.23v9.55h3.85Z"
        fill="white"
      />
    </svg>
  );
}

function StatusIcon({ status, size = 16 }: { status: PublicVerificationStatus; size?: number }) {
  const tone = STATUS_META[status].tone;
  if (tone === 'ok') return <CheckCircle2 size={size} strokeWidth={2} />;
  if (tone === 'bad') return <AlertTriangle size={size} strokeWidth={2} />;
  if (tone === 'warn') return <Clock3 size={size} strokeWidth={2} />;
  return <HelpCircle size={size} strokeWidth={1.8} />;
}

function StatusPill({ status, label }: { status: PublicVerificationStatus; label?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={`status-pill status-${meta.tone}`}>
      <StatusIcon status={status} size={14} />
      {label ?? meta.short}
    </span>
  );
}

function CurrentNotice() {
  const overallStatus = getPublicReleaseStatus();
  const meta = STATUS_META[overallStatus];
  const releaseMismatch = !STATUS_DATA.release.matchesVerificationBuild;
  const label = STATUS_LABELS[overallStatus];
  const heading = STATUS_DATA.summary.label;
  const message = STATUS_DATA.summary.message;

  return (
    <section className={`status-notice status-notice-${meta.tone}`} aria-label="Current status summary">
      <div className="status-notice-head">
        <StatusIcon status={overallStatus} size={18} />
        <strong>{label}</strong>
      </div>
      <div className="status-notice-body">
        <div className="status-version-row">
          <span className="status-version-pill">Verification build v{STATUS_DATA.productVersion}</span>
          <span className="status-version-pill">Store v{STATUS_DATA.release.publishedVersion}</span>
        </div>
        <h2>{heading}</h2>
        <p>{message}</p>
        {releaseMismatch && (
          <p className="status-secondary-warning">
            The Store also publishes v{STATUS_DATA.release.publishedVersion}, while these records describe repository build v{STATUS_DATA.productVersion}.
          </p>
        )}
        {releaseMismatch && (
          <a className="status-release-link" href={STATUS_DATA.release.storeUrl} target="_blank" rel="noopener noreferrer">
            Open the Chrome Web Store listing <ExternalLink size={13} strokeWidth={1.8} />
          </a>
        )}
        <div className="status-notice-meta">
          <span>{STATUS_LABELS[overallStatus]}</span>
          <span>Generated {formatStatusDate(STATUS_DATA.generatedAt)}</span>
          <span>Store checked {formatStatusDate(STATUS_DATA.release.checkedAt)}</span>
          <span>{STATUS_DATA.policy.verificationCadence}</span>
        </div>
      </div>
    </section>
  );
}

function StatusRail({ entries }: { entries: readonly VerificationEntry[] }) {
  const segments = FEATURES.flatMap((feature) => {
    const entry = getFeatureEntry(entries, feature);
    const status = entry ? getEffectiveStatus(entry) : 'public_status_unavailable';
    const tone = STATUS_META[status].tone;
    return Array.from({ length: 10 }, (_, index) => (tone === 'warn' && index % 3 !== 0 ? 'muted' : tone));
  });

  return (
    <div className="status-rail" aria-hidden="true">
      {segments.map((tone, index) => (
        <span className={`status-rail-segment status-rail-${tone}`} key={index} />
      ))}
    </div>
  );
}

function PlatformRow({ platform, entries }: { platform: (typeof PLATFORMS)[number]; entries: VerificationEntry[] }) {
  const platformStatus = getPlatformWorstStatus(entries);
  const verifiedBuildOnly = !STATUS_DATA.release.matchesVerificationBuild && (
    platformStatus === 'maintainer_verified' || platformStatus === 'community_verified_reviewed'
  );

  return (
    <article className="status-platform-row">
      <div className="status-platform-main">
        <PlatformLogo platform={platform.name} />
        <div>
          <div className="status-platform-title">
            <strong>{platform.name}</strong>
            <StatusPill
              status={platformStatus}
              label={verifiedBuildOnly ? `Verified in v${STATUS_DATA.productVersion}` : undefined}
            />
          </div>
          <div className="status-platform-sub">
            <span>{platform.componentLabel}</span>
            <Info size={13} strokeWidth={1.7} />
          </div>
        </div>
      </div>

      <StatusRail entries={entries} />

      <div className="status-feature-list">
        {FEATURES.map((feature) => {
          const entry = getFeatureEntry(entries, feature);
          const status = entry ? getEffectiveStatus(entry) : 'public_status_unavailable';
          return (
            <div className="status-feature-row" key={feature}>
              <span>{feature}</span>
              <span className={`status-feature-state status-${STATUS_META[status].tone}`}>{formatStatusDetail(entry)}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function SystemStatus() {
  const grouped = groupByPlatform(STATUS_DATA.entries);

  return (
    <section className="status-panel" aria-labelledby="system-status-heading">
      <div className="status-panel-head">
        <h2 id="system-status-heading">Verification build checks</h2>
        <span>Repository v{STATUS_DATA.productVersion}</span>
      </div>
      <div className="status-platform-list">
        {PLATFORMS.map((platform) => (
          <PlatformRow key={platform.name} platform={platform} entries={grouped[platform.name]} />
        ))}
      </div>
    </section>
  );
}

function StatusActions() {
  return (
    <div className="status-actions">
      <a href="/status/history">
        <History size={16} strokeWidth={1.8} />
        View history
      </a>
      <a href="https://github.com/Hendrizzzz/Ghostify/issues/new?template=bug_report.yml" target="_blank" rel="noopener noreferrer">
        <ExternalLink size={16} strokeWidth={1.8} />
        Report an issue
      </a>
    </div>
  );
}

function StatusFootnote() {
  return (
    <p className="status-footnote">
      Status is public and evidence is reviewed before a feature turns green. Private messages, credentials, screenshots,
      and raw submissions are never published.
    </p>
  );
}

type HistoryItem = (typeof STATUS_DATA.history)[number];

function buildVisibleHistory(): HistoryItem[] {
  return [...STATUS_DATA.history];
}

function CurrentStatus() {
  return (
    <>
      <div className="status-topbar">
        <h1>Ghostify Status</h1>
        <a href="/status/history">View history</a>
      </div>
      <CurrentNotice />
      <SystemStatus />
      <StatusActions />
      <StatusFootnote />
    </>
  );
}

function HistoryStatus() {
  return (
    <>
      <div className="status-topbar">
        <h1>Status history</h1>
        <a href="/status">
          <ArrowLeft size={15} strokeWidth={1.8} />
          Current status
        </a>
      </div>
      <section className="status-panel" aria-labelledby="history-heading">
        <div className="status-panel-head">
          <h2 id="history-heading">Verification history</h2>
          <span>Public record</span>
        </div>
        <div className="status-history-list">
          {buildVisibleHistory().map((item) => (
            <article className="status-history-row" key={`${item.date}-${item.title}`}>
              <StatusIcon status={item.publicStatus} size={16} />
              <time>{formatStatusDate(item.date)}</time>
              <div>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
              </div>
              <StatusPill status={item.publicStatus} />
            </article>
          ))}
        </div>
      </section>
      <StatusFootnote />
    </>
  );
}

export function StatusPage({ view }: StatusPageProps) {
  return (
    <section className="status-page" aria-label="Ghostify public verification status">
      <div className="status-shell">{view === 'history' ? <HistoryStatus /> : <CurrentStatus />}</div>

      <style>{`
        .status-page {
          --status-red: #f1bd4b;
          --status-red-soft: rgba(241, 189, 75, 0.12);
          --status-red-border: rgba(241, 189, 75, 0.4);
          --status-red-text: #f1bd4b;
          --status-surface: rgba(20,18,16,0.92);
          --status-surface-soft: rgba(239,226,208,0.04);
          --status-line: rgba(239,226,208,0.1);
          --status-line-strong: rgba(239,226,208,0.16);
          --status-text: rgba(239,226,208,0.86);
          --status-muted: rgba(239,226,208,0.58);
          --status-faint: rgba(239,226,208,0.42);
          min-height: 100svh;
          width: 100%;
          padding: 92px 20px 72px;
          box-sizing: border-box;
          color: var(--g-white);
        }
        .status-shell {
          width: min(100%, 720px);
          margin: 0 auto;
        }
        .status-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 24px;
        }
        .status-topbar h1 {
          margin: 0;
          font-family: var(--g-sans);
          font-size: 1.7rem;
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: 0;
          color: var(--g-white);
        }
        .status-topbar a,
        .status-actions a {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 14px;
          border: 1px solid var(--status-line-strong);
          border-radius: 6px;
          background: var(--status-surface-soft);
          color: var(--status-text);
          font-family: var(--g-sans);
          font-size: 0.9rem;
          font-weight: 650;
          text-decoration: none;
        }
        .status-topbar a:hover,
        .status-actions a:hover {
          border-color: var(--status-red-border);
          color: var(--g-white);
          background: var(--status-red-soft);
        }
        .status-notice,
        .status-panel {
          overflow: hidden;
          border: 1px solid var(--status-line);
          border-radius: 8px;
          background: var(--status-surface);
          box-shadow: 0 16px 44px rgba(0,0,0,0.3);
        }
        .status-notice {
          margin-bottom: 26px;
        }
        .status-notice-warn {
          border-color: var(--status-red-border);
        }
        .status-notice-bad {
          border-color: var(--status-red-border);
        }
        .status-notice-ok {
          border-color: rgba(117,216,141,0.36);
        }
        .status-notice-head {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 54px;
          padding: 0 18px;
          border-bottom: 1px solid var(--status-line);
          background: var(--status-red-soft);
          color: var(--status-red-text);
          font-family: var(--g-sans);
          font-size: 0.98rem;
        }
        .status-notice-body {
          padding: 18px;
        }
        .status-version-pill {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 9px;
          border-radius: 5px;
          background: var(--status-red-soft);
          color: var(--status-red-text);
          font-family: var(--g-sans);
          font-size: 0.78rem;
          font-weight: 700;
        }
        .status-version-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .status-release-link {
          min-height: 38px;
          margin-top: 12px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--status-red-text);
          font-family: var(--g-sans);
          font-size: 0.8rem;
          font-weight: 700;
          text-underline-offset: 4px;
        }
        .status-secondary-warning {
          padding: 9px 11px;
          border-left: 2px solid var(--status-red-text);
          background: var(--status-red-soft);
          color: var(--status-text) !important;
        }
        .status-notice h2 {
          margin: 18px 0 0;
          color: var(--g-white);
          font-family: var(--g-sans);
          font-size: 1rem;
          font-weight: 700;
          line-height: 1.35;
          letter-spacing: 0;
        }
        .status-notice p,
        .status-history-row p,
        .status-footnote {
          margin: 8px 0 0;
          color: rgba(239,226,208,0.7);
          font-family: var(--g-sans);
          font-size: 0.91rem;
          line-height: 1.55;
          letter-spacing: 0;
        }
        .status-notice-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px 10px;
          margin-top: 12px;
          color: var(--status-muted);
          font-family: var(--g-sans);
          font-size: 0.84rem;
          line-height: 1.45;
        }
        .status-notice-meta span:not(:last-child)::after {
          content: "";
          display: inline-block;
          width: 3px;
          height: 3px;
          margin-left: 10px;
          vertical-align: middle;
          border-radius: 999px;
          background: rgba(239,226,208,0.24);
        }
        .status-panel {
          margin-top: 0;
        }
        .status-panel-head {
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 18px;
          border-bottom: 1px solid var(--status-line);
        }
        .status-panel-head h2 {
          margin: 0;
          color: var(--g-white);
          font-family: var(--g-sans);
          font-size: 1rem;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: 0;
        }
        .status-panel-head span {
          color: var(--status-faint);
          font-family: var(--g-sans);
          font-size: 0.86rem;
        }
        .status-platform-row {
          padding: 16px 18px;
          border-bottom: 1px solid var(--status-line);
        }
        .status-platform-row:last-child {
          border-bottom: 0;
        }
        .status-platform-main {
          display: flex;
          align-items: center;
          gap: 13px;
        }
        .status-platform-logo {
          width: 30px;
          height: 30px;
          flex: 0 0 auto;
        }
        .status-platform-title {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 9px;
        }
        .status-platform-title strong,
        .status-history-row strong {
          color: var(--g-white);
          font-family: var(--g-sans);
          font-size: 0.95rem;
          font-weight: 700;
          line-height: 1.25;
        }
        .status-platform-sub {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          color: var(--status-muted);
          font-family: var(--g-sans);
          font-size: 0.86rem;
          line-height: 1.35;
        }
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 24px;
          padding: 0 8px;
          border-radius: 999px;
          border: 1px solid var(--status-line);
          background: var(--status-surface-soft);
          font-family: var(--g-sans);
          font-size: 0.78rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .status-ok {
          color: #75D88D;
        }
        .status-warn {
          color: var(--status-red-text);
        }
        .status-bad {
          color: var(--status-red);
        }
        .status-muted {
          color: var(--status-muted);
        }
        .status-rail {
          display: grid;
          grid-template-columns: repeat(30, minmax(3px, 1fr));
          gap: 3px;
          margin-top: 13px;
        }
        .status-rail-segment {
          height: 14px;
          border-radius: 2px;
          background: rgba(239,226,208,0.09);
        }
        .status-rail-ok {
          background: #54C786;
        }
        .status-rail-warn {
          background: var(--status-red);
        }
        .status-rail-bad {
          background: var(--status-red);
        }
        .status-rail-muted {
          background: rgba(239,226,208,0.12);
        }
        .status-feature-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 12px;
        }
        .status-feature-row {
          min-width: 0;
          color: var(--status-muted);
          font-family: var(--g-sans);
          font-size: 0.8rem;
          line-height: 1.35;
        }
        .status-feature-row span {
          display: block;
        }
        .status-feature-state {
          margin-top: 2px;
          font-weight: 650;
        }
        .status-actions {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin: 28px 0 0;
          flex-wrap: wrap;
        }
        .status-footnote {
          max-width: 640px;
          margin: 36px auto 0;
          color: var(--status-faint);
          text-align: center;
          font-size: 0.78rem;
        }
        .status-history-list {
          display: grid;
        }
        .status-history-row {
          display: grid;
          grid-template-columns: 20px 104px minmax(0, 1fr) auto;
          gap: 12px;
          align-items: start;
          padding: 16px 18px;
          border-bottom: 1px solid var(--status-line);
        }
        .status-history-row:last-child {
          border-bottom: 0;
        }
        .status-history-row time {
          color: var(--status-muted);
          font-family: var(--g-sans);
          font-size: 0.86rem;
          line-height: 1.3;
          white-space: nowrap;
        }
        @media (max-width: 640px) {
          .status-page {
            padding: 82px 14px 56px;
          }
          .status-topbar {
            align-items: flex-start;
            flex-direction: column;
            gap: 12px;
          }
          .status-topbar h1 {
            font-size: 1.5rem;
          }
          .status-topbar a,
          .status-actions a {
            width: 100%;
          }
          .status-notice-body,
          .status-platform-row,
          .status-panel-head,
          .status-history-row {
            padding-left: 14px;
            padding-right: 14px;
          }
          .status-feature-list {
            grid-template-columns: 1fr;
            gap: 7px;
          }
          .status-rail {
            grid-template-columns: repeat(30, 1fr);
            gap: 2px;
          }
          .status-rail-segment {
            height: 12px;
          }
          .status-history-row {
            grid-template-columns: 20px minmax(0, 1fr);
          }
          .status-history-row time,
          .status-history-row > div,
          .status-history-row .status-pill {
            grid-column: 2;
          }
          .status-history-row .status-pill {
            justify-self: start;
          }
        }
      `}</style>
    </section>
  );
}
