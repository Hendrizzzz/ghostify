import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  STATUS_DATA,
  formatStatusDate,
  getLastVerifiedAt,
  type PublicVerificationStatus,
  type VerificationEntry,
} from '../app/statusData';
import { Footer, GITHUB_URL, Header, orderedStores } from './Shell';

type Tone = 'ok' | 'review' | 'issue' | 'none';
type HistoryEvent = (typeof STATUS_DATA.history)[number];

const PLATFORMS = ['Instagram', 'Messenger', 'Facebook'] as const;
const FEATURES = ['Hide Seen', 'Hide Typing', 'Hide Story Views'] as const;

function tone(status: PublicVerificationStatus): Tone {
  if (status === 'maintainer_verified' || status === 'community_verified_reviewed') return 'ok';
  if (status === 'known_issue') return 'issue';
  if (status === 'under_review' || status === 'work_in_progress') return 'review';
  return 'none';
}

const WORD: Record<Tone, string> = {
  ok: 'Working',
  review: 'Being checked',
  issue: 'Known issue',
  none: 'No data',
};

/* A switch with a fix underway says so, rather than "Being checked". */
const cellWord = (status: PublicVerificationStatus) =>
  status === 'work_in_progress' ? 'Fix in progress' : WORD[tone(status)];

const TAG: Record<string, string> = {
  verification: 'Check',
  release: 'Release',
  incident: 'Issue',
  investigation: 'Investigating',
  fix: 'Fix',
};

const RANK: Record<Tone, number> = { issue: 3, review: 2, ok: 1, none: 0 };
const worst = (tones: Tone[]) => tones.reduce<Tone>((w, t) => (RANK[t] > RANK[w] ? t : w), 'none');

const entries = STATUS_DATA.entries as VerificationEntry[];
const history = [...STATUS_DATA.history].sort((a, b) => b.date.localeCompare(a.date));

function fmtDay(iso: string, withYear = true) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

function monthLabel(key: string) {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/* One square per day for the last 90 days. A day without a new event keeps
   the last known state, drawn lighter so the record never overstates. */
function useDays(count = 90) {
  return useMemo(() => {
    const byDay = new Map<string, HistoryEvent[]>();
    for (const e of history) {
      const list = byDay.get(e.date) ?? [];
      list.push(e);
      byDay.set(e.date, list);
    }
    const launch = STATUS_DATA.release.publishedAt;
    const today = new Date();
    const days: Array<{ date: string; tone: Tone; fresh: boolean; title: string }> = [];
    for (let i = count - 1; i >= 0; i -= 1) {
      const d = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i),
      );
      const key = d.toISOString().slice(0, 10);
      if (key < launch) {
        days.push({ date: key, tone: 'none', fresh: false, title: 'Before launch' });
        continue;
      }
      const todays = (byDay.get(key) ?? []).filter((e) => e.eventType !== 'release');
      if (todays.length) {
        const t = worst(todays.map((e) => tone(e.publicStatus)));
        const lead = todays.find((e) => tone(e.publicStatus) === t) ?? todays[0];
        days.push({ date: key, tone: t, fresh: true, title: lead.title });
      } else {
        const prior = history.find((e) => e.date < key && e.eventType !== 'release');
        days.push({
          date: key,
          tone: prior ? tone(prior.publicStatus) : 'none',
          fresh: false,
          title: prior ? 'No new check this day' : 'No data',
        });
      }
    }
    return days;
  }, [count]);
}

function DayStrip() {
  const days = useDays();
  const [active, setActive] = useState(days.length - 1);
  const day = days[active];
  const checks = days.filter((d) => d.fresh).length;
  const last = days.length - 1;
  /* One control for the whole strip: the pointer picks the day under it,
     the arrow keys step through them. */
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) / r.width) * days.length);
    setActive(Math.max(0, Math.min(last, i)));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const to =
      e.key === 'ArrowLeft' || e.key === 'ArrowDown'
        ? active - 1
        : e.key === 'ArrowRight' || e.key === 'ArrowUp'
          ? active + 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : e.key === 'PageUp'
                ? active + 7
                : e.key === 'PageDown'
                  ? active - 7
                  : null;
    if (to === null) return;
    e.preventDefault();
    setActive(Math.max(0, Math.min(last, to)));
  };
  return (
    <section className="st-block" aria-labelledby="st-days-title">
      <div className="st-block-head">
        <h2 id="st-days-title">Last 90 days</h2>
        <p>{checks} days with a new check or update</p>
      </div>
      <div
        className="st-days"
        role="slider"
        tabIndex={0}
        aria-label="Daily status for the last 90 days"
        aria-valuemin={0}
        aria-valuemax={days.length - 1}
        aria-valuenow={active}
        aria-valuetext={`${fmtDay(day.date)}: ${WORD[day.tone]}. ${day.title}`}
        onPointerMove={pick}
        onPointerDown={pick}
        onMouseLeave={() => setActive(days.length - 1)}
        onKeyDown={onKey}
      >
        {days.map((d, i) => (
          <span
            key={d.date}
            className={`st-day is-${d.tone}${d.fresh ? ' is-fresh' : ''}${i === active ? ' is-active' : ''}`}
          />
        ))}
      </div>
      <p className="st-day-detail" aria-live="polite">
        <strong>{fmtDay(day.date)}</strong>
        <span className={`st-chip is-${day.tone}`}>{WORD[day.tone]}</span>
        <span>{day.title}</span>
      </p>
      <ul className="st-legend">
        <li className="is-ok">Working</li>
        <li className="is-review">Being checked</li>
        <li className="is-issue">Known issue</li>
        <li className="is-carry">No new check, last state shown</li>
      </ul>
    </section>
  );
}

function Events({
  events,
  compactChecks,
  heading: Heading = 'h3',
}: {
  events: HistoryEvent[];
  compactChecks: boolean;
  /* Months are top-level sections on the history page. */
  heading?: 'h2' | 'h3';
}) {
  const months = new Map<string, HistoryEvent[]>();
  for (const e of events) {
    const k = e.date.slice(0, 7);
    months.set(k, [...(months.get(k) ?? []), e]);
  }
  return (
    <div className="st-months">
      {[...months.entries()].map(([key, list]) => {
        const checks = list.filter(
          (e) => e.eventType === 'verification' && tone(e.publicStatus) === 'ok',
        );
        const rest = compactChecks ? list.filter((e) => !checks.includes(e)) : list;
        return (
          <section key={key} className="st-month" aria-label={monthLabel(key)}>
            <Heading>{monthLabel(key)}</Heading>
            <ol>
              {rest.map((e, i) => (
                <li key={`${e.date}-${i}`} className={`st-event is-${tone(e.publicStatus)}`}>
                  <time dateTime={e.date}>{fmtDay(e.date, false)}</time>
                  <div>
                    <p className="st-event-title">
                      <span className="st-tag">{TAG[e.eventType] ?? 'Update'}</span>
                      {e.title}
                    </p>
                    {e.eventType !== 'verification' && <p>{e.summary}</p>}
                  </div>
                </li>
              ))}
              {compactChecks && checks.length > 0 && (
                <li className="st-event is-ok is-checks">
                  <time>
                    {checks.length === 1
                      ? fmtDay(checks[0].date, false)
                      : `${checks.length} checks`}
                  </time>
                  <div>
                    <p className="st-event-title">
                      <span className="st-tag">Check</span>
                      All switches working
                    </p>
                    <p>
                      Checked on{' '}
                      {checks
                        .map((c) => Number(c.date.slice(8, 10)))
                        .sort((a, b) => a - b)
                        .join(', ')}
                      .
                    </p>
                  </div>
                </li>
              )}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

export default function Status({ base, view }: { base: string; view: 'current' | 'history' }) {
  const [stores] = useState(orderedStores);
  const overall = worst(entries.map((e) => tone(e.publicStatus)));
  const headline = STATUS_DATA.summary.label;
  const lastChecked = formatStatusDate(getLastVerifiedAt());
  const release = STATUS_DATA.release;
  const notable = history.filter((e) => e.eventType !== 'verification').slice(0, 8);

  return (
    <>
      <Header store={stores[0]} base={base} />
      <main id="main-content" className="st">
        {view === 'history' ? (
          <>
            <a className="st-back" href={`${base}/status`}>
              Current status
            </a>
            <h1 className="st-title">Status history</h1>
            <p className="st-lede">
              Every check, release, issue, and fix since launch, newest first.
            </p>
            <Events events={history} compactChecks heading="h2" />
          </>
        ) : (
          <>
            <section className={`st-now is-${overall}`} aria-labelledby="st-now-title">
              <h1 id="st-now-title">{headline}</h1>
              <p>{STATUS_DATA.summary.message}</p>
              <dl className="st-facts">
                <div>
                  <dt>Last checked</dt>
                  <dd>{lastChecked}</dd>
                </div>
                <div>
                  <dt>Store version</dt>
                  <dd>{release.publishedVersion}</dd>
                </div>
                <div>
                  <dt>Checked version</dt>
                  <dd>{release.verificationVersion}</dd>
                </div>
              </dl>
              {!release.matchesVerificationBuild && (
                <p className="st-warn">
                  The store version is newer than the last checked version. A new check is pending.
                </p>
              )}
            </section>

            <section className="st-block" aria-labelledby="st-switches-title">
              <div className="st-block-head">
                <h2 id="st-switches-title">Switches</h2>
                <p>Checked by hand on the live sites</p>
              </div>
              <table className="st-grid">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">Platform</span>
                    </th>
                    {FEATURES.map((f) => (
                      <th scope="col" key={f}>
                        {f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PLATFORMS.map((p) => (
                    <tr key={p}>
                      <th scope="row">{p}</th>
                      {FEATURES.map((f) => {
                        const e = entries.find((x) => x.platform === p && x.feature === f);
                        const t = e ? tone(e.publicStatus) : 'none';
                        return (
                          <td key={f} data-label={f}>
                            <span className={`st-chip is-${t}`}>
                              {e ? cellWord(e.publicStatus) : WORD.none}
                            </span>
                            <small>
                              {e?.verifiedAt ? fmtDay(e.verifiedAt, false) : 'Not checked'}
                            </small>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <DayStrip />

            <section className="st-block" aria-labelledby="st-updates-title">
              <div className="st-block-head">
                <h2 id="st-updates-title">Recent updates</h2>
                <a href={`${base}/status/history`}>Full history</a>
              </div>
              <Events events={notable} compactChecks={false} />
            </section>

            <section className="st-block st-how" aria-labelledby="st-how-title">
              <h2 id="st-how-title">How this page works</h2>
              <ul>
                <li>
                  The maintainer checks each switch on the live sites and publishes the result here.
                </li>
                <li>{STATUS_DATA.policy.verificationCadence}</li>
                <li>
                  A switch stays marked working until a new check or a confirmed report changes it.
                </li>
                <li>
                  Community reports are reviewed by the maintainer before anything is marked
                  working.
                </li>
              </ul>
              <a
                className="st-report"
                href={`${GITHUB_URL}/issues/new?template=help_feedback.yml`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Report a problem
              </a>
            </section>
          </>
        )}
      </main>
      <Footer base={base} />
    </>
  );
}
