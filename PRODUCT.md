# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

문 좀 살살 is a mouse-operated door game. The user approved a 2D first-person horror prototype around one sliding door: opening it slowly is the tension, and the things on the other side answer what you do. H1 established the slow door and the downstairs knock; the user then judged the instant-close response too easy and fear too weak. H2 added the user-selected force-resistance hand. H4 (this build) adds all seven tension gimmicks the user chose (masking sounds, the latch, eyes in the gap, the light choice, the slipper wedge, the mimic, the drawer behind) and the user allowed a full rebuild with completeness as the top priority.

## Operating Context

Local browser prototype for the user to judge fear, pacing and mouse feel. Static HTML/CSS/JavaScript; the original SVG game remains at `/2d/`.

## Capabilities and Constraints

- One night in chapters: unlatch → open the stiff rail under outside sounds → corridor light choice → glass knocks and the gripping hand (H2, unchanged constants) → eyes in the gap → mimicking fingers → drawer behind → slipper wedge → wedge plus drawer → the one forced pull → eyes under the elevator → the last hand → latch. Each gimmick is taught alone, then paired with at most one other.
- Mouse: left-button drag for the handle and bolt, held right button to look down (toggle alternative), left-edge button to turn around, clicks for switch and slipper. Keyboard equivalents exist.
- Every sound cue has a caption and a visual twin; masking is judged from the same gain the audio graph plays.
- Chapter checkpoints with retry; full restart; pause freezes simulation and audio.
- No deployment, account, analytics, persistent save or external runtime libraries.
- Every timing, threshold, control mapping and the run length are provisional and live in `dist/horror/tuning.js`; final art, tension and product acceptance remain the user's call.

## Evidence on Hand

The user's latest instructions are the implementation authority: implement all seven gimmicks with the prepared asset pack, keep the slow door-opening tension, verify real mouse play and threat collisions, and (mid-task) rebuild freely with completeness first. The asset pack handoff and the design panel spec are proposals, not user decisions.
