import { useEffect, useRef } from 'react';
import { PlatformLogo, type MetaPlatform } from './PlatformLogo';
import { formatStatusDate, getStatusCredit } from '../app/statusData';
import { FOOTAGE } from './Clip';
import { Ghost } from './Ghost';
import { RealPopup, type RealPopupHandle } from './RealPopup';
import { GITHUB_URL, StoreButtons, type Store } from './Shell';

/* The film as a plain stacked page, for reduced motion or when the film
   cannot run: still frames from the real footage, one line each, normal
   scroll, no autoplay, and sound only if the visitor turns it on. */

const STATUS_CREDIT = getStatusCredit();

const FRAMES = [
  {
    src: FOOTAGE.messenger.still,
    alt: 'A real Messenger chat being read with Ghostify on',
    line: 'You read it. They never get a Seen.',
    more: 'Messenger and Instagram chats stay unread on their side.',
  },
  {
    src: '/media/messenger-typing.webp',
    alt: 'A real Messenger reply being typed with Hide Typing on',
    line: 'Type, delete, rethink. No dots.',
    more: 'Your typing indicator stays off while you write.',
  },
  {
    src: FOOTAGE.instagram.still,
    alt: 'A real Instagram story, watched with Ghostify on',
    line: 'Watch the story. Your name stays off the viewer list.',
    more: 'Instagram and Facebook stories, without your view being sent.',
  },
];

const MARKS: ReadonlyArray<readonly [MetaPlatform, string]> = [
  ['instagram', 'Instagram'],
  ['messenger', 'Messenger'],
  ['facebook', 'Facebook'],
];

export function Stills({ stores, base }: { stores: Store[]; base: string }) {
  const popup = useRef<RealPopupHandle>(null);

  useEffect(() => {
    popup.current?.setSwitches([true, true, true, true, true, true]);
  }, []);

  return (
    <section className="stills" aria-label="Ghostify, in still frames">
      <div className="stills-hero">
        <div className="stills-ghost">
          <Ghost still label="The Ghostify ghost" />
        </div>
        <h1>Read without sending Seen.</h1>
        <p>
          A free browser extension that hides your Seen, Typing, and Story View signals on
          Instagram, Messenger, and Facebook.
        </p>
        <StoreButtons stores={stores} />
      </div>

      <div className="stills-frames">
        {FRAMES.map((f) => (
          <figure key={f.line}>
            <img src={f.src} alt={f.alt} loading="lazy" />
            <figcaption>
              <span>{f.line}</span>
              <span>{f.more}</span>
            </figcaption>
          </figure>
        ))}
        <figure>
          <div className="stills-popup">
            <RealPopup ref={popup} />
          </div>
          <figcaption>
            <span>Pick what to hide.</span>
            <span>Instagram gets its own switches. Messenger and Facebook share theirs.</span>
          </figcaption>
        </figure>
      </div>

      <div className="stills-local">
        <ul className="stills-marks" aria-label="Works on">
          {MARKS.map(([platform, name]) => (
            <li key={platform}>
              <PlatformLogo platform={platform} size={36} />
              <span>{name}</span>
            </li>
          ))}
        </ul>
        <p>
          No account. No servers.{' '}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            Open source.
          </a>
        </p>
        <a
          className={`local-credit ${STATUS_CREDIT.verified ? 'is-ok' : 'is-review'}`}
          href={`${base}/status`}
        >
          <span>{STATUS_CREDIT.label}</span>{' '}
          <time dateTime={STATUS_CREDIT.updatedAt ?? undefined}>
            {formatStatusDate(STATUS_CREDIT.updatedAt)}
          </time>
        </a>
      </div>

      <div className="stills-end" id="install">
        <div className="stills-ghost">
          <Ghost still eyes="happy" label="The ghost, eyes closed and smiling" />
        </div>
        <h2>
          Read now.
          <br />
          Reply when you’re ready.
        </h2>
        <StoreButtons stores={stores} />
      </div>
    </section>
  );
}
