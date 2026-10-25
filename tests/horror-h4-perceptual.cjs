// Perceptual bot for the H4 integration tests (not a test file itself).
const H = require('./horror-h4-helpers.cjs');
const { T } = H;
// Perceptual bot: world state comes only from a snapshot `delay` seconds old (and events heard
// `delay` seconds late); its own hands (held, forceTarget, boltHeld, gaze, turn wish) are known live.
function perceptualRun({ delay = .35, lit = false, maxT = 500, record } = {}) {
  DELAY = delay; const rig = new H.Rig('P0'); const m = rig.m, dt = H.FRAME;
  const lag = Math.round(delay / dt), hist = [], heard = [];
  let mem = {}, last = '', frame = 0;
  const knocks = [];
  while (m.state === 'playing' && rig.t < maxT) {
    hist.push(m.snapshot()); if (hist.length > lag + 1) hist.shift();
    const s = hist[0];
    for (const e of heard.filter(e => e.at <= frame)) { if (e.type === 'soft-knock') knocks.push(rig.t); }
    for (let i = heard.length - 1; i >= 0; i--) if (heard[i].at <= frame) heard.splice(i, 1);
    if (s.beat !== last) { last = s.beat; mem = {}; }
    policy(m, s, dt, mem, lit, rig.t, knocks);
    m.update(dt); rig.t += dt; frame++;
    const ev = rig.drain();
    for (const e of ev) heard.push({ type: e.type, at: frame + lag });
    if (record) record(m.snapshot(), ev);
  }
  return rig;
}
// The bot knows the published RESPONSE length and its own reaction delay (it stops closing in time).
let DELAY = .35; function delayOf() { return DELAY; }
function grip(m) { if (!m.held) m.grip(); }
function policy(m, s, dt, mem, lit, now, knocks) {
  switch (s.beat) {
    case 'P0': {
      if (!m.boltHeld) m.grabBolt();
      if (s.b > .8 + 1e-6) m.dragBolt(-.2 * dt);
      else if (Math.abs(s.b - .8) < 1e-6) { mem.pause = (mem.pause || 0) + dt; if (mem.pause > .3) m.dragBolt(-1 * dt); }
      else m.dragBolt(-1 * dt);
      break;
    }
    case 'C1': case 'C2': {
      if (s.beat === 'C2' && s.o >= .46) {
        if (m.held) m.letGo();
        if (lit && !s.light && s.corridor === 'dead') m.toggleLight();
        break;
      }
      grip(m);
      if (s.band === 'stiff' || (s.o > .1 && s.o < .14)) {
        if (s.band !== 'stiff' && s.o < .125) m.drag(.04 * dt);
        else if (s.covered && !s.preWarn) m.drag(.12 * dt);
      } else if (s.band === 'B') m.drag(.3 * dt);
      else m.drag((s.o < .06 ? .3 : .04) * dt);
      break;
    }
    case 'C3': case 'F2': {
      if (s.beat === 'F2') m.setGaze(false);
      if (s.hand) {
        grip(m);
        if (s.handStage === 'grip') { const target = s.gripStage === 'ease' ? .32 : .84; m.drag(0, -(target - m.forceTarget) / T.hand.forceGain); }
        break;
      }
      if (s.beat === 'C3') break;
      if (s.flush) { if (m.held) m.letGo(); break; }
      grip(m);
      if (s.band === 'stiff') { if (s.covered && !s.preWarn) m.drag(-.12 * dt); }
      else if (s.band === 'B') m.drag(-(s.o > .47 ? .3 : .04) * dt);
      else m.drag(-(s.o > .05 ? .3 : .2) * dt);
      break;
    }
    case 'C4': m.setGaze(true); grip(m); break;
    case 'C5': {
      m.setGaze(false); grip(m);
      if (s.mimic === 'watch') {
        // Proprioceptive bait: the bot knows how far it moved its own hand.
        if (mem.phase !== 'bait') { mem.phase = 'bait'; mem.cmd = 0; mem.size = s.o > .42 ? .03 : .02; }
        if (mem.cmd < mem.size - 1e-9) { const d = Math.min(.1 * dt, mem.size - mem.cmd); mem.cmd += d; m.drag(d); }
      } else if (s.mimic === 'response') {
        if (mem.phase !== 'close') { mem.phase = 'close'; mem.closeAt = now; }
        if (now - mem.closeAt < T.mimic.response - delayOf(m) - .05) m.drag(-.15 * dt);
      } else mem.phase = s.mimic;
      break;
    }
    case 'C6a': if (m.held) m.letGo(); if (s.drawer === 'open') m.setTurn(true); if (s.drawer === 'shut') m.setTurn(false); break;
    case 'C6b': {
      if (s.wedge === 'rest' && !mem.wedged) {
        if (s.shovePhase === 'idle' && mem.afterShove) { if (m.held) m.letGo(); if (m.toggleWedge()) mem.wedged = true; }
        else grip(m);
        if (s.shovePhase === 'shove') mem.afterShove = true;
      } else if (s.wedge === 'in') { if (s.slipEvents >= 1) grip(m); else if (m.held) m.letGo(); }
      break;
    }
    case 'C6c': {
      if (s.drawer === 'open') { if (m.held) m.letGo(); m.setTurn(true); break; }
      if (m.wantRear) { if (s.drawer !== 'open') m.setTurn(false); break; }
      if (s.turn > 0) break;
      if (s.drawer === 'shut' && !s.shoves) {
        if (s.wedge === 'in') { if (m.held) m.letGo(); if (!mem.removing) mem.removing = m.toggleWedge(); }
        else if (s.wedge === 'rest') grip(m);
        break;
      }
      grip(m);
      break;
    }
    case 'C7': if (m.held) m.letGo(); break;
    case 'F1': {
      m.setGaze(true); grip(m);
      if (s.o > .47) m.drag(-.3 * dt); else if (s.o > .405) m.drag(-.04 * dt); else if (s.covered && !s.preWarn) m.drag(-.12 * dt);
      break;
    }
    case 'F3': {
      if (!m.boltHeld) m.grabBolt();
      if (s.b < .8 - 1e-6) { m.dragBolt(1 * dt); mem.pause = 0; }
      else if (Math.abs(s.b - .8) < 1e-6) {
        mem.pause = (mem.pause || 0) + dt;
        const k = knocks.length ? now - knocks[knocks.length - 1] : -1;
        if (mem.pause > .3 && k >= 0 && k < .3) mem.go = true;
        if (mem.go) m.dragBolt(.25 * dt);
      } else m.dragBolt(.25 * dt);
      break;
    }
  }
}
module.exports = { perceptualRun };
