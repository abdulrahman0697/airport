import { useEffect, useRef } from 'react';
import { createGameLoop } from '../state/gameLoop';
import { selectTutorialCompleted, useGameStore } from '../state/store';
import { BottomTabs } from './components/BottomTabs';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DailyReward } from './components/DailyReward';
import { EventBanner } from './components/EventBanner';
import { EventPopup } from './components/EventPopup';
import { FuelGauge } from './components/FuelGauge';
import { GoalChainCard } from './components/GoalChainCard';
import { HeroMoments } from './components/HeroMoments';
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

  // Deferred daily-login: the modal only fires once the tutorial has
  // completed, so the player doesn't get a streak popup overlapping
  // the playable walkthrough on first launch.
  const tutorialCompleted = useGameStore(selectTutorialCompleted);
  const prevCompleted = useRef(tutorialCompleted);
  useEffect(() => {
    if (!prevCompleted.current && tutorialCompleted) {
      useGameStore.getState().applyDailyLoginNow();
    }
    prevCompleted.current = tutorialCompleted;
  }, [tutorialCompleted]);

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
      <HeroMoments />
      <OfflineSummary />
      <DailyReward />
      <Tutorial />
    </ErrorBoundary>
  );
}
