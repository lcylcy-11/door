(function (root) {
  'use strict';
  const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n));
  // All timings are seconds, and opening is a fraction of door travel.
  const RULES = Object.freeze({ quiet: 2.7, reactionGrace: .7, knockLead: .85,
    knockTravel: .2, handTime: 20, approach: 1.35, cycle: 3.4, brace: .75,
    push: 1.1, strongMin: .74, softMin: .16, softMax: .48,
    noiseLimit: .95, closed: .045 });
  class DoorNight {
    constructor() { this.reset(); }
    reset() {
      Object.assign(this, { state: 'ready', phase: 'learn', opening: 0, time: 0, phaseTime: 0,
        held: false, paused: false, lastMotion: -10, quiet: 0, violation: 0,
        knock: false, knockAge: 0, hand: false, handAge: 0, handsStopped: 0,
        knocksPassed: 0, reason: '', events: [], serial: 0, peakMotion: 0,
        force: 0, forceTarget: 0, gripNoise: 0, handStage: 'none', gripStage: 'none',
        gripTime: 0, pushGood: 0, defended: 0, easeGood: 0,
        knockHits: 0, impact: 0, contact: 0, resumeGrace: 0, retreatTime: 0, noiseWarned: false });
    }
    emit(type, detail = {}) { this.events.push({ type, id: ++this.serial, time: this.time, ...detail }); }
    start() { this.reset(); this.state = 'playing'; this.emit('start'); }
    active() { return this.state === 'playing' && !this.paused; }
    begin() { if (!this.active()) return false; this.held = true; return true; }
    release() { this.held = false; this.force = 0; this.forceTarget = 0; }
    setPaused(value) {
      if (this.state !== 'playing') return;
      const resuming = this.paused && !value;
      this.paused = value; this.release();
      if (resuming && this.hand) this.resumeGrace = .8;
    }
    enter(phase) { this.phase = phase; this.phaseTime = 0; }
    knockNow(phase) {
      this.knock = true; this.knockAge = 0; this.quiet = 0; this.violation = 0;
      this.knockHits = 0; this.enter(phase); this.emit('hush');
    }
    handNow() {
      this.hand = true; this.handAge = 0; this.handStage = 'approach';
      this.gripStage = 'none'; this.force = 0; this.forceTarget = 0;
      this.gripNoise = 0; this.gripTime = 0; this.defended = 0; this.pushGood = 0;
      this.easeGood = 0; this.retreatTime = 0; this.noiseWarned = false; this.emit('scratch');
    }
    setForce(value) { if (this.active() && this.hand && this.held) this.forceTarget = clamp(value); }
    drag(amount) {
      if (!this.active() || !this.held) return;
      if (this.hand && this.handStage !== 'released') this.setForce(this.forceTarget + amount * 2.8);
      else this.moveTo(this.opening - amount);
    }
    moveTo(value) {
      if (!this.active() || !this.held) return;
      // A hand is a simulated opponent: direct pointer positions cannot teleport the door through it.
      if (this.hand && this.handStage !== 'released') return;
      const next = clamp(value), distance = Math.abs(next - this.opening);
      if (distance < .001) return;
      this.peakMotion = Math.max(this.peakMotion, distance);
      this.lastMotion = this.time; this.quiet = 0;
      // A necessary defensive slam never counts against the knock warning.
      if (this.knock && !this.hand && this.knockAge > RULES.knockLead + RULES.reactionGrace) {
        this.violation += distance;
        if (this.violation > RULES.knockTravel) { this.fail('knock'); return; }
      }
      this.opening = next;
      if (this.hand && this.handStage === 'released' && this.opening <= RULES.closed) {
        this.hand = false; this.handsStopped++; this.emit('slam');
        this.handStage = 'none'; this.gripStage = 'none'; this.force = 0; this.forceTarget = 0; this.gripNoise = 0;
        this.lastMotion = this.time; this.quiet = 0; this.violation = 0;
        // Fresh reaction time after the hand, including a fresh knock sound.
        if (this.knock) { this.knockAge = 0; this.knockHits = 0; this.emit('hush'); this.enter('settle'); }
        else this.enter('recover');
      }
    }
    fail(reason) { this.state = 'lost'; this.reason = reason; this.release(); this.impact = 1; this.emit('lose'); }
    updateHand(dt) {
      if (this.resumeGrace > 0) { this.resumeGrace = Math.max(0, this.resumeGrace - dt); return; }
      this.handAge += dt;
      this.force += ((this.held ? this.forceTarget : 0) - this.force) * (1 - Math.exp(-14 * dt));
      if (this.handStage === 'released') return;
      if (this.handStage === 'retreat') {
        this.retreatTime += dt;
        if (this.retreatTime > .7) { this.handStage = 'released'; this.force = 0; this.forceTarget = 0; this.emit('hand-free'); }
        return;
      }
      if (this.handAge < RULES.approach) {
        this.opening = clamp(this.opening - this.force * .075 * dt, .31, .88);
        return;
      }
      if (this.handStage === 'approach') {
        this.handStage = 'grip'; this.emit('grip'); this.contact = 1;
      }
      this.gripTime += dt;
      const position = this.gripTime % RULES.cycle;
      const stage = position < RULES.brace ? 'brace' : position < RULES.brace + RULES.push ? 'push' : 'ease';
      if (stage !== this.gripStage) {
        if (this.gripStage === 'push') {
          if (this.pushGood >= .65) { this.defended++; this.emit('grip-slip'); }
          this.pushGood = 0;
        }
        this.gripStage = stage;
        this.emit(stage === 'brace' ? 'inhale' : stage === 'push' ? 'shove' : 'wood-release');
        if (stage === 'push') this.contact = .8;
      }
      let enemy;
      if (stage === 'push') {
        enemy = .38;
        if (this.force >= RULES.strongMin) this.pushGood += dt;
      } else enemy = stage === 'brace' ? .11 : .025;
      this.opening = clamp(this.opening + (enemy - this.force * .44) * dt, .12, 1);
      if (stage === 'ease' && this.force > RULES.softMax) this.gripNoise += (this.force - RULES.softMax) * 1.9 * dt;
      else if (this.force > .96) this.gripNoise += .25 * dt;
      else this.gripNoise = Math.max(0, this.gripNoise - .12 * dt);
      if (this.gripNoise >= .5 && !this.noiseWarned) { this.noiseWarned = true; this.impact = 1; this.emit('resistance-warning'); }
      if (this.gripNoise >= RULES.noiseLimit) { this.fail('strain'); return; }
      if (this.opening >= .96 || this.handAge > RULES.handTime) { this.fail('hand'); return; }
      if (stage === 'ease' && this.defended >= 2 && this.force >= RULES.softMin && this.force <= RULES.softMax) this.easeGood += dt;
      else this.easeGood = 0;
      if (this.easeGood > .55) { this.handStage = 'retreat'; this.retreatTime = 0; this.emit('hand-retreat'); }
    }
    update(delta) {
      if (!this.active()) return;
      // The view pauses on hidden/blur. Clamp only accidental render stalls.
      const dt = clamp(delta, 0, .08); this.time += dt; this.phaseTime += dt;
      this.impact = Math.max(0, this.impact - dt * 4.5); this.contact = Math.max(0, this.contact - dt * 2);
      if (this.knock) {
        this.knockAge += dt;
        const hits = [RULES.knockLead, 1.36, 2.12];
        while (this.knockHits < hits.length && this.knockAge >= hits[this.knockHits]) {
          const index = this.knockHits++; this.impact = index === 2 ? 1 : .65;
          this.emit('knock-hit', { index });
        }
      }
      if (this.hand) this.updateHand(dt);
      if (!this.active()) return;
      const still = this.time - this.lastMotion > .16;
      if (this.knock && !this.hand && still && this.knockAge > RULES.knockLead) this.quiet += dt;
      if (this.phase === 'learn' && this.opening >= .27 && this.time > 1) this.knockNow('knock1');
      else if (this.phase === 'knock1' && this.quiet >= RULES.quiet) {
        this.knock = false; this.knocksPassed++; this.emit('quiet'); this.enter('open1');
      } else if (this.phase === 'open1' && this.opening >= .6) { this.enter('hand1'); this.handNow(); }
      else if (this.phase === 'recover' && this.phaseTime > 2.3) { this.enter('reopen'); this.emit('whisper'); }
      else if (this.phase === 'reopen' && this.opening >= .48) this.knockNow('knock2');
      else if (this.phase === 'knock2' && this.phaseTime > 2.15 && !this.hand) this.handNow();
      else if (this.phase === 'settle' && this.quiet >= RULES.quiet) {
        this.knock = false; this.knocksPassed++; this.emit('quiet'); this.enter('finish');
      } else if (this.phase === 'finish' && this.opening <= RULES.closed && this.phaseTime > 2) {
        this.state = 'won'; this.release(); this.emit('win');
      }
    }
    snapshot() {
      return { state: this.state, phase: this.phase, opening: this.opening, time: this.time,
        paused: this.paused, held: this.held, knock: this.knock, hand: this.hand,
        quiet: this.quiet, violation: this.violation, handAge: this.handAge,
        knocksPassed: this.knocksPassed, handsStopped: this.handsStopped, reason: this.reason,
        force: this.force, forceTarget: this.forceTarget, gripNoise: this.gripNoise,
        handStage: this.handStage, gripStage: this.gripStage, defended: this.defended,
        impact: this.impact, contact: this.contact, resumeGrace: this.resumeGrace };
    }
  }
  root.DoorNight = DoorNight;
  DoorNight.RULES = RULES;
  if (typeof module !== 'undefined') module.exports = DoorNight;
})(typeof window === 'undefined' ? globalThis : window);
