# SkyHaven Design Review v2 — 25-Point Execution Plan

This document tracks the 25-point design review and the concrete
plan + execution status for each. Every commit on this branch
addresses one or more points. Backups of the original Modal.tsx and
SvgAircraft.tsx live in `docs/design-backups/`.

The over-arching shift: from **"route-management UI"** to
**"airport tycoon where a tiny terminal becomes a global empire."**

## Top-priority axis (per owner)

1. Make the **airport visible and alive**.
2. Make the **first 30 seconds exciting** (cinematic onboarding).
3. **Visible cause and effect** for every player action.
4. Make **aircraft buying / ownership** feel aspirational.
5. **Simplify early onboarding** (progressive system reveal).
6. **Rewrite missions + achievements** as aviation milestones.
7. **Active map** (floating revenue, hub volume pulses, glow).
8. **Progression fantasy** — clear empire roadmap.

---

## The 25 points

### 1. Weak opening
- **Fix:** Cinematic first-takeoff sequence (CinematicTakeoff component): empty regional airport, "Begin Boarding" tap → passengers walk to gate → push-back → takeoff arc → revenue burst → "Welcome to your aviation empire" message.
- **Status:** ships in Phase X3.

### 2. Airport fantasy under-used
- **Fix:** New `AirportPanel` (Home) — visible terminal with gates, runway, tower, lounge, baggage, ground vehicles. Visuals upgrade with tier so the airport physically grows.
- **Status:** ships in Phase X4.

### 3. Dark / dense UI, no hierarchy
- **Fix:** Use D1 design tokens for three-tier hierarchy (primary CTA > stats > details). Larger primary numbers, stronger contrast on revenue / status. Aviation-flavoured surfaces (departure board, boarding pass) for hero cards.
- **Status:** distributed across Phases X4–X8.

### 4. Too much text, too little emotion
- **Fix:** Action juice — buy plane = hangar doors, open route = glowing arc + first departure, repair = "Ready for Service" stamp, claim = cash burst. Short copy on success: "Route Launched", "Fleet Ready", "Terminal Expanded".
- **Status:** distributed; major lift in Phase X5 (delivery animation) and Phase X9 (action-juice toasts).

### 5. Static map
- **Fix:** Floating revenue ticks at airport endpoints, hub volume pulses scaled to traffic, top-earning routes glow gold, idle routes pulse soft red. Aircraft pin pulses on takeoff / landing.
- **Status:** ships in Phase X6.

### 6. Planes feel like liabilities
- **Fix:** Aircraft as collectibles. Nickname, role tag, rarity badge, milestone pin ("1M passengers carried"). FleetPanel rows show aircraft hero illustration + role tag; AircraftDetailModal (D1) already shows hero — extending with role nickname + milestone count.
- **Status:** ships in Phase X5.

### 7. Unclear progression
- **Fix:** "Next Big Unlock" widget pinned in the world view, listing tier → label → reward. Tier-unlock cinematic upgraded to show the era you're entering.
- **Status:** ships in Phase X8.

### 8. CEO office is bland
- **Fix:** Strategic HQ feel — advisor cards, "Approve / Defer" board decisions, ambient office BG with skyline through the window. Cloud Save + Friends move to a new Settings panel.
- **Status:** ships in Phase X8.

### 9. Generic tabs
- **Fix:** Rename: Map → **Network**, Routes → **Operations**, Fleet → **Hangar**, Crew → **Staff HQ**, Leaders → **Control Tower**, Store → **Executive Deals**. Icons stay SVG (no emoji per the UI/UX skill).
- **Status:** ships in Phase X2.

### 10. Boring missions
- **Fix:** Rewrite mission templates as airport ops: "Clear the morning rush", "Serve 5 000 passengers", "Launch GCC route", "Survive fuel spike", "Hold delays < 10 %".
- **Status:** ships in Phase X7.

### 11. Generic achievements
- **Fix:** Rewrite achievement copy: "First Wheels Up", "Regional Backbone", "Hub Builder", "Million Passenger Club", "Red-Eye Operator", "Storm Survivor", "Long-Haul Pioneer", "Sky Alliance Founder". Stale "Solo Cleared" / "Goal Sheet Clean" replaced.
- **Status:** ships in Phase X2.

### 12. Route mode toggles unclear
- **Fix:** Each pricing mode gets a trade-off line + passenger-mix dots + "best aircraft fit" tag. Route personality chips: Business / Tourism / Cargo / Seasonal / Pilgrimage / Luxury.
- **Status:** ships in Phase X6.

### 13. Buy screen is a catalog
- **Fix:** Hangar Showroom — large aircraft illustration, "Why buy this?" tags (best for short routes / low fuel burn / etc.), delivery toast on purchase.
- **Status:** ships in Phase X5.

### 14. No visible cause & effect
- **Fix:** Visible-consequence pass — terminal grows with hub upgrade, runway visible when capacity upgrades, lounge appears on premium unlock. Implemented via the AirportPanel.
- **Status:** ships in Phase X4.

### 15. Fuel-price spike feels weak
- **Fix:** Event response modal: "Absorb", "Raise fares", "Ground inefficient", "Negotiate". Countdown + post-event summary "Saved $120K by switching aircraft".
- **Status:** ships in Phase X9.

### 16. Icons too sterile
- **Fix:** Aviation-native icon set — boarding pass for routes, radar for map, luggage tag for rewards, departure board for missions, control-tower alert for events. SVG components in `ui/design/icons/`.
- **Status:** ships in Phase X2.

### 17. Typography too small
- **Fix:** Mobile-first pass — primary metric +40% size, secondary collapses behind tap. Every card answers "what / good or bad / next".
- **Status:** ships in Phase X2 (token tuning) + X4 (panel applications).

### 18. Economy numbers not satisfying
- **Fix:** Revenue ticks float from route endpoints on completion ("+$12 500 LHR → CDG"); top-bar cash counter pulses gold on big tick.
- **Status:** ships in Phase X6.

### 19. Awkward labels / copy
- **Fix:** Copy polish pass — single tone-of-voice doc applied to achievements, missions, hero moments, share card, Office, Settings. No "Solo Cleared", "Goal Sheet Clean".
- **Status:** ships in Phase X2 (alongside renames).

### 20. Tier-3 unlock too quiet
- **Fix:** Extend HeroMoments tier-unlock — airport-runway-lights animation, aircraft flyover from off-screen, animated stamp "Tier 3: International Operator". Show: new aircraft class + free action.
- **Status:** ships in Phase X9.

### 21. Too many systems too early
- **Fix:** Progressive system reveal. First 3 min: only Network + Operations + a single starting aircraft + first revenue. Hangar unlocks at first route, Staff HQ at first hub, Control Tower + Executive Deals at tier 3. Hidden bottom-tab badges show what's gated.
- **Status:** ships in Phase X10.

### 22. Doesn't look idle enough
- **Fix:** Idle watch mode — continuous map activity (already partial via Pass D4 hub pulses). Add boarding progress over hub icons, passenger flow dots into terminal, gate turnaround indicators.
- **Status:** distributed in Phase X4 (airport panel) and X6 (map).

### 23. Doesn't look tycoon enough
- **Fix:** Physical airport expansion as backbone. AirportPanel illustrates the home airport at the player's current tier; upgrades visibly add gates / runway / tower / lounge.
- **Status:** ships in Phase X4.

### 24. Store too generic
- **Fix:** Reskin Store → **Executive Deals**: premium liveries, historic aircraft, lounge skins, terminal themes, route expansion bundles, event passes, advisor cards. Skin is up; real IAP catalogue is Phase 15 ground-truth.
- **Status:** ships in Phase X2 (rename + landing copy).

### 25. Weak brand identity
- **Fix:** New signature promise: "Build the world's most beautiful airport empire." IntroSplash updated. New `BrandMark` showing airport silhouette + globe + route arcs.
- **Status:** ships in Phase X3.

---

## Execution phases

| Phase | Scope | Closes |
|---|---|---|
| X1 (this commit) | Backups + this plan doc | Foundation |
| X2 | Tab renames, achievement + mission copy rewrite, brand wordmark | 9, 11, 19, 24 |
| X3 | Cinematic first-takeoff onboarding + signature brand splash | 1, 25 |
| X4 | AirportPanel (home airport with visible growing terminal) | 2, 14, 22, 23 |
| X5 | Hangar Showroom + role/nickname/milestone on aircraft cards | 6, 13 |
| X6 | Map polish — floating revenue, hub volume pulses, performance glow, route personality | 5, 7, 12, 18 |
| X7 | Mission rewrite (airport ops themes) | 10 |
| X8 | CEO Office redesign as strategic HQ + new Settings panel | 8, 17 |
| X9 | Tier-unlock cinematic upgrade + event-drama response modal | 15, 20 |
| X10 | Progressive system reveal + Next-Unlock widget + save-data reset | 21, 7 |

Every commit keeps tests green. Final commit (X10) wipes the local
save key so a fresh install starts from the new onboarding moment.
