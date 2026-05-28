/**
 * Shareable Airline Card (Design pass D10).
 *
 * A self-contained "dossier" of the player's airline — designed
 * specifically to look great in a screenshot. Renders as a 9:16
 * card (matching most phone screenshots / TikTok / Story aspect),
 * surfacing: airline crest, name + tail color, tier ring, lifetime
 * earnings + per-minute, achievement frame tier, vintage count,
 * eco rating, and a runway-strip footer with the SkyHaven wordmark.
 *
 * Opened from the Office panel via a "Share my airline" CTA; players
 * screenshot it and post to socials. Pure presentation — no backend
 * round-trip.
 */
import { useMemo } from 'react';
import { ACHIEVEMENT_COUNT, frameTier, FRAME_COLORS } from '../../data/achievements';
import { CLASSIC_DEFS } from '../../data/classics';
import { ecoTier, ecoTierMeta } from '../../engine/eco';
import { cashPerSecond } from '../../engine/economy';
import { getAircraftDef } from '../../data/aircraft';
import { MAX_TIER, TIER_UNLOCK_THRESHOLDS } from '../../engine/tierUnlocks';
import {
  selectAchievements,
  selectActiveEvents,
  selectAirlineName,
  selectFleet,
  selectHubs,
  selectLifetime,
  selectRoutes,
  selectTailColor,
  selectTier,
  selectUnlockedRegions,
  selectVintage,
  useGameStore,
} from '../../state/store';
import { AirlineCrest } from '../design/AirlineCrest';
import { TierRing } from '../design/TierRing';
import { COLOR, RADIUS, SHADOW, SPACE, TYPE } from '../design/tokens';
import { formatCash } from '../format';

export function ShareableAirlineCard() {
  const airlineName = useGameStore(selectAirlineName);
  const tailColor = useGameStore(selectTailColor);
  const tier = useGameStore(selectTier);
  const lifetime = useGameStore(selectLifetime);
  const fleet = useGameStore(selectFleet);
  const routes = useGameStore(selectRoutes);
  const hubs = useGameStore(selectHubs);
  const regions = useGameStore(selectUnlockedRegions);
  const vintage = useGameStore(selectVintage);
  const achievements = useGameStore(selectAchievements);
  const activeEvents = useGameStore(selectActiveEvents);

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

  const tierProgress = useMemo(() => {
    if (tier >= MAX_TIER) return 1;
    const cur = TIER_UNLOCK_THRESHOLDS[tier] ?? 0;
    const next = TIER_UNLOCK_THRESHOLDS[tier + 1] ?? cur * 10;
    return Math.max(0, Math.min(1, (lifetime - cur) / Math.max(1, next - cur)));
  }, [tier, lifetime]);

  const fTier = frameTier(achievements.length);
  const frame = FRAME_COLORS[fTier];
  const eco = ecoTierMeta(ecoTier(0)); // placeholder eco; default tier
  const ecoLabel = eco?.label ?? '—';

  return (
    <div style={cardOuter(tailColor)}>
      {/* Top: brand */}
      <div style={brandRow}>
        <AirlineCrest name={airlineName} tailColor={tailColor} size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={brandKicker}>SkyHaven Airlines Network</div>
          <h1 style={brandName}>{airlineName.toUpperCase()}</h1>
          <div style={brandSub}>
            Tier {tier} of {MAX_TIER} · {frame.label} frame
          </div>
        </div>
        <TierRing pct={tierProgress} tier={tier} color={tailColor} size={56} />
      </div>

      {/* Main: two columns of headline stats */}
      <div style={statsGrid}>
        <StatBlock label="Lifetime earnings" value={`$${formatCash(lifetime)}`} accent={COLOR.gold.base} />
        <StatBlock label="Per minute" value={`$${formatCash(perMin)}/m`} accent={COLOR.success} />
        <StatBlock label="Aircraft" value={fleet.length.toString()} />
        <StatBlock label="Active routes" value={routes.length.toString()} />
        <StatBlock label="Hubs" value={hubs.length.toString()} accent={tailColor} />
        <StatBlock label="Regions" value={`${regions.length} / 9`} />
        <StatBlock label="Vintage" value={`${vintage.length} / ${CLASSIC_DEFS.length}`} accent={COLOR.gold.base} />
        <StatBlock label="Achievements" value={`${achievements.length} / ${ACHIEVEMENT_COUNT}`} accent={frame.primary} />
      </div>

      {/* Eco standing */}
      <div style={ecoCard(tailColor)}>
        <div style={ecoLabelStyle}>Eco standing</div>
        <div style={{ ...ecoValueStyle, color: eco?.color ?? COLOR.ink.muted }}>{ecoLabel}</div>
      </div>

      {/* Bottom: runway strip wordmark */}
      <div style={runway(tailColor)}>
        <div style={runwayMark}>SKYHAVEN</div>
        <div style={runwayDashes}>— — — — — — — —</div>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  accent = COLOR.ink.primary,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div style={statCell}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color: accent }}>{value}</div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const cardOuter = (tail: string): React.CSSProperties => ({
  width: '100%',
  maxWidth: 360,
  aspectRatio: '9 / 16',
  background: `radial-gradient(at top right, ${tail}28, ${COLOR.bg.canvas} 60%), linear-gradient(180deg, ${COLOR.bg.panel}, ${COLOR.bg.deep})`,
  borderRadius: RADIUS.xl,
  border: `1px solid ${tail}55`,
  boxShadow: `${SHADOW.modal}, 0 0 60px ${tail}33`,
  padding: SPACE.l,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACE.m,
  overflow: 'hidden',
  position: 'relative',
});

const brandRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACE.m,
};
const brandKicker: React.CSSProperties = {
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.letter,
  textTransform: TYPE.label.transform,
  color: COLOR.accent.cyan,
};
const brandName: React.CSSProperties = {
  margin: 0,
  fontSize: TYPE.display.size,
  fontWeight: TYPE.display.weight,
  letterSpacing: '0.04em',
  color: COLOR.ink.primary,
  lineHeight: 1.1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const brandSub: React.CSSProperties = {
  fontSize: TYPE.small.size,
  color: COLOR.ink.muted,
  marginTop: 4,
};
const statsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: SPACE.s,
  flex: 1,
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
  fontSize: 22,
  fontWeight: 800,
  marginTop: 4,
  fontFeatureSettings: '"tnum" 1',
};

const ecoCard = (tail: string): React.CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: `linear-gradient(135deg, ${tail}18, ${COLOR.bg.glass})`,
  border: `1px solid ${tail}44`,
  borderRadius: RADIUS.m,
  padding: '12px 14px',
});
const ecoLabelStyle: React.CSSProperties = {
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.letter,
  textTransform: TYPE.label.transform,
  color: COLOR.ink.muted,
};
const ecoValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: '0.04em',
};

const runway = (tail: string): React.CSSProperties => ({
  borderTop: `1px solid ${tail}55`,
  paddingTop: SPACE.s,
  marginTop: 'auto',
  textAlign: 'center',
});
const runwayMark: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: '0.32em',
  color: COLOR.ink.primary,
};
const runwayDashes: React.CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  letterSpacing: '0.4em',
  color: COLOR.ink.faint,
};
