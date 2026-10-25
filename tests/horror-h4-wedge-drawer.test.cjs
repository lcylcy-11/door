// H4 G5 wedge + shoves and G7 drawer + turn (spec sections 4 C6a-C6c, 5 G5/G7, 2 Turn).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { T, FRAME, Rig, botDriver, playTo } = require('./horror-h4-helpers.cjs');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b} +/- ${tol}, got ${a}`);
const S = T.shove, W = T.wedge, D = T.drawer;
const hold = m => { if (!m.held) m.grip(); };
const free = m => { if (m.held) m.letGo(); };
function c6b() { const rig = playTo('C6', s => s.beat === 'C6b'); assert.equal(rig.m.beat, 'C6b'); return rig; }
// C6b with the slipper wedged before the shoves begin (hands free afterwards).
function wedged() {
  const rig = c6b(); free(rig.m); assert.equal(rig.m.toggleWedge(), true);
  rig.run(W.insert + .05); assert.equal(rig.m.wedge, 'in'); return rig;
}

// ---- G7 drawer ---------------------------------------------------------------------------------
test('C6a: creak at +1.5 s, visit 1 at +2.5 s grows 1/16 per s unwatched and fails "drawer" at d = 1; slide at 0.75', () => {
  const rig = new Rig('C6');
  rig.until(s => s.state !== 'playing', 25);
  assert.equal(rig.m.reason, 'drawer');
  const start = rig.events('drawer-start')[0];
  near(rig.events('rear-creak')[0].time, T.beats.c6aHush, .02, 'creak');
  near(start.time, T.beats.c6aHush + T.beats.c6aCreak, .02, 'visit 1');
  near(rig.events('lose')[0].time - start.time, 16, .05, 'fail after 16 s');
  near(rig.events('drawer-slide')[0].time - start.time, D.slideAt * 16, .05, 'drawer-slide at d = 0.75');
});

test('drawer counts as watched from 50% of the 0.45 s turn pan, holds 1.5 s, then closes at 0.25/s; looking away resumes it', () => {
  const rig = new Rig('C6');
  rig.until(s => s.drawer === 'open', 5);
  rig.run(2); // d = 0.125
  assert.equal(rig.m.setTurn(true), true);
  let dAtWatch = null, tAtWatch = null;
  rig.until(s => s.turn >= T.turn.watchFrom, 1, null, T.step, s => { if (dAtWatch === null && s.turn >= T.turn.watchFrom) { dAtWatch = s.d; tAtWatch = s.time; } });
  near(rig.m.turn, T.turn.watchFrom, 1 / (T.turn.pan * 120) + 1e-9, 'watched from turn 0.5');
  const turnAt = rig.events('turn')[0].time;
  near(tAtWatch - turnAt, T.turn.pan * T.turn.watchFrom, .02, 'watched 0.225 s into the pan');
  rig.run(1.4);
  near(rig.m.d, dAtWatch, 1e-9, 'stopped while watched, before the 1.5 s delay');
  rig.run(.5);
  near(rig.m.d, dAtWatch - D.close1 * (.5 + 1.4 + FRAME - D.watchDelay), .01, 'closing at 0.25/s after 1.5 s');
  // Look away: it resumes opening and the watch delay restarts.
  rig.m.setTurn(false); rig.run(.5);
  assert.ok(rig.has('drawer-resume'));
  const d1 = rig.m.d; rig.run(1); near(rig.m.d - d1, 1 / 16, .002, 'grows again');
  rig.m.setTurn(true); rig.until(s => s.drawer === 'shut', 10);
  assert.ok(rig.has('drawer-shut'));
  const stop2 = rig.events('drawer-stop')[1], shut = rig.events('drawer-shut')[0];
  assert.ok(shut.time - stop2.time >= D.watchDelay, 'the 1.5 s watch delay restarted');
  // Turning back to the door with the drawer shut starts C6b.
  rig.m.setTurn(false); rig.until(s => s.beat === 'C6b', 2);
  assert.equal(rig.m.beat, 'C6b');
});

test('drawer creak loop gain = 0.65 x (0.15 + 0.85 d) while unwatched, silent while watched', () => {
  const rig = new Rig('C6'); rig.until(s => s.drawer === 'open', 5); rig.run(3);
  near(rig.m.soundState().streams.drawer.gain, .65 * (.15 + .85 * rig.m.d), 1e-12);
  rig.m.setTurn(true); rig.run(.3);
  assert.equal(rig.m.soundState().streams.drawer.gain, 0);
});

test('turning needs a free hand, gaze front and no wedge action; it unlocks in C6a (not before)', () => {
  const early = new Rig('C5'); assert.equal(early.m.setTurn(true), false, 'no turning before C6a');
  const rig = new Rig('C6');
  rig.m.grip(); assert.equal(rig.m.setTurn(true), false, 'not while holding the handle'); rig.m.letGo();
  rig.m.setGaze(true); assert.equal(rig.m.setTurn(true), false, 'not while looking down'); rig.m.setGaze(false);
  assert.equal(rig.m.setTurn(true), true);
  rig.run(.1); assert.equal(rig.m.grip(), false, 'no grip while turned'); assert.equal(rig.m.toggleLight(), false, 'no switch while turned');
  rig.m.setGaze(true); assert.equal(rig.m.gazeDown, false, 'no look-down while turned');
  const w = wedged(); w.m.toggleWedge(); assert.equal(w.m.wedge, 'removing'); assert.equal(w.m.setTurn(true), false, 'not during a wedge action');
});

test('C6c visit 2: +1/12 per s unwatched, closes at 0.20/s after 1.5 s of watching', () => {
  const rig = playTo('C6', s => s.beat === 'C6c' && s.drawer === 'open');
  assert.equal(rig.m.drawer, 'open'); assert.equal(rig.m.visit, 2);
  // Hands off, wedge in (bot state): watch the rates.
  const d0 = rig.m.d; rig.run(1, m => free(m));
  near(rig.m.d - d0, 1 / 12, .002, 'visit 2 rate');
  rig.run(2, m => free(m)); // d about 0.25 so it is still closing when measured
  rig.m.setTurn(true); rig.run(T.turn.pan + D.watchDelay + .5, m => free(m));
  const d1 = rig.m.d; rig.run(.5, m => free(m));
  near(d1 - rig.m.d, D.close2 * .5, .002, 'visit 2 close rate');
});

test('C6c visit 2 begins 2.0 s after C6c starts, with or without a grip (spec "Grip + 2.0 s" resolved: a wedged, hands-free player can already turn)', () => {
  const rig = wedged();
  rig.until(s => s.beat === 'C6c', 20, m => free(m));
  assert.equal(rig.m.beat, 'C6c'); assert.equal(rig.m.held, false); assert.equal(rig.m.wedge, 'in');
  const at = rig.m.time;
  rig.until(s => s.drawer === 'open', 3, m => free(m));
  near(rig.events('drawer-start').find(e => e.visit === 2).time - at, T.beats.c6cAfter, .03, 'visit 2 start');
});

// ---- G5 wedge and shoves -------------------------------------------------------------------------
test('C6b shoves: start 2.0 s after facing the door, first at +2.5 s (inhale 0.8 s, shove 0.5 s), period 5.0 s', () => {
  const rig = c6b();
  rig.run(14, hold);
  const begin = rig.events('shoves-start')[0], c6bAt = rig.log.find(e => e.type === 'beat' && e.beat === 'C6b').time;
  near(begin.time - c6bAt, T.beats.c6bAfter, .03, 'shoves start');
  const shoves = rig.events('shove'), inhales = rig.events('shove-inhale');
  near(shoves[0].time - begin.time, S.first, .03, 'first shove');
  near(shoves[0].time - inhales[0].time, S.inhale, .03, 'inhale 0.8 s');
  near(shoves[1].time - shoves[0].time, S.periodSolo, .03, 'period 5.0 s');
  assert.ok(shoves.every(e => e.result === 'held'), 'gripped shoves are absorbed');
});

test('gripped shoves are absorbed; unwedged and unattended a shove opens the door 0.15 (no attention); 0.45 fails "forced"', () => {
  const rig = c6b();
  const A0 = rig.m.A;
  rig.until(s => s.state !== 'playing', 30, m => free(m));
  assert.equal(rig.m.reason, 'forced');
  const opens = rig.events('shove').filter(e => e.result === 'open');
  assert.equal(opens.length, 3, '3 shoves of 0.15 from 0.012 reach 0.45');
  assert.equal(rig.m.A, A0, 'enemy-driven motion through the stiff band adds no attention');
});

test('wedge: allowed only for o in [0.01, 0.70] with free hands between shoves; refused during a grip or a shove', () => {
  const rig = c6b();
  rig.m.grip(); assert.equal(rig.m.toggleWedge(), false, 'no insertion while gripping'); rig.drain();
  assert.equal(rig.events('wedge-refused').pop().reason, 'hand');
  rig.m.letGo();
  rig.until(s => s.shovePhase === 'inhale', 6, hold);
  free(rig.m); assert.equal(rig.m.toggleWedge(), false, 'no insertion during an inhale'); rig.drain();
  assert.equal(rig.events('wedge-refused').pop().reason, 'shove');
  rig.until(s => s.shovePhase === 'shove', 2, hold);
  free(rig.m); assert.equal(rig.m.toggleWedge(), false, 'no insertion during a shove');
  // Range boundaries (white-box: the C6 holder floor 0.012 and the 0.45 fail make them unreachable by play).
  const r = c6b(); const m = r.m; const keep = m.o;
  for (const [o, ok] of [[.0099, false], [.01, true], [.7, true], [.701, false]]) { m.o = o; assert.equal(m.canWedge(), ok, `canWedge at o = ${o}`); }
  m.o = keep;
});

test('a wedged door cannot be moved by the player (so never flush); insertion and removal take 0.6 / 0.5 s', () => {
  const rig = c6b(); free(rig.m); rig.m.toggleWedge();
  const o0 = rig.m.o;
  rig.run(W.insert - .05);
  assert.equal(rig.m.wedge, 'inserting');
  rig.run(.1); assert.equal(rig.m.wedge, 'in');
  near(rig.events('wedge-in')[0].time - rig.events('wedge-inserting')[0].time, W.insert, .02);
  rig.run(1, m => { hold(m); m.drag(-.05); }); assert.equal(rig.m.o, o0, 'cannot close');
  rig.run(1, m => { hold(m); m.drag(.05); }); assert.equal(rig.m.o, o0, 'cannot open');
  assert.equal(rig.m.flush, false);
  free(rig.m); rig.m.toggleWedge(); rig.until(s => s.wedge === 'rest', 1);
  near(rig.events('wedge-out')[0].time - rig.events('wedge-removing')[0].time, W.remove, .02);
});

test('wedged and unattended: slip +0.4 per shove (1/3 squeak, 2/3 warning), the third pops (+0.15); gripping re-seats at 0.4/s', () => {
  const rig = wedged(); const o0 = rig.m.o;
  rig.until(s => s.slipEvents >= 1, 10, m => free(m)); rig.run(FRAME, m => free(m));
  assert.equal(rig.m.slipLevel, 1); near(rig.m.slip, S.slip, 1e-9);
  assert.equal(rig.events('wedge-slip')[0].level, 1);
  assert.equal(rig.m.o, o0, 'the wedge held the door');
  // Re-seat: hold 0.5 s -> 0.2, 1.0 s -> 0.
  rig.run(.5, hold); near(rig.m.slip, S.slip - S.reseat * .5, .01, 're-seat rate');
  // Second and third slip with the hands off.
  const pop = wedged(); const p0 = pop.m.o;
  pop.until(s => s.slipEvents >= 2, 15, m => free(m)); pop.run(FRAME, m => free(m));
  assert.equal(pop.m.slipLevel, 2); assert.equal(pop.events('wedge-slip')[1].level, 2);
  pop.until(s => pop.has('wedge-pop') || s.state !== 'playing', 10, m => free(m));
  assert.ok(pop.has('wedge-pop'), 'third shove pops'); assert.equal(pop.m.wedge, 'rest');
  pop.run(S.shove + .05, m => free(m));
  near(pop.m.o - p0, W.popPush, 1e-6, 'pop pushes 0.15');
});

test('C6b exits: one wedge slip then >= 1.0 s of grip; or two slips; the stall breaker hints after 3 absorbed shoves and moves on after 5', () => {
  const one = wedged();
  one.until(s => s.slipEvents >= 1, 10, m => free(m));
  const slipAt = one.t;
  one.until(s => s.beat === 'C6c', 3, hold);
  assert.equal(one.m.beat, 'C6c'); near(one.t - slipAt, T.beats.c6bGrip, .05, 'grip 1.0 s after the slip');
  const stall = c6b();
  stall.until(s => s.beat === 'C6c' || s.state !== 'playing', 40, hold);
  assert.equal(stall.m.beat, 'C6c');
  const hint = stall.events('wedge-hint')[0], absorbed = stall.events('shove').filter(e => e.result === 'held');
  assert.ok(hint && hint.id > absorbed[2].id && hint.id < (absorbed[3] ? absorbed[3].id : Infinity), 'hint after the 3rd absorbed shove');
  assert.equal(absorbed.length, S.skipAfter, 'C6c after 5 absorbed shoves');
});

test('C6c ends: visit 2 shut -> shoves stop -> slipper out + regrip 1.0 s -> C7 with the prop gone', () => {
  const rig = playTo('C6', s => s.beat === 'C7');
  assert.equal(rig.m.beat, 'C7'); assert.equal(rig.m.prop, false);
  const stop = rig.events('shoves-stop')[0], shut = rig.events('drawer-shut').filter(e => e.visit === 2)[0];
  assert.ok(stop && shut && stop.time >= shut.time);
  const out = rig.events('wedge-out').pop(), worn = rig.events('slipper-worn')[0];
  assert.ok(worn.time - out.time >= T.beats.c6cRegrip - .02);
  assert.equal(rig.m.toggleWedge(), false, 'no wedge after C6');
});

test('C6c worst case (wedge out at visit 2, wait for a gap, wedge, turn, watch): d <= 0.64, at most one pop, door <= 0.16', () => {
  const rig = playTo('C6', s => s.beat === 'C6c');
  // Take the slipper out and hold, as a player who had removed it would.
  free(rig.m); rig.m.toggleWedge(); rig.until(s => s.wedge === 'rest', 1); rig.m.grip();
  let phase = 'hold', maxD = 0, maxO = 0, maxSlip = 0;
  rig.until(s => s.beat !== 'C6c', 40, (m, s) => {
    if (phase === 'hold') { hold(m); if (s.drawer === 'open') phase = 'wait'; }
    else if (phase === 'wait') { hold(m); if (s.shovePhase === 'shove') phase = 'gap'; }
    else if (phase === 'gap') { hold(m); if (s.shovePhase === 'idle') { free(m); if (m.toggleWedge()) phase = 'wedging'; } }
    else if (phase === 'wedging') { if (s.wedge === 'in') { m.setTurn(true); phase = 'watch'; } }
    else if (phase === 'watch') { if (s.drawer === 'shut') { m.setTurn(false); phase = 'back'; } }
    else if (phase === 'back') { if (s.turn === 0) { hold(m); phase = 'end'; } }
    else if (phase === 'end') {
      if (!s.shoves && s.drawer === 'shut') { if (s.wedge === 'in') { free(m); m.toggleWedge(); } else if (s.wedge === 'rest') hold(m); }
      else hold(m);
    }
  }, FRAME, s => { if (s.beat === 'C6c') { maxD = Math.max(maxD, s.d); maxO = Math.max(maxO, s.o); maxSlip = Math.max(maxSlip, s.slip); } });
  assert.equal(rig.m.beat, 'C7', `${rig.m.state} ${rig.m.reason} phase ${phase}`);
  assert.ok(maxD <= .64, `d peaked at ${maxD.toFixed(3)}`);
  assert.ok(rig.events('wedge-pop').length <= 1);
  assert.ok(maxO <= .16 + 1e-9, `door peaked at ${maxO.toFixed(3)}`);
  assert.ok(maxSlip <= .8 + 1e-9, `slip peaked at ${maxSlip}`);
});
