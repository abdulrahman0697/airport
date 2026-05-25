import { useEffect, useRef, useState } from 'react';
import type { WorldStage } from '../../world/WorldStage';

export function WorldView() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stage: WorldStage | undefined;
    let cancelled = false;
    let raf = 0;

    (async () => {
      try {
        const { createWorldStage } = await import('../../world/WorldStage');
        if (cancelled || !hostRef.current) return;
        stage = await createWorldStage(hostRef.current);
        const loop = (): void => {
          if (!stage) return;
          setFps(Math.round(stage.fps()));
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
      stage?.destroy();
    };
  }, []);

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
  top: 8,
  right: 8,
  padding: '4px 8px',
  fontSize: 11,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  color: '#94A3B8',
  background: 'rgba(11, 17, 32, 0.6)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6,
  pointerEvents: 'none',
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
