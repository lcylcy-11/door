// H4 door and attention (spec section 1: bands, caps, slam, flush catch, holder, stillness, meter A).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { T, FRAME, Rig, moveDoor, injectCover } = require('./horror-h4-helpers.cjs');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b} +/- ${tol}, got ${a}`);
// Hold the grip and request `perFrame` of door travel every frame for `seconds`.
function push(rig, perFrame, seconds, stop, dt = FRAME) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    if (!rig.m.held) rig.m.grip();
    rig.m.drag(perFrame); rig.m.update(dt); rig.t += dt;
    const ev = rig.drain();
    if (stop && stop(rig.m, ev)) return i + 1;
  }
  return n;
}

test('quiet band A caps player speed at 0.40/s and discards excess drag (never banked)', () => {
  const rig = new Rig('C1');
  moveDoor(rig, .05, .1); // unflush gently
  assert.equal(rig.m.flush, false);
  let o0 = rig.m.o; push(rig, .05, .2);
  near((rig.m.o - o0) / .2, .40, 1e-6, 'quiet A speed');
  o0 = rig.m.o; rig.run(.5);
  assert.equal(rig.m.o, o0, 'a burst of excess drag must not keep moving the door afterwards');
  rig.m.drag(10); rig.m.update(FRAME);
  assert.ok(rig.m.o - o0 <= T.door.capQuiet * FRAME + 1e-9, 'a giant pointer jump is still capped');
});

test('stiff band caps speed at 0.12/s; uncovered motion there costs tuning.attention.scrape x |do|', () => {
  const rig = new Rig('C2'); // o = 0.45, masks not yet audible in the first seconds
  rig.m.grip();
  let last = rig.m.o, maxStiff = 0;
  for (let i = 0; i < 30; i++) {
    rig.m.drag(-.05); rig.m.update(FRAME); rig.drain();
    if (rig.m.o < .4 - 1e-9 && last <= .4) maxStiff = Math.max(maxStiff, (last - rig.m.o) / FRAME);
    last = rig.m.o;
  }
  assert.ok(rig.m.o < .4, 'reached the stiff band');
  assert.ok(maxStiff <= T.door.capStiff + 1e-6, `stiff speed ${maxStiff}`);
  assert.equal(rig.m.covered, false);
  // Spec said 4.0; tuned to 4.2 (provisional) so a fully unmasked C1 crossing still fails after the free first creak.
  near(rig.m.A, T.attention.scrape * (.4 - rig.m.o), 1e-6, 'stiff cost');
});

test('quiet band B caps at 0.40/s and the player stops at 0.80; arriving fast is an open-end slam', () => {
  const rig = new Rig('C2');
  let o0 = rig.m.o; push(rig, .05, .1);
  near((rig.m.o - o0) / .1, .40, 1e-6, 'quiet B speed');
  const frames = push(rig, .05 / 2, 2, (m, ev) => ev.some(e => e.type === 'slam'), T.step);
  assert.ok(frames < 240, 'slam happened');
  const slam = rig.events('slam')[0];
  assert.equal(slam.end, 'open');
  near(rig.m.A, T.attention.slam, 1e-9, 'slam cost');
  near(rig.m.o, T.door.playerMax - T.door.bounce, 1e-9, 'bounce from the open end');
  // Gentle arrival at the open stop: no slam and never past 0.80.
  const g = new Rig('C2'); push(g, .3 * FRAME, 2);
  assert.equal(g.events('slam').length, 0);
  near(g.m.o, T.door.playerMax, 1e-9, 'player max');
});

test('slam at the closed stop: > 0.35/s costs +0.30 (unmaskable) and bounces to 0.02', () => {
  for (const covered of [false, true]) {
    const rig = new Rig('C1'); moveDoor(rig, .12, .3);
    if (covered) { injectCover(rig.m); rig.run(FRAME); assert.equal(rig.m.covered, true); }
    const A0 = rig.m.A;
    push(rig, -.36 * T.step, 2, (m, ev) => ev.some(e => e.type === 'slam'), T.step);
    assert.equal(rig.events('slam').length, 1, `covered=${covered}: one slam`);
    near(rig.m.A - A0, T.attention.slam, 1e-9, `covered=${covered}: slam cost`);
    near(rig.m.o, T.door.bounce, 1e-9, 'bounced to 0.02');
    assert.equal(rig.m.flush, false);
  }
  const soft = new Rig('C1'); moveDoor(soft, .12, .3);
  push(soft, -.30 * FRAME, 1.5);
  assert.equal(soft.events('slam').length, 0, '0.30/s is not a slam');
  assert.equal(soft.m.o, 0); assert.equal(soft.m.flush, true); assert.ok(soft.has('flush'));
});

test('a steady 0.34/s close (below the 0.35/s slam speed over a 100 ms window) is not a slam', () => {
  for (const speed of [.32, .34]) {
    const soft = new Rig('C1'); moveDoor(soft, .12, .3);
    push(soft, -speed * FRAME, 1.5);
    assert.equal(soft.events('slam').length, 0, `${speed}/s must not slam (slam is > 0.35/s)`);
    assert.equal(soft.m.flush, true);
  }
});

test('flush catch holds the door at 0 until a deliberate opening drag of more than 0.02', () => {
  const rig = new Rig('C1');
  moveDoor(rig, .1, .3); moveDoor(rig, -.1, .2);
  assert.equal(rig.m.o, 0); assert.equal(rig.m.flush, true);
  // Release jitter: alternating tiny drags never unseat it.
  rig.run(2, (m, s, dt) => { if (!m.held) m.grip(); m.drag((Math.floor(rig.t * 60) % 2 ? 1 : -1) * .004); });
  assert.equal(rig.m.o, 0); assert.equal(rig.m.flush, true);
  rig.m.letGo(); rig.m.grip();
  moveDoor(rig, .015, .1);
  assert.equal(rig.m.o, 0, '0.015 of opening drag is absorbed'); assert.equal(rig.m.flush, true);
  moveDoor(rig, .015, .1);
  assert.equal(rig.m.flush, false, 'more than 0.02 in total unseats it');
  assert.ok(rig.m.o > 0 && rig.m.o <= .0101, `opened by the excess only: ${rig.m.o}`);
  assert.ok(rig.has('unflush'));
});

test('attention: decay 0.006/s only after 3.0 s with no gain', () => {
  const rig = new Rig('C2');
  rig.m.grip(); push(rig, -.05, .5);
  rig.m.letGo(); rig.run(FRAME);
  const A0 = rig.m.A; assert.ok(A0 > .1, `A0 ${A0}`);
  rig.run(2.9);
  near(rig.m.A, A0, 1e-12, 'no decay before 3.0 s');
  rig.run(2.1);
  near(rig.m.A, A0 - T.attention.decay * (5 + FRAME - 3) , .0015, 'decay after 3 s');
});

function rattleRun() {
  const rig = new Rig('P0');
  rig.m.grabBolt();
  const rattles = () => rig.events('latch-rattle').length;
  // Jerks: lift at 1/s for 0.1 s, then wait 0.35 s (past the rattle cooldown), repeat.
  rig.until(s => s.state !== 'playing', 20, m => { if (!m.boltHeld) m.grabBolt(); if ((rig.t % .45) < .1) m.dragBolt(-1 * FRAME); });
  return { rig, rattles };
}
test('P0: 7 rattles of +0.15 fail by noise; both warnings knock on the floor', () => {
  const { rig, rattles } = rattleRun();
  assert.equal(rig.m.state, 'lost'); assert.equal(rig.m.reason, 'noise');
  assert.equal(rattles(), 7, '7 rattles of 0.15 reach 1.0');
  const w = rig.events('warning');
  assert.deepEqual(w.map(e => e.level), [0, 1]);
  assert.ok(w.every(e => e.glass === false), 'P0-C2 warnings knock on the floor');
});
test('P0: the first warning fires when A reaches 0.45 (3rd rattle), the second at 0.75 (5th rattle)', () => {
  const { rig } = rattleRun();
  const w = rig.events('warning');
  const rattleAt = rig.events('latch-rattle').map(e => e.id);
  assert.ok(w[0].id > rattleAt[2] && w[0].id < rattleAt[3], 'first warning on the 3rd rattle (0.45)');
  assert.ok(w[1].id > rattleAt[4] && w[1].id < rattleAt[5], 'second warning on the 5th rattle (0.75)');
});

test('from C3 the attention warnings knock on the glass', () => {
  const rig = new Rig('C3');
  // Two open-end slams before the hand arrives: 0.60 >= 0.45.
  push(rig, .05, 1, (m, ev) => ev.some(e => e.type === 'slam'));
  // A slam recoils for T.door.recoil (closing blocked), so wait it out before the second approach.
  rig.run(T.door.recoil + .1); push(rig, -.05, .3); push(rig, .05, 1, (m, ev) => ev.some(e => e.type === 'slam'));
  assert.equal(rig.events('slam').length, 2);
  const w = rig.events('warning');
  assert.equal(w.length, 1); assert.equal(w[0].glass, true);
});

test('enemy-driven motion never adds attention (H2 push, shoves, C7 pull)', () => {
  // H2: an ignored hand pushes the door from 0.62 to 0.96 with no attention.
  const h = new Rig('C3');
  h.until(s => s.state !== 'playing', 40);
  assert.equal(h.m.reason, 'hand'); assert.equal(h.m.A, 0);
  assert.ok(h.m.o >= T.hand.failOpen - 1e-9 && h.m.o > T.door.playerMax, 'enemies can push past the player max 0.80');
  // C7 pull: 0.012 -> 0.62 through the stiff band, no attention.
  const p = new Rig('C7');
  p.until(s => s.beat === 'F1', 20);
  assert.equal(p.m.beat, 'F1'); assert.equal(p.m.A, 0);
  near(p.m.o, T.beats.pullTo, 1e-9, 'pulled to 0.62');
});

test('holder min045: closing stops at 0.45; a door shut before the C3 reveal is pried back to 0.45 by the hand', () => {
  const rig = new Rig('C4');
  assert.equal(rig.m.holder, 'min045');
  push(rig, -.05, 1);
  near(rig.m.o, .45, 1e-9, 'stops at the 0.45 floor');
  // Review fix: closing before the reveal must not skip the eyes (C4 needs o >= 0.21), so the hand pries it open.
  const c3 = new Rig('C3');
  push(c3, -.05, .6); // 0.62 -> ~0.40 -> into the stiff band a little
  c3.m.letGo();
  const before = c3.m.o; assert.ok(before < .45);
  c3.until(s => s.holder === 'min045', 10);
  assert.equal(c3.m.holder, 'min045'); near(c3.m.holderFloor, .45, 1e-9);
  c3.until(s => s.handStage === 'grip', 5);
  assert.ok(c3.m.o >= .45 - 1e-9, `pried to 0.45 (o ${c3.m.o})`);
});

test('holder unseated012 stops closing at 0.012 (never flush) in C6 and C7', () => {
  for (const cp of ['C6', 'C7']) {
    const rig = new Rig(cp);
    assert.equal(rig.m.holder, 'unseated012');
    push(rig, -.05, .5);
    near(rig.m.o, .012, 1e-9, `${cp} floor`); assert.equal(rig.m.flush, false);
    assert.equal(rig.events('slam').length, 0, `${cp}: the floor is not an end stop`);
  }
});

test('stillness is jitter-safe: tiny wobble still adapts the eyes in C2, a steady drift does not', () => {
  const still = new Rig('C2');
  moveDoor(still, .03, .2);
  const t0 = still.t;
  still.until(s => s.confirmRoute === 'dark', 12, (m) => { if (!m.held) m.grip(); m.drag((Math.round(still.t * 60) % 2 ? 1 : -1) * .002); });
  assert.equal(still.m.confirmRoute, 'dark', 'confirmed in the dark despite +/-0.002 jitter');
  assert.ok(still.t - t0 <= T.corridor.flicker + T.corridor.adaptTime + .6);
  const sway = new Rig('C2');
  moveDoor(sway, .03, .2);
  // A steady 0.03/s drift moves 0.0075 per 0.25 s: never still.
  sway.run(8, (m) => { if (!m.held) m.grip(); m.drag(.03 * FRAME); });
  assert.equal(sway.m.confirmRoute, '', 'a visible drift is not stillness');
  assert.equal(sway.m.adapt, 0);
});
