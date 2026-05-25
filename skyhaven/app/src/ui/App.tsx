import { useEffect } from 'react';
import { createGameLoop } from '../state/gameLoop';
import { BottomTabs } from './components/BottomTabs';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PanelHost } from './components/PanelHost';
import { TopBar } from './components/TopBar';
import { WorldView } from './components/WorldView';

export function App() {
  useEffect(() => {
    const loop = createGameLoop();
    void loop.start();
    return () => { void loop.stop(); };
  }, []);

  return (
    <ErrorBoundary>
      <WorldView />
      <TopBar />
      <PanelHost />
      <BottomTabs />
    </ErrorBoundary>
  );
}
