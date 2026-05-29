# Audio assets

Drop your sound files here. Filenames must match the slot ids **exactly**,
all lowercase, `.wav` extension. The loader/manifest keys off these names,
so overwriting a file (same name) swaps the sound with zero code changes.

> **Placeholder note:** every slot is now filled and wired. Seven of them
> (`event_positive`, `event_negative`, `event_end`, `fuel_low`,
> `fuel_critical`, `collectible_spawn`, and `music/splash_sting`) are
> **synthesized placeholders** generated to match each cue's intended
> character. Replace any of them with a bespoke recording by overwriting
> the file in place.

## Format
- **Masters:** WAV, 48 kHz, 24-bit (uncompressed). Transcoding to web formats
  is done in the build/wiring step — do not pre-compress.
- **Channels:** SFX = **mono**. Music & ambience = **stereo**.
- **Headroom:** peaks ≤ −3 dBFS, no clipping.
- **Leading silence:** trimmed to zero (instant trigger). Short natural tail OK.
- **Loops (🔁):** seamless — sample-accurate loop point, zero-crossing, no
  boundary fade.

---

## `sfx/` — one-shots, mono

### Core UI
- [ ] `ui_tick.wav` — tab switch / toggle / minor selection / dismiss (≤ 80 ms)
- [ ] `ui_confirm.wav` — buy / sign / open / panel open / modal confirm (≤ 200 ms)
- [ ] `ui_error.wav` — failed / blocked / disabled / insufficient funds (≤ 250 ms)

### Rewards & cash
- [ ] `claim_coin.wav` — daily-mission claim, collectible claim (≤ 400 ms)
- [ ] `reward_login.wav` — daily login reward reveal (≤ 600 ms)
- [ ] `cash_tick.wav` — rapid counter blip; very short & quiet (≤ 60 ms)

### Celebrations & milestones
- [ ] `achievement_unlock.wav` — achievement toast (≤ 1.2 s)
- [ ] `tier_unlock.wav` — new aircraft tier hero moment (≤ 2.0 s)
- [ ] `region_unlock.wav` — new region hero moment, distinct from tier (≤ 2.0 s)
- [ ] `vintage_award.wav` — vintage/classic award; rarest timbre (≤ 2.0 s)
- [ ] `offline_welcome.wav` — "welcome back" offline modal entry (≤ 1.5 s)

### Aircraft & operations
- [ ] `aircraft_delivery.wav` — new aircraft arrives (≤ 1.5 s)
- [ ] `takeoff_whoosh.wav` — first-takeoff cinematic / departure (≤ 1.5 s)
- [ ] `repair_complete.wav` — aircraft repaired (≤ 500 ms)
- [ ] `upgrade_complete.wav` — upgrade applied (≤ 600 ms)
- [ ] `route_open.wav` — new route opened (≤ 500 ms)
- [ ] `route_close.wav` — route closed, soft descending (≤ 400 ms)
- [ ] `manager_hire.wav` — manager hired (≤ 800 ms)
- [ ] `hub_created.wav` — airport promoted to hub; ceremonial (≤ 1.8 s)
- [ ] `hub_upgraded.wav` — hub level up (≤ 700 ms)
- [ ] `fuel_contract_sign.wav` — contract toast appears (≤ 400 ms)
- [ ] `fuel_contract_stamp.wav` — contract "stamp" beat (≤ 600 ms)

### Alerts & live events
- [ ] `event_positive.wav` — Tourism Boom / Holiday Rush announced (≤ 1.5 s)
- [ ] `event_negative.wav` — Fuel Price Spike announced (≤ 1.5 s)
- [ ] `event_end.wav` — event expires / resolves (≤ 1.0 s)
- [ ] `fuel_low.wav` — fuel reserve crosses low threshold (≤ 800 ms)
- [ ] `fuel_critical.wav` — fuel empty / starvation; more insistent (≤ 1.0 s)
- [ ] `collectible_spawn.wav` — collectible appears on world map (≤ 500 ms)

---

## `music/` — stereo

- [ ] `music_theme.wav` 🔁 — background music bed, 60–120 s, seamless loop
- [ ] `ambience_airport.wav` 🔁 — low airport ambience bed, 30–60 s, seamless loop
- [ ] `splash_sting.wav` — intro / "Living Airport" startup sting, one-shot (≤ 3 s)

Defaults (when wired): **music ON**, SFX ON. `prefers-reduced-motion` auto-mutes.
