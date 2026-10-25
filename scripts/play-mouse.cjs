// Real-input play test: drives the game through Chromium's trusted input pipeline (CDP
// Input.dispatchMouseEvent) — held left-button drags streamed every frame, right-button chords,
// clicks and slow vertical bolt drags. The player reads the page's read-only snapshot as its eyes
// and never calls a game setter. Usage:
//   node scripts/play-mouse.cjs [scenario] [--lit] [--narrow] [--muted] [--shots=dir] [--url=...]
// Scenarios: win (default), fail:<reason>, all
const path = require('node:path');
const { launch, sleep } = require('./cdp.cjs');
const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const opt = (name, fallback) => (args.find(a => a.startsWith(`--${name}=`)) || '').split('=')[1] || fallback;
const URL = opt('url', 'http://127.0.0.1:5174/horror/');
const SHOTS = opt('shots', '');

const READ = `(() => {
  const s = doorH4.snapshot(), scene = document.getElementById('scene');
  const rect = id => { const e = document.getElementById(id); if (!e || e.hidden || e.disabled) return null;
    const b = e.getBoundingClientRect(); return b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height } : null; };
  const st = document.getElementById('stage').getBoundingClientRect(), vb = document.getElementById('front').viewBox.baseVal;
  const narrow = matchMedia('(max-width: 600px)').matches;
  return { s, end: scene.dataset.end || '', view: scene.dataset.view, cover: scene.dataset.cover, ending: document.getElementById('soundStrip').classList.contains('ending'),
    handle: rect('handle'), bolt: rect('boltHit'), turn: rect('turn'), slipper: rect('slipperHit'), sw: rect('switchHit') || rect('switchProxy'),
    retry: rect('retry'), again: rect('again'), start: rect('start'), endShown: !document.getElementById('end').hidden,
    scale: Math.max(st.width / vb.width, st.height / vb.height), base: Math.max(st.width / (narrow ? 720 : 1600), st.height / 900), stageH: st.height,
    loc: document.getElementById('location').textContent, sub: document.getElementById('subtitle').textContent, ins: document.getElementById('instruction').textContent };
})()`;

// Every enabled, visible control must be the topmost element at its own centre (nothing covers it).
const OCCLUSION = `[...document.querySelectorAll('#handle, #boltHit, #switchHit, #slipperHit, #turn, #switchProxy, #gazeToggle')]
  .filter(e => !e.hidden && !e.disabled && e.getBoundingClientRect().width && getComputedStyle(e).display !== 'none')
  .filter(e => { const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; const st = document.getElementById('scene').getBoundingClientRect();
    if (x < st.left || x > st.right || y < st.top || y > st.bottom) return false; const top = document.elementFromPoint(x, y); return !(top === e || e.contains(top)); })
  .map(e => e.id + '<' + (document.elementFromPoint(e.getBoundingClientRect().left + e.getBoundingClientRect().width / 2, e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2) || {}).id)`;

class Player {
  constructor(page, { lit = false, label = '' } = {}) { this.page = page; this.lit = lit; this.label = label; this.left = null; this.right = false; this.mem = {}; this.log = []; this.beat = ''; }
  async read() { this.v = await this.page.eval(READ); return this.v; }
  async press(target) { const p = this.page; await p.move(target.x, target.y); await p.down('left'); this.left = target === this.v.bolt ? 'bolt' : 'handle'; }
  async releaseLeft() { if (this.left) { await this.page.up('left'); this.left = null; } }
  async rmb(on) { if (on === this.right) return; if (on) await this.page.down('right'); else await this.page.up('right'); this.right = on; }
  async click(target) { await this.releaseLeft(); await this.page.click(target.x, target.y); }
  // A missed grab (the target moved under the cursor) shows as no grip; let go and grab again.
  async verify(kind, gripped) {
    if (this.left !== kind) { this.miss = 0; return; }
    this.miss = gripped ? 0 : (this.miss || 0) + 1;
    if (this.miss >= 3) { this.note(`regrab ${kind}`); await this.releaseLeft(); this.miss = 0; }
  }
  async holdHandle() {
    await this.verify('handle', this.v.s.held);
    if (this.left === 'handle') return true; if (this.left) await this.releaseLeft(); if (!this.v.handle) return false; await this.press(this.v.handle); return true;
  }
  // Door speed in opening/s (positive opens) for this frame, as a horizontal mouse move.
  async door(speed, dt) { if (!(await this.holdHandle())) return; const dx = -speed * dt * this.v.scale * 440; await this.page.move(this.page.mouse.x + dx, this.page.mouse.y); }
  async force(target) {
    if (!(await this.holdHandle())) return;
    const dx = Math.max(-25, Math.min(25, (target - this.v.s.forceTarget) / 2.8 * this.v.base * 440));
    if (Math.abs(dx) > .3) await this.page.move(this.page.mouse.x + dx, this.page.mouse.y);
  }
  async bolt(speed, dt) {
    await this.verify('bolt', this.v.s.boltHeld);
    if (this.left !== 'bolt') { if (this.left) await this.releaseLeft(); if (!this.v.bolt) return; await this.press(this.v.bolt); }
    const travel = Math.max(96, this.v.stageH * .2); await this.page.move(this.page.mouse.x, this.page.mouse.y + speed * dt * travel);
  }
  async hand() {
    const s = this.v.s;
    if (s.handStage !== 'grip') { await this.holdHandle(); return; }
    await this.force(s.gripStage === 'ease' ? .32 : .84);
  }
  note(text) { this.log.push(`${this.v ? this.v.s.time.toFixed(1) : '0'}s ${text}`); }
}

// One decision per frame, by beat; mirrors what a careful player would do from the visible cues.
async function step(pl, dt, mode) {
  const v = pl.v, s = v.s, m = pl.mem;
  if (s.beat !== pl.beat) { pl.note(`beat ${s.beat} (A ${s.A.toFixed(2)}, o ${s.o.toFixed(3)})`); pl.beat = s.beat; pl.mem = {}; return; }
  if (mode.fail && await mode.fail(pl, dt)) return;
  switch (s.beat) {
    case 'P0':
      if (s.b > .8 + 1e-3) await pl.bolt(-.2, dt);
      else if (Math.abs(s.b - .8) < 1e-3) { m.pause = (m.pause || 0) + dt; if (m.pause > .35) await pl.bolt(-.9, dt); else if (pl.left !== 'bolt') await pl.bolt(0, dt); }
      else await pl.bolt(-.9, dt);
      break;
    case 'C1': case 'C2':
      if (s.beat === 'C2' && s.o >= .46) {
        if (pl.lit && !s.light && s.corridor === 'dead') { if (v.sw) await pl.click(v.sw); }
        else if (pl.left) await pl.releaseLeft();
        break;
      }
      if (s.band === 'stiff' || (s.o > .11 && s.o < .14 && s.L > 0)) { if (v.cover === 'on' && !v.ending) await pl.door(.2, dt); else await pl.holdHandle(); }
      else await pl.door(.28, dt);
      break;
    case 'C3': if (s.hand) await pl.hand(); else if (pl.left) await pl.releaseLeft(); break;
    case 'C4':
      if (s.eyes !== 'none') { await pl.rmb(true); await pl.holdHandle(); } else { await pl.rmb(false); await pl.releaseLeft(); }
      break;
    case 'C5':
      await pl.rmb(false);
      if (s.mimic === 'watch') { if (m.base === undefined) m.base = s.o; const quietOK = s.band !== 'stiff' || (v.cover === 'on' && !v.ending); if (s.o < m.base + .03 && quietOK) await pl.door(.25, dt); else await pl.holdHandle(); }
      else if (s.mimic === 'response') { m.base = undefined; await pl.door(-.3, dt); }
      else { m.base = undefined; await pl.holdHandle(); }
      break;
    case 'C6a':
      if (pl.left) await pl.releaseLeft();
      if (s.drawer === 'open' && !s.wantRear && v.turn) await pl.click(v.turn);
      if (s.drawer === 'shut' && s.wantRear && v.turn) await pl.click(v.turn);
      break;
    case 'C6b':
      if (s.wedge === 'rest' && !m.wedged) {
        if (s.shovePhase === 'shove') m.afterShove = true;
        if (m.afterShove && s.shovePhase === 'idle' && v.slipper) { await pl.click(v.slipper); m.wedged = true; }
        else await pl.holdHandle();
      } else if (s.wedge === 'in' && s.slipEvents >= 1) await pl.holdHandle();
      else if (pl.left) await pl.releaseLeft();
      break;
    case 'C6c':
      if (s.drawer === 'open' && !s.wantRear) {
        if (s.wedge === 'in') { if (pl.left) await pl.releaseLeft(); else if (v.turn) await pl.click(v.turn); }
        else if (s.wedge === 'rest' && s.shovePhase === 'idle' && v.slipper) { if (pl.left) await pl.releaseLeft(); else if (s.canWedge) await pl.click(v.slipper); }
        else if (s.wedge === 'rest') await pl.holdHandle();
        break;
      }
      if (s.wantRear) { if (s.drawer !== 'open' && v.turn) await pl.click(v.turn); break; }
      if (s.turn > 0) break;
      if (s.drawer === 'shut' && !s.shoves) { if (s.wedge === 'in') { if (v.slipper && !m.removing) { await pl.click(v.slipper); m.removing = true; } } else if (s.wedge === 'rest') await pl.holdHandle(); break; }
      if (s.wedge === 'rest' && s.shovePhase === 'idle' && s.drawer === 'idle' && !m.rewedged && v.slipper && s.beatTime > .5) { await pl.click(v.slipper); m.rewedged = true; break; }
      if (s.wedge !== 'in') await pl.holdHandle(); else if (s.slipLevel >= 1) await pl.holdHandle();
      break;
    case 'C7': if (pl.left) await pl.releaseLeft(); await pl.rmb(false); break;
    case 'F1':
      if (s.eyes === 'none' && s.o < .21) { await pl.rmb(false); await pl.releaseLeft(); break; }
      await pl.rmb(true);
      if (s.o > .405) await pl.door(-.28, dt);
      else if (v.cover === 'on' && !v.ending) await pl.door(-.2, dt); else await pl.holdHandle();
      break;
    case 'F2':
      await pl.rmb(false);
      if (s.hand) { await pl.hand(); break; }
      if (s.flush) { await pl.releaseLeft(); break; }
      if (s.band === 'stiff') { if (v.cover === 'on' && !v.ending) await pl.door(-.2, dt); else await pl.holdHandle(); }
      else await pl.door(s.o > .06 ? -.28 : -.18, dt);
      break;
    case 'F3': {
      if (s.seatedFlag) { await pl.releaseLeft(); break; }
      if (pl.left === 'handle') await pl.releaseLeft();
      if (s.knockImpact && !m.wasImpact) m.lastKnock = s.time;
      m.wasImpact = s.knockImpact;
      if (s.b < .8 - 1e-3) { await pl.bolt(.9, dt); m.pause = 0; }
      else if (Math.abs(s.b - .8) < 1e-3) { m.pause = (m.pause || 0) + dt; const since = s.time - (m.lastKnock ?? -9); if (m.pause > .3 && since > .3 && since < .7) await pl.bolt(.22, dt); else await pl.bolt(0, dt); }
      else await pl.bolt(.22, dt);
      break;
    }
  }
}

// Each failure policy deliberately makes one mistake at the beat that teaches it.
const FAILS = {
  noise: { from: 'C1', act: async (pl, dt) => { const s = pl.v.s; if (s.beat !== 'C1') return false; await pl.door(.12, dt); return true; } },
  eyes: { from: 'C4', act: async (pl, dt) => { const s = pl.v.s; if (s.beat !== 'C4') return false; await pl.rmb(false); await pl.holdHandle(); return true; } },
  hand: { from: 'C3', act: async (pl, dt) => { const s = pl.v.s; if (s.beat !== 'C3' || !s.hand) return false; await pl.releaseLeft(); return true; } },
  strain: { from: 'C3', act: async (pl, dt) => { const s = pl.v.s; if (s.beat !== 'C3' || !s.hand || s.handStage !== 'grip') return false; await pl.force(1); return true; } },
  mimic: { from: 'C5', act: async (pl, dt) => { const s = pl.v.s; if (s.beat !== 'C5' || s.mimic === 'none') return false; await pl.door(-.1, dt); return true; } },
  drawer: { from: 'C6', act: async (pl, dt) => { const s = pl.v.s; if (s.beat !== 'C6a') return false; await pl.releaseLeft(); return true; } },
  forced: { from: 'C6', act: async (pl, dt) => { const s = pl.v.s; if (s.beat !== 'C6b') return false; await pl.releaseLeft(); return true; } }
};

async function play(page, { lit = false, fail = null, shots = '', label = 'win', limit = 420, probe = false, pauseAt = null } = {}) {
  const pl = new Player(page, { lit, label });
  await pl.read();
  await page.click(pl.v.start.x, pl.v.start.y);
  await sleep(200);
  const mode = {};
  if (fail) {
    const f = FAILS[fail];
    mode.fail = async (p, dt) => (p.v.s.beat === 'C6a' && fail === 'forced') ? false : f.act(p, dt);
  }
  let last = Date.now(), shot = {}, t0 = Date.now(), lastProbe = 0;
  const audit = { probe: { samples: 0, maxGainError: 0, maxOffsetError: 0, worst: null }, pauses: [], occluded: new Set() };
  let lastOcclusion = 0;
  while ((Date.now() - t0) / 1000 < limit) {
    await pl.read();
    if (pl.v.endShown) break;
    if (shots && pl.v.s.beat && !shot[pl.v.s.beat] && pl.v.s.beatTime > 2.2) { shot[pl.v.s.beat] = true; await page.screenshot(path.join(shots, `${label}-${pl.v.s.beat}.png`)); }
    if (Date.now() - lastOcclusion >= 700) { lastOcclusion = Date.now(); for (const o of await page.eval(OCCLUSION)) audit.occluded.add(`${pl.v.s.beat}:${o}`); }
    if (probe && Date.now() - lastProbe >= 100) { lastProbe = Date.now(); await probeAudio(page, audit.probe); }
    if (pauseAt && pauseAt.includes(pl.v.s.beat) && !audit.pauses.some(p => p.beat === pl.v.s.beat) && threatened(pl.v.s)) audit.pauses.push(await checkPause(pl));
    const now = Date.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
    await step(pl, dt, mode);
    const spent = Date.now() - now; if (spent < 15) await sleep(15 - spent);
  }
  await pl.releaseLeft(); await pl.rmb(false);
  await sleep(300); await pl.read();
  const end = await page.eval(`({ end: document.getElementById('scene').dataset.end, title: document.getElementById('endTitle').textContent, copy: document.getElementById('endCopy').textContent, snap: doorH4.snapshot() })`);
  if (shots) await page.screenshot(path.join(shots, `${label}-end.png`));
  return { end, log: pl.log, player: pl, audit };
}

const threatened = s => (s.hand && s.handStage === 'grip') || s.eyes === 'open' || s.mimic === 'watch' || s.drawer === 'open' || s.shoves;
// Esc during a threat: the simulation and the AudioContext must freeze, then resume.
async function checkPause(pl) {
  const page = pl.page, beat = pl.v.s.beat;
  await page.key('Escape', 'Escape', 27); await sleep(80);
  const a = await page.eval(`({ s: doorH4.snapshot(), audio: doorH4.audioProbe() && doorH4.audioProbe().state, layer: !document.getElementById('pauseLayer').hidden })`);
  await sleep(1000);
  const b = await page.eval(`({ s: doorH4.snapshot() })`);
  const frozen = a.s.time === b.s.time && a.s.o === b.s.o && a.s.d === b.s.d && a.s.E === b.s.E && a.s.force === 0 && !a.s.held;
  await page.key('Escape', 'Escape', 27); await sleep(80);
  pl.left = null; await page.up('left').catch(() => {}); pl.right = false;
  const c = await page.eval(`({ s: doorH4.snapshot(), audio: doorH4.audioProbe() && doorH4.audioProbe().state })`);
  return { beat, frozen, suspended: a.audio === 'suspended' || a.audio === null, layer: a.layer, resumed: !c.s.paused && (c.audio === 'running' || c.audio === null), grace: c.s.resumeGrace };
}
// Played gain (the GainNode's current value) against the model's judged gain, for masking streams.
async function probeAudio(page, acc) {
  const r = await page.eval(`(() => { const p = doorH4.audioProbe(); const m = doorH4.soundState(), snap = doorH4.snapshot(); return p && { p, m: m.streams, sources: snap.sources, duck: snap.duck }; })()`);
  if (!r || r.p.state !== 'running') return;
  for (const id of ['elevator', 'traffic', 'mimic']) {
    const model = r.m[id], heard = r.p.streams[id], src = r.sources.find(x => x.src === id);
    if (!model || !heard || !src) continue;
    const len = id === 'elevator' ? 11 : id === 'traffic' ? 8 : 1.3;
    if (src.t < .3 || src.t > len - .3) continue; // GainNode smoothing settles after edges
    // A stalled frame (> 80 ms) is clamped by the rules, so audio runs ahead until the next frame re-locks it.
    // The audio clock keeps running between frames while the model waits for the next one; a gap over the
    // 80 ms frame clamp is re-locked on that next frame, so it is not drift.
    if (r.p.lastRawDt > .08 || r.p.sinceFrame > .08 || heard.age < .15) { acc.resync = (acc.resync || 0) + 1; continue; }
    const gainError = Math.abs(heard.gain - model.gain);
    const span = id === 'elevator' ? 10 : Infinity;
    const expected = model.offset + r.p.sinceFrame;
    let offsetError = Math.abs(heard.offset - (id === 'elevator' ? expected % 10 : expected));
    if (span !== Infinity) offsetError = Math.min(offsetError, Math.abs(offsetError - span));
    // During a 0.3 s duck ramp the GainNode trails the model by about one frame; report it separately.
    if (r.duck > 0 && r.duck < 1) { acc.ramp = Math.max(acc.ramp || 0, gainError); acc.rampSamples = (acc.rampSamples || 0) + 1; continue; }
    acc.samples++;
    if (gainError > acc.maxGainError) { acc.maxGainError = gainError; acc.worst = { id, heard: heard.gain, model: model.gain, t: src.t }; }
    acc.maxOffsetError = Math.max(acc.maxOffsetError, offsetError);
  }
}

async function main() {
  const narrow = flag('narrow'), size = narrow ? { width: 390, height: 844 } : { width: 1280, height: 800 };
  const page = await launch({ url: URL, ...size, headless: !flag('headed') });
  await page.send('Emulation.setDeviceMetricsOverride', { ...size, deviceScaleFactor: 1, mobile: false });
  await sleep(1200);
  for (let i = 0; i < 50 && !(await page.eval(`!document.getElementById('start').disabled`)); i++) await sleep(200);
  if (flag('muted')) { const b = await page.box('#sound'); await page.click(b.x, b.y); }
  const scenario = args.find(a => !a.startsWith('--')) || 'win';
  const results = [];
  const runs = scenario === 'all' ? ['win', ...Object.keys(FAILS).map(k => `fail:${k}`)] : [scenario];
  for (const run of runs) {
    const fail = run.startsWith('fail:') ? run.slice(5) : null;
    if (fail) {
      // Fail scenarios start from the checkpoint by playing through, so every input is real.
      await page.goto(URL); await sleep(1000);
    }
    const pauseAt = flag('pauses') ? ['C3', 'C4', 'C5', 'C6a', 'C6b', 'F1', 'F2'] : null;
    const r = await play(page, { lit: flag('lit'), fail, shots: SHOTS, probe: flag('probe'), pauseAt, label: run.replace(':', '-') + (narrow ? '-narrow' : '') + (flag('lit') ? '-lit' : '') });
    let ok = fail ? r.end.end === fail : r.end.end === 'win';
    console.log(`${ok ? 'PASS' : 'FAIL'} ${run}: end=${r.end.end} "${r.end.title}" at ${r.end.snap.beat} t=${r.end.snap.time.toFixed(1)}s A=${r.end.snap.A.toFixed(2)}`);
    if (!ok || flag('verbose')) console.log('  ' + r.log.join('\n  '));
    if (flag('probe')) { const p = r.audit.probe; const good = (fail || p.samples > 20) && p.maxGainError <= .02 && p.maxOffsetError <= .06 && (p.ramp || 0) <= .06; ok = ok && good;
      console.log(`${good ? 'PASS' : 'FAIL'} audio probe: ${p.samples} steady samples, ${p.rampSamples || 0} duck-ramp samples (max ${(p.ramp || 0).toFixed(4)}), ${p.resync || 0} skipped around stalls/resyncs, max |GainNode - base*e| ${p.maxGainError.toFixed(4)}, max offset drift ${p.maxOffsetError.toFixed(3)} s ${p.worst ? JSON.stringify(p.worst) : ''}`); }
    for (const p of r.audit.pauses) { const good = p.frozen && p.suspended && p.layer && p.resumed; ok = ok && good; console.log(`${good ? 'PASS' : 'FAIL'} pause in ${p.beat}: frozen=${p.frozen} audioSuspended=${p.suspended} layer=${p.layer} resumed=${p.resumed} grace=${p.grace}`); }
    { const occ = [...r.audit.occluded]; const good = occ.length === 0; ok = ok && good; console.log(`${good ? 'PASS' : 'FAIL'} no occluded controls${good ? '' : ': ' + occ.join(', ')}`); }
    if (fail && r.end.end === fail) {
      // Retry restores the chapter checkpoint through the real end-card button; restart returns to the bolt.
      const retry = await page.box('#retry'); await page.click(retry.x, retry.y); await sleep(400);
      const after = await page.eval(`doorH4.snapshot()`);
      const retryOk = after.state === 'playing' && after.cp === FAILS[fail].from && after.A <= .3 + 1e-9;
      console.log(`${retryOk ? 'PASS' : 'FAIL'} retry after ${fail}: beat=${after.beat} cp=${after.cp} A=${after.A.toFixed(2)}`);
      const restart = await page.box('#restart'); await page.click(restart.x, restart.y); await sleep(400);
      const fresh = await page.eval(`doorH4.snapshot()`);
      const restartOk = fresh.beat === 'P0' && fresh.b === 1 && fresh.o === 0 && fresh.A === 0 && !fresh.light;
      console.log(`${restartOk ? 'PASS' : 'FAIL'} restart: beat=${fresh.beat} b=${fresh.b} o=${fresh.o}`);
      ok = ok && retryOk && restartOk;
    }
    results.push({ run, ok });
  }
  await page.close();
  process.exitCode = results.every(r => r.ok) ? 0 : 1;
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { Player, play, READ };
