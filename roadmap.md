# AUTOMECH / Torque Lab roadmap

## Current request (Nov 2026)
- [x] Fix existing bugs: save validator (two-arg z.record), contract unlock order/consistency, unsolvable contracts + failing tests, default graphics tier
- [ ] Every existing button works; sound effects on all actions
- [x] Drag strip: 2D side-view straight track, rival ghost behind a wall, Christmas tree, launch, manual shifting with tachometer, 1/4 · 1/2 · 1 mile
- [x] Rival ghosts at several difficulty levels; races in career mode with correct rewards
- [x] Street Rival onboarding (beat the first rival, then unlock the full workshop)
- [x] Units setting: imperial (mph, lb-ft, °F, ft) or metric
- [x] Body kits: aero kit, wide body, spoilers/wings, splitter — drag, downforce, grip and mass effects; visible on the car
- [x] 3D FX: exhaust flames, glowing exhaust-side metal, tyre smoke, launch squat, camera shake and shift light
- [x] CrazyGames rewarded ads (+cash, double purse) and touch controls; custom fullscreen is disabled on portal builds for compliance

# AUTOMECH roadmap

## Prototype 0.1 (done)
- [x] 3D workshop with original procedural sports coupe, opening bonnet, chassis dyno rollers
- [x] Clickable modular engine bay (intake, cams, turbo, intercooler, injectors, exhaust, ECU) with camera focus
- [x] Deterministic engine sim: VE, boost/spool/choke, charge temp, BMEP, torque, power, AFR, EGT, knock, thermal load, reliability
- [x] Live Dyno Lab with power/torque, boost, AFR, EGT curves, previous-run comparison and diagnostics
- [x] ECU calibration (boost, AFR, ignition, rev limit) gated by ECU hardware
- [x] 5 data-driven challenges with Bronze/Silver/Gold grading and credit rewards
- [x] Credits economy (buy / sell at 60%), part unlocks, local save
- [x] Simulation, challenge and economy tests

## Prototype 0.2 (in progress)
- [x] New engine systems: fuel (RON 95/98/race/E85), pistons & rods (compression, BMEP limit), cooling (radiators)
- [x] Extra parts in existing slots (VVT cams, twin-scroll turbo, tubular manifold, chargecooler, 1300cc)
- [x] Two new contracts using the new systems
- [x] Paint Shop screen: paint colour (presets + custom) and finish, wheel style/colour, calipers, stripes, window tint (saved)
- [x] Graphics: bloom/vignette on High, quality setting (High/Medium/Low), sound mute + volume
- [x] Synthesised engine/turbo sound on dyno runs, mute toggle; exhaust pops at limiter
- [x] Wheel-hp estimate in dyno report
- [x] Bug fixes: abort during limiter hold still recorded run, stuck hover after part swap
- [x] Save v1 -> v2 migration + tests

## Prototype 0.3: simulation overhaul (done)
- [x] Combustion energy from delivered fuel mass x fuel LHV; evaporative charge cooling from latent heat
- [x] Lambda-based tune and readouts across RON 95/98, race fuel and E85 (save v3 migrates AFR saves)
- [x] Compressor efficiency map (island, surge, choke) and ε-NTU intercooler with density-corrected pressure drop
- [x] Diagnostics explain cause and suggest fixes

## Prototype 0.4: Priority 2 drivetrain (done)
- [x] Gearbox slot: manual, sequential, dual-clutch, automatic (gear count, ratios, efficiency, torque capacity, shift time, weight)
- [x] Adjustable individual gear ratios and final drive
- [x] Clutch (capacity, slip) and differential (open, clutch LSD, helical LSD, ratios)
- [x] FWD / RWD / AWD layouts with traction and loss consequences
- [x] Drivetrain tab: per-gear ratio sliders, final drive, speed-vs-RPM and tractive-force charts, per-gear table, track test with live playback and grading
- [x] Drivetrain contracts + client style briefs (bonus credits)
- [x] UI click / installation / buy / sell / paint / bonnet / grade sound effects (own on/off switch)
- [x] Engine sound reflects every modification (dyno, track test with gear shifts, Start engine rev demo)
- [x] Career screen: chapters, style briefs with live match checks, time/speed targets

## Next (from the development plan)
- [ ] Additional vehicle chassis and authored visual/audio assets
- [ ] Aerodynamics model and wind tunnel
- [ ] Additional research progression

## Rivals round (Nov 2026)
- [x] Rival car easier to see, closer track view, crowd removed
- [x] 15 rated rivals (1-99); free run lets players pick any of them
- [x] Part weights, launch control, flat-shift, clutch bite and wheel weight affect races
- [x] Rivals show their own body kits; ghosts and auto-shift no longer shift into 2nd off the line

## Prototype 0.5: full career + graphics (in progress)
- [x] 50 contracts in 5 chapters, new goal types (cheapest build, coolest exhaust, 0-200, wheel power, power cap)
- [x] Calibrate all 50 contract targets and verify a valid, unlocked known solution for each in game.test.ts
- [x] Ultra graphics tier: reflective floor, ambient occlusion, SMAA, adaptive resolution, richer workshop
- [ ] Verify the sculpted car body in a screenshot

## Platform integration (in progress)
- [x] Shared adapters for browser/dev, CrazyGames, Poki and Playgama
- [x] Separate browser, CrazyGames, Poki and Playgama build modes
- [x] Route save data through platform storage with browser fallback
- [x] Report ready/gameplay lifecycle events and pause gameplay/audio on interruptions
- [x] Only pay rewarded-ad credits when a supported portal reports a completed ad
- [ ] Validate SDK injection, ad callbacks and storage in each hosted portal preview
- [ ] Confirm the Poki deal type before multi-portal distribution
