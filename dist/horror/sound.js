(function (root) {
  'use strict';
  function randomSource(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1; }
  // A struck hollow wooden surface: sharp contact, detuned body, diffuse room tail.
  function knockSamples(rate, seed = 17) {
    const length = Math.floor(rate * 1.05), data = new Float32Array(length), rand = randomSource(seed);
    let low = 0;
    for (let i = 0; i < length; i++) {
      const t = i / rate, n = rand(); low += (n - low) * .085;
      const attack = Math.min(1, t / .0015);
      const contact = n * Math.exp(-95 * t) * .28;
      const body = Math.sin(2 * Math.PI * 79 * t) * Math.exp(-8 * t) * .36
        + Math.sin(2 * Math.PI * 173 * t + .4) * Math.exp(-13 * t) * .21
        + Math.sin(2 * Math.PI * 319 * t) * Math.exp(-22 * t) * .09;
      const tail = low * Math.exp(-4.8 * t) * .2;
      data[i] = Math.max(-.92, Math.min(.92, (contact + body + tail) * attack));
    }
    return data;
  }
  class RoomSound {
    constructor() {
      const Context = root.AudioContext || root.webkitAudioContext;
      this.ctx = new Context(); this.muted = false; this.paused = false; this.voices = new Set();
      const ctx = this.ctx, master = ctx.createGain(), compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -17; compressor.knee.value = 14; compressor.ratio.value = 5;
      compressor.attack.value = .006; compressor.release.value = .18;
      master.gain.value = .5; master.connect(compressor); compressor.connect(ctx.destination); this.master = master;
      const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), samples = noise.getChannelData(0), rand = randomSource(771);
      for (let i = 0; i < samples.length; i++) samples[i] = rand();
      this.noise = noise;
      this.room = this.loop(74, .012, 'sine');
      this.television = this.noiseLoop(760, 1.1, .008);
      this.wood = this.noiseLoop(230, 4.5, 0);
      this.breath = this.noiseLoop(530, .6, 0);
      this.tension = this.loop(52, 0, 'sine');
      this.knockBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.05), ctx.sampleRate);
      this.knockBuffer.copyToChannel(knockSamples(ctx.sampleRate), 0);
    }
    loop(frequency, volume, type) {
      const oscillator = this.ctx.createOscillator(), gain = this.ctx.createGain();
      oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.value = volume;
      oscillator.connect(gain); gain.connect(this.master); oscillator.start(); return gain;
    }
    noiseLoop(frequency, q, volume) {
      const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
      source.buffer = this.noise; source.loop = true; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = q;
      gain.gain.value = volume; source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(); return gain;
    }
    sync(muted, paused) {
      this.muted = muted; this.paused = paused;
      this.master.gain.setTargetAtTime(muted || paused ? 0 : .5, this.ctx.currentTime, .025);
      if (paused) this.stopVoices();
      else this.ctx.resume().catch(() => {});
    }
    stopVoices() { for (const voice of this.voices) { try { voice.stop(); } catch {} } this.voices.clear(); }
    play(buffer, volume, pan = 0, speed = 1) {
      if (this.muted || this.paused) return;
      const source = this.ctx.createBufferSource(), gain = this.ctx.createGain(), position = this.ctx.createStereoPanner();
      source.buffer = buffer; source.playbackRate.value = speed; gain.gain.value = volume; position.pan.value = pan;
      source.connect(gain); gain.connect(position); position.connect(this.master); this.voices.add(source);
      source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); position.disconnect(); };
      source.start();
    }
    breathHit(duration, volume, frequency) {
      if (this.muted || this.paused) return;
      const ctx = this.ctx, src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
      const t = ctx.currentTime; src.buffer = this.noise; src.playbackRate.value = .7;
      filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = 1.4; pan.pan.value = .55;
      gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(volume, t + Math.min(.2, duration / 3)); gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
      src.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(this.master); this.voices.add(src);
      src.onended = () => { this.voices.delete(src); src.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect(); };
      src.start(t); src.stop(t + duration + .03);
    }
    event(event) {
      if (event.type === 'knock-hit') this.play(this.knockBuffer, [.72, .85, 1][event.index], -.25, [1, .94, .82][event.index]);
      else if (event.type === 'resistance-warning') this.play(this.knockBuffer, .8, -.35, .76);
      else if (event.type === 'scratch') this.breathHit(1.2, .055, 1800);
      else if (event.type === 'grip') this.play(this.knockBuffer, .24, .4, 1.5);
      else if (event.type === 'inhale') this.breathHit(.75, .065, 550);
      else if (event.type === 'shove') { this.play(this.knockBuffer, .26, .35, .64); this.breathHit(.7, .045, 160); }
      else if (event.type === 'grip-slip') this.breathHit(.4, .04, 1300);
      else if (event.type === 'hand-retreat') this.breathHit(.8, .09, 900);
      else if (event.type === 'slam') this.play(this.knockBuffer, .75, .1, .62);
      else if (event.type === 'lose') { this.play(this.knockBuffer, .9, 0, .5); this.breathHit(1.4, .17, 370); }
    }
    update(model) {
      const active = model.active(), t = this.ctx.currentTime;
      const hush = model.knock || model.hand;
      this.room.gain.setTargetAtTime(active ? hush ? .003 : .012 : 0, t, .12);
      this.television.gain.setTargetAtTime(active && !hush ? .008 : 0, t, .07);
      this.wood.gain.setTargetAtTime(active && model.handStage === 'grip' ? .005 + model.gripNoise * .12 + model.force * .012 : 0, t, .06);
      this.breath.gain.setTargetAtTime(active && model.handStage === 'grip' ? .006 : 0, t, .12);
      this.tension.gain.setTargetAtTime(active && model.hand ? .008 + model.gripNoise * .023 : 0, t, .2);
    }
  }
  RoomSound.knockSamples = knockSamples;
  root.RoomSound = RoomSound;
  if (typeof module !== 'undefined') module.exports = RoomSound;
})(typeof window === 'undefined' ? globalThis : window);
