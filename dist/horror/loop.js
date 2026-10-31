// A room is learned by its door. No audio level, narration, or hidden random condition.
(function (root) {
  'use strict';
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ROOMS = Object.freeze([
    Object.freeze({ id: 'ordinary', door: 'plain', direction: -1 }),
    Object.freeze({ id: 'mirrored', door: 'plain', direction: 1 }),
    Object.freeze({ id: 'keylock', door: 'plain', direction: -1, lock: true }),
    Object.freeze({ id: 'shadow', door: 'frost', direction: -1, watch: true }),
    Object.freeze({ id: 'combination', door: 'plain', direction: -1, code: true }),
    Object.freeze({ id: 'peephole', door: 'red', direction: -1, spy: true, listen: true }),
    Object.freeze({ id: 'hinge', door: 'hinge', direction: -1, hinge: true }),
    Object.freeze({ id: 'lockpick', door: 'plain', direction: -1, pick: true }),
    Object.freeze({ id: 'ambush', door: 'frost', direction: -1, ambush: true }),
    Object.freeze({ id: 'barricade', door: 'broken', direction: -1, breakable: true })
  ]);
  const CODE = Object.freeze([3, 1, 7]);
  const NOTE_ROOMS = Object.freeze([2, 6, 9]);
  const RULES = Object.freeze({ slow: .27, openAt: .94, transit: 2.1, cycle: 8.2, occupied: 3.1, inspect: .65, press: .9, recover: .3,
    returnWarning: .8, stepPeriod: .7, tugWindup: 1.1, tugPull: 1.55, tugEase: 1.35, tugRetreat: .65,
    tugPullRate: .27, tugMaxClose: .55, tugStrainAt: .72, tugResist: .65, tugHold: .4, tugClosed: .04, tugFailOpen: .92,
    pickSweetspot: -.28, pickTolerance: .07, strikeCooldown: .4, strikeDamage: .34 });
  class Loop {
    constructor() { this.events = []; this.failures = 0; this.start(); }
    start() { this.room = 0; this.total = 0; this.failures = 0; this.inventory = new Set(); this.notes = new Set(); this.roomData = {}; this.enter(); }
    get rule() { return ROOMS[this.room]; }
    enter() {
      this.state = 'playing'; this.time = 0; this.age = 0; this.transition = 0; this.paused = false;
      this.open = this.rule.hands ? .2 : 0; this.held = false; this.peeking = false;
      this.danger = 0; this.speed = 0; this.impact = 0; this.inspected = false; this.inspectTime = 0;
      this.press = 0; this.released = !this.rule.hands; this.handFade = this.rule.hands ? 1 : 0;
      this.motion = 0; this.moved = false; this.idle = 0; this.blocked = ''; this.lastCue = -10;
      this.patrolClock = 0; this.lastStep = -1; this.returnWarned = false;
      this.tug = false; this.tugClock = 0; this.tugPhase = 'none'; this.tension = 0; this.resistTime = 0;
      this.tugHold = 0; this.tugGrace = 0; this.reason = '';
      const saved = this.roomData[this.room] || {};
      this.unlocked = !(this.rule.lock || this.rule.hinge || this.rule.code || this.rule.pick || this.rule.breakable) || !!saved.unlocked;
      this.pinProgress = saved.pinProgress || 0; this.ambushTriggered = false; this.ambushDefeated = false; this.effort = 0;
      this.dialValues = saved.dialValues ? [...saved.dialValues] : [0, 0, 0];
      this.pickAngle = 0; this.barrel = this.rule.pick && this.unlocked ? 1 : 0; this.pickStress = 0; this.torque = false;
      this.damage = saved.damage || 0; this.strikeCooldown = 0; this.strikeAge = 99;
      this.events.length = 0; this.emit('enter');
    }
    emit(type, detail = {}) { this.events.push({ type, room: this.room, ...detail }); }
    active() { return this.state === 'playing' && !this.paused; }
    collect(item) {
      if (!this.active() || this.tug || (item !== 'note' && this.inventory.has(item))) return false;
      const available = item === 'key' ? this.rule.lock && !this.unlocked : item === 'note' ? NOTE_ROOMS.includes(this.room) && !this.notes.has(this.room) : item === 'pin' ? this.rule.hinge && this.pinProgress >= .95 : item === 'code' ? this.rule.code : item === 'pick' ? this.rule.pick : item === 'club' ? this.rule.breakable : false;
      if (!available) return false;
      if (item === 'note') this.notes.add(this.room);
      this.inventory.add(item); this.emit('pickup', { item }); return true;
    }
    useLock() {
      if (!this.active() || !this.rule.lock || this.unlocked || this.tug) return false;
      if (!this.inventory.has('key')) { this.warn('locked', 0); return false; }
      this.inventory.delete('key'); this.unlocked = true; this.roomData[this.room] = { unlocked: true };
      this.emit('unlock'); return true;
    }
    dragHardware(delta) {
      if (!this.active() || !this.rule.hinge || this.unlocked || this.tug || !Number.isFinite(delta)) return false;
      this.pinProgress = clamp(this.pinProgress + clamp(delta, -.25, .25));
      this.roomData[this.room] = { pinProgress: this.pinProgress, unlocked: false };
      if (this.pinProgress >= .95) {
        this.pinProgress = 1; this.unlocked = true; this.roomData[this.room] = { pinProgress: 1, unlocked: true };
        this.collect('pin'); this.emit('pin-freed');
      }
      return true;
    }
    turnDial(index, delta) {
      if (!this.active() || !this.rule.code || this.unlocked || !Number.isInteger(index) || index < 0 || index >= CODE.length || !Number.isFinite(delta)) return false;
      this.dialValues[index] = ((this.dialValues[index] + Math.trunc(delta)) % 10 + 10) % 10;
      this.roomData[this.room] = { ...this.roomData[this.room], dialValues: [...this.dialValues] };
      this.emit('dial'); return true;
    }
    confirmCode() {
      if (!this.active() || !this.rule.code || this.unlocked) return false;
      if (!this.inventory.has('code') || !CODE.every((v, i) => v === this.dialValues[i])) { this.warn('locked', 0); return false; }
      this.unlocked = true; this.roomData[this.room] = { ...this.roomData[this.room], unlocked: true }; this.emit('code-unlocked'); return true;
    }
    setPickAngle(value) {
      if (!this.active() || !this.rule.pick || this.unlocked || !this.inventory.has('pick') || !Number.isFinite(value)) return false;
      this.pickAngle = clamp(value, -1, 1); return true;
    }
    setTorque(value) {
      if (!this.active() || !this.rule.pick || this.unlocked || !this.inventory.has('pick')) return false;
      this.torque = !!value; return true;
    }
    strike() {
      if (!this.active() || !this.rule.breakable || this.unlocked || !this.inventory.has('club') || this.strikeCooldown > 1e-6) return false;
      this.damage = clamp(this.damage + RULES.strikeDamage); this.strikeCooldown = RULES.strikeCooldown; this.strikeAge = 0; this.impact = .8;
      this.roomData[this.room] = { ...this.roomData[this.room], damage: this.damage, unlocked: this.damage >= 1 }; this.emit('strike', { damage: this.damage });
      if (this.damage >= 1) { this.unlocked = true; this.emit('door-broken'); }
      return true;
    }
    occupied() {
      if (!(this.rule.watch || this.rule.spy || this.rule.listen)) return false;
      return this.patrolClock % RULES.cycle < RULES.occupied;
    }
    preReturn() { return !!(this.rule.watch || this.rule.spy || this.rule.listen) && !this.tug && !this.occupied() && this.patrolClock % RULES.cycle >= RULES.cycle - RULES.returnWarning; }
    noise() {
      if (!this.rule.listen || this.tug || !this.occupied()) return 0;
      return .18 + .82 * Math.max(0, Math.cos(this.patrolClock * Math.PI * 2 / RULES.stepPeriod)) ** 8;
    }
    grip() { if (!this.active() || this.peeking) return false; this.held = true; return true; }
    release() { this.held = false; this.motion = 0; }
    drag(delta) {
      if (!this.active() || !this.held || this.peeking || !Number.isFinite(delta)) return;
      this.motion += clamp(delta, -.4, .4);
    }
    peek(value) {
      if (!this.rule.spy || !this.active() || this.tug) return false;
      this.release(); this.peeking = !!value; return true;
    }
    setPaused(value) {
      if (this.state !== 'playing') return;
      const resuming = this.paused && !value;
      this.paused = !!value; this.release(); this.peeking = false; this.torque = false;
      if (resuming && this.tug) this.tugGrace = .6;
    }
    retry() { if (this.state === 'lost' && this.age >= .8) this.enter(); else if (this.state === 'won') this.start(); }
    warn(kind, amount) {
      this.blocked = kind; this.impact = Math.max(this.impact, .5); this.danger = clamp(this.danger + amount);
      if (this.time - this.lastCue > .45) { this.lastCue = this.time; this.emit(kind); }
    }
    caught() {
      this.tug = true; this.tugClock = 0; this.tugPhase = 'windup'; this.tension = .24;
      this.resistTime = 0; this.tugHold = 0; this.tugGrace = 0; this.peeking = false;
      this.effort = 0;
      this.open = clamp(Math.max(.22, this.open), .22, .38); this.impact = .7;
      this.emit('caught');
    }
    lose(reason) {
      this.reason = reason; this.state = 'lost'; this.age = 0; this.release(); this.peeking = false; this.emit('lose', { reason });
    }
    updateTug(dt, move) {
      if (this.tugGrace > 0) { this.tugGrace = Math.max(0, this.tugGrace - dt); return; }
      this.tugClock += dt;
      if (this.tugPhase === 'retreat') {
        this.open = Math.max(0, this.open - dt * .15);
        this.tension = Math.max(0, this.tension - dt * 2);
        if (this.tugClock >= RULES.tugRetreat) {
          this.tug = false; this.tugPhase = 'none'; this.open = 0; this.danger = 0; this.tension = 0;
          this.effort = 0; if (this.rule.ambush) this.ambushDefeated = true; this.release();
          // A rescued mistake earns a full, readable clear window instead of an immediate recatch.
          this.patrolClock = RULES.occupied + .1; this.lastStep = -1; this.returnWarned = false;
          this.inspected = this.rule.spy ? false : this.inspected; this.inspectTime = 0; this.emit('escaped');
        }
        return;
      }
      const cycle = (this.tugClock - RULES.tugWindup) % (RULES.tugPull + RULES.tugEase);
      const phase = this.tugClock < RULES.tugWindup ? 'windup' : cycle < RULES.tugPull ? 'pull' : 'ease';
      if (phase !== this.tugPhase) { this.tugPhase = phase; this.impact = .45; this.emit('tug-' + phase); }
      const closing = this.held ? Math.max(0, -move / dt) : 0;
      this.effort += (clamp(closing / .6) - this.effort) * Math.min(1, dt / .1);
      const effort = clamp(move, -RULES.tugMaxClose * dt, .65 * dt);
      const ghost = phase === 'pull' ? RULES.tugPullRate : .025;
      const floor = phase === 'windup' ? .15 : phase === 'pull' ? .08 : 0;
      this.open = clamp(this.open + effort + ghost * dt, floor, 1);
      if (phase !== 'windup') {
        const excess = Math.max(0, closing - RULES.tugStrainAt);
        const target = this.tugTarget(), miss = Math.max(target[0] - this.effort, this.effort - target[1], 0);
        this.tension = clamp(this.tension + dt * (Math.min(1.5, excess * 1.8) + (miss > .02 ? .08 + miss * .4 : -.12)));
        if (phase === 'pull') {
          const resisting = this.held && this.effort >= target[0] && this.effort <= target[1] && closing <= RULES.tugStrainAt;
          this.resistTime = clamp(this.resistTime + dt * (resisting ? 1 : -.35), 0, RULES.tugResist);
        }
        if (phase === 'ease') {
          const sealed = this.held && this.open <= RULES.tugClosed && this.resistTime >= RULES.tugResist - 1e-6;
          this.tugHold = clamp(this.tugHold + dt * (sealed ? 1 : -.5), 0, RULES.tugHold);
          if (this.tugHold >= RULES.tugHold - 1e-6) {
            this.tugPhase = 'retreat'; this.tugClock = 0; this.tension *= .5; this.emit('banish');
          }
        }
      }
      this.danger = clamp(Math.max(this.tension, (this.open - .4) / .6));
      if (phase !== 'windup' && (this.open >= RULES.tugFailOpen || this.tension >= 1)) this.lose('tug');
    }
    tugTarget() {
      const wobble = Math.sin(this.tugClock * 1.7) * .025;
      return this.tugPhase === 'pull' ? [.42 + wobble, .88 + wobble] : this.tugPhase === 'ease' ? [.18 - wobble, .78 - wobble] : [0, 1];
    }
    update(rawDt) {
      const dt = clamp(Number.isFinite(rawDt) ? rawDt : 0, 0, .1);
      if (!dt || this.paused) { this.motion = 0; return; }
      this.total += dt; this.age += dt;
      if (this.state === 'crossing') {
        this.transition = clamp(this.transition + dt / RULES.transit);
        if (this.transition >= 1) {
          if (this.room === ROOMS.length - 1) { this.state = 'won'; this.age = 0; this.emit('win'); }
          else { this.room++; this.enter(); }
        }
        return;
      }
      if (this.state !== 'playing') return;
      this.time += dt; this.idle += dt; this.impact = Math.max(0, this.impact - dt * 2.6);
      this.strikeCooldown = Math.max(0, this.strikeCooldown - dt); this.strikeAge = Math.min(99, this.strikeAge + dt);
      if (this.rule.pick && !this.unlocked) {
        const error = Math.abs(this.pickAngle - RULES.pickSweetspot), correct = error <= RULES.pickTolerance;
        const stop = correct ? 1 : .14 + .7 * clamp(1 - error / .85);
        if (this.torque) {
          this.barrel = Math.min(stop, this.barrel + dt * .6);
          this.pickStress = correct ? 0 : clamp((this.barrel - stop + .08) / .08);
          if (!correct && this.barrel >= stop - .001) this.warn('pick-stop', 0);
          if (correct && this.barrel >= .98) { this.barrel = 1; this.unlocked = true; this.torque = false; this.roomData[this.room] = { unlocked: true }; this.emit('pick-unlocked'); }
        } else { this.barrel = Math.max(0, this.barrel - dt * .9); this.pickStress = Math.max(0, this.pickStress - dt * 3); }
      }
      this.blocked = '';
      if (!this.tug) {
        const before = this.occupied(); this.patrolClock += dt;
        const now = this.occupied(), step = Math.floor(this.patrolClock / RULES.stepPeriod);
        if (this.rule.listen && now && step !== this.lastStep) { this.lastStep = step; this.emit('step'); }
        if (before && !now) this.emit('silence');
        if (!now && this.preReturn() && !this.returnWarned) { this.returnWarned = true; this.emit('return-warning'); }
        if (now) this.returnWarned = false;
      }
      const occupied = this.occupied();
      if (this.peeking) {
        this.inspectTime = occupied ? 0 : this.inspectTime + dt;
        if (!this.inspected && this.inspectTime >= RULES.inspect) { this.inspected = true; this.emit('clear'); }
      }
      let move = this.held && !this.peeking ? clamp(this.motion, -.4, .4) : 0;
      this.motion = 0;
      // The visible handle follows pointer distance directly. Speed is sampled from that same move.
      const instantaneous = Math.abs(move) / dt;
      this.speed += (instantaneous - this.speed) * Math.min(1, dt / .09);
      if (!this.tug && this.rule.ambush && !this.ambushTriggered && move > 0 && this.open + move >= .35) {
        this.ambushTriggered = true; this.open = .35; this.caught();
      } else if (!this.tug && move > .00001 && occupied) this.caught();
      if (this.tug) { this.updateTug(dt, move); return; }
      if (Math.abs(move) > .00001) {
        this.moved = true; this.idle = 0;
        if (move > 0 && !this.unlocked) { this.warn(this.rule.hinge ? 'hinge-jam' : 'locked', 0); move = 0; }
        if (move > 0 && this.rule.fragile && this.speed > RULES.slow) this.warn('glass', (this.speed - RULES.slow) * Math.abs(move) * 1.7);
        if (move > 0 && this.rule.hands && !this.released) {
          this.warn('fingers', move * 1.8); move = Math.min(move, Math.max(0, .24 - this.open));
        }
        if (move > 0 && this.rule.spy && !this.inspected) {
          this.warn('unseen', 0); move = Math.min(move, Math.max(0, .09 - this.open));
        }
        this.open = clamp(this.open + move);
      }
      if (this.rule.hands && !this.released) {
        if (this.open <= .025 && this.held) this.press += dt;
        else this.press = Math.max(0, this.press - dt * .8);
        if (this.press >= RULES.press) { this.released = true; this.emit('withdraw'); }
      }
      if (this.released) this.handFade = Math.max(0, this.handFade - dt / .9);
      if (!this.blocked) this.danger = Math.max(0, this.danger - dt * RULES.recover);
      if (this.danger >= 1) { this.lose(this.rule.fragile ? 'glass' : 'fingers'); return; }
      if (this.open >= RULES.openAt && this.unlocked && (!this.rule.hands || this.released) && (!this.rule.spy || this.inspected) && (!this.rule.ambush || this.ambushDefeated) && !occupied) {
        this.state = 'crossing'; this.transition = 0; this.release(); this.peeking = false; this.emit('cross');
      }
    }
    snapshot() {
      const beat = (this.tugClock - RULES.tugWindup) % (RULES.tugPull + RULES.tugEase);
      const phaseProgress = this.tugPhase === 'windup' ? this.tugClock / RULES.tugWindup : this.tugPhase === 'pull' ? beat / RULES.tugPull : this.tugPhase === 'ease' ? (beat - RULES.tugPull) / RULES.tugEase : this.tugPhase === 'retreat' ? this.tugClock / RULES.tugRetreat : 0;
      const target = this.tugTarget();
      return Object.freeze({ room: this.room, id: this.rule.id, state: this.state, time: this.time, age: this.age, total: this.total,
        open: this.open, held: this.held, danger: this.danger, speed: this.speed, impact: this.impact, peeking: this.peeking,
        inspected: this.inspected, inspectTime: this.inspectTime, occupied: this.occupied(), press: this.press,
        released: this.released, handFade: this.handFade, idle: this.idle, moved: this.moved, blocked: this.blocked,
        transition: this.transition, paused: this.paused, reason: this.reason, patrolPhase: this.patrolClock % RULES.cycle,
        noise: this.noise(), preReturn: this.preReturn(), tug: this.tug, tugPhase: this.tugPhase,
        tension: this.tension, resist: this.resistTime / RULES.tugResist, tugPhaseProgress: clamp(phaseProgress), tugGrace: this.tugGrace,
        tugProgress: this.tugPhase === 'retreat' ? clamp(this.tugClock / RULES.tugRetreat) : this.tugHold / RULES.tugHold,
        effort: this.effort, targetMin: target[0], targetMax: target[1], unlocked: this.unlocked, pinProgress: this.pinProgress,
        inventory: Object.freeze([...this.inventory]), keyAvailable: !!(this.rule.lock && !this.unlocked && !this.inventory.has('key')),
        noteAvailable: NOTE_ROOMS.includes(this.room) && !this.notes.has(this.room), notePages: Object.freeze([...this.notes]), pinAvailable: !!(this.rule.hinge && !this.unlocked),
        codeAvailable: !!(this.rule.code && !this.inventory.has('code')), pickAvailable: !!(this.rule.pick && !this.inventory.has('pick')), clubAvailable: !!(this.rule.breakable && !this.inventory.has('club')),
        dialValues: Object.freeze([...this.dialValues]), codeDigits: CODE, pickAngle: this.pickAngle, barrel: this.barrel, pickStress: this.pickStress, torque: this.torque,
        damage: this.damage, strikeCooldown: this.strikeCooldown, strikeAge: this.strikeAge,
        ambushTriggered: this.ambushTriggered, ambushDefeated: this.ambushDefeated });
    }
  }
  Loop.ROOMS = ROOMS; Loop.RULES = RULES;
  root.DoorLoop = Loop;
  if (typeof module !== 'undefined') module.exports = Loop;
})(typeof window === 'undefined' ? globalThis : window);
