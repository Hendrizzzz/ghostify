import { useEffect } from 'react';
import Landing from './Landing';
import Status from './Status';
import './site.css';

const ORIGIN = 'https://ghostify-extension.vercel.app';

const PAGES = {
  '/': {
    title: 'Ghostify — Read now. Reply when you’re ready.',
    description:
      'A free, open-source browser extension that hides your Seen, Typing, and Story View signals on Instagram, Messenger, and Facebook.',
  },
  '/status': {
    title: 'Status — Ghostify',
    description:
      'The latest maintainer-approved status for each Ghostify switch on Instagram, Messenger, and Facebook.',
  },
  '/status/history': {
    title: 'Status history — Ghostify',
    description: 'Dated Ghostify verification checks, platform-change reports, and releases.',
  },
} as const;

type Route = keyof typeof PAGES;

function setMeta(selector: string, attribute: string, value: string) {
  document.querySelector(selector)?.setAttribute(attribute, value);
}

export default function Site({ path }: { path: string }) {
  const route: Route = path in PAGES ? (path as Route) : '/';

  useEffect(() => {
    document.documentElement.classList.add('is-site');
  }, []);

  useEffect(() => {
    const { title, description } = PAGES[route];
    const url = `${ORIGIN}${route === '/' ? '/' : route}`;
    document.title = title;
    setMeta('meta[name="description"]', 'content', description);
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);
  }, [route]);

  return (
    <div className="site">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {route === '/status' ? (
        <Status base="" view="current" />
      ) : route === '/status/history' ? (
        <Status base="" view="history" />
      ) : (
        <Landing base="" />
      )}
    </div>
  );
}
