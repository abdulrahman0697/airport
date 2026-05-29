/**
 * Aircraft Detail modal (Design pass D1).
 *
 * Triggered from the Fleet panel — tap an aircraft row to see its
 * stylised illustration, full stat sheet, and upgrade levels.
 *
 * Uses the design-system Modal primitive so motion / dismiss
 * behaviour matches every future modal in the game.
 */
import { useState } from 'react';
import { conditionBand } from '../../engine/condition';
import { getAircraftDef } from '../../data/aircraft';
import type { OwnedAircraft } from '../../engine/types';
import { upgradeCost, UPGRADE_SPECS, type UpgradeKind } from '../../engine/upgrades';
import { Modal } from '../design/Modal';
import { COLOR, RADIUS, SHADOW, SPACE, TYPE } from '../design/tokens';
import { AircraftIllustration } from '../design/SvgAircraft';
import { selectCash, selectTailColor, useGameStore } from '../../state/store';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

export function AircraftDetailModal({
  aircraft,
  onClose,
}: {
  aircraft: OwnedAircraft | null;
  onClose: () => void;
}) {
  const tailColor = useGameStore(selectTailColor);
  const cash = useGameStore(selectCash);
  const applyUpgrade = useGameStore((s) => s.applyUpgrade);
  const def = aircraft ? getAircraftDef(aircraft.defId) : null;
  const [error, setError] = useState<string | null>(null);

  const tryUpgrade = (uid: string, kind: UpgradeKind): void => {
    const res = applyUpgrade(uid, kind);
    if (res.ok) {
      haptics.heavy();
      sfx.play('upgrade_complete');
      setError(null);
    } else {
      haptics.warning();
      setError(res.message);
    }
  };

  return (
    <Modal open={!!aircraft && !!def} onClose={onClose} maxWidth={460} accent={tailColor}>
      {aircraft && def && (
        <div>
          <div style={heroStripe(tailColor)}>
            <div style={tierChip(tailColor)}>{def.category === 'cargo' ? 'CARGO' : `TIER ${def.tier}`}</div>
            <div style={heroIllustrationWrap}>
              <AircraftIllustration defId={def.id} tailColor={tailColor} width={300} />
            </div>
            <div style={heroFooter}>
              <span style={tailDot(tailColor)} aria-hidden />
              <div>
                <div style={heroName}>{def.displayName}</div>
                <div style={heroSubtitle}>
                  {def.category === 'cargo' ? 'Freighter' : 'Passenger jet'}
                  · {def.capacity} {def.category === 'cargo' ? 'tonnes' : 'seats'}
                  · {def.rangeKm.toLocaleString()} km range
                </div>
              </div>
            </div>
          </div>

          <div style={body}>
            <div style={statGrid}>
              <Stat label="Condition" value={`${aircraft.condition.toFixed(0)}%`} colorBy={conditionBand(aircraft.condition)} />
              <Stat label="Hours" value={Math.round(aircraft.flightHoursAccumulated).toLocaleString()} />
              {(() => {
                const effSpeed = Math.round(def.cruiseSpeedKmh * (1 + 0.10 * aircraft.upgrades.engine));
                const effBurn = Math.round(def.fuelPerHour * Math.max(0.5, 1 - 0.10 * aircraft.upgrades.fuelEff));
                const effCap = Math.round(def.capacity * (1 + 0.10 * aircraft.upgrades.cabin));
                return (
                  <>
                    <Stat
                      label="Speed"
                      value={`${effSpeed.toLocaleString()} km/h`}
                      delta={effSpeed - def.cruiseSpeedKmh}
                    />
                    <Stat
                      label="Burn rate"
                      value={`${effBurn.toLocaleString()}/hr`}
                      delta={effBurn - def.fuelPerHour}
                      lowerIsBetter
                    />
                    <Stat
                      label={def.category === 'cargo' ? 'Capacity' : 'Seats'}
                      value={`${effCap.toLocaleString()}`}
                      delta={effCap - def.capacity}
                    />
                    <Stat label="Range" value={`${def.rangeKm.toLocaleString()} km`} accent={COLOR.accent.cyan} />
                  </>
                );
              })()}
            </div>

            <div style={sectionHead}>Upgrades — tap to install</div>
            <div style={upgradeGrid}>
              {(['engine', 'cabin', 'fuelEff', 'marketing'] as const).map((k) => {
                const lvl = aircraft.upgrades[k];
                const max = UPGRADE_SPECS[k].maxLevel;
                const atMax = lvl >= max;
                const cost = atMax ? 0 : upgradeCost(aircraft, k);
                const afford = cash >= cost;
                const enabled = !atMax && afford;
                return (
                  <button
                    key={k}
                    onClick={(): void => tryUpgrade(aircraft.uid, k)}
                    disabled={!enabled}
                    style={{
                      ...upgradeCard,
                      borderColor: enabled ? `${tailColor}66` : COLOR.border.soft,
                      opacity: atMax ? 0.55 : afford ? 1 : 0.75,
                      cursor: enabled ? 'pointer' : 'default',
                    }}
                  >
                    <div style={upgradeCardHead}>
                      <span style={upgradeCardLabel}>{LABEL[k]}</span>
                      <span style={upgradeCardLevel(tailColor)}>{lvl} / {max}</span>
                    </div>
                    <div style={upgradeDots}>
                      {Array.from({ length: max }).map((_, i) => (
                        <span
                          key={i}
                          style={{
                            ...dot,
                            background: i < lvl ? tailColor : COLOR.border.medium,
                            boxShadow: i < lvl ? `0 0 4px ${tailColor}` : 'none',
                          }}
                        />
                      ))}
                    </div>
                    <div style={upgradeImpact}>{IMPACT[k]}</div>
                    <div style={upgradeFootRow}>
                      {atMax ? (
                        <span style={{ ...upgradeMaxPill, color: COLOR.success, borderColor: `${COLOR.success}55` }}>Maxed</span>
                      ) : (
                        <>
                          <span style={{ ...upgradeCost_, color: afford ? COLOR.gold.base : COLOR.danger }}>
                            ${formatCash(cost, 1)}
                          </span>
                          <span style={upgradeCta(enabled ? tailColor : COLOR.ink.faint)}>
                            {afford ? 'Install →' : 'Need more cash'}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {error && <div style={errorText}>{error}</div>}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({
  label,
  value,
  accent = COLOR.ink.primary,
  colorBy,
  delta,
  lowerIsBetter,
}: {
  label: string;
  value: string;
  accent?: string;
  colorBy?: 'normal' | 'degraded' | 'critical';
  /** Difference from the base (un-upgraded) value. */
  delta?: number;
  /** Burn rate goes the other way — a negative delta is good. */
  lowerIsBetter?: boolean;
}) {
  let color = accent;
  if (colorBy === 'normal') color = COLOR.success;
  else if (colorBy === 'degraded') color = COLOR.warn;
  else if (colorBy === 'critical') color = COLOR.danger;

  const showDelta = delta !== undefined && delta !== 0;
  const positive = showDelta && (lowerIsBetter ? delta! < 0 : delta! > 0);
  const deltaText = showDelta
    ? `${delta! > 0 ? '+' : ''}${delta!.toLocaleString()}`
    : null;

  return (
    <div style={statCell}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color: positive ? COLOR.success : color }}>
        {value}
        {showDelta && (
          <span style={{
            marginLeft: 6,
            fontSize: 11,
            fontWeight: 700,
            color: positive ? COLOR.success : COLOR.warn,
          }}>
            ({deltaText})
          </span>
        )}
      </div>
    </div>
  );
}

const LABEL: Record<UpgradeKind, string> = {
  engine: 'Engine',
  cabin: 'Cabin',
  fuelEff: 'Fuel Eff.',
  marketing: 'Brand Mktg',
};

/* Per-level effect copy — short and concrete so the player can see
   exactly what the next install buys them. Values track the engine
   constants in src/engine/upgrades.ts (BRD §4.7). */
const IMPACT: Record<UpgradeKind, string> = {
  engine:    '+5% speed · faster legs, more revenue / sec',
  cabin:     '+5% capacity · more revenue per leg',
  fuelEff:   '−10% fuel burn · gentler on supply',
  marketing: '+3 load factor · more seats sold',
};

// ─── Styles ──────────────────────────────────────────────────────────
const heroStripe = (tail: string): React.CSSProperties => ({
  background: `linear-gradient(160deg, ${tail}38, ${COLOR.bg.deep})`,
  padding: `${SPACE.l}px ${SPACE.l}px ${SPACE.s}px`,
  borderBottom: `1px solid ${tail}33`,
});
const tierChip = (tail: string): React.CSSProperties => ({
  fontSize: TYPE.tag.size,
  fontWeight: TYPE.tag.weight,
  letterSpacing: TYPE.tag.letter,
  textTransform: TYPE.tag.transform,
  color: tail,
  background: `${tail}22`,
  border: `1px solid ${tail}55`,
  padding: '4px 10px',
  borderRadius: RADIUS.pill,
  display: 'inline-block',
});
const heroIllustrationWrap: React.CSSProperties = {
  display: 'grid', placeItems: 'center', marginTop: SPACE.s,
  filter: `drop-shadow(${SHADOW.card})`,
};
const heroFooter: React.CSSProperties = {
  marginTop: SPACE.s,
  display: 'flex', alignItems: 'center', gap: SPACE.m,
};
const tailDot = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  width: 14, height: 14, borderRadius: 4,
  background: color, boxShadow: `0 0 10px ${color}`,
});
const heroName: React.CSSProperties = {
  fontSize: TYPE.title.size,
  fontWeight: TYPE.title.weight,
  letterSpacing: TYPE.title.letter,
  color: COLOR.ink.primary,
};
const heroSubtitle: React.CSSProperties = {
  fontSize: TYPE.small.size,
  color: COLOR.ink.muted,
  marginTop: 2,
};
const body: React.CSSProperties = {
  padding: `${SPACE.l}px ${SPACE.l}px ${SPACE.xl}px`,
  display: 'flex', flexDirection: 'column', gap: SPACE.m,
  overflowY: 'auto',
};
const statGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: SPACE.s,
};
const statCell: React.CSSProperties = {
  background: COLOR.bg.glass,
  border: `1px solid ${COLOR.border.soft}`,
  borderRadius: RADIUS.m,
  padding: '10px 12px',
};
const statLabel: React.CSSProperties = {
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.letter,
  textTransform: TYPE.label.transform,
  color: COLOR.ink.muted,
};
const statValue: React.CSSProperties = {
  fontSize: 17, fontWeight: 700, marginTop: 2,
  fontFeatureSettings: '"tnum" 1',
};
const sectionHead: React.CSSProperties = {
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.letter,
  textTransform: TYPE.label.transform,
  color: COLOR.ink.muted,
  marginTop: SPACE.s,
};
const upgradeGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: SPACE.s,
};
const upgradeCard: React.CSSProperties = {
  background: COLOR.bg.glass,
  border: '1px solid',
  borderRadius: RADIUS.m,
  padding: '10px 12px',
  display: 'flex', flexDirection: 'column', gap: 6,
  textAlign: 'left',
  fontFamily: 'inherit',
  color: COLOR.ink.primary,
};
const upgradeCardHead: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
};
const upgradeCardLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', color: COLOR.ink.primary,
};
const upgradeCardLevel = (tail: string): React.CSSProperties => ({
  fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: tail,
  fontFeatureSettings: '"tnum" 1',
});
const upgradeDots: React.CSSProperties = {
  display: 'flex', gap: 3,
};
const dot: React.CSSProperties = {
  width: 6, height: 6, borderRadius: RADIUS.pill,
};
const upgradeImpact: React.CSSProperties = {
  fontSize: 10, color: COLOR.ink.muted, lineHeight: 1.35,
};
const upgradeFootRow: React.CSSProperties = {
  marginTop: 2,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const upgradeCost_: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, fontFeatureSettings: '"tnum" 1',
};
const upgradeCta = (color: string): React.CSSProperties => ({
  fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
  color, textTransform: 'uppercase',
});
const upgradeMaxPill: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
  padding: '2px 6px', borderRadius: 4, border: '1px solid',
  textTransform: 'uppercase',
};
const errorText: React.CSSProperties = {
  marginTop: SPACE.s,
  padding: '8px 10px', fontSize: 11, color: COLOR.danger,
  background: COLOR.dangerDim, borderRadius: 6,
};
