import type { ReactNode } from 'react';
/* The mark as a vector, sharp on any screen. */
import mark from './mark.svg';

export const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/ghostify-hide-seen-typing/flpnibonbhdmnpgflnbemgghghhblmpm';
export const EDGE_STORE_URL =
  'https://microsoftedge.microsoft.com/addons/detail/ghostify-hide-seen-typ/mgbppdkolkeelimnemlbpmfdddhoeeal';
export const FIREFOX_STORE_URL =
  'https://addons.mozilla.org/en-US/firefox/addon/ghostify-privacy-controls/';
export const GITHUB_URL = 'https://github.com/Hendrizzzz/Ghostify';

export type Store = {
  key: 'chrome' | 'edge' | 'firefox';
  name: string;
  url: string;
  logo: string;
};

export const STORES: Store[] = [
  { key: 'chrome', name: 'Chrome', url: CHROME_STORE_URL, logo: '/chrome-current.svg' },
  { key: 'edge', name: 'Edge', url: EDGE_STORE_URL, logo: '/edge-current.svg' },
  { key: 'firefox', name: 'Firefox', url: FIREFOX_STORE_URL, logo: '/firefox-current.svg' },
];

/* The visitor's own browser first; all three always shown. */
export function orderedStores(): Store[] {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const first = /Firefox\//.test(ua) ? 'firefox' : /Edg\//.test(ua) ? 'edge' : 'chrome';
  return [...STORES].sort((a, b) => (a.key === first ? -1 : b.key === first ? 1 : 0));
}

export function StoreButtons({ stores }: { stores: Store[] }) {
  return (
    <div className="stores">
      {stores.map((s, i) => (
        <a
          key={s.key}
          className={`store${i === 0 ? ' is-primary' : ''}`}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={s.logo} alt="" width={22} height={22} />
          Add to {s.name}
        </a>
      ))}
    </div>
  );
}

export function Header({ store, base, extra }: { store: Store; base: string; extra?: ReactNode }) {
  return (
    <header className="bar">
      <a className="wordmark" href={base || '/'}>
        <img src={mark} alt="" width={24} height={24} />
        <span className="wordmark-name">Ghostify</span>
      </a>
      <nav aria-label="Primary">
        <a href={`${base}/status`}>Status</a>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          Source
        </a>
        {extra}
        <a className="bar-cta" href={store.url} target="_blank" rel="noopener noreferrer">
          Add to {store.name}
        </a>
      </nav>
    </header>
  );
}

/* `credits` sets the footer as the last lines of the landing's end credits. */
export function Footer({ base, credits = false }: { base: string; credits?: boolean }) {
  return (
    <footer className={`foot${credits ? ' is-credits' : ''}`}>
      <a className="wordmark" href={base || '/'}>
        <img src={mark} alt="" width={20} height={20} />
        Ghostify
      </a>
      <nav aria-label="Footer">
        <a href={`${base}/status`}>Status</a>
        <a href={`${GITHUB_URL}/blob/main/PRIVACY.md`} target="_blank" rel="noopener noreferrer">
          Privacy
        </a>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          Source
        </a>
        <a
          href={`${GITHUB_URL}/issues/new?template=help_feedback.yml`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Help
        </a>
      </nav>
      <p>Not affiliated with Meta.</p>
    </footer>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="site">{children}</div>;
}
