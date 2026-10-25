# One-door prototype

Mode: Experience (interactive game). Code-led narrow prototype, following the first-person scene already proposed and explicitly requested by the user; no new direction tournament or standing workflow preference.

## Direction contract

THESIS: A hand occupied by a door must stop for a downstairs knock, then vary resisting force when another hand grips and pushes the door. The scene itself leads; controls remain at its edges.

OWN-WORLD: A night-time Korean studio apartment, weathered timber, blue-green corridor light, warm paper instructions and a pale hand. No downstairs portrait or dashboard card shell. Local generated raster environment with geometric interactive door layers.

STORY: Learn slow dragging, stop at a knock, notice the hand approach, resist its telegraphed pushes, ease force when the wood creaks, close after the grip releases, resolve the overlap, then shut the door. Visual text accompanies audio cues.

FIRST VIEWPORT: A full-width 16:9 first-person scene dominates; a large sliding middle door is central, pull handle at reachable mid-height, one instruction line below, small pause/sound/retry controls above. Intro is a legible paper note over the visible scene. Small viewports keep scene coordinates and controls intact.

FORM: User-pinned first-person one-door scene; seed: none (user-pinned narrow brief). No free camera or third threat.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Prototype rule boundary

H2 supersedes the instant-slam rule following the user's explicit selection of force resistance. Timings are provisional. A hand approaches, grips, then alternates brace/push/ease. During a grip, rightward pointer movement adds force and leftward movement reduces it; it cannot teleport the door shut. Low resistance lets the gap grow, while excessive force during ease raises wood noise. After two defended pushes and controlled easing, the hand retreats, then the player closes the door. Defensive grip movement is exempt from knock travel penalties. Pause/hidden/blur freeze gameplay and release force/capture; resume gives a short regrab grace. Sound uses simulation-clock impacts, resonant wood/room tail, scrape, breath and pressure cues. Human fear/feel remain unverified.

## H4 rule boundary (seven gimmicks)

The user chose all seven gimmicks and allowed a full rebuild with completeness first. A design panel (three independent designs, two judges, one synthesis) produced the spec; the main session implemented it as a deterministic rules model (`dist/horror/night.js`, numbers in `tuning.js`) and a view (`game.js`). Every value is provisional.

- Sequence: P0 unlatch → C1 stiff rail under elevator/traffic cover (G1) → C2 corridor light dies; adapt in the dark or switch the light (G4) → C3 knocks on the glass ("not downstairs") and the H2 hand → C4 eyes in the gap; look down and grip (G3) → C5 mimicking fingers; bait, wait, close while they copy (G6) → C6a drawer behind, door quiet (G7) → C6b slipper wedge against shoves (G5) → C6c wedge plus drawer → C7 the one forced pull → F1 eyes under the elevator (G3+G1) → F2 last hand (H2) → F3 latch between soft knocks, light optional (G2+G4) → drawer closes behind you.
- Separate meters (attention, eye contact, strain, pinch, drawer, slip); masks cover sound only; light changes information and costs, not thresholds (except the stated F3 seat limit and palm slap).
- Controls: left drag (door, force, bolt), held right button (look down; toggle alternative), edge button (turn), clicks (switch, slipper). Chorded right+left presses are routed explicitly because browsers send no pointerdown for them.
- Checkpoints restore canonical chapter states with attention capped at 0.30. Pause freezes the simulation and the AudioContext.
