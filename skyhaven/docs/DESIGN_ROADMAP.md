# SkyHaven Design Roadmap — 10 Passes to Wow

A staged plan to go from a working game with stock-React UI to a deeply
polished, game-vibe experience. Each pass builds on what's already
delivered; pass N is meant to make the screen-recording reaction
audibly louder than pass N-1.

Reference style direction: dark glassmorphic HUD with vivid neon
accents, parallax depth, 3D-feeling surfaces, particle ambient layer,
satisfying micro-interactions (visual + sound + haptic triads).
Benchmarks: Idle Miner Tycoon, Pocket Planes, Idle Airlines, Adventure
Capitalist, Township.

Anti-patterns (per the UI/UX Pro Max skill checklist + our own taste):
- No emoji as icons (SVG / programmatic only)
- No instant snap transitions (motion always has easing + a window)
- No flat panel-on-flat-bg layouts (depth, parallax, shadows)
- No text-only buttons (icon + label + state)
- No silent state changes (every state change has visible + tactile
  feedback)

---

## Pass D1 — Foundation (THIS COMMIT)

Establish the design language everything else uses.

- **Design tokens** (`ui/design/tokens.ts`): palette, type ramp, spacing
  scale, radius scale, shadow scale, motion tokens (durations + easings),
  z-index scale. Single source of truth.
- **Reusable Modal primitive** (`ui/design/Modal.tsx`): backdrop blur,
  spring-in, scale + slide animation, escape + tap-outside dismiss.
- **Aircraft illustrations** (`ui/design/SvgAircraft.tsx`): 8 tier
  silhouettes + 2 cargo + 1 classic, scaled programmatically, tinted by
  airline tail color. Used in the new Aircraft Detail modal and Fleet
  card hero strip.
- **Aircraft Detail modal** — tap an aircraft in Fleet → cinematic
  modal with hero illustration, stat sheet, upgrade chips. Live with the
  reusable Modal primitive.
- **TopBar HUD polish** — animated cash counter sheen, tier-progress
  ring (replaces the linear bar with a glowing arc), separator gradients,
  built on tokens.
- **Map ambient pass 1** — shooting stars (deterministic spawn,
  parabolic arc), aurora pulse (slow alpha breathing), denser star field
  in known major regions.

## Pass D2 — Buttons & micro-interactions

- Replace every ad-hoc `<button>` with a single Button primitive that
  carries: visual (gradient, glow, shadow), motion (press, hover,
  disabled), and a haptic + sound trigger.
- Variants: primary / secondary / ghost / icon / destructive.
- Long-press support for bulk actions.

## Pass D3 — Tutorial as a guided briefing

- Replace the white card with a glassy "Mission Briefing" frame featuring
  a stylised character/silhouette ("Operations Director").
- Animated arrow pointer that travels from the briefing card to the
  highlighted target.
- Step indicator as a holo bar at the top.
- Voice-over-style typewriter on the briefing copy.

## Pass D4 — Map as the centerpiece

- Day/night terminator (sun position from local time).
- Drifting cloud parallax with wind direction.
- Aircraft contrails (fading trail particles behind in-flight planes).
- "Ambient activity" layer: tiny pulses on busy hub airports.
- Tap empty water → soft ripple expanding from the tap point.
- Subtle camera idle drift (parallax breathing).
- Optional audio bed (low engine hum + ambient wind).

## Pass D5 — Cards & Panels redesign

- Every list row → a hero card with side accent, condition gauge, and
  one-tap context action.
- Panels open as a stack of cards rather than a single sheet (parallax
  on close).
- Section headers use the new typographic system (display + chip
  combo).
- Office identity card becomes a 3D-feeling badge with parallax sheen on
  scroll.

## Pass D6 — Cinematic moments

- New-tier unlock: full-screen sequence — runway lights, take-off
  silhouette, tier number reveal.
- New-region unlock: globe zooms to the region with sparkle burst.
- First-route opening: airplane animation that flies from origin to
  destination across the map with camera follow.

## Pass D7 — Sound design

- Layered ambient bed (~3 stems, cross-fade by altitude/time).
- SFX library: tap, claim, achievement, error, route-open, gift-claim,
  region-unlock, tier-up.
- Settings panel to toggle sound + haptic + reduced motion.

## Pass D8 — Personality

- Auto-generated airline crest from the tail color + airline name
  initials (mini SVG mark).
- Manager portraits (stylised silhouettes by trait).
- Airline-wide statistic dashboard with charts (Sparklines for revenue
  per minute over the last 24h).

## Pass D9 — Edge & rough surfaces sweep

- Empty states designed end-to-end (no "—" anywhere).
- Loading states with skeleton shimmer.
- Error states with retry CTAs that feel intentional, not apologetic.
- Settings/About panel with credits and version info.

## Pass D10 — The Wow Pass

- Onboarding cinematic (8-second logo intro + tagline).
- Hero moments for every milestone (first $1M, first hub, first
  classic, first global event).
- Achievements as a "trophy hall" panel (lit-up shelves, walk-through
  scroll).
- Promotional / shareable airline card export (PNG render of the
  airline identity, ready for screenshot/share).
- Holiday skins (Halloween, winter, etc.) driven by Remote Config.

---

## Working principles

1. **Token-driven.** Pass D1 establishes tokens; every later pass
   composes from them. No hard-coded colours / radii / durations
   anywhere after D1.
2. **Reduced-motion respected.** Every motion has a `prefers-reduced-
   motion` short-circuit.
3. **No regressions.** Each pass keeps the test suite green and the app
   bootable on the spec device.
4. **One commit per pass.** Easy to revert, easy to A/B compare.
5. **Quote-grade detail.** A passing pass is one where every changed
   surface looks intentional, not "default".
