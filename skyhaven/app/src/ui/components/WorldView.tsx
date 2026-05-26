import { useEffect, useRef, useState } from 'react';
import type { Airport } from '../../data/airports';
import { selectUnlockedRegions, useGameStore } from '../../state/store';
import type { WorldStage } from '../../world/WorldStage';
import { AirportTooltip } from './AirportTooltip';

export function WorldView() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<WorldStage | null>(null);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tapped, setTapped] = useState<{ airport: Airport; x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    (async () => {
      try {
        const { createWorldStage } = await import('../../world/WorldStage');
        if (cancelled || !hostRef.current) return;
        const stage = await createWorldStage(hostRef.current);
        if (cancelled) {
          stage.destroy();
          return;
        }
        stageRef.current = stage;

        stage.setCollectibleTapHandler((id) => {
          useGameStore.getState().claimCollectible(id);
        });
        stage.setAirportTapHandler((airport, screen) => {
          setTapped({ airport, x: screen.x, y: screen.y });
        });
        const s = useGameStore.getState().state;
        if (s) {
          stage.setTailColor(s.tailColor);
          stage.setUnlockedRegions(new Set<number>(s.unlockedRegions));
          stage.setRoutes(s.routes);
          stage.setCollectibles(s.collectibles);
        }

        let lastFpsAt = 0;
        const loop = (now: number): void => {
          if (!stageRef.current) return;
          if (now - lastFpsAt > 1000) {
            setFps(Math.round(stageRef.current.fps()));
            lastFpsAt = now;
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[skyhaven] world stage init failed', err);
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stageRef.current?.destroy();
      stageRef.current = null;
    };
  }, []);

  // Subscribe to store and push relevant slices into the stage.
  useEffect(() => {
    const unsub = useGameStore.subscribe((state, prev) => {
      const stage = stageRef.current;
      if (!stage || !state.state) return;
      if (!prev.state || state.state.routes !== prev.state.routes) {
        stage.setRoutes(state.state.routes);
      }
      if (!prev.state || state.state.tailColor !== prev.state.tailColor) {
        stage.setTailColor(state.state.tailColor);
      }
      if (!prev.state || state.state.collectibles !== prev.state.collectibles) {
        stage.setCollectibles(state.state.collectibles);
      }
      if (!prev.state || state.state.unlockedRegions !== prev.state.unlockedRegions) {
        stage.setUnlockedRegions(new Set<number>(state.state.unlockedRegions));
      }
    });
    return unsub;
  }, []);

  const unlocked = useGameStore(selectUnlockedRegions);

  return (
    <div style={hostStyle} ref={hostRef}>
      {error && (
        <div style={errorOverlay}>
          <div>World layer failed to start</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>{error}</div>
        </div>
      )}
      <div style={fpsBadge} aria-hidden>
        {fps} fps
      </div>
      {tapped && (
        <AirportTooltip
          airport={tapped.airport}
          x={tapped.x}
          y={tapped.y}
          unlocked={unlocked.includes(tapped.airport.region)}
          onClose={(): void => setTapped(null)}
        />
      )}
    </div>
  );
}

const hostStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#0B1120',
  overflow: 'hidden',
  touchAction: 'none',
};

const fpsBadge: React.CSSProperties = {
  position: 'absolute',
  bottom: 76,
  right: 8,
  padding: '4px 8px',
  fontSize: 10,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  color: '#94A3B8',
  background: 'rgba(11, 17, 32, 0.7)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6,
  pointerEvents: 'none',
  opacity: 0.7,
};

const errorOverlay: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  color: '#F87171',
  background: 'rgba(11, 17, 32, 0.95)',
  textAlign: 'center',
  padding: 16,
};
