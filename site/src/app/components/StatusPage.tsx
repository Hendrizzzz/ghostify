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
import { useMemo, useState } from 'react';
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
  known_issue: { short: 'Known issue', tone: 'bad' },
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
        <h1>{heading}</h1>
        <p>{message}</p>
        {releaseMismatch && (
          <p className="status-secondary-warning">
            Chrome Web Store v{STATUS_DATA.release.publishedVersion} does not include live popup status yet. You can continue checking this page for updates.
          </p>
        )}
        {releaseMismatch && (
          <a className="status-release-link" href={STATUS_DATA.release.storeUrl} target="_blank" rel="noopener noreferrer">
            Open the Chrome Web Store listing <ExternalLink size={13} strokeWidth={1.8} />
          </a>
        )}
        <div className="status-notice-meta">
          <span>{STATUS_LABELS[overallStatus]} {formatStatusDate(STATUS_DATA.generatedAt)}</span>
          <span>{STATUS_DATA.policy.verificationCadence}</span>
        </div>
      </div>
    </section>
  );
}

type TimelineTone = 'clear' | 'issue' | 'review' | 'quiet' | 'outside' | 'upcoming';

type TimelineDay = {
  date: string;
  tone: TimelineTone;
  label: string;
  detail: string;
  hasUpdate: boolean;
  updateLabel: string | null;
  column: number;
  row: number;
};

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toneForStatus(status: PublicVerificationStatus): TimelineTone {
  if (status === 'known_issue') return 'issue';
  if (status === 'under_review' || status === 'work_in_progress') return 'review';
  if (status === 'maintainer_verified' || status === 'community_verified_reviewed') return 'clear';
  return 'quiet';
}

function isProductUpdate(event: (typeof STATUS_DATA.history)[number]) {
  return event.eventType === 'release' || event.eventType === 'fix';
}

function statusPriority(event: (typeof STATUS_DATA.history)[number]) {
  const tone = toneForStatus(event.publicStatus);
  if (tone === 'issue') return 3;
  if (tone === 'review') return 2;
  if (tone === 'clear') return 1;
  return 0;
}

function primaryEventForDay(events: (typeof STATUS_DATA.history)[number][]) {
  const explicitStatusEvents = events.filter((event) => !isProductUpdate(event));
  const candidates = explicitStatusEvents.length ? explicitStatusEvents : events;
  return candidates.reduce((selected, event) => (
    statusPriority(event) > statusPriority(selected) ? event : selected
  ));
}

function buildTimelineDays(year: number, today: Date): TimelineDay[] {
  const launchTime = Date.parse(`${STATUS_DATA.release.publishedAt}T00:00:00Z`);
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const calendarStart = new Date(yearStart);
  calendarStart.setUTCDate(calendarStart.getUTCDate() - calendarStart.getUTCDay());
  const events = STATUS_DATA.history
    .map((event, sourceIndex) => ({ event, sourceIndex }))
    .sort((left, right) => {
      const dateOrder = Date.parse(left.event.date) - Date.parse(right.event.date);
      return dateOrder || right.sourceIndex - left.sourceIndex;
    })
    .map(({ event }) => event);
  const eventsByDate = new Map<string, (typeof STATUS_DATA.history)[number][]>();
  STATUS_DATA.history.forEach((event) => {
    eventsByDate.set(event.date, [...(eventsByDate.get(event.date) ?? []), event]);
  });
  const cellCount = 54 * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const current = new Date(calendarStart);
    current.setUTCDate(calendarStart.getUTCDate() + index);
    const date = toDateKey(current);
    const time = current.getTime();
    const inYear = current.getUTCFullYear() === year;
    const dayEvents = eventsByDate.get(date) ?? [];
    const event = dayEvents.length ? primaryEventForDay(dayEvents) : null;
    const productUpdate = dayEvents.find(isProductUpdate) ?? null;
    const latestEvent = events.filter((item) => Date.parse(item.date) <= time).at(-1);
    let tone: TimelineTone = 'quiet';
    let label = 'No status update recorded';
    let detail = 'There was no public status update recorded for this day.';

    if (!inYear || time < launchTime) {
      tone = 'outside';
      label = time < launchTime ? 'Before the Chrome Web Store launch' : 'Outside this year';
      detail = time < launchTime
        ? `Ghostify launched on the Chrome Web Store on ${formatStatusDate(STATUS_DATA.release.publishedAt)}.`
        : 'This date is outside the selected year.';
    } else if (time > today.getTime()) {
      tone = 'upcoming';
      label = 'Upcoming date';
      detail = 'No status is available for a future date.';
    } else if (latestEvent) {
      tone = toneForStatus(latestEvent.publicStatus);
      label = tone === 'clear' ? 'No known issue recorded' : tone === 'issue' ? 'Known issue' : 'Under review';
      detail = tone === 'clear'
        ? 'No newer issue was recorded after the latest status update.'
        : latestEvent.summary;
    }

    if (event) {
      tone = toneForStatus(event.publicStatus);
      label = event.title;
      detail = event.summary;
    }

    return {
      date,
      tone,
      label,
      detail,
      hasUpdate: Boolean(productUpdate),
      updateLabel: productUpdate && productUpdate !== event ? productUpdate.title : null,
      column: Math.floor(index / 7) + 1,
      row: (index % 7) + 1,
    };
  });
}

function VerificationTimeline() {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }, []);
  const launchYear = new Date(`${STATUS_DATA.release.publishedAt}T00:00:00Z`).getUTCFullYear();
  const currentYear = Math.max(launchYear, today.getUTCFullYear());
  const years = Array.from({ length: currentYear - launchYear + 1 }, (_, index) => currentYear - index);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const days = useMemo(() => buildTimelineDays(selectedYear, today), [selectedYear, today]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selected = selectedDate
    ? days.find((day) => day.date === selectedDate && day.date.startsWith(`${selectedYear}-`)) ?? null
    : null;
  const latestUpdate = STATUS_DATA.history[0];
  const latestDay = days.find((day) => day.date === latestUpdate.date) ?? null;
  const detail = selected ?? latestDay ?? {
    date: latestUpdate.date,
    tone: toneForStatus(latestUpdate.publicStatus),
    label: latestUpdate.title,
    detail: latestUpdate.summary,
    hasUpdate: isProductUpdate(latestUpdate),
    updateLabel: null,
  };
  const months = useMemo(() => Array.from({ length: 12 }, (_, month) => {
    const first = new Date(Date.UTC(selectedYear, month, 1));
    const firstFullWeek = new Date(first);
    firstFullWeek.setUTCDate(first.getUTCDate() + ((7 - first.getUTCDay()) % 7));
    const firstCell = days.find((day) => day.date === toDateKey(firstFullWeek));
    return {
      label: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(first),
      column: firstCell?.column ?? 1,
    };
  }), [days, selectedYear]);

  const changeYear = (year: number) => {
    setSelectedYear(year);
    setSelectedDate(null);
  };

  return (
    <div className="status-timeline" aria-label="Dated verification timeline">
      <div className="status-timeline-head">
        <div>
          <strong>Status calendar</strong>
          <span>From the Chrome Web Store launch to today</span>
        </div>
        <div className="status-timeline-years" aria-label="Choose a status year">
          {years.map((year) => (
            <button type="button" className={year === selectedYear ? 'is-active' : undefined} onClick={() => changeYear(year)} key={year}>
              {year}
            </button>
          ))}
        </div>
      </div>
      <div className="status-timeline-legend" aria-hidden="true">
        <span className="is-clear">No known issue</span>
        <span className="is-update">Product update</span>
        <span className="is-review">Under review</span>
        <span className="is-issue">Known issue</span>
        <span className="is-quiet">No update</span>
      </div>
      <div className="status-calendar-wrap">
        <div className="status-calendar-months" aria-hidden="true">
          {months.map((month) => <span style={{ gridColumn: month.column }} key={month.label}>{month.label}</span>)}
        </div>
        <div className="status-calendar-body">
          <div className="status-calendar-weekdays" aria-hidden="true"><span>Mon</span><span>Wed</span><span>Fri</span></div>
          <div className={`status-calendar-days${selectedDate ? ' has-selection' : ''}`}>
            {days.map((day) => (
              <button
                type="button"
                className={`status-calendar-day is-${day.tone}${day.hasUpdate ? ' has-update' : ''}${selectedDate === day.date ? ' is-selected' : ''}${day.column <= 3 ? ' is-tooltip-left' : ''}${day.column >= 52 ? ' is-tooltip-right' : ''}`}
                style={{ gridColumn: day.column, gridRow: day.row }}
                aria-label={`${formatStatusDate(day.date)}: ${day.label}${day.updateLabel ? `. Product update: ${day.updateLabel}` : ''}`}
                aria-pressed={selectedDate === day.date}
                onClick={() => setSelectedDate((current) => current === day.date ? null : day.date)}
                key={day.date}
              >
                <span className="status-calendar-tooltip" role="tooltip">
                  <b>{formatStatusDate(day.date)}</b>{day.label}
                  {day.updateLabel && <em>Product update · {day.updateLabel}</em>}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={`status-timeline-detail is-${detail.tone}`} aria-live="polite">
        <time>{formatStatusDate(detail.date)}</time>
        <div className="status-timeline-detail-title">
          <strong>{detail.label}</strong>
          {detail.updateLabel && <span>Product update · {detail.updateLabel}</span>}
        </div>
        <p>{detail.detail}</p>
      </div>
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
      <VerificationTimeline />
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
      Dated checks are shown here so you can see what was known, and when it was known.
    </p>
  );
}

type HistoryItem = (typeof STATUS_DATA.history)[number];

function buildVisibleHistory(): HistoryItem[] {
  return [...STATUS_DATA.history];
}

function buildHistoryGroups() {
  const groups = new Map<string, HistoryItem[]>();
  buildVisibleHistory().forEach((item) => {
    const key = item.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return [...groups.entries()].map(([key, items]) => ({
    key,
    label: new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${key}-01T00:00:00Z`)),
    items,
  }));
}

function CurrentStatus() {
  return (
    <>
      <div className="status-utility-row">
        <a className="status-home-link" href="/"><ArrowLeft size={15} /> Back to Ghostify</a>
        <a className="status-history-link" href="/status/history">View history</a>
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
      <a className="status-home-link" href="/status"><ArrowLeft size={15} /> Current status</a>
      <section className="status-panel" aria-labelledby="history-heading">
        <div className="status-panel-head">
          <h1 id="history-heading">Verification history</h1>
          <span>Public record</span>
        </div>
        <div className="status-history-list">
          {buildHistoryGroups().map((group) => (
            <section className="status-history-group" aria-labelledby={`history-${group.key}`} key={group.key}>
              <h3 id={`history-${group.key}`}>{group.label}</h3>
              {group.items.map((item) => (
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
            </section>
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
        .status-utility-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 24px;
        }
        .status-history-link,
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
        .status-history-link:hover,
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
        .status-notice h1 {
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
