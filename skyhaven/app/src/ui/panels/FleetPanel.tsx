import { useMemo, useState } from 'react';
import { AIRCRAFT_DEFS, getAircraftDef } from '../../data/aircraft';
import { conditionBand, repairCost } from '../../engine/condition';
import { MAX_TIER } from '../../engine/tierUnlocks';
import { AircraftDetailModal } from '../components/AircraftDetailModal';
import {
  UPGRADE_LABELS,
  UPGRADE_SPECS,
  romanLevel,
  upgradeCost,
  type UpgradeKind,
} from '../../engine/upgrades';
import type { AircraftDef, OwnedAircraft } from '../../engine/types';
import {
  selectCash,
  selectFleet,
  selectTier,
  selectTutorialCompleted,
  selectVintage,
  useGameStore,
} from '../../state/store';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';
import { VintageHangar } from './VintageHangar';

type BuyCategoryFilter = 'passenger' | 'cargo';

export function FleetPanel() {
  const [tab, setTab] = useState<'owned' | 'buy' | 'vintage'>('owned');
  const fleet = useGameStore(selectFleet);
  const vintage = useGameStore(selectVintage);
  const tutorialCompleted = useGameStore(selectTutorialCompleted);
  const resetTutorial = useGameStore((s) => s.resetTutorial);

  return (
    <div style={shell}>
      <div style={header}>
        <h2 style={title}>Fleet</h2>
        <div style={subtitleRow}>
          <span style={subtitle}>{fleet.length} aircraft</span>
          {tutorialCompleted && (
            <button onClick={(): void => { resetTutorial(); }} style={replayLink}>
              Replay tutorial
            </button>
          )}
        </div>
        <div role="tablist" style={tabs}>
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
      </div>
      <div style={body}>
        {tab === 'owned' && <OwnedList />}
        {tab === 'buy' && <BuyList />}
        {tab === 'vintage' && <VintageHangar />}
      </div>
    </div>
  );
}

// ──── Owned tab ──────────────────────────────────────────────────────
function OwnedList() {
  const fleet = useGameStore(selectFleet);
  const [detail, setDetail] = useState<OwnedAircraft | null>(null);
  if (fleet.length === 0) return <div style={empty}>No aircraft. Switch to "Buy aircraft" to start your fleet.</div>;
  return (
    <>
      <ul style={list}>
        {fleet.map((a) => (
          <FleetRow key={a.uid} aircraft={a} onOpenDetail={(): void => setDetail(a)} />
        ))}
      </ul>
      <AircraftDetailModal aircraft={detail} onClose={(): void => setDetail(null)} />
    </>
  );
}

function FleetRow({ aircraft, onOpenDetail }: { aircraft: OwnedAircraft; onOpenDetail: () => void }) {
  const def = getAircraftDef(aircraft.defId);
  const cash = useGameStore(selectCash);
  const applyUpgrade = useGameStore((s) => s.applyUpgrade);
  const repair = useGameStore((s) => s.repairAircraft);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  if (!def) return null;

  const band = conditionBand(aircraft.condition);
  const condColor = band === 'normal' ? '#34D399' : band === 'degraded' ? '#F59E0B' : '#F87171';
  const repCost = repairCost(aircraft);
  const isCargo = def.category === 'cargo';
  const tierLabel = isCargo ? 'Cargo' : `T${def.tier}`;
  const capLabel = isCargo ? `${def.capacity} units` : `${def.capacity} pax`;

  const tryUpgrade = (kind: UpgradeKind): void => {
    const res = applyUpgrade(aircraft.uid, kind);
    if (res.ok) haptics.light();
    else haptics.warning();
    setErrorMsg(res.ok ? null : res.message);
  };
  const tryRepair = (): void => {
    const res = repair(aircraft.uid);
    if (res.ok) haptics.medium();
    else haptics.warning();
    setErrorMsg(res.ok ? null : res.message);
  };

  return (
    <li style={card}>
      <div style={cardHeader}>
        <button
          onClick={onOpenDetail}
          style={cardTitleBtn}
          aria-label={`Open details for ${def.displayName}`}
        >
          <div style={cardTitle}>
            {def.displayName}
            {isCargo && <span style={cargoBadge}>CARGO</span>}
            <span style={detailArrow}>→</span>
          </div>
          <div style={cardSubtitle}>
            {tierLabel} · {capLabel} · {def.rangeKm.toLocaleString()} km
            {aircraft.routeId ? ' · in service' : ' · in hangar'}
          </div>
        </button>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: condColor, fontSize: 13, fontWeight: 600 }}>
            {aircraft.condition.toFixed(0)}%
          </div>
          <div style={{ color: '#94A3B8', fontSize: 10 }}>{band}</div>
        </div>
      </div>

      <div style={upgradeGrid}>
        {(['engine', 'cabin', 'fuelEff', 'marketing'] as const).map((kind) => {
          const level = aircraft.upgrades[kind];
          const max = UPGRADE_SPECS[kind].maxLevel;
          const cost = upgradeCost(aircraft, kind);
          const can = level < max;
          const afford = cash >= cost;
          return (
            <button
              key={kind}
              disabled={!can || !afford}
              onClick={(): void => tryUpgrade(kind)}
              style={{ ...upgradeBtn, opacity: !can ? 0.4 : afford ? 1 : 0.6 }}
              title={can ? `Upgrade ${UPGRADE_LABELS[kind]} → ${romanLevel(level + 1)}` : 'Maxed'}
            >
              <div style={upgradeName}>{UPGRADE_LABELS[kind]}</div>
              <div style={upgradeLevel}>{romanLevel(level)} / {romanLevel(max)}</div>
              {can && <div style={upgradeCostText}>${formatCash(cost, 1)}</div>}
            </button>
          );
        })}
      </div>

      {aircraft.condition < 100 && (
        <button
          disabled={cash < repCost}
          onClick={tryRepair}
          style={{ ...repairBtn, opacity: cash >= repCost ? 1 : 0.5 }}
        >
          Repair to 100% · ${formatCash(repCost, 1)}
        </button>
      )}

      {errorMsg && <div style={errorText}>{errorMsg}</div>}
    </li>
  );
}

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
          <ul style={list}>
            {items.map((d) => (
              <BuyRow
                key={d.id}
                def={d}
                unlocked={d.category === 'cargo' ? cargoUnlocked : d.tier <= tier}
              />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function BuyRow({ def, unlocked }: { def: AircraftDef; unlocked: boolean }) {
  const cash = useGameStore(selectCash);
  const buy = useGameStore((s) => s.buyAircraft);
  const [error, setError] = useState<string | null>(null);
  const afford = cash >= def.basePurchaseCost;
  const isCargo = def.category === 'cargo';
  const lockedLabel = isCargo ? 'Unlock at T5' : `Unlock at T${def.tier}`;
  const tierLabel = isCargo ? 'Cargo' : `T${def.tier}`;
  const capLabel = isCargo ? `${def.capacity} units` : `${def.capacity} pax`;

  const tryBuy = (): void => {
    const res = buy(def.id);
    if (res.ok) haptics.medium();
    else haptics.warning();
    setError(res.ok ? null : res.message);
  };

  return (
    <li style={card}>
      <div style={cardHeader}>
        <div>
          <div style={cardTitle}>
            {def.displayName}
            {isCargo && <span style={cargoBadge}>CARGO</span>}
          </div>
          <div style={cardSubtitle}>
            {tierLabel} · {capLabel} · {def.rangeKm.toLocaleString()} km · {def.cruiseSpeedKmh} km/h
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={priceText}>${formatCash(def.basePurchaseCost, 1)}</div>
          {!unlocked && <div style={lockedPill}>{lockedLabel}</div>}
        </div>
      </div>
      <button
        {...(def.id === 't1.atr42' && unlocked && afford ? { 'data-tutorial': 'buy-aircraft-atr42' } : {})}
        disabled={!unlocked || !afford}
        onClick={tryBuy}
        style={{ ...buyBtn, opacity: !unlocked ? 0.35 : afford ? 1 : 0.6 }}
      >
        {!unlocked ? lockedLabel : afford ? 'Buy' : 'Not enough cash'}
      </button>
      {error && <div style={errorText}>{error}</div>}
    </li>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const header: React.CSSProperties = { padding: '20px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' };
const title: React.CSSProperties = { margin: 0, fontSize: 22, color: '#F8FAFC' };
const subtitle: React.CSSProperties = { color: '#94A3B8', fontSize: 12 };
const subtitleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 2,
  gap: 12,
};
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
const tabs: React.CSSProperties = { display: 'flex', gap: 6, marginTop: 12 };
const tabBtn: React.CSSProperties = {
  background: 'transparent', color: '#94A3B8', border: 0, padding: '8px 14px', borderRadius: 8,
  cursor: 'pointer', fontSize: 13, minHeight: 36, fontFamily: 'inherit',
};
const tabActive: React.CSSProperties = { background: 'rgba(90,200,250,0.12)', color: '#5AC8FA' };
const body: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: 12 };
const list: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 };
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12,
  border: '1px solid rgba(255,255,255,0.06)',
};
const cardHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 };
const cardTitleBtn: React.CSSProperties = {
  display: 'block',
  textAlign: 'left',
  background: 'transparent',
  border: 0,
  padding: 0,
  cursor: 'pointer',
  color: 'inherit',
  fontFamily: 'inherit',
  flex: 1,
  minWidth: 0,
};
const detailArrow: React.CSSProperties = {
  marginLeft: 6,
  fontSize: 12,
  color: '#5AC8FA',
  opacity: 0.7,
};
const cardTitle: React.CSSProperties = {
  color: '#F8FAFC', fontSize: 15, fontWeight: 600,
  display: 'inline-flex', alignItems: 'center', gap: 8,
};
const cardSubtitle: React.CSSProperties = { color: '#94A3B8', fontSize: 11, marginTop: 2 };
const upgradeGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 10 };
const upgradeBtn: React.CSSProperties = {
  background: 'rgba(11,17,32,0.6)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, padding: '8px 10px', textAlign: 'left', color: '#F8FAFC',
  cursor: 'pointer', minHeight: 56, fontFamily: 'inherit',
};
const upgradeName: React.CSSProperties = { fontSize: 11, color: '#94A3B8', letterSpacing: '0.04em' };
const upgradeLevel: React.CSSProperties = { fontSize: 14, fontWeight: 600, marginTop: 2 };
const upgradeCostText: React.CSSProperties = { fontSize: 10, color: '#F4C75B', marginTop: 2, fontFeatureSettings: '"tnum" 1' };
const repairBtn: React.CSSProperties = {
  width: '100%', marginTop: 10, padding: '10px 12px', borderRadius: 8,
  background: 'rgba(245,158,11,0.18)', color: '#F59E0B',
  border: '1px solid rgba(245,158,11,0.45)', minHeight: 44, cursor: 'pointer',
  fontWeight: 600, fontFamily: 'inherit', fontFeatureSettings: '"tnum" 1',
};
const buyBtn: React.CSSProperties = {
  width: '100%', marginTop: 12, padding: '12px', borderRadius: 8,
  background: '#5AC8FA', color: '#0B1120', border: 0,
  minHeight: 44, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit',
};
const priceText: React.CSSProperties = { color: '#F4C75B', fontSize: 14, fontWeight: 700, fontFeatureSettings: '"tnum" 1' };
const lockedPill: React.CSSProperties = {
  marginTop: 4, fontSize: 9, color: '#94A3B8', letterSpacing: '0.08em',
  textTransform: 'uppercase', background: 'rgba(255,255,255,0.05)',
  padding: '2px 6px', borderRadius: 4, display: 'inline-block',
};
const cargoBadge: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.1em', fontWeight: 700,
  color: '#F4C75B', background: 'rgba(244,199,91,0.14)',
  border: '1px solid rgba(244,199,91,0.4)',
  padding: '2px 6px', borderRadius: 4,
};
const errorText: React.CSSProperties = {
  marginTop: 8, padding: '6px 10px', fontSize: 11, color: '#F87171',
  background: 'rgba(248,113,113,0.08)', borderRadius: 6,
};
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
const tierHeading: React.CSSProperties = {
  margin: '0 4px 6px',
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#94A3B8',
};
