import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('APID React Error Boundary caught:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/home';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            background: 'var(--surface-subtle, #f8fafc)',
          }}
        >
          <div
            className="apid-card"
            style={{
              maxWidth: 580,
              width: '100%',
              padding: '2rem',
              borderRadius: 12,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              background: '#fff',
              border: '1px solid var(--border, #e2e8f0)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              <AlertCircle size={32} />
            </div>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#0f172a' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              An unexpected error occurred while displaying this page.
            </p>

            {this.state.error && (
              <pre
                style={{
                  background: '#f1f5f9',
                  padding: '1rem',
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  color: '#b91c1c',
                  textAlign: 'left',
                  overflowX: 'auto',
                  marginBottom: '1.5rem',
                  border: '1px solid #cbd5e1',
                  maxHeight: 180,
                }}
              >
                {this.state.error.message}
              </pre>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="apid-btn apid-btn-outline"
                onClick={this.handleGoHome}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Home size={16} /> Return to Home
              </button>
              <button
                type="button"
                className="apid-btn apid-btn-primary"
                onClick={this.handleReload}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <RefreshCw size={16} /> Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

