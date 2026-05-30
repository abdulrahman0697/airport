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

  // Collapsible tier sections. Default-collapse every tier except the
  // player's current (highest unlocked) one, so they land on the planes
  // they can actually buy without scrolling past locked tiers.
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());
  const openTier = useMemo(() => Math.min(tier, MAX_TIER), [tier]);
  const isCollapsed = (t: number): boolean =>
    collapsed.has(t) ? true : collapsed.has(-t) ? false : t !== openTier;
  const toggle = (t: number): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      // Track explicit user intent with +t (force-collapsed) / -t
      // (force-expanded) so toggling overrides the default-open rule.
      const currentlyCollapsed = isCollapsed(t);
      next.delete(t);
      next.delete(-t);
      next.add(currentlyCollapsed ? -t : t);
      return next;
    });
  };

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
      {grouped.map(({ tier: t, label, items }) => {
        const sectionCollapsed = category === 'cargo' ? false : isCollapsed(t);
        const tierUnlocked = items.some((d) => (d.category === 'cargo' ? cargoUnlocked : d.tier <= tier));
        return (
          <section key={t} style={tierBlock}>
            {category === 'cargo' ? (
              <h3 style={tierHeading}>{label}</h3>
            ) : (
              <button
                type="button"
                onClick={(): void => toggle(t)}
                style={tierToggle}
                aria-expanded={!sectionCollapsed}
              >
                <span style={{ transform: sectionCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 120ms', display: 'inline-block' }}>▾</span>
                <span style={tierToggleLabel}>{label}</span>
                {!tierUnlocked && <span style={tierLockPill}>LOCKED</span>}
                <span style={tierCount}>{items.length}</span>
              </button>
            )}
            {!sectionCollapsed && (
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
            )}
          </section>
        );
      })}
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
const tierToggle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  margin: '0 0 8px',
  padding: '8px 10px',
  background: 'rgba(11,17,32,0.55)',
  border: '1px solid rgba(148,163,184,0.18)',
  borderRadius: 8,
  color: '#94A3B8',
  cursor: 'pointer',
  textAlign: 'left',
};
const tierToggleLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#CBD5E1',
};
const tierLockPill: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.1em',
  color: '#F59E0B',
  border: '1px solid #F59E0B55',
  borderRadius: 999,
  padding: '1px 6px',
};
const tierCount: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: 10,
  fontWeight: 700,
  color: '#64748B',
  background: 'rgba(148,163,184,0.12)',
  borderRadius: 999,
  padding: '1px 8px',
  fontFeatureSettings: '"tnum" 1',
};
