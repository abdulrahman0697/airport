import { useState } from 'react';
import { FUEL_CAPACITY_TIERS, nextCapacityTier } from '../../data/fuelCapacity';
import { FUEL_CONTRACTS } from '../../data/fuelContracts';
import { selectCash, useGameStore } from '../../state/store';
import { PanelHeader } from '../design/PanelHeader';
import { sfx } from '../juice/sfx';
import { showRewardedAd } from '../monetize/ads';
import { formatCash } from '../format';

export function FuelPanel() {
  const cash = useGameStore(selectCash);
  const fuel = useGameStore((s) => s.state?.fuel);
  const signContract = useGameStore((s) => s.signFuelContract);
  const upgradeCapacity = useGameStore((s) => s.upgradeFuelCapacity);
  const fillFuel = useGameStore((s) => s.fillFuel);
  const [error, setError] = useState<string | null>(null);
  const [filling, setFilling] = useState(false);

  const watchFill = async (): Promise<void> => {
    if (filling) return;
    setFilling(true);
    const ok = await showRewardedAd('fuel_fill');
    if (ok) { fillFuel(); sfx.play('claim_coin'); }
    setFilling(false);
  };

  if (!fuel) return null;
  const net = fuel.supplyRate - fuel.demandRate;
  const pct = fuel.capacity > 0 ? Math.max(0, Math.min(1, fuel.reserve / fuel.capacity)) : 0;
  const next = nextCapacityTier(fuel.capacity);

  const trySign = (id: string): void => {
    const res = signContract(id);
    setError(res.ok ? null : res.message);
  };
  const tryUpgrade = (): void => {
    const res = upgradeCapacity();
    setError(res.ok ? null : res.message);
  };

  return (
    <div style={shell}>
      <PanelHeader
        kicker="Supply chain"
        title="Fuel"
        subtitle={`Net flow ${net >= 0 ? '+' : ''}${net.toFixed(1)}/s · Reserve ${Math.round(pct * 100)}%`}
      />
      <div style={body}>
        <section style={card}>
          <div style={readingRow}>
            <div>
              <div style={readingLabel}>Reserve</div>
              <div style={readingValue}>
                {formatCash(fuel.reserve, 0)} <span style={muted}>/ {formatCash(fuel.capacity, 0)}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={readingLabel}>Net</div>
              <div style={{ ...readingValue, color: net >= 0 ? '#34D399' : '#F59E0B' }}>
                {net >= 0 ? '+' : ''}{net.toFixed(1)}/s
              </div>
            </div>
          </div>
          <div style={progressTrack}>
            <div style={{ ...progressFill, width: `${pct * 100}%` }} />
          </div>
          <div style={subRow}>
            <span>Supply: <b>{fuel.supplyRate.toFixed(1)}/s</b></span>
            <span>Demand: <b>{fuel.demandRate.toFixed(1)}/s</b></span>
          </div>
          {fuel.reserve < fuel.capacity && (
            <button style={fillBtn} disabled={filling} onClick={(): void => { void watchFill(); }}>
              {filling ? 'Loading ad…' : '▶  Watch ad → fill fuel to 100%'}
            </button>
          )}
        </section>

        <h3 style={sectionTitle}>Fuel contracts</h3>
        <ul style={list}>
          {(() => {
            let firstUnsignedTagged = false;
            return FUEL_CONTRACTS.map((c) => {
              const signed = fuel.contracts.includes(c.id);
              const afford = cash >= c.cost;
              const isFirstUnsigned = !signed && !firstUnsignedTagged;
              if (isFirstUnsigned) firstUnsignedTagged = true;
              return (
              <li key={c.id} style={card}>
                <div style={cardHeader}>
                  <div>
                    <div style={cardTitle}>{c.name}</div>
                    <div style={cardSubtitle}>+{c.supplyRatePerSec.toLocaleString()} fuel/s</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {signed
                      ? <span style={signedPill}>Signed</span>
                      : <span style={costText}>{c.cost === 0 ? 'Free' : `$${formatCash(c.cost, 1)}`}</span>}
                  </div>
                </div>
                {!signed && (
                  <button
                    {...(isFirstUnsigned ? { 'data-tutorial': 'fuel-sign-contract' } : {})}
                    onClick={(): void => trySign(c.id)}
                    disabled={!afford && c.cost > 0}
                    style={{ ...signBtn, opacity: afford || c.cost === 0 ? 1 : 0.5 }}
                  >
                    {c.cost === 0 ? 'Activate' : 'Sign contract'}
                  </button>
                )}
              </li>
            );
            });
          })()}
        </ul>

        <h3 style={sectionTitle}>Reserve capacity</h3>
        <section style={card}>
          {next ? (
            <>
              <div style={cardHeader}>
                <div>
                  <div style={cardTitle}>Expand to Tier {next.level}</div>
                  <div style={cardSubtitle}>
                    {formatCash(fuel.capacity, 0)} → <b>{formatCash(next.capacity, 0)}</b> fuel ceiling
                  </div>
                </div>
                <div style={costText}>${formatCash(next.cost, 1)}</div>
              </div>
              <button
                onClick={tryUpgrade}
                disabled={cash < next.cost}
                style={{ ...signBtn, opacity: cash >= next.cost ? 1 : 0.5 }}
              >
                Upgrade capacity
              </button>
            </>
          ) : (
            <div style={muted}>Capacity at max tier ({FUEL_CAPACITY_TIERS.length - 1}).</div>
          )}
        </section>

        {error && <div style={errorText}>{error}</div>}
      </div>
    </div>
  );
}

const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const body: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: 12 };
const list: React.CSSProperties = { listStyle: 'none', margin: '0 0 12px', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 };
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  padding: 12,
  marginBottom: 10,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase',
  color: '#94A3B8', margin: '16px 4px 8px',
};
const readingRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const readingLabel: React.CSSProperties = {
  fontSize: 10, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase',
};
const readingValue: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: '#F8FAFC', marginTop: 2,
  fontFeatureSettings: '"tnum" 1',
};
const progressTrack: React.CSSProperties = {
  height: 8,
  background: 'rgba(255,255,255,0.05)',
  borderRadius: 4,
  marginTop: 10,
  overflow: 'hidden',
};
const progressFill: React.CSSProperties = {
  height: '100%',
  background: '#5AC8FA',
  transition: 'width 240ms ease',
};
const subRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  color: '#94A3B8',
  fontSize: 11,
  marginTop: 10,
  fontFeatureSettings: '"tnum" 1',
};
const fillBtn: React.CSSProperties = {
  marginTop: 12, width: '100%', minHeight: 40, borderRadius: 8, border: 0,
  background: '#F4C75B', color: '#0B1120', fontWeight: 800, fontSize: 12,
  cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.03em',
};
const cardHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const cardTitle: React.CSSProperties = { color: '#F8FAFC', fontSize: 14, fontWeight: 600 };
const cardSubtitle: React.CSSProperties = { color: '#94A3B8', fontSize: 11, marginTop: 2 };
const costText: React.CSSProperties = { color: '#F4C75B', fontWeight: 700, fontFeatureSettings: '"tnum" 1' };
const signedPill: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#34D399', background: 'rgba(52,211,153,0.12)',
  padding: '3px 8px', borderRadius: 4,
};
const signBtn: React.CSSProperties = {
  width: '100%', marginTop: 10, padding: 10, borderRadius: 8,
  background: '#5AC8FA', color: '#0B1120', border: 0, fontWeight: 700,
  cursor: 'pointer', minHeight: 40, fontFamily: 'inherit',
};
const muted: React.CSSProperties = { color: '#94A3B8' };
const errorText: React.CSSProperties = {
  marginTop: 12, padding: '8px 12px', fontSize: 12, color: '#F87171',
  background: 'rgba(248,113,113,0.08)', borderRadius: 8,
};
