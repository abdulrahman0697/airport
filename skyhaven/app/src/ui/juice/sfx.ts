/**
 * Programmatic SFX (Design pass D7).
 *
 * Uses WebAudio oscillators to synthesise tiny tones for tap / claim /
 * achievement / warning. No audio assets shipped — keeps the bundle
 * light, no licensing risk, and the timbres feel coherent because
 * they all come from the same envelope generator.
 *
 * The vocabulary mirrors `juice/haptics.ts` so a call site pairs them:
 *
 *   haptics.success();
 *   sfx.success();
 *
 * Volume is controlled by the muted flag; future Settings panel
 * (D9) wires it to a checkbox + persists the choice.
 *
 * Audio init is lazy — the AudioContext is created on first sound
 * play. Browsers block AudioContext creation before a user gesture,
 * so a no-op fallback is fine until the first tap.
 */
let ctx: AudioContext | null = null;
let muted = false;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  try {
    const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneSpec {
  /** Frequency in Hz (start). */
  freq: number;
  /** Optional pitch glide target (Hz). */
  target?: number;
  /** Duration in seconds. */
  dur: number;
  /** Waveform. */
  type?: OscillatorType;
  /** Linear peak gain (0..1). */
  gain?: number;
  /** Optional delay before the tone fires (s). */
  delay?: number;
}

function play(spec: ToneSpec): void {
  if (muted) return;
  const a = ensureCtx();
  if (!a) return;
  const t0 = a.currentTime + (spec.delay ?? 0);
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = spec.type ?? 'sine';
  osc.frequency.setValueAtTime(spec.freq, t0);
  if (spec.target !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.target), t0 + spec.dur);
  }
  const peak = spec.gain ?? 0.18;
  // ADSR-lite: quick attack, exponential decay.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + spec.dur + 0.05);
}

export const sfx = {
  setMuted(next: boolean): void { muted = next; },
  isMuted(): boolean { return muted; },
  /** Light UI tick — used on selection / toggle. */
  tick(): void {
    play({ freq: 1100, target: 900, dur: 0.05, gain: 0.10, type: 'triangle' });
  },
  /** Medium-weight confirmation — buy / sign / open. */
  confirm(): void {
    play({ freq: 660, target: 880, dur: 0.10, gain: 0.18, type: 'sine' });
  },
  /** Coin-grab / claim — two notes ascending. */
  claim(): void {
    play({ freq: 760, dur: 0.08, gain: 0.20, type: 'triangle' });
    play({ freq: 1140, dur: 0.10, gain: 0.18, type: 'triangle', delay: 0.06 });
  },
  /** Celebratory cue — major triad arpeggio for tier / region unlock. */
  success(): void {
    play({ freq: 523, dur: 0.10, gain: 0.18, type: 'sine' });            // C5
    play({ freq: 659, dur: 0.12, gain: 0.18, type: 'sine', delay: 0.08 }); // E5
    play({ freq: 784, dur: 0.18, gain: 0.20, type: 'sine', delay: 0.18 }); // G5
    play({ freq: 1047, dur: 0.30, gain: 0.20, type: 'sine', delay: 0.28 }); // C6
  },
  /** Soft alert — failed action / fuel shortfall. */
  warn(): void {
    play({ freq: 380, target: 240, dur: 0.18, gain: 0.16, type: 'sawtooth' });
  },
  /** Ripple-on-water — short low whoosh for ambient tap. */
  ripple(): void {
    play({ freq: 220, target: 110, dur: 0.18, gain: 0.06, type: 'sine' });
  },
};
