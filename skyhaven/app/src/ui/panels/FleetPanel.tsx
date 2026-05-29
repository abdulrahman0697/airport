import { useEffect, useMemo, useState } from 'react';
import { useUiStore } from '../../state/uiStore';
import { AIRCRAFT_DEFS } from '../../data/aircraft';
import { MAX_TIER } from '../../engine/tierUnlocks';
import { AircraftDetailModal } from '../components/AircraftDetailModal';
import { HangarBay } from '../components/HangarBay';
import { HangarShowroomCard } from '../components/HangarShowroomCard';
import { PanelHeader } from '../design/PanelHeader';
import type { AircraftDef } from '../../engine/types';
import {
  selectFleet,
  selectTier,
  selectTutorialCompleted,
  selectVintage,
  useGameStore,
} from '../../state/store';
import { VintageHangar } from './VintageHangar';

type BuyCategoryFilter = 'passenger' | 'cargo';

export function FleetPanel() {
  const [tab, setTab] = useState<'owned' | 'buy' | 'vintage'>('owned');
  // Home tiles ("Buy a new aircraft" / "Manage your hangar") set this
  // intent so the panel opens directly on the right tab. We consume +
  // clear it on mount.
  const fleetTabIntent = useUiStore((s) => s.fleetTabIntent);
  const setFleetTabIntent = useUiStore((s) => s.setFleetTabIntent);
  useEffect(() => {
    if (fleetTabIntent) {
      setTab(fleetTabIntent);
      setFleetTabIntent(null);
    }
  }, [fleetTabIntent, setFleetTabIntent]);
  const fleet = useGameStore(selectFleet);
  const vintage = useGameStore(selectVintage);
  const tutorialCompleted = useGameStore(selectTutorialCompleted);
  const resetTutorial = useGameStore((s) => s.resetTutorial);

  return (
    <div style={shell}>
      <PanelHeader
        kicker="Operations"
        title="Fleet"
        subtitle={`${fleet.length} aircraft${vintage.length ? ` · ${vintage.length} vintage` : ''}`}
        right={tutorialCompleted ? (
          <button onClick={(): void => { resetTutorial(); }} style={replayLink}>
            Replay tutorial
          </button>
        ) : null}
        tabs={
          <div role="tablist" style={{ display: 'flex', gap: 4 }}>
            <button role="tab" onClick={(): void => setTab('owned')}
              style={{ ...tabBtn, ...(tab === 'owned' ? tabActive : {}) }}>
              Owned ({fleet.length})
            </button>
            <button
              role="tab"
              data-tutorial="fleet-buy-tab"
              onClick={(): void => setTab('buy')}
              style={{ ...tabBtn, ...(tab === 'buy' ? tabActive : {}) }}
            >
              Buy aircraft
            </button>
            <button role="tab" onClick={(): void => setTab('vintage')}
              style={{ ...tabBtn, ...(tab === 'vintage' ? tabActive : {}) }}>
              Vintage ({vintage.length})
            </button>
          </div>
        }
      />
      <div style={body}>
        {tab === 'owned' && <OwnedList />}
        {tab === 'buy' && <BuyList />}
        {tab === 'vintage' && <VintageHangar />}
      </div>
    </div>
  );
}

// ──── Owned tab — Design Review v4, point 20: Hangar Bay ────────────
function OwnedList() {
  // Store just the uid (not the snapshot) and look the aircraft up
  // from the live store on every render — this way an in-modal
  // upgrade (which mutates state.fleet[i].upgrades) is reflected
  // immediately without having to close and re-open the modal.
  const [detailUid, setDetailUid] = useState<string | null>(null);
  const fleet = useGameStore(selectFleet);
  const liveDetail = detailUid
    ? fleet.find((a) => a.uid === detailUid) ?? null
    : null;
  return (
    <>
      <HangarBay onOpenDetail={(a): void => setDetailUid(a.uid)} />
      <AircraftDetailModal aircraft={liveDetail} onClose={(): void => setDetailUid(null)} />
    </>
  );
}

// FleetRow removed in Design Review v4 — replaced by HangarBay (see
// components/HangarBay.tsx).

// ──── Buy aircraft tab ───────────────────────────────────────────────
function BuyList() {
  const tier = useGameStore(selectTier);
  const [category, setCategory] = useState<BuyCategoryFilter>('passenger');
  const cargoUnlocked = tier >= 5;

  const grouped = useMemo(() => {
    const filtered = AIRCRAFT_DEFS.filter((d) =>
      category === 'cargo' ? d.category === 'cargo' : d.category === 'passenger',
    );
    if (category === 'cargo') return [{ tier: 0, label: 'Cargo', items: filtered }];
    const out: { tier: number; label: string; items: AircraftDef[] }[] = [];
    for (let t = 1; t <= MAX_TIER; t++) {
      const items = filtered.filter((d) => d.tier === t);
      if (items.length) out.push({ tier: t, label: `Tier ${t}`, items });
    }
    return out;
  }, [category]);

  return (
    <>
      <div style={categoryRow}>
        <button
          onClick={(): void => setCategory('passenger')}
          style={{ ...catBtn, ...(category === 'passenger' ? catActive : {}) }}
        >
          Passenger
        </button>
        <button
          onClick={(): void => setCategory('cargo')}
          style={{ ...catBtn, ...(category === 'cargo' ? catActive : {}) }}
        >
          Cargo {cargoUnlocked ? '' : '· locked'}
        </button>
      </div>
      {category === 'cargo' && !cargoUnlocked && (
        <div style={empty}>
          Cargo unlocks at Tier 5 (currently T{tier}). Reach $25M lifetime earnings to open the cargo lane.
        </div>
      )}
      {grouped.map(({ tier: t, label, items }) => (
        <section key={t} style={tierBlock}>
          <h3 style={tierHeading}>{label}</h3>
          <div style={showroomGrid}>
            {items.map((d) => (
              <HangarShowroomCard
                key={d.id}
                def={d}
                unlocked={d.category === 'cargo' ? cargoUnlocked : d.tier <= tier}
                isTutorialTarget={d.id === 't1.atr42'}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

// BuyRow removed in Design Review v2 X5; replaced by HangarShowroomCard.

// ─── Styles ──────────────────────────────────────────────────────────
const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const replayLink: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  color: '#5AC8FA',
  fontSize: 11,
  textDecoration: 'underline',
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: 0,
};
const tabBtn: React.CSSProperties = {
  background: 'transparent', color: '#94A3B8', border: 0, padding: '8px 14px', borderRadius: 8,
  cursor: 'pointer', fontSize: 13, minHeight: 36, fontFamily: 'inherit',
};
const tabActive: React.CSSProperties = { background: 'rgba(90,200,250,0.12)', color: '#5AC8FA' };
const body: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: 12 };
const empty: React.CSSProperties = { padding: 32, textAlign: 'center', color: '#94A3B8' };
const categoryRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12,
};
const catBtn: React.CSSProperties = {
  background: 'rgba(11,17,32,0.6)', border: '1px solid rgba(255,255,255,0.08)',
  color: '#94A3B8', padding: '10px', borderRadius: 8, cursor: 'pointer',
  fontSize: 13, fontFamily: 'inherit', minHeight: 40,
};
const catActive: React.CSSProperties = {
  background: 'rgba(90,200,250,0.18)', color: '#5AC8FA',
  borderColor: 'rgba(90,200,250,0.4)',
};
const tierBlock: React.CSSProperties = { marginBottom: 14 };
const showroomGrid: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };
const tierHeading: React.CSSProperties = {
  margin: '0 4px 6px',
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#94A3B8',
};
