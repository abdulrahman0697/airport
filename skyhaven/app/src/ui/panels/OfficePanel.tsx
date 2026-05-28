import { useMemo, useState } from 'react';
import { ACHIEVEMENT_COUNT, frameTier, FRAME_COLORS } from '../../data/achievements';
import { FrameBadge } from '../components/AchievementFrame';
import { AirlineCrest } from '../design/AirlineCrest';
import { Button } from '../design/Button';
import { PanelHeader } from '../design/PanelHeader';
import { usePanelStore } from '../components/PanelHost';
import { ShareAirlineModal } from '../components/ShareAirlineModal';
import { AIRCRAFT_DEFS, getAircraftDef } from '../../data/aircraft';
import { CLASSIC_DEFS } from '../../data/classics';
import { getRegion, REGIONS } from '../../data/regions';
import { conditionBand } from '../../engine/condition';
import { ecoTier, ecoTierMeta } from '../../engine/eco';
import { MAX_TIER, TIER_UNLOCK_THRESHOLDS } from '../../engine/tierUnlocks';
import {
  selectAchievements,
  selectActiveEvents,
  selectAirlineName,
  selectCash,
  selectEcoRating,
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
import { cashPerSecond } from '../../engine/economy';
import { formatCash, formatRate } from '../format';

/**
 * "Office of the CEO" — player-stats panel (BRD §8.3 profile area).
 *
 * A glanceable dashboard a player would actually want to study: airline
 * identity at the top, tier progress with a real bar, cash + lifetime,
 * fleet / route / hub headcounts with breakdowns, Eco rating chip, and
 * Vintage collection progress. Themed like a manager's desk display.
 */
export function OfficePanel() {
  const airlineName = useGameStore(selectAirlineName);
  const tailColor = useGameStore(selectTailColor);
  const cash = useGameStore(selectCash);
  const lifetime = useGameStore(selectLifetime);
  const tier = useGameStore(selectTier);
  const fleet = useGameStore(selectFleet);
  const routes = useGameStore(selectRoutes);
  const hubs = useGameStore(selectHubs);
  const unlocked = useGameStore(selectUnlockedRegions);
  const ecoScore = useGameStore(selectEcoRating);
  const vintage = useGameStore(selectVintage);
  const achievements = useGameStore(selectAchievements);
  const activeEvents = useGameStore(selectActiveEvents);
  const openPanel = usePanelStore((s) => s.open);
  const [shareOpen, setShareOpen] = useState(false);

  const perMin = useMemo(() => {
    const fleetById = new Map(fleet.map((a) => [a.uid, a]));
    let total = 0;
    for (const r of routes) {
      const a = fleetById.get(r.aircraftUid);
      if (!a || !getAircraftDef(a.defId)) continue;
      total += cashPerSecond(r, a, hubs, activeEvents);
    }
    return total * 60;
  }, [fleet, routes, hubs, activeEvents]);

  const fleetSummary = useMemo(() => {
    const groups = new Map<string, number>();
    for (const a of fleet) {
      const def = getAircraftDef(a.defId);
      if (!def) continue;
      groups.set(def.displayName, (groups.get(def.displayName) ?? 0) + 1);
    }
    return [...groups.entries()].sort((a, b) => b[1] - a[1]);
  }, [fleet]);

  const conditionSummary = useMemo(() => {
    if (fleet.length === 0) return { avg: 100, needsAttention: 0 };
    let sum = 0;
    let needs = 0;
    for (const a of fleet) {
      sum += a.condition;
      if (conditionBand(a.condition) !== 'normal') needs++;
    }
    return { avg: sum / fleet.length, needsAttention: needs };
  }, [fleet]);

  const tierProgress = useMemo(() => computeTierProgress(tier, lifetime), [tier, lifetime]);
  const ecoMeta = ecoTierMeta(ecoTier(ecoScore));

  return (
    <div style={shell}>
      <PanelHeader
        kicker="Command"
        title="Office of the CEO"
        subtitle="Operational dashboard"
      />
      <div style={body}>
        {/* Airline identity card */}
        <section style={identityCard(tailColor, frameTier(achievements.length))}>
          <div style={identityRow}>
            <AirlineCrest name={airlineName} tailColor={tailColor} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={airlineLabel}>{airlineName.toUpperCase()}</div>
              <div style={airlineSubRow}>
                <span style={airlineSub}>Tier {tier} of {MAX_TIER}</span>
                <FrameBadge unlockedCount={achievements.length} />
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              accent={tailColor}
              onClick={(): void => setShareOpen(true)}
            >
              Share
            </Button>
          </div>
        </section>
        <ShareAirlineModal open={shareOpen} onClose={(): void => setShareOpen(false)} />

        {/* Strategic Decisions — replaces the friends/cloud/etc. clutter that
            used to live here. Cloud save + friends moved to Settings panel
            (Design Review v2 — point 8). */}
        <section style={card}>
          <div style={sectionHead}>Strategic Decisions</div>
          <div style={advisorList}>
            <AdvisorCard
              title="Approve new terminal"
              body="A new terminal unlocks at the next tier. Stay on the lifetime-earnings curve to lift it."
              accent="#5AC8FA"
            />
            <AdvisorCard
              title="Negotiate fuel contract"
              body="Sign higher-supply contracts in Fuel to weather price spikes without grounding routes."
              accent="#F4C75B"
            />
            <AdvisorCard
              title="Launch a premium route"
              body="Try Premium pricing on a route from a Tier-4+ hub to capture higher-yield passengers."
              accent="#34D399"
            />
          </div>
        </section>

        {/* Settings access — moved out of CEO Office */}
        <section style={card}>
          <div style={sectionHead}>Account &amp; Settings</div>
          <div style={settingsRow}>
            <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }}>
              Cloud sync, friends, sign-in and other preferences live in the
              Settings panel.
            </div>
            <Button variant="secondary" size="sm" accent={tailColor}
              onClick={(): void => openPanel('settings' as never)}>
              Open Settings →
            </Button>
          </div>
        </section>

        {/* Tier progress */}
        <section style={card}>
          <div style={sectionHead}>Tier Progress</div>
          <div style={tierTitle}>
            Tier {tier}{tier < MAX_TIER && <span style={tierFollow}> → Tier {tier + 1}</span>}
          </div>
          <div style={progressTrack}>
            <div style={{
              ...progressFill,
              width: `${tierProgress.pct * 100}%`,
              background: `linear-gradient(90deg, ${tailColor}, #F4C75B)`,
            }} />
          </div>
          <div style={progressLabels}>
            <span style={progressLabel}>
              ${formatCash(tierProgress.relativeNow)} earned
            </span>
            <span style={progressLabel}>
              {tier >= MAX_TIER
                ? 'Max tier reached'
                : `$${formatCash(Math.max(0, tierProgress.threshold - lifetime))} to T${tier + 1}`}
            </span>
          </div>
        </section>

        {/* Financials */}
        <section style={card}>
          <div style={sectionHead}>Financials</div>
          <div style={statGrid}>
            <Stat label="Cash on hand" value={`$${formatCash(cash)}`} accent="#F4C75B" />
            <Stat label="Per minute" value={formatRate(perMin / 60)} accent="#34D399" />
            <Stat label="Lifetime earned" value={`$${formatCash(lifetime)}`} accent="#5AC8FA" />
          </div>
        </section>

        {/* Operations */}
        <section style={card}>
          <div style={sectionHead}>Operations</div>
          <div style={statGrid}>
            <Stat label="Aircraft" value={String(fleet.length)} />
            <Stat label="Active routes" value={String(routes.length)} />
            <Stat label="Hubs" value={`${hubs.length}`} sub={hubs.map((h) => h.iata).join(' · ')} />
            <Stat label="Regions" value={`${unlocked.length} / ${REGIONS.length}`}
              sub={unlocked.map((r) => getRegion(r)?.name?.split(' ')[0] ?? '').filter(Boolean).join(' · ')} />
          </div>
          {fleetSummary.length > 0 && (
            <div style={breakdown}>
              <div style={breakdownLabel}>Fleet mix</div>
              <div style={breakdownRow}>
                {fleetSummary.map(([name, count]) => (
                  <span key={name} style={chip}>
                    {name} × {count}
                  </span>
                ))}
              </div>
            </div>
          )}
          {fleet.length > 0 && (
            <div style={subStat}>
              Avg condition <b>{conditionSummary.avg.toFixed(0)}%</b>
              {conditionSummary.needsAttention > 0 && (
                <span style={{ color: '#F59E0B', marginLeft: 8 }}>
                  · {conditionSummary.needsAttention} need{conditionSummary.needsAttention === 1 ? 's' : ''} attention
                </span>
              )}
            </div>
          )}
        </section>

        {/* Eco + Vintage */}
        <section style={card}>
          <div style={sectionHead}>Standing</div>
          <div style={standingRow}>
            <div style={standingLeft}>
              <div style={standingKey}>Eco Rating</div>
              <div style={{ ...standingValue, color: ecoMeta?.color ?? '#94A3B8' }}>
                {ecoMeta?.label ?? '—'}
                {ecoMeta && <span style={subBonus}> +{Math.round(ecoMeta.revenueBonus * 100)}%</span>}
              </div>
              <div style={{ ...miniBar, marginTop: 6 }}>
                <div style={{
                  ...miniBarFill,
                  width: `${Math.max(0, Math.min(100, ecoScore))}%`,
                  background: ecoMeta?.color ?? '#94A3B8',
                }} />
              </div>
              <div style={subStat}>{Math.round(ecoScore)} / 100</div>
            </div>
            <div style={standingRight}>
              <div style={standingKey}>Vintage Hangar</div>
              <div style={{ ...standingValue, color: '#F4C75B' }}>
                {vintage.length} / {CLASSIC_DEFS.length}
              </div>
              <div style={{ ...miniBar, marginTop: 6 }}>
                <div style={{
                  ...miniBarFill,
                  width: `${(vintage.length / CLASSIC_DEFS.length) * 100}%`,
                  background: '#F4C75B',
                }} />
              </div>
              <div style={subStat}>+{vintage.length}% global yield</div>
            </div>
          </div>
        </section>

        {/* Achievements */}
        <section style={card}>
          <div style={sectionHead}>Achievements</div>
          <div style={achievementsRow}>
            <div>
              <div style={achievementsCount}>
                {achievements.length} / {ACHIEVEMENT_COUNT}
              </div>
              <div style={achievementsSub}>
                {(() => {
                  const tier = frameTier(achievements.length);
                  const frame = FRAME_COLORS[tier];
                  return tier === 'none'
                    ? 'Unlock 5 to earn your first frame'
                    : `${frame.label} frame earned`;
                })()}
              </div>
            </div>
            <button
              onClick={(): void => openPanel('achievements')}
              style={viewAllBtn}
            >
              View all →
            </button>
          </div>
        </section>

        {/* Catalog progress */}
        <section style={card}>
          <div style={sectionHead}>Catalog</div>
          <div style={statGrid}>
            <Stat label="Owned types" value={`${new Set(fleet.map((a) => a.defId)).size} / ${AIRCRAFT_DEFS.length}`} />
            <Stat label="Active events" value={String(activeEvents.length)} />
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Strategic-decision advisor card (Design Review v2 — point 8).
 *
 * Replaces the cloud-sync / friend-graph clutter that used to live in
 * the CEO Office. Each card frames a strategic move the player can
 * take next. Pure copy for now — the next iteration ties them to
 * actual gameplay actions ("Approve" → opens the relevant panel).
 */
function AdvisorCard({ title, body, accent }: { title: string; body: string; accent: string }) {
  return (
    <div style={{
      background: 'rgba(11,17,32,0.55)',
      border: `1px solid ${accent}33`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 10,
      padding: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC' }}>{title}</div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div style={statBox}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color: accent ?? '#F8FAFC' }}>{value}</div>
      {sub && <div style={statSub}>{sub}</div>}
    </div>
  );
}

function computeTierProgress(tier: number, lifetime: number): { pct: number; threshold: number; relativeNow: number } {
  if (tier >= MAX_TIER) return { pct: 1, threshold: lifetime, relativeNow: lifetime };
  const cur = TIER_UNLOCK_THRESHOLDS[tier] ?? 0;
  const next = TIER_UNLOCK_THRESHOLDS[tier + 1] ?? cur * 10;
  const span = Math.max(1, next - cur);
  const pct = Math.max(0, Math.min(1, (lifetime - cur) / span));
  return { pct, threshold: next, relativeNow: Math.max(0, lifetime - cur) };
}

// ─── Styles ──────────────────────────────────────────────────────────
const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const body: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: 12,
  display: 'flex', flexDirection: 'column', gap: 10,
};
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 12, padding: '12px 14px',
  border: '1px solid rgba(255,255,255,0.06)',
};
const identityCard = (color: string, tier: import('../../data/achievements').FrameTier): React.CSSProperties => {
  const frame = FRAME_COLORS[tier];
  return {
    background: `linear-gradient(135deg, ${color}22, rgba(11,17,32,0.6))`,
    borderRadius: 14,
    padding: '14px 16px',
    // Frame thickness + colour scales with achievement tier.
    border: tier === 'none'
      ? `1px solid ${color}55`
      : `2px solid ${frame.primary}`,
    boxShadow: tier === 'none'
      ? `0 0 24px ${color}33 inset`
      : `0 0 24px ${color}33 inset, 0 0 18px ${frame.primary}55`,
  };
};
const identityRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12 };
const airlineLabel: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: '#F8FAFC', letterSpacing: '0.14em',
};
const airlineSubRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
};
const airlineSub: React.CSSProperties = { fontSize: 11, color: '#94A3B8' };
const achievementsRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
};
const achievementsCount: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: '#F8FAFC',
  fontFeatureSettings: '"tnum" 1',
};
const achievementsSub: React.CSSProperties = {
  fontSize: 11, color: '#94A3B8', marginTop: 2,
};
const viewAllBtn: React.CSSProperties = {
  background: 'transparent', color: '#5AC8FA',
  border: '1px solid rgba(90,200,250,0.4)',
  borderRadius: 8, padding: '8px 14px', minHeight: 36,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
};
const sectionHead: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: '#94A3B8', fontWeight: 700, marginBottom: 8,
};
const tierTitle: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: '#F8FAFC', marginBottom: 8,
};
const tierFollow: React.CSSProperties = { color: '#94A3B8', fontWeight: 500 };
const progressTrack: React.CSSProperties = {
  height: 10, background: 'rgba(255,255,255,0.06)',
  borderRadius: 5, overflow: 'hidden',
};
const progressFill: React.CSSProperties = {
  height: '100%',
  transition: 'width 300ms ease',
};
const progressLabels: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  marginTop: 6, fontSize: 11, color: '#94A3B8',
  fontFeatureSettings: '"tnum" 1',
};
const progressLabel: React.CSSProperties = {};
const statGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10,
};
const statBox: React.CSSProperties = {
  background: 'rgba(11,17,32,0.55)', borderRadius: 8,
  padding: '10px 12px',
};
const statLabel: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8',
};
const statValue: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, marginTop: 2,
  fontFeatureSettings: '"tnum" 1',
};
const statSub: React.CSSProperties = { fontSize: 10, color: '#94A3B8', marginTop: 2 };
const subStat: React.CSSProperties = { marginTop: 8, color: '#94A3B8', fontSize: 11 };
const breakdown: React.CSSProperties = { marginTop: 10 };
const breakdownLabel: React.CSSProperties = {
  fontSize: 10, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase',
};
const breakdownRow: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4,
};
const chip: React.CSSProperties = {
  fontSize: 11, color: '#F8FAFC',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  padding: '3px 8px', borderRadius: 4,
};
const standingRow: React.CSSProperties = { display: 'flex', gap: 12 };
const standingLeft: React.CSSProperties = { flex: 1 };
const advisorList: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
const settingsRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
};
const standingRight: React.CSSProperties = { flex: 1 };
const standingKey: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8',
};
const standingValue: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, marginTop: 2,
};
const subBonus: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, marginLeft: 6,
};
const miniBar: React.CSSProperties = {
  height: 4, background: 'rgba(255,255,255,0.06)',
  borderRadius: 2, overflow: 'hidden',
};
const miniBarFill: React.CSSProperties = { height: '100%' };
