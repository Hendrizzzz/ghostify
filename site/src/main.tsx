import { Analytics } from '@vercel/analytics/react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { ErrorBoundary } from './app/components/ErrorBoundary';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <Analytics />
  </>,
);
