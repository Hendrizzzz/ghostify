import { Analytics } from '@vercel/analytics/react';
import { createRoot } from 'react-dom/client';
import Site from './Site';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/base.css';

createRoot(document.getElementById('root')!).render(
  <>
    <ErrorBoundary>
      <Site path={location.pathname.replace(/\/+$/, '') || '/'} />
    </ErrorBoundary>
    <Analytics />
  </>,
);
