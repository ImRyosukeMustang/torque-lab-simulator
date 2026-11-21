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
- [ ] Visual customisation: bumpers, spoilers with attachment points
- [ ] Aerodynamics model and wind tunnel
- [ ] More platforms, chapters and research points

## Prototype 0.5: full career + graphics (in progress)
- [x] 50 contracts in 5 chapters, new goal types (cheapest build, coolest exhaust, 0-200, wheel power, power cap)
- [ ] Calibrate new contract targets from solver results (/tmp/cal solver) and add a known solution for each to game.test.ts (tests still expect 11 contracts)
- [x] Ultra graphics tier: reflective floor, ambient occlusion, SMAA, adaptive resolution, richer workshop
- [ ] Verify the sculpted car body in a screenshot
