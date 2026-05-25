import { useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';

export function App() {
  const [bootedAt] = useState(() => Date.now());

  useEffect(() => {
    // Placeholder: Phase 0 just confirms mount. World layer arrives in Phase 1.
    // eslint-disable-next-line no-console
    console.log('[skyhaven] react mounted at', new Date(bootedAt).toISOString());
  }, [bootedAt]);

  return (
    <ErrorBoundary>
      <main
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 32, letterSpacing: '0.12em', color: '#5AC8FA', margin: 0 }}>
            SKYHAVEN
          </h1>
          <p style={{ color: '#94A3B8', marginTop: 12 }}>Wings of the World</p>
          <p style={{ color: '#94A3B8', fontSize: 13, marginTop: 32 }}>
            Phase 0 scaffold — world layer arrives in Phase 1
          </p>
        </div>
      </main>
    </ErrorBoundary>
  );
}
