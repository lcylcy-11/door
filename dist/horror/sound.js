(function (root) {
  'use strict';
  function randomSource(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1; }
  // A struck hollow wooden surface: sharp contact, detuned body, diffuse room tail.
  // Kept as the fallback when the knock asset cannot be decoded.
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
  const FILES = ['breath-near', 'door-scrape', 'drawer-creak-loop', 'drawer-slide', 'drawer-thud', 'knock-wood',
    'lamp-hum-loop', 'latch-click', 'latch-rattle', 'latch-slide', 'mask-elevator-loop', 'mask-traffic-pass',
    'mimic-response', 'rear-floor-creak', 'switch-click', 'wedge-in', 'wedge-out', 'wedge-slip'];
  // Fetch the raw files while the intro is open; decoding waits for the AudioContext a click creates.
  function prefetch(base = './assets/audio/') {
    return Promise.all(FILES.map(id => fetch(`${base}${id}.wav`).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)
      .then(data => [id, data]))).then(entries => Object.fromEntries(entries));
  }
  class RoomSound {
    constructor(raw) {
      const Context = root.AudioContext || root.webkitAudioContext;
      this.ctx = new Context(); this.muted = false; this.paused = false; this.buffers = {}; this.streams = new Map();
      const ctx = this.ctx, master = ctx.createGain(), compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -17; compressor.knee.value = 14; compressor.ratio.value = 5;
      compressor.attack.value = .006; compressor.release.value = .18;
      master.gain.value = .5; master.connect(compressor); compressor.connect(ctx.destination); this.master = master;
      const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), samples = noise.getChannelData(0), rand = randomSource(771);
      for (let i = 0; i < samples.length; i++) samples[i] = rand();
      this.noise = noise;
      this.beds = { room: this.tone(74, 'sine'), tv: this.noiseBed(760, 1.1), strain: this.noiseBed(230, 4.5), tension: this.tone(52, 'sine') };
      const knock = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.05), ctx.sampleRate);
      knock.copyToChannel(knockSamples(ctx.sampleRate), 0); this.buffers['knock-wood'] = knock;
      this.ready = Promise.resolve(raw).then(files => Promise.all(Object.entries(files || {}).map(([id, data]) => data &&
        ctx.decodeAudioData(data.slice(0)).then(buffer => { this.buffers[id] = buffer; }).catch(() => {}))));
    }
    tone(frequency, type) {
      const oscillator = this.ctx.createOscillator(), gain = this.ctx.createGain();
      oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.value = 0;
      oscillator.connect(gain); gain.connect(this.master); oscillator.start(); return gain;
    }
    noiseBed(frequency, q) {
      const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
      source.buffer = this.noise; source.loop = true; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = q;
      gain.gain.value = 0; source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(); return gain;
    }
    // Mute only silences the master bus; sources keep their model-owned gains (spec: rules never read mute).
    sync(muted, paused) {
      this.muted = muted; this.paused = paused;
      this.master.gain.setTargetAtTime(muted ? 0 : .5, this.ctx.currentTime, .025);
      if (paused) this.ctx.suspend().catch(() => {}); else this.ctx.resume().catch(() => {});
    }
    // Restart: every one-shot and stream stops; beds fall silent until the model sets them again.
    stopAll() {
      for (const stream of this.streams.values()) { try { stream.source.stop(); } catch {} }
      this.streams.clear();
      for (const voice of this.voices || []) { try { voice.stop(); } catch {} }
      this.voices = new Set();
    }
    voice(buffer, volume, { pan = 0, rate = 1, when = 0, lowpass = 0 } = {}) {
      const ctx = this.ctx, source = ctx.createBufferSource(), gain = ctx.createGain(), position = ctx.createStereoPanner();
      source.buffer = buffer; source.playbackRate.value = rate; gain.gain.value = volume; position.pan.value = pan;
      let tail = source;
      if (lowpass) { const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = lowpass; source.connect(filter); tail = filter; }
      tail.connect(gain); gain.connect(position); position.connect(this.master);
      this.voices = this.voices || new Set(); this.voices.add(source);
      source.onended = () => { this.voices.delete(source); try { source.disconnect(); gain.disconnect(); position.disconnect(); } catch {} };
      source.start(ctx.currentTime + when);
      return { source, gain };
    }
    play(id, volume, options) { const buffer = this.buffers[id]; if (buffer && volume > 0 && !this.muted) this.voice(buffer, volume, options); }
    breath(duration, volume, frequency, when = 0) {
      if (this.muted) return;
      const ctx = this.ctx, src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
      const t = ctx.currentTime + when; src.buffer = this.noise; src.playbackRate.value = .7;
      filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = 1.4; pan.pan.value = .5;
      gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(volume, t + Math.min(.2, duration / 3)); gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
      src.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(this.master);
      this.voices = this.voices || new Set(); this.voices.add(src);
      src.onended = () => { this.voices.delete(src); try { src.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect(); } catch {} };
      src.start(t); src.stop(t + duration + .03);
    }
    // One-shot cue for a rules event, from the captions twins table.
    cue(event, spec) {
      if (!spec) return;
      if (Array.isArray(spec)) { const [id, gain, rate] = spec; this.play(id, gain, { rate }); return; }
      const glass = event.glass;
      switch (spec) {
        case 'knock3': [0, .42, .95].forEach((when, i) => this.play('knock-wood', glass ? .65 : .55 + i * .08, glass ? { rate: 1.15, when } : { rate: .9, when, lowpass: 600 })); break;
        case 'flicker': [0, .35, .8].forEach(when => this.play('switch-click', .18, { rate: 1.7, when })); break;
        case 'scratch': this.breath(1.2, .055, 1800); this.play('door-scrape', .18, { rate: 1.6 }); break;
        case 'inhale': this.breath(.75, .065, 550); break;
        case 'shove': this.play('knock-wood', .26, { rate: .64 }); this.breath(.7, .045, 160); break;
        case 'slip': this.breath(.4, .04, 1300); break;
        case 'retreat': this.breath(.8, .09, 900); break;
        case 'tense': this.breath(.5, .05, 420); break;
        case 'shoveHit': this.play('knock-wood', event.result === 'open' ? .7 : event.result === 'wedge' ? .5 : .4, { rate: .7 }); break;
        case 'wedgeSlip': this.play('wedge-slip', event.level >= 2 ? .65 : .35, { rate: 1 }); break;
        case 'pull': this.play('knock-wood', .9, { rate: .5 }); this.play('door-scrape', .6, { rate: 1.8 }); break;
        case 'sting': this.play('drawer-slide', .6, { pan: -.3 }); this.play('drawer-thud', .6, { pan: -.3, when: 1.3 }); break;
        case 'lose': this.play('knock-wood', .9, { rate: .5 }); this.breath(1.4, .17, 370); break;
      }
    }
    // The rules declare which continuous sounds exist and their gains; this mirrors them, position-locked
    // to the model's playback offset so a pause or a dropped frame never desynchronises judged and heard cover.
    mirror(wanted) {
      const now = this.ctx.currentTime;
      for (const [id, stream] of this.streams) {
        const target = wanted[id];
        if (!target || target.gain <= 0 || target.file !== stream.file) {
          stream.gain.gain.setTargetAtTime(0, now, .05);
          try { stream.source.stop(now + .3); } catch {}
          this.streams.delete(id);
        }
      }
      for (const [id, target] of Object.entries(wanted)) {
        if (!target || target.gain <= 0) continue;
        const buffer = this.buffers[target.file];
        if (!buffer) continue;
        let stream = this.streams.get(id);
        const offset = target.offset;
        if (stream && offset !== undefined) {
          const span = stream.loop ? (stream.loopEnd - stream.loopStart) : Infinity;
          let heard = stream.startOffset + (now - stream.startedAt) * stream.rate;
          if (stream.loop) heard = stream.loopStart + ((heard - stream.loopStart) % span + span) % span;
          const expected = stream.loop ? stream.loopStart + ((offset - stream.loopStart) % span + span) % span : offset;
          const drift = Math.abs(heard - expected);
          if (drift > .06 && (!stream.loop || Math.abs(drift - span) > .06)) { try { stream.source.stop(); } catch {} this.streams.delete(id); stream = null; }
        }
        if (!stream) {
          if (!target.loop && (offset || 0) >= buffer.duration - .02) continue;
          const loopStart = target.loopStart || 0, loopEnd = target.loopEnd || buffer.duration;
          const start = target.loop ? loopStart + (((offset || 0) - loopStart) % (loopEnd - loopStart) + (loopEnd - loopStart)) % (loopEnd - loopStart) : (offset || 0);
          const source = this.ctx.createBufferSource(), gain = this.ctx.createGain(), pan = this.ctx.createStereoPanner();
          source.buffer = buffer; source.playbackRate.value = target.rate || 1;
          source.loop = !!target.loop; if (source.loop) { source.loopStart = loopStart; source.loopEnd = loopEnd; }
          gain.gain.value = 0; pan.pan.value = target.pan || 0;
          source.connect(gain); gain.connect(pan); pan.connect(this.master);
          source.onended = () => { try { source.disconnect(); gain.disconnect(); pan.disconnect(); } catch {} };
          source.start(now, start);
          stream = { source, gain, file: target.file, loop: !!target.loop, loopStart, loopEnd, startedAt: now, startOffset: start, rate: target.rate || 1 };
          this.streams.set(id, stream);
        }
        stream.gain.gain.setTargetAtTime(target.gain, now, target.smooth || .03);
        if (target.rate && Math.abs(target.rate - stream.rate) > .01) { stream.source.playbackRate.setTargetAtTime(target.rate, now, .08); stream.rate = target.rate; }
      }
    }
    setBeds(beds) {
      const now = this.ctx.currentTime;
      this.beds.tv.gain.setTargetAtTime(.009 * beds.tv, now, .08);
      this.beds.room.gain.setTargetAtTime(.012 * beds.room, now, .15);
      this.beds.strain.gain.setTargetAtTime(beds.strain ? .005 + beds.strain * .12 : 0, now, .06);
      this.beds.tension.gain.setTargetAtTime(.008 * beds.tension, now, .25);
    }
    probe() {
      const streams = {};
      for (const [id, s] of this.streams) streams[id] = { file: s.file, gain: s.gain.gain.value, age: this.ctx.currentTime - s.startedAt, offset: s.loop ? s.loopStart + (((s.startOffset + (this.ctx.currentTime - s.startedAt) * s.rate) - s.loopStart) % (s.loopEnd - s.loopStart)) : s.startOffset + (this.ctx.currentTime - s.startedAt) * s.rate };
      return { state: this.ctx.state, muted: this.muted, master: this.master.gain.value, streams };
    }
  }
  RoomSound.knockSamples = knockSamples;
  RoomSound.prefetch = prefetch;
  RoomSound.FILES = FILES;
  root.RoomSound = RoomSound;
  if (typeof module !== 'undefined') module.exports = RoomSound;
})(typeof window === 'undefined' ? globalThis : window);
