import { useEffect } from 'react';
import { createGameLoop } from '../state/gameLoop';
import { BottomTabs } from './components/BottomTabs';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EventBanner } from './components/EventBanner';
import { EventPopup } from './components/EventPopup';
import { FuelGauge } from './components/FuelGauge';
import { VintageDropPopup } from './components/VintageDropPopup';
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
      <EventBanner />
      <FuelGauge />
      <PanelHost />
      <BottomTabs />
      <EventPopup />
      <VintageDropPopup />
    </ErrorBoundary>
  );
}
