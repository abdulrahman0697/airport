import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WorldView } from './components/WorldView';

export function App() {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[skyhaven] react mounted');
  }, []);

  return (
    <ErrorBoundary>
      <WorldView />
      <header style={topBar} aria-label="airline header">
        <div style={brand}>SKYHAVEN</div>
        <div style={subtitle}>Wings of the World</div>
      </header>
    </ErrorBoundary>
  );
}

const topBar: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  padding: '12px 16px',
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  pointerEvents: 'none',
  background: 'linear-gradient(to bottom, rgba(11,17,32,0.7), rgba(11,17,32,0))',
};

const brand: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: '0.18em',
  color: '#5AC8FA',
};

const subtitle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.18em',
  color: '#94A3B8',
  textTransform: 'uppercase',
};
