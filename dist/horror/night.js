// Rules of the night: one door, seven tension gimmicks and the H2 hand, as a deterministic,
// DOM-free model. The view feeds intents (grip, drag, gaze, turn, switch, slipper, bolt) and
// drains events; tests drive the same object. No Math.random, Date or performance here.
(function (root) {
  'use strict';
  const T = root.DoorTuning || require('./tuning.js');
  const CONTOURS = root.DoorContours || require('./contours.js');
  const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n));
  const BEATS = ['P0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6a', 'C6b', 'C6c', 'C7', 'F1', 'F2', 'F3', 'END'];
  const CHECKPOINT = { P0: 'P0', C1: 'C1', C2: 'C2', C3: 'C3', C4: 'C4', C5: 'C5', C6a: 'C6', C6b: 'C6', C6c: 'C6', C7: 'C7', F1: 'C7', F2: 'C7', F3: 'C7', END: 'C7' };
  const CHECKPOINT_BEAT = { P0: 'P0', C1: 'C1', C2: 'C2', C3: 'C3', C4: 'C4', C5: 'C5', C6: 'C6a', C7: 'C7' };
  const GLASS_FROM = BEATS.indexOf('C3'), RULES_PRY = .25;

  // ---- masking sounds ---------------------------------------------------------------------
  function contourAt(src, tau) {
    const c = CONTOURS.sources[src], v = c.values;
    let x = tau / CONTOURS.step;
    if (c.loop) { x = ((x % v.length) + v.length) % v.length; const i = Math.floor(x); return v[i] + (v[(i + 1) % v.length] - v[i]) * (x - i); }
    if (x < 0 || x > v.length - 1) return 0;
    const i = Math.floor(x); return v[i] + (v[Math.min(v.length - 1, i + 1)] - v[i]) * (x - i);
  }
  function maskLength(source) {
    const M = T.masks;
    return source.src === 'elevator' ? 2 * M.ramp + source.hold : source.src === 'traffic' ? M.traffic : M.response + M.responseFade;
  }
  // The multiplier written to the source's GainNode (gain = base x e); also what the rules judge.
  function envelope(source, t = source.t) {
    const M = T.masks, end = maskLength(source);
    if (t < 0 || t >= end) return 0;
    let e;
    if (source.src === 'elevator') e = t < M.ramp ? t / M.ramp : t > end - M.ramp ? (end - t) / M.ramp : 1;
    else if (source.src === 'traffic') e = Math.min(1, t / M.trafficFade, (end - t) / M.trafficFade);
    else e = t < M.response ? 1 : (end - t) / M.responseFade;
    const fade = source.fadeFrom === undefined ? 1 : clamp(1 - (t - source.fadeFrom) / 1);
    return clamp(e) * fade;
  }

  class Night {
    constructor() { this.attempt = 0; this.failCounts = {}; this.reset(); }
    reset() {
      Object.assign(this, {
        state: 'ready', beat: 'P0', paused: false, time: 0, reason: '', events: [], serial: 0, s: {}, cp: null, hint: 0,
        // door
        o: 0, held: false, flush: true, unflushDrag: 0, holder: 'none', holderFloor: 0, reqDoor: 0, playerHistory: [], openHistory: [],
        playerPos: 0, posHistory: [], knockImpact: false, handContext: '', preview: .015, slamLock: -10, boltSpeed: 0, watchSteps: 0,
        carry: 0, pryTo: 0, failWhy: '', lastScrapeCue: -10, yanked: 0, yankBy: 0,
        speed: 0, scrape: 0, lastPlayerMove: -10,
        // attention (소리)
        A: 0, lastGain: -10, warned: [false, false], leak: false, lastSource: '',
        // masks
        sources: [], program: null, L: 0, covered: false, preWarn: false, preWarned: false, ducking: false, duck: 1,
        // light (G4), gaze (G3), view (G7)
        light: false, lit: 0, lastSwitch: -10, gazeDown: false, gaze: 0, wantRear: false, turn: 0,
        corridor: 'on', corridorShade: .08, flickerAt: -1, revealed: false, adapt: 0, confirmRoute: '', silhouette: 0,
        ambience: 1, ambienceTarget: 1,
        // H2 hand
        hand: false, handStage: 'none', gripStage: 'none', handAge: 0, gripTime: 0, force: 0, forceTarget: 0, strain: 0,
        pushGood: 0, defended: 0, easeGood: 0, retreatTime: 0, strainWarned: false, resumeGrace: 0, graceAt: -20, contact: 0,
        // G3 eyes
        eyes: 'none', eyesAge: 0, eyesFade: 0, E: 0, eyesWarned: false, chord: 0, eyesVisit: '',
        // G6 mimic
        mimic: 'none', mimicTime: 0, oRef: 0, o5: 0, bait: 0, copy: 0, copied: 0, P: 0, pinchWarned: false, loiterRef: 0, loiter: 0, loiterTaps: 0,
        fingersOut: 0, palm: 0,
        // G5 wedge and shoves
        wedge: 'rest', wedgeTime: 0, slip: 0, slipLevel: 0, slipEvents: 0, prop: true, shoves: false, shoveClock: 0, shovePeriod: T.shove.periodSolo,
        shovePhase: 'idle', shoveTime: 0, absorbed: 0, wedgeTried: false, gripSince: -1,
        // G7 drawer
        drawer: 'idle', d: 0, visit: 0, watchTime: 0, slidePlayed: false,
        // G2 bolt
        b: 0, boltHeld: false, reqBolt: 0, boltHistory: [], detent: 'none', detentPause: 0, boltCooldown: 0, seatedFlag: false, boltFirst08: false,
        knockClock: -1, impact: 0, shake: 0, fade: 0
      });
    }
    emit(type, detail = {}) { this.events.push({ type, id: ++this.serial, time: this.time, beat: this.beat, ...detail }); }

    // ---- lifecycle ------------------------------------------------------------------------
    start(checkpoint = 'P0', fresh = false) {
      if (fresh) this.failCounts = {};
      const beat = CHECKPOINT_BEAT[checkpoint] || 'P0';
      const keep = this.cp && checkpoint !== 'P0' && this.cp.id === checkpoint ? this.cp : null;
      this.attempt++; this.reset(); this.state = 'playing';
      this.hint = (this.failCounts[beat] || 0) >= 2 ? 2 : (this.failCounts[beat] || 0) >= 1 ? 1 : 0;
      this.canonical(beat);
      if (keep) { this.A = keep.A; this.light = keep.light; this.lit = keep.light ? 1 : 0; }
      this.emit('start', { checkpoint });
      this.enter(beat);
    }
    retry() { this.start(this.cp ? this.cp.id : 'P0'); }
    canonical(beat) {
      // Canonical checkpoint states (spec section 10). P0 begins with the bolt seated.
      const pre = BEATS.indexOf(beat);
      this.b = beat === 'P0' ? 1 : 0; this.flush = this.b > 0 || beat === 'C1';
      this.o = { P0: 0, C1: 0, C2: .45, C3: .62, C4: .62, C5: .55, C6a: .012, C7: .012 }[beat] || 0;
      if (pre >= BEATS.indexOf('C2')) this.flush = false;
      if (pre >= BEATS.indexOf('C3')) { this.corridor = 'dead'; this.corridorShade = T.corridor.dead; this.revealed = true; this.confirmRoute = 'retry'; }
      if (beat === 'C4' || beat === 'C5') { this.holder = 'min045'; this.holderFloor = .45; }
      if (pre >= BEATS.indexOf('C6a')) { this.holder = 'unseated012'; this.holderFloor = .012; }
      if (pre >= BEATS.indexOf('C7')) this.prop = false;
      this.ambience = beat === 'P0' || beat === 'C1' ? 1 : .6; this.ambienceTarget = this.ambience;
    }
    enter(beat) {
      const from = this.beat;
      this.beat = beat; this.s = { t: 0 };
      const cp = CHECKPOINT[beat];
      if (beat === CHECKPOINT_BEAT[cp] || (beat === 'P0')) {
        if (cp !== 'P0') this.A = Math.min(this.A, T.attention.checkpointCap);
        this.cp = { id: cp, A: this.A, light: this.light };
      }
      if (beat === 'C7') this.A = Math.min(this.A, T.attention.checkpointCap);
      this.emit('beat', { beat, from });
    }
    active() { return this.state === 'playing' && !this.paused; }
    fail(reason) {
      if (this.state !== 'playing') return;
      this.state = 'lost'; this.reason = reason;
      this.failCounts[this.beat] = (this.failCounts[this.beat] || 0) + 1;
      this.letGo(); this.releaseBolt(); this.gazeDown = false; this.impact = 1;
      this.emit('lose', { reason, glass: this.glassBeat(), source: this.lastSource });
    }
    glassBeat() { return BEATS.indexOf(this.beat) >= GLASS_FROM; }
    setPaused(value) {
      if (this.state !== 'playing' || this.paused === !!value) return;
      this.paused = !!value; this.letGo(); this.releaseBolt(); this.gazeDown = false;
      if (!value && this.time - this.graceAt >= 10 && (this.hand || this.eyes !== 'none' || this.drawer === 'open' || this.shoves || this.mimic !== 'none')) {
        this.graceAt = this.time; this.resumeGrace = 1;
      }
      this.emit(value ? 'pause' : 'resume');
    }

    // ---- intents --------------------------------------------------------------------------
    frontReady() { return !this.wantRear && this.turn === 0; }
    gripping() { return this.hand && (this.handStage === 'approach' || this.handStage === 'grip'); }
    inputLocked() { return !this.active() || this.beat === 'END' || (this.beat === 'C7' && this.s.pulling); }
    grip() {
      if (this.inputLocked() || !this.frontReady() || this.boltHeld || this.held) return false;
      this.held = true; this.reqDoor = 0; this.unflushDrag = 0; if (this.gripSince < 0) this.gripSince = this.time;
      this.emit('grip'); return true;
    }
    letGo() {
      if (this.held) this.emit('let-go');
      this.held = false; this.force = 0; this.forceTarget = 0; this.reqDoor = 0; this.gripSince = -1;
    }
    // dDoor: change of opening requested by the pointer at the current zoom (positive opens).
    // dForce: the same gesture measured in unzoomed front-view travel, so force feel never depends on zoom.
    drag(dDoor, dForce = dDoor) {
      if (!this.active() || !this.held) return;
      if (this.gripping() && this.handStage === 'grip') this.forceTarget = clamp(this.forceTarget - dForce * T.hand.forceGain);
      else if (!this.gripping()) this.reqDoor += clamp(dDoor, -.05, .05);
    }
    setGaze(down) {
      const value = !!down && this.active() && this.frontReady();
      if (value !== this.gazeDown) { this.gazeDown = value; this.emit(value ? 'gaze-down' : 'gaze-up'); }
    }
    // Looking behind unlocks with the drawer chapter; the switch with the corridor chapter.
    turnUnlocked() { return BEATS.indexOf(this.beat) >= BEATS.indexOf('C6a') && this.beat !== 'END'; }
    switchUnlocked() { return BEATS.indexOf(this.beat) >= BEATS.indexOf('C2'); }
    canTurn() { return !this.inputLocked() && this.turnUnlocked() && !this.held && !this.boltHeld && !this.gazeDown && !['inserting', 'removing'].includes(this.wedge); }
    setTurn(rear) {
      rear = !!rear;
      if (rear === this.wantRear || (rear && !this.canTurn()) || (!rear && !this.active())) return false;
      this.wantRear = rear; this.emit('turn', { to: rear ? 'rear' : 'door' }); return true;
    }
    handsFree() { return !this.held && !this.boltHeld; }
    canSwitch() { return !this.inputLocked() && this.switchUnlocked() && this.frontReady() && this.handsFree() && !this.gazeDown && this.time - this.lastSwitch >= T.light.debounce; }
    toggleLight() {
      if (!this.canSwitch()) return false;
      this.light = !this.light; this.lastSwitch = this.time; this.emit(this.light ? 'light-on' : 'light-off');
      this.noise(T.attention.click, 'switch', true); return true;
    }
    wedgeBeat() { return ['C6b', 'C6c'].includes(this.beat) && this.prop; }
    canWedge() {
      if (this.inputLocked() || !this.wedgeBeat() || !this.frontReady() || !this.handsFree() || this.gripping()) return false;
      if (this.wedge === 'in') return true;
      return this.wedge === 'rest' && this.o >= T.wedge.min && this.o <= T.wedge.max && this.shovePhase === 'idle';
    }
    toggleWedge() {
      if (!this.canWedge()) { if (this.wedgeBeat()) this.emit('wedge-refused', { reason: this.shovePhase !== 'idle' ? 'shove' : this.held ? 'hand' : 'range' }); return false; }
      this.wedgeTried = true;
      if (this.wedge === 'in') { this.wedge = 'removing'; this.wedgeTime = 0; this.emit('wedge-removing'); }
      else { this.wedge = 'inserting'; this.wedgeTime = 0; this.emit('wedge-inserting'); }
      return true;
    }
    boltMovable() { return !this.held && !this.gripping() && (this.mimic === 'none' || this.mimic === 'out') && this.wedge === 'rest' && this.o <= T.bolt.openMax; }
    grabBolt() {
      if (this.inputLocked() || !this.frontReady() || this.held || !['P0', 'C7', 'F3'].includes(this.beat)) return false;
      if (this.beat === 'F3' && this.seatedFlag) return false;
      this.boltHeld = true; this.reqBolt = 0; this.emit('bolt-grab');
      if (this.beat === 'C7' && this.s.pullAt === undefined) this.s.pullAt = this.s.t;
      return true;
    }
    dragBolt(db) { if (this.active() && this.boltHeld) this.reqBolt += clamp(db, -.15, .15); }
    releaseBolt() { if (this.boltHeld) this.emit('bolt-release'); this.boltHeld = false; this.reqBolt = 0; }

    // ---- attention ------------------------------------------------------------------------
    noise(amount, source, maskable) {
      if (amount <= 0 || this.state !== 'playing') return;
      if (maskable && this.covered) { if (source !== 'scrape') this.emit('covered', { source }); return; }
      if (source === 'scrape' && this.time - this.lastScrapeCue > 1.5) { this.lastScrapeCue = this.time; this.emit('scrape'); }
      this.A = Math.min(1, this.A + amount); this.lastGain = this.time; this.lastSource = source;
      T.attention.warn.forEach((level, i) => {
        if (!this.warned[i] && this.A >= level - 1e-9) { this.warned[i] = true; this.impact = Math.max(this.impact, .7); this.emit('warning', { level: i, glass: this.glassBeat(), source }); }
      });
      if (this.A >= 1 - 1e-9) this.fail('noise');
    }
    updateAttention(h) {
      this.leak = this.light && this.o >= T.attention.leakFrom && this.beat !== 'END';
      if (this.leak) { this.noise(T.attention.leak * h, 'light', false); if (!this.active()) return; }
      else if (this.time - this.lastGain >= T.attention.decayAfter) this.A = Math.max(0, this.A - T.attention.decay * h);
      T.attention.warn.forEach((level, i) => { if (this.warned[i] && this.A < level - .1) this.warned[i] = false; });
    }

    // ---- masks ----------------------------------------------------------------------------
    startProgram(firstAt) { this.program = { clock: 0, nextElevator: firstAt, nextTraffic: firstAt + T.masks.cycle.traffic, paused: false, stopped: false }; }
    spawn(src, extra = {}) { const s = { src, t: 0, hold: T.masks.cycle.hold, ...extra }; this.sources.push(s); this.emit('mask-start', { source: src }); return s; }
    stopProgram() {
      if (this.program) this.program.stopped = true;
      for (const s of this.sources) if (s.src !== 'mimic' && s.fadeFrom === undefined) s.fadeFrom = s.t;
    }
    levelAt(dt = 0) {
      let L = 0;
      for (const s of this.sources) L = Math.max(L, envelope(s, s.t + dt) * contourAt(s.src, s.t + dt) * (dt ? this.futureDuck(dt) : this.duck));
      if (dt && this.program && !this.program.stopped && !this.program.paused) {
        const c = this.program.clock + dt;
        for (const [src, at] of [['elevator', this.program.nextElevator], ['traffic', this.program.nextTraffic]]) {
          if (at <= c) { const s = { src, t: c - at, hold: T.masks.cycle.hold }; L = Math.max(L, envelope(s) * contourAt(src, s.t) * this.futureDuck(dt)); }
        }
      }
      return L;
    }
    futureDuck(dt) { return this.ducking ? Math.max(0, this.duck - dt / T.masks.duck) : this.duck; }
    updateMasks(h) {
      const p = this.program;
      if (p && !p.stopped && !p.paused) {
        p.clock += h;
        if (p.clock >= p.nextElevator) { this.spawn('elevator'); p.nextElevator += T.masks.cycle.period; }
        if (p.clock >= p.nextTraffic) { this.spawn('traffic'); p.nextTraffic += T.masks.cycle.period; }
      }
      this.duck = this.ducking ? Math.max(0, this.duck - h / T.masks.duck) : Math.min(1, this.duck + h / T.masks.duck);
      for (const s of this.sources) if (!(s.src === 'mimic' && this.resumeGrace > 0)) s.t += h;
      this.sources = this.sources.filter(s => { const alive = s.t < maskLength(s) && !(s.fadeFrom !== undefined && s.t - s.fadeFrom >= 1); if (!alive) this.emit('mask-end', { source: s.src }); return alive; });
      this.L = this.levelAt();
      const was = this.covered;
      this.covered = this.covered ? this.L >= T.masks.leave : this.L >= T.masks.enter;
      if (this.covered !== was) { this.emit(this.covered ? 'cover-on' : 'cover-off'); this.preWarned = false; }
      this.preWarn = false;
      if (this.covered && !this.ducking && !this.sources.some(x => x.src === 'mimic') && this.sources.every(x => x.fadeFrom === undefined)) {
        for (let dt = .05; dt <= T.masks.preWarn + 1e-9; dt += .05) if (this.levelAt(dt) < T.masks.leave) { this.preWarn = true; break; }
        if (this.preWarn && !this.preWarned) { this.preWarned = true; this.emit('cover-ending'); }
      }
    }

    // ---- door -----------------------------------------------------------------------------
    band(o = this.o) { const [a, b] = T.door.stiff; return o < a ? 'A' : o <= b ? 'stiff' : 'B'; }
    floor() { return this.holder === 'none' ? 0 : this.holder === 'fingers' ? .012 : this.holderFloor; }
    // In C5 the player may not open into the mimic's fail line; elsewhere the player max applies.
    mimicLine() { return Math.min(T.mimic.failCap, this.o5 + T.mimic.failSpan, T.door.playerMax - T.mimic.bait); }
    openCap() { return this.holder === 'fingers' && this.mimic !== 'out' ? Math.min(T.door.playerMax, this.mimicLine() - .03) : T.door.playerMax; }
    // Highest reference from which a bait (0.02 of the player's own opening) is still possible.
    baitCeil() { return this.openCap() - T.mimic.bait - .005; }
    cap() {
      const stiff = this.band() === 'stiff';
      if (this.holder === 'fingers' && this.mimic !== 'out') return stiff ? T.door.fingerStiff : T.door.fingerQuiet;
      return stiff ? T.door.capStiff : T.door.capQuiet;
    }
    doorMovable() { return this.held && !this.gripping() && !['inserting', 'in', 'removing'].includes(this.wedge) && this.b <= T.bolt.free; }
    stepDoor(h, share) {
      let moved = 0;
      if (this.doorMovable() && share !== 0) {
        let d = clamp(share, -this.cap() * h, this.cap() * h);
        if (d > 0 && this.flush) {
          this.unflushDrag += d;
          if (this.unflushDrag <= T.door.unflushDrag) d = 0; else { this.flush = false; this.emit('unflush'); }
        }
        if (d < 0 && this.time < this.slamLock) d = 0;
        if (d < 0 && this.mimic === 'arrive') d = 0;
        if (d < 0 && this.mimic === 'grab') d = 0;
        let next = this.o + d;
        if (d > 0) next = Math.min(next, Math.max(this.o, this.openCap()));
        if (d < 0) next = Math.max(next, Math.min(this.o, this.floor()));
        moved = next - this.o;
        if (moved !== 0) {
          // Stiff-band portion of the move is loud unless covered (소리).
          const [a, b] = T.door.stiff, lo = Math.min(this.o, next), hi = Math.max(this.o, next);
          const inStiff = Math.max(0, Math.min(hi, b) - Math.max(lo, a));
          const before = this.o; this.o = next; this.lastPlayerMove = this.time;
          if (inStiff > 0) {
            // The very first uncovered scrape in C1 is a free lesson: a soft creak and a caption, no cost.
            let cost = inStiff;
            if (!this.covered && this.beat === 'C1' && this.preview > 0) {
              const free = Math.min(cost, this.preview); this.preview -= free; cost -= free;
              if (!this.s.previewed) { this.s.previewed = true; this.emit('stiff-first'); }
            }
            this.noise(T.attention.scrape * cost, 'scrape', true);
          }
          this.checkStops(before);
        }
      }
      this.playerHistory.push(moved); if (this.playerHistory.length > Math.round(T.door.velocityWindow / T.step)) this.playerHistory.shift();
      this.speed = Math.abs(this.playerHistory.reduce((a, v) => a + v, 0)) / T.door.velocityWindow;
      return moved;
    }
    checkStops(before) {
      const floor = this.floor(), arrivedClosed = this.o <= Math.max(T.door.flush, floor + 1e-6) && before > this.o && floor <= .02;
      const arrivedOpen = this.o >= T.door.playerMax - 1e-9 && before < this.o;
      const n = Math.round(T.door.velocityWindow / T.step) - 1, recent = this.playerHistory.slice(-n).reduce((a, v) => a + v, 0);
      const fast = Math.abs(recent + (this.o - before)) / T.door.velocityWindow > T.door.slamSpeed + 1e-9;
      if ((arrivedClosed || arrivedOpen) && fast) {
        this.o = arrivedClosed ? floor + T.door.bounce : T.door.playerMax - T.door.bounce; this.flush = false;
        this.impact = 1; this.slamLock = this.time + T.door.recoil; this.playerHistory = [];
        this.emit('slam', { end: arrivedClosed ? 'closed' : 'open' }); this.noise(T.attention.slam, 'slam', false);
      } else if (arrivedClosed && floor === 0 && !this.flush) {
        this.o = 0; this.flush = true; this.unflushDrag = 0; this.emit('flush');
      }
    }
    still() {
      const n = Math.round(T.door.stillWindow / T.step), h = this.openHistory;
      return h.length >= n && Math.abs(this.o - h[h.length - n]) < T.door.still;
    }

    // ---- H2 hand ------------------------------------------------------------------------------
    handNow(context) {
      Object.assign(this, { hand: true, handStage: 'approach', gripStage: 'none', handAge: 0, gripTime: 0, force: 0, forceTarget: 0,
        strain: 0, pushGood: 0, defended: 0, easeGood: 0, retreatTime: 0, strainWarned: false, handContext: context });
      this.emit('scratch', { context });
    }
    updateHand(h) {
      const H = T.hand;
      if (this.resumeGrace > 0) return;
      this.handAge += h;
      this.force += ((this.held ? this.forceTarget : 0) - this.force) * (1 - Math.exp(-H.smoothing * h));
      const low = Math.max(H.lowClamp, this.floor());
      if (this.handStage === 'retreat') {
        this.retreatTime += h;
        if (this.retreatTime > H.retreat) { this.handStage = 'released'; this.hand = false; this.force = 0; this.forceTarget = 0; this.emit('hand-free'); }
        return;
      }
      if (this.handStage === 'approach') {
        if (this.pryTo && this.o < this.pryTo) { this.o = Math.min(this.pryTo, this.o + RULES_PRY * h); if (this.o >= this.pryTo) this.pryTo = 0; return; }
        if (this.handAge >= H.approach) { this.handStage = 'grip'; this.contact = 1; this.emit('grip-on'); }
        else { this.o = clamp(this.o - this.force * .075 * h, Math.min(this.o, low), Math.max(this.o, .88)); return; }
      }
      this.gripTime += h;
      const position = this.gripTime % H.cycle;
      const stage = position < H.brace ? 'brace' : position < H.brace + H.push ? 'push' : 'ease';
      if (stage !== this.gripStage) {
        if (this.gripStage === 'push') { if (this.pushGood >= H.pushGood) { this.defended++; this.emit('push-defended', { count: this.defended }); } this.pushGood = 0; }
        this.gripStage = stage; this.emit(stage === 'brace' ? 'inhale' : stage === 'push' ? 'shove-hand' : 'wood-release');
        if (stage === 'push') this.contact = .8;
      }
      if (stage === 'push' && this.force >= H.strongMin) this.pushGood += h;
      this.o = clamp(this.o + (H.enemy[stage] - this.force * H.forceEffect) * h, Math.min(this.o, low), 1);
      if (stage === 'ease' && this.force > H.softMax) this.strain += (this.force - H.softMax) * H.strainRate * h;
      else if (this.force > .96) this.strain += H.strainMax * h;
      else this.strain = Math.max(0, this.strain - H.strainDecay * h);
      if (this.strain >= H.strainWarn && !this.strainWarned) { this.strainWarned = true; this.impact = 1; this.emit('strain-warning', { glass: this.glassBeat() }); }
      if (this.strain < H.strainWarn * .6) this.strainWarned = false;
      if (this.strain >= H.strainLimit) { this.fail('strain'); return; }
      if (this.o >= H.failOpen || this.handAge > H.timeLimit + H.approach) { this.failWhy = this.o >= H.failOpen ? 'open' : 'timeout'; this.fail('hand'); return; }
      const calm = stage === 'ease' && this.defended >= H.required && this.force >= H.softMin && this.force <= H.softMax;
      this.easeGood = calm ? this.easeGood + h : 0;
      if (this.easeGood > H.easeHold) { this.handStage = 'retreat'; this.retreatTime = 0; this.emit('hand-retreat', { context: this.handContext }); }
    }

    // ---- G3 eyes ---------------------------------------------------------------------------
    eyesNow(visit) { this.eyes = 'breath'; this.eyesAge = 0; this.eyesFade = 0; this.E = 0; this.eyesWarned = false; this.chord = 0; this.eyesVisit = visit; this.emit('breath', { visit }); }
    updateEyes(h) {
      if (this.eyes === 'none') return;
      const V = this.eyesVisit === 'C4' ? T.eyes.c4 : T.eyes.f1;
      if (this.resumeGrace > 0) return;
      this.eyesAge += h;
      const fadeStart = this.eyesVisit === 'C4' ? V.breathLead : V.fadeAt - V.breathAt;
      if (this.eyes === 'breath' && this.eyesAge >= fadeStart) { this.eyes = 'open'; this.emit('eyes-open', { visit: this.eyesVisit }); }
      if (this.eyes === 'withdraw') {
        this.eyesFade = Math.max(0, this.eyesFade - h / T.eyes.f1.withdraw);
        if (this.eyesFade === 0) { this.eyes = 'none'; this.E = 0; this.emit('eyes-gone', { visit: this.eyesVisit }); }
        return;
      }
      if (this.eyes !== 'open') return;
      const since = this.eyesAge - fadeStart;
      this.eyesFade = clamp(since / V.fade);
      const visible = this.o >= T.eyes.irisFrom && this.turn < T.turn.watchFrom;
      if (visible && since >= V.grace && !this.gazeDown) this.E += V.rate * h;
      else if (this.gazeDown || !visible) this.E = Math.max(0, this.E - T.eyes.decay * h);
      if (this.E >= T.eyes.warn && !this.eyesWarned) { this.eyesWarned = true; this.emit('eyes-warning'); }
      if (this.E < T.eyes.warn * .5) this.eyesWarned = false;
      if (this.E >= 1) { this.fail('eyes'); return; }
      if (this.eyesVisit === 'C4') {
        if (this.gazeDown && this.held) this.chord += h;
        const full = since - V.fade;
        if (full >= V.stay && this.chord < V.chordGrip && !this.s.chordHint) { this.s.chordHint = true; this.emit('eyes-chord-hint'); }
        if ((full >= V.stay && this.chord >= V.chordGrip) || full >= V.stay + V.overstay) { this.eyes = 'withdraw'; this.emit('eyes-withdraw'); }
      } else if (this.o < T.eyes.irisFrom && this.eyesFade > 0) { this.eyes = 'withdraw'; this.emit('eyes-withdraw'); }
    }

    // ---- G6 mimic ----------------------------------------------------------------------------
    mimicTo(state) { this.mimic = state; this.mimicTime = 0; if (state === 'watch') this.watchSteps = 0; if (state === 'grab') this.yanked = 0; this.emit('mimic-' + state); }
    updateMimic(h, moved) {
      const M = T.mimic;
      if (this.mimic === 'none' || this.mimic === 'out') {
        if (this.mimic === 'out') { this.fingersOut = Math.min(1, this.fingersOut + h / M.fingersOut); }
        return;
      }
      if (this.resumeGrace > 0) return;
      this.mimicTime += h;
      const pinchOn = this.mimic === 'watch' || this.mimic === 'delay' || (this.mimic === 'recover' && this.mimicTime >= M.recoverFree);
      if (this.mimic === 'recover' && this.mimicTime >= M.recoverFree && !this.s.refSet) { this.s.refSet = true; this.oRef = Math.min(this.o, this.baitCeil()); this.P = 0; }
      if (pinchOn) {
        this.P = Math.max(0, this.oRef - this.o);
        if (this.P >= M.pinchWarn && !this.pinchWarned) { this.pinchWarned = true; this.emit('pinch-warning'); }
        if (this.P >= M.pinchGrab) { this.grabNow('pinch'); return; }
      } else this.P = 0;
      if (this.mimic === 'arrive' && this.mimicTime >= M.arrive) { this.oRef = Math.min(this.o, this.baitCeil()); this.loiterRef = this.o; this.loiter = 0; this.mimicTo('watch'); }
      else if (this.mimic === 'watch') {
        // Bait: the player's own net leftward travel >= bait within the last second, then stillness.
        // Player-only positions keep the fingers' copied pull from counting as a bait.
        this.watchSteps++;
        const n = Math.min(Math.round(M.baitWindow / T.step), this.watchSteps), hist = this.posHistory, lowest = Math.min(...hist.slice(-n));
        const size = this.playerPos - lowest;
        if (size >= M.bait - 1e-9 && this.still()) {
          this.bait = size; this.copy = Math.min(size, M.copyMax); this.copied = 0;
          if (size > M.baitLarge) this.emit('bait-large');
          this.mimicTo('delay');
        }
        if (this.o <= this.loiterRef - M.loiterClose) { this.loiterRef = this.o; this.loiter = 0; this.loiterTaps = 0; }
        this.loiter += h;
        if (this.loiterTaps < M.loiterTap.length && this.loiter >= M.loiterTap[this.loiterTaps]) { this.loiterTaps++; this.emit('loiter-tap', { count: this.loiterTaps }); }
        if (this.loiter >= M.loiterGrab) { this.grabNow('loiter'); return; }
      } else if (this.mimic === 'delay') {
        if (this.light && this.mimicTime >= M.palmAt && !this.s.palmShown) { this.s.palmShown = true; this.emit('palm'); }
        if (this.mimicTime >= M.delay) { this.mimicTo('response'); this.spawn('mimic'); }
      } else if (this.mimic === 'response') {
        // The fingers pull the door open by the bait's size (capped) while the player closes against them.
        const step = Math.min(this.copy - this.copied, this.copy * h / M.response);
        this.copied += step; this.o = Math.min(Math.max(this.o, this.baitCeil()), this.o + step);
        if (this.mimicTime >= M.response) {
          if (this.o < M.out) { this.mimicTo('out'); this.fingersOut = 0; this.holder = 'unseated012'; this.holderFloor = .012; this.emit('fingers-out'); }
          else { this.s.refSet = false; this.mimicTo('recover'); }
        }
      } else if (this.mimic === 'recover') {
        if (this.mimicTime >= M.recover) { this.pinchWarned = false; this.loiterRef = Math.min(this.loiterRef, this.o); this.mimicTo('watch'); }
      } else if (this.mimic === 'grab') {
        if (this.yanked < this.yankBy) { const step = Math.min(this.yankBy - this.yanked, this.yankBy * h / M.yankTime); this.yanked += step; this.o = clamp(this.o + step); }
        if (this.mimicTime >= M.grab) { this.ducking = false; this.oRef = Math.min(this.o, this.baitCeil()); this.P = 0; this.pinchWarned = false; this.loiter = 0; this.loiterTaps = 0; this.loiterRef = this.o; this.mimicTo('watch'); }
      }
      if (this.o >= this.mimicLine() - 1e-9) this.fail('mimic');
    }
    grabNow(why) {
      // A yank either leaves the door baitable or wrenches it to the fail line: never an unwinnable WATCH.
      this.yankBy = this.o + T.mimic.yank > this.baitCeil() + 1e-9 ? Math.max(T.mimic.yank, this.mimicLine() - this.o + 1e-6) : T.mimic.yank;
      this.ducking = true; this.P = 0; this.impact = 1; this.contact = 1; this.mimicTo('grab'); this.emit('mimic-yank', { why });
    }

    // ---- G5 shoves and wedge -------------------------------------------------------------------
    attended() { return this.held && this.frontReady(); }
    updateWedge(h) {
      const W = T.wedge;
      if (this.wedge === 'inserting' || this.wedge === 'removing') {
        this.wedgeTime += h;
        if (this.wedge === 'inserting' && this.wedgeTime >= W.insert) { this.wedge = 'in'; this.slip = 0; this.slipLevel = 0; this.emit('wedge-in'); this.noise(T.attention.wedge, 'wedge', true); }
        if (this.wedge === 'removing' && this.wedgeTime >= W.remove) { this.wedge = 'rest'; this.slip = 0; this.slipLevel = 0; this.emit('wedge-out'); this.noise(T.attention.wedge, 'wedge', true); }
      }
      if (this.wedge === 'in' && this.attended()) this.slip = Math.max(0, this.slip - T.shove.reseat * h);
      this.slipLevel = this.wedge === 'in' ? Math.min(2, Math.floor(this.slip / T.shove.slip + 1e-6)) : 0;
    }
    updateShoves(h) {
      if (!this.shoves || this.resumeGrace > 0) return;
      const S = T.shove;
      this.shoveClock += h;
      if (this.shovePhase === 'idle' && this.shoveClock >= this.s.nextShove) { this.shovePhase = 'inhale'; this.shoveTime = 0; this.emit('shove-inhale'); }
      else if (this.shovePhase === 'inhale') {
        this.shoveTime += h;
        if (this.shoveTime >= S.inhale) { this.shovePhase = 'shove'; this.shoveTime = 0; this.resolveShove(); }
      } else if (this.shovePhase === 'shove') {
        this.shoveTime += h;
        if (this.s.shovePush) { const step = Math.min(this.s.shovePush, S.push * h / S.shove); this.s.shovePush -= step; this.o = clamp(this.o + step); }
        if (this.shoveTime >= S.shove) { this.shovePhase = 'idle'; this.s.nextShove = this.shoveClock + this.shovePeriod - S.inhale - S.shove; }
      }
      if (this.o >= S.forced) this.fail('forced');
    }
    resolveShove() {
      const S = T.shove;
      this.impact = Math.max(this.impact, .5);
      if (this.attended()) {
        this.absorbed++; this.contact = 1; this.emit('shove', { result: 'held' });
        if (!this.wedgeTried && this.beat === 'C6b') {
          if (this.absorbed === S.hintAfter) this.emit('wedge-hint');
          if (this.absorbed >= S.skipAfter) this.s.skip = true;
        }
      } else if (this.wedge === 'in') {
        this.slip += S.slip; this.slipEvents++;
        if (this.slip >= S.slipPop - 1e-6) {
          this.wedge = 'rest'; this.slip = 0; this.slipLevel = 0; this.s.shovePush = T.wedge.popPush; this.emit('wedge-pop');
        } else this.emit('wedge-slip', { level: Math.floor(this.slip / S.slip + 1e-6) });
        this.s.lastSlipAt = this.time; this.emit('shove', { result: 'wedge' });
      } else { this.s.shovePush = S.push; this.emit('shove', { result: 'open' }); }
    }

    // ---- G7 drawer ---------------------------------------------------------------------------
    drawerNow(visit) { this.drawer = 'open'; this.visit = visit; this.d = 0; this.watchTime = 0; this.slidePlayed = false; this.emit('drawer-start', { visit }); }
    watching() { return this.wantRear && this.turn >= T.turn.watchFrom; }
    updateDrawer(h) {
      if (this.drawer !== 'open' || this.resumeGrace > 0) return;
      const D = T.drawer;
      if (this.watching()) {
        if (this.watchTime === 0) this.emit('drawer-stop');
        this.watchTime += h;
        if (this.watchTime >= D.watchDelay) {
          this.d = Math.max(0, this.d - (this.visit === 1 ? D.close1 : D.close2) * h);
          if (this.d === 0) { this.drawer = 'shut'; this.emit('drawer-shut', { visit: this.visit }); }
        }
      } else {
        if (this.watchTime > 0) this.emit('drawer-resume');
        this.watchTime = 0;
        this.d += (this.visit === 1 ? D.visit1 : D.visit2) * h;
        if (this.d >= D.slideAt && !this.slidePlayed) { this.slidePlayed = true; this.emit('drawer-slide'); }
        if (this.d >= 1) this.fail('drawer');
      }
    }

    // ---- G2 bolt -----------------------------------------------------------------------------
    seatLimit() { return this.light ? T.bolt.seatLit : T.bolt.seatDark; }
    stepBolt(h, share) {
      const B = T.bolt, near = x => Math.abs(x - B.detent) < 1e-6;
      this.boltCooldown = Math.max(0, this.boltCooldown - h);
      let moved = 0;
      const pushing = this.boltHeld && share !== 0;
      if (pushing && this.boltMovable() && this.boltCooldown === 0) {
        let next = clamp(this.b + share);
        // The detent at 0.8 catches the bolt from either side.
        if (share > 0 && this.b < B.detent - 1e-9 && next > B.detent) next = B.detent;
        if (share < 0 && this.b > B.detent + 1e-9 && next < B.detent) next = B.detent;
        if (near(this.b)) {
          // The bolt only drops into the floor hole when the door is flush, and never during the C7 trap.
          const lined = this.flush && this.o <= T.door.flush && this.beat !== 'C7';
          if (share > 0 && !lined) { next = B.detent; if (!this.s.railStop) { this.s.railStop = true; this.emit('rail-stop'); } }
          else if (this.detent !== 'armed') next = B.detent;
        }
        moved = next - this.b; this.b = next;
        if (moved && near(this.b)) { this.detent = 'at'; this.detentPause = 0; this.emit('detent'); }
      }
      // Passing the detent needs a short pause with no push (spec: 0.2 s, either direction).
      if (near(this.b)) {
        if (pushing && this.detent !== 'armed') this.detentPause = 0; else this.detentPause += h;
        if (this.detentPause >= B.detentPause && this.detent !== 'armed') this.detent = 'armed';
      } else this.detent = 'none';
      this.boltHistory.push(moved); if (this.boltHistory.length > Math.round(B.window / T.step)) this.boltHistory.shift();
      this.boltSpeed = Math.abs(this.boltHistory.reduce((a, x) => a + x, 0)) / B.window;
      if (moved && this.boltCooldown === 0) {
        const seat = this.b > B.detent + 1e-6 || (near(this.b) && this.b - moved > B.detent + 1e-6);
        const limit = seat ? this.seatLimit() : B.guideMax;
        if (this.boltSpeed > limit + 1e-9) this.rattle(moved > 0 ? 'down' : 'up', seat);
      }
      if (this.b >= 1 - 1e-9 && !this.seatedFlag && moved > 0) {
        this.seatedFlag = true; this.emit('latch-click', { beat: this.beat });
        if (this.beat === 'F3') { this.releaseBolt(); this.enter('END'); }
      }
      if (this.b < 1 - 1e-6) this.seatedFlag = false;
      if (this.beat === 'P0' && this.b <= 1e-6 && !this.s.freed) { this.s.freed = true; this.releaseBolt(); this.emit('bolt-free'); this.enter('C1'); }
    }
    rattle(dir, seat, free = false) {
      const B = T.bolt;
      this.boltCooldown = B.cooldown; this.boltHistory = []; this.impact = Math.max(this.impact, .6);
      if (dir === 'down') this.b = seat ? B.kickSeat : Math.max(0, this.b - B.kickGuide);
      else if (seat) this.b = this.beat === 'P0' ? 1 : B.detent;
      this.detent = 'none';
      this.emit('latch-rattle', { dir, seat, free });
      if (!free) this.noise(T.attention.rattle, 'rattle', false);
    }

    // ---- director ----------------------------------------------------------------------------
    hush() { if (this.ambienceTarget !== 0) { this.ambienceTarget = 0; this.emit('hush'); } }
    unhush() { if (this.ambienceTarget === 0) { this.ambienceTarget = T.beats.ambienceAfter; this.emit('unhush'); } }
    direct(h) {
      const s = this.s, B = T.beats;
      s.t += h;
      switch (this.beat) {
        case 'P0':
          if (s.t >= B.p0Click && !s.clicked) { s.clicked = true; this.emit('front-door'); }
          break;
        case 'C1':
          // Start the outside sounds as the edge nears the stiff band (or after a while), so a
          // cautious player who stops short of the band is never left without cover.
          if (!this.program && (this.o >= T.door.stiff[0] - .04 || s.t >= 10)) this.startProgram(B.c1MaskDelay);
          if (!s.entered && this.o >= T.door.stiff[0]) { s.entered = true; this.emit('stiff-enter'); }
          if (this.o >= .42) this.enter('C2');
          break;
        case 'C2':
          if (!this.program) this.startProgram(B.c1MaskDelay);
          if (this.corridor === 'on' && this.o >= T.corridor.adaptFrom) { this.corridor = 'flicker'; this.flickerAt = this.time; this.emit('tube-flicker'); }
          if (this.corridor === 'flicker') {
            const k = (this.time - this.flickerAt) / T.corridor.flicker;
            this.corridorShade = k >= 1 ? T.corridor.dead : (Math.floor(k * 6) % 2 ? .6 : .1);
            if (k >= 1) { this.corridor = 'dead'; this.emit('tube-dead'); }
          } else if (this.corridor === 'dead' && !this.confirmRoute) {
            if (this.o >= T.corridor.adaptFrom && this.still()) this.adapt += h;
            this.corridorShade = T.corridor.dead - (T.corridor.dead - T.corridor.adapted) * clamp(this.adapt / T.corridor.adaptTime);
            if (this.light && this.o >= T.corridor.adaptFrom) { s.litFor = (s.litFor || 0) + h; if (s.litFor >= T.light.confirmDelay) this.confirm('lit'); }
            else { if (this.light && !s.shutHint) { s.shutHint = true; this.emit('lit-too-shut'); } s.litFor = 0; }
            if (this.adapt >= T.corridor.adaptTime && !this.confirmRoute) this.confirm('dark');
          }
          if (this.confirmRoute) {
            s.after = (s.after || 0) + h;
            if (this.confirmRoute === 'lit') this.silhouette = s.after < T.light.silhouette ? 1 : Math.max(0, 1 - (s.after - T.light.silhouette) / T.light.silhouetteSlide);
            if (s.after >= B.c3After) this.enter('C3');
          }
          break;
        case 'C3':
          if (!s.hushAt && this.L < .2) { s.hushAt = s.t; this.hush(); }
          if (s.hushAt && !s.knocked) {
            const k = s.t - s.hushAt - B.c3Hush;
            B.glassKnocks.forEach((at, i) => { if (k >= at && (s.kn || 0) === i) { s.kn = i + 1; this.impact = 1; this.emit('glass-knock', { index: i }); } });
            if ((s.kn || 0) >= 3 && k >= B.glassKnocks[2] + .6) {
              s.knocked = true; this.emit('not-downstairs');
              // From here something holds the door from outside: it cannot be closed below 0.45.
              this.holder = 'min045'; this.holderFloor = .45;
              this.handNow('C3'); this.pryTo = .45;
            }
          }
          if (s.knocked && !this.hand && this.handStage === 'released') { this.unhush(); this.enter('C4'); }
          break;
        case 'C4':
          if (!s.hushed && s.t >= .5) { s.hushed = true; this.hush(); }
          if (s.t >= B.c4After && !s.eyes) { s.eyes = true; this.eyesNow('C4'); }
          if (s.eyes && this.eyes === 'none') this.enter('C5');
          break;
        case 'C5': {
          const [back, hold, quiet] = T.mimic.intro;
          if (!s.back) { s.back = true; this.unhush(); }
          if (s.t >= back + hold && !s.hushed) { s.hushed = true; this.hush(); }
          if (s.t >= back + hold + quiet && this.mimic === 'none' && !s.arrived) {
            s.arrived = true; this.holder = 'fingers'; this.holderFloor = 0; this.o5 = this.o; this.oRef = Math.min(this.o, this.baitCeil()); this.mimicTo('arrive'); this.emit('fingers');
            this.startProgram(12);
          }
          if (this.mimic === 'out' && this.program && !this.program.stopped) this.stopProgram();
          if (this.mimic === 'out' && this.fingersOut >= 1) { s.outFor = (s.outFor || 0) + h; if (s.outFor >= B.c6aAfter) { this.mimic = 'none'; this.enter('C6a'); } }
          break;
        }
        case 'C6a':
          if (!s.silent) { s.silent = true; this.program = null; this.sources = []; this.L = 0; this.covered = false; }
          if (s.t >= .01 && !s.hushed) { s.hushed = true; this.hush(); }
          if (s.t >= B.c6aHush && !s.creak) { s.creak = true; this.emit('rear-creak'); }
          if (s.t >= B.c6aHush + B.c6aCreak && this.drawer === 'idle') this.drawerNow(1);
          if (this.drawer === 'shut' && !this.wantRear && this.turn === 0) { this.drawer = 'idle'; this.enter('C6b'); }
          break;
        case 'C6b':
          if (s.t >= B.c6bAfter && !this.shoves) { this.hush(); this.shoves = true; this.shoveClock = 0; this.shovePeriod = T.shove.periodSolo; this.shovePhase = 'idle'; s.nextShove = T.shove.first - T.shove.inhale; this.absorbed = 0; this.slipEvents = 0; this.emit('shoves-start'); }
          if (this.shoves) {
            // Done: one shove taken by the wedge alone, then a firm grip for 1 s (or two slips, or the stall breaker).
            if (s.lastSlipAt !== undefined && this.attended() && this.time - Math.max(s.lastSlipAt, this.gripSince) >= B.c6bGrip) s.done = true;
            if (this.slipEvents >= 2 || s.skip) s.done = true;
            if (s.done) { const keep = { nextShove: s.nextShove, shovePush: s.shovePush }; this.enter('C6c'); Object.assign(this.s, keep); this.shovePeriod = T.shove.periodPair; }
          }
          break;
        case 'C6c':
          if (s.t >= B.c6cAfter && this.drawer === 'idle' && !s.visited) { s.visited = true; this.drawerNow(2); }
          if (this.drawer === 'shut' && this.shoves && this.shovePhase === 'idle') { this.shoves = false; this.unhush(); this.emit('shoves-stop'); }
          if (!this.shoves && this.drawer === 'shut') {
            if (this.wedge === 'rest' && this.attended()) { s.regrip = (s.regrip || 0) + h; if (s.regrip >= B.c6cRegrip) { this.prop = false; this.drawer = 'idle'; this.emit('slipper-worn'); this.enter('C7'); } }
            else s.regrip = 0;
          }
          break;
        case 'C7':
          if (!s.prompted) { s.prompted = true; this.emit('close-and-lock'); }
          if (s.pullAt === undefined && s.t >= B.c7Wait) s.pullAt = s.t;
          if (s.pullAt !== undefined) {
            const k = s.t - s.pullAt;
            if (k >= 0 && !s.hushed) { s.hushed = true; this.hush(); }
            B.pullKnocks.forEach((at, i) => { if (k >= B.c7Hush + at && (s.kn || 0) === i) { s.kn = i + 1; this.impact = .8; this.emit('glass-knock', { index: i, slow: true }); } });
            const inhaleAt = B.c7Hush + B.pullKnocks[2] + .4, pullAt = inhaleAt + B.pullInhale;
            if (k >= inhaleAt && !s.inhale) { s.inhale = true; this.emit('pull-inhale'); }
            if (k >= pullAt && !s.pulling) {
              s.pulling = true; s.from = this.o; this.letGo(); this.releaseBolt();
              if (this.b > 0) { this.b = 0; this.rattle('up', false, true); this.b = 0; }
              this.flush = false; this.impact = 1; this.contact = 1; this.emit('pull');
            }
            if (s.pulling) {
              const f = clamp((k - pullAt) / B.pullTime);
              this.o = s.from + (B.pullTo - s.from) * f;
              if (f >= 1) { this.holder = 'unseated012'; this.holderFloor = .012; this.enter('F1'); }
            }
          }
          break;
        case 'F1':
          if (!s.begun) { s.begun = true; this.hush(); this.sources = this.sources.filter(x => x.src === 'mimic'); this.startProgram(B.f1Elevator); }
          if (s.t >= T.eyes.f1.breathAt && !s.eyes) { s.eyes = true; this.eyesNow('F1'); }
          if (s.eyes && this.eyes === 'none') { s.gone = (s.gone || 0) + h; if (s.gone >= B.f2After) this.enter('F2'); }
          break;
        case 'F2':
          if (!s.hand) { s.hand = true; this.ducking = true; if (this.program) this.program.paused = true; this.handNow('F2'); }
          if (s.hand && !this.hand && this.handStage === 'released' && !s.retreated) {
            s.retreated = true; s.retreatAt = s.t; this.holder = 'none'; this.holderFloor = 0; this.ducking = false; this.unhush();
            if (this.program) { this.program.paused = false; this.program.nextElevator = Math.max(this.program.nextElevator, this.program.clock + 9); this.program.nextTraffic = Math.max(this.program.nextTraffic, this.program.clock + 20); }
          }
          if (s.retreated && !s.traffic && s.t - s.retreatAt >= B.f2Traffic) { s.traffic = true; this.spawn('traffic'); }
          if (s.retreated && this.flush && !this.held && this.b <= T.bolt.free) { this.emit('seat'); this.enter('F3'); }
          break;
        case 'F3':
          if (!s.begun) { s.begun = true; this.emit('checklist'); this.startProgram(B.f3Elevator); this.hush(); }
          if (s.t >= B.f3Knocks) {
            const k = (s.t - B.f3Knocks) % B.f3Period, n = Math.floor((s.t - B.f3Knocks) / B.f3Period);
            if (n >= (s.kn || 0)) { s.kn = n + 1; this.emit('soft-knock', { index: n }); }
            this.knockImpact = k < B.f3Impact;
            if (this.knockImpact && this.b > T.bolt.detent + 1e-6 && !this.seatedFlag) { this.b = T.bolt.kickSeat; this.boltHistory = []; this.detent = 'none'; this.emit('bolt-kicked', { by: 'knock' }); }
          }
          if (this.b >= T.bolt.detent - 1e-6 && !this.boltFirst08) {
            this.boltFirst08 = true;
            if (this.light) { this.b = T.bolt.kickSeat; this.boltHistory = []; this.detent = 'none'; this.impact = 1; this.emit('palm-slap'); }
            else this.emit('breath', { visit: 'F3' });
          }
          break;
        case 'END':
          if (!s.begun) { s.begun = true; this.hush(); this.letGo(); this.releaseBolt(); this.gazeDown = false; this.wantRear = false; this.stopProgram(); }
          if (s.t >= B.endRoom && !s.sting) { s.sting = true; this.emit('sting'); }
          if (s.t >= B.endRoom + B.endSting) this.fade = clamp((s.t - B.endRoom - B.endSting) / B.endFade);
          if (this.fade >= 1) { this.state = 'won'; this.emit('win'); }
          break;
      }
    }
    confirm(route) {
      this.confirmRoute = route; this.revealed = true; this.stopProgram(); this.s.after = 0;
      this.emit('confirm', { route });
    }

    // ---- tick ------------------------------------------------------------------------------------
    update(frame) {
      if (!this.active()) { this.reqDoor = 0; this.reqBolt = 0; this.carry = 0; return; }
      // Fixed 1/120 s steps with the remainder carried, so every rule is frame-rate independent.
      this.carry = (this.carry || 0) + clamp(frame, 0, T.maxFrame);
      const n = Math.floor(this.carry / T.step + 1e-9);
      if (n === 0) return; // a very short frame: keep this frame's requests for the next one
      this.carry -= n * T.step;
      const doorShare = this.reqDoor / n, boltShare = this.reqBolt / n;
      for (let i = 0; i < n && this.active(); i++) this.substep(T.step, doorShare, boltShare);
      this.reqDoor = 0; this.reqBolt = 0;
    }
    substep(h, doorShare, boltShare) {
      this.time += h;
      this.resumeGrace = Math.max(0, this.resumeGrace - h);
      this.impact = Math.max(0, this.impact - h * 4.5); this.contact = Math.max(0, this.contact - h * 2);
      this.lit += ((this.light ? 1 : 0) - this.lit) * (1 - Math.exp(-h / .04));
      this.gaze = clamp(this.gaze + (this.gazeDown ? 1 : -1) * h / T.gaze.ease);
      this.turn = clamp(this.turn + (this.wantRear ? 1 : -1) * h / T.turn.pan);
      const amb = this.ambienceTarget === 0 ? h / T.beats.hush : h / T.beats.release;
      this.ambience += clamp(this.ambienceTarget - this.ambience, -amb, amb);
      this.updateMasks(h);
      const moved = this.stepDoor(h, doorShare);
      this.playerPos += moved;
      this.openHistory.push(this.o); if (this.openHistory.length > Math.round(1.2 / T.step)) this.openHistory.shift();
      this.posHistory.push(this.playerPos); if (this.posHistory.length > Math.round(1.2 / T.step)) this.posHistory.shift();
      if (!this.active()) return;
      this.stepBolt(h, boltShare); if (!this.active()) return;
      this.updateAttention(h); if (!this.active()) return;
      if (this.hand) { this.updateHand(h); if (!this.active()) return; }
      this.updateEyes(h); if (!this.active()) return;
      this.updateMimic(h, moved); if (!this.active()) return;
      this.updateWedge(h); this.updateShoves(h); if (!this.active()) return;
      this.updateDrawer(h); if (!this.active()) return;
      this.direct(h);
      this.scrape = this.speed;
    }

    // ---- read-only views ---------------------------------------------------------------------------
    soundState() {
      const live = this.state === 'playing' || this.state === 'won', src = {};
      for (const s of this.sources) {
        const base = T.masks.base[s.src], e = envelope(s) * this.duck;
        src[s.src] = { file: { elevator: 'mask-elevator-loop', traffic: 'mask-traffic-pass', mimic: 'mimic-response' }[s.src], loop: s.src === 'elevator', offset: s.t, gain: live ? base * e : 0, e, smooth: .01 };
      }
      const stiff = this.band() === 'stiff', speed = this.speed;
      src.scrape = { file: 'door-scrape', loop: true, loopStart: .12, loopEnd: 1.18, gain: live && speed > .004 ? (stiff ? .65 * Math.min(1, speed / T.door.capStiff) : .15 * Math.min(1, speed / .2)) : 0, rate: stiff ? .9 : 1.04, smooth: .05 };
      src.lamp = { file: 'lamp-hum-loop', loop: true, gain: live ? .2 * this.lit : 0, smooth: .08 };
      src.drawer = { file: 'drawer-creak-loop', loop: true, gain: live && this.drawer === 'open' && !this.watching() ? .65 * (.15 + .85 * this.d) : 0, smooth: .2 };
      src.bolt = { file: 'latch-slide', loop: true, loopStart: .08, loopEnd: .78, gain: live && this.boltHeld ? .65 * Math.min(1, this.boltSpeed / 1) : 0, rate: .9 + this.b * .25, smooth: .04 };
      return {
        streams: src,
        beds: { tv: live ? this.ambience * (this.beat === 'P0' || this.beat === 'C1' || this.beat === 'C2' ? 1 : .6) : 0, room: live ? .4 + .6 * this.ambience : 0,
          strain: live && this.hand ? this.strain : 0, tension: live ? (this.hand || this.eyes !== 'none' || this.mimic !== 'none' || this.drawer === 'open' || this.shoves ? 1 : 0) : 0 }
      };
    }
    snapshot() {
      const keys = ['state', 'beat', 'reason', 'paused', 'time', 'attempt', 'hint', 'o', 'held', 'flush', 'holder', 'speed', 'A', 'leak', 'L', 'covered', 'preWarn',
        'light', 'lit', 'gazeDown', 'gaze', 'wantRear', 'turn', 'corridor', 'corridorShade', 'revealed', 'adapt', 'confirmRoute', 'silhouette', 'ambience',
        'hand', 'handStage', 'gripStage', 'force', 'forceTarget', 'strain', 'defended', 'resumeGrace', 'contact', 'impact',
        'eyes', 'eyesFade', 'E', 'chord', 'mimic', 'mimicTime', 'P', 'oRef', 'o5', 'bait', 'copy', 'fingersOut', 'loiter',
        'wedge', 'slip', 'slipLevel', 'slipEvents', 'prop', 'shoves', 'shovePhase', 'drawer', 'd', 'visit', 'watchTime',
        'b', 'boltHeld', 'detent', 'boltSpeed', 'seatedFlag', 'knockImpact', 'fade'];
      const out = Object.fromEntries(keys.map(k => [k, this[k]]));
      out.duck = this.duck; out.failWhy = this.failWhy; out.openCap = this.openCap(); out.mimicLine = this.mimic !== 'none' ? this.mimicLine() : null;
      out.cp = this.cp ? this.cp.id : null; out.band = this.band(); out.lastSource = this.lastSource; out.beatTime = this.s.t || 0;
      out.canTurn = this.canTurn(); out.canSwitch = this.canSwitch(); out.canWedge = this.canWedge(); out.boltMovable = this.boltMovable();
      out.sources = this.sources.map(s => ({ src: s.src, t: s.t, e: envelope(s) * this.duck }));
      return Object.freeze(out);
    }
  }
  Night.BEATS = BEATS; Night.CHECKPOINT = CHECKPOINT; Night.envelope = envelope; Night.contourAt = contourAt; Night.T = T;
  root.DoorNight = Night;
  if (typeof module !== 'undefined') module.exports = Night;
})(typeof window === 'undefined' ? globalThis : window);
