import { useState } from 'react';
import { AIRCRAFT_DEFS, getAircraftDef } from '../../data/aircraft';
import { conditionBand, repairCost } from '../../engine/condition';
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
  useGameStore,
} from '../../state/store';
import { formatCash } from '../format';

export function FleetPanel() {
  const [tab, setTab] = useState<'owned' | 'buy'>('owned');
  const fleet = useGameStore(selectFleet);

  return (
    <div style={shell}>
      <div style={header}>
        <h2 style={title}>Fleet</h2>
        <div style={subtitle}>{fleet.length} aircraft</div>
        <div role="tablist" style={tabs}>
          <button
            role="tab"
            onClick={(): void => setTab('owned')}
            style={{ ...tabBtn, ...(tab === 'owned' ? tabActive : {}) }}
          >
            Owned ({fleet.length})
          </button>
          <button
            role="tab"
            onClick={(): void => setTab('buy')}
            style={{ ...tabBtn, ...(tab === 'buy' ? tabActive : {}) }}
          >
            Buy aircraft
          </button>
        </div>
      </div>
      <div style={body}>
        {tab === 'owned' ? <OwnedList /> : <BuyList />}
      </div>
    </div>
  );
}

function OwnedList() {
  const fleet = useGameStore(selectFleet);
  if (fleet.length === 0) return <div style={empty}>No aircraft. Switch to "Buy aircraft" to start your fleet.</div>;
  return (
    <ul style={list}>
      {fleet.map((a) => <FleetRow key={a.uid} aircraft={a} />)}
    </ul>
  );
}

function FleetRow({ aircraft }: { aircraft: OwnedAircraft }) {
  const def = getAircraftDef(aircraft.defId);
  const cash = useGameStore(selectCash);
  const applyUpgrade = useGameStore((s) => s.applyUpgrade);
  const repair = useGameStore((s) => s.repairAircraft);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  if (!def) return null;

  const band = conditionBand(aircraft.condition);
  const condColor = band === 'normal' ? '#34D399' : band === 'degraded' ? '#F59E0B' : '#F87171';
  const repCost = repairCost(aircraft);

  const tryUpgrade = (kind: UpgradeKind): void => {
    const res = applyUpgrade(aircraft.uid, kind);
    setErrorMsg(res.ok ? null : res.message);
  };
  const tryRepair = (): void => {
    const res = repair(aircraft.uid);
    setErrorMsg(res.ok ? null : res.message);
  };

  return (
    <li style={card}>
      <div style={cardHeader}>
        <div>
          <div style={cardTitle}>{def.displayName}</div>
          <div style={cardSubtitle}>
            T{def.tier} · {def.capacity} pax · {def.rangeKm.toLocaleString()} km
            {aircraft.routeId ? ' · in service' : ' · in hangar'}
          </div>
        </div>
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

function BuyList() {
  const tier = useGameStore(selectTier);
  return (
    <ul style={list}>
      {AIRCRAFT_DEFS.map((d) => <BuyRow key={d.id} def={d} unlocked={d.tier <= tier} />)}
    </ul>
  );
}

function BuyRow({ def, unlocked }: { def: AircraftDef; unlocked: boolean }) {
  const cash = useGameStore(selectCash);
  const buy = useGameStore((s) => s.buyAircraft);
  const [error, setError] = useState<string | null>(null);
  const afford = cash >= def.basePurchaseCost;

  const tryBuy = (): void => {
    const res = buy(def.id);
    setError(res.ok ? null : res.message);
  };

  return (
    <li style={card}>
      <div style={cardHeader}>
        <div>
          <div style={cardTitle}>{def.displayName}</div>
          <div style={cardSubtitle}>
            T{def.tier} · {def.capacity} pax · {def.rangeKm.toLocaleString()} km · {def.cruiseSpeedKmh} km/h
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={priceText}>${formatCash(def.basePurchaseCost, 1)}</div>
          {!unlocked && <div style={lockedPill}>Locked · T{def.tier}</div>}
        </div>
      </div>
      <button
        disabled={!unlocked || !afford}
        onClick={tryBuy}
        style={{ ...buyBtn, opacity: !unlocked ? 0.35 : afford ? 1 : 0.6 }}
      >
        {!unlocked ? `Unlock at T${def.tier}` : afford ? 'Buy' : 'Not enough cash'}
      </button>
      {error && <div style={errorText}>{error}</div>}
    </li>
  );
}

const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const header: React.CSSProperties = { padding: '20px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' };
const title: React.CSSProperties = { margin: 0, fontSize: 22, color: '#F8FAFC' };
const subtitle: React.CSSProperties = { color: '#94A3B8', fontSize: 12, marginTop: 2 };
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
const cardTitle: React.CSSProperties = { color: '#F8FAFC', fontSize: 15, fontWeight: 600 };
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
const errorText: React.CSSProperties = {
  marginTop: 8, padding: '6px 10px', fontSize: 11, color: '#F87171',
  background: 'rgba(248,113,113,0.08)', borderRadius: 6,
};
const empty: React.CSSProperties = { padding: 32, textAlign: 'center', color: '#94A3B8' };
