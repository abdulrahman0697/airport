import { Application, Container, Ticker } from 'pixi.js';
import { loadTopAirports } from '../data/airports';
import type { Route } from '../engine/types';
import { createAirportPins } from './AirportPins';
import { ArcsLayer } from './Arcs';
import { createBasemap } from './Basemap';
import { Camera } from './Camera';
import { createClouds, type CloudLayer } from './Clouds';

/**
 * Top-level Pixi world stage.
 *
 *   root
 *   ├── basemap     (transformed by camera, no parallax)
 *   ├── clouds      (transformed by camera × parallax factor)
 *   ├── arcs        (route paths + animated dots, under pins)
 *   └── pins        (transformed by camera, no parallax)
 *
 * Owns the input handlers (pointer / wheel) and the ticker loop.
 * Phase 5: `setRoutes()` / `setTailColor()` push UI-side state into the
 * arcs layer.
 */

const REDUCED_MOTION = (() => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
})();

export interface WorldStage {
  readonly app: Application;
  destroy(): void;
  fps(): number;
  setRoutes(routes: readonly Route[]): void;
  setTailColor(hex: string): void;
}

export async function createWorldStage(host: HTMLElement): Promise<WorldStage> {
  const app = new Application();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  await app.init({
    background: '#0B1120',
    antialias: true,
    autoDensity: true,
    resolution: dpr,
    resizeTo: host,
    powerPreference: 'high-performance',
  });
  host.appendChild(app.canvas);
  app.canvas.style.touchAction = 'none';
  app.canvas.style.userSelect = 'none';

  const camera = new Camera({
    viewportWidth: host.clientWidth,
    viewportHeight: host.clientHeight,
    minScale: 0.1,
    maxScale: 6,
  });

  const root = new Container();
  root.label = 'world-root';
  app.stage.addChild(root);

  const airports = loadTopAirports();
  const basemap = createBasemap();
  const clouds: CloudLayer = createClouds();
  const arcsLayer = new ArcsLayer(airports);
  const pins = createAirportPins(airports);

  root.addChild(basemap);
  root.addChild(clouds.container);
  root.addChild(arcsLayer.container);
  root.addChild(pins);

  function applyCamera(): void {
    root.scale.set(camera.state.scale);
    root.position.set(-camera.state.tx * camera.state.scale, -camera.state.ty * camera.state.scale);
    const px = (1 - clouds.parallaxFactor) * camera.state.tx * camera.state.scale;
    const py = (1 - clouds.parallaxFactor) * camera.state.ty * camera.state.scale;
    clouds.container.position.set(px / camera.state.scale, py / camera.state.scale);
  }

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastT = 0;
  let dragVx = 0;
  let dragVy = 0;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;

  const onDown = (e: PointerEvent): void => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
      dragVx = 0; dragVy = 0;
      camera.stopMomentum();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      dragging = false;
    }
    app.canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent): void => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinchDist > 0) {
        const factor = d / pinchDist;
        const mx = (a!.x + b!.x) / 2;
        const my = (a!.y + b!.y) / 2;
        const rect = app.canvas.getBoundingClientRect();
        camera.zoomAt(mx - rect.left, my - rect.top, factor);
        applyCamera();
      }
      pinchDist = d;
    } else if (dragging) {
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const dt = Math.max(1, now - lastT);
      dragVx = (dx / dt) * 1000;
      dragVy = (dy / dt) * 1000;
      camera.panBy(dx, dy);
      applyCamera();
      lastX = e.clientX; lastY = e.clientY; lastT = now;
    }
  };
  const onUp = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (pointers.size === 0 && dragging) {
      dragging = false;
      if (!REDUCED_MOTION) camera.flick(dragVx, dragVy);
    }
    try { app.canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = app.canvas.getBoundingClientRect();
    const factor = Math.exp(-e.deltaY * 0.002);
    camera.zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
    applyCamera();
  };
  app.canvas.addEventListener('pointerdown', onDown);
  app.canvas.addEventListener('pointermove', onMove);
  app.canvas.addEventListener('pointerup', onUp);
  app.canvas.addEventListener('pointercancel', onUp);
  app.canvas.addEventListener('wheel', onWheel, { passive: false });

  const ro = new ResizeObserver(() => {
    camera.setViewport(host.clientWidth, host.clientHeight);
    applyCamera();
  });
  ro.observe(host);

  const onLost = (e: Event): void => {
    e.preventDefault();
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] WebGL context lost; will rebuild on restore');
  };
  const onRestored = (): void => {
    // eslint-disable-next-line no-console
    console.info('[skyhaven] WebGL context restored');
    applyCamera();
  };
  app.canvas.addEventListener('webglcontextlost', onLost);
  app.canvas.addEventListener('webglcontextrestored', onRestored);

  const onTick = (ticker: Ticker): void => {
    const dtMs = ticker.deltaMS;
    if (!REDUCED_MOTION) {
      camera.tick(dtMs);
      clouds.tick(dtMs);
    }
    applyCamera();
  };
  app.ticker.add(onTick);

  applyCamera();

  return {
    app,
    fps: () => app.ticker.FPS,
    setRoutes: (routes) => arcsLayer.setRoutes(routes),
    setTailColor: (hex) => arcsLayer.setTailColor(hex),
    destroy: () => {
      app.ticker.remove(onTick);
      app.canvas.removeEventListener('pointerdown', onDown);
      app.canvas.removeEventListener('pointermove', onMove);
      app.canvas.removeEventListener('pointerup', onUp);
      app.canvas.removeEventListener('pointercancel', onUp);
      app.canvas.removeEventListener('wheel', onWheel);
      app.canvas.removeEventListener('webglcontextlost', onLost);
      app.canvas.removeEventListener('webglcontextrestored', onRestored);
      ro.disconnect();
      arcsLayer.destroy();
      app.destroy(true, { children: true, texture: true });
    },
  };
}
