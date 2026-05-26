import { useEffect } from 'react';
import { createGameLoop } from '../state/gameLoop';
import { BottomTabs } from './components/BottomTabs';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DailyReward } from './components/DailyReward';
import { EventBanner } from './components/EventBanner';
import { EventPopup } from './components/EventPopup';
import { FuelGauge } from './components/FuelGauge';
import { GoalChainCard } from './components/GoalChainCard';
import { OfflineSummary } from './components/OfflineSummary';
import { Tutorial } from './components/Tutorial';
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
      <GoalChainCard />
      <BottomTabs />
      <EventPopup />
      <VintageDropPopup />
      <OfflineSummary />
      <DailyReward />
      <Tutorial />
    </ErrorBoundary>
  );
}
