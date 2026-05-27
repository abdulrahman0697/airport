/**
 * Leaderboards panel (BRD §12.1).
 *
 * Tabs for the four boards. Reads top-N entries straight from
 * Firestore on tab change (and on a manual Refresh). The player's own
 * current value renders at the top as a "Your score" card; the
 * ranked list below is the global top-N.
 *
 * Friends-scoped views land in Phase 12.3 alongside the friend graph.
 */
import { useEffect, useMemo, useState } from 'react';
import { fetchBoard, type LeaderboardEntry } from '../../backend/leaderboards';
import { useAuth } from '../../backend/useAuth';
import { getAircraftDef } from '../../data/aircraft';
import { BOARDS, getBoard, type BoardId } from '../../data/leaderboards';
import { cashPerSecond } from '../../engine/economy';
import {
  selectActiveEvents,
  selectAirlineName,
  selectFleet,
  selectHubs,
  selectRoutes,
  useGameStore,
} from '../../state/store';
import type { SaveState } from '../../engine/types';

export function LeaderboardsPanel() {
  const [tab, setTab] = useState<BoardId>('lifetime');
  const board = getBoard(tab);
  const user = useAuth();
  const state = useGameStore((s) => s.state);
  const fleet = useGameStore(selectFleet);
  const routes = useGameStore(selectRoutes);
  const hubs = useGameStore(selectHubs);
  const activeEvents = useGameStore(selectActiveEvents);
  const airlineName = useGameStore(selectAirlineName);

  const perMin = useMemo(() => {
    const byUid = new Map(fleet.map((a) => [a.uid, a]));
    let total = 0;
    for (const r of routes) {
      const ac = byUid.get(r.aircraftUid);
      if (!ac || !getAircraftDef(ac.defId)) continue;
      total += cashPerSecond(r, ac, hubs, activeEvents);
    }
    return total * 60;
  }, [fleet, routes, hubs, activeEvents]);

  const myScore = state && board ? board.selector(state, perMin) : 0;

  const [rows, setRows] = useState<readonly LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      const data = await fetchBoard(tab);
      if (cancelled) return;
      setRows(data);
      setLoading(false);
      if (data.length === 0) {
        setError('No entries yet. Be the first — keep playing!');
      }
    })();
    return () => { cancelled = true; };
  }, [tab, reloadKey]);

  if (!board) return null;

  return (
    <div style={shell}>
      <div style={header}>
        <h2 style={title}>Leaderboards</h2>
        <div role="tablist" style={tabsRow}>
          {BOARDS.map((b) => (
            <button
              key={b.id}
              role="tab"
              onClick={(): void => setTab(b.id)}
              style={{ ...tabBtn, ...(tab === b.id ? tabActive : {}) }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <div style={body}>
        <YourCard
          board={board}
          score={myScore}
          state={state}
          displayName={user?.displayName ?? airlineName}
        />
        <div style={listHead}>
          <div style={listHeadLabel}>Global Top {rows.length || ''}</div>
          <button onClick={(): void => setReloadKey((k) => k + 1)} style={refreshBtn}>
            ⟳ Refresh
          </button>
        </div>
        {loading && <div style={empty}>Loading…</div>}
        {!loading && error && <div style={empty}>{error}</div>}
        {!loading && !error && (
          <ol style={list}>
            {rows.map((r, idx) => {
              const isMe = user?.uid === r.uid;
              return (
                <li key={r.uid} style={{ ...row, ...(isMe ? rowMe : {}) }}>
                  <span style={rank}>{idx + 1}</span>
                  <span style={who}>
                    {r.displayName ?? r.uid.slice(0, 8)}
                    {isMe && <span style={youPill}>you</span>}
                  </span>
                  <span style={score}>{board.format(r.score)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function YourCard({
  board, score, state, displayName,
}: {
  board: ReturnType<typeof getBoard>;
  score: number;
  state: SaveState | null;
  displayName: string;
}) {
  if (!board) return null;
  return (
    <section style={youCard}>
      <div style={youCardKicker}>Your score</div>
      <div style={youCardRow}>
        <div>
          <div style={youCardName}>{displayName}</div>
          <div style={youCardSub}>{board.label}</div>
        </div>
        <div style={youCardScore}>
          {state ? board.format(score) : '—'}
        </div>
      </div>
      <div style={youCardFoot}>
        Submitted automatically every minute. Manual refresh fetches the
        latest standings.
      </div>
    </section>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const header: React.CSSProperties = { padding: '20px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' };
const title: React.CSSProperties = { margin: 0, fontSize: 22, color: '#F8FAFC' };
const tabsRow: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12,
};
const tabBtn: React.CSSProperties = {
  background: 'transparent', color: '#94A3B8', border: 0,
  padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
  fontSize: 12, minHeight: 36, fontFamily: 'inherit',
};
const tabActive: React.CSSProperties = {
  background: 'rgba(90,200,250,0.12)', color: '#5AC8FA',
};
const body: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: 12,
  display: 'flex', flexDirection: 'column', gap: 10,
};
const youCard: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(90,200,250,0.16), rgba(11,17,32,0.6))',
  borderRadius: 14, padding: '14px 16px',
  border: '1px solid rgba(90,200,250,0.4)',
};
const youCardKicker: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
  color: '#5AC8FA', fontWeight: 700,
};
const youCardRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginTop: 6,
};
const youCardName: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: '#F8FAFC' };
const youCardSub: React.CSSProperties = { fontSize: 11, color: '#94A3B8', marginTop: 2 };
const youCardScore: React.CSSProperties = {
  fontSize: 20, fontWeight: 800, color: '#F4C75B',
  fontFeatureSettings: '"tnum" 1',
};
const youCardFoot: React.CSSProperties = {
  fontSize: 10, color: '#64748B', marginTop: 8, lineHeight: 1.5,
};
const listHead: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginTop: 8,
};
const listHeadLabel: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: '#94A3B8', fontWeight: 700,
};
const refreshBtn: React.CSSProperties = {
  background: 'transparent', color: '#5AC8FA',
  border: '1px solid rgba(90,200,250,0.35)',
  borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
  fontSize: 11, fontFamily: 'inherit',
};
const list: React.CSSProperties = {
  listStyle: 'none', margin: 0, padding: 0,
  display: 'flex', flexDirection: 'column', gap: 4,
};
const row: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '32px 1fr auto', alignItems: 'center',
  gap: 10, padding: '10px 12px',
  background: 'rgba(255,255,255,0.04)', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.06)',
};
const rowMe: React.CSSProperties = {
  background: 'rgba(90,200,250,0.10)',
  borderColor: 'rgba(90,200,250,0.4)',
};
const rank: React.CSSProperties = {
  fontSize: 13, fontWeight: 800, color: '#94A3B8', textAlign: 'center',
  fontFeatureSettings: '"tnum" 1',
};
const who: React.CSSProperties = {
  fontSize: 13, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const youPill: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#5AC8FA', background: 'rgba(90,200,250,0.18)',
  padding: '2px 6px', borderRadius: 4, fontWeight: 700,
};
const score: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#F4C75B',
  fontFeatureSettings: '"tnum" 1',
};
const empty: React.CSSProperties = {
  padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13,
};
