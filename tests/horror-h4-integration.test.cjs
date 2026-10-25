// H4 integration (spec sections 8, 9, 10, 12.3): bots clear the night, policy sweeps lose at the
// intended gimmick, pause freezes exactly, checkpoints rebuild canonical states.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Night, T, FRAME, Rig, botDriver, playTo, invariantErrors } = require('./horror-h4-helpers.cjs');
const { perceptualRun } = require('./horror-h4-perceptual.cjs');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b} +/- ${tol}, got ${a}`);
function fullRun(opts = {}, maxT = 400) {
  const rig = new Rig('P0'); const errors = [];
  rig.until(s => s.state !== 'playing', maxT, botDriver(opts), FRAME, s => { for (const e of invariantErrors(s)) errors.push(`${s.beat} t=${s.time.toFixed(2)}: ${e}`); });
  return { rig, errors };
}
// Spec 12 oracle table, in order (the model's slip event is named "wedge-slip").
const ORACLE = [['bolt-free', 'C1'], [null, 'C2'], ['confirm', 'C3'], ['hand-retreat', 'C4'], ['eyes-gone', 'C5'], ['fingers-out', 'C6a'],
  ['drawer-shut', 'C6b'], ['wedge-slip', 'C6c'], ['wedge-out', 'C7'], ['pull', 'F1'], ['eyes-gone', 'F2'], ['seat', 'F3'], ['latch-click', 'END']];
// Keys whose values differ between two snapshots (deep compare of JSON values).
function diffKeys(a, b) { return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]) || (a[k] === undefined) !== (b[k] === undefined)); }
function checkOracle(rig) {
  let from = 0;
  for (const [type, beat] of ORACLE) {
    const enter = rig.log.findIndex((e, i) => i >= from && e.type === 'beat' && e.beat === beat);
    assert.ok(enter >= 0, `never entered ${beat}`);
    if (type) {
      const ev = rig.log.slice(from, enter + 1).filter(e => e.type === type);
      assert.ok(ev.length, `${type} before ${beat}`);
    }
    from = enter;
  }
}

test('the ideal bot clears the whole night dark and lit, every invariant holds, oracle events in order', () => {
  for (const lit of [false, true]) {
    const { rig, errors } = fullRun({ lit });
    assert.equal(rig.m.state, 'won', `lit=${lit}: ${rig.m.reason} in ${rig.m.beat}`);
    checkOracle(rig);
    const confirm = rig.events('confirm')[0]; assert.equal(confirm.route, lit ? 'lit' : 'dark');
    const kinds = [...new Set(errors.map(e => e.replace(/ t=[0-9.]+/, '')))];
    assert.deepEqual(kinds, [], `lit=${lit} invariant violations (first: ${errors[0]}, ${errors.length} frames)`);
  }
});

test('a perceptual bot acting on 0.35 s old state clears dark and lit; at 1.2 s delay it fails somewhere', () => {
  for (const lit of [false, true]) {
    const errors = [];
    const rig = perceptualRun({ delay: .35, lit, record: s => { for (const e of invariantErrors(s)) errors.push(`${s.beat}: ${e}`); } });
    assert.equal(rig.m.state, 'won', `lit=${lit}: ${rig.m.reason} in ${rig.m.beat}`);
    assert.deepEqual(errors.slice(0, 5), []);
  }
  const slow = perceptualRun({ delay: 1.2 });
  assert.equal(slow.m.state, 'lost', 'a 1.2 s reaction delay is not enough');
});

test('policy sweep: no masks -> "noise" in C1', () => {
  const rig = new Rig('P0'); let maxA = 0;
  rig.until(s => s.state !== 'playing', 400, botDriver({ noMask: true }), FRAME, s => { if (s.beat === 'C1') maxA = Math.max(maxA, s.A); });
  assert.equal(rig.m.state, 'lost', `no-mask policy ${rig.m.state} in ${rig.m.beat}; peak A in C1 ${maxA.toFixed(3)}`);
  assert.equal(rig.m.reason, 'noise'); assert.equal(rig.m.beat, 'C1');
});

test('policy sweep: never look down -> "eyes" in C4', () => {
  const { rig } = fullRun({ noGaze: true });
  assert.equal(rig.m.reason, 'eyes'); assert.equal(rig.m.beat, 'C4');
});

test('policy sweep: never turn -> "drawer" in C6a', () => {
  const { rig } = fullRun({ noTurn: true });
  assert.equal(rig.m.reason, 'drawer'); assert.equal(rig.m.beat, 'C6a');
});

test('policy sweep: never wedge and never hold -> "forced" in C6b', () => {
  const { rig } = fullRun({ noWedgeNoHold: true });
  assert.equal(rig.m.reason, 'forced'); assert.equal(rig.m.beat, 'C6b');
});

test('policy sweep: direct close in C5 -> "mimic" (grabs pull the door open past o5 + 0.24)', () => {
  const { rig } = fullRun({ directClose: true });
  assert.equal(rig.m.reason, 'mimic'); assert.equal(rig.m.beat, 'C5');
  assert.ok(rig.events('mimic-yank').length >= 3);
  assert.ok(rig.events('mimic-yank').every(e => e.why === 'pinch'));
});

test('policy sweep: fast latch in F3 -> "noise"', () => {
  const { rig } = fullRun({ fastLatch: true });
  assert.equal(rig.m.reason, 'noise'); assert.equal(rig.m.beat, 'F3');
  assert.ok(rig.events('latch-rattle').filter(e => e.beat === 'F3').length >= 4);
});

test('masks are never active in C6a/C6b/C6c on the bot route (invariant)', () => {
  const { rig } = fullRun();
  const bad = rig.log.filter(e => ['C6a', 'C6b', 'C6c'].includes(e.beat) && (e.type === 'mask-start' || e.type === 'cover-on'));
  assert.deepEqual(bad.map(e => `${e.beat} ${e.type}`), []);
});

// ---- pause ------------------------------------------------------------------------------------------
test('pause freezes the snapshot exactly in every threat, ignores intents and emits nothing', () => {
  const stops = { C3: s => s.handStage === 'grip', C4: s => s.eyes === 'open', C5: s => s.mimic === 'delay' || s.mimic === 'watch', C6: s => s.drawer === 'open', C7: s => s.beat === 'F3' };
  for (const [cp, stop] of Object.entries(stops)) {
    const rig = cp === 'C7' ? playTo('C7', stop) : new Rig(cp);
    if (cp !== 'C7') rig.until(stop, 20, botDriver());
    rig.run(.3, botDriver());
    rig.m.setPaused(true); rig.drain();
    const s = rig.m.snapshot(), sound = JSON.stringify(rig.m.soundState());
    const sources = rig.m.sources.map(x => x.t).join();
    rig.run(15, m => { m.grip(); m.drag(-.05, .05); m.setGaze(true); m.setTurn(true); m.toggleLight(); m.toggleWedge(); m.grabBolt(); m.dragBolt(.1); m.update(.5); });
    assert.deepEqual(rig.m.snapshot(), s, `${cp}: snapshot changed while paused`);
    assert.equal(rig.log.filter(e => e.time > s.time).length, 0, `${cp}: events while paused`);
    assert.equal(rig.m.held, false); assert.equal(rig.m.gazeDown, false); assert.equal(rig.m.boltHeld, false);
    assert.equal(JSON.stringify(rig.m.soundState()), sound, `${cp}: sound state changed while paused`);
    assert.equal(rig.m.sources.map(x => x.t).join(), sources, `${cp}: mask offsets advanced while paused`);
    rig.m.setPaused(false); rig.run(.1);
    assert.ok(rig.m.time > s.time, `${cp}: resumes`);
  }
});

test('resume grace (1.0 s, at most once per 10 s) freezes E, drawer d, shoves and mimic timers', () => {
  const eyes = new Rig('C4'); eyes.until(s => s.E > .1, 10);
  eyes.m.setPaused(true); eyes.m.setPaused(false); const E0 = eyes.m.E; eyes.run(.95);
  assert.equal(eyes.m.E, E0, 'E frozen during the grace');
  eyes.run(.2); assert.ok(eyes.m.E > E0);
  const drawer = new Rig('C6'); drawer.until(s => s.d > .05, 10);
  drawer.m.setPaused(true); drawer.m.setPaused(false); const d0 = drawer.m.d; drawer.run(.95);
  assert.equal(drawer.m.d, d0, 'd frozen during the grace');
  drawer.run(1); drawer.m.setPaused(true); drawer.m.setPaused(false);
  assert.equal(drawer.m.resumeGrace, 0, 'no second grace within 10 s');
  const mimic = new Rig('C5'); mimic.until(s => s.mimic === 'watch', 10, m => { if (!m.held) m.grip(); });
  mimic.m.setPaused(true); mimic.m.setPaused(false); const mt = mimic.m.mimicTime; mimic.run(.95);
  assert.equal(mimic.m.mimicTime, mt, 'mimic timers frozen during the grace');
  const sh = playTo('C6', s => s.beat === 'C6b' && s.shoves);
  sh.m.setPaused(true); sh.m.setPaused(false); const sc = sh.m.shoveClock; sh.run(.95, m => { if (!m.held) m.grip(); });
  assert.equal(sh.m.shoveClock, sc, 'shove clock frozen during the grace');
});

// ---- checkpoints --------------------------------------------------------------------------------------
const CANON = {
  P0: { beat: 'P0', o: 0, b: 1, flush: true, holder: 'none' },
  C1: { beat: 'C1', o: 0, b: 0, flush: true, holder: 'none' },
  C2: { beat: 'C2', o: .45, b: 0, holder: 'none' },
  C3: { beat: 'C3', o: .62, holder: 'none' },
  C4: { beat: 'C4', o: .62, holder: 'min045' },
  C5: { beat: 'C5', o: .55 },
  C6: { beat: 'C6a', o: .012, d: 0, holder: 'unseated012', prop: true },
  C7: { beat: 'C7', o: .012, prop: false, holder: 'unseated012' }
};
const QUIET = { hand: false, eyes: 'none', mimic: 'none', drawer: 'idle', wedge: 'rest', shoves: false, E: 0, P: 0, strain: 0, slip: 0, held: false, boltHeld: false, gazeDown: false, wantRear: false, state: 'playing', paused: false };

test('each checkpoint start yields its canonical state (spec section 10)', () => {
  for (const [cp, canon] of Object.entries(CANON)) {
    const m = new Night(); m.start(cp); const s = m.snapshot();
    for (const [k, v] of Object.entries({ ...QUIET, ...canon })) assert.equal(s[k], v, `${cp}.${k}`);
    assert.equal(s.A, 0); assert.equal(s.light, false); assert.equal(s.cp, cp);
  }
});

test('retry rebuilds the checkpoint deep-equal to a fresh start, with A capped at 0.30 and the light as it was', () => {
  // Lit route with attention: reach C5, fail there, retry.
  const rig = new Rig('P0'); const drive = botDriver({ lit: true });
  rig.until(s => s.beat === 'C5' && s.mimic === 'watch', 200, drive);
  assert.equal(rig.m.beat, 'C5');
  const cpA = rig.m.cp.A; assert.ok(cpA <= T.attention.checkpointCap + 1e-12);
  assert.equal(rig.m.cp.light, true);
  rig.until(s => s.state !== 'playing', 60, m => { if (!m.held) m.grip(); m.drag(-.05); });
  assert.equal(rig.m.state, 'lost');
  rig.m.retry();
  const fresh = new Night(); fresh.start('C5');
  const a = { ...rig.m.snapshot() }, b = { ...fresh.snapshot() };
  assert.equal(a.light, true, 'light restored'); assert.ok(a.A <= .3 + 1e-12); assert.equal(a.A, cpA);
  for (const k of ['attempt', 'hint', 'A', 'light', 'lit', 'canSwitch']) { delete a[k]; delete b[k]; }
  assert.deepEqual(diffKeys(a, b), [], 'retry differs from a fresh checkpoint start');
  // Attention is capped at 0.30 when a checkpoint is entered by play.
  const loud = new Rig('C1'); loud.until(s => s.beat !== 'C1' || s.state !== 'playing', 10, m => { if (!m.held) m.grip(); m.drag(.12 * FRAME); });
  if (loud.m.beat === 'C2') assert.ok(loud.m.A <= .3 + 1e-12 && loud.m.cp.A <= .3 + 1e-12, `A at C2 entry ${loud.m.A}`);
});

test('two fails on the same beat raise the hint level; start("P0") resets everything', () => {
  const m = new Night(); m.start('C4');
  for (let i = 0; i < 2; i++) { while (m.state === 'playing') m.update(FRAME); m.retry(); }
  assert.equal(m.hint, 2, 'second hint after two fails');
  const deep = playTo('C7', s => s.beat === 'F3');
  deep.m.start('P0');
  const fresh = new Night(); fresh.start('P0');
  const a = { ...deep.m.snapshot() }, b = { ...fresh.snapshot() };
  delete a.attempt; delete b.attempt;
  assert.deepEqual(diffKeys(a, b), [], 'start("P0") after a deep run differs from a fresh start');
});

test('C7 entry caps attention at 0.30 and the forced pull never fails', () => {
  const rig = new Rig('C6');
  rig.until(s => s.beat === 'C7', 120, botDriver());
  assert.ok(rig.m.A <= .3 + 1e-12);
  rig.until(s => s.beat === 'F1' || s.state !== 'playing', 15);
  assert.equal(rig.m.beat, 'F1'); assert.equal(rig.m.state, 'playing');
});

test('fairness: eyes telegraph (breath) to warning >= 2.0 s and warning to fail >= 0.6 s (C4, F1)', () => {
  for (const cp of ['C4', 'C7']) {
    const rig = new Rig(cp); rig.until(s => s.state !== 'playing', 30);
    assert.equal(rig.m.reason, 'eyes');
    const breath = rig.events('breath')[0].time, warn = rig.events('eyes-warning')[0].time, lose = rig.events('lose')[0].time;
    assert.ok(warn - breath >= 2.0, `${cp}: breath to warning ${(warn - breath).toFixed(2)} s`);
    assert.ok(lose - warn >= .6, `${cp}: warning to fail ${(lose - warn).toFixed(2)} s`);
  }
});
