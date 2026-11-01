import type { ReactNode } from 'react';
/* The mark as a vector, sharp on any screen. */
import mark from '../assets/mark.svg';
import { GITHUB_URL, type Store } from '../lib/links';

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
