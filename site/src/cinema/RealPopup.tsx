import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import popupHtml from '../../../dist/popup.html?raw';
import popupCss from '../../../dist/css/popup.css?raw';
import mark from './mark.svg';
import { STATUS_DATA } from '../app/statusData';

/* The shipped extension popup, embedded 1:1: the same markup and stylesheet
   the extension uses, inside a shadow root so neither side leaks styles.
   Only the scripts are left out; the page drives the switches. */

export const SWITCH_IDS = [
  'ig-seen',
  'ig-typing',
  'ig-story',
  'msg-seen',
  'msg-typing',
  'msg-story',
] as const;

const VERIFIED = new Set(['maintainer_verified', 'community_verified_reviewed']);

/* Mirrors popup.js: the pill shows the latest status record's short date. */
function statusPill() {
  const record = (
    STATUS_DATA as unknown as { history?: Array<Record<string, string>> }
  ).history?.find(
    (r) => r?.date && r?.publicStatus && r.eventType !== 'release' && r.eventType !== 'fix',
  );
  const verified =
    STATUS_DATA.release.matchesVerificationBuild !== false &&
    !!record &&
    VERIFIED.has(record.publicStatus);
  const date = record ? new Date(record.date) : null;
  const label =
    date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
      : 'Review';
  return { tone: verified ? 'verified' : 'review', label };
}

function shellMarkup() {
  const main = popupHtml.match(/<main[\s\S]*<\/main>/)?.[0] ?? '';
  const pill = statusPill();
  return main
    .replace('src="icons/icon32.png"', `src="${mark}"`)
    .replace('data-status="review"', `data-status="${pill.tone}"`)
    .replace('>Review</span>', `>${pill.label}</span>`)
    .replace(
      '<span id="version-number"></span>',
      `<span id="version-number">v${STATUS_DATA.productVersion}</span>`,
    );
}

function shellStyles() {
  return popupCss
    .replace(/:root\s*\{/, ':host {')
    .replace(/html,\s*body\s*\{/, '.popup-root {')
    .replace(/(^|\n)body\s*\{/, '$1.popup-root {');
}

/* Page-only emphasis for the row being explained. */
const EMPHASIS = `
  :host { display: block; }
  .header-icon { opacity: var(--icon-op, 1); }
  .popup-root { border-radius: 14px; overflow: hidden; }
  .row { transition: background-color 260ms ease, box-shadow 260ms ease; }
  .row.is-focus { background: rgba(170, 152, 238, 0.12); box-shadow: inset 2px 0 0 #aa98ee; }
  .platform { transition: opacity 260ms ease; }
  .popup-root.is-dimmed .platform:not(.is-focus) { opacity: 0.38; }
`;

export type RealPopupHandle = {
  setSwitches: (on: readonly boolean[]) => void;
  focusRow: (index: number) => void;
  focusGroup: (group: number) => void;
  iconRect: () => DOMRect | null;
};

export const RealPopup = forwardRef<RealPopupHandle, { className?: string }>(function RealPopup(
  { className },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const root = useRef<ShadowRoot | null>(null);

  useEffect(() => {
    const el = host.current!;
    const shadow = el.shadowRoot ?? el.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${shellStyles()}${EMPHASIS}</style><div class="popup-root">${shellMarkup()}</div>`;
    root.current = shadow;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      setSwitches(on) {
        const s = root.current;
        if (!s) return;
        SWITCH_IDS.forEach((id, i) => {
          const input = s.getElementById(id) as HTMLInputElement | null;
          if (input && input.checked !== !!on[i]) input.checked = !!on[i];
        });
      },
      focusRow(index) {
        const s = root.current;
        if (!s) return;
        SWITCH_IDS.forEach((id, i) => {
          s.getElementById(id)
            ?.closest('.row')
            ?.classList.toggle('is-focus', i === index);
        });
      },
      iconRect() {
        return root.current?.querySelector('.header-icon')?.getBoundingClientRect() ?? null;
      },
      focusGroup(group) {
        const s = root.current;
        if (!s) return;
        s.querySelector('.popup-root')?.classList.toggle('is-dimmed', group >= 0);
        s.querySelectorAll('.platform').forEach((p, i) =>
          p.classList.toggle('is-focus', i === group),
        );
      },
    }),
    [],
  );

  // Decorative replica: the real controls live in the extension.
  return <div ref={host} className={className} aria-hidden="true" inert />;
});
