# One-door prototype verification — 2026-10-25

## Current H4 checkpoint — seven tension gimmicks (rebuild)

Scope: user instruction to implement all seven gimmicks with the H3 asset pack, keep the slow door-opening tension, verify real mouse play and threat collisions; mid-task the user allowed a full rebuild with completeness first. Design: three independent designs, two judges, one synthesis (fairness-first base with grafts). Implementation: deterministic rules model `dist/horror/night.js` + `tuning.js` (all values provisional), `contours.js` (generated from the WAVs), `captions.js` (Korean text + sound/visual twins), `sound.js`, `game.js`. H2 hand constants unchanged; two flagged variants (C3 holds the door at 0.45; F2 hand does not pry).

| H4 check | Result | Evidence / limits |
|---|---|---|
| Parse + contours | PASS | `npm run check` 14 JS files; `npm run contours` — masking judgement contours regenerate byte-identical from the WAVs |
| Rules + regressions | PASS | `npm test`: 135 tests (124 H4: units per gimmick, H2 parity incl. 21-force sweep, 2000-run seeded collision fuzz with invariants, dark/lit ideal bots, 0.35 s-reaction bot clears and 1.2 s bot fails, failure-policy sweeps, pause freeze, canonical checkpoints, twins coverage; 10 old 2D + 1 PCM) |
| Real mouse, full night (desktop 1280×800) | PASS | `scripts/play-mouse.cjs`: Edge via CDP trusted input — held left drags streamed per frame, right-button chords (look down while gripping), clicks for turn/switch/slipper, slow vertical bolt drags; win reached at ~190 s; dark route |
| Real mouse, lit route / narrow 390×844 / muted | PASS | lit-switch route win; narrow full-night win; muted full-night win |
| Every failure cause by real input + retry + restart | PASS | noise (C1), eyes (C4), hand (C3), strain (C3), mimic (C5), drawer (C6a), forced (C6b): distinct ending each; 「이 장면부터 다시」 restores the chapter checkpoint with attention ≤ 0.30; 「처음부터」 resets to the latched door |
| Esc pause during each threat | PASS | C3, C4, C5, C6a, C6b, F1, F2: simulation snapshot frozen for 1 s, AudioContext suspended, pause layer shown, resume with rate-limited grace |
| Masking judgement = played gain | PASS | per-100 ms probe of the real GainNodes: steady error ≤ 0.012 (bound 0.02), offset ≤ 51 ms (bound 60 ms); during 0.3 s duck ramps the node trails by about one frame (≤ 0.033, reported separately); samples within 80 ms of a clamped frame are re-locked by design and excluded |
| No covered controls | PASS | every enabled control was topmost at its centre throughout every run (found and fixed: the 「시선 ↓」 toggle covered the slipper on narrow screens) |
| Independent review | PASS after fixes | 3 read-only reviewers + adversarial verifiers: 38 confirmed findings (1 P0, 11 P1, rest P2), all fixed or decided; test-writer agent's 11 findings fixed or decided |
| Asset provenance | PASS | 9 runtime WebPs derived from pack PNGs (hash-checked against the pack manifest), 18 WAVs byte-identical; `docs/horror-assets.json`, `scripts/prepare-h4-assets.py` |
| Fear, pacing, mouse feel, mix, HUD balance | UNVERIFIED | human review required |
| Physical mouse / trackpad / Mac ctrl-click / real phone / Safari | UNVERIFIED | CDP trusted input exercises the browser's real pointer pipeline, not a physical device |

### Threat collisions (where two demands meet)

| Pair | Occurs | Verified by |
|---|---|---|
| G1 masks × G4 switch (C2), × G6 mimic (C5), × G3 eyes (F1), × G2 latch (F3) | yes | real-mouse wins (cover-aware moves); unit tests: masks never cover slam, rattle, light leak, eyes, strain, pinch, drawer or enemy force |
| G3 eyes × gripping the handle (C4 chord) | yes | real right+left chord in every win; chorded presses routed explicitly (browsers send no pointerdown for them — found by the real-mouse run) |
| G5 wedge × G7 drawer (C6c) | yes | real-mouse wins; worst-case timeline unit test |
| G2 latch × G4 light (F3) | yes | dark and lit wins; seat limit 0.30 dark / 0.50 lit |
| G3 eyes × G7 turn, G2 × G3/G5/G6/G7/H2, G5 × H2, G6 × G7 | never | fuzz invariants every frame (eyes never with an open drawer, never gaze-down while turned, bolt only with no hand / wedge at rest / door ≤ 0.03, no masks in C6) |
| Warning knocks × any threat | yes | warnings ask only for silence; every threat response is silent |
| Pause / blur × any threat | yes | pause checks above |

### Fixes found by verification (selected)

- Real mouse: a left press made while the right button is held (looking down) produced no grab → chorded pointer transitions routed; gaze made level-triggered so a press during a turn is applied once possible.
- Narrow screens: gaze toggle covered the slipper; HUD covered the handle (look-down) and latch (finale); switch hit area was offset.
- Rules: P0 softlock when re-seating the bolt; C5 dead state above the bait ceiling; closing before the light check skipped the eyes chapter; frame-rate-dependent thresholds (now fixed 1/120 s steps); bolt rattle cooldown exploit; a long flick chaining four slams; light leak never sounding warnings; masks lingering into the drawer chapter.

Captures (ignored): `.impeccable/review/h4/` per beat for desktop/lit/narrow/failures, `.impeccable/review/h4/review/` eyes, fingers and drawer. `?cp=` starts were used only for captures and debugging, never as PASS evidence. Local server: `http://127.0.0.1:5174/horror/` (`.claude/launch.json`, not committed). No push or deployment.

## Historical H2 checkpoint

### H2 — force resistance and sound

User verdict on H1: fear and instant-slam tension FAIL; slow-opening tension positive. User explicitly selected force resistance. H1's instant-close rule is superseded; its older evidence below describes the earlier checkpoint only.

| H2 check | Result | Evidence / limits |
|---|---|---|
| Updated rules + old regressions | PASS | 21 tests: 10 old-game tests, 10 current horror-rule tests, 1 PCM-envelope test |
| Parse | PASS | 11 JS files including `sound.js` |
| Nontrivial resistance | PASS | One jump/instant close blocked; sweep of 21 fixed force policies cannot win; max force loses through noise; low force opens gap |
| Feasible two-encounter trace | PASS | Deterministic solver and actual IAB entry → mouse open/stop → UI arrow-key force changes → both two-push grips → success |
| Real UI input fidelity | PASS | No model mutation/mock for browser claims. Mouse opens, stops and attempts instant closure; supported real keyboard events vary force. Full continuous held-mouse play is a separate UNVERIFIED item below |
| Fast-close workaround | PASS | Native mouse rightward close attempt followed by release leads to hand loss, not instant win; `quick-close-loss.png` |
| Excess-force loss | PASS | UI maximum force → distinct strain loss; `strain-loss.png` |
| Pause and force reset | PASS | Actual Esc during grip → pause → resume; simulation tests assert force cleared and regrab grace |
| Narrow layout | PASS | 390×844 viewport, real drag entry + UI force sequence clears first hand; no horizontal overflow |
| Audio output path | PASS | Real game starts AudioContext/loops and event voices; browser error/warning log empty. Pure PCM test checks bounded impact/body/tail at 44.1/48kHz. This does not certify perceptual audio quality |
| Image provenance | PASS | Four local raster prompts embedded; grip sprite genuine RGBA alpha; four-raster scan clean |
| Independent finish review | PASS | Code + six final captures; no material issue after loss-tail and retreat-cue corrections; ship local prototype checkpoint |
| Continuous physical mouse resistance, human fear/feel/audio mix | UNVERIFIED | Browser automation exposes discrete drags and keys, not a sustained mouse-down/move primitive. Full browser success used real arrow keys for force, not a continuous physical mouse trace. User replay required for feel and perceptual judgment |

H2 captures are local ignored files under `.impeccable/review/h2/`: `first-grip.png`, `combined-grip.png`, `success.png`, `strain-loss.png`, `mobile-intro.png`, `mobile-grip.png`, `quick-close-loss.png`, `ready.png`.

One detector pass produced 69 findings, predominantly sparse H1 DESIGN tokens and overridden H1 CSS declarations, plus 11px supporting text. Current interaction/readability was reviewed at rendered sizes. No whole-project style drift repair or second audit was added. `detector.json` retains the actual output.

Corrections from review: let the 1.4s loss breath decay naturally behind the result screen, and change the automatic retreat cue so it does not imply further effort is required. Body-level motion suppression preserves essential door movement while removing decorative camera shake. User sensory acceptance is still separate.

Local-only preview stays on port 5174. No push, deployment, new rooms, third threat or full-game expansion.

## Historical H1 evidence

Scope: H1, local first-person prototype at `/horror/`; baseline `dbc42f4`. User experience acceptance and release approval are separate from these checks.

## Evidence

| Check | Result | Evidence |
|---|---|---|
| JavaScript parse | PASS | `scripts/check.cjs`: 10 JS files, including the new view and rules |
| Rules and old-game regressions | PASS | Node test runner: 16 tests (10 existing, 6 new), 0 failures |
| Mouse path from real entry | PASS | IAB local route, click start; actual handle drags; first knock stop; first hand closure; second knock/hand closure; successful ending. Repeated after viewport-layout change as the new basis |
| Combined fairness | PASS | Deterministic test and real mouse completion; necessary slam does not count as knock violation |
| Knock failure and recovery | PASS | Real mouse movement during knock; distinct loss; retry restored closed door and initial instructions |
| Hand failure | PASS | Actual opening, visible hand, waited beyond deadline; distinct hand loss |
| Pause/resume | PASS | Actual Esc during first knock, waited while paused, resumed into the same warning; model test freezes hand deadline and releases hold |
| Mute + visual signals | PASS | Actual mute toggle, visible knock marks, location, subtitle and action text during play |
| Narrow-screen layout/input | PASS | 390 × 844 browser viewport: no horizontal overflow, visible cues/handle; real mouse drag, pause, loss and restart. This is viewport emulation, not phone hardware |
| Final asset provenance | PASS | Embedded exact built-in image-generation prompts; scan: 3 rasters, 0 missing |
| Independent finish review | PASS | Read-only reviewer inspected implementation and 7 final screenshot states; no material finding; ship local prototype for human review |
| Fear, pacing, audio mix and visual acceptance | UNVERIFIED | Requires user's actual experience; no claim of sensory acceptance |
| Actual phone / Safari | UNVERIFIED | Not run; not a mobile-release checkpoint |
| Deployment | UNVERIFIED | Not requested or performed |

## Local evidence files

Ignored `.impeccable/review/`: `desktop.png`, `desktop-hand.png`, `combined.png`, `success.png`, `mobile.png`, `mobile-play.png`, `mobile-knock.png`, `mobile-hand.png`, `knock-loss.png`, `hand-loss.png`. Images are actual browser captures. `first-hand-before-layout.png` is an earlier capture, not final layout evidence.

## Fixes during verification

- Fit the desktop scene and subtitle to the available viewport height.
- Kept narrow-screen artwork cropping, handle coordinates and drag travel in the same coordinate mapping.
- Reset pause button copy on restart.
- Increased narrow-screen functional text size, darkened paper helper text and removed colored warning glow after the one mechanical detector pass.
- Detector warnings for earlier minified CSS declarations are superseded by the final cascade; visual reviewer inspected final rendered text. Detector was not rerun as an extra audit.

## Review and limits

Independent code pass: no material state/fairness defect found. Final screenshot disposition: ship local prototype. Minor footer link wraps one syllable at 390px; optional backlog, does not obscure play. Intended review/documenter model gpt-6-sol / medium was passed via supported schema; actual execution settings metadata remains UNVERIFIED. Documentation was returned read-only and integrated by the single writer.

## Running and stopping

User-facing local preview for this session: `http://127.0.0.1:5174/horror/`. The default `npm start` port is 5173. The sandbox-only initial server was stopped; the local-only 5174 preview was retained for the user's playtest. No remote push or deployment. Viewport override was reset after narrow-screen QA. The finite H1 implementation/checkpoint ends here; awaiting human feel feedback does not authorize full-game expansion.
