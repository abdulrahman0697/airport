/**
 * ControlTowerPanel.
 *
 * Surfaced from the home airport image's tower tap. Shows the
 * coordination view a tower controller would actually look at:
 *
 *   - Live aircraft in flight (one row per active route)
 *   - Active weather / market events
 *   - Hub-load summary (per hub: route count + average condition)
 *
 * Tier 3 unlocks weather alerts per BRD §4.4; before then the panel
 * still opens but the weather card is shown as a locked tease.
 */
import { useEffect, useState } from 'react';
import { EVENT_DEFS } from '../../data/events';
import { getAircraftDef } from '../../data/aircraft';
import { conditionBand } from '../../engine/condition';
import { isRunning } from '../../engine/events';
import {
  selectActiveEvents,
  selectFleet,
  selectHubs,
  selectRoutes,
  selectTailColor,
  selectTier,
  useGameStore,
} from '../../state/store';
import { PanelHeader } from '../design/PanelHeader';
import { COLOR, RADIUS } from '../design/tokens';

export function ControlTowerPanel() {
  const routes = useGameStore(selectRoutes);
  const fleet = useGameStore(selectFleet);
  const hubs = useGameStore(selectHubs);
  const events = useGameStore(selectActiveEvents);
  const tailColor = useGameStore(selectTailColor);
  const tier = useGameStore(selectTier);

  // Tick the clock so countdowns refresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const byUid = new Map(fleet.map((a) => [a.uid, a]));
  const now = Date.now();
  const runningEvents = events.filter((e) => isRunning(e, now));
  const towerOnline = tier >= 3;

  return (
    <div style={shell}>
      <PanelHeader
        kicker="Operations"
        title="Control Tower"
        subtitle={towerOnline
          ? `${routes.length} aircraft tracked · ${hubs.length} hubs reporting`
          : `Tier 3 unlock — ${routes.length} routes tracked in basic mode`}
      />
      <div style={body}>
        <section style={card}>
          <div style={sectionKicker(tailColor)}>● LIVE AIR TRAFFIC</div>
          {routes.length === 0 ? (
            <div style={empty}>No aircraft in flight. Open a route from the home screen.</div>
          ) : (
            <ul style={list}>
              {routes.map((r) => {
                const ac = byUid.get(r.aircraftUid);
                const def = ac ? getAircraftDef(ac.defId) : null;
                const band = ac ? conditionBand(ac.condition) : 'normal';
                const dotColor = band === 'normal' ? COLOR.success : band === 'degraded' ? COLOR.warn : COLOR.danger;
                return (
                  <li key={r.id} style={row}>
                    <div style={rowLeft}>
                      <span style={{ ...dot, background: dotColor }} />
                      <div>
                        <div style={rowIata}>{r.originIata} → {r.destIata}</div>
                        <div style={rowMeta}>
                          {def?.displayName ?? 'aircraft'} · {Math.round(r.distanceKm)} km · {(r.loadFactor * 100).toFixed(0)}% load
                        </div>
                      </div>
                    </div>
                    <div style={rowRight}>{r.pricing.toUpperCase()}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section style={card}>
          <div style={sectionKicker(tailColor)}>⚡ EVENTS & WEATHER</div>
          {!towerOnline ? (
            <div style={lockedBox}>
              Tier 3 unlocks weather alerts and event briefings. Until
              then, the tower hands you raw market events only.
            </div>
          ) : null}
          {runningEvents.length === 0 ? (
            <div style={empty}>All clear. No active events.</div>
          ) : (
            <ul style={list}>
              {runningEvents.map((e) => {
                const def = EVENT_DEFS[e.kind];
                const remainingMs = Math.max(0, e.startedAt + e.durationMs - now);
                const sec = Math.ceil(remainingMs / 1000);
                const accent = def.positive ? COLOR.accent.cyan : COLOR.warn;
                return (
                  <li key={e.id} style={{ ...row, borderColor: `${accent}55` }}>
                    <div style={rowLeft}>
                      <span style={{ ...dot, background: accent }} />
                      <div>
                        <div style={{ ...rowIata, color: accent }}>{def.name.toUpperCase()}</div>
                        <div style={rowMeta}>{def.description}</div>
                      </div>
                    </div>
                    <div style={{ ...rowRight, fontVariantNumeric: 'tabular-nums' }}>
                      {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section style={card}>
          <div style={sectionKicker(tailColor)}>◇ HUB STATUS</div>
          {hubs.length === 0 ? (
            <div style={empty}>No hubs yet.</div>
          ) : (
            <ul style={list}>
              {hubs.map((h) => {
                const hubRoutes = routes.filter((r) => r.originIata === h.iata || r.destIata === h.iata);
                return (
                  <li key={h.iata} style={row}>
                    <div style={rowLeft}>
                      <div>
                        <div style={rowIata}>{h.iata}</div>
                        <div style={rowMeta}>Level {h.level} · {hubRoutes.length} active route{hubRoutes.length === 1 ? '' : 's'}</div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const body: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: 12 };
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
};
const sectionKicker = (tail: string): React.CSSProperties => ({
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.22em',
  color: tail,
  marginBottom: 10,
});
const list: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 };
const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '8px 10px',
  borderRadius: RADIUS.m,
  background: 'rgba(11,17,32,0.6)',
  border: '1px solid rgba(255,255,255,0.06)',
};
const rowLeft: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 };
const dot: React.CSSProperties = { width: 8, height: 8, borderRadius: 999, flexShrink: 0 };
const rowIata: React.CSSProperties = { color: COLOR.ink.primary, fontWeight: 800, fontSize: 13, letterSpacing: '0.06em' };
const rowMeta: React.CSSProperties = { color: COLOR.ink.muted, fontSize: 11, marginTop: 2 };
const rowRight: React.CSSProperties = { color: COLOR.ink.muted, fontSize: 11, letterSpacing: '0.12em', fontWeight: 700 };
const empty: React.CSSProperties = { color: COLOR.ink.muted, fontSize: 12, padding: '6px 4px' };
const lockedBox: React.CSSProperties = {
  background: 'rgba(244,199,91,0.08)',
  border: '1px solid rgba(244,199,91,0.32)',
  borderRadius: RADIUS.s,
  color: COLOR.gold.base,
  padding: '8px 10px',
  fontSize: 11,
  marginBottom: 8,
  lineHeight: 1.5,
};
