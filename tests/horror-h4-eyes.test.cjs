// H4 G3 eyes (spec section 4 C4 and F1): grace, rates, look-down decay, the o >= 0.21 requirement,
// the C4 chord requirement and warning-to-fail fairness.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { T, FRAME, Rig } = require('./horror-h4-helpers.cjs');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b} +/- ${tol}, got ${a}`);
const C4 = T.eyes.c4, F1 = T.eyes.f1;
const at = (rig, type) => { const e = rig.events(type)[0]; assert.ok(e, `no ${type} event`); return e.time; };
// Reach F1 from the C7 checkpoint without touching anything (the pull ends at 0.62).
function f1() { const rig = new Rig('C7'); rig.until(s => s.beat === 'F1', 20); assert.equal(rig.m.beat, 'F1'); return rig; }

test('C4: staring fails by "eyes": grace 1.5 s from the fade start, +0.7/s, warning at 0.5, fail about 0.7 s later', () => {
  const rig = new Rig('C4');
  rig.until(s => s.state !== 'playing', 15);
  assert.equal(rig.m.reason, 'eyes');
  const breath = at(rig, 'breath'), open = at(rig, 'eyes-open'), warn = at(rig, 'eyes-warning'), lose = at(rig, 'lose');
  near(breath, T.beats.c4After, .02, 'breath 2.0 s into C4');
  near(open - breath, C4.breathLead, .02, 'eyes fade in 1.0 s after the breath');
  near(warn - open, C4.grace + T.eyes.warn / C4.rate, .03, 'warning');
  near(warn - breath, 3.2, .05, 'warning about 3.2 s after the breath');
  near(lose - warn, (1 - T.eyes.warn) / C4.rate, .03, 'warning to fail');
  assert.ok(lose - warn >= .6, 'warning-to-fail >= 0.6 s');
});

test('C4: E stays 0 through the grace, then looking down decays it at 0.5/s', () => {
  const rig = new Rig('C4');
  rig.until(s => s.eyes === 'open', 5);
  rig.run(C4.grace - .05);
  assert.equal(rig.m.E, 0, 'no E during the 1.5 s grace');
  rig.run(.05 + .5);
  near(rig.m.E, C4.rate * .5, .02, 'E after 0.5 s past the grace');
  const E0 = rig.m.E;
  rig.m.setGaze(true); rig.run(.4);
  near(rig.m.E, E0 - T.eyes.decay * .4, .01, 'look-down decay');
});

test('C4: the eyes leave 6.0 s after full fade only after a >= 0.5 s grip while looking down (the chord)', () => {
  // Chord from the start.
  const chord = new Rig('C4');
  chord.until(s => s.beat === 'C5', 20, m => { m.setGaze(true); if (!m.held) m.grip(); });
  const open = at(chord, 'eyes-open'), withdraw = at(chord, 'eyes-withdraw');
  near(withdraw - open, C4.fade + C4.stay, .03, 'withdraw 6.0 s after full fade');
  assert.equal(chord.has('eyes-chord-hint'), false);
  assert.ok(chord.has('eyes-gone')); assert.equal(chord.m.beat, 'C5');
  assert.equal(chord.m.E, 0);
  // Looking down without gripping: hint at +6 s, the eyes stay up to +6 s more.
  const noGrip = new Rig('C4');
  noGrip.until(s => s.eyes === 'withdraw' || s.state !== 'playing', 25, m => m.setGaze(true));
  const o2 = at(noGrip, 'eyes-open');
  near(at(noGrip, 'eyes-chord-hint') - o2, C4.fade + C4.stay, .03, 'chord hint');
  near(at(noGrip, 'eyes-withdraw') - o2, C4.fade + C4.stay + C4.overstay, .03, 'overstay');
  // Gripping (while looking down) after the hint releases them 0.5 s later.
  const late = new Rig('C4');
  late.until(s => s.eyes === 'open', 5, m => m.setGaze(true));
  late.run(C4.fade + C4.stay + 1, m => m.setGaze(true));
  assert.ok(late.has('eyes-chord-hint'));
  const g = late.t;
  late.until(s => s.eyes === 'withdraw', 3, m => { m.setGaze(true); if (!m.held) m.grip(); });
  near(late.t - g, C4.chordGrip, .05, 'chord of 0.5 s');
});

test('F1: breath at +0.5, eyes from +1.5, grace 0.8 s, +0.8/s: warning about t0+2.9, fail about t0+3.55', () => {
  const rig = f1();
  const t0 = rig.events('beat').filter(e => e.beat === 'F1')[0].time;
  rig.until(s => s.state !== 'playing', 10);
  assert.equal(rig.m.reason, 'eyes');
  near(at(rig, 'breath') - t0, F1.breathAt, .02, 'breath');
  near(at(rig, 'eyes-open') - t0, F1.fadeAt, .02, 'eyes');
  near(at(rig, 'eyes-warning') - t0, 2.925, .05, 'warning');
  near(at(rig, 'lose') - t0, 3.55, .05, 'fail');
  assert.ok(at(rig, 'lose') - at(rig, 'eyes-warning') >= .6);
});

test('F1: closing below 0.21 while looking down withdraws the eyes (0.8 s), then F2', () => {
  const rig = f1();
  let maxE = 0;
  rig.until(s => s.beat === 'F2' || s.state !== 'playing', 40, (m, s) => {
    m.setGaze(true); if (!m.held) m.grip();
    if (s.o > .4) m.drag(-.3 * FRAME); else if (s.covered && !s.preWarn) m.drag(-.12 * FRAME);
  }, FRAME, s => { maxE = Math.max(maxE, s.E); });
  assert.equal(rig.m.beat, 'F2', `state ${rig.m.state} ${rig.m.reason}`);
  assert.equal(maxE, 0, 'looking down keeps E at 0');
  const w = rig.events('eyes-withdraw')[0], g = rig.events('eyes-gone')[0];
  near(g.time - w.time, F1.withdraw, .03, 'withdraw takes 0.8 s');
});

test('F1: E accrues only while the iris is in the gap (o >= 0.21)', () => {
  // Staring but already below 0.21 before the grace ends: no E at all, the eyes withdraw.
  const below = f1(); let maxE = 0;
  below.until(s => s.eyes === 'none' && below.has('eyes-gone') || s.state !== 'playing', 8, (m, s) => { if (!m.held) m.grip(); if (s.o >= .205) m.drag(-.05); },
    FRAME, s => { maxE = Math.max(maxE, s.E); });
  assert.equal(below.m.state, 'playing', `${below.m.reason}`);
  assert.ok(below.m.o < T.eyes.irisFrom);
  assert.equal(maxE, 0);
  // Staring with the edge parked just above 0.21: E accrues and fails.
  const above = f1();
  above.until(s => s.state !== 'playing', 10, (m, s) => { if (!m.held) m.grip(); if (s.o > .216) m.drag(-.05); });
  assert.equal(above.m.reason, 'eyes');
  assert.ok(above.m.o >= T.eyes.irisFrom);
});
