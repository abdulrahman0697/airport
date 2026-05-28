import { useEffect, useRef } from 'react';
import { createGameLoop } from '../state/gameLoop';
import { selectTutorialCompleted, useGameStore } from '../state/store';
import { AchievementToast } from './components/AchievementToast';
import { AircraftDeliveryRitual } from './components/AircraftDeliveryRitual';
import { CashTickToast } from './components/CashTickToast';
import { EmpireJourney } from './components/EmpireJourney';
import { BottomTabs } from './components/BottomTabs';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DailyReward } from './components/DailyReward';
import { FirstRouteCeremony } from './components/FirstRouteCeremony';
import { FirstTakeoffCinematic } from './components/FirstTakeoffCinematic';
import { NextUnlockBadge } from './components/NextUnlockBadge';
import { EventBanner } from './components/EventBanner';
import { EventPopup } from './components/EventPopup';
import { FuelGauge } from './components/FuelGauge';
import { GoalChainCard } from './components/GoalChainCard';
import { HeroMoments } from './components/HeroMoments';
import { HomeShell } from './components/HomeShell';
import { MapLiveTicker } from './components/MapLiveTicker';
import { HubPicker } from './components/HubPicker';
import { IntroSplash } from './components/IntroSplash';
import { OfflineSummary } from './components/OfflineSummary';
import { StayInTouchCard } from './components/StayInTouchCard';
import { Tutorial } from './components/Tutorial';
import { VintageDropPopup } from './components/VintageDropPopup';
import { PanelHost } from './components/PanelHost';
import { SideLauncher } from './components/SideLauncher';
import { TopBar } from './components/TopBar';
import { WorldView } from './components/WorldView';

export function App() {
  useEffect(() => {
    const loop = createGameLoop();
    void loop.start();
    // Cloud sync runs alongside the local game loop. Firebase is a
    // ~140 KB chunk, so we lazy-import it to keep the cold-start path
    // light — anonymous sign-in still fires within a second or two of
    // launch, which is plenty fast for cross-device sync.
    let stopCloud: (() => void) | null = null;
    void (async () => {
      const mod = await import('../backend/cloudSync');
      const cloud = mod.startCloudSync();
      stopCloud = (): void => cloud.stop();
      // Push notifications (Phase 13.2). Lazy too — adds ~3 KB on the
      // critical path otherwise and is irrelevant on web. The init
      // function is idempotent + silent on the web target.
      const push = await import('../backend/push');
      void push.initPushNotifications();
    })();
    return () => {
      void loop.stop();
      stopCloud?.();
    };
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
      <SideLauncher />
      <NextUnlockBadge />
      <HomeShell />
      <MapLiveTicker />
      <PanelHost />
      <GoalChainCard />
      <BottomTabs />
      <EventPopup />
      <VintageDropPopup />
      <HeroMoments />
      <AchievementToast />
      <AircraftDeliveryRitual />
      <EmpireJourney />
      <CashTickToast />
      <OfflineSummary />
      <StayInTouchCard />
      <DailyReward />
      <HubPicker />
      <Tutorial />
      <FirstRouteCeremony />
      <FirstTakeoffCinematic />
      <IntroSplash />
    </ErrorBoundary>
  );
}
