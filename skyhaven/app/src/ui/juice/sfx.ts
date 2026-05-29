/**
 * Audio engine (Design pass D7 + D9).
 *
 * Plays sampled SFX from `/audio/sfx/*.wav` and a looping music +
 * ambience bed from `/audio/music/*.wav`. The original WebAudio
 * oscillator tones are kept as a fallback for any slot whose file is
 * missing (not yet uploaded) or hasn't decoded yet — so the game is
 * never silent and new files "just play" the moment they're dropped in.
 *
 * The public `sfx.*` vocabulary (tick/confirm/claim/success/warn/ripple)
 * is unchanged so existing call sites keep working; specific, richer
 * cues use `sfx.play(slot)`.
 *
 * Settings (persisted to localStorage):
 *   - SFX on/off, Music on/off, master volume.
 *   - `prefers-reduced-motion` defaults BOTH channels off on first run
 *     (no stored choice) — a calm-by-default accessibility stance.
 *
 * Autoplay policy: an AudioContext can't start before a user gesture,
 * so `initAudio()` installs a one-shot unlock listener, and every
 * play() also resumes the context + starts music opportunistically.
 */

export type SfxSlot =
  | 'ui_tick' | 'ui_confirm' | 'ui_error'
  | 'claim_coin' | 'reward_login' | 'cash_tick'
  | 'achievement_unlock' | 'tier_unlock' | 'region_unlock' | 'vintage_award' | 'offline_welcome'
  | 'aircraft_delivery' | 'takeoff_whoosh' | 'repair_complete' | 'upgrade_complete'
  | 'route_open' | 'route_close' | 'manager_hire' | 'hub_created' | 'hub_upgraded'
  | 'fuel_contract_sign' | 'fuel_contract_stamp'
  | 'event_positive' | 'event_negative' | 'event_end'
  | 'fuel_low' | 'fuel_critical' | 'collectible_spawn';

// ─── Persisted settings ──────────────────────────────────────────────
const SFX_KEY = 'skyhaven.audio.sfx.v1';
const MUSIC_KEY = 'skyhaven.audio.music.v1';
const VOL_KEY = 'skyhaven.audio.volume.v1';

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch { return fallback; }
}
function writeBool(key: string, v: boolean): void {
  try { window.localStorage.setItem(key, v ? '1' : '0'); } catch { /* ignore */ }
}
function readVol(): number {
  if (typeof window === 'undefined') return 0.8;
  try {
    const v = window.localStorage.getItem(VOL_KEY);
    const n = v === null ? 0.8 : Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.8;
  } catch { return 0.8; }
}

// Calm-by-default: if the player has expressed no preference and the OS
// asks for reduced motion, start muted on both channels.
const reduced = prefersReducedMotion();
let sfxOn = readBool(SFX_KEY, !reduced);
let musicOn = readBool(MUSIC_KEY, !reduced);
let volume = readVol();

// ─── WebAudio graph ──────────────────────────────────────────────────
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let ambientGain: GainNode | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(master);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(master);
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.25;
    ambientGain.connect(master);
    return ctx;
  } catch { return null; }
}

// ─── Sample loading ──────────────────────────────────────────────────
// `undefined` = not attempted; `null` = tried and unavailable (use synth).
const buffers = new Map<string, AudioBuffer | null>();
const inflight = new Map<string, Promise<AudioBuffer | null>>();

async function loadBuffer(url: string): Promise<AudioBuffer | null> {
  const a = ensureCtx();
  if (!a) return null;
  const existing = buffers.get(url);
  if (existing !== undefined) return existing;
  const pending = inflight.get(url);
  if (pending) return pending;
  const p = (async (): Promise<AudioBuffer | null> => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.arrayBuffer();
      const buf = await a.decodeAudioData(arr);
      buffers.set(url, buf);
      return buf;
    } catch {
      buffers.set(url, null); // mark missing → synth fallback from now on
      return null;
    } finally {
      inflight.delete(url);
    }
  })();
  inflight.set(url, p);
  return p;
}

function playBuffer(buf: AudioBuffer, dest: GainNode, loop = false): AudioBufferSourceNode | null {
  const a = ctx;
  if (!a) return null;
  const src = a.createBufferSource();
  src.buffer = buf;
  src.loop = loop;
  src.connect(dest);
  src.start();
  return src;
}

// ─── Synth fallback (original D7 oscillator tones) ───────────────────
interface ToneSpec {
  freq: number; target?: number; dur: number;
  type?: OscillatorType; gain?: number; delay?: number;
}
function tone(spec: ToneSpec): void {
  const a = ensureCtx();
  if (!a || !sfxGain) return;
  const t0 = a.currentTime + (spec.delay ?? 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = spec.type ?? 'sine';
  osc.frequency.setValueAtTime(spec.freq, t0);
  if (spec.target !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.target), t0 + spec.dur);
  }
  const peak = spec.gain ?? 0.18;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
  osc.connect(g).connect(sfxGain);
  osc.start(t0);
  osc.stop(t0 + spec.dur + 0.05);
}
const synth = {
  tick(): void { tone({ freq: 1100, target: 900, dur: 0.05, gain: 0.10, type: 'triangle' }); },
  confirm(): void { tone({ freq: 660, target: 880, dur: 0.10, gain: 0.18, type: 'sine' }); },
  claim(): void {
    tone({ freq: 760, dur: 0.08, gain: 0.20, type: 'triangle' });
    tone({ freq: 1140, dur: 0.10, gain: 0.18, type: 'triangle', delay: 0.06 });
  },
  success(): void {
    tone({ freq: 523, dur: 0.10, gain: 0.18, type: 'sine' });
    tone({ freq: 659, dur: 0.12, gain: 0.18, type: 'sine', delay: 0.08 });
    tone({ freq: 784, dur: 0.18, gain: 0.20, type: 'sine', delay: 0.18 });
    tone({ freq: 1047, dur: 0.30, gain: 0.20, type: 'sine', delay: 0.28 });
  },
  warn(): void { tone({ freq: 380, target: 240, dur: 0.18, gain: 0.16, type: 'sawtooth' }); },
  ripple(): void { tone({ freq: 220, target: 110, dur: 0.18, gain: 0.06, type: 'sine' }); },
};

/** Per-slot synth fallback used until/unless a sample file is present. */
function synthFor(slot: SfxSlot): void {
  switch (slot) {
    case 'ui_tick': case 'cash_tick': return synth.tick();
    case 'ui_error': case 'event_negative': case 'fuel_low': return synth.warn();
    case 'fuel_critical': tone({ freq: 420, target: 200, dur: 0.30, gain: 0.20, type: 'sawtooth' }); return;
    case 'claim_coin': case 'reward_login': case 'achievement_unlock': case 'collectible_spawn':
      return synth.claim();
    case 'tier_unlock': case 'region_unlock': case 'vintage_award': case 'offline_welcome':
    case 'hub_created': case 'fuel_contract_stamp': case 'event_positive':
      return synth.success();
    case 'route_close': tone({ freq: 520, target: 300, dur: 0.16, gain: 0.14, type: 'sine' }); return;
    default: return synth.confirm(); // confirms, deliveries, repairs, upgrades, hires…
  }
}

// ─── Music / ambience ────────────────────────────────────────────────
let musicStarted = false;
let musicSrc: AudioBufferSourceNode | null = null;
let ambientSrc: AudioBufferSourceNode | null = null;

async function startMusic(): Promise<void> {
  if (musicStarted || !musicOn) return;
  const a = ensureCtx();
  if (!a || !musicGain || !ambientGain) return;
  if (a.state === 'suspended') { try { await a.resume(); } catch { /* ignore */ } }
  musicStarted = true;
  const theme = await loadBuffer(`/audio/music/music_theme.wav`);
  if (theme && musicOn && musicGain) musicSrc = playBuffer(theme, musicGain, true);
  const amb = await loadBuffer(`/audio/music/ambience_airport.wav`);
  if (amb && musicOn && ambientGain) ambientSrc = playBuffer(amb, ambientGain, true);
  if (!musicSrc && !ambientSrc) musicStarted = false; // nothing loaded; allow retry
}
function stopMusic(): void {
  try { musicSrc?.stop(); } catch { /* ignore */ }
  try { ambientSrc?.stop(); } catch { /* ignore */ }
  musicSrc = null; ambientSrc = null; musicStarted = false;
}

/** Resume the context (post-gesture) and kick music if enabled. */
function ensureStarted(): void {
  const a = ensureCtx();
  if (!a) return;
  if (a.state === 'suspended') { a.resume().catch(() => undefined); }
  if (musicOn && !musicStarted) { void startMusic(); }
}

// ─── Core SFX play ───────────────────────────────────────────────────
const _ = (s: SfxSlot): string => `/audio/sfx/${s}.wav`;

function playSlot(slot: SfxSlot): void {
  if (!sfxOn) return;
  const a = ensureCtx();
  if (!a) return;
  if (a.state === 'suspended') { a.resume().catch(() => undefined); }
  const url = _(slot);
  const cached = buffers.get(url);
  if (cached) { if (sfxGain) playBuffer(cached, sfxGain); return; }
  if (cached === null) { synthFor(slot); return; } // known-missing → synth
  // Not loaded yet: play synth now for instant feedback, load for next time.
  synthFor(slot);
  void loadBuffer(url);
}

// cash_tick fires in rapid bursts while a counter animates — throttle it
// so samples don't pile up into mush.
let lastCashTick = 0;
function cashTick(): void {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastCashTick < 110) return;
  lastCashTick = now;
  playSlot('cash_tick');
}

// ─── Public API ──────────────────────────────────────────────────────
export const sfx = {
  /** Install the one-shot autoplay-unlock listener. Call once on mount. */
  init(): void {
    if (typeof window === 'undefined') return;
    const unlock = (): void => { ensureStarted(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  },

  /** Generic specific-cue trigger. */
  play(slot: SfxSlot): void { playSlot(slot); },
  cashTick,

  /** One-shot opening sting (lives in /audio/music, stereo). Plays if
   *  either audio channel is enabled. */
  playSplash(): void {
    if (!sfxOn && !musicOn) return;
    const a = ensureCtx();
    if (!a) return;
    if (a.state === 'suspended') { a.resume().catch(() => undefined); }
    const url = `/audio/music/splash_sting.wav`;
    const cached = buffers.get(url);
    if (cached) { if (master) playBuffer(cached, master); return; }
    void (async (): Promise<void> => {
      const b = await loadBuffer(url);
      if (b && master) playBuffer(b, master);
    })();
  },

  // Legacy vocabulary → mapped slots (synth fallback preserved).
  tick(): void { playSlot('ui_tick'); },
  confirm(): void { playSlot('ui_confirm'); },
  claim(): void { playSlot('claim_coin'); },
  warn(): void { playSlot('ui_error'); },
  success(): void { if (sfxOn) synth.success(); }, // no dedicated sample; keep arpeggio
  ripple(): void { if (sfxOn) synth.ripple(); },

  // ── Settings ──
  isSfxOn(): boolean { return sfxOn; },
  setSfxOn(v: boolean): void { sfxOn = v; writeBool(SFX_KEY, v); },
  isMusicOn(): boolean { return musicOn; },
  setMusicOn(v: boolean): void {
    musicOn = v; writeBool(MUSIC_KEY, v);
    if (v) { void startMusic(); } else { stopMusic(); }
  },
  getVolume(): number { return volume; },
  setVolume(v: number): void {
    volume = Math.max(0, Math.min(1, v));
    try { window.localStorage.setItem(VOL_KEY, String(volume)); } catch { /* ignore */ }
    if (master) master.gain.value = volume;
  },

  // Back-compat shims (old callers used setMuted/isMuted for SFX).
  setMuted(m: boolean): void { this.setSfxOn(!m); },
  isMuted(): boolean { return !sfxOn; },
};

/** Convenience export so `App` can install the unlock listener. */
export function initAudio(): void { sfx.init(); }
