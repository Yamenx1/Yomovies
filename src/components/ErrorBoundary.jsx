import React from 'react';

/**
 * ErrorBoundary — Catches render-time crashes and shows the actual error
 * message instead of a blank white page.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('YoMovies crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      const { error } = this.state;
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#151A24',
            color: '#f5f0e8',
            fontFamily: "'Inter', system-ui, sans-serif",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 560 }}>
            <h1 style={{ fontSize: 20, margin: '0 0 12px' }}>
              😕 YoMovies failed to start
            </h1>
            <pre
              style={{
                background: '#00000055',
                border: '1px solid #ffffff22',
                borderRadius: 8,
                padding: 12,
                fontSize: 13,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {String(error?.message ?? error)}
            </pre>
            <p style={{ fontSize: 13, opacity: 0.7 }}>
              Screenshot this message and send it over — it tells us exactly
              what's missing. A reload sometimes helps too.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#e8b34b',
                color: '#151A24',
                border: 'none',
                borderRadius: 8,
                padding: '10px 22px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
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
