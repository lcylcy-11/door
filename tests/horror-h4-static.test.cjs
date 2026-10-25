// H4 static checks (spec sections 1, 11, 12.1): no randomness or clocks in the rules,
// contours regenerate byte-identically, and the measured contours meet the cover claims.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Night, T } = require('./horror-h4-helpers.cjs');

const root = path.resolve(__dirname, '..');
const RULE_FILES = ['dist/horror/night.js', 'dist/horror/tuning.js'];

test('rules files never use Math.random, Date or performance', () => {
  for (const file of RULE_FILES) {
    // Strip comments so the header sentence "No Math.random, Date or performance here." is not a hit.
    const code = fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const banned of [/Math\.random/, /\bDate\b/, /\bperformance\b/]) assert.doesNotMatch(code, banned, `${file} uses ${banned}`);
  }
});

test('contours.js regenerates byte-identically from the WAVs (build-contours --check)', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/build-contours.cjs'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `build-contours --check failed:\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /matches the WAV files/);
});

// Contour sampled through the model's own interpolation (what the rules judge).
const C = (src, tau) => Night.contourAt(src, tau);
function coveredSpans(src, from, to, step = .001) {
  const spans = []; let start = null;
  for (let t = from; t <= to + 1e-9; t += step) {
    const on = C(src, t) >= T.masks.enter;
    if (on && start === null) start = t;
    if (!on && start !== null) { spans.push([start, t]); start = null; }
  }
  if (start !== null) spans.push([start, to]);
  return spans;
}

test('elevator contour stays >= 0.60 over its whole loop (no dropout mid-hold)', () => {
  const loop = require(path.join(root, 'dist/horror/contours.js')).sources.elevator;
  assert.equal(loop.loop, true);
  let min = Infinity;
  for (let t = 0; t < loop.duration; t += .005) min = Math.min(min, C('elevator', t));
  assert.ok(min >= .6, `elevator contour min ${min.toFixed(3)} < 0.60`);
});

test('traffic contour covers (C >= 0.60) for one span between 4.0 and 4.8 s', () => {
  const spans = coveredSpans('traffic', 0, 8);
  assert.equal(spans.length, 1, `traffic has ${spans.length} covered spans`);
  const len = spans[0][1] - spans[0][0];
  assert.ok(len >= 4.0 && len <= 4.8, `traffic cover span ${len.toFixed(2)} s`);
});

test('mimic-response contour is >= 0.60 for its whole length', () => {
  const src = require(path.join(root, 'dist/horror/contours.js')).sources.mimic;
  let min = Infinity;
  for (let t = 0; t <= src.duration + 1e-9; t += .005) min = Math.min(min, C('mimic', t));
  assert.ok(min >= .6, `mimic contour min ${min.toFixed(3)}`);
  // The played response (1.2 s at e = 1) is therefore fully covered.
  for (let t = 0; t < T.masks.response; t += .005) assert.ok(Night.envelope({ src: 'mimic', t }) * C('mimic', t) >= .6, `mimic L < 0.6 at ${t}`);
});

test('mask envelopes: elevator linear 2.5 s ramps around the hold, traffic 0.15 s edge fades', () => {
  const env = (src, t, hold = 6) => Night.envelope({ src, t, hold });
  assert.equal(env('elevator', 0), 0);
  assert.ok(Math.abs(env('elevator', 1.25) - .5) < 1e-9);
  assert.equal(env('elevator', 2.5), 1);
  assert.equal(env('elevator', 8.5), 1);
  assert.ok(Math.abs(env('elevator', 9.75) - .5) < 1e-9);
  assert.equal(env('elevator', 11), 0);
  assert.ok(Math.abs(env('traffic', .075) - .5) < 1e-9);
  assert.equal(env('traffic', .15), 1);
  assert.equal(env('traffic', 4), 1);
  assert.ok(Math.abs(env('traffic', 8 - .075) - .5) < 1e-9);
  assert.equal(T.masks.base.elevator, .5); assert.equal(T.masks.base.traffic, .5); assert.equal(T.masks.base.mimic, .65);
});

test('elevator with hold 6 covers about H + 2.7 s (8.7 s) as judged by the model', () => {
  // Played level e(t) * C(tau = t) with the model's hysteresis.
  let covered = false, on = null, off = null;
  for (let t = 0; t <= 11; t += T.step) {
    const L = Night.envelope({ src: 'elevator', t, hold: 6 }) * C('elevator', t);
    const was = covered; covered = covered ? L >= T.masks.leave : L >= T.masks.enter;
    if (covered && !was) on = t; if (!covered && was) off = t;
  }
  const span = off - on;
  assert.ok(span >= 8.2 && span <= 9.2, `elevator hold-6 cover ${span.toFixed(2)} s`);
});

test('tuning table is frozen', () => {
  assert.ok(Object.isFrozen(T)); assert.ok(Object.isFrozen(T.hand)); assert.ok(Object.isFrozen(T.masks.cycle));
});
