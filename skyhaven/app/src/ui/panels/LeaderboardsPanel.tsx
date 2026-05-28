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
import { fetchBoard, fetchBoardForUids, type LeaderboardEntry } from '../../backend/leaderboards';
import { subscribeFriendships, type Friendship } from '../../backend/friends';
import { useAuth } from '../../backend/useAuth';
import { getAircraftDef } from '../../data/aircraft';
import { BOARDS, getBoard, type BoardId } from '../../data/leaderboards';
import { buildRivalBoard, nextTarget } from '../../data/rivals';
import { cashPerSecond } from '../../engine/economy';
import { EmptyState } from '../design/EmptyState';
import { Skeleton } from '../design/Skeleton';
import { COLOR, RADIUS, SPACE } from '../design/tokens';
import {
  selectActiveEvents,
  selectAirlineName,
  selectFleet,
  selectHubs,
  selectRoutes,
  useGameStore,
} from '../../state/store';
import type { SaveState } from '../../engine/types';

type Scope = 'global' | 'friends';

export function LeaderboardsPanel() {
  const [tab, setTab] = useState<BoardId>('lifetime');
  const [scope, setScope] = useState<Scope>('global');
  const board = getBoard(tab);
  const user = useAuth();
  const state = useGameStore((s) => s.state);
  const fleet = useGameStore(selectFleet);
  const routes = useGameStore(selectRoutes);
  const hubs = useGameStore(selectHubs);
  const activeEvents = useGameStore(selectActiveEvents);
  const airlineName = useGameStore(selectAirlineName);

  // Live friend uids — only accepted, plus self for the friends view.
  const [friendships, setFriendships] = useState<readonly Friendship[]>([]);
  useEffect(() => {
    if (!user) { setFriendships([]); return; }
    const unsub = subscribeFriendships(setFriendships);
    return () => { unsub?.(); };
  }, [user]);
  const friendUids = useMemo(() => {
    const out = friendships.filter((f) => f.status === 'accepted').map((f) => f.otherUid);
    if (user) out.push(user.uid);
    return out;
  }, [friendships, user]);

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
      const data = scope === 'global'
        ? await fetchBoard(tab)
        : await fetchBoardForUids(tab, friendUids);
      if (cancelled) return;
      setRows(data);
      setLoading(false);
      if (data.length === 0) {
        setError(scope === 'friends'
          ? 'No friends have a score on this board yet. Add a few from Office → Friends.'
          : 'No entries yet. Be the first — keep playing!');
      }
    })();
    return () => { cancelled = true; };
  }, [tab, scope, reloadKey, friendUids]);

  if (!board) return null;

  // Design Review v3 — point 20. When the real global board is empty
  // (cold start, low player density), surface a Rival Airlines simulation
  // so the player always has a target instead of staring at "—".
  const showRivalSim = scope === 'global' && !loading && rows.length === 0;
  const rivalBoard = useMemo(
    () => showRivalSim ? buildRivalBoard(myScore, tab) : [],
    [showRivalSim, myScore, tab],
  );
  const rivalTarget = useMemo(() => nextTarget(myScore, rivalBoard), [myScore, rivalBoard]);

  return (
    <div style={shell}>
      <div style={header}>
        <h2 style={title}>Leaderboards</h2>
        <div style={scopeRow}>
          <button
            onClick={(): void => setScope('global')}
            style={{ ...scopeBtn, ...(scope === 'global' ? scopeActive : {}) }}
          >
            Global
          </button>
          <button
            onClick={(): void => setScope('friends')}
            style={{ ...scopeBtn, ...(scope === 'friends' ? scopeActive : {}) }}
          >
            Friends
          </button>
        </div>
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
          <div style={listHeadLabel}>
            {scope === 'global' ? 'Global Top' : 'Friends'} {rows.length || ''}
          </div>
          <button onClick={(): void => setReloadKey((k) => k + 1)} style={refreshBtn}>
            ⟳ Refresh
          </button>
        </div>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={44} radius={8} />
            ))}
          </div>
        )}
        {!loading && error && scope === 'friends' && (
          <EmptyState
            icon="🏆"
            title="Friends-only board"
            body={error}
          />
        )}

        {/* Rival Airlines simulation board — shown only when the real
            global board is empty. Disappears the moment real entries
            arrive. */}
        {showRivalSim && (
          <>
            {/* Weekly rivalry goal — Design Review v4, point 23. The
                "beat X by Y" framing turns rivals into a clock target,
                not just a static board. */}
            {rivalTarget && (
              <div style={rivalTargetCard}>
                <div style={rivalTargetKicker}>
                  WEEKLY GOAL · NEXT TO BEAT
                </div>
                <div style={rivalTargetRow}>
                  <div style={{ ...rivalChip, background: `${rivalTarget.rival.tail}1c`, borderColor: `${rivalTarget.rival.tail}55` }}>
                    <span style={{ color: rivalTarget.rival.tail, fontWeight: 800 }}>{rivalTarget.rival.code}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={rivalTargetName}>{rivalTarget.rival.name}</div>
                    <div style={rivalTargetMotto}>{rivalTarget.rival.motto}</div>
                  </div>
                  <div style={rivalTargetGap}>
                    <span style={rivalTargetGapLabel}>OVERTAKE BY</span>
                    <span style={rivalTargetGapValue}>+{board.format(rivalTarget.need)}</span>
                  </div>
                </div>
                <div style={rivalTargetFoot}>
                  Resets in {weeklyTimeRemaining()}  ·  Bragging rights + a vintage drop on overtake.
                </div>
              </div>
            )}
            <div style={rivalsNotice}>
              No public entries on this board yet. Until other founders
              join, you're competing against simulated rivals.
            </div>
            <ol style={list}>
              {rivalBoard.map((entry, idx) => (
                <li key={entry.rival.id} style={{ ...row, borderColor: `${entry.rival.tail}33` }}>
                  <span style={rank}>{idx + 1}</span>
                  <span style={who}>
                    <span style={{ ...rivalChipSm, background: `${entry.rival.tail}1c`, borderColor: `${entry.rival.tail}55`, color: entry.rival.tail }}>
                      {entry.rival.code}
                    </span>
                    {entry.rival.name}
                    <span style={simPill}>sim</span>
                  </span>
                  <span style={score}>{board.format(entry.score)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
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

function weeklyTimeRemaining(): string {
  // Time until the next Monday 00:00 local. Deterministic per call,
  // shown as "Xd Yh" so the goal feels like a clock, not text.
  const now = new Date();
  const day = now.getDay(); // 0..6 (Sun..Sat)
  const daysUntilMonday = day === 0 ? 1 : (8 - day);
  const reset = new Date(now);
  reset.setDate(reset.getDate() + daysUntilMonday);
  reset.setHours(0, 0, 0, 0);
  const diff = reset.getTime() - now.getTime();
  const d = Math.floor(diff / (24 * 3600 * 1000));
  const h = Math.floor((diff - d * 24 * 3600 * 1000) / (3600 * 1000));
  if (d <= 0) return `${h}h`;
  return `${d}d ${h}h`;
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
const scopeRow: React.CSSProperties = {
  display: 'flex', gap: 6, marginTop: 12,
  background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 10,
  width: 'fit-content',
};
const scopeBtn: React.CSSProperties = {
  background: 'transparent', color: '#94A3B8', border: 0,
  padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
  fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
  letterSpacing: '0.06em',
};
const scopeActive: React.CSSProperties = {
  background: '#5AC8FA', color: '#0B1120',
};
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

// Rival simulation styles
const rivalTargetCard: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(244,199,91,0.10), rgba(11,17,32,0.6))',
  border: `1px solid ${COLOR.gold.base}55`,
  borderRadius: RADIUS.m,
  padding: '12px 14px',
};
const rivalTargetKicker: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.22em', fontWeight: 800,
  color: COLOR.gold.base,
};
const rivalTargetRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACE.m,
  marginTop: SPACE.s,
};
const rivalChip: React.CSSProperties = {
  width: 38, height: 38,
  borderRadius: 999,
  border: '1px solid',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 13,
  letterSpacing: '0.04em',
  flexShrink: 0,
};
const rivalChipSm: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 22,
  borderRadius: 5,
  border: '1px solid',
  fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
  marginRight: 8,
};
const rivalTargetName: React.CSSProperties = {
  fontSize: 14, fontWeight: 800, color: COLOR.ink.primary,
};
const rivalTargetMotto: React.CSSProperties = {
  fontSize: 11, color: COLOR.ink.muted, marginTop: 2, fontStyle: 'italic',
};
const rivalTargetGap: React.CSSProperties = {
  textAlign: 'right', flexShrink: 0,
};
const rivalTargetGapLabel: React.CSSProperties = {
  display: 'block', fontSize: 9, letterSpacing: '0.18em',
  color: COLOR.ink.faint, fontWeight: 800,
};
const rivalTargetGapValue: React.CSSProperties = {
  display: 'block', fontSize: 14, fontWeight: 800,
  color: COLOR.gold.base, fontFeatureSettings: '"tnum" 1',
};
const rivalTargetFoot: React.CSSProperties = {
  marginTop: 10,
  fontSize: 10,
  letterSpacing: '0.06em',
  color: COLOR.ink.muted,
  fontWeight: 600,
};
const rivalsNotice: React.CSSProperties = {
  fontSize: 11,
  color: COLOR.ink.muted,
  background: 'rgba(11,17,32,0.5)',
  border: `1px solid ${COLOR.border.soft}`,
  borderRadius: RADIUS.s,
  padding: '8px 10px',
  lineHeight: 1.5,
};
const simPill: React.CSSProperties = {
  fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase',
  color: COLOR.ink.faint,
  background: 'rgba(148,163,184,0.10)',
  padding: '2px 6px', borderRadius: 4, fontWeight: 700,
  marginLeft: 6,
};
