# Current state

- Writer now: none
- Current task H2: strengthen knock/hand presentation and replace instant closure with force-controlled resistance — PASS for implementation and bounded tested checks. AI checkpoint closed; human acceptance and continuous physical held-mouse force trace UNVERIFIED.
- H1 functional checkpoint remains PASS; user playtest judged fear and hand-response tension FAIL. User liked the tension of slowly opening the door.
- Checkpoint feature commit: `da8d763` on `codex/first-person-horror`, H2 baseline `95dc1e4`. Historical H1 feature: `6e7d97b`, original baseline `dbc42f4`. Protected old game, original planning doc and hosting config unchanged.
- User authority: improve knock/hand tension, keep slow opening, and explicitly select force resistance (right increases force, left eases; hand pushes back). H1 instant-slam rule superseded. Full six-minute game, other threats, deployment and final aesthetic acceptance remain outside scope.
- Finish line met at tested scope: two feasible resist/ease/close encounters; nontrivial force rules; layered simulation-clock sound; stop response; distinct failures and restart; pause/mute; deterministic checks and real browser UI sequence. Browser success used actual arrow keys for force after mouse opening/stopping. Physical held-mouse force feel remains for replay, not certified by those checks.
- Changed paths: `dist/horror/`, `tests/horror.test.cjs`, `package.json`, README, this tracker, `.gitignore`, development-only product/surface/design records, asset provenance and QA summary.
- Recovery: revert H2 feature `da8d763` to return to the H1 prototype. Existing `/2d/` stays intact.
- Checks: PASS — 21 tests, 11 JS parses, real UI success (mouse entry/arrow force), native instant-close failure, excess-force loss, pause/resume, 390px viewport, independent bounded review and four-raster provenance. Evidence and explicit limits: `docs/horror-qa.md`. Human fear/mouse feel/audio mix: UNVERIFIED. Deployment: UNVERIFIED, not requested/performed.
- Ownership: one writer (root). Read-only review may run in parallel. Direct implementation retained because state, input and visual positions form one small coupled prototype; splitting writes has no net benefit.
- Review/documentation dispatch: intended gpt-6-sol / medium; schema supports settings, actual execution metadata UNVERIFIED. Separate read-only review found no material issue; documentation returned read-only and was integrated by root.
- Preview: `http://127.0.0.1:5174/horror/`, local only, left running for the user's playtest. The default npm port remains 5173. Browser viewport restored. No push or deployment.
- Resume: user replay of H2, especially actual held-mouse force control and fear/audio perception. Same owner should incorporate concrete feedback; no full-game expansion without request. Mobile footer wrapping was corrected as part of the changed surface.
- H2 pass/rework: one selected mechanic implementation, one independent material-fix batch (loss audio tail + truthful retreat cue). Initial PCM test exposed strict -0 vs 0 comparison; numerical-silence assertion corrected. Final rule tests passed. Human acceptance remains separate.

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

## User decisions

- User: implement the first small 2D first-person prototype, with knock and gap-hand threats.
- Prior six-minute timeline and three-threat proposal remain design proposals, not mandatory content for this prototype.
- Implementation choices/timing/art are provisional and require human experience review.
- H2 user decision (async answer): choose "밀어 버티기" — hand grips and pushes door open; increase force on a push, ease off when noise rises. The alternative wait-then-close rule was not selected.

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
