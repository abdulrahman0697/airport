import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { aircraftByTier } from '../../data/aircraft';
import { getRegion } from '../../data/regions';
import {
  selectTailColor,
  selectTier,
  selectTutorialCompleted,
  selectUnlockedRegions,
  useGameStore,
} from '../../state/store';
import { growthFor } from '../../data/tierGrowth';
import { Button } from '../design/Button';
import { ConfettiBurst } from '../design/ConfettiBurst';
import { AircraftIllustration } from '../design/SvgAircraft';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

/**
 * Hero moments (BRD §9.4).
 *
 * Phase 10 ships the screen-wide celebration for two big events:
 *   - tier unlocks  (Tier N becomes buyable)
 *   - region unlocks (a new region opens up)
 *
 * Each shows a full-screen bloom + headline card. Both watch state
 * via useRef snapshots so they fire only on the upward transition,
 * never on initial mount or load.
 */

interface QueuedMoment {
  id: string;
  kind: 'tier' | 'region';
  primary: string;     // big headline
  secondary: string;   // subtitle
  accent: string;      // accent color (defaults to tail)
  bodyLines: string[]; // bullet/explanatory lines
  /** For tier unlocks: a representative aircraft def id for the hero. */
  heroDefId?: string;
  /** For tier unlocks: numeric tier the player just reached. */
  tierJustReached?: number;
}

export function HeroMoments() {
  const tier = useGameStore(selectTier);
  const regions = useGameStore(selectUnlockedRegions);
  const tailColor = useGameStore(selectTailColor);
  const tutorialCompleted = useGameStore(selectTutorialCompleted);

  // `seenTier` / `seenRegions` start unset and are populated the first
  // time a real state load comes through. That way the first
  // store-update transition (null → loaded) never fires a popup.
  const seenTier = useRef<number | null>(null);
  const seenRegions = useRef<Set<number> | null>(null);
  const [queue, setQueue] = useState<QueuedMoment[]>([]);

  useEffect(() => {
    if (seenTier.current === null) { seenTier.current = tier; return; }
    if (!tutorialCompleted) { seenTier.current = tier; return; }
    if (tier > seenTier.current) {
      const newTier = tier;
      const planes = aircraftByTier(newTier);
      const examples = planes.slice(0, 3).map((a) => a.displayName);
      const heroDefId = planes[0]?.id;
      const growth = growthFor(newTier);
      const lines: string[] = [];
      if (examples.length) lines.push(`New aircraft: ${examples.join(' · ')}`);
      if (growth) lines.push(`Your airport now features: ${growth.label}`);
      const moment: QueuedMoment = {
        id: `tier-${newTier}-${Date.now()}`,
        kind: 'tier',
        primary: growth ? `${growth.era} unlocked` : `Tier ${newTier} unlocked`,
        secondary: `TIER ${newTier} · ${tierLabel(newTier)}`,
        accent: tailColor,
        bodyLines: lines,
        tierJustReached: newTier,
        ...(heroDefId ? { heroDefId } : {}),
      };
      setQueue((q) => [...q, moment]);
      haptics.success();
      sfx.success();
    }
    seenTier.current = tier;
  }, [tier, tailColor, tutorialCompleted]);

  useEffect(() => {
    // Wait for the store to actually load — until the state arrives
    // `regions` is the frozen EMPTY_NUMBERS singleton; treating that as
    // "no regions" and the next render as "+1 region" was firing the
    // celebration on every launch.
    if (regions.length === 0) return;
    if (seenRegions.current === null) {
      seenRegions.current = new Set(regions);
      return;
    }
    if (!tutorialCompleted) {
      for (const r of regions) seenRegions.current.add(r);
      return;
    }
    const seen = seenRegions.current;
    const additions: number[] = [];
    for (const r of regions) if (!seen.has(r)) additions.push(r);
    if (additions.length > 0) {
      for (const r of additions) seen.add(r);
      const newOnes = additions.map((id) => {
        const def = getRegion(id);
        return {
          id: `region-${id}-${Date.now()}`,
          kind: 'region' as const,
          primary: def?.name ?? `Region ${id}`,
          secondary: 'Region unlocked',
          accent: tailColor,
          bodyLines: ['New airports available in this region — open routes to anywhere here.'],
        };
      });
      setQueue((q) => [...q, ...newOnes]);
      haptics.success();
      sfx.success();
    }
  }, [regions, tailColor, tutorialCompleted]);

  const top = queue[0] ?? null;
  const dismiss = (): void => setQueue((q) => q.slice(1));

  return (
    <AnimatePresence>
      {top && (
        <motion.div
          key={top.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={backdrop(top.accent) as Record<string, unknown>}
          onClick={dismiss}
        >
          <ConfettiBurst seed={top.id.length * 7} palette={[top.accent, '#F4C75B', '#FCE9A5', '#FFFFFF']} />
          <motion.div
            initial={{ scale: 0.7, y: 30, opacity: 0, rotate: -2 }}
            animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22 }}
            onClick={(e): void => e.stopPropagation()}
            style={card(top.accent) as Record<string, unknown>}
          >
            <div style={{ ...accentBar, background: top.accent }} />
            {top.kind === 'tier' && top.tierJustReached !== undefined && (
              <motion.div
                initial={{ rotate: 12, opacity: 0, scale: 1.3 }}
                animate={{ rotate: -8, opacity: 0.85, scale: 1 }}
                transition={{ delay: 0.42, type: 'spring', stiffness: 200, damping: 14 }}
                style={tierStamp(top.accent) as Record<string, unknown>}
              >
                <div style={tierStampInner(top.accent)}>
                  <div style={tierStampTop}>TIER</div>
                  <div style={tierStampBig}>{top.tierJustReached}</div>
                  <div style={tierStampBottom}>UNLOCKED</div>
                </div>
              </motion.div>
            )}
            {top.kind === 'tier' && top.heroDefId && (
              <motion.div
                initial={{ x: -120, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.18, type: 'spring', stiffness: 240, damping: 22 }}
                style={heroIllustration as Record<string, unknown>}
              >
                <AircraftIllustration
                  defId={top.heroDefId}
                  tailColor={top.accent}
                  width={320}
                />
              </motion.div>
            )}
            {/* Construction phases — Design Review v4, point 15. Three
                progressive phase chips animate above the hero card so
                a tier-up physically reads as construction → opening,
                not just a number going up. */}
            {top.kind === 'tier' && (
              <ConstructionPhases accent={top.accent} />
            )}
            <div style={inner}>
              <div style={{ ...kicker, color: top.accent }}>{top.secondary}</div>
              <h1 style={{ ...primary, textShadow: `0 0 32px ${top.accent}55` }}>{top.primary}</h1>
              {top.bodyLines.length > 0 && (
                <div style={body}>
                  {top.bodyLines.map((line, i) => (
                    <p key={i} style={{ margin: i === 0 ? '0 0 4px' : '0' }}>{line}</p>
                  ))}
                </div>
              )}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                accent={top.accent}
                onClick={dismiss}
              >
                Onwards
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ConstructionPhases({ accent }: { accent: string }) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);
  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase(1), 320);
    const t2 = window.setTimeout(() => setPhase(2), 1400);
    const t3 = window.setTimeout(() => setPhase(3), 2700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);
  const phases: Array<{ icon: string; label: string }> = [
    { icon: '📐', label: 'Planning' },
    { icon: '🏗', label: 'Construction' },
    { icon: '✨', label: 'Opening' },
  ];
  return (
    <div style={constructionWrap}>
      {/* Visual construction scene — Design Review v5, point 14. The
          ghost building outline appears during Planning, scaffolding
          + cranes during Construction, lights + final building during
          Opening. Replaces what used to be 3 label cells. */}
      <ConstructionScene phase={phase} accent={accent} />
      <div style={phaseStrip}>
        {phases.map((p, i) => {
          const reached = phase > i;
          const current = phase === i + 1;
          return (
            <div key={p.label} style={phaseCell(reached || current, accent)}>
              <span style={phaseIcon}>{p.icon}</span>
              <span style={phaseLabel(reached || current, accent)}>{p.label}</span>
              {current && <span style={phaseSpinner(accent)} />}
              {reached && <span style={{ ...phaseCheck, color: accent }}>✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConstructionScene({ phase, accent }: { phase: 0 | 1 | 2 | 3; accent: string }) {
  return (
    <svg width="100%" height="68" viewBox="0 0 200 70" preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}>
      {/* Ground line */}
      <rect x="0" y="60" width="200" height="2" fill="rgba(148,163,184,0.25)" />

      {/* Planning: dashed ghost building outline appears. */}
      {phase >= 1 && (
        <g>
          <path
            d="M 60 60 L 60 32 L 90 24 L 130 24 L 140 32 L 140 60 Z"
            fill="none"
            stroke={accent}
            strokeOpacity="0.5"
            strokeWidth="0.8"
            strokeDasharray="3 2"
          />
        </g>
      )}

      {/* Construction: scaffolding + two cranes swinging. */}
      {phase >= 2 && (
        <g>
          {/* Fenced barrier */}
          {[55, 65, 75, 85, 95, 105, 115, 125, 135, 145].map((x) => (
            <rect key={x} x={x} y="56" width="0.6" height="4" fill="rgba(148,163,184,0.6)" />
          ))}
          <rect x="55" y="59" width="91" height="0.6" fill="rgba(148,163,184,0.6)" />
          {/* Scaffolding mesh */}
          <g stroke="rgba(148,163,184,0.5)" strokeWidth="0.4" fill="none">
            <path d="M 60 60 L 60 32 M 90 60 L 90 32 M 120 60 L 120 32 M 140 60 L 140 32" />
            <path d="M 60 50 L 140 50 M 60 40 L 140 40 M 60 32 L 140 32" />
          </g>
          {/* Two cranes swinging */}
          <g style={{ animation: 'crane-swing 2.4s ease-in-out infinite', transformOrigin: '50px 60px' }}>
            <rect x="49" y="20" width="1.5" height="40" fill={accent} opacity="0.85" />
            <rect x="38" y="18" width="22" height="0.8" fill={accent} opacity="0.85" />
            <line x1="56" y1="19" x2="56" y2="30" stroke={accent} strokeWidth="0.5" />
            <rect x="55" y="30" width="2" height="2" fill={accent} />
          </g>
          <g style={{ animation: 'crane-swing 2.8s ease-in-out -1.4s infinite', transformOrigin: '155px 60px' }}>
            <rect x="154" y="22" width="1.5" height="38" fill={accent} opacity="0.85" />
            <rect x="148" y="20" width="18" height="0.8" fill={accent} opacity="0.85" />
            <line x1="151" y1="21" x2="151" y2="34" stroke={accent} strokeWidth="0.5" />
            <rect x="150" y="34" width="2" height="2" fill={accent} />
          </g>
          {/* Worker dots */}
          {[68, 78, 100, 118].map((x, i) => (
            <circle key={i} cx={x} cy="58" r="0.8" fill="#F4C75B" opacity="0.8" />
          ))}
        </g>
      )}

      {/* Opening: solid building with lit windows, plus ribbon. */}
      {phase >= 3 && (
        <g style={{ animation: 'opening-pop 0.5s ease-out forwards' }}>
          <path
            d="M 60 60 L 60 32 L 90 24 L 130 24 L 140 32 L 140 60 Z"
            fill="url(#construction-fill)"
            stroke={accent}
            strokeWidth="0.6"
          />
          {/* Lit windows in 3 rows */}
          {[36, 42, 48].map((row) => (
            [66, 72, 78, 84, 90, 96, 102, 108, 114, 120, 126, 132].map((col) => (
              <rect key={`${row}-${col}`} x={col} y={row} width="2" height="2.5"
                fill="#F4C75B" opacity="0.85" />
            ))
          ))}
          {/* Ribbon cut */}
          <path d="M 55 58 L 145 58" stroke={accent} strokeWidth="1" />
        </g>
      )}

      {/* Twinkling new lights overlay */}
      {phase >= 3 && Array.from({ length: 8 }).map((_, i) => (
        <circle key={`spark-${i}`} cx={50 + (i * 14) % 100} cy={40 + ((i * 7) % 18)} r="0.7"
          fill="#FCE9A5" opacity="0.85"
          style={{ animation: `spark-twinkle ${1 + (i % 3) * 0.6}s ease-in-out ${i * 0.18}s infinite` }} />
      ))}

      <defs>
        <linearGradient id="construction-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A4A75" />
          <stop offset="1" stopColor="#1F2A4D" />
        </linearGradient>
        <style>{`
          @keyframes crane-swing {
            0%, 100% { transform: rotate(-3deg); }
            50% { transform: rotate(3deg); }
          }
          @keyframes opening-pop {
            0% { opacity: 0; transform: translateY(4px) scale(0.96); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes spark-twinkle {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
        `}</style>
      </defs>
    </svg>
  );
}

function tierLabel(t: number): string {
  switch (t) {
    case 2: return 'Regional Jets are yours';
    case 3: return 'Narrow-body fleet unlocked';
    case 4: return 'Modern narrow-bodies online';
    case 5: return 'Wide-bodies + the Cargo lane';
    case 6: return 'Modern wide-bodies online';
    case 7: return 'Heavy / flagship aircraft';
    case 8: return 'Mega-Liner class unlocked';
    default: return `Tier ${t}`;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────
const backdrop = (accent: string): React.CSSProperties => ({
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: `radial-gradient(ellipse at center, ${accent}22, rgba(0,0,0,0.78) 60%)`,
  backdropFilter: 'blur(4px)',
  zIndex: 70,
  padding: 16,
});
const card = (accent: string): React.CSSProperties => ({
  width: '100%',
  maxWidth: 380,
  background: 'linear-gradient(160deg, #182143, #0B1120)',
  borderRadius: 18,
  overflow: 'hidden',
  border: `1px solid ${accent}66`,
  boxShadow: `0 24px 70px rgba(0,0,0,0.6), 0 0 80px ${accent}33`,
});
const accentBar: React.CSSProperties = { height: 5 };
const inner: React.CSSProperties = { padding: '24px 24px 20px', textAlign: 'center' };
const kicker: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  fontWeight: 700,
};
const primary: React.CSSProperties = {
  margin: '8px 0 6px',
  fontSize: 30,
  color: '#F8FAFC',
  fontWeight: 800,
  lineHeight: 1.2,
};
const body: React.CSSProperties = {
  margin: '12px 0 16px',
  color: '#94A3B8',
  fontSize: 13,
  lineHeight: 1.5,
};
const tierStamp = (accent: string): React.CSSProperties => ({
  position: 'absolute',
  top: 22, right: 18,
  width: 92, height: 92,
  zIndex: 4,
  pointerEvents: 'none',
  filter: `drop-shadow(0 4px 12px ${accent}88)`,
});
const tierStampInner = (accent: string): React.CSSProperties => ({
  position: 'relative',
  width: '100%', height: '100%',
  borderRadius: '50%',
  border: `3px solid ${accent}`,
  background: `radial-gradient(circle at center, ${accent}33, transparent 70%)`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: accent,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  fontWeight: 800,
});
const tierStampTop: React.CSSProperties = {
  fontSize: 9, lineHeight: 1.0,
};
const tierStampBig: React.CSSProperties = {
  fontSize: 34, lineHeight: 1.0, fontWeight: 900, marginTop: 2, marginBottom: 2,
  fontFeatureSettings: '"tnum" 1',
};
const tierStampBottom: React.CSSProperties = {
  fontSize: 8, lineHeight: 1.0, letterSpacing: '0.2em',
};
// Construction visuals + phase strip (Design Review v5 — point 14)
const constructionWrap: React.CSSProperties = {
  padding: '6px 12px 4px',
};
const phaseStrip: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 4,
  padding: '4px 16px 0',
};
const phaseCell = (active: boolean, accent: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  fontSize: 10,
  letterSpacing: '0.12em',
  fontWeight: 700,
  padding: '5px 4px',
  borderRadius: 8,
  background: active ? `${accent}22` : 'rgba(11,17,32,0.4)',
  border: `1px solid ${active ? `${accent}55` : 'rgba(255,255,255,0.06)'}`,
  textTransform: 'uppercase',
  position: 'relative',
});
const phaseIcon: React.CSSProperties = {
  fontSize: 12,
};
const phaseLabel = (active: boolean, accent: string): React.CSSProperties => ({
  color: active ? accent : '#94A3B8',
});
const phaseSpinner = (accent: string): React.CSSProperties => ({
  width: 5, height: 5, borderRadius: 999,
  background: accent,
  boxShadow: `0 0 4px ${accent}`,
  animation: 'breathe 0.9s ease-in-out infinite',
});
const phaseCheck: React.CSSProperties = {
  fontSize: 11, fontWeight: 900,
};

const heroIllustration: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '14px 0 0',
};
