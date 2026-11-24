<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## AUTOMECH architecture

- Simulation lives in `src/game/sim/` as pure TypeScript (no React, no three.js); the dyno, workshop, career grading and 3D scene all read `simulate()` so they can never disagree.
- Parts and challenges are data (`sim/parts.ts`, `sim/challenges.ts`); add content as entries, not new code paths. Parts carry physical attributes, never flat horsepower bonuses.
- `simulate()` must stay deterministic (no randomness, no time); challenge grading recomputes from the saved build+tune key instead of storing results.
- Challenge thresholds are tuned against `sim/game.test.ts` known solutions; after changing the engine model, re-run the tests and keep every challenge solvable with parts unlocked at that point.
- Per-frame dyno telemetry flows through the mutable `src/game/dynoLive.ts` object read in `useFrame`; React/zustand (`src/game/store.ts`) only holds UI and save state.
- The save is versioned JSON in localStorage (`automech.save.v1`) validated by zod in `sim/economy.ts`; bump `SAVE_VERSION` and migrate when the shape changes.
- The game route renders with `ssr: false` because the whole screen is a WebGL canvas; the scene sets `data-scene-ready` after its first frames for headless checks.
- The coupe and engine bay are procedural (extruded profiles) so the bonnet opens and each component can be swapped and clicked; component meshes are grouped per slot via `SlotGroup` in `scene/EngineBay.tsx`.
- Tunes store a lambda target, never AFR: AFR is derived per fitted fuel (lambda × stoich) so the same calibration means the same mixture on every fuel; combustion energy comes from delivered/burnable fuel mass × the fuel's LHV.
- Every non-info `Diagnostic` must carry `cause` (why, with the measured numbers) and `fixes` (concrete changes); a test enforces this.
- Graphics quality (`settings.quality`, stored apart from the save) gates DPR, shadows and post-processing; with post-processing on, renderer tone mapping is off and ACES runs last in the effect chain after bloom.
- Engine sound is derived from the build by pure `soundProfile(build)` (tested) and voiced by `audio.ts` over the shared context in `audioCore.ts`; UI effects live in `uiSound.ts`. Add sound character as profile fields, never part-id checks inside the synth, so every part change stays audible and testable.
- Rival ghosts and the auto-shift assist share `wantsUpshift()` in `sim/race.ts`, and rival ratings derive from their simulated quarter-mile time, so ghosts, ratings and the assist always agree with the physics.
