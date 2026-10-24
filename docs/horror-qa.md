# One-door prototype verification — 2026-10-25

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
