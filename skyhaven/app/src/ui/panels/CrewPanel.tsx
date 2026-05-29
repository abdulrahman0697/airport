/**
 * CrewPanel — hub-staff hexagon layout (player redesign).
 *
 * One large card per hub. The hub IATA + level + headcount sit in
 * the centre; the six managers fan out around it (three above + three
 * below) as photo-tile slots. Each slot shows the role, the headline
 * bonus, a portrait, the candidate's name, and the current status
 * (HIRED in green / OPEN in gold). Tapping an OPEN slot fires the
 * normal hireManager action.
 *
 * Below the hexagon a hub-bonus summary lists the active effects
 * (Fuel savings, Reliability, Pricing boost, Boarding speed, Load
 * factor, Crisis mitigation) and totals them into the headline
 * performance boost the hub gets.
 *
 * Portraits + candidate names re-roll on every panel mount via a
 * deterministic per-mount seed — the player sees a fresh roster each
 * visit, but the slots stay stable while they're looking. Portraits
 * come from randomuser.me's CDN; if the network fails the avatar
 * falls back to an initials disc so the layout still reads.
 */
import { useMemo, useState } from 'react';
import { MANAGER_DEFS, managerCost, type ManagerKind } from '../../data/managers';
import { planBulkUpgrade } from '../../engine/actions';
import {
  LOGISTICS_DIRECTOR_FUEL_MULT,
  MARKETING_LEAD_LOAD_BONUS,
  CRISIS_MANAGER_MITIGATION,
} from '../../engine/managers';
import type { Hub } from '../../engine/types';
import { loadTopAirports } from '../../data/airports';
import { selectCash, selectHubs, useGameStore } from '../../state/store';
import { EmptyState } from '../design/EmptyState';
import { PanelHeader } from '../design/PanelHeader';
import { COLOR } from '../design/tokens';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

export function CrewPanel() {
  const hubs = useGameStore(selectHubs);

  return (
    <div style={shell}>
      <PanelHeader
        kicker="Personnel"
        title="Crew"
        subtitle="Each manager is hub-scoped. Hire to apply the bonus to that hub's routes only."
      />
      <div style={body}>
        {hubs.length === 0 ? (
          <EmptyState
            icon="◇"
            title="No hubs to staff"
            body="Promote an airport to a hub from the Network panel, then return here to hire managers."
          />
        ) : (
          <ul style={list}>
            {hubs.map((h) => <HubCard key={h.iata} hub={h} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── Hub card ────────────────────────────────────────────────────── */

function HubCard({ hub }: { hub: Hub }) {
  const cash = useGameStore(selectCash);
  const hire = useGameStore((s) => s.hireManager);
  const [error, setError] = useState<string | null>(null);

  // Fresh candidate roster every mount (player request: "random each
  // time"). Seed combines the mount timestamp with the hub IATA so
  // each hub gets distinct portraits but a single panel-open is
  // deterministic across re-renders.
  const seed = useMemo(() => (hub.iata.charCodeAt(0) * 31 + Date.now()) >>> 0, [hub.iata]);
  const roster = useMemo(() => rollRoster(seed), [seed]);

  const hubCity = useMemo(() => {
    const ap = loadTopAirports().find((a) => a.iata === hub.iata);
    return ap?.city || hub.iata;
  }, [hub.iata]);

  const hiredCount = Object.values(hub.managers).filter(Boolean).length;
  const totalBoost = computeTotalBoostPercent(hub);

  const top = MANAGER_DEFS.slice(0, 3);
  const bottom = MANAGER_DEFS.slice(3, 6);

  const tryHire = (kind: ManagerKind, cost: number): void => {
    if (cash < cost) {
      haptics.warning();
      setError(`Need $${formatCash(cost)} to hire`);
      return;
    }
    const res = hire(hub.iata, kind);
    if (res.ok) {
      haptics.success();
      sfx.play('manager_hire');
      setError(null);
    } else {
      haptics.warning();
      setError(res.message);
    }
  };

  return (
    <li style={card}>
      <div style={hexRow}>
        {top.map((m) => (
          <ManagerSlot
            key={m.kind}
            hired={hub.managers[m.kind]}
            cost={managerCost(m.kind, hub.level)}
            title={ROLE_TITLE[m.kind]}
            bonus={ROLE_HEADLINE[m.kind]}
            candidate={roster[m.kind]}
            onHire={(): void => tryHire(m.kind, managerCost(m.kind, hub.level))}
          />
        ))}
      </div>

      <div style={hexCenter}>
        <HubBadge iata={hub.iata} city={hubCity} level={hub.level} hired={hiredCount} />
      </div>

      <div style={hexRow}>
        {bottom.map((m) => (
          <ManagerSlot
            key={m.kind}
            hired={hub.managers[m.kind]}
            cost={managerCost(m.kind, hub.level)}
            title={ROLE_TITLE[m.kind]}
            bonus={ROLE_HEADLINE[m.kind]}
            candidate={roster[m.kind]}
            onHire={(): void => tryHire(m.kind, managerCost(m.kind, hub.level))}
          />
        ))}
      </div>

      <HubBonusSummary hub={hub} totalBoostPct={totalBoost} />

      <AutoUpgradeRow hub={hub} />

      {error && <div style={errorText}>{error}</div>}
    </li>
  );
}

/* ─── Fleet Engineer auto-upgrade CTA + modal ────────────────────── */

function AutoUpgradeRow({ hub }: { hub: Hub }) {
  const [open, setOpen] = useState(false);
  const fleetEngineerHired = hub.managers.fleetEngineer;
  return (
    <>
      <button
        onClick={(): void => {
          if (!fleetEngineerHired) {
            haptics.warning();
            return;
          }
          haptics.medium();
          sfx.confirm();
          setOpen(true);
        }}
        disabled={!fleetEngineerHired}
        style={{
          ...autoUpgradeBtn,
          opacity: fleetEngineerHired ? 1 : 0.55,
          cursor: fleetEngineerHired ? 'pointer' : 'default',
          borderColor: fleetEngineerHired ? `${COLOR.success}55` : 'rgba(255,255,255,0.10)',
        }}
      >
        <span style={autoUpgradeIcon}>{fleetEngineerHired ? '⚙' : '🔒'}</span>
        <span style={autoUpgradeLabel}>
          {fleetEngineerHired ? 'Auto-upgrade hub fleet' : 'Auto-upgrade · locked'}
        </span>
        <span style={autoUpgradeSub}>
          {fleetEngineerHired
            ? 'Spend a budget on the cheapest available upgrades'
            : 'Hire the Fleet Engineer to unlock'}
        </span>
      </button>
      {open && <AutoUpgradeModal hub={hub} onClose={(): void => setOpen(false)} />}
    </>
  );
}

function AutoUpgradeModal({ hub, onClose }: { hub: Hub; onClose: () => void }) {
  const cash = useGameStore(selectCash);
  const state = useGameStore((s) => s.state);
  const bulkUpgrade = useGameStore((s) => s.bulkUpgradeHubFleet);
  // Default budget: 10% of cash, rounded to nearest $1K. Reasonable
  // first nudge; the player tweaks the slider.
  const defaultBudget = Math.min(cash, Math.round(cash * 0.10 / 1000) * 1000);
  const [budget, setBudget] = useState<number>(defaultBudget);
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);

  const plan = useMemo(() => {
    if (!state) return null;
    return planBulkUpgrade(state, hub.iata, budget);
  }, [state, hub.iata, budget]);

  // Rough revenue uplift forecast: aggregate effective revenue
  // multipliers across the hub's fleet before vs after the plan.
  const upliftPct = useMemo(() => {
    if (!state || !plan) return 0;
    const hubFleet = state.fleet.filter((a) => a.homeHubIata === hub.iata);
    if (hubFleet.length === 0) return 0;
    const levelsByUid = new Map<string, { engine: number; cabin: number; fuelEff: number; marketing: number }>();
    for (const a of hubFleet) levelsByUid.set(a.uid, { ...a.upgrades });
    for (const s of plan.steps) levelsByUid.get(s.aircraftUid)![s.kind]++;
    let beforeMult = 0, afterMult = 0;
    for (const a of hubFleet) {
      const before = a.upgrades;
      const after = levelsByUid.get(a.uid)!;
      // Per-aircraft revenue/sec scales with capacity (cabin),
      // legs-per-second (engine speed), and load factor (marketing).
      // Fuel-eff doesn't directly scale revenue but reduces burn so
      // we keep it in the per-kind breakdown only.
      beforeMult += (1 + 0.10 * before.engine) * (1 + 0.10 * before.cabin) * (1 + 0.06 * before.marketing);
      afterMult  += (1 + 0.10 * after.engine)  * (1 + 0.10 * after.cabin)  * (1 + 0.06 * after.marketing);
    }
    if (beforeMult <= 0) return 0;
    return Math.round(((afterMult - beforeMult) / beforeMult) * 100);
  }, [state, plan, hub.iata]);

  const confirm = (): void => {
    if (!plan || plan.steps.length === 0) {
      setError('Budget is too small to buy any upgrade.');
      return;
    }
    const res = bulkUpgrade(hub.iata, plan.totalCost);
    if (res.ok) {
      haptics.success();
      sfx.play('upgrade_complete');
      setCommitted(true);
      window.setTimeout(onClose, 700);
    } else {
      haptics.warning();
      setError(res.message);
    }
  };

  // Budget slider in increments of $1K, capped at min(cash, $5M) for
  // sanity — players above that need to bump multiple times anyway.
  const maxBudget = Math.min(cash, 5_000_000);

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalShell} onClick={(e): void => e.stopPropagation()}>
        <div style={modalKicker}>FLEET ENGINEER · AUTO-UPGRADE</div>
        <h3 style={modalTitle}>{hub.iata} hub fleet</h3>
        <p style={modalBody}>
          Spend up to the budget below. The Fleet Engineer installs
          the cheapest available upgrades across this hub's aircraft
          until either every plane is maxed or the budget runs out.
        </p>

        <label style={modalFieldLabel}>Budget</label>
        <input
          type="range"
          min={0}
          max={maxBudget}
          step={1000}
          value={budget}
          onChange={(e): void => setBudget(Number(e.target.value))}
          style={modalSlider}
        />
        <div style={modalBudgetRow}>
          <span>$0</span>
          <span style={modalBudgetValue}>${formatCash(budget, 1)}</span>
          <span>${formatCash(maxBudget, 1)}</span>
        </div>

        <div style={previewBox}>
          <div style={previewKicker}>Preview</div>
          {!plan || plan.steps.length === 0 ? (
            <div style={previewEmpty}>
              Budget too small or every aircraft at {hub.iata} is maxed.
            </div>
          ) : (
            <>
              <div style={previewGrid}>
                <PreviewCell label="Engine" count={plan.perKind.engine} tint={COLOR.accent.cyan} />
                <PreviewCell label="Cabin" count={plan.perKind.cabin} tint={COLOR.gold.base} />
                <PreviewCell label="Fuel Eff" count={plan.perKind.fuelEff} tint={COLOR.success} />
                <PreviewCell label="Marketing" count={plan.perKind.marketing} tint={COLOR.accent.cyan} />
              </div>
              <div style={previewRow}>
                <span>Total upgrades</span>
                <span style={{ fontWeight: 800 }}>{plan.steps.length}</span>
              </div>
              <div style={previewRow}>
                <span>Will cost</span>
                <span style={{ fontWeight: 800, color: COLOR.gold.base }}>${formatCash(plan.totalCost, 1)}</span>
              </div>
              <div style={previewRow}>
                <span>Est. revenue uplift</span>
                <span style={{ fontWeight: 800, color: COLOR.success }}>+{upliftPct}%</span>
              </div>
            </>
          )}
        </div>

        {error && <div style={errorText}>{error}</div>}
        {committed && <div style={committedText}>Upgrades installed ✓</div>}

        <div style={modalActions}>
          <button onClick={onClose} style={modalCancel}>Cancel</button>
          <button
            onClick={confirm}
            disabled={!plan || plan.steps.length === 0 || committed}
            style={{
              ...modalConfirm,
              opacity: (!plan || plan.steps.length === 0 || committed) ? 0.5 : 1,
            }}
          >
            Auto-Upgrade ✓
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewCell({ label, count, tint }: { label: string; count: number; tint: string }) {
  return (
    <div style={previewCell}>
      <div style={previewCellLabel}>{label}</div>
      <div style={{ ...previewCellValue, color: count > 0 ? tint : COLOR.ink.faint }}>
        +{count}
      </div>
    </div>
  );
}

/* ─── Hub center badge ────────────────────────────────────────────── */

function HubBadge({
  iata, city, level, hired,
}: {
  iata: string; city: string; level: number; hired: number;
}) {
  return (
    <div style={badge}>
      <div style={badgeIata}>{iata}</div>
      <div style={badgeCity}>{city}</div>
      <div style={badgeMeta}>Lv {level} hub</div>
      <div style={badgeHired}>
        <span style={{ color: hired === 6 ? COLOR.success : COLOR.gold.base, fontWeight: 900 }}>
          {hired}
        </span>
        <span style={{ color: COLOR.ink.muted }}> / 6 hired</span>
      </div>
    </div>
  );
}

/* ─── Manager slot ────────────────────────────────────────────────── */

interface Candidate {
  name: string;
  avatarUrl: string;
  initials: string;
  hue: number;
}

function ManagerSlot({
  hired, cost, title, bonus, candidate, onHire,
}: {
  hired: boolean;
  cost: number;
  title: string;
  bonus: { label: string; tint: string };
  candidate: Candidate;
  onHire: () => void;
}) {
  return (
    <button
      onClick={hired ? undefined : onHire}
      disabled={hired}
      style={{ ...slot, ...(hired ? slotHired : {}) }}
    >
      <div style={slotTitle}>{title}</div>
      <div style={{ ...slotBonus, color: bonus.tint }}>{bonus.label}</div>
      <Avatar candidate={candidate} hired={hired} />
      <div style={slotName}>{candidate.name}</div>
      <div style={{
        ...slotStatus,
        color: hired ? COLOR.success : COLOR.gold.base,
        background: hired ? 'rgba(52,211,153,0.12)' : 'rgba(244,199,91,0.12)',
        borderColor: hired ? `${COLOR.success}55` : `${COLOR.gold.base}55`,
      }}>
        {hired ? 'HIRED' : `$${formatCash(cost, 1)}`}
      </div>
    </button>
  );
}

function Avatar({ candidate, hired }: { candidate: Candidate; hired: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{
      ...avatarWrap,
      borderColor: hired ? COLOR.success : `${COLOR.accent.cyan}66`,
      boxShadow: hired ? `0 0 14px ${COLOR.success}55` : '0 4px 12px rgba(0,0,0,0.5)',
    }}>
      {!failed ? (
        <img
          src={candidate.avatarUrl}
          alt=""
          style={avatarImg}
          onError={(): void => setFailed(true)}
          draggable={false}
        />
      ) : (
        <div style={{
          ...avatarInitials,
          background: `linear-gradient(150deg, hsl(${candidate.hue} 60% 35%), hsl(${candidate.hue} 50% 22%))`,
        }}>
          {candidate.initials}
        </div>
      )}
    </div>
  );
}

/* ─── Hub bonus summary ──────────────────────────────────────────── */

function HubBonusSummary({ hub, totalBoostPct }: { hub: Hub; totalBoostPct: number }) {
  const rows: { label: string; value: string; tint: string }[] = [];
  if (hub.managers.logisticsDirector) {
    const pct = Math.round((1 - LOGISTICS_DIRECTOR_FUEL_MULT) * 100);
    rows.push({ label: 'Fuel savings', value: `−${pct}%`, tint: COLOR.accent.cyan });
  }
  if (hub.managers.maintenanceChief) {
    rows.push({ label: 'Auto-repair', value: 'Active', tint: COLOR.success });
  }
  if (hub.managers.hubDirector) {
    rows.push({ label: 'Pricing optimisation', value: 'Active', tint: COLOR.gold.base });
  }
  if (hub.managers.marketingLead) {
    const pct = Math.round(MARKETING_LEAD_LOAD_BONUS * 100);
    rows.push({ label: 'Load factor', value: `+${pct}%`, tint: COLOR.accent.cyan });
  }
  if (hub.managers.fleetEngineer) {
    rows.push({ label: 'Auto-upgrades', value: 'Active', tint: COLOR.success });
  }
  if (hub.managers.crisisManager) {
    const pct = Math.round(CRISIS_MANAGER_MITIGATION * 100);
    rows.push({ label: 'Crisis mitigation', value: `−${pct}%`, tint: COLOR.gold.base });
  }

  return (
    <div style={summary}>
      <div style={summaryKicker}>Hub bonus summary</div>
      {rows.length === 0 ? (
        <div style={summaryEmpty}>No managers hired — hire above to stack bonuses.</div>
      ) : (
        <div style={summaryGrid}>
          {rows.map((r) => (
            <div key={r.label} style={summaryRow}>
              <span style={summaryLabel}>{r.label}</span>
              <span style={{ ...summaryValue, color: r.tint }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{
        ...summaryTotal,
        color: totalBoostPct > 0 ? COLOR.gold.base : COLOR.ink.muted,
      }}>
        Total hub boost
        <span style={{ marginLeft: 8, fontWeight: 900 }}>
          {totalBoostPct > 0 ? `+${totalBoostPct}%` : '—'}
        </span>
      </div>
    </div>
  );
}

/* ─── Per-mount roster generator ─────────────────────────────────── */

const MALE_FIRST = ['Daniel', 'Lucas', 'Marco', 'Aiden', 'Ethan', 'Leo', 'Hiroshi', 'Sven', 'Pablo', 'Kenji', 'Omar', 'Diego', 'James', 'Carlos', 'Mateo', 'Liam', 'Idris', 'Noah'];
const FEMALE_FIRST = ['Aisha', 'Mia', 'Yuki', 'Sofia', 'Ava', 'Elena', 'Priya', 'Nora', 'Layla', 'Camila', 'Zara', 'Maya', 'Hana', 'Sara', 'Amelia', 'Olivia', 'Fatima', 'Naomi'];
const LAST = ['Kim', 'Moretti', 'Chen', 'Rahman', 'Garcia', 'Müller', 'Tanaka', 'Patel', 'Okafor', 'Petrov', 'Silva', 'Yamamoto', 'Park', 'Almeida', 'Nakamura', 'Hassan', 'Reyes'];

function rollRoster(seed: number): Record<ManagerKind, Candidate> {
  let s = seed;
  const rand = (): number => {
    // xorshift32 — small, deterministic.
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
  const out = {} as Record<ManagerKind, Candidate>;
  for (const m of MANAGER_DEFS) {
    const female = rand() < 0.5;
    const gender = female ? 'women' : 'men';
    const portraitIdx = Math.floor(rand() * 100);
    const first = female
      ? FEMALE_FIRST[Math.floor(rand() * FEMALE_FIRST.length)]!
      : MALE_FIRST[Math.floor(rand() * MALE_FIRST.length)]!;
    const last = LAST[Math.floor(rand() * LAST.length)]!;
    const hue = Math.floor(rand() * 360);
    out[m.kind] = {
      name: `${first} ${last}`,
      avatarUrl: `https://randomuser.me/api/portraits/${gender}/${portraitIdx}.jpg`,
      initials: `${first[0]}${last[0]}`.toUpperCase(),
      hue,
    };
  }
  return out;
}

/* ─── Role display copy ───────────────────────────────────────────── */

const ROLE_TITLE: Record<ManagerKind, string> = {
  hubDirector: 'Hub Director',
  maintenanceChief: 'Maintenance Chief',
  logisticsDirector: 'Logistics Director',
  fleetEngineer: 'Fleet Engineer',
  marketingLead: 'Marketing Lead',
  crisisManager: 'Crisis Manager',
};

const ROLE_HEADLINE: Record<ManagerKind, { label: string; tint: string }> = {
  hubDirector:       { label: 'Auto-Pricing',  tint: COLOR.gold.base },
  maintenanceChief:  { label: 'Auto-Repair',   tint: COLOR.success },
  logisticsDirector: { label: '−25% Fuel',     tint: COLOR.accent.cyan },
  fleetEngineer:     { label: 'Auto-Upgrade',  tint: COLOR.success },
  marketingLead:     { label: '+5% Load',      tint: COLOR.accent.cyan },
  crisisManager:     { label: '−50% Crisis',   tint: COLOR.gold.base },
};

function computeTotalBoostPercent(hub: Hub): number {
  let total = 0;
  if (hub.managers.logisticsDirector) total += Math.round((1 - LOGISTICS_DIRECTOR_FUEL_MULT) * 100);
  if (hub.managers.marketingLead) total += Math.round(MARKETING_LEAD_LOAD_BONUS * 100);
  if (hub.managers.crisisManager) total += Math.round(CRISIS_MANAGER_MITIGATION * 100);
  // The autopilot managers contribute "Active" boosts; we score them
  // at a flat +10 so the headline number reflects all six hires.
  if (hub.managers.hubDirector) total += 10;
  if (hub.managers.maintenanceChief) total += 10;
  if (hub.managers.fleetEngineer) total += 10;
  return total;
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const body: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: 12 };
const list: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 };

const card: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(15,23,47,0.85), rgba(11,17,32,0.95))',
  border: '1px solid rgba(90,200,250,0.18)',
  borderRadius: 16,
  padding: '14px 12px 12px',
  boxShadow: '0 10px 28px rgba(0,0,0,0.55), 0 0 28px rgba(90,200,250,0.10)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const hexRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
};

const hexCenter: React.CSSProperties = {
  display: 'grid', placeItems: 'center',
  margin: '4px 0',
};

/* Hub centre badge. */
const badge: React.CSSProperties = {
  width: 130,
  padding: '12px 10px',
  borderRadius: 14,
  background: 'radial-gradient(circle at center, rgba(90,200,250,0.18), rgba(11,17,32,0.85))',
  border: '1px solid rgba(90,200,250,0.5)',
  boxShadow: '0 0 22px rgba(90,200,250,0.25)',
  textAlign: 'center',
};
const badgeIata: React.CSSProperties = {
  fontSize: 22, fontWeight: 900, letterSpacing: '0.16em',
  color: COLOR.ink.primary, fontFamily: '"Courier New", monospace',
  lineHeight: 1.0,
};
const badgeCity: React.CSSProperties = {
  fontSize: 10, color: COLOR.accent.cyan, letterSpacing: '0.06em',
  marginTop: 3,
};
const badgeMeta: React.CSSProperties = {
  marginTop: 8, fontSize: 9, letterSpacing: '0.18em',
  color: COLOR.ink.muted, fontWeight: 800,
};
const badgeHired: React.CSSProperties = {
  marginTop: 2, fontSize: 11, fontFeatureSettings: '"tnum" 1',
};

/* Manager slot. */
const slot: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(15,23,47,0.7), rgba(11,17,32,0.92))',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '8px 4px 6px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: COLOR.ink.primary,
  minHeight: 130,
};
const slotHired: React.CSSProperties = {
  borderColor: `${COLOR.success}55`,
  background: `linear-gradient(180deg, rgba(52,211,153,0.10), rgba(11,17,32,0.92))`,
  cursor: 'default',
};
const slotTitle: React.CSSProperties = {
  fontSize: 8, letterSpacing: '0.12em',
  fontWeight: 800, color: COLOR.ink.muted,
  textTransform: 'uppercase',
  textAlign: 'center',
  lineHeight: 1.1,
};
const slotBonus: React.CSSProperties = {
  fontSize: 10, fontWeight: 900,
  letterSpacing: '0.05em',
};
const avatarWrap: React.CSSProperties = {
  width: 44, height: 44,
  borderRadius: 999,
  border: '2px solid',
  overflow: 'hidden',
  marginTop: 2,
  background: '#0B1120',
};
const avatarImg: React.CSSProperties = {
  width: '100%', height: '100%',
  objectFit: 'cover', display: 'block',
};
const avatarInitials: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'grid', placeItems: 'center',
  color: COLOR.ink.primary,
  fontSize: 16, fontWeight: 900,
  letterSpacing: '0.04em',
};
const slotName: React.CSSProperties = {
  fontSize: 10, fontWeight: 700,
  color: COLOR.ink.primary, lineHeight: 1.15,
  textAlign: 'center',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const slotStatus: React.CSSProperties = {
  marginTop: 2,
  fontSize: 9, fontWeight: 900, letterSpacing: '0.1em',
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid',
  fontFeatureSettings: '"tnum" 1',
};

/* Hub bonus summary. */
const summary: React.CSSProperties = {
  marginTop: 8,
  padding: '10px 12px',
  background: 'rgba(11,17,32,0.55)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};
const summaryKicker: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.22em',
  fontWeight: 800, color: COLOR.accent.cyan,
  textTransform: 'uppercase',
};
const summaryEmpty: React.CSSProperties = {
  fontSize: 11, color: COLOR.ink.muted,
};
const summaryGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '4px 12px',
};
const summaryRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  fontSize: 11,
};
const summaryLabel: React.CSSProperties = {
  color: COLOR.ink.muted,
};
const summaryValue: React.CSSProperties = {
  fontWeight: 800,
  fontFeatureSettings: '"tnum" 1',
};
const summaryTotal: React.CSSProperties = {
  marginTop: 4,
  paddingTop: 6,
  borderTop: '1px solid rgba(255,255,255,0.08)',
  fontSize: 11,
  letterSpacing: '0.08em',
  fontWeight: 800,
  textTransform: 'uppercase',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
};

const errorText: React.CSSProperties = {
  marginTop: 4, padding: '6px 10px', fontSize: 11, color: COLOR.danger,
  background: COLOR.dangerDim, borderRadius: 6,
};
const committedText: React.CSSProperties = {
  marginTop: 4, padding: '6px 10px', fontSize: 12, color: COLOR.success,
  background: 'rgba(52,211,153,0.10)', borderRadius: 6, fontWeight: 800,
  letterSpacing: '0.06em', textAlign: 'center',
};

/* Auto-upgrade CTA. */
const autoUpgradeBtn: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gridTemplateRows: 'auto auto',
  gridTemplateAreas: '"icon label" "icon sub"',
  rowGap: 1,
  columnGap: 10,
  alignItems: 'center',
  padding: '10px 12px',
  background: 'linear-gradient(160deg, rgba(15,23,47,0.85), rgba(11,17,32,0.95))',
  border: '1px solid',
  borderRadius: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: COLOR.ink.primary,
  textAlign: 'left',
};
const autoUpgradeIcon: React.CSSProperties = {
  gridArea: 'icon',
  width: 36, height: 36,
  borderRadius: 10,
  display: 'grid', placeItems: 'center',
  background: 'rgba(52,211,153,0.10)',
  border: `1px solid ${COLOR.success}40`,
  fontSize: 18,
};
const autoUpgradeLabel: React.CSSProperties = {
  gridArea: 'label',
  fontSize: 13, fontWeight: 900, letterSpacing: '0.03em',
  color: COLOR.ink.primary,
};
const autoUpgradeSub: React.CSSProperties = {
  gridArea: 'sub',
  fontSize: 10, color: COLOR.ink.muted,
  letterSpacing: '0.02em',
};

/* Auto-upgrade modal. */
const modalBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(6px)',
  display: 'grid', placeItems: 'center',
  zIndex: 110, padding: 16,
};
const modalShell: React.CSSProperties = {
  width: '100%', maxWidth: 420,
  background: 'linear-gradient(170deg, #111A2E, #0B1120)',
  border: `1px solid ${COLOR.success}55`,
  borderRadius: 16, padding: 18,
  boxShadow: '0 24px 70px rgba(0,0,0,0.6), 0 0 32px rgba(52,211,153,0.20)',
  color: COLOR.ink.primary,
  fontFamily: 'inherit',
};
const modalKicker: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, letterSpacing: '0.24em',
  color: COLOR.success,
};
const modalTitle: React.CSSProperties = {
  margin: '6px 0 6px',
  fontSize: 20, fontWeight: 900, color: COLOR.ink.primary,
  letterSpacing: '0.02em',
};
const modalBody: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 12, color: COLOR.ink.secondary, lineHeight: 1.5,
};
const modalFieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 800,
  letterSpacing: '0.16em', textTransform: 'uppercase',
  color: COLOR.ink.muted, marginBottom: 6,
};
const modalSlider: React.CSSProperties = {
  width: '100%', accentColor: COLOR.success,
};
const modalBudgetRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  fontSize: 11, color: COLOR.ink.muted,
  fontFeatureSettings: '"tnum" 1',
  marginTop: 4, marginBottom: 12,
};
const modalBudgetValue: React.CSSProperties = {
  color: COLOR.gold.base, fontWeight: 800, fontSize: 13,
};
const previewBox: React.CSSProperties = {
  background: 'rgba(11,17,32,0.6)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '10px 12px',
  display: 'flex', flexDirection: 'column', gap: 8,
};
const previewKicker: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
  color: COLOR.accent.cyan,
};
const previewEmpty: React.CSSProperties = {
  fontSize: 11, color: COLOR.ink.muted,
};
const previewGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
};
const previewCell: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 8, padding: '6px 4px',
  textAlign: 'center',
};
const previewCellLabel: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.12em',
  textTransform: 'uppercase', fontWeight: 700,
  color: COLOR.ink.muted,
};
const previewCellValue: React.CSSProperties = {
  fontSize: 14, fontWeight: 900, marginTop: 2,
};
const previewRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  fontSize: 12, color: COLOR.ink.secondary,
  fontFeatureSettings: '"tnum" 1',
};
const modalActions: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8,
  marginTop: 14,
};
const modalCancel: React.CSSProperties = {
  padding: '10px 12px',
  background: 'transparent',
  color: COLOR.ink.muted,
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
};
const modalConfirm: React.CSSProperties = {
  padding: '10px 12px',
  background: COLOR.success, color: '#0B1120',
  border: 0, borderRadius: 10, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
  letterSpacing: '0.04em',
};
