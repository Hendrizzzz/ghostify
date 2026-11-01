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
