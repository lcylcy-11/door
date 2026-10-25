// Shared helpers for the H4 rules-model tests (not a test file itself).
// Drives dist/horror/night.js through its public intents; a few unit tests also inject a mask
// source with the model's own spawn() to get "full cover" (L >= 1) on demand. Those are marked.
const path = require('node:path');
const Night = require(path.resolve(__dirname, '../dist/horror/night.js'));
const Captions = require(path.resolve(__dirname, '../dist/horror/captions.js'));
const T = Night.T;
const FRAME = 1 / 60;
const EPS = 1e-9;

// ---- seeded PRNG (mulberry32) -------------------------------------------------------------
function prng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- driving ------------------------------------------------------------------------------
// A small harness around one model: frames of `dt`, a per-frame callback, and an event log.
class Rig {
  constructor(checkpoint = 'P0', model) {
    this.m = model || new Night();
    this.log = [];
    this.t = 0;
    this.frames = [];
    if (checkpoint !== null) this.m.start(checkpoint);
    this.drain();
  }
  get s() { return this.m.snapshot(); }
  drain() { const ev = this.m.events.splice(0); for (const e of ev) this.log.push(e); return ev; }
  // Advance `seconds` in frames of dt. perFrame(m, snapshot, dt) runs before each update.
  run(seconds, perFrame, dt = FRAME, record) {
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n; i++) {
      if (perFrame) perFrame(this.m, this.m.snapshot(), dt);
      this.m.update(dt); this.t += dt;
      const ev = this.drain();
      if (record) record(this.m.snapshot(), ev);
    }
    return this;
  }
  // Advance until cond(snapshot) is true (checked after each frame) or maxT elapses. Returns elapsed time or -1.
  until(cond, maxT, perFrame, dt = FRAME, record) {
    const start = this.t;
    while (this.t - start < maxT - 1e-12) {
      if (perFrame) perFrame(this.m, this.m.snapshot(), dt);
      this.m.update(dt); this.t += dt;
      const ev = this.drain();
      const s = this.m.snapshot();
      if (record) record(s, ev);
      if (cond(s, ev)) return this.t - start;
      if (s.state !== 'playing') return -1;
    }
    return -1;
  }
  events(type) { return this.log.filter(e => e.type === type); }
  has(type) { return this.log.some(e => e.type === type); }
}

// Move the door by `amount` (positive opens) at `speed` per second, gripping first.
function moveDoor(rig, amount, speed, perFrameExtra) {
  const m = rig.m, dt = FRAME;
  if (!m.held) m.grip();
  const frames = Math.max(1, Math.ceil(Math.abs(amount) / (speed * dt) - 1e-9));
  let left = amount;
  for (let i = 0; i < frames; i++) {
    const d = Math.sign(amount) * Math.min(Math.abs(left), speed * dt);
    left -= d;
    m.drag(d);
    if (perFrameExtra) perFrameExtra(m);
    m.update(dt); rig.t += dt; rig.drain();
  }
}

// Inject a long, fully ramped elevator so L >= 1 (white-box helper: uses the model's spawn()).
function injectCover(m) { return m.spawn('elevator', { t: T.masks.ramp + .01, hold: 1e5 }); }

// ---- ideal-player policy (ported from scratchpad/sim/bot.cjs) -------------------------------
function door(m, speed, dt) { if (!m.held) m.grip(); m.drag(speed * dt); }
function hand(m, s) {
  if (!m.held) m.grip();
  if (s.handStage !== 'grip') return;
  const target = s.gripStage === 'ease' ? .32 : .84;
  m.drag(0, -(target - m.forceTarget) / T.hand.forceGain);
}
// opts: { lit, noGaze, noTurn, noWedgeNoHold, noMask, directClose, fastLatch }
function idealPolicy(m, s, dt, mem, opts = {}) {
  const lit = !!opts.lit;
  switch (s.beat) {
    case 'P0': {
      if (!s.boltHeld) m.grabBolt();
      if (s.b > .8 + 1e-6) m.dragBolt(-.2 * dt);
      else if (Math.abs(s.b - .8) < 1e-6) { mem.pause = (mem.pause || 0) + dt; if (mem.pause > .3) m.dragBolt(-1 * dt); }
      else m.dragBolt(-1 * dt);
      break;
    }
    case 'C1': case 'C2': {
      if (s.beat === 'C2' && s.o >= .46) {
        if (lit && !s.light && s.corridor === 'dead') { if (m.held) m.letGo(); m.toggleLight(); }
        break;
      }
      if (opts.noMask) { door(m, s.band === 'stiff' ? .12 : .3, dt); break; }
      if (s.band === 'stiff' || (s.o > .12 && s.o < .14 && m.program)) { if (s.covered && !s.preWarn) door(m, .12, dt); else if (!m.held) m.grip(); }
      else door(m, .3, dt);
      break;
    }
    case 'C3': if (s.hand) hand(m, s); break;
    case 'C4': if (!opts.noGaze) m.setGaze(true); if (!m.held) m.grip(); break;
    case 'C5': {
      m.setGaze(false);
      if (!m.held) m.grip();
      if (opts.directClose) { m.drag(-.15 * dt); break; }
      if (s.mimic === 'watch') { if (!mem.bait) { mem.bait = s.o; } if (s.o < mem.bait + .03) m.drag(.15 * dt); }
      else if (s.mimic === 'response') { mem.bait = 0; if (s.band !== 'stiff' || s.covered) m.drag(-.15 * dt); }
      else if (s.mimic === 'recover' || s.mimic === 'delay') { mem.bait = 0; }
      break;
    }
    case 'C6a':
      if (m.held) m.letGo();
      if (!opts.noTurn) { if (s.drawer === 'open') m.setTurn(true); if (s.drawer === 'shut') m.setTurn(false); }
      break;
    case 'C6b': {
      if (opts.noWedgeNoHold) { if (m.held) m.letGo(); break; }
      if (s.wedge === 'rest' && !mem.wedged) {
        if (s.shovePhase === 'idle' && mem.afterShove) { if (m.held) m.letGo(); if (m.toggleWedge()) mem.wedged = true; }
        else if (!m.held) m.grip();
        if (s.shovePhase === 'shove') mem.afterShove = true;
      } else if (s.wedge === 'in') { if (s.slipEvents >= 1) { if (!m.held) m.grip(); } else if (m.held) m.letGo(); }
      break;
    }
    case 'C6c': {
      if (s.drawer === 'open') { if (m.held) m.letGo(); if (!opts.noTurn) m.setTurn(true); break; }
      if (s.wantRear && s.drawer !== 'open') { m.setTurn(false); break; }
      if (s.turn > 0) break;
      if (s.drawer === 'shut' && !s.shoves) {
        if (s.wedge === 'in') { if (m.held) m.letGo(); m.toggleWedge(); }
        else if (s.wedge === 'rest') { if (!m.held) m.grip(); }
        break;
      }
      if (!m.held) m.grip();
      break;
    }
    case 'C7': if (m.held) m.letGo(); break;
    case 'F1': {
      if (!opts.noGaze) m.setGaze(true);
      if (!m.held) m.grip();
      if (s.o > .4) m.drag(-.3 * dt); else if (s.covered && !s.preWarn) m.drag(-.12 * dt);
      break;
    }
    case 'F2': {
      m.setGaze(false);
      if (s.hand) { hand(m, s); break; }
      if (s.flush) { if (m.held) m.letGo(); break; }
      if (!m.held) m.grip();
      if (s.band === 'stiff') { if (s.covered && !s.preWarn) m.drag(-.12 * dt); }
      else m.drag(-(s.o > .05 ? .3 : .2) * dt);
      break;
    }
    case 'F3': {
      if (!s.boltHeld) m.grabBolt();
      if (opts.fastLatch) {
        // Honest but too fast: respects the detent pause, then pushes at 2/s.
        if (Math.abs(s.b - .8) < 1e-6) { mem.pause = (mem.pause || 0) + dt; if (mem.pause > .3) m.dragBolt(2 * dt); }
        else { mem.pause = 0; m.dragBolt(2 * dt); }
        break;
      }
      if (s.b < .8 - 1e-6) { m.dragBolt(1 * dt); mem.pause = 0; }
      else if (Math.abs(s.b - .8) < 1e-6) { mem.pause = (mem.pause || 0) + dt; const k = (m.s.t - T.beats.f3Knocks) % T.beats.f3Period; if (mem.pause > .3 && k > .3 && k < .6) m.dragBolt(.25 * dt); }
      else m.dragBolt(.25 * dt);
      break;
    }
  }
}
// Wrap idealPolicy with per-beat memory, as bot.cjs does.
function botDriver(opts = {}) {
  let last = '', mem = {};
  return (m, s, dt) => { if (s.beat !== last) { last = s.beat; mem = {}; } idealPolicy(m, s, dt, mem, opts); };
}

// Play from `checkpoint` with the ideal policy until stop(snapshot) or the run ends.
function playTo(checkpoint, stop, opts = {}, maxT = 400) {
  const rig = new Rig(checkpoint);
  const drive = botDriver(opts);
  rig.until(s => stop(s), maxT, drive);
  return rig;
}

// ---- invariants (spec sections 8, 12) -----------------------------------------------------
function invariantErrors(s) {
  const errs = [];
  if (!(s.o >= -EPS && s.o <= 1 + EPS)) errs.push(`o out of [0,1]: ${s.o}`);
  if (!(s.A >= -EPS)) errs.push(`A below 0: ${s.A}`);
  if (s.state === 'playing' && !(s.A <= 1 + EPS)) errs.push(`A above 1 while playing: ${s.A}`);
  if (s.eyes !== 'none' && s.drawer === 'open') errs.push('eyes present while a drawer visit is open');
  if (s.gazeDown && s.turn >= T.turn.watchFrom) errs.push(`gaze down while turned (turn ${s.turn})`);
  if (s.boltMovable) {
    const handGripping = s.hand && (s.handStage === 'approach' || s.handStage === 'grip');
    if (s.held) errs.push('bolt movable while the handle is held');
    if (handGripping) errs.push('bolt movable while the H2 hand grips');
    if (!(s.mimic === 'none' || s.mimic === 'out')) errs.push(`bolt movable with fingers on the edge (${s.mimic})`);
    if (s.wedge !== 'rest') errs.push(`bolt movable with wedge ${s.wedge}`);
    if (!(s.o <= T.bolt.openMax + EPS)) errs.push(`bolt movable at o ${s.o}`);
  }
  if (['C6a', 'C6b', 'C6c'].includes(s.beat) && s.covered) errs.push(`masks cover in ${s.beat}`);
  return errs;
}

module.exports = { Night, Captions, T, FRAME, EPS, prng, Rig, moveDoor, injectCover, idealPolicy, botDriver, playTo, invariantErrors, hand };
