import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[skyhaven] root error boundary caught', error, info);
    // Phase 11+: forward to Crashlytics via @capacitor-firebase/crashlytics.
  }

  private reload = (): void => {
    location.reload();
  };

  private resetProgress = (): void => {
    if (confirm('Erase all local progress and reload?')) {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // ignore
      }
      location.reload();
    }
  };

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <main style={{ padding: 24, color: '#F8FAFC' }}>
          <h1 style={{ color: '#F87171' }}>Something went wrong</h1>
          <p style={{ color: '#94A3B8' }}>{this.state.error.message}</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button onClick={this.reload} style={btn}>Reload</button>
            <button onClick={this.resetProgress} style={btnDanger}>Reset progress</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

const btn: React.CSSProperties = {
  background: '#5AC8FA',
  color: '#0B1120',
  border: 0,
  padding: '12px 16px',
  borderRadius: 8,
  fontWeight: 600,
  minHeight: 44,
};

const btnDanger: React.CSSProperties = {
  ...btn,
  background: 'transparent',
  color: '#F87171',
  border: '1px solid #F87171',
};
