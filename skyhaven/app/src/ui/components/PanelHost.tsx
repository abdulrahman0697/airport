import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { create } from 'zustand';

export type PanelId = 'fleet' | 'routes' | 'fuel' | 'store' | 'crew' | 'office' | 'leaders' | 'achievements' | 'missions' | 'airport' | 'settings' | null;

interface PanelStore {
  active: PanelId;
  open: (id: Exclude<PanelId, null>) => void;
  close: () => void;
}

export const usePanelStore = create<PanelStore>((set) => ({
  active: null,
  open: (id): void => set({ active: id }),
  close: (): void => set({ active: null }),
}));

const FleetPanel = lazy(() => import('../panels/FleetPanel').then((m) => ({ default: m.FleetPanel })));
const RoutesPanel = lazy(() => import('../panels/RoutesPanel').then((m) => ({ default: m.RoutesPanel })));
const FuelPanel = lazy(() => import('../panels/FuelPanel').then((m) => ({ default: m.FuelPanel })));
const CrewPanel = lazy(() => import('../panels/CrewPanel').then((m) => ({ default: m.CrewPanel })));
const OfficePanel = lazy(() => import('../panels/OfficePanel').then((m) => ({ default: m.OfficePanel })));
const LeaderboardsPanel = lazy(() => import('../panels/LeaderboardsPanel').then((m) => ({ default: m.LeaderboardsPanel })));
const AchievementsPanel = lazy(() => import('../panels/AchievementsPanel').then((m) => ({ default: m.AchievementsPanel })));
const MissionsPanel = lazy(() => import('../panels/MissionsPanel').then((m) => ({ default: m.MissionsPanel })));
const AirportPanel = lazy(() => import('../panels/AirportPanel').then((m) => ({ default: m.AirportPanel })));
const SettingsPanel = lazy(() => import('../panels/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));

export function PanelHost() {
  const active = usePanelStore((s) => s.active);
  const close = usePanelStore((s) => s.close);

  // Esc closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && active) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, close]);

  return (
    <AnimatePresence>
      {active !== null && (
        <motion.div
          key={active}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="glass-shimmer"
          style={panelShell as Record<string, unknown>}
        >
          <button onClick={close} style={closeBtn} aria-label="Close panel">×</button>
          <Suspense fallback={<PanelFallback />}>
            {active === 'fleet' && <FleetPanel />}
            {active === 'routes' && <RoutesPanel />}
            {active === 'fuel' && <FuelPanel />}
            {active === 'crew' && <CrewPanel />}
            {active === 'office' && <OfficePanel />}
            {active === 'leaders' && <LeaderboardsPanel />}
            {active === 'achievements' && <AchievementsPanel />}
            {active === 'missions' && <MissionsPanel />}
            {active === 'airport' && <AirportPanel />}
            {active === 'settings' && <SettingsPanel />}
            {active === 'store' && <ComingSoonPanel name="Executive Deals" />}
          </Suspense>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PanelFallback(): ReactNode {
  return <div style={{ padding: 24, color: '#94A3B8' }}>Loading…</div>;
}

function ComingSoonPanel({ name }: { name: string }): ReactNode {
  return (
    <div style={{ padding: 32, color: '#94A3B8', textAlign: 'center' }}>
      <div style={{ fontSize: 18, color: '#F8FAFC', marginBottom: 8 }}>{name}</div>
      <div style={{ fontSize: 13 }}>Arrives in a future phase.</div>
    </div>
  );
}

const panelShell: React.CSSProperties = {
  position: 'fixed',
  bottom: 64,
  left: 0,
  right: 0,
  top: 'var(--world-top)',
  background: '#111A2E',
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
  boxShadow: '0 -16px 40px rgba(0,0,0,0.55)',
  overflow: 'hidden',
  zIndex: 20,
  display: 'flex',
  flexDirection: 'column',
};

const closeBtn: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  background: 'transparent',
  border: 0,
  color: '#94A3B8',
  fontSize: 28,
  width: 40,
  height: 40,
  borderRadius: 20,
  cursor: 'pointer',
  zIndex: 1,
};
