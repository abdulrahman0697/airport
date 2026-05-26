import { WORLD_HEIGHT, WORLD_WIDTH } from './projection';

/**
 * Camera holds the screen→world transform (pan + zoom).
 * - `scale` is world-units per screen-pixel inverse: screenPx = (worldPx - tx) * scale.
 * - Momentum is integrated in screen-space at the end of a drag.
 *
 * Deterministic engine code never touches the camera; this is pure render state.
 */

export interface CameraState {
  /** World-space x corresponding to screen x=0 (top-left of viewport). */
  tx: number;
  /** World-space y corresponding to screen y=0. */
  ty: number;
  /** Screen pixels per world unit. 1 = native. */
  scale: number;
}

export interface CameraConfig {
  viewportWidth: number;
  viewportHeight: number;
  minScale: number;
  maxScale: number;
}

const FRICTION_PER_SEC = 4.5;
const MOMENTUM_EPSILON = 0.5;

export class Camera {
  state: CameraState;
  private vx = 0;
  private vy = 0;
  private cfg: CameraConfig;

  constructor(cfg: CameraConfig, initial?: Partial<CameraState>) {
    this.cfg = cfg;
    const fitScale = Math.max(cfg.viewportWidth / WORLD_WIDTH, cfg.viewportHeight / WORLD_HEIGHT);
    this.state = {
      tx: WORLD_WIDTH / 2 - cfg.viewportWidth / 2 / fitScale,
      ty: WORLD_HEIGHT / 2 - cfg.viewportHeight / 2 / fitScale,
      scale: fitScale,
      ...initial,
    };
    this.clamp();
  }

  setViewport(w: number, h: number): void {
    this.cfg.viewportWidth = w;
    this.cfg.viewportHeight = h;
    this.clamp();
  }

  /** Pan by a screen-space delta (px). */
  panBy(dxScreen: number, dyScreen: number): void {
    this.state.tx -= dxScreen / this.state.scale;
    this.state.ty -= dyScreen / this.state.scale;
    this.clamp();
  }

  /** Set velocity (screen px / second) — call on pointer release. */
  flick(vxScreen: number, vyScreen: number): void {
    this.vx = vxScreen;
    this.vy = vyScreen;
  }

  /** Zoom around a screen-space anchor point. `factor` > 1 zooms in. */
  zoomAt(anchorX: number, anchorY: number, factor: number): void {
    const next = Math.min(this.cfg.maxScale, Math.max(this.cfg.minScale, this.state.scale * factor));
    if (next === this.state.scale) return;
    const worldAnchorX = this.state.tx + anchorX / this.state.scale;
    const worldAnchorY = this.state.ty + anchorY / this.state.scale;
    this.state.scale = next;
    this.state.tx = worldAnchorX - anchorX / next;
    this.state.ty = worldAnchorY - anchorY / next;
    this.clamp();
  }

  /**
   * Centre the viewport on a world-space point at the given camera
   * scale. Clamped via `clamp()` afterwards.
   */
  centerOn(worldX: number, worldY: number, scale: number): void {
    const next = Math.min(this.cfg.maxScale, Math.max(this.cfg.minScale, scale));
    this.state.scale = next;
    this.state.tx = worldX - this.cfg.viewportWidth / 2 / next;
    this.state.ty = worldY - this.cfg.viewportHeight / 2 / next;
    this.vx = 0;
    this.vy = 0;
    this.clamp();
  }

  /** Per-frame integration of momentum. dtMs is the frame delta in ms. */
  tick(dtMs: number): void {
    if (this.vx === 0 && this.vy === 0) return;
    const dt = dtMs / 1000;
    this.state.tx -= (this.vx * dt) / this.state.scale;
    this.state.ty -= (this.vy * dt) / this.state.scale;
    const decay = Math.exp(-FRICTION_PER_SEC * dt);
    this.vx *= decay;
    this.vy *= decay;
    if (Math.hypot(this.vx, this.vy) < MOMENTUM_EPSILON) {
      this.vx = 0;
      this.vy = 0;
    }
    this.clamp();
  }

  stopMomentum(): void {
    this.vx = 0;
    this.vy = 0;
  }

  private clamp(): void {
    // Vertical is bounded — the player can't scroll off the top of the
    // North Pole. Horizontal wraps infinitely (BRD §9.1 globe feel).
    const minScale = Math.max(
      this.cfg.minScale,
      this.cfg.viewportHeight / WORLD_HEIGHT,
    );
    if (this.state.scale < minScale) this.state.scale = minScale;
    const viewWorldH = this.cfg.viewportHeight / this.state.scale;
    const maxTy = WORLD_HEIGHT - viewWorldH;
    if (this.state.ty < 0) this.state.ty = 0;
    if (this.state.ty > maxTy) this.state.ty = maxTy;
    // Wrap tx into [0, WORLD_WIDTH) so coordinates stay bounded while
    // the player perceives unlimited horizontal panning. The basemap +
    // countries layers tile by ±WORLD_WIDTH so the wrap is invisible.
    this.state.tx = ((this.state.tx % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
  }
}
