import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ghostify site crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '60vh',
            display: 'grid',
            placeItems: 'center',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.6rem', marginBottom: '12px' }}>Something went wrong.</h1>
            <p style={{ color: 'inherit', opacity: 0.7, marginBottom: '20px' }}>
              Reload the page, or check the{' '}
              <a href="/status" style={{ color: '#6856b0' }}>
                status page
              </a>
              .
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 22px',
                borderRadius: 999,
                border: '1px solid #0f0f0d',
                background: '#0f0f0d',
                color: '#fbf8f0',
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
