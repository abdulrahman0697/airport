/**
 * Audio settings (Design pass D9).
 *
 * Toggles for SFX and Music/ambience plus a master volume slider. The
 * source of truth lives in `juice/sfx` (persisted to localStorage); this
 * card just mirrors it with local state. Flipping SFX on plays a tick so
 * the change is audible; flipping music on starts the bed immediately.
 */
import { useState } from 'react';
import { sfx } from '../juice/sfx';
import { haptics } from '../juice/haptics';
import { COLOR, RADIUS } from '../design/tokens';

export function AudioSettingsCard() {
  const [sfxOn, setSfxOn] = useState(sfx.isSfxOn());
  const [musicOn, setMusicOn] = useState(sfx.isMusicOn());
  const [volume, setVolume] = useState(sfx.getVolume());
  const [hapticsOn, setHapticsOn] = useState(haptics.isEnabled());

  return (
    <section style={card}>
      <div style={head}>Sound &amp; Haptics</div>

      <Row
        label="Sound effects"
        hint="Taps, claims, alerts, and milestone cues."
        checked={sfxOn}
        onChange={(v): void => {
          sfx.setSfxOn(v);
          setSfxOn(v);
          if (v) sfx.tick();
        }}
      />

      <Row
        label="Music & ambience"
        hint="Background theme and airport ambience loop."
        checked={musicOn}
        onChange={(v): void => {
          sfx.setMusicOn(v);
          setMusicOn(v);
        }}
      />

      <Row
        label="Vibration"
        hint="Haptic feedback on taps, purchases, and alerts."
        checked={hapticsOn}
        onChange={(v): void => {
          haptics.setEnabled(v);
          setHapticsOn(v);
          if (v) haptics.medium();
        }}
      />

      <div style={volRow}>
        <span style={volLabel}>Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e): void => {
            const v = Number(e.target.value) / 100;
            sfx.setVolume(v);
            setVolume(v);
          }}
          style={slider}
          aria-label="Master volume"
        />
        <span style={volValue}>{Math.round(volume * 100)}%</span>
      </div>
    </section>
  );
}

function Row(props: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const { label, hint, checked, onChange } = props;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(): void => onChange(!checked)}
      style={row}
    >
      <span style={{ minWidth: 0, textAlign: 'left' }}>
        <span style={rowLabel}>{label}</span>
        <span style={rowHint}>{hint}</span>
      </span>
      <span style={{ ...track, background: checked ? COLOR.accent.cyan : 'rgba(148,163,184,0.3)' }}>
        <span style={{ ...knob, transform: checked ? 'translateX(18px)' : 'translateX(0)' }} />
      </span>
    </button>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: COLOR.bg.glass,
  borderRadius: RADIUS.m,
  border: `1px solid ${COLOR.border.soft}`,
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};
const head: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: COLOR.ink.muted, fontWeight: 700, marginBottom: 6,
};
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '10px 4px', background: 'transparent', border: 0, cursor: 'pointer',
  fontFamily: 'inherit', width: '100%', minHeight: 44,
};
const rowLabel: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 700, color: COLOR.ink.primary,
};
const rowHint: React.CSSProperties = {
  display: 'block', fontSize: 11, color: COLOR.ink.muted, marginTop: 2, lineHeight: 1.4,
};
const track: React.CSSProperties = {
  position: 'relative', width: 40, height: 22, borderRadius: 999,
  flexShrink: 0, transition: 'background 160ms ease',
};
const knob: React.CSSProperties = {
  position: 'absolute', top: 2, left: 2, width: 18, height: 18, borderRadius: '50%',
  background: '#fff', transition: 'transform 160ms ease',
  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
};
const volRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px 4px',
};
const volLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: COLOR.ink.primary, flexShrink: 0 };
const slider: React.CSSProperties = { flex: 1, accentColor: COLOR.accent.cyan, minWidth: 0 };
const volValue: React.CSSProperties = {
  fontSize: 12, color: COLOR.ink.muted, fontFeatureSettings: '"tnum" 1',
  minWidth: 36, textAlign: 'right',
};
