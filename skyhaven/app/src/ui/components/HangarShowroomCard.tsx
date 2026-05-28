/**
 * Hangar Showroom card (Design Review v2 — points 6, 13).
 *
 * Replaces the catalog-style "Buy" row in FleetPanel. Each card is a
 * showroom for a single aircraft def:
 *  - Hero illustration (uses the D1 AircraftIllustration silhouette)
 *  - Role tag based on tier + category ("Regional Workhorse",
 *    "City Connector", "Profit Machine", "Long-Haul Hero", "Mega
 *    Flagship", "Freighter")
 *  - Three "Why buy this?" badges sourced from the aircraft's stats
 *    (best for short / low fuel burn / huge cabin / etc.)
 *  - Stats strip: capacity / range / speed / cruise burn
 *  - Big primary buy button (Button primitive, gold variant on afford)
 *
 * Closes the "buying feels like reading a spreadsheet" gap from the
 * review and treats each aircraft as a collectible asset with
 * personality.
 */
import { useState } from 'react';
import type { AircraftDef } from '../../engine/types';
import { selectCash, selectTailColor, useGameStore } from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../design/Button';
import { Chip } from '../design/Chip';
import { AircraftIllustration } from '../design/SvgAircraft';
import { COLOR, RADIUS, SPACE, TYPE } from '../design/tokens';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

export interface HangarShowroomCardProps {
  def: AircraftDef;
  unlocked: boolean;
  /** Hook fires on successful purchase — caller can show a delivery animation. */
  onDelivered?: (def: AircraftDef) => void;
  isTutorialTarget?: boolean;
}

export function HangarShowroomCard({
  def,
  unlocked,
  onDelivered,
  isTutorialTarget,
}: HangarShowroomCardProps) {
  const cash = useGameStore(selectCash);
  const tailColor = useGameStore(selectTailColor);
  const buy = useGameStore((s) => s.buyAircraft);
  const setPendingDelivery = useUiStore((s) => s.setPendingDelivery);
  const [error, setError] = useState<string | null>(null);
  const [justBought, setJustBought] = useState(false);

  const afford = cash >= def.basePurchaseCost;
  const isCargo = def.category === 'cargo';
  const role = roleFor(def);
  const reasons = whyBuy(def);

  const tryBuy = (): void => {
    const res = buy(def.id);
    if (res.ok) {
      haptics.heavy();
      sfx.confirm();
      setError(null);
      setJustBought(true);
      onDelivered?.(def);
      // Trigger the three-stage Aircraft Delivery Ritual modal
      // (Design Review v3 — point 12). The newly created aircraft's
      // uid is computed by the store action; we look up the most-recent
      // entry. The component reads it post-mount.
      setPendingDelivery({ defId: def.id, uid: null });
      window.setTimeout(() => setJustBought(false), 1800);
    } else {
      haptics.warning();
      sfx.warn();
      setError(res.message);
    }
  };

  const buttonLabel = !unlocked
    ? `Locked · Tier ${isCargo ? 5 : def.tier}`
    : !afford
      ? `Need $${formatCash(def.basePurchaseCost - cash, 1)}`
      : justBought
        ? 'Delivered ✓'
        : 'Buy + deliver';

  const buttonVariant = !unlocked
    ? 'ghost'
    : !afford
      ? 'secondary'
      : justBought
        ? 'secondary'
        : 'gold';

  return (
    <article style={card(tailColor, justBought)}>
      {/* Hero: aircraft illustration over a faint runway strip */}
      <div style={hero(tailColor)}>
        <div style={runwayLine} />
        <div style={runwayLine2} />
        <AircraftIllustration defId={def.id} tailColor={tailColor} width={280} />
        <div style={topChips}>
          <Chip color={tailColor}>{isCargo ? 'CARGO' : `TIER ${def.tier}`}</Chip>
          <Chip tone="accent">{role}</Chip>
        </div>
      </div>

      <div style={body}>
        <div style={titleRow}>
          <div style={titleCol}>
            <div style={displayName}>{def.displayName}</div>
            <div style={subtitle}>{def.capacity}{isCargo ? ' t cargo' : ' seats'} · {def.rangeKm.toLocaleString()} km range</div>
          </div>
          <div style={priceCol}>
            <div style={priceLabel}>Price</div>
            <div style={{ ...priceValue, color: afford ? COLOR.gold.base : COLOR.ink.faint }}>
              ${formatCash(def.basePurchaseCost, 1)}
            </div>
          </div>
        </div>

        {/* Why buy this? */}
        <div style={whySection}>
          <div style={whyHead}>Why buy this</div>
          <div style={whyChipsRow}>
            {reasons.map((r) => (
              <Chip key={r} tone="mute" size="sm">{r}</Chip>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div style={statsStrip}>
          <Stat label="Speed" value={`${def.cruiseSpeedKmh} km/h`} />
          <Stat label="Burn" value={`${def.fuelPerHour}/h`} />
          <Stat label="Range" value={`${def.rangeKm.toLocaleString()} km`} />
        </div>

        {/* Action */}
        <Button
          variant={buttonVariant}
          size="lg"
          fullWidth
          disabled={!unlocked || !afford}
          hapticOnPress="heavy"
          onClick={tryBuy}
          {...(isTutorialTarget ? { 'data-tutorial': 'buy-aircraft-atr42' } : {})}
        >
          {buttonLabel}
        </Button>

        {error && <div style={errorText}>{error}</div>}
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={statBox}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

/**
 * Marketing-style nickname for the role this aircraft plays.
 * Derived purely from tier + category so a data-file change can
 * override later without code edits.
 */
function roleFor(def: AircraftDef): string {
  if (def.category === 'cargo') return 'Freight Specialist';
  switch (def.tier) {
    case 1: return 'Regional Workhorse';
    case 2: return 'City Connector';
    case 3: return 'Narrow-Body Riser';
    case 4: return 'Profit Machine';
    case 5: return 'Wide-Body All-Star';
    case 6: return 'Long-Haul Hero';
    case 7: return 'Heavy Flagship';
    case 8: return 'Mega Flagship';
    default: return 'Workhorse';
  }
}

/** Three short bullet "reasons to buy" inferred from stats. */
function whyBuy(def: AircraftDef): string[] {
  const out: string[] = [];
  if (def.category === 'cargo') {
    out.push(`Carries ${def.capacity} t per leg`);
    out.push('Bypasses passenger pricing');
    out.push('Always ships full');
    return out;
  }
  if (def.rangeKm <= 2500) out.push('Best for short routes');
  else if (def.rangeKm <= 5500) out.push('Versatile medium-haul');
  else out.push('True long-haul reach');

  if (def.fuelPerHour <= 400) out.push('Low fuel burn');
  else if (def.fuelPerHour <= 1200) out.push('Efficient cruise');
  else out.push('High-yield workhorse');

  if (def.capacity >= 350) out.push('Massive cabin · premium upside');
  else if (def.capacity >= 200) out.push('Wide cabin · steady demand');
  else if (def.capacity >= 100) out.push('Right-sized for hub flights');
  else out.push('Quick turnaround');

  return out.slice(0, 3);
}

/* ─── Styles ──────────────────────────────────────────────────── */

const card = (tail: string, just: boolean): React.CSSProperties => ({
  background: `linear-gradient(170deg, ${COLOR.bg.panel}, ${COLOR.bg.canvas})`,
  border: `1px solid ${just ? COLOR.success : `${tail}33`}`,
  borderRadius: RADIUS.l,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: just
    ? `0 0 24px ${COLOR.success}55`
    : `0 10px 28px rgba(0,0,0,0.45)`,
  transition: 'box-shadow 320ms ease, border-color 320ms ease',
});

const hero = (tail: string): React.CSSProperties => ({
  position: 'relative',
  background: `radial-gradient(ellipse at center, ${tail}28, transparent 70%)`,
  paddingTop: SPACE.l,
  paddingBottom: SPACE.s,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 110,
});

const runwayLine: React.CSSProperties = {
  position: 'absolute',
  bottom: 12, left: 12, right: 12,
  height: 1,
  background: 'rgba(148,163,184,0.18)',
};
const runwayLine2: React.CSSProperties = {
  position: 'absolute',
  bottom: 16, left: 30, right: 30,
  height: 1,
  background: 'rgba(148,163,184,0.10)',
};

const topChips: React.CSSProperties = {
  position: 'absolute',
  top: SPACE.s,
  left: SPACE.s,
  display: 'flex',
  gap: 6,
};

const body: React.CSSProperties = {
  padding: SPACE.m,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACE.s,
};

const titleRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: SPACE.s,
};
const titleCol: React.CSSProperties = { minWidth: 0 };
const displayName: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: COLOR.ink.primary,
  letterSpacing: '0.01em',
};
const subtitle: React.CSSProperties = {
  fontSize: TYPE.small.size,
  color: COLOR.ink.muted,
  marginTop: 2,
};

const priceCol: React.CSSProperties = { textAlign: 'right' };
const priceLabel: React.CSSProperties = {
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.letter,
  textTransform: TYPE.label.transform,
  color: COLOR.ink.muted,
};
const priceValue: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  marginTop: 2,
  fontFeatureSettings: '"tnum" 1',
};

const whySection: React.CSSProperties = {
  background: COLOR.bg.glass,
  border: `1px solid ${COLOR.border.soft}`,
  borderRadius: RADIUS.s,
  padding: '8px 10px',
};
const whyHead: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: COLOR.ink.muted,
  marginBottom: 6,
};
const whyChipsRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
};

const statsStrip: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 6,
};
const statBox: React.CSSProperties = {
  background: 'rgba(11,17,32,0.55)',
  border: `1px solid ${COLOR.border.soft}`,
  borderRadius: RADIUS.xs,
  padding: '6px 8px',
  textAlign: 'center',
};
const statLabel: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: COLOR.ink.faint,
  fontWeight: 700,
};
const statValue: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: COLOR.ink.primary,
  marginTop: 2,
  fontFeatureSettings: '"tnum" 1',
};

const errorText: React.CSSProperties = {
  fontSize: 11,
  color: COLOR.danger,
  background: 'rgba(248,113,113,0.08)',
  border: `1px solid ${COLOR.danger}44`,
  borderRadius: RADIUS.xs,
  padding: '6px 10px',
};
