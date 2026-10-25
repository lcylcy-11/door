// H4 seeded fuzz (spec section 12.3: "2000 seeded fuzz runs never violate an invariant") and the
// twins check (section 7: every emitted event has a caption or visual twin in captions.EVENTS).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Night, Captions, T, FRAME, prng, botDriver, invariantErrors } = require('./horror-h4-helpers.cjs');
const { perceptualRun } = require('./horror-h4-perceptual.cjs');

const RUNS = 2000;
const CHECKPOINTS = ['P0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'];
const DTS = [1 / 60, 1 / 60, 1 / 30, 1 / 144, 1 / 120, .1];
const seen = new Map(); // event type -> first seed
const coverage = {}; // state class -> frames seen during the random part
const bump = k => { coverage[k] = (coverage[k] || 0) + 1; };
function cover(s) {
  bump('beat:' + s.beat);
  if (s.hand && s.handStage === 'grip') bump('hand-grip'); if (s.eyes === 'open') bump('eyes-open'); if (s.drawer === 'open') bump('drawer-open');
  if (['watch', 'delay', 'response', 'recover', 'grab'].includes(s.mimic)) bump('mimic:' + s.mimic); if (s.wedge === 'in') bump('wedge-in');
  if (s.boltMovable && s.boltHeld) bump('bolt-held-movable'); if (s.turn >= .5) bump('turned'); if (s.gazeDown) bump('gaze-down');
  if (s.paused) bump('paused'); if (s.shoves) bump('shoves'); if (s.covered) bump('covered'); if (s.state === 'lost') bump('lost');
}

// One random intent burst. Probabilities favour door and bolt drags so threats get exercised.
function randomIntents(m, r) {
  const x = () => r() * 2 - 1;
  if (r() < .08) m.grip();
  if (r() < .04) m.letGo();
  if (r() < .5) m.drag(x() * .06, x() * .12);
  if (r() < .05) m.setGaze(r() < .5);
  if (r() < .04) m.setTurn(r() < .5);
  if (r() < .02) m.toggleLight();
  if (r() < .04) m.toggleWedge();
  if (r() < .05) m.grabBolt();
  if (r() < .3) m.dragBolt(x() * .2);
  if (r() < .03) m.releaseBolt();
  if (r() < .01) m.setPaused(r() < .5);
  if (r() < .002) m.retry();
  if (r() < .0005) m.start(CHECKPOINTS[Math.floor(r() * CHECKPOINTS.length)]);
}

function fuzzRun(seed) {
  const r = prng(seed * 2654435761);
  const m = new Night();
  const cp = CHECKPOINTS[Math.floor(r() * CHECKPOINTS.length)];
  m.start(cp);
  const errors = [];
  const check = (phase) => {
    const s = m.snapshot();
    for (const e of invariantErrors(s)) errors.push(`${phase} ${s.beat} t=${s.time.toFixed(3)}: ${e}`);
    for (const e of m.events.splice(0)) if (!seen.has(e.type)) seen.set(e.type, seed);
    if (phase !== 'prefix') cover(s);
  };
  // Optional ideal-bot prefix to reach deep states (mimic cycles, C6b/C6c, F1-F3, END).
  if (r() < .3) {
    const drive = botDriver({ lit: r() < .5 }), until = r() * 40;
    for (let t = 0; t < until && m.state === 'playing'; t += FRAME) { drive(m, m.snapshot(), FRAME); m.update(FRAME); check('prefix'); }
  }
  const botness = r() < .5 ? 0 : r();
  const drive = botDriver({ lit: r() < .5 });
  const length = 3 + r() * 5;
  for (let t = 0; t < length; ) {
    const dt = DTS[Math.floor(r() * DTS.length)];
    if (r() < botness) drive(m, m.snapshot(), dt); else randomIntents(m, r);
    m.update(dt); t += Math.min(dt, T.maxFrame);
    check('fuzz');
    if (m.state !== 'playing' && r() < .05) { m.retry(); check('retry'); }
  }
  return { cp, errors };
}

test('the invariant oracle is not vacuous: it flags each violation class on a doctored snapshot', () => {
  const base = { ...new (require('./horror-h4-helpers.cjs').Night)().snapshot(), state: 'playing', beat: 'C5', o: .3, A: .1, boltMovable: false };
  const cases = [{ o: 1.2 }, { A: 1.1 }, { eyes: 'open', drawer: 'open' }, { gazeDown: true, turn: .6 }, { boltMovable: true, held: true },
    { boltMovable: true, wedge: 'in', o: 0 }, { boltMovable: true, o: .05 }, { boltMovable: true, o: 0, mimic: 'watch' }, { beat: 'C6b', covered: true }];
  for (const c of cases) assert.ok(invariantErrors({ ...base, ...c }).length > 0, JSON.stringify(c));
  assert.deepEqual(invariantErrors(base), []);
});

test(`${RUNS} seeded random-intent runs never violate an invariant or throw`, (t) => {
  const byKind = new Map();
  let thrown = [];
  for (let seed = 1; seed <= RUNS; seed++) {
    let res;
    try { res = fuzzRun(seed); } catch (err) { thrown.push(`seed ${seed}: ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}`); continue; }
    for (const e of res.errors) {
      const kind = e.replace(/^\w+ \w+ t=[0-9.]+: /, '').replace(/-?d+(.d+)?(e-?d+)?/g, '#');
      if (!byKind.has(kind)) byKind.set(kind, { count: 0, first: `seed ${seed} (start ${res.cp}) ${e}` });
      byKind.get(kind).count++;
    }
  }
  t.diagnostic('coverage (frames in the random part): ' + JSON.stringify(coverage));
  // The fuzz must actually reach every beat and threat state, or a pass means little.
  const need = ['P0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6a', 'C6b', 'C6c', 'C7', 'F1', 'F2', 'F3'].map(b => 'beat:' + b)
    .concat(['hand-grip', 'eyes-open', 'drawer-open', 'mimic:watch', 'mimic:delay', 'mimic:response', 'wedge-in', 'bolt-held-movable', 'turned', 'gaze-down', 'paused', 'shoves', 'covered', 'lost']);
  assert.deepEqual(need.filter(k => !coverage[k]), [], 'fuzz coverage gaps');
  assert.deepEqual(thrown.slice(0, 3), [], `${thrown.length} runs threw`);
  const report = [...byKind.entries()].map(([k, v]) => `${k} x${v.count} - first: ${v.first}`);
  assert.deepEqual(report, [], 'invariant violations');
});

// Allow-list: events with no caption/visual twin, and why that is acceptable.
const ALLOW = {
  start: 'lifecycle marker from start()/retry(); the scene itself is the visual',
  beat: 'director marker; each beat onset has its own cue event (hush, scratch, breath, fingers, ...)',
  win: 'state change; the end card (captions.WIN) is the visual, the sting is the sound',
  pause: 'UI state; the pause overlay is the visual and audio is suspended',
  resume: 'UI state (see pause)',
  grip: "echo of the player's own input; the hand pose is the visual, no sound",
  'let-go': "echo of the player's own input",
  'bolt-grab': "echo of the player's own input; the bolt guide track shows while pressed",
  'bolt-release': "echo of the player's own input",
  'gaze-down': "echo of the player's own input; the down view and 「시선 아래」 badge are the visual",
  'gaze-up': "echo of the player's own input",
  unflush: 'silent state change of the door (its motion is visible); no sound plays',
  'mask-end': 'end of a mask loop; the sound strip (W1) visibly empties; mask-start carries the twin'
};

test('twins: every event type emitted by bots, sweeps and fuzz has a captions.EVENTS caption or visual (or a justified allow-list entry)', () => {
  // Bots and sweeps add their event types to those seen by the fuzz.
  const collect = (log) => { for (const e of log) if (!seen.has(e.type)) seen.set(e.type, 'bot'); };
  for (const opts of [{}, { lit: true }, { noMask: true }, { noGaze: true }, { noTurn: true }, { noWedgeNoHold: true }, { directClose: true }, { fastLatch: true }]) {
    const m = new Night(); m.start('P0'); const drive = botDriver(opts);
    for (let t = 0; t < 400 && m.state === 'playing'; t += FRAME) { drive(m, m.snapshot(), FRAME); m.update(FRAME); collect(m.events.splice(0)); }
  }
  collect(perceptualRun({ delay: .35 }).log);
  const missing = [];
  for (const [type, seed] of seen) {
    const tw = Captions.EVENTS[type];
    const ok = tw && ((tw.text && tw.text.length) || tw.visual);
    if (!ok && !ALLOW[type]) missing.push(`${type} (first from ${seed})`);
  }
  assert.deepEqual(missing, [], 'events without a twin');
  assert.ok(seen.size >= 80, `only ${seen.size} event types seen`);
});

test('twins: every EVENTS entry that plays a sound has a caption text, a location tag and a visual flag', () => {
  const ALLOW_NO_TEXT = { lose: 'the fail card (captions.ENDINGS[reason]) is the caption' };
  const bad = [];
  for (const [type, tw] of Object.entries(Captions.EVENTS)) {
    if (!tw.sound) continue;
    if (!tw.visual) bad.push(`${type}: no visual`);
    if (ALLOW_NO_TEXT[type]) continue;
    if (!tw.text) bad.push(`${type}: no caption text`);
    if (!tw.loc) bad.push(`${type}: no location tag`);
  }
  assert.deepEqual(bad, []);
});
