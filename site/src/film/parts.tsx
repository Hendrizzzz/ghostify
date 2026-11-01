import type { ReactNode } from 'react';
import { GhostSilhouette } from '../components/Ghost';
import { FOOTAGE, type Footage } from './Clip';
import { at, type Key } from './layout';

/* A line that rises out of a mask. */
export function Line({ children }: { children: ReactNode }) {
  return (
    <span className="rise">
      <span>{children}</span>
    </span>
  );
}

export function Speaker() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

/* Light thrown by a screen: a tiny still of it, stretched and masked soft.
   Painted as a background so the browser never treats it as a picture. */
export function Glow({ at: key, src }: { at: Key; src: string }) {
  return (
    <div
      className="glow at"
      style={at(key, { backgroundImage: `url(${src})` })}
      aria-hidden="true"
    />
  );
}

/* The wide: three real screens on a floor. `decor` is the second take used
   inside the browser window, hidden from assistive tech. */
export function World({ decor = false }: { decor?: boolean }) {
  const far = (key: 'w0' | 'w1' | 'w2', f: Footage, name: string) => (
    <div className={`far ${key} at`} style={at(key)}>
      <img src={f.still} alt={decor ? '' : name} loading="lazy" />
      <img className="far-reflect" src={f.still} alt="" aria-hidden="true" loading="lazy" />
    </div>
  );
  return (
    <div className="world" aria-hidden={decor || undefined}>
      <Glow at="wGlow0" src={FOOTAGE.instagram.glow} />
      <Glow at="wGlow1" src={FOOTAGE.messenger.glow} />
      <Glow at="wGlow2" src={FOOTAGE.facebook.glow} />
      {far('w0', FOOTAGE.instagram, 'Instagram')}
      {far('w1', FOOTAGE.messenger, 'Messenger')}
      {far('w2', FOOTAGE.facebook, 'Facebook')}
      <div className="floor" aria-hidden="true" />
      <div className="w-ghost at" style={at('wGhost')}>
        <GhostSilhouette rim="top" />
      </div>
    </div>
  );
}
