// H4 G2 bolt (spec sections 4 P0/C7/F3, 5 G2) and G4 light (sections 4 C2, 5 G4, 8).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { T, FRAME, Rig, playTo, moveDoor, injectCover } = require('./horror-h4-helpers.cjs');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b} +/- ${tol}, got ${a}`);
const B = T.bolt, DT = T.step; // bolt tests run one substep per frame for exact speeds
const atDetent = s => Math.abs(s.b - B.detent) < 1e-6;
function f3(lit = false) {
  const rig = playTo('C7', s => s.beat === 'F3'); assert.equal(rig.m.beat, 'F3');
  if (lit) { assert.equal(rig.m.toggleLight(), true); rig.drain(); }
  return rig;
}
// Drive the bolt at `speed` (b per s, signed) for `seconds` or until stop(s).
function bolt(rig, speed, seconds, stop) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    if (!rig.m.boltHeld) rig.m.grabBolt();
    rig.m.dragBolt(speed * DT); rig.m.update(DT); rig.t += DT;
    const ev = rig.drain();
    if (stop && stop(rig.m.snapshot(), ev)) return true;
  }
  return false;
}
const idle = (rig, seconds) => bolt(rig, 0, seconds);
// F3: lower to the detent at 1/s, pause until armed, then wait until a knock impact has just ended.
function readyToSeat(rig) {
  bolt(rig, 1, 2, s => atDetent(s)); // lit: the palm slap at the first 0.8 is passed through on the way
  bolt(rig, 0, 1, s => s.detent === 'armed');
  assert.equal(rig.m.detent, 'armed');
  const knocks = () => rig.events('soft-knock').length, k0 = knocks();
  bolt(rig, 0, 3, () => knocks() > k0);
  idle(rig, B.window + T.beats.f3Impact); // past the impact
}

// ---- preconditions -------------------------------------------------------------------------------
test('bolt preconditions: P0/C7/F3 only, hands free (looking down is allowed: the latch is in view); the door moves only with b <= 0.02', () => {
  const c1 = new Rig('C1'); assert.equal(c1.m.grabBolt(), false, 'no bolt in C1');
  const p0 = new Rig('P0');
  p0.m.grip(); assert.equal(p0.m.grabBolt(), false, 'not while holding the handle'); p0.m.letGo();
  p0.m.setGaze(true); assert.equal(p0.m.grabBolt(), true, 'allowed while looking down (review fix)'); p0.m.releaseBolt(); p0.m.setGaze(false);
  assert.equal(p0.m.grabBolt(), true); assert.equal(p0.m.grip(), false, 'no grip while holding the bolt'); p0.m.releaseBolt();
  // b = 1 in P0: the door does not move.
  p0.m.grip(); p0.run(.5, m => m.drag(.05)); assert.equal(p0.m.o, 0, 'locked door does not open');
  // F3: bolt at 0.5, door does not move.
  const rig = f3(); bolt(rig, 1, .5); rig.m.releaseBolt(); near(rig.m.b, .5, .01);
  rig.m.grip(); rig.run(.5, m => m.drag(.05)); assert.equal(rig.m.o, 0, 'the door moves only when b <= 0.02');
});

test('bolt moves only with o <= 0.03 and passes 0.8 only when flush (rail stop otherwise)', () => {
  const rig = f3();
  rig.m.grip(); moveDoor(rig, .02 + .04, .1); rig.m.letGo(); // unflush and open to 0.04
  assert.ok(rig.m.o > B.openMax);
  bolt(rig, 1, .3); assert.equal(rig.m.b, 0, 'no bolt motion at o > 0.03');
  rig.m.releaseBolt();
  // Back to 0.02: movable, but not flush -> hard stop at 0.8.
  rig.m.grip(); moveDoor(rig, -.02, .05); rig.m.letGo();
  assert.ok(rig.m.o <= B.openMax && !rig.m.flush, `o ${rig.m.o} flush ${rig.m.flush}`);
  bolt(rig, 1, 1, s => atDetent(s)); idle(rig, .3); bolt(rig, .2, 1);
  near(rig.m.b, B.detent, 1e-9, 'rail stop at 0.8'); assert.ok(rig.has('rail-stop'));
});

test('C7: the bolt stops at 0.8 (not flush) and pressing it triggers the pull; the pull kicks it to 0 without attention', () => {
  const rig = new Rig('C7');
  rig.run(.5); // press half a second into C7
  bolt(rig, 1, 1, s => atDetent(s)); idle(rig, .3); bolt(rig, .2, 1);
  near(rig.m.b, B.detent, 1e-9);
  const grab = rig.events('bolt-grab')[0];
  rig.until(s => s.beat === 'F1', 10);
  const pull = rig.events('pull')[0];
  near(pull.time - grab.time, T.beats.c7Hush + T.beats.pullKnocks[2] + .4 + T.beats.pullInhale, .03, 'pull 4.8 s after the press');
  assert.equal(rig.m.b, 0); assert.equal(rig.m.A, 0);
  const r = rig.events('latch-rattle')[0]; assert.ok(r && r.free === true, 'free rattle');
  // Without a press the pull comes after 6.0 s of waiting.
  const wait = new Rig('C7'); wait.until(s => s.beat === 'F1', 15);
  near(wait.events('pull')[0].time, T.beats.c7Wait + 4.8, .03, 'pull after the 6 s wait');
});

test('C7: a bolt press on the very first frame of C7 also triggers the pull (4.8 s later)', () => {
  const rig = new Rig('C7');
  assert.equal(rig.m.grabBolt(), true);
  rig.until(s => s.beat === 'F1', 15);
  near(rig.events('pull')[0].time - rig.events('bolt-grab')[0].time, 4.8, .03, 'pull after a frame-0 press');
});

// ---- detent and speed limits ---------------------------------------------------------------------
test('detent at 0.8 needs a 0.2 s pause in both directions (P0 lifting, F3 lowering)', () => {
  // P0 lifting at 0.2/s (under the 0.30 dark seat limit).
  const p0 = new Rig('P0');
  bolt(p0, -.2, 2, s => atDetent(s));
  assert.ok(atDetent(p0.m) && p0.has('detent'));
  bolt(p0, -.2, 1); near(p0.m.b, B.detent, 1e-9, 'pushing through the detent never passes');
  idle(p0, .15); bolt(p0, -.2, .1); near(p0.m.b, B.detent, 1e-9, 'a 0.15 s pause is not enough');
  idle(p0, .21); bolt(p0, -1, .1); assert.ok(p0.m.b < B.detent - .05, 'a 0.2 s pause arms it');
  assert.equal(p0.events('latch-rattle').length, 0);
  // F3 lowering at 1/s (under the 1.6 guide limit).
  const rig = f3();
  bolt(rig, 1, 2, s => atDetent(s)); bolt(rig, 1, 1); near(rig.m.b, B.detent, 1e-9);
  idle(rig, .15); bolt(rig, .2, .1); near(rig.m.b, B.detent, 1e-9);
  assert.equal(rig.events('latch-rattle').length, 0);
});

test('guide zone: <= 1.6/s is silent; faster rattles (+0.15) and kicks back 0.10', () => {
  const ok = f3(); bolt(ok, 1.5, 2, s => atDetent(s));
  assert.equal(ok.events('latch-rattle').length, 0); assert.equal(ok.m.A, 0);
  const fast = f3(); let prevB = 0;
  bolt(fast, 1.8, .5, (s, ev) => { if (ev.some(e => e.type === 'latch-rattle')) return true; prevB = s.b; return false; });
  const r = fast.events('latch-rattle')[0]; assert.ok(r); assert.equal(r.seat, false); assert.equal(r.dir, 'down');
  near(fast.m.A, T.attention.rattle, 1e-12);
  near(fast.m.b, prevB + 1.8 * DT - B.kickGuide, 1e-9, 'kicked back 0.10');
});

test('seat zone, dark: 0.28/s seats, 0.33/s rattles and kicks to 0.70 (+0.15)', () => {
  const ok = f3(); readyToSeat(ok);
  bolt(ok, .28, 1.2, (s, ev) => ev.some(e => e.type === 'latch-click' || e.type === 'latch-rattle'));
  assert.ok(ok.has('latch-click'), 'seated'); assert.equal(ok.events('latch-rattle').length, 0);
  assert.equal(ok.m.beat, 'END');
  const fast = f3(); readyToSeat(fast); const A0 = fast.m.A;
  bolt(fast, .33, 1, (s, ev) => ev.some(e => e.type === 'latch-rattle' || e.type === 'latch-click'));
  assert.ok(fast.has('latch-rattle'), 'rattled'); near(fast.m.b, B.kickSeat, 1e-9, 'kicked to 0.70'); near(fast.m.A - A0, T.attention.rattle, 1e-12);
});

test('seat zone, lit: the first arrival at 0.8 draws a palm slap (to 0.70); 0.45/s seats, 0.55/s rattles', () => {
  const ok = f3(true);
  bolt(ok, 1, 2, s => ok.has('palm-slap'));
  assert.ok(ok.has('palm-slap')); near(ok.m.b, B.kickSeat, 1e-9, 'palm slap kicks to 0.70');
  assert.equal(ok.has('breath') && ok.events('breath').some(e => e.visit === 'F3'), false, 'lit: palm slap instead of the breath');
  readyToSeat(ok);
  bolt(ok, .45, 1, (s, ev) => ev.some(e => e.type === 'latch-click' || e.type === 'latch-rattle'));
  assert.ok(ok.has('latch-click'), 'lit seat at 0.45/s'); assert.equal(ok.events('latch-rattle').length, 0);
  const fast = f3(true); bolt(fast, 1, 2, s => fast.has('palm-slap')); readyToSeat(fast);
  bolt(fast, .55, 1, (s, ev) => ev.some(e => e.type === 'latch-rattle' || e.type === 'latch-click'));
  assert.ok(fast.has('latch-rattle'), 'lit 0.55/s rattles');
  const dark = f3(); bolt(dark, 1, 2, s => atDetent(s));
  assert.ok(dark.events('breath').some(e => e.visit === 'F3'), 'dark: breath at the first 0.8');
});

test('lifting too fast in the seat zone rattles and returns the bolt to 1.0 (P0)', () => {
  const p0 = new Rig('P0');
  bolt(p0, -1, .1, (s, ev) => ev.some(e => e.type === 'latch-rattle'));
  const r = p0.events('latch-rattle')[0]; assert.ok(r); assert.equal(r.dir, 'up'); assert.equal(r.seat, true);
  assert.equal(p0.m.b, 1, 'back to 1.0'); near(p0.m.A, T.attention.rattle, 1e-12);
});

test('a rattle is not a free pass: lifting at 1/s never clears the P0 seat zone', () => {
  // Spec G2: too fast in the seat zone -> rattle and back to 1.0. A player who keeps lifting at 1/s
  // (pausing at the detent as required) must keep being kicked back, never freeing the bolt.
  const p0 = new Rig('P0');
  for (let i = 0; i < Math.round(4 / DT); i++) {
    if (!p0.m.boltHeld) p0.m.grabBolt();
    const s = p0.m.snapshot();
    if (!(atDetent(s) && s.detent !== 'armed')) p0.m.dragBolt(-1 * DT);
    p0.m.update(DT); p0.drain();
    if (p0.has('bolt-free') || p0.m.state !== 'playing') break;
  }
  const freed = p0.has('bolt-free');
  assert.equal(freed, false, `bolt freed after ${p0.events('latch-rattle').length} rattle(s) while lifting at 3x the seat limit`);
});

test('a rattle is not a free pass: after one rattle in F3, a 6/s seat must not latch', () => {
  const rig = f3(); readyToSeat(rig);
  for (let i = 0; i < Math.round(2 / DT) && rig.m.state === 'playing' && rig.m.beat === 'F3'; i++) {
    if (!rig.m.boltHeld) rig.m.grabBolt();
    const s = rig.m.snapshot();
    if (!(atDetent(s) && s.detent !== 'armed')) rig.m.dragBolt(6 * DT);
    rig.m.update(DT); rig.drain();
  }
  assert.ok(rig.has('latch-rattle'));
  assert.equal(rig.has('latch-click'), false, `latched at 6/s (20x the dark seat limit) with A = ${rig.m.A.toFixed(2)}`);
});

test('F3 knocks every 2.4 s from +1.5 s; an impact kicks a bolt strictly in the seat zone (b > 0.8) to 0.70, not one at the detent', () => {
  const rig = f3();
  bolt(rig, 1, 2, s => atDetent(s)); idle(rig, .3);
  // Hold at exactly 0.8 through two impacts: no kick.
  const k0 = rig.events('soft-knock').length;
  bolt(rig, 0, 5, () => rig.events('soft-knock').length >= k0 + 2); idle(rig, .3);
  assert.equal(rig.has('bolt-kicked'), false); near(rig.m.b, B.detent, 1e-9);
  const knocks = rig.events('soft-knock').map(e => e.time);
  near(knocks[1] - knocks[0], T.beats.f3Period, .02, 'knock period');
  near(knocks[0] - rig.log.find(e => e.type === 'beat' && e.beat === 'F3').time, T.beats.f3Knocks, .02, 'first knock');
  // Into the seat zone just before an impact.
  bolt(rig, 0, 3, () => (rig.m.s.t - T.beats.f3Knocks) % T.beats.f3Period > T.beats.f3Period - .35);
  bolt(rig, .25, .4, (s, ev) => ev.some(e => e.type === 'bolt-kicked'));
  assert.ok(rig.has('bolt-kicked')); near(rig.m.b, B.kickSeat, 1e-9);
  assert.equal(rig.events('latch-rattle').length, 0, 'the knock kick is not a rattle');
});

test('seating outside F3 just locks again; F3 seat ends the run (latch-click -> END -> sting -> win)', () => {
  const p0 = new Rig('P0');
  bolt(p0, -.2, .5); assert.ok(p0.m.b < 1 && p0.m.b > B.detent);
  bolt(p0, .2, 1, (s, ev) => ev.some(e => e.type === 'latch-click'));
  assert.ok(p0.has('latch-click')); assert.equal(p0.m.beat, 'P0', 'still P0');
  const rig = f3(); readyToSeat(rig); bolt(rig, .25, 1.2, (s, ev) => ev.some(e => e.type === 'latch-click'));
  assert.equal(rig.m.beat, 'END');
  const click = rig.events('latch-click')[0].time;
  const k = rig.events('soft-knock').length;
  rig.until(s => s.state === 'won', 6);
  assert.equal(rig.m.state, 'won');
  assert.equal(rig.events('soft-knock').length, k, 'knocks stop');
  near(rig.events('sting')[0].time - click, T.beats.endRoom, .03, 'sting 2.0 s');
  near(rig.events('win')[0].time - click, T.beats.endRoom + T.beats.endSting + T.beats.endFade, .05, 'fade');
});

test('latch-slide gain follows 0.65 x min(1, |db/dt| / 1.0)', () => {
  const rig = f3(); bolt(rig, .5, .3);
  near(rig.m.soundState().streams.bolt.gain, .65 * .5, .01);
});

// ---- G4 light ------------------------------------------------------------------------------------
test('switch: unlocked from C2, needs free hands, gaze front and the front view; 0.3 s debounce', () => {
  assert.equal(new Rig('C1').m.toggleLight(), false, 'not in C1');
  const rig = new Rig('C2');
  rig.m.grip(); assert.equal(rig.m.toggleLight(), false, 'not while gripping'); rig.m.letGo();
  rig.m.setGaze(true); assert.equal(rig.m.toggleLight(), false, 'not while looking down'); rig.m.setGaze(false);
  assert.equal(rig.m.toggleLight(), true);
  assert.equal(rig.m.toggleLight(), false, 'debounce');
  rig.run(.31); assert.equal(rig.m.toggleLight(), true);
});

test('light leak: +0.006/s while lit with o >= 0.12, never masked, blocks decay; none below 0.12', () => {
  const rig = new Rig('C2'); rig.m.toggleLight(); rig.run(FRAME);
  const A0 = rig.m.A; rig.run(5);
  near(rig.m.A - A0, T.attention.leak * 5, 2e-4, 'leak with o = 0.45 (no decay even after 3 s)');
  // Below 0.12: no leak, and decay resumes after 3 s.
  const c6 = new Rig('C6'); c6.run(.31); c6.m.toggleLight(); c6.run(FRAME);
  const A1 = c6.m.A; c6.run(2);
  near(c6.m.A, A1, 1e-12, 'no leak at o = 0.012');
  assert.equal(c6.m.leak, false);
});

test('C2 lit route: confirmed 0.6 s after the switch, silhouette 1.5 s then slides 0.6 s, C3 2.5 s after confirmation', () => {
  const rig = new Rig('C2');
  rig.until(s => s.corridor === 'dead', 3);
  rig.m.toggleLight(); const on = rig.t;
  rig.until(s => s.confirmRoute === 'lit', 2);
  near(rig.t - on, T.light.confirmDelay, .03, 'confirm delay');
  rig.run(1.4); assert.equal(rig.m.silhouette, 1);
  rig.run(.4); assert.ok(rig.m.silhouette < 1 && rig.m.silhouette > 0);
  rig.until(s => s.beat === 'C3', 2);
  near(rig.log.find(e => e.type === 'beat' && e.beat === 'C3').time - rig.events('confirm')[0].time, T.beats.c3After, .03);
});

// Same intents, light on vs off: every rule quantity except the light's own costs must match.
function litTwin(cp, policy, seconds, fields) {
  const runs = [false, true].map(lit => {
    const rig = new Rig(cp); if (lit) { assert.equal(rig.m.toggleLight(), true, `switch in ${cp}`); }
    const out = []; rig.run(seconds, policy, FRAME, s => out.push(s)); return { rig, out };
  });
  for (let i = 0; i < runs[0].out.length; i++) for (const f of fields) {
    if (runs[0].out[i][f] !== runs[1].out[i][f]) assert.fail(`${cp}: ${f} differs lit vs dark at frame ${i}: ${runs[0].out[i][f]} vs ${runs[1].out[i][f]}`);
  }
  return runs;
}

test('light changes no rule threshold: eyes (C4), mimic response (C5), drawer (C6a), hand (C3) identical lit vs dark', () => {
  litTwin('C4', (m) => { if (m.s.t > 6) m.setGaze(true); }, 14, ['E', 'eyes', 'state', 'reason', 'o']);
  const c5 = litTwin('C5', (m, s) => {
    if (!m.held && s.mimic !== 'none') m.grip();
    if (s.mimic === 'watch' && s.mimicTime < .2) m.drag(.15 * FRAME);
    if (s.mimic === 'response') m.drag(-.15 * FRAME);
  }, 30, ['o', 'mimic', 'mimicTime', 'P', 'copy', 'state']);
  assert.ok(c5[1].rig.has('palm'), 'lit: the palm cue appears');
  assert.equal(c5[0].rig.has('palm'), false);
  litTwin('C6', (m, s) => { if (s.drawer === 'open' && s.d > .2) m.setTurn(true); }, 12, ['d', 'drawer', 'watchTime', 'state']);
  litTwin('C3', (m, s) => { if (s.hand) { if (!m.held) m.grip(); if (s.handStage === 'grip') m.drag(0, -((s.gripStage === 'ease' ? .32 : .84) - m.forceTarget) / T.hand.forceGain); } }, 16,
    ['o', 'force', 'strain', 'handStage', 'defended', 'state']);
});

test('G1 x G4: the click is covered but the leak is not (C2 under full cover)', () => {
  const rig = new Rig('C2'); injectCover(rig.m); rig.run(FRAME);
  const A0 = rig.m.A; rig.m.toggleLight(); rig.drain();
  assert.equal(rig.m.A, A0, 'click covered');
  rig.run(2); near(rig.m.A - A0, T.attention.leak * 2, 2e-4, 'leak still accrues at L >= 1');
});

test('boltMovable guard: never with the handle held, an H2 hand gripping, fingers on the edge, the wedge in, or o > 0.03 (white-box)', () => {
  // These combinations cannot be reached by play (the bolt exists only in P0/C7/F3); the guard is checked directly.
  const rig = f3(); const m = rig.m;
  assert.equal(m.boltMovable(), true);
  const cases = [['held', true], ['hand', true, () => { m.handStage = 'grip'; }], ['mimic', 'watch'], ['wedge', 'in'], ['wedge', 'inserting'], ['o', .031]];
  for (const [key, value, extra] of cases) {
    const keep = { [key]: m[key], handStage: m.handStage };
    m[key] = value; if (extra) extra();
    assert.equal(m.boltMovable(), false, `${key} = ${value}`);
    Object.assign(m, keep);
  }
  assert.equal(m.boltMovable(), true);
  m.mimic = 'out'; assert.equal(m.boltMovable(), true, 'fingers gone'); m.mimic = 'none';
});
