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
const heroIllustration: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '14px 0 0',
};
