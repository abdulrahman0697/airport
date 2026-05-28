import { useState } from 'react';
import { MANAGER_DEFS, managerCost } from '../../data/managers';
import type { Hub } from '../../engine/types';
import { selectCash, selectHubs, useGameStore } from '../../state/store';
import { Button } from '../design/Button';
import { Chip } from '../design/Chip';
import { EmptyState } from '../design/EmptyState';
import { PanelHeader } from '../design/PanelHeader';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';

export function CrewPanel() {
  const hubs = useGameStore(selectHubs);

  return (
    <div style={shell}>
      <PanelHeader
        kicker="Personnel"
        title="Crew"
        subtitle="Managers are hub-scoped — hire per hub for targeted bonuses."
      />
      <div style={body}>
        {hubs.length === 0 ? (
          <EmptyState
            icon="◇"
            title="No hubs to staff"
            body="Promote an airport to a hub from the Network panel, then return here to hire managers."
          />
        ) : (
          <ul style={list}>
            {hubs.map((h) => <HubBlock key={h.iata} hub={h} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function HubBlock({ hub }: { hub: Hub }) {
  const cash = useGameStore(selectCash);
  const hire = useGameStore((s) => s.hireManager);
  const [error, setError] = useState<string | null>(null);

  return (
    <li style={hubCard}>
      <div style={hubHeader}>
        <div>
          <div style={hubTitle}>{hub.iata}</div>
          <div style={hubSubtitle}>Lv {hub.level} hub · {countHired(hub)} of 6 hired</div>
        </div>
      </div>
      <div style={managerGrid}>
        {MANAGER_DEFS.map((m) => {
          const hired = hub.managers[m.kind];
          const cost = managerCost(m.kind, hub.level);
          const afford = cash >= cost;
          return (
            <div key={m.kind} style={{ ...mCard, ...(hired ? mCardHired : {}) }}>
              <div style={mTopRow}>
                <div style={mName}>{m.name}</div>
                {hired
                  ? <Chip tone="success">Hired</Chip>
                  : <Chip tone="gold">${formatCash(cost, 1)}</Chip>}
              </div>
              <div style={mTagline}>{m.tagline}</div>
              <div style={mBio}>{m.bio}</div>
              {!hired && (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!afford}
                  fullWidth
                  hapticOnPress="medium"
                  onClick={(): void => {
                    const res = hire(hub.iata, m.kind);
                    if (res.ok) haptics.success();
                    else haptics.warning();
                    setError(res.ok ? null : res.message);
                  }}
                  style={{ marginTop: 8 }}
                >
                  Hire
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {error && <div style={errorText}>{error}</div>}
    </li>
  );
}

function countHired(hub: Hub): number {
  return Object.values(hub.managers).filter(Boolean).length;
}

// ─── Styles ──────────────────────────────────────────────────────────
const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const body: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: 12 };
const list: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 };
const hubCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12,
  border: '1px solid rgba(255,255,255,0.06)',
};
const hubHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between' };
const hubTitle: React.CSSProperties = { color: '#F8FAFC', fontSize: 16, fontWeight: 700 };
const hubSubtitle: React.CSSProperties = { color: '#94A3B8', fontSize: 11 };
const managerGrid: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 };
const mCard: React.CSSProperties = {
  background: 'rgba(11,17,32,0.55)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10, padding: 10,
};
const mCardHired: React.CSSProperties = {
  background: 'rgba(52,211,153,0.06)',
  borderColor: 'rgba(52,211,153,0.4)',
};
const mTopRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const mName: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#F8FAFC' };
const mTagline: React.CSSProperties = { color: '#5AC8FA', fontSize: 12, marginTop: 2 };
const mBio: React.CSSProperties = { color: '#94A3B8', fontSize: 11, marginTop: 6, lineHeight: 1.45 };
const errorText: React.CSSProperties = {
  marginTop: 8, padding: '6px 10px', fontSize: 11, color: '#F87171',
  background: 'rgba(248,113,113,0.08)', borderRadius: 6,
};
