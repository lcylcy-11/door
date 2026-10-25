// H4 G6 mimic fingers (spec sections 4 C5, 5 G6, 9): arrival, bait boundaries, refractory, delay,
// response copy, net-referenced pinch, grab yank, loiter, finger-drag caps, fail and exit.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { T, FRAME, Rig, botDriver } = require('./horror-h4-helpers.cjs');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b} +/- ${tol}, got ${a}`);
const M = T.mimic;
const hold = m => { if (!m.held) m.grip(); };
function toWatch() { const rig = new Rig('C5'); rig.until(s => s.mimic === 'watch', 10, hold); assert.equal(rig.m.mimic, 'watch'); return rig; }
// Open (positive) or close by exactly `amount` at `speed`/s, then stop.
function nudge(rig, amount, speed = .1) {
  let left = Math.abs(amount); const sign = Math.sign(amount);
  while (left > 1e-12) { const d = Math.min(left, speed * FRAME); left -= d; hold(rig.m); rig.m.drag(sign * d); rig.m.update(FRAME); rig.t += FRAME; rig.drain(); }
}

test('arrival: fingers at +5.0 s (TV back 1.5, hold 2.0, hush 1.5); ARRIVE 2.0 s blocks closing with no pinch; then WATCH', () => {
  const rig = new Rig('C5');
  rig.until(s => s.mimic === 'arrive', 8, hold);
  near(rig.events('fingers')[0].time, M.intro[0] + M.intro[1] + M.intro[2], .02, 'arrival');
  const o5 = rig.m.o; assert.equal(rig.m.o5, o5);
  rig.run(1.5, m => { hold(m); m.drag(-.05); });
  assert.equal(rig.m.o, o5, 'closing blocked during ARRIVE'); assert.equal(rig.m.P, 0);
  rig.until(s => s.mimic === 'watch', 1, hold);
  near(rig.events('mimic-watch')[0].time - rig.events('fingers')[0].time, M.arrive, .02, 'WATCH after 2.0 s');
});

test('finger-drag caps while the fingers hold the edge: 0.15/s quiet, 0.12/s stiff', () => {
  const rig = toWatch();
  const o0 = rig.m.o; rig.run(.1, m => { hold(m); m.drag(.05); });
  near((rig.m.o - o0) / .1, T.door.fingerQuiet, 1e-6, 'quiet finger cap');
});

test('bait boundaries: 0.0199 is ignored, 0.020 starts a DELAY', () => {
  const small = toWatch(); nudge(small, .0199); small.run(3, hold);
  assert.equal(small.has('mimic-delay'), false, '0.0199 is not a bait');
  const exact = toWatch(); nudge(exact, .02); exact.run(1, hold);
  assert.equal(exact.has('mimic-delay'), true, '0.020 is a bait');
  // Spread over more than 1.0 s it is not a bait either.
  const slow = toWatch(); nudge(slow, .03, .01); slow.run(2, hold);
  assert.equal(slow.has('mimic-delay'), false, 'a 0.03 opening spread over 3 s is not a bait');
});

test('DELAY 0.9 s, then RESPONSE 1.2 s pulling the door open by min(bait, 0.04); large baits are flagged', () => {
  for (const [bait, copy] of [[.03, .03], [.06, .04]]) {
    const rig = toWatch(); nudge(rig, bait);
    rig.until(s => s.mimic === 'delay', 1, hold);
    const oBait = rig.m.o;
    rig.until(s => s.mimic === 'response', 2, hold);
    near(rig.events('mimic-response')[0].time - rig.events('mimic-delay')[0].time, M.delay, .02, 'delay');
    rig.until(s => s.mimic !== 'response', 2, hold);
    near(rig.events('mimic-recover')[0].time - rig.events('mimic-response')[0].time, M.response, .02, 'response');
    near(rig.m.o - oBait, copy, 1e-6, `copy of a ${bait} bait`);
    assert.equal(rig.has('bait-large'), false);
  }
  const big = toWatch(); nudge(big, .12, .15); big.run(.5, hold);
  assert.ok(big.has('bait-large'), 'a bait over 0.10 is flagged');
});

test('baits are refractory outside WATCH (an opening during DELAY or RECOVER never chains a new cycle)', () => {
  // During DELAY.
  const d = toWatch(); nudge(d, .03); d.until(s => s.mimic === 'delay', 1, hold);
  d.run(.1, hold); nudge(d, .03);
  d.until(s => s.mimic === 'watch', 4, hold);
  d.run(1.5, hold);
  assert.equal(d.events('mimic-delay').length, 1, 'an opening during DELAY is not a bait');
  // During RECOVER (pinch off for its first 0.3 s): open 0.03, then stay still.
  const r = toWatch(); nudge(r, .03); r.until(s => s.mimic === 'recover', 4, hold);
  r.run(.05, hold); nudge(r, .03);
  r.until(s => s.mimic === 'watch', 2, hold);
  r.run(1.2, hold);
  const second = r.events('mimic-delay')[1];
  assert.ok(!second, `an opening made during RECOVER started a DELAY ${second ? (second.time - r.events('mimic-watch')[1].time).toFixed(3) + ' s after WATCH resumed' : ''}`);
});

test('pinch is net-referenced: 0.012 warns, 0.020 grabs; tiny closes sum; +/-1 px jitter for 60 s never grabs', () => {
  const warn = toWatch(); nudge(warn, -.013); warn.run(.5, hold);
  assert.ok(warn.has('pinch-warning')); assert.equal(warn.has('mimic-grab'), false);
  const grab = toWatch(); nudge(grab, -.021); grab.run(.1, hold);
  assert.ok(grab.log.some(e => e.type === 'mimic-yank' && e.why === 'pinch'));
  // Creeping: 0.001 every 0.5 s adds up.
  const creep = toWatch(); let n = 0;
  creep.until(s => s.mimic === 'grab', 15, (m) => { hold(m); if (++n % 30 === 0) m.drag(-.001); });
  assert.ok(creep.log.some(e => e.type === 'mimic-yank' && e.why === 'pinch'), 'tiny closes cannot sum unnoticed');
  // Jitter of one pixel (1/440) both ways, every frame, for 60 s.
  const jit = toWatch(); let k = 0, maxP = 0;
  jit.run(60, (m) => { hold(m); m.drag((k++ % 2 ? -1 : 1) / 440); }, FRAME, s => { maxP = Math.max(maxP, s.P); });
  assert.equal(jit.log.filter(e => e.type === 'mimic-yank' && e.why === 'pinch').length, 0, 'jitter never pinches');
  assert.ok(maxP < M.pinchWarn, `max P ${maxP}`);
  assert.equal(jit.m.state, 'playing');
});

test('grab: masks duck, the door is yanked +0.08 over 0.3 s, closing is blocked for 1.2 s, then WATCH from the new reference', () => {
  const rig = toWatch(); const ref = rig.m.oRef; nudge(rig, -.021);
  assert.equal(rig.m.mimic, 'grab');
  const o0 = ref - M.pinchGrab, yank = rig.events('mimic-yank')[0].time; // the door when P reached 0.020
  rig.run(.3 + FRAME, m => { hold(m); m.drag(-.05); });
  near(rig.m.o - o0, M.yank, .0015, 'yank complete within 0.3 s');
  rig.until(s => s.mimic === 'watch', 1.5, m => { hold(m); m.drag(-.05); });
  near(rig.events('mimic-watch')[1].time - yank, M.grab, .02, 'grab lasts 1.2 s');
  near(rig.m.o - o0, M.yank, .002, 'closing was blocked during the grab');
  // The policy keeps pushing right on the frame WATCH begins, so allow that frame's sub-step closing.
  near(rig.m.oRef, rig.m.o, .003, 'new reference');
});

test('loiter: no net close of 0.02 in 20 s taps, again at 25 s, grabs at 30 s', () => {
  const rig = toWatch();
  rig.until(s => s.mimic === 'grab', 35, hold);
  const taps = rig.events('loiter-tap');
  assert.equal(taps.length, 2);
  const watch = rig.events('mimic-watch')[0].time;
  near(taps[0].time - watch, M.loiterTap[0], .03); near(taps[1].time - watch, M.loiterTap[1], .03);
  const g = rig.log.find(e => e.type === 'mimic-yank');
  assert.equal(g.why, 'loiter'); near(g.time - watch, M.loiterGrab, .03);
});

test('fail "mimic" when grabs drag the door to min(0.95, o5 + 0.24, playerMax - bait); the player cannot open into it', () => {
  const line = o5 => Math.min(M.failCap, o5 + M.failSpan, T.door.playerMax - M.bait);
  // Opening alone stops 0.03 short of the line (review fix: no instant loss and no dead WATCH above the bait ceiling).
  const open = toWatch(); open.run(4, m => { hold(m); m.drag(.05); });
  assert.equal(open.m.state, 'playing'); assert.ok(open.m.o <= line(open.m.o5) - .03 + 1e-9, `o ${open.m.o}`);
  // Every WATCH reference stays baitable: oRef + bait fits under the player's cap.
  assert.ok(open.m.oRef + M.bait <= open.m.openCap() + 1e-9, `oRef ${open.m.oRef} cap ${open.m.openCap()}`);
  // Forcing it shut makes the fingers yank it open, grab after grab, until the line.
  const rig = toWatch(); const o5 = rig.m.o5;
  rig.until(s => s.state !== 'playing', 30, m => { hold(m); m.drag(-.05); });
  assert.equal(rig.m.reason, 'mimic');
  assert.ok(rig.m.o >= line(o5) - 1e-9 && rig.m.o <= line(o5) + M.yank, 'fail at the line');
});

test('a RESPONSE that ends below 0.13 lets the fingers slip out (0.6 s), holder unseated012, C6a 2.5 s later', () => {
  const rig = new Rig('C5');
  rig.until(s => s.beat === 'C6a' || s.state !== 'playing', 200, botDriver());
  assert.equal(rig.m.beat, 'C6a', `${rig.m.state} ${rig.m.reason}`);
  const out = rig.events('fingers-out')[0];
  assert.ok(out);
  const lastResponseEnd = rig.log.filter(e => e.type === 'mimic-out')[0];
  assert.ok(lastResponseEnd && Math.abs(lastResponseEnd.time - out.time) < 1e-9);
  assert.equal(rig.m.holder, 'unseated012');
  const c6a = rig.log.find(e => e.type === 'beat' && e.beat === 'C6a');
  near(c6a.time - out.time, M.fingersOut + T.beats.c6aAfter, .05, 'C6a timing');
  // Count of cycles about 3-6.
  const cycles = rig.events('mimic-response').length;
  assert.ok(cycles >= 3 && cycles <= 6, `${cycles} cycles`);
});

test('mimic exits only via a response: o < 0.13 reached during WATCH by pinching is impossible (the fingers grab first)', () => {
  const rig = toWatch();
  rig.until(s => s.state !== 'playing' || s.beat !== 'C5', 40, m => { hold(m); m.drag(-.05); });
  assert.notEqual(rig.m.beat, 'C6a');
  assert.equal(rig.m.reason, 'mimic', 'direct closing loses by the fingers pulling the door open');
  assert.ok(rig.events('mimic-yank').length >= 3);
});
