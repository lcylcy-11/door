// Focus cut: a slow door, one force-resistance hand, and a blind close. Deterministic,
// DOM-free model. The view feeds intents (grip, drag, gaze, turn, switch, slipper, bolt) and
// drains events; tests drive the same object. No Math.random, Date or performance here.
(function (root) {
  'use strict';
  const T = root.DoorTuning || require('./tuning.js');
  const CONTOURS = root.DoorContours || require('./contours.js');
  const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n));
  const BEATS = ['C1', 'C2', 'C3', 'C4', 'F3', 'END'];
  const CHECKPOINT = { C1:'C1', C2:'C1', C3:'C3', C4:'C4', F3:'F3', END:'F3' };
  const CHECKPOINT_BEAT = { C1:'C1', C3:'C3', C4:'C4', F3:'F3' };
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
        state: 'ready', beat: 'C1', paused: false, time: 0, reason: '', events: [], serial: 0, s: {}, cp: null, hint: 0,
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
        wedge: 'rest', wedgeTime: 0, slip: 0, slipLevel: 0, slipEvents: 0, prop: false, shoves: false, shoveClock: 0, shovePeriod: T.shove.periodSolo,
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
    start(checkpoint = 'C1', fresh = false) {
      if (fresh) this.failCounts = {};
      const beat = CHECKPOINT_BEAT[checkpoint] || 'C1';
      const keep = this.cp && checkpoint !== 'C1' && this.cp.id === checkpoint ? this.cp : null;
      this.attempt++; this.reset(); this.state = 'playing';
      this.hint = (this.failCounts[beat] || 0) >= 2 ? 2 : (this.failCounts[beat] || 0) >= 1 ? 1 : 0;
      this.canonical(beat);
      if (keep) { this.A = keep.A; this.light = keep.light; this.lit = keep.light ? 1 : 0; }
      this.emit('start', { checkpoint });
      this.enter(beat);
    }
    retry() { this.start(this.cp ? this.cp.id : 'C1'); }
    canonical(beat) {
      this.b=0; this.prop=false; this.flush=beat==='C1'||beat==='F3';
      this.o={C1:0,C2:.46,C3:.5,C4:.5,F3:0}[beat]||0;
      if (BEATS.indexOf(beat)>=BEATS.indexOf('C3')) { this.corridor='dead'; this.corridorShade=T.corridor.adapted; this.revealed=true; this.confirmRoute='dark'; }
      if (beat==='C3') { this.holder='hand'; this.holderFloor=.45; }
      this.ambience=beat==='C1'?1:.25; this.ambienceTarget=this.ambience;
    }
    enter(beat) {
      const from = this.beat;
      this.beat = beat; this.s = { t: 0 };
      const cp = CHECKPOINT[beat];
      if (beat === CHECKPOINT_BEAT[cp] || (beat === 'C1')) {
        if (cp !== 'C1') this.A = Math.min(this.A, T.attention.checkpointCap);
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
    inputLocked() { return !this.active() || this.beat === 'END'; }
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
      const value = !!down && this.active() && this.frontReady() && this.beat === 'C4';
      if (value !== this.gazeDown) { this.gazeDown = value; this.emit(value ? 'gaze-down' : 'gaze-up'); }
    }
    // The cut removes extra tools and camera chores from the playable surface.
    turnUnlocked(){return false;} switchUnlocked(){return false;}
    canTurn(){return false;} canSwitch(){return false;} canWedge(){return false;}
    setTurn(){return false;} toggleLight(){return false;} toggleWedge(){return false;}
    watching(){return false;}
    boltMovable(){return this.beat==='F3'&&this.flush&&!this.held&&!this.hand;}
    grabBolt(){
      if(this.inputLocked()||!this.boltMovable()||this.seatedFlag)return false;
      this.b=1; this.seatedFlag=true; this.emit('latch-click'); this.enter('END'); return true;
    }
    dragBolt(){}
    releaseBolt(){this.boltHeld=false;this.reqBolt=0;}

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
      else if (this.time - this.lastGain >= T.focus.recoveryAfter) this.A = Math.max(0, this.A - T.focus.recovery * h);
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
    openCap(){return T.door.playerMax;}
    cap(){return this.band()==='stiff'?T.door.capStiff:this.beat==='C1'||this.beat==='C2'?T.focus.openSpeed:T.door.capQuiet;}
    doorMovable(){return this.held&&!this.gripping()&&this.b<=T.bolt.free&&this.beat!=='F3'&&this.beat!=='END';}
    stepDoor(h, share) {
      let moved = 0;
      if (this.doorMovable() && share !== 0) {
        let d = clamp(share, -this.cap() * h, this.cap() * h);
        if (d > 0 && this.flush) {
          this.unflushDrag += d;
          if (this.unflushDrag <= T.door.unflushDrag) d = 0; else { this.flush = false; this.emit('unflush'); }
        }
        if (d < 0 && this.time < this.slamLock) d = 0;
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
            const speed=Math.abs(moved)/h, rush=clamp((speed-T.focus.quietSpeed)/(T.door.capStiff-T.focus.quietSpeed));
            this.noise(T.focus.rushCost * cost * rush, 'scrape', true);
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
      if (this.o < T.eyes.irisFrom && this.eyesFade > 0) { this.eyes='withdraw'; this.emit('eyes-withdraw'); }
    }

    // ---- director ----------------------------------------------------------------------------
    hush() { if (this.ambienceTarget !== 0) { this.ambienceTarget = 0; this.emit('hush'); } }
    unhush() { if (this.ambienceTarget === 0) { this.ambienceTarget = T.beats.ambienceAfter; this.emit('unhush'); } }
    direct(h) {
      const s=this.s; s.t+=h;
      switch(this.beat){
        case 'C1':
          if(!this.program&&(this.o>=.08||s.t>=3))this.startProgram(0);
          if(!s.entered&&this.o>=T.door.stiff[0]){s.entered=true;this.emit('stiff-enter');}
          if(this.o>=.46)this.enter('C2');
          break;
        case 'C2':
          if(!s.started){s.started=true;this.stopProgram();this.corridor='flicker';this.emit('tube-flicker');}
          this.corridorShade=s.t<1.1?(Math.floor(s.t*5)%2?.55:.12):T.corridor.adapted;
          if(s.t>=1.1&&!s.dead){s.dead=true;this.corridor='dead';this.revealed=true;this.confirmRoute='dark';this.emit('tube-dead');this.hush();}
          if(s.t>=T.focus.revealAfter)this.enter('C3');
          break;
        case 'C3':
          if(!s.hush){s.hush=true;this.hush();this.holder='hand';this.holderFloor=.45;}
          T.beats.glassKnocks.forEach((at,i)=>{if(s.t>=at+.25&&(s.kn||0)===i){s.kn=i+1;this.impact=.7;this.emit('glass-knock',{index:i});}});
          if(s.t>=1.8&&!s.hand){s.hand=true;this.emit('not-downstairs');this.handNow('C3');this.pryTo=.45;}
          if(s.hand&&!this.hand&&this.handStage==='released'){
            this.holder='none';this.holderFloor=0;this.sources=[];this.program=null;this.covered=false;this.L=0;this.enter('C4');
          }
          break;
        case 'C4':
          if(!s.eyes){s.eyes=true;this.hush();this.eyesNow('F1');this.startProgram(.2);}
          if(this.flush&&!this.held){this.eyes='none';this.eyesFade=0;this.E=0;this.gazeDown=false;this.stopProgram();this.emit('seat');this.enter('F3');}
          break;
        case 'F3':
          if(!s.prompted){s.prompted=true;this.emit('checklist');}
          break;
        case 'END':
          if(!s.begun){s.begun=true;this.hush();this.letGo();this.releaseBolt();this.gazeDown=false;this.stopProgram();}
          if(s.t>=.8&&!s.sting){s.sting=true;this.emit('end-breath');}
          if(s.t>=1.9)this.fade=clamp((s.t-1.9)/.6);
          if(this.fade>=1){this.state='won';this.emit('win');}
          break;
      }
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
      this.updateAttention(h); if (!this.active()) return;
      if (this.hand) { this.updateHand(h); if (!this.active()) return; }
      this.updateEyes(h); if (!this.active()) return;
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
      out.duck = this.duck; out.failWhy = this.failWhy; out.openCap = this.openCap(); out.mimicLine = null;
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
