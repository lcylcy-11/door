// H4 masks / G1 cover (spec sections 1, 8, 12.2): judged level equals played gain, hysteresis,
// the C1 programme, pre-warning, what masks cover and the never-covered list at full cover.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Night, T, FRAME, Rig, moveDoor, injectCover, botDriver, playTo } = require('./horror-h4-helpers.cjs');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b} +/- ${tol}, got ${a}`);
const MASKS = ['elevator', 'traffic', 'mimic'];

// Park the door at 0.10 in C1 so the outside programme starts, and record every substep.
function c1Programme(seconds) {
  const rig = new Rig('C1');
  moveDoor(rig, .125, .2); rig.m.letGo();
  const frames = [];
  rig.run(seconds, null, T.step, (s, ev) => frames.push({ s, ev, sound: rig.m.soundState() }));
  return { rig, frames };
}

test('G1: the judged level L equals max(e x C(tau)) of the gains written to the audio graph', () => {
  const { frames } = c1Programme(40);
  let checked = 0;
  for (const { s, sound } of frames) {
    let L = 0;
    for (const src of MASKS) {
      const st = sound.streams[src]; if (!st) continue;
      near(st.gain, T.masks.base[src] * st.e, 1e-12, `${src} gain = base x e`);
      L = Math.max(L, st.e * Night.contourAt(src, st.offset));
      checked++;
    }
    near(s.L, L, 1e-9, `L at t=${s.time.toFixed(3)}`);
  }
  assert.ok(checked > 1000, 'mask sources were playing');
});

test('covered hysteresis: enter at L >= 0.60, leave at L < 0.50', () => {
  const { frames } = c1Programme(70);
  let was = false, ons = 0, offs = 0, band = 0;
  for (const { s } of frames) {
    if (s.covered && !was) { ons++; assert.ok(s.L >= .6 - 1e-12, `entered at L=${s.L}`); }
    if (!s.covered && was) { offs++; assert.ok(s.L < .5, `left at L=${s.L}`); }
    if (s.covered) assert.ok(s.L >= .5 - 1e-12, `covered at L=${s.L}`);
    if (!s.covered) assert.ok(s.L < .6, `not covered at L=${s.L}`);
    if (s.covered && s.L < .6) band++;
    was = s.covered;
  }
  assert.ok(ons >= 4 && offs >= 4, `${ons} covers`);
  assert.ok(band > 0, 'the 0.50-0.60 hysteresis band is exercised');
});

test('C1 programme: elevator +3 s (about 8.7 s covered), 6 s quiet, traffic (4.0-4.8 s covered), 31 s period, waits <= 10 s', () => {
  const { rig, frames } = c1Programme(75);
  const starts = rig.log.filter(e => e.type === 'mask-start').map(e => [e.source, e.time]);
  assert.ok(starts.length >= 4, `${starts.length} mask starts`);
  const first = starts[0];
  assert.equal(first[0], 'elevator');
  const progStart = first[1] - T.beats.c1MaskDelay;
  assert.equal(starts[1][0], 'traffic'); near(starts[1][1] - first[1], 17, .02, 'traffic 17 s after the elevator');
  assert.equal(starts[2][0], 'elevator'); near(starts[2][1] - first[1], 31, .02, 'period 31 s');
  // Covered spans per source.
  const spans = []; let on = null;
  for (const { s } of frames) { if (s.covered && on === null) on = s.time; if (!s.covered && on !== null) { spans.push([on, s.time]); on = null; } }
  const [e1, t1, e2] = spans;
  near(e1[1] - e1[0], 8.7, .4, 'elevator hold-6 cover');
  assert.ok(t1[1] - t1[0] >= 4.0 && t1[1] - t1[0] <= 4.8, `traffic cover ${(t1[1] - t1[0]).toFixed(2)} s`);
  // Worst wait for cover once the programme runs.
  const gaps = [e1[0] - progStart, t1[0] - e1[1], e2[0] - t1[1]];
  for (const g of gaps) assert.ok(g <= 10.0, `uncovered wait ${g.toFixed(2)} s`);
});

test('pre-warning: "cover-ending" comes 1.0 s (forward evaluation) before each cover-off', () => {
  const { rig } = c1Programme(70);
  const offs = rig.events('cover-off'), ends = rig.events('cover-ending');
  assert.ok(offs.length >= 4);
  for (const off of offs) {
    const end = ends.filter(e => e.time <= off.time).pop();
    assert.ok(end, 'a pre-warning precedes the cover-off');
    const lead = off.time - end.time;
    assert.ok(lead >= .9 && lead <= 1.05, `pre-warning lead ${lead.toFixed(3)} s`);
  }
});

test('masks cover the stiff-band scrape: crossing 0.14 -> 0.40 under the elevator costs nothing', () => {
  const rig = new Rig('C1');
  moveDoor(rig, .13, .2); rig.m.letGo();
  rig.until(s => s.covered && !s.preWarn && s.L >= .9, 30);
  const A0 = rig.m.A;
  const t0 = rig.t;
  rig.until(s => s.o >= .42 || !s.covered, 5, m => { if (!m.held) m.grip(); m.drag(.12 * FRAME); });
  assert.ok(rig.m.o >= .4 || rig.m.beat === 'C2', `crossed: o=${rig.m.o}`);
  assert.equal(rig.m.A, A0, 'covered scrape is free');
  assert.ok(rig.t - t0 >= (.4 - .14) / T.door.capStiff - .1, 'crossing 0.26 takes >= 2.2 s');
});

test('unmasked crossing of the stiff band costs about 1.04 and fails in C1', () => {
  // Spec C1: "Crossing 0.26 takes >= 2.2 s; unmasked crossing costs 1.04 and fails."
  const rig = new Rig('C1');
  rig.until(s => s.state !== 'playing' || s.beat !== 'C1', 10, m => { if (!m.held) m.grip(); m.drag(.12 * FRAME); });
  assert.equal(rig.m.state, 'lost', `state ${rig.m.state}, beat ${rig.m.beat}, A ${rig.m.A.toFixed(3)}`);
  assert.equal(rig.m.reason, 'noise');
});

test('masks cover the switch click (C2) and wedge in/out (C6b); uncovered they cost 0.12 and 0.05', () => {
  for (const covered of [false, true]) {
    const rig = new Rig('C2');
    if (covered) { injectCover(rig.m); rig.run(FRAME); }
    const A0 = rig.m.A;
    assert.equal(rig.m.toggleLight(), true);
    rig.drain();
    near(rig.m.A - A0, covered ? 0 : T.attention.click, 1e-12, `click covered=${covered}`);
    if (covered) assert.ok(rig.log.some(e => e.type === 'covered' && e.source === 'switch'));
  }
  for (const covered of [false, true]) {
    const rig = playTo('C6', s => s.beat === 'C6b');
    assert.equal(rig.m.beat, 'C6b');
    if (covered) { injectCover(rig.m); rig.run(FRAME); assert.equal(rig.m.covered, true); }
    const A0 = rig.m.A;
    assert.equal(rig.m.toggleWedge(), true, 'wedge before shoves start');
    rig.run(T.wedge.insert + .05);
    assert.equal(rig.m.wedge, 'in');
    near(rig.m.A - A0, covered ? 0 : T.attention.wedge, 1e-12, `wedge-in covered=${covered}`);
    const A1 = rig.m.A;
    assert.equal(rig.m.toggleWedge(), true); rig.run(T.wedge.remove + .05);
    assert.equal(rig.m.wedge, 'rest');
    near(rig.m.A - A1, covered ? 0 : T.attention.wedge, 1e-12, `wedge-out covered=${covered}`);
  }
});

// Run the same policy twice, the second time with a full cover injected (white-box spawn) once
// when(s) is true, and compare `fields` frame by frame from then on.
function twin(cp, policy, seconds, when, fields, setup) {
  const runs = [false, true].map(cover => {
    const rig = new Rig(cp); if (setup) setup(rig);
    const out = []; let injected = false;
    rig.run(seconds, (m, s, dt) => {
      if (cover && !injected && when(s)) { injectCover(m); injected = true; }
      policy(m, s, dt);
    }, FRAME, s => out.push(s));
    return { rig, out };
  });
  const [a, b] = runs;
  let compared = 0, coveredFrames = 0;
  for (let i = 0; i < Math.min(a.out.length, b.out.length); i++) {
    if (b.out[i].covered) coveredFrames++;
    for (const f of fields) if (a.out[i][f] !== b.out[i][f]) assert.fail(`${cp} ${f} differs at frame ${i}: ${a.out[i][f]} vs ${b.out[i][f]} (covered ${b.out[i].covered})`);
    compared++;
  }
  return { a, b, compared, coveredFrames };
}

test('never covered at full cover: E (eyes) is identical with L >= 1', () => {
  const r = twin('C4', () => {}, 8, () => true, ['E', 'eyes', 'state', 'reason']);
  assert.ok(r.coveredFrames > 300); assert.equal(r.a.rig.m.reason, 'eyes');
});

test('never covered at full cover: H2 strain, enemy force and the door are identical with L >= 1', () => {
  // Constant maximum force: strain rises; the hand pushes the door. Cover injected at the scratch.
  const policy = (m, s) => { if (s.hand) { if (!m.held) m.grip(); if (s.handStage === 'grip') m.drag(0, -(1 - m.forceTarget) / T.hand.forceGain); } };
  const r = twin('C3', policy, 14, s => s.hand, ['strain', 'o', 'force', 'state', 'reason', 'handStage']);
  assert.ok(r.coveredFrames > 200); assert.equal(r.a.rig.m.reason, 'strain');
  const idle = twin('C3', () => {}, 14, s => s.hand, ['o', 'state', 'reason']);
  assert.ok(idle.coveredFrames > 200); assert.equal(idle.a.rig.m.reason, 'hand');
});

test('never covered at full cover: pinch P and the grab are identical with L >= 1', () => {
  const policy = (m, s) => { if (!m.held) m.grip(); if (s.mimic === 'watch') m.drag(-.004 * FRAME * 60); };
  const r = twin('C5', policy, 12, s => s.mimic === 'arrive', ['P', 'o', 'mimic', 'state']);
  assert.ok(r.coveredFrames > 100);
  assert.ok(r.b.rig.log.some(e => e.type === 'mimic-yank' && e.why === 'pinch'), 'covered closing with fingers on the edge still grabs');
});

test('never covered at full cover: drawer d is identical with L >= 1', () => {
  // C6a silences every outside sound on entry, so inject the cover after that first moment.
  const r = twin('C6', () => {}, 20, s => s.beatTime > .1, ['d', 'drawer', 'state', 'reason']);
  assert.ok(r.coveredFrames > 300); assert.equal(r.a.rig.m.reason, 'drawer');
});

test('never covered at full cover: slam, rattle and light leak cost the same with L >= 1', () => {
  // Rattle (G1 x G2): one too-fast lift in P0.
  const rattle = twin('P0', (m) => { if (!m.boltHeld) m.grabBolt(); m.dragBolt(-1 * FRAME); }, .2, () => true, ['A', 'b']);
  assert.ok(rattle.b.rig.has('latch-rattle')); near(rattle.b.rig.m.A, T.attention.rattle, 1e-12, 'rattle at L >= 1');
  // Slam: fast close from 0.10 in C1.
  // Close at the 0.40/s cap for 16 frames (0.267 s): arrives at the stop once, fast.
  let n = 0;
  const slam = twin('C1', (m) => { if (!m.held) m.grip(); if (n++ < 16) m.drag(-.05); }, 1.2, () => true, ['A', 'o'],
    rig => { moveDoor(rig, .12, .3); n = 0; });
  assert.ok(slam.b.rig.has('slam')); assert.ok(slam.b.rig.m.A >= T.attention.slam - 1e-12);
  // Leak: light on at o = 0.45 in C2; after the click, A grows 0.006/s in both runs.
  const leak = [false, true].map(cover => {
    const rig = new Rig('C2'); if (cover) injectCover(rig.m); rig.run(FRAME);
    rig.m.toggleLight(); rig.run(FRAME); const A0 = rig.m.A; rig.run(3); return rig.m.A - A0;
  });
  near(leak[0], T.attention.leak * 3, 2e-4, 'leak uncovered'); near(leak[1], leak[0], 1e-12, 'leak at L >= 1');
});

test('the player scrape during a mimic RESPONSE is covered by the response sound', () => {
  // Ideal bot through C5 until a RESPONSE with the edge in the stiff band.
  const rig = new Rig('C5');
  const drive = botDriver();
  let tested = false;
  rig.until(s => {
    if (s.mimic === 'response' && s.band === 'stiff' && s.covered) tested = true;
    return tested || s.beat !== 'C5';
  }, 120, drive);
  assert.ok(tested, 'reached a stiff-band response');
  const A0 = rig.m.A, o0 = rig.m.o;
  rig.until(s => s.mimic !== 'response', 2, (m) => { if (!m.held) m.grip(); m.drag(-.12 * FRAME); });
  assert.ok(o0 - rig.m.o > .02, 'closed during the response');
  assert.equal(rig.m.A, A0, 'response-covered scrape is free');
});

test('C2: masks stop starting at confirmation and fade out within 1.0 s', () => {
  const rig = new Rig('C2');
  moveDoor(rig, .03, .2); rig.m.letGo();
  rig.until(s => s.confirmRoute === 'dark', 15);
  assert.equal(rig.m.confirmRoute, 'dark');
  assert.ok(rig.m.sources.length > 0, 'a mask was playing at confirmation');
  rig.run(1.05);
  assert.equal(rig.m.sources.length, 0, 'faded within 1.0 s');
  rig.until(s => s.beat === 'C4', 30, botDriver());
  assert.equal(rig.log.filter(e => e.type === 'mask-start' && e.time > rig.events('confirm')[0].time).length, 0, 'no mask starts after confirmation until C5');
});

test('C3 waits for L < 0.20 before the hush and knocks', () => {
  const rig = new Rig('C3');
  rig.m.spawn('elevator', { t: T.masks.ramp + .01, hold: 3 }); // white-box: a fading elevator already playing
  let Lat = null, prevL = null;
  rig.until(s => s.hand, 20, null, T.step, (s, ev) => { if (Lat === null && ev.some(e => e.type === 'hush')) Lat = s.L; prevL = s.L; });
  const hush = rig.events('hush')[0];
  assert.ok(hush && rig.m.hand, 'hushed, knocked and the hand came');
  assert.ok(Lat !== null && Lat < .2, `L on the hush substep ${Lat}`);
  assert.ok(hush.time > 3, `the hush waited for the elevator to fade (at ${hush.time.toFixed(2)} s)`);
  const knocks = rig.events('glass-knock');
  assert.equal(knocks.length, 3);
  near(knocks[0].time - hush.time, T.beats.c3Hush, .02, 'knocks 2.0 s after the hush');
  near(knocks[1].time - knocks[0].time, .42, .02); near(knocks[2].time - knocks[0].time, .95, .02);
});

test('mimic grab ducks masks to 0 within 0.3 s (elevator cover in C5 does not stop a pinch grab)', () => {
  const rig = new Rig('C5');
  rig.m.grip();
  rig.until(s => s.mimic === 'watch' && s.covered && s.L > .9, 40, m => { if (!m.held) m.grip(); });
  assert.ok(rig.m.covered, 'C5 elevator from +12 s covers');
  rig.until(s => s.mimic === 'grab', 2, m => m.drag(-.1 * FRAME));
  assert.equal(rig.m.mimic, 'grab', 'closing under cover with fingers on the edge grabs');
  assert.ok(rig.log.some(e => e.type === 'mimic-yank' && e.why === 'pinch'));
  rig.run(.3 + FRAME);
  assert.equal(rig.m.L, 0, 'masks ducked to 0 within 0.3 s');
  const st = rig.m.soundState().streams.elevator; assert.ok(st && st.gain === 0, 'the played elevator gain is 0 too');
});

test('F2: the hand ducks masks to 0 within 0.3 s and pauses the schedule; traffic comes 1.0 s after the retreat', () => {
  const rig = playTo('C7', s => s.beat === 'F2');
  assert.equal(rig.m.beat, 'F2');
  rig.run(FRAME, botDriver());
  assert.ok(rig.has('scratch'));
  rig.run(.3 + FRAME, botDriver());
  assert.equal(rig.m.L, 0, 'ducked within 0.3 s');
  const startsBefore = rig.events('mask-start').length;
  const drive = botDriver();
  rig.until(s => !s.hand, 25, drive);
  assert.equal(rig.events('mask-start').length, startsBefore, 'schedule paused during the hand');
  // Stay still after the hand leaves so F2 lasts long enough for the traffic pass.
  rig.m.letGo(); rig.run(1.5);
  const traffic = rig.log.find(e => e.type === 'mask-start' && e.source === 'traffic' && e.beat === 'F2');
  assert.ok(traffic, 'traffic pass in F2');
  near(traffic.time - rig.events('hand-free')[0].time, T.beats.f2Traffic, .05, 'traffic 1.0 s after the retreat');
});

test('masks are off throughout C6: a switch click on entering C6a is not covered by the C5 elevator tail', () => {
  // Spec section 8: G1 x G5 / G1 x G7 never; masks off throughout C6 (invariant).
  const rig = new Rig('P0');
  rig.until(s => s.beat === 'C6a', 300, botDriver());
  assert.equal(rig.m.beat, 'C6a');
  if (rig.m.held) rig.m.letGo();
  const A0 = rig.m.A, coveredAtEntry = rig.m.covered;
  assert.equal(rig.m.toggleLight(), true);
  assert.equal(coveredAtEntry, false, `still covered on entering C6a (L ${rig.m.L.toFixed(3)})`);
  near(rig.m.A - A0, T.attention.click, 1e-12, 'the click costs 0.12 in C6');
});
