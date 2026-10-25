# Current state

- Writer now: Claude (Opus 5.5) — H4 seven-gimmick integration, claimed 2026-10-25 from clean `ea3072b`; releasing after the H4 commit (see checkpoint note below)
- Current checkpoint H4: PASS for AI implementation and verification — all seven gimmicks integrated into a rebuilt one-door night; human fear/feel review pending (not accepted, not released).
- What exists: `/horror/` is now one night in chapters: P0 unlatch → C1 stiff rail under elevator/traffic cover (G1) → C2 corridor light dies; dark-adapt or switch the light (G4) → C3 glass knocks + H2 hand → C4 eyes, look down and grip (G3) → C5 mimicking fingers (G6) → C6a drawer behind (G7) → C6b slipper wedge (G5) → C6c wedge + drawer → C7 forced pull → F1 eyes under the elevator → F2 last hand → F3 latch between knocks (G2, G4 consequence) → drawer closes behind you. Chapter checkpoints, retry, restart, pause.
- Architecture: `dist/horror/night.js` (deterministic rules, fixed 1/120 s steps), `tuning.js` (every value PROVISIONAL), `contours.js` (generated from the WAVs; masking judged from the same gain the audio plays), `captions.js` (Korean text + sound/visual twins), `sound.js`, `game.js` (camera = SVG viewBox shared by rendering and hit-testing). Old `core.js` and `tests/horror.test.cjs` retired (H2 assertions ported).
- PASS evidence: `npm test` 135/135; real-mouse CDP battery (`npm run play`): desktop win, lit win, narrow 390×844 win, muted win, all 7 failure causes with retry/restart, Esc pause in 7 threat beats, audio probe (gain ≤ 0.012, offset ≤ 51 ms), no covered controls; independent review (38 confirmed findings) fixed. See `docs/horror-qa.md` H4.
- UNVERIFIED: fear, pacing, mouse feel, HUD balance and mix (human); physical mouse/trackpad/Mac/phone/Safari. Real-mouse here means trusted browser input via CDP, not a physical device.
- Open questions for the user (provisional choices, not decisions): HUD vs diegetic balance; right-button look-down and edge turn button; run length (~4 min perfect, 6–8 min typical); flagged H2 variants (C3 holds the door at 0.45, F2 hand does not pry); the one forced pull and the ending sting; lit-finale trade-offs; C5 mimic pacing (real-mouse bot took ~50–60 s).
- Preview: `http://127.0.0.1:5174/horror/` via `.claude/launch.json` (`node scripts/serve.cjs`, PORT 5174; local file, not committed). The earlier Codex-run 5174/5175 servers were found stopped. No push or deployment.
- Recovery: revert the H4 feature commit to return to H3 (`ea3072b`); the asset pack is untouched.

## Task list

| ID | Request | Owner | Status / evidence |
|---|---|---|---|
| H1 | First-person door, knock and hand prototype | root | PASS — `6e7d97b`, `/horror/` |
| H1-QA | Real input, success/fail/restart and old regression | root | PASS — `docs/horror-qa.md` |
| H1-REVIEW | Independent bounded rule/visual review | read-only reviewer | PASS — local checkpoint ready for human review; no material finding |
| H1-HUMAN | Tension, pacing, audio mix and aesthetic judgment | user | FAIL — user reports weak fear and trivial fast closure; slow opening tension was positive |
| H2-SOUND | Make knocks and hand approach more threatening | root | PASS for implementation/output path — simulation-clock impacts, layered wood/body/tail, quiet/approach/grip cues; perceptual quality UNVERIFIED |
| H2-GRIP | User-selected resistance/force control instead of one quick slam | root | PASS for implemented rules and real UI sequence — H1 slam superseded |
| H2-QA | Fairness, input, audio/render and regressions | root | PASS at bounded tested scope — 21 tests, browser UI route, failures, 390px capture, independent review; continuous held-mouse trace UNVERIFIED |
| H2-HUMAN | Fear, force-control mouse feel and perceived audio | user | UNVERIFIED — awaits replay of H2 |
| H3-IMAGE | Nine image assets for seven added gimmicks | root + isolated image producers | PASS — 9 new PNGs + 4 unchanged references, inspected and alpha/dimensions validated |
| H3-SOUND | Eighteen original WAV cues/loops | root | PASS — 48kHz/PCM16/stereo, 42.55s total, 3 loops; perceptual acceptance UNVERIFIED |
| H3-PACK | Manifest, preview, QA, Claude handoff | root | PASS — c316e88, pack/HANDOFF-CLAUDE.md; no game implementation |
| H4-DESIGN | Integrate all seven gimmicks fairly (design) | Claude + design panel (3 designers, 2 judges, synthesis) | PASS — spec chosen: fairness-first base with grafts; all values provisional |
| H4-IMPL | Implement all seven gimmicks with the pack assets, keep slow opening | Claude | PASS — rebuilt rules/view; G1–G7 each taught alone, then paired; H2 constants kept |
| H4-REBUILD | User mid-task: "필요하다면 현재 게임 전부 뜯어고쳐도 됨. 완성도를 최우선으로" | Claude | DONE — full rebuild of `/horror/`; `/2d/` untouched |
| H4-MOUSE | Verify real mouse play | Claude | PASS — CDP trusted-input battery: wins (desktop/lit/narrow/muted), held drags, right+left chords, clicks, bolt drags; physical device UNVERIFIED |
| H4-COLLIDE | Verify threat collisions | Claude + test-writer agent + reviewers | PASS — collision matrix (docs/horror-qa.md), 2000-run fuzz invariants, real-mouse combos, pause during threats |
| H4-REVIEW | Independent review and fixes | 3 reviewers + verifiers | PASS after fixes — 38 confirmed findings fixed or decided |
| H4-HUMAN | Fear, pacing, mouse feel, mix, HUD balance | user | UNVERIFIED — awaits play at /horror/ |

## User decisions

- User: implement the first small 2D first-person prototype, with knock and gap-hand threats.
- Prior six-minute timeline and three-threat proposal remain design proposals, not mandatory content for this prototype.
- Implementation choices/timing/art are provisional and require human experience review.
- H2 user decision (async answer): choose "밀어 버티기" — hand grips and pushes door open; increase force on a push, ease off when noise rises. The alternative wait-then-close rule was not selected.
- H4 user decision (2026-10-25, Claude chat): implement all seven gimmicks with the prepared assets; keep the slow-opening tension; verify real mouse play and threat collisions. Mid-task addition: "필요하다면 현재 게임 전부 뜯어고쳐도 됨. 완성도를 최우선으로 해서 만들어." — full rebuild of the horror game authorized if needed; completeness/quality is the top priority.
- H3 user decision: include all seven newly proposed gimmicks (masking external sound, final latch, avoid eye contact, choose light for information, temporary wedge/retrieval, mimic movement bait, look behind at drawer). User will use Claude for implementation; Codex is authorized ONLY for asset production and handoff preparation. This does not approve arbitrary timings or simultaneous threat combinations.

## H3 finite boundary

- Deliver `asset-packs/door-horror-gimmicks-v1/`: 9 new PNGs (lit front plate, eyes, latch body/bolt, switch body/rocker, slipper wedge, rear room plate/top drawer front), 18 WAVs, dimensions/alpha/anchors/loop metadata, generation/source provenance, asset preview, QA and Korean Claude handoff.
- Protect all `dist/`, existing tests, package scripts, hosting config and prior planning docs. No game code changes, deployment, Claude launch, cross-chat message or runtime integration. Asset-authoring scripts in the pack are allowed; they are not game implementation.
- Sole project writer root. Image producers generate only into the image tool's unique default output paths outside the checkout, return paths/prompts and stop. Root copies selected outputs and owns manifests/docs. Audio is local original procedural Foley (not field recordings or pretrained sound generation).
- Reuse current apartment/door/hand art as style/geometry references. New geometry/props are implementation proposals; exact runtime fit and sensory acceptance remain UNVERIFIED until Claude/user integration review.
- Finish checks: every gimmick mapped to supplied/shared assets; inspect every image, image alpha/dimensions/no clipped required parts; WAV decoding, finite/bounded amplitude and loop boundaries; preview loads assets; provenance and protected-source diff; commit asset checkpoint and release Writer. No open-ended polishing after delivery.
- Dispatch intended gpt-6-sol / medium for bounded image authoring; supported by tool schema. Execution metadata UNVERIFIED. No model default/config changes.

## H2 finite boundary

- Preserve one door, first-person scene and normal slow drag. No new area, threat type, full-game expansion or deployment.
- Replace two instant hand closures with readable approach → grip → telegraphed push/ease cycles → controlled closure. Low force lets the gap grow; indiscriminate maximum force raises noise and loses. There must be a feasible response sequence and no cursor-position exploit.
- Sound: replace pure oscillator knocks with layered impact/wood resonances/room tail; ambience cuts before knocks; hand contact/scrape/pressure sound tracks visible states. Bound volume, respect mute/pause/restart and reduced motion.
- Done when updated rules and meaningful regression tests pass, actual mouse input clears the encounter and failure/restart works, final desktop/narrow captures reviewed, single feature checkpoint committed, tracker released. Human fear/feel remains separate and awaits replay.
- Main remains sole writer because force/input/art contact are one coupled correction to the same deliverable. Parallel read-only rule review improves fairness coverage without write overhead. Intended reviewer gpt-6-sol / medium, explicit schema support; execution metadata UNVERIFIED.

## Checkpoint notes

- Commit initially failed because this clone had no author configuration. Existing repository author identity was confirmed from both source commits and used via command-local `git -c` only; no global or repository identity configuration was persisted.
- Initial sandbox-only server could not be reached by IAB; it was stopped after the local-only unsandboxed 5174 preview was verified. This was a local preview recovery, not public hosting.
- The initial browser wait for the success title ended before the ending's delay completed. Read-back confirmed the successful ending; final resized-layout mouse run also completed to the visible success screen. No game-state mutation or mock was used to claim browser success.
- H2: explicit user choice recorded above; prior H1 completed checks do not imply acceptance of H1 fear. New sound/grip image/force rules committed at `da8d763`; only a tracker checkpoint follows. Browser force sequence was actual supported keyboard input, not a hidden model setter. Continuous held-mouse play, human fear and acoustic judgment remain UNVERIFIED.

- H3 closure: asset checkpoint `c316e88`, source runtime preserved. Independent review found no missing G1–G7 file mapping or material handoff contradiction. Local preview media loaded; representative loop currentTime advanced under actual UI playback, then all audio was paused. Major lit-frame edges shifted 0/0/-1px; full pixel identity/runtime fit not claimed. User chooses Claude for implementation; root has not started it.
