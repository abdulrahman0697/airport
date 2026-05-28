import { useEffect, useRef, useState } from 'react';
import type { Airport } from '../../data/airports';
import type { Route } from '../../engine/types';
import { selectRoutes, selectUnlockedRegions, useGameStore } from '../../state/store';
import type { WorldStage } from '../../world/WorldStage';
import { AirportTooltip } from './AirportTooltip';
import { RouteTooltip } from './RouteTooltip';

export function WorldView() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<WorldStage | null>(null);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tapped, setTapped] = useState<{ airport: Airport; x: number; y: number } | null>(null);
  const [tappedRoute, setTappedRoute] = useState<{ routeId: string; x: number; y: number } | null>(null);

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
          setTappedRoute(null);
        });
        stage.setRouteTapHandler((routeId, screen) => {
          setTappedRoute({ routeId, x: screen.x, y: screen.y });
          setTapped(null);
        });
        const s = useGameStore.getState().state;
        if (s) {
          stage.setTailColor(s.tailColor);
          stage.setUnlockedRegions(new Set<number>(s.unlockedRegions));
          stage.setHubs(s.hubs.map((h) => h.iata));
          stage.setRoutes(s.routes);
          stage.setCollectibles(s.collectibles);
          // If exactly one region is unlocked, gently zoom toward
          // it so the player isn't staring at an empty globe — but
          // not so close that they only see one country (player
          // feedback). 1.15 puts the region in the middle of the
          // view with most of its neighbours still visible.
          if (s.unlockedRegions.length === 1) {
            stage.zoomToRegion(s.unlockedRegions[0]!, 1.15);
          }
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
      if (!prev.state || state.state.hubs !== prev.state.hubs) {
        stage.setHubs(state.state.hubs.map((h) => h.iata));
      }
    });
    return unsub;
  }, []);

  const unlocked = useGameStore(selectUnlockedRegions);
  const routes = useGameStore(selectRoutes);
  const activeRoute: Route | null = tappedRoute
    ? routes.find((r) => r.id === tappedRoute.routeId) ?? null
    : null;
  useEffect(() => {
    // Auto-close the tooltip if the route disappears (e.g. user closed it).
    if (tappedRoute && !activeRoute) setTappedRoute(null);
  }, [tappedRoute, activeRoute]);

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
      {tappedRoute && activeRoute && (
        <RouteTooltip
          route={activeRoute}
          x={tappedRoute.x}
          y={tappedRoute.y}
          onClose={(): void => setTappedRoute(null)}
        />
      )}
    </div>
  );
}

const hostStyle: React.CSSProperties = {
  position: 'fixed',
  top: 'var(--world-top)',
  left: 0,
  right: 0,
  bottom: 0,
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
