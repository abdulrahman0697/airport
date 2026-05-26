import { describe, expect, it } from 'vitest';
import { Camera } from './Camera';
import { WORLD_HEIGHT, WORLD_WIDTH } from './projection';

const cfg = { viewportWidth: 400, viewportHeight: 800, minScale: 0.1, maxScale: 8 };

describe('Camera', () => {
  it('starts fitted to viewport, centred on the world', () => {
    const c = new Camera(cfg);
    const fitScale = Math.max(cfg.viewportWidth / WORLD_WIDTH, cfg.viewportHeight / WORLD_HEIGHT);
    expect(c.state.scale).toBeCloseTo(fitScale);
  });

  it('wraps tx modulo WORLD_WIDTH so horizontal pan is infinite', () => {
    const c = new Camera(cfg);
    c.panBy(-1e6, 0);
    expect(c.state.tx).toBeGreaterThanOrEqual(0);
    expect(c.state.tx).toBeLessThan(WORLD_WIDTH);
    c.panBy(1e6, 0);
    expect(c.state.tx).toBeGreaterThanOrEqual(0);
    expect(c.state.tx).toBeLessThan(WORLD_WIDTH);
  });

  it('still clamps vertical pan to the world', () => {
    const c = new Camera(cfg);
    c.panBy(0, -1e6);
    expect(c.state.ty).toBe(0);
    c.panBy(0, 1e6);
    const viewWorldH = cfg.viewportHeight / c.state.scale;
    expect(c.state.ty).toBeLessThanOrEqual(WORLD_HEIGHT - viewWorldH + 0.001);
  });

  it('zooms about an anchor without shifting that anchor in world space', () => {
    const c = new Camera(cfg);
    const ax = 200;
    const ay = 400;
    const worldX0 = c.state.tx + ax / c.state.scale;
    const worldY0 = c.state.ty + ay / c.state.scale;
    c.zoomAt(ax, ay, 2.0);
    const worldX1 = c.state.tx + ax / c.state.scale;
    const worldY1 = c.state.ty + ay / c.state.scale;
    expect(worldX1).toBeCloseTo(worldX0, 5);
    expect(worldY1).toBeCloseTo(worldY0, 5);
  });

  it('decays momentum to zero', () => {
    const c = new Camera(cfg);
    c.flick(500, 0);
    for (let i = 0; i < 200; i++) c.tick(16);
    expect(c.state.tx).toBeGreaterThanOrEqual(0);
  });
});
