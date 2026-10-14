import { Analytics } from '@vercel/analytics/react';
import { createRoot } from 'react-dom/client';
import Site from './cinema';
import { ErrorBoundary } from './cinema/ErrorBoundary';
import './cinema/base.css';

createRoot(document.getElementById('root')!).render(
  <>
    <ErrorBoundary>
      <Site path={location.pathname.replace(/\/+$/, '') || '/'} />
    </ErrorBoundary>
    <Analytics />
  </>,
);
