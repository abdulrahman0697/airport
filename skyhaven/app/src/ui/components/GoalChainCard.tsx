import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { GOAL_CHAIN, GOAL_COUNT } from '../../engine/goalChain';
import {
  selectGoalChainStep,
  selectTutorialCompleted,
  useGameStore,
} from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { formatCash } from '../format';
import { usePanelStore } from './PanelHost';

/**
 * Early-goal chain ribbon (BRD §5.3).
 *
 * Sits above the bottom tabs once the tutorial has finished. Shows
 * the current goal; on completion, briefly flips to a "Completed +X"
 * card before sliding the next goal in.
 */
const FLIP_DURATION_MS = 1800;

export function GoalChainCard() {
  const tutorialCompleted = useGameStore(selectTutorialCompleted);
  const step = useGameStore(selectGoalChainStep);
  const activePanel = usePanelStore((s) => s.active);
  const mapMode = useUiStore((s) => s.mapMode);
  const previousStepRef = useRef<number>(step);
  const [flip, setFlip] = useState<{ rewardedStep: number; reward: number } | null>(null);

  useEffect(() => {
    if (step > previousStepRef.current && previousStepRef.current < GOAL_COUNT) {
      const completedIdx = previousStepRef.current;
      const completed = GOAL_CHAIN[completedIdx];
      if (completed) {
        setFlip({ rewardedStep: completedIdx, reward: completed.reward });
        const id = setTimeout(() => setFlip(null), FLIP_DURATION_MS);
        previousStepRef.current = step;
        return () => clearTimeout(id);
      }
    }
    previousStepRef.current = step;
    return undefined;
  }, [step]);

  if (!tutorialCompleted) return null;
  if (activePanel !== null) return null;
  // Design Review v3 — home airport surface owns the "what's next"
  // prompts; only re-appear when the player has explicitly switched
  // to the world-map view.
  if (!mapMode) return null;
  if (step >= GOAL_COUNT && !flip) return null;

  const current = step < GOAL_COUNT ? GOAL_CHAIN[step] : null;

  return (
    <div style={shell}>
      <AnimatePresence mode="wait">
        {flip ? (
          <motion.div
            key={`flip-${flip.rewardedStep}`}
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: 90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            style={cardFlip as Record<string, unknown>}
          >
            <div style={kickerCompleted}>✓ Completed</div>
            <div style={flipReward}>+${formatCash(flip.reward, 1)}</div>
          </motion.div>
        ) : current ? (
          <motion.div
            key={`goal-${step}`}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={card as Record<string, unknown>}
          >
            <div style={kicker}>Objective {step + 1} of {GOAL_COUNT}</div>
            <div style={goalTitle}>{current.title}</div>
            <div style={goalDesc}>{current.description}</div>
            <div style={goalReward}>+${formatCash(current.reward, 1)}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const shell: React.CSSProperties = {
  position: 'fixed',
  left: 10,
  right: 10,
  bottom: 'calc(64px + env(safe-area-inset-bottom) + 8px)',
  pointerEvents: 'none',
  zIndex: 25,
  perspective: 600,
};
const card: React.CSSProperties = {
  background: 'rgba(11,17,32,0.92)',
  backdropFilter: 'blur(8px)',
  borderRadius: 12,
  padding: '10px 14px',
  border: '1px solid rgba(90,200,250,0.4)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  pointerEvents: 'none',
};
const cardFlip: React.CSSProperties = {
  background: 'rgba(11,17,32,0.95)',
  backdropFilter: 'blur(8px)',
  borderRadius: 12,
  padding: '10px 14px',
  border: '1px solid rgba(244,199,91,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  pointerEvents: 'none',
};
const kicker: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: '#5AC8FA',
  fontWeight: 700,
  flexShrink: 0,
};
const kickerCompleted: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: '#34D399',
  fontWeight: 700,
};
const goalTitle: React.CSSProperties = {
  fontSize: 13,
  color: '#F8FAFC',
  fontWeight: 700,
  marginLeft: 12,
  flex: 1,
};
const goalDesc: React.CSSProperties = {
  fontSize: 11,
  color: '#94A3B8',
  marginLeft: 8,
  flex: 1,
};
const goalReward: React.CSSProperties = {
  fontSize: 13,
  color: '#F4C75B',
  fontWeight: 700,
  fontFeatureSettings: '"tnum" 1',
  marginLeft: 12,
};
const flipReward: React.CSSProperties = {
  fontSize: 18,
  color: '#F4C75B',
  fontWeight: 700,
  fontFeatureSettings: '"tnum" 1',
  textShadow: '0 0 12px rgba(244,199,91,0.5)',
};
