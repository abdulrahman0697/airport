/**
 * Aircraft Detail modal (Design pass D1).
 *
 * Triggered from the Fleet panel — tap an aircraft row to see its
 * stylised illustration, full stat sheet, and upgrade levels.
 *
 * Uses the design-system Modal primitive so motion / dismiss
 * behaviour matches every future modal in the game.
 */
import { conditionBand } from '../../engine/condition';
import { getAircraftDef } from '../../data/aircraft';
import type { OwnedAircraft } from '../../engine/types';
import { Modal } from '../design/Modal';
import { COLOR, RADIUS, SHADOW, SPACE, TYPE } from '../design/tokens';
import { AircraftIllustration } from '../design/SvgAircraft';
import { selectTailColor, useGameStore } from '../../state/store';
import { formatCash } from '../format';

export function AircraftDetailModal({
  aircraft,
  onClose,
}: {
  aircraft: OwnedAircraft | null;
  onClose: () => void;
}) {
  const tailColor = useGameStore(selectTailColor);
  const def = aircraft ? getAircraftDef(aircraft.defId) : null;

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
              <Stat label="Speed" value={`${def.cruiseSpeedKmh.toLocaleString()} km/h`} />
              <Stat label="Burn rate" value={`${def.fuelPerHour.toLocaleString()}/hr`} />
              <Stat label="Cost" value={`$${formatCash(def.basePurchaseCost)}`} accent={COLOR.gold.base} />
              <Stat label="Range" value={`${def.rangeKm.toLocaleString()} km`} accent={COLOR.accent.cyan} />
            </div>

            <div style={sectionHead}>Upgrades</div>
            <div style={upgradeGrid}>
              {(['engine', 'cabin', 'fuelEff', 'marketing'] as const).map((k) => (
                <div key={k} style={upgradeCell}>
                  <div style={upgradeLabel}>{LABEL[k]}</div>
                  <div style={upgradeDots}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        style={{
                          ...dot,
                          background: i < aircraft.upgrades[k] ? tailColor : COLOR.border.medium,
                          boxShadow: i < aircraft.upgrades[k] ? `0 0 6px ${tailColor}` : 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={footnote}>
              Tap any aircraft in the Fleet list to see its detail card. Upgrades, repairs and route assignments still happen from the Fleet panel.
            </div>
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
}: {
  label: string;
  value: string;
  accent?: string;
  colorBy?: 'normal' | 'degraded' | 'critical';
}) {
  let color = accent;
  if (colorBy === 'normal') color = COLOR.success;
  else if (colorBy === 'degraded') color = COLOR.warn;
  else if (colorBy === 'critical') color = COLOR.danger;
  return (
    <div style={statCell}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color }}>{value}</div>
    </div>
  );
}

const LABEL: Record<'engine' | 'cabin' | 'fuelEff' | 'marketing', string> = {
  engine: 'Engine',
  cabin: 'Cabin',
  fuelEff: 'Fuel eff.',
  marketing: 'Marketing',
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
const upgradeCell: React.CSSProperties = {
  background: COLOR.bg.glass,
  border: `1px solid ${COLOR.border.soft}`,
  borderRadius: RADIUS.m,
  padding: '10px 12px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const upgradeLabel: React.CSSProperties = {
  fontSize: TYPE.small.size, color: COLOR.ink.secondary,
};
const upgradeDots: React.CSSProperties = {
  display: 'flex', gap: 4,
};
const dot: React.CSSProperties = {
  width: 8, height: 8, borderRadius: RADIUS.pill,
};
const footnote: React.CSSProperties = {
  marginTop: SPACE.s,
  padding: SPACE.s,
  background: COLOR.bg.glass,
  border: `1px solid ${COLOR.border.soft}`,
  borderRadius: RADIUS.m,
  fontSize: 11,
  color: COLOR.ink.faint,
  lineHeight: 1.5,
};
