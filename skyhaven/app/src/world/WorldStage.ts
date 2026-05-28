import { Application, Container, Ticker } from 'pixi.js';
import { loadTopAirports, type Airport } from '../data/airports';
import { getRegion } from '../data/regions';
import type { Collectible, Route } from '../engine/types';
import { lonLatToWorld } from './projection';
import { createAirportPins, type AirportPinsLayer } from './AirportPins';
import { createAmbient, type AmbientLayer } from './Ambient';
import { ArcsLayer } from './Arcs';
import { createBasemap } from './Basemap';
import { createDayNight, type DayNightLayer } from './DayNight';
import { createHubPulses, type HubPulsesLayer } from './HubPulses';
import { createRipples, type RipplesLayer } from './Ripples';
import { Camera } from './Camera';
import { createClouds, type CloudLayer } from './Clouds';
import { CollectiblesLayer } from './Collectibles';
import { createCountries, type CountriesLayer } from './Countries';

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
  setCollectibles(items: readonly Collectible[]): void;
  setCollectibleTapHandler(fn: (id: string) => void): void;
  setUnlockedRegions(regions: ReadonlySet<number>): void;
  /** Set the player's owned hub IATAs so the world can pulse them. */
  setHubs(iatas: readonly string[]): void;
  setAirportTapHandler(fn: (airport: Airport, screen: { x: number; y: number }) => void): void;
  setRouteTapHandler(fn: (routeId: string, screen: { x: number; y: number }) => void): void;
  zoomToRegion(regionId: number, scale?: number): void;
}

export async function createWorldStage(host: HTMLElement): Promise<WorldStage> {
  const app = new Application();
  // Capping DPR at 1.5 keeps the canvas backing-buffer well under
  // memory pressure on mid-range Android WebViews while staying sharp
  // enough for the placeholder map. Phase 10 visual polish can bump
  // back up to 2× alongside the proper basemap textures.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  // eslint-disable-next-line no-console
  console.info('[skyhaven] WorldStage init', {
    hostW: host.clientWidth,
    hostH: host.clientHeight,
    dpr,
  });
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
  // eslint-disable-next-line no-console
  console.info('[skyhaven] WorldStage canvas', {
    w: app.canvas.width,
    h: app.canvas.height,
    rendererType: app.renderer?.name,
  });

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
  const ambient: AmbientLayer = createAmbient();
  ambient.setReducedMotion(REDUCED_MOTION);
  const countries: CountriesLayer = createCountries();
  const dayNight: DayNightLayer = createDayNight();
  const clouds: CloudLayer = createClouds();
  const hubPulses: HubPulsesLayer = createHubPulses(airports);
  const ripples: RipplesLayer = createRipples();
  const arcsLayer = new ArcsLayer(airports);

  // Tap dispatchers — React registers handlers via setXxxTapHandler.
  let collectibleTapHandler: (id: string) => void = () => undefined;
  let airportTapHandler: (airport: Airport, screen: { x: number; y: number }) => void = () => undefined;

  const pinsLayer: AirportPinsLayer = createAirportPins(
    airports,
    app.renderer,
    new Set<number>(),
    0x5ac8fa,
    (airport, screen) => airportTapHandler(airport, screen),
  );
  const collectiblesLayer = new CollectiblesLayer(app.renderer, (id) => collectibleTapHandler(id));

  app.stage.eventMode = 'static';
  root.addChild(basemap);
  root.addChild(ambient.container);
  // Day/night sits above country fills so the sunlit wash tints the
  // landmass, but below clouds + pins so legibility is preserved.
  root.addChild(dayNight.container);
  root.addChild(countries.container);
  root.addChild(clouds.container);
  root.addChild(hubPulses.container);
  root.addChild(arcsLayer.container);
  root.addChild(ripples.container);
  root.addChild(pinsLayer.container);
  root.addChild(collectiblesLayer.container);
  // eslint-disable-next-line no-console
  console.info('[skyhaven] WorldStage layers ready', {
    airports: airports.length,
    cameraScale: camera.state.scale.toFixed(3),
    cameraTxTy: [camera.state.tx.toFixed(0), camera.state.ty.toFixed(0)],
  });

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
  let downX = 0;
  let downY = 0;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;

  const onDown = (e: PointerEvent): void => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
      downX = e.clientX; downY = e.clientY;
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
      // Empty-water ripple: only fires if the gesture was a stationary
      // tap (≤ 6 px total movement). Interactive elements (pins, arcs,
      // collectibles) absorb the pointertap before this canvas-level
      // up event in normal cases — but if they do propagate, a small
      // ripple at the same spot reads as welcoming, not noisy.
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      if (Math.hypot(dx, dy) <= 6) {
        const rect = app.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldX = camera.state.tx + screenX / camera.state.scale;
        const worldY = camera.state.ty + screenY / camera.state.scale;
        ripples.spawn(worldX, worldY);
      } else if (!REDUCED_MOTION) {
        camera.flick(dragVx, dragVy);
      }
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
      arcsLayer.tick(dtMs);
      ambient.tick(dtMs);
      hubPulses.tick(dtMs);
      ripples.tick(dtMs);
    }
    // Day-night repaint runs even with reduced motion (slow update,
    // no perceptible animation), so the sunlit-side wash stays
    // correct as the device clock ticks past noon.
    dayNight.tick(dtMs);
    collectiblesLayer.tick(dtMs);
    pinsLayer.tick(camera.state.scale);
    applyCamera();
  };
  app.ticker.add(onTick);

  applyCamera();

  let tailColorNum = 0x5ac8fa;
  let unlockedRegions: ReadonlySet<number> = new Set<number>();
  let hubIatas: readonly string[] = [];
  function refreshPinRegions(): void {
    pinsLayer.setUnlockedRegions(unlockedRegions, tailColorNum);
  }
  function refreshHubPulses(): void {
    hubPulses.setHubs(hubIatas, tailColorNum);
  }

  return {
    app,
    fps: () => app.ticker.FPS,
    setRoutes: (routes) => arcsLayer.setRoutes(routes),
    setTailColor: (hex) => {
      arcsLayer.setTailColor(hex);
      const n = parseInt(hex.replace('#', ''), 16);
      if (Number.isFinite(n)) {
        tailColorNum = n;
        refreshPinRegions();
        refreshHubPulses();
      }
    },
    setHubs: (iatas) => {
      hubIatas = iatas;
      refreshHubPulses();
    },
    setCollectibles: (items) => collectiblesLayer.setCollectibles(items),
    setCollectibleTapHandler: (fn) => { collectibleTapHandler = fn; },
    setUnlockedRegions: (regions) => {
      unlockedRegions = regions;
      refreshPinRegions();
      countries.setUnlockedRegions(regions);
    },
    zoomToRegion: (regionId, scale = 1.6) => {
      const region = getRegion(regionId);
      if (!region) return;
      const { x, y } = lonLatToWorld(region.centerLon, region.centerLat);
      camera.centerOn(x, y, scale);
      applyCamera();
    },
    setAirportTapHandler: (fn) => { airportTapHandler = fn; },
    setRouteTapHandler: (fn) => arcsLayer.setTapHandler(fn),
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
      collectiblesLayer.destroy();
      pinsLayer.destroy();
      countries.destroy();
      ambient.destroy();
      dayNight.destroy();
      hubPulses.destroy();
      ripples.destroy();
      app.destroy(true, { children: true, texture: true });
    },
  };
}
