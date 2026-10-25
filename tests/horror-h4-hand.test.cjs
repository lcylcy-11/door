// H4 H2 hand (spec section 5, "constants unchanged"): ports the intent of the retired H2 tests
// (tests/horror.test.cjs targeted the deleted core.js) to the DoorNight API.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { T, FRAME, Rig, playTo, botDriver } = require('./horror-h4-helpers.cjs');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b} +/- ${tol}, got ${a}`);
const H = T.hand;

// Set the H2 force target through the drag gesture (dForce positive LOWERS force).
function setForce(m, f) { if (m.held && m.handStage === 'grip') m.drag(0, -(f - m.forceTarget) / H.forceGain); }
function firstHand() { const rig = new Rig('C3'); rig.until(s => s.hand, 10); assert.equal(rig.m.hand, true); return rig; }
function lastHand() { const rig = playTo('C7', s => s.beat === 'F2' && s.hand); assert.equal(rig.m.beat, 'F2'); assert.equal(rig.m.hand, true); return rig; }
// The retired resist(): brace/push 0.84, ease 0.32.
function resist(rig, maxT = 19) {
  rig.until(s => s.handStage === 'released' || s.state !== 'playing', maxT, (m, s) => {
    if (!m.held) m.grip(); setForce(m, s.gripStage === 'ease' ? .32 : .84);
  });
}

test('H2 constants are the user-chosen values (unchanged)', () => {
  assert.deepEqual(
    [H.approach, H.cycle, H.brace, H.push, H.enemy.brace, H.enemy.push, H.enemy.ease, H.forceEffect, H.strongMin, H.pushGood, H.required,
      H.softMin, H.softMax, H.easeHold, H.retreat, H.strainRate, H.strainMax, H.strainDecay, H.strainWarn, H.strainLimit, H.failOpen, H.timeLimit,
      H.smoothing, H.lowClamp, H.forceGain],
    [1.35, 3.4, .75, 1.1, .11, .38, .025, .44, .74, .65, 2, .16, .48, .55, .7, 1.9, .25, .12, .5, .95, .96, 20, 14, .12, 2.8]);
});

test('both telegraphed hand encounters (C3 reveal, F2) are winnable with brace/push 0.84, ease 0.32', () => {
  const c3 = firstHand(); resist(c3);
  assert.equal(c3.m.state, 'playing'); assert.equal(c3.m.handStage, 'released'); assert.ok(c3.events('push-defended').length >= 2);
  assert.ok(c3.has('hand-retreat'));
  c3.until(s => s.beat === 'C4', 3);
  assert.equal(c3.m.beat, 'C4');
  const f2 = lastHand(); resist(f2);
  assert.equal(f2.m.state, 'playing'); assert.equal(f2.m.handStage, 'released'); assert.ok(f2.events('push-defended').length >= 2);
  assert.equal(f2.m.holder, 'none', 'the F2 retreat frees the door to seat');
});

test('timeline: approach 1.35 s, then cycles of brace 0.75 / push 1.1 / ease 1.55 (3.4 s)', () => {
  const rig = firstHand();
  const t0 = rig.events('scratch')[0].time;
  rig.run(8, (m, s) => { if (!m.held) m.grip(); setForce(m, s.gripStage === 'ease' ? .32 : .84); });
  near(rig.events('grip-on')[0].time - t0, H.approach, .02, 'approach');
  const g = rig.events('grip-on')[0].time;
  near(rig.events('inhale')[0].time - g, 0, .02, 'brace');
  near(rig.events('shove-hand')[0].time - g, H.brace, .02, 'push');
  near(rig.events('wood-release')[0].time - g, H.brace + H.push, .02, 'ease');
  near(rig.events('inhale')[1].time - g, H.cycle, .02, 'next cycle');
});

test('no constant-force policy wins (21 forces 0..1), in C3 and in F2', () => {
  for (const which of ['C3', 'F2']) {
    for (let i = 0; i <= 20; i++) {
      const force = i * .05;
      const rig = which === 'C3' ? firstHand() : lastHand();
      rig.until(s => s.state !== 'playing', 25, m => { if (!m.held) m.grip(); setForce(m, force); });
      assert.equal(rig.m.state, 'lost', `${which} constant force ${force.toFixed(2)}`);
      assert.equal(rig.has('hand-retreat'), false, `${which} constant force ${force.toFixed(2)} made the hand retreat`);
    }
  }
});

test('maximum force loses through strain rather than a silent timeout', () => {
  const rig = firstHand();
  rig.until(s => s.state !== 'playing', 15, m => { if (!m.held) m.grip(); setForce(m, 1); });
  assert.equal(rig.m.reason, 'strain');
  assert.ok(rig.has('strain-warning'), 'strain warned first');
});

test('an ignored hand fails by "hand" (door pushed to 0.96); a held-but-never-retreating fight times out at 20 s', () => {
  const idle = firstHand(); idle.until(s => s.state !== 'playing', 30);
  assert.equal(idle.m.reason, 'hand'); assert.ok(idle.m.o >= H.failOpen - 1e-9);
  // Defend every push (0.80) but never ease into the soft range (0.10): no retreat, no strain, door not opened.
  const rig = firstHand(); const t0 = rig.events('scratch')[0].time;
  rig.until(s => s.state !== 'playing', 30, (m, s) => { if (!m.held) m.grip(); setForce(m, s.gripStage === 'ease' ? .10 : .80); });
  assert.equal(rig.m.reason, 'hand');
  assert.ok(rig.m.o < H.failOpen, 'lost by the time limit, not by the opening');
  near(rig.events('lose')[0].time - t0, H.timeLimit + H.approach, .05, 'time limit');
});

test('defence threshold: f >= 0.74 for >= 0.65 s of a push', () => {
  const count = (brace, push) => {
    const rig = firstHand();
    rig.run(H.approach + H.cycle + .1, (m, s) => { if (!m.held) m.grip(); setForce(m, s.gripStage === 'ease' ? .32 : s.gripStage === 'push' ? push : brace); });
    return rig.events('push-defended').length;
  };
  assert.equal(count(.76, .76), 1, '0.76 held through the push defends it');
  assert.equal(count(.72, .72), 0, '0.72 never defends');
});

test('retreat needs two defended pushes, then f in 0.16-0.48 for 0.55 s during an ease', () => {
  const tooSoft = firstHand();
  tooSoft.run(12, (m, s) => { if (!m.held) m.grip(); setForce(m, s.gripStage === 'ease' ? .10 : .84); });
  assert.equal(tooSoft.has('hand-retreat'), false, 'ease below 0.16 does not release');
  const ok = firstHand();
  ok.run(12, (m, s) => { if (!m.held) m.grip(); setForce(m, s.gripStage === 'ease' ? .32 : .84); });
  const r = ok.events('hand-retreat')[0]; assert.ok(r);
  const defended = ok.events('push-defended');
  assert.equal(defended.length, 2);
  assert.ok(r.time > defended[1].time, 'retreat follows the second defence');
  const easeStart = ok.events('wood-release')[1].time;
  assert.ok(r.time - easeStart >= H.easeHold - .02 && r.time - easeStart <= H.easeHold + .35, `retreat ${(r.time - easeStart).toFixed(2)} s into the 2nd ease`);
});

test('strain: (f - 0.48) x 1.9 per s during an ease, decays 0.12/s, warns at 0.5, fails at 0.95', () => {
  const rig = firstHand();
  rig.until(s => s.gripStage === 'ease', 6, (m) => { if (!m.held) m.grip(); setForce(m, .7); });
  rig.run(.3, (m) => setForce(m, .7)); // let the force settle at 0.7
  const s0 = rig.m.strain; rig.run(.5, (m) => setForce(m, .7));
  near((rig.m.strain - s0) / .5, (.7 - H.softMax) * H.strainRate, .01, 'ease strain rate');
  rig.until(s => s.gripStage === 'brace', 2, (m) => setForce(m, .7));
  const s1 = rig.m.strain; rig.run(.5, (m) => setForce(m, .7));
  near((s1 - rig.m.strain) / .5, H.strainDecay, .005, 'strain decay outside the ease');
  // f > 0.96 adds 0.25/s at any stage.
  const max = firstHand(); max.until(s => s.gripStage === 'brace', 3, m => { if (!m.held) m.grip(); setForce(m, 1); });
  max.run(.3, m => setForce(m, 1)); assert.ok(max.m.force > .96); const s2 = max.m.strain; max.run(.4, m => setForce(m, 1));
  near((max.m.strain - s2) / .4, H.strainMax, .01, 'over-force strain');
  max.until(s => s.state !== 'playing', 15, m => setForce(m, 1));
  const warn = max.events('strain-warning')[0], lose = max.events('lose')[0];
  assert.ok(warn && lose && lose.time > warn.time);
  assert.ok(max.m.strain >= H.strainLimit - 1e-9);
});

test('door moves by (enemy - 0.44 f) dt; force smoothing 14/s; drag sets force, not the door, during the grip', () => {
  const rig = firstHand();
  rig.until(s => s.handStage === 'grip', 3, m => { if (!m.held) m.grip(); });
  setForce(rig.m, 0); rig.m.drag(.05, 0); // the door request is ignored in the grip
  rig.until(s => s.gripStage === 'push', 2, m => setForce(m, .5));
  rig.run(.4, m => setForce(m, .5));
  const o0 = rig.m.o; rig.run(.3, m => setForce(m, .5));
  near((rig.m.o - o0) / .3, H.enemy.push - H.forceEffect * .5, .003, 'push door rate at f = 0.5');
  // Smoothing: from 0 to 1, after 0.1 s force = 1 - exp(-1.4).
  const sm = firstHand(); sm.until(s => s.handStage === 'grip', 3, m => { if (!m.held) m.grip(); });
  near(sm.m.force, 0, 1e-9); setForce(sm.m, 1); sm.run(.1);
  near(sm.m.force, 1 - Math.exp(-H.smoothing * .1), .01, 'force smoothing');
  // dForce positive lowers the force: force += -dForce x 2.8.
  const before = sm.m.forceTarget; sm.m.drag(0, .1); near(sm.m.forceTarget, Math.max(0, before - .28), 1e-9, 'force gain 2.8');
});

test('lower clamp: in F2 the hand fight never forces the door below min(o, 0.12); no pry during the approach', () => {
  const rig = playTo('C7', s => s.beat === 'F2');
  const o0 = rig.m.o; let maxDuringApproach = o0, minO = 1;
  rig.until(s => s.handStage === 'released' || s.state !== 'playing', 25, (m, s) => {
    if (!m.held) m.grip(); setForce(m, s.gripStage === 'ease' ? .32 : .95);
  }, FRAME, s => { if (s.handStage === 'approach') maxDuringApproach = Math.max(maxDuringApproach, s.o); if (s.hand) minO = Math.min(minO, s.o); });
  assert.ok(maxDuringApproach <= o0 + 1e-9, `the approach pried the door to ${maxDuringApproach}`);
  assert.ok(minO >= Math.min(o0, H.lowClamp) - 1e-9, `forced below the clamp: ${minO}`);
});

test('release and pause erase force; a resumed grip has a grace to regrab (>= 0.8 s, at most once per 10 s)', () => {
  const rig = firstHand();
  rig.until(s => s.handStage === 'grip', 3, m => { if (!m.held) m.grip(); });
  setForce(rig.m, .9); rig.run(.3);
  rig.m.letGo(); assert.equal(rig.m.force, 0); assert.equal(rig.m.forceTarget, 0);
  rig.m.grip(); setForce(rig.m, .8); rig.run(.1);
  rig.m.setPaused(true); assert.equal(rig.m.force, 0); assert.equal(rig.m.held, false);
  rig.m.setPaused(false);
  assert.ok(rig.m.resumeGrace > 0);
  const p = rig.m.o; rig.run(.8);
  assert.equal(rig.m.o, p, 'the hand does not push during the resume grace');
  // A second pause within 10 s gets no grace.
  rig.run(1); rig.m.setPaused(true); rig.m.setPaused(false);
  assert.equal(rig.m.resumeGrace, 0, 'grace at most once per 10 s');
});

test('pause freezes the hand deadline exactly (snapshot-identical)', () => {
  const rig = firstHand(); rig.m.grip(); rig.run(1);
  rig.m.setPaused(true); rig.drain();
  const s = rig.m.snapshot();
  rig.run(20, m => { m.grip(); m.drag(-.05, -.05); m.setGaze(true); m.toggleLight(); });
  assert.deepEqual(rig.m.snapshot(), s);
  assert.equal(rig.m.events.length, 0);
});
