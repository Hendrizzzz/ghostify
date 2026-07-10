import { useEffect } from 'react';
import { HomePage } from './components/HomePage';
import { SiteFooter, SiteHeader } from './components/SiteChrome';
import { StatusPage } from './components/StatusPage';

export default function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const statusView = pathname === '/status/history' ? 'history' : pathname === '/status' ? 'current' : null;

  useEffect(() => {
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    let title = 'Ghostify — Read now. Reply when you’re ready.';
    let copy = 'Free, open-source browser privacy controls for supported Seen, Typing, and Story View signals on Instagram, Messenger, and Facebook.';
    let url = 'https://ghostify-extension.vercel.app/';

    if (statusView === 'history') {
      title = 'Status history — Ghostify';
      copy = 'Dated Ghostify verification windows, platform-change reports, and public status history.';
      url = 'https://ghostify-extension.vercel.app/status/history';
    } else if (statusView === 'current') {
      title = 'Public verification status — Ghostify';
      copy = 'Current, time-limited public verification for Ghostify controls on supported Meta web apps.';
      url = 'https://ghostify-extension.vercel.app/status';
    }

    document.title = title;
    description?.setAttribute('content', copy);
    canonical?.setAttribute('href', url);
    ogTitle?.setAttribute('content', title);
    ogDescription?.setAttribute('content', copy);
    ogUrl?.setAttribute('content', url);
  }, [statusView]);

  return (
    <div className={`site-root${statusView ? ' is-status-view' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <SiteHeader />
      <main id="main-content">
        {statusView ? <StatusPage view={statusView} /> : <HomePage />}
      </main>
      <SiteFooter />
    </div>
  );
}
