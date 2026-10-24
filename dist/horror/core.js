(function (root) {
  'use strict';
  const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n));
  // All timings are seconds, and opening is a fraction of door travel.
  const RULES = Object.freeze({ quiet: 2.7, reactionGrace: .7, knockTravel: .2, handTime: 4.2, closed: .045 });
  class DoorNight {
    constructor() { this.reset(); }
    reset() {
      Object.assign(this, { state: 'ready', phase: 'learn', opening: 0, time: 0, phaseTime: 0,
        held: false, paused: false, lastMotion: -10, quiet: 0, violation: 0,
        knock: false, knockAge: 0, hand: false, handAge: 0, handsStopped: 0,
        knocksPassed: 0, reason: '', events: [], serial: 0, peakMotion: 0 });
    }
    emit(type) { this.events.push({ type, id: ++this.serial, time: this.time }); }
    start() { this.reset(); this.state = 'playing'; this.emit('start'); }
    active() { return this.state === 'playing' && !this.paused; }
    begin() { if (!this.active()) return false; this.held = true; return true; }
    release() { this.held = false; }
    setPaused(value) { if (this.state !== 'playing') return; this.paused = value; this.release(); }
    enter(phase) { this.phase = phase; this.phaseTime = 0; }
    knockNow(phase) {
      this.knock = true; this.knockAge = 0; this.quiet = 0; this.violation = 0;
      this.enter(phase); this.emit('knock');
    }
    handNow() { this.hand = true; this.handAge = 0; this.emit('scratch'); }
    moveTo(value) {
      if (!this.active() || !this.held) return;
      const next = clamp(value), distance = Math.abs(next - this.opening);
      if (distance < .001) return;
      this.peakMotion = Math.max(this.peakMotion, distance);
      this.lastMotion = this.time; this.quiet = 0;
      // A necessary defensive slam never counts against the knock warning.
      if (this.knock && !this.hand && this.knockAge > RULES.reactionGrace) {
        this.violation += distance;
        if (this.violation > RULES.knockTravel) { this.fail('knock'); return; }
      }
      this.opening = next;
      if (this.hand && this.opening <= RULES.closed) {
        this.hand = false; this.handsStopped++; this.emit('slam');
        this.lastMotion = this.time; this.quiet = 0; this.violation = 0;
        // Fresh reaction time after the hand, including a fresh knock sound.
        if (this.knock) { this.knockAge = 0; this.emit('knock'); this.enter('settle'); }
        else this.enter('recover');
      }
    }
    fail(reason) { this.state = 'lost'; this.reason = reason; this.release(); this.emit('lose'); }
    update(delta) {
      if (!this.active()) return;
      // The view pauses on hidden/blur. Clamp only accidental render stalls.
      const dt = clamp(delta, 0, .08); this.time += dt; this.phaseTime += dt;
      if (this.knock) this.knockAge += dt;
      if (this.hand) {
        this.handAge += dt;
        if (this.handAge >= RULES.handTime) { this.fail('hand'); return; }
      }
      const still = this.time - this.lastMotion > .16;
      if (this.knock && !this.hand && still) this.quiet += dt;
      if (this.phase === 'learn' && this.opening >= .27 && this.time > 1) this.knockNow('knock1');
      else if (this.phase === 'knock1' && this.quiet >= RULES.quiet) {
        this.knock = false; this.knocksPassed++; this.emit('quiet'); this.enter('open1');
      } else if (this.phase === 'open1' && this.opening >= .6) { this.enter('hand1'); this.handNow(); }
      else if (this.phase === 'recover' && this.phaseTime > 2.3) { this.enter('reopen'); this.emit('whisper'); }
      else if (this.phase === 'reopen' && this.opening >= .48) this.knockNow('knock2');
      else if (this.phase === 'knock2' && this.phaseTime > 1.2 && !this.hand) this.handNow();
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
        knocksPassed: this.knocksPassed, handsStopped: this.handsStopped, reason: this.reason };
    }
  }
  root.DoorNight = DoorNight;
  DoorNight.RULES = RULES;
  if (typeof module !== 'undefined') module.exports = DoorNight;
})(typeof window === 'undefined' ? globalThis : window);
