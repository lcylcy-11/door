(function () {
  'use strict';
  const T = window.DoorTuning, C = window.DoorCaptions;
  const $ = id => document.getElementById(id);
  const night = new window.DoorNight();
  const scene = $('scene'), stage = $('stage'), front = $('front'), rear = $('rear');
  const handle = $('handle'), boltHit = $('boltHit');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrowQuery = matchMedia('(max-width: 600px)');
  // Per-layout windows into the 1600x900 world (spec section 3). Rendering and hit-testing share them.
  // "lean" is a view-only 1.5x lean toward the bolt during the latch beats, so the small hardware reads.
  const VIEWS = {
    wide: { front: [0, 0, 1600, 900], down: [470, 319, 1032, 581], rear: [0, 0, 1600, 900], lean: [533, 300, 1067, 600] },
    narrow: { front: [583, 0, 720, 900], down: [752, 319, 464, 581], rear: [322, 0, 720, 900], lean: [910, 300, 480, 600] }
  };
  let lean = 0, lastRawDt = 0, keyTravel = 0, keyFast = false;
  const cam = { front: VIEWS.wide.front, rear: VIEWS.wide.rear, W: 1, H: 1 };
  let audio = null, audioFiles = null, muted = false, assetsReady = false, lastFrame = 0, resultAge = 0, lastState = '';
  let rmbHeld = false, gazeLatched = false;
  const drag = { handle: null, bolt: null, x: 0, y: 0 };
  const pointer = { x: 0, y: 0 };
  let marks = { floor: -9, glass: -9, palm: -9, pop: -9 };

  // ---- camera ------------------------------------------------------------------------------
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  function layoutCamera(s) {
    const r = stage.getBoundingClientRect(), set = narrowQuery.matches ? VIEWS.narrow : VIEWS.wide, g = s ? (reduced ? (s.gazeDown ? 1 : 0) : smooth(s.gaze)) : 0;
    cam.W = r.width; cam.H = r.height; cam.left = r.left; cam.top = r.top; cam.layout = narrowQuery.matches ? 'narrow' : 'wide';
    const l = smooth(lean), leaned = set.front.map((v, i) => lerp(v, set.lean[i], l));
    cam.front = leaned.map((v, i) => lerp(v, set.down[i], g)); cam.rear = set.rear; cam.base = set.front;
    front.setAttribute('viewBox', cam.front.map(v => v.toFixed(2)).join(' '));
    rear.setAttribute('viewBox', cam.rear.join(' '));
  }
  function scaleOf(box) { return Math.max(cam.W / box[2], cam.H / box[3]); }
  function toStage(wx, wy, box = cam.front) {
    const s = scaleOf(box);
    return { x: (wx - box[0]) * s + (cam.W - box[2] * s) / 2, y: (wy - box[1]) * s + (cam.H - box[3] * s) / 2, s };
  }
  function place(el, wx, wy, ww, wh, min = 44) {
    const p = toStage(wx, wy), w = Math.max(min, ww * p.s), h = Math.max(min, wh * p.s);
    el.style.left = `${p.x}px`; el.style.top = `${p.y}px`; el.style.width = `${w}px`; el.style.height = `${h}px`;
  }
  function placeGauge(el, opening) {
    // Keep feedback beside the held pointer; keyboard/released input stays beside the handle.
    const p = drag.handle !== null ? { x: pointer.x - cam.left, y: pointer.y - cam.top } : toStage(T.door.handleX - 440 * opening, T.door.handleY);
    const w = el.offsetWidth, h = el.offsetHeight, gap = 24, pad = 12;
    let x = p.x + gap, y = p.y + gap;
    if (x + w > cam.W - pad) x = p.x - gap - w;
    if (y + h > cam.H - pad) y = p.y - gap - h;
    el.style.left = `${Math.max(pad, Math.min(x, cam.W - w - pad))}px`;
    el.style.top = `${Math.max(pad, Math.min(y, cam.H - h - pad))}px`;
  }

  // ---- audio ---------------------------------------------------------------------------------
  function initAudio() {
    try { if (!audio) audio = new window.RoomSound(audioFiles); audio.sync(muted, night.paused); }
    catch { muted = true; }
  }

  // ---- input: handle (left button) -------------------------------------------------------------
  function gazeInput() { night.setGaze(rmbHeld || gazeLatched); }
  function releaseHandle() {
    if (drag.handle !== null && handle.hasPointerCapture(drag.handle)) handle.releasePointerCapture(drag.handle);
    drag.handle = null; night.letGo(); scene.classList.remove('dragging');
  }
  function releaseBolt() {
    if (drag.bolt !== null && boltHit.hasPointerCapture(drag.bolt)) boltHit.releasePointerCapture(drag.bolt);
    drag.bolt = null; night.releaseBolt(); scene.classList.remove('latching');
  }
  function readButtons(event) {
    // A right press while the left is held arrives only as a pointermove with buttons = 3 (no pointerdown).
    if (event.pointerType !== 'mouse') return;
    const right = (event.buttons & 2) === 2;
    if (right !== rmbHeld) { rmbHeld = right; gazeInput(); }
  }
  function startHandle(event) {
    if (drag.handle !== null || !night.grip()) return;
    event.preventDefault(); drag.handle = event.pointerId; drag.x = event.clientX;
    pointer.x = event.clientX; pointer.y = event.clientY;
    handle.setPointerCapture(event.pointerId); scene.classList.add('dragging');
  }
  handle.addEventListener('pointerdown', event => { readButtons(event); if (event.button === 0) startHandle(event); });
  handle.addEventListener('pointermove', event => {
    if (event.pointerId !== drag.handle) return;
    pointer.x = event.clientX; pointer.y = event.clientY;
    const dx = event.clientX - drag.x; drag.x = event.clientX;
    // Door travel follows the cursor at the current zoom; force uses unzoomed travel so it feels like H2.
    const now = scaleOf(cam.front), base = scaleOf(cam.base), travel = T.door.travel;
    night.drag(-dx / (now * travel), -dx / (base * travel));
  });
  const endHandle = event => { if (event.pointerId === drag.handle && (event.type !== 'pointerup' || event.button === 0)) releaseHandle(); };
  handle.addEventListener('pointerup', endHandle); handle.addEventListener('pointercancel', endHandle);
  handle.addEventListener('lostpointercapture', event => { if (event.pointerId === drag.handle) { drag.handle = null; night.letGo(); scene.classList.remove('dragging'); } });
  handle.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); if (night.held) night.letGo(); else night.grip(); return; }
    if (event.key === ' ') { event.preventDefault(); night.letGo(); return; }
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); if (!night.held && !night.grip()) return;
    const sign = event.key === 'ArrowLeft' ? 1 : -1;
    if (night.gripping()) night.drag(0, sign * .11 / T.hand.forceGain); else { keyFast=event.shiftKey; keyTravel += sign * .02; }
  });

  // ---- input: bolt ------------------------------------------------------------------------------
  function boltTravel() { return Math.max(96, cam.H * .2); }
  function startBolt(event) {
    if (drag.bolt !== null || !night.grabBolt()) return;
    if(night.beat==='END')return;
    event.preventDefault(); drag.bolt = event.pointerId; drag.y = event.clientY;
    boltHit.setPointerCapture(event.pointerId); scene.classList.add('latching');
  }
  boltHit.addEventListener('pointerdown', event => { if (event.button === 0) startBolt(event); });
  boltHit.addEventListener('pointermove', event => {
    if (event.pointerId !== drag.bolt) return;
    const dy = event.clientY - drag.y; drag.y = event.clientY; night.dragBolt(dy / boltTravel());
  });
  const endBolt = event => { if (event.pointerId === drag.bolt) releaseBolt(); };
  boltHit.addEventListener('pointerup', endBolt); boltHit.addEventListener('pointercancel', endBolt);
  boltHit.addEventListener('lostpointercapture', event => { if (event.pointerId === drag.bolt) { drag.bolt = null; night.releaseBolt(); scene.classList.remove('latching'); } });
  boltHit.addEventListener('click',()=>{if(night.beat==='F3')night.grabBolt();});

  // ---- input: right button gaze, clicks, keys ------------------------------------------------------
  scene.addEventListener('contextmenu', event => event.preventDefault());
  scene.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 2) return;
    event.preventDefault();
    rmbHeld = true; gazeInput();
  });
  // With the right button already held (looking down), a left press or release arrives only as a
  // chorded pointermove (button 0, buttons changed) — no pointerdown/pointerup and no click. Route it.
  const CHORD_TARGETS = '#handle, #boltHit';
  document.addEventListener('pointermove', event => {
    readButtons(event);
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if ((event.buttons & 1) === 1) {
      if (drag.handle !== null || drag.bolt !== null) return;
      const hit = document.elementFromPoint(event.clientX, event.clientY), target = hit && hit.closest(CHORD_TARGETS);
      if (!target || target.disabled) return;
      if (target === handle) startHandle(event); else if (target === boltHit) startBolt(event); else target.click();
    } else {
      if (event.pointerId === drag.handle) releaseHandle();
      if (event.pointerId === drag.bolt) releaseBolt();
    }
  }, true);
  document.addEventListener('pointerup', event => {
    if (event.pointerType === 'mouse' && event.button === 2) { rmbHeld = false; gazeInput(); }
  }, true);
  // Fallback for browsers that do not report chorded presses as pointer events.
  document.addEventListener('mouseup', event => { if (event.button === 2 && rmbHeld) { rmbHeld = false; gazeInput(); } }, true);
  scene.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    if (['won', 'lost'].includes(night.state)) {
      if (scene.dataset.end) begin(night.state === 'lost' ? 'retry' : 'start');
      event.stopPropagation(); return;
    }
    if (night.paused) pause(false);
    initAudio();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); if (!event.repeat) pause(!night.paused); return; }
    if (event.repeat) return;
    if (event.code === 'KeyM') { muted = !muted; initAudio(); }
    if (event.key === 'Enter' && scene.dataset.end) {
      event.preventDefault(); event.stopPropagation(); begin(night.state === 'lost' ? 'retry' : 'start'); return;
    }
    if (night.active() && event.code === 'KeyS') { gazeLatched = !gazeLatched; gazeInput(); }
  }, true);

  // ---- lifecycle --------------------------------------------------------------------------------
  function resetInput() { releaseHandle(); releaseBolt(); rmbHeld = false; gazeLatched = false; }
  function begin(checkpoint) {
    if (!assetsReady) return;
    resetInput(); if (audio) audio.stopAll();
    if (checkpoint === 'retry') night.retry(); else night.start('C1', true);
    initAudio(); lastFrame = performance.now(); resultAge = 0; lastState = ''; keyTravel = 0;
    marks = { floor: -9, glass: -9, palm: -9, pop: -9 };
    scene.classList.add('playing'); scene.classList.remove('paused'); scene.dataset.end = '';
    render(); setTimeout(() => (night.beat === 'P0' ? boltHit : handle).focus({ preventScroll: true }), 0);
  }
  function pause(value) {
    if (night.state !== 'playing' || night.paused === value) return;
    resetInput(); night.setPaused(value); scene.classList.toggle('paused', value);
    if (audio) audio.sync(muted, value);
    if (!value) { initAudio(); lastFrame = performance.now(); }
    (value ? scene : handle).focus({ preventScroll: true });
    render();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
  window.addEventListener('blur', () => pause(true));
  window.addEventListener('resize', () => { if (night.active() && (night.hand || night.eyes !== 'none' || night.mimic !== 'none' || night.drawer === 'open' || night.shoves)) pause(true); else resetInput(); render(); });

  // The finished scene itself is the restart target; no menu or result card.
  function showEnd() {
    scene.dataset.end = night.state === 'won' ? 'win' : night.reason;
    scene.focus({ preventScroll: true });
  }

  // ---- events: audio and in-scene feedback ------------------------------------------------------------
  function handleEvents(events) {
    for (const e of events) {
      const twin = C.EVENTS[e.type];
      if (audio && twin && twin.sound) audio.cue(e, twin.sound);
      if (e.type === 'warning') marks[e.glass ? 'glass' : 'floor'] = night.time;
      if (['glass-knock', 'loiter-tap', 'soft-knock'].includes(e.type)) marks.glass = night.time;
      if (['palm', 'palm-slap'].includes(e.type)) marks.palm = night.time;
      if (e.type === 'wedge-pop') marks.pop = night.time;
    }
  }

  // ---- render -------------------------------------------------------------------------------------------
  const attr = (el, k, v) => el.setAttribute(k, typeof v === 'number' ? (Math.round(v * 100) / 100).toString() : v);
  function render() {
    const s = night.snapshot(), t = night.time;
    layoutCamera(s);
    const edgeHand = 1188 - 440 * s.o;
    const shakeOK = !reduced;
    const contact = shakeOK ? Math.sin(t * 87) * s.contact * 2 : 0, strainShake = shakeOK ? Math.sin(t * 63) * (s.hand ? s.strain : 0) * 1.7 : 0;
    const tremble = shakeOK && s.holder === 'unseated012' ? Math.sin(t * 2 * Math.PI * 7) * .4 : 0;
    const impact = shakeOK ? s.impact * Math.sin(t * 104) * 3 : 0;
    stage.style.transform = impact ? `translate(0, ${impact.toFixed(2)}px)` : '';
    // Turning: a pan over the shoulder (crossfade only under reduced motion).
    const turn = smooth(s.turn);
    front.style.opacity = String(1 - turn); rear.style.opacity = String(turn); rear.style.visibility = s.turn > 0 ? 'visible' : 'hidden';
    front.style.transform = reduced ? '' : `translateX(${(turn * 55).toFixed(2)}%)`;
    rear.style.transform = reduced ? '' : `translateX(${(-(1 - turn) * 55).toFixed(2)}%)`;
    scene.dataset.view = s.turn >= .5 ? 'rear' : s.gaze >= .5 ? 'down' : 'front';
    // Room light changes plates and brightness only.
    $('doorGroup').style.filter = `brightness(${(.85 + .15 * s.lit).toFixed(3)})`;
    attr($('corridorShade'), 'opacity', s.corridorShade);
    attr($('ajarStrip'), 'opacity', s.revealed ? .32 : 0); attr($('stairStrip'), 'opacity', s.revealed ? .5 : 0);
    const eyesOn = s.eyes === 'open' || s.eyes === 'withdraw';
    attr($('eyes'), 'opacity', eyesOn ? s.eyesFade : 0);
    $('eyesImage').style.filter = `brightness(${(.55 + .25 * s.lit).toFixed(2)})`;
    attr($('feetShadows'), 'opacity', s.eyes !== 'none' ? Math.max(.4, s.eyesFade) * (s.revealed ? 1 : .6) : 0);
    attr($('doorGroup'), 'transform', `translate(${(-440 * s.o + contact + strainShake + tremble).toFixed(2)} 0)`);
    attr($('silhouette'), 'opacity', s.silhouette * .62);
    const palmAge = t - marks.palm;
    attr($('palm'), 'opacity', s.light && palmAge >= 0 && palmAge < 1.6 ? .6 * (1 - palmAge / 1.6) : 0);
    $('palm').setAttribute('transform', `translate(${(-90 * Math.min(1, Math.max(0, palmAge) / 1.2)).toFixed(1)} 0)`);
    // Bolt: body, rod behind the collars, collars again; the guide shows while held.
    attr($('bolt'), 'y', 552.7 + 34.5 * s.b);
    $('latch').style.filter = `brightness(${(.45 + .55 * s.lit + (s.boltHeld ? .18 : 0)).toFixed(2)})`;
    for (const [id, y1, y2] of [['boltGuide', 629.45, 663.95]]) { attr($(id), 'y1', y1); attr($(id), 'y2', y2); attr($(id), 'opacity', s.boltHeld ? .7 : 0); }
    attr($('boltDetent'), 'opacity', s.boltHeld ? .9 : 0);
    attr($('boltDetent'), 'y1', 629.45 + 34.5 * .8); attr($('boltDetent'), 'y2', 629.45 + 34.5 * .8);
    attr($('floorHole'), 'opacity', s.lit > .5 ? .9 : .15);
    // H2 hand sprites (kept from H2).
    const approach = s.hand && s.handStage === 'approach' ? Math.min(1, night.handAge / T.hand.approach) : 1;
    const retreat = s.handStage === 'retreat' ? Math.min(1, night.retreatTime / T.hand.retreat) : 0;
    const visibleHand = s.hand && s.handStage !== 'released', grip = visibleHand && s.handStage !== 'approach';
    attr($('hand'), 'opacity', visibleHand && !grip ? Math.min(1, approach * 2) : 0);
    attr($('hand'), 'x', 1190 + (edgeHand - 1225) * Math.sin(approach * Math.PI / 2));
    attr($('hand'), 'y', 420 + (1 - approach) * 75);
    attr($('handGrip'), 'opacity', grip ? 1 - retreat : 0);
    attr($('handGrip'), 'x', edgeHand - 48 + retreat * 265 + contact);
    attr($('handGrip'), 'y', 405 + (reduced ? 0 : Math.sin(night.gripTime * 4) * (s.gripStage === 'push' ? 3 : 1)));
    for (const id of ['hand', 'handGrip']) $(id).style.filter = `brightness(${(.8 + .2 * s.lit).toFixed(2)})`;
    attr($('underDoor'), 'opacity', s.lit > .5 && s.o < .02 ? .55 : 0);
    attr($('footGaps'), 'opacity', s.lit > .5 && s.o < .02 && (s.beat === 'F3' || s.beat === 'C7') ? 1 : 0);
    const floorAge = t - marks.floor, glassAge = t - marks.glass;
    attr($('floorKnock'), 'opacity', floorAge >= 0 && floorAge < 1.3 ? .9 * (1 - floorAge / 1.3) : 0);
    attr($('glassKnock'), 'opacity', glassAge >= 0 && glassAge < .9 ? .9 * (1 - glassAge / .9) : 0);
    $('glassKnock').setAttribute('transform', `translate(${(960 - 440 * s.o).toFixed(1)} 330)`);
    // Screen overlays.
    $('brow').style.opacity = String(smooth(s.gaze));
    $('rearVignette').style.opacity = String(s.turn < .5 && s.drawer === 'open' ? Math.max(0, (s.d - .5) * 2) : 0);
    $('fade').style.opacity = String(s.fade);
    scene.classList.toggle('danger', s.A >= .45 || s.E >= .5 || s.strain > .5 || s.d > .66);
    scene.classList.toggle('gripped', grip); scene.classList.toggle('held', s.held);
    const scraping = s.band === 'stiff' && s.speed > .01 && !s.covered;
    attr($('scuff'), 'opacity', scraping ? .65 : s.band === 'stiff' ? .3 : .12);
    // Hotspots share the camera mapping.
    const frontUsable = night.active() && s.turn === 0 && !s.wantRear && s.beat !== 'END';
    const handleOK = frontUsable && (s.held || !s.boltHeld) && !(s.beat === 'C7' && night.s.pulling);
    place(handle, T.door.handleX - 440 * s.o + contact, T.door.handleY, 62, 125, 56);
    handle.style.minHeight = '110px'; handle.disabled = !handleOK;
    const pulling = s.beat === 'C7' && night.s.pulling;
    const boltBeat = ['P0', 'C7', 'F3'].includes(s.beat) && !(s.beat === 'F3' && s.seatedFlag) && !pulling;
    place(boltHit, 1164.95 - 440 * s.o, 629.45 + 34.5 * s.b, 64, 64, narrowQuery.matches ? 48 : 44);
    boltHit.disabled = !(frontUsable && boltBeat && !s.held);
    boltHit.classList.toggle('cue', boltBeat && !s.boltHeld && (s.beat !== 'F3' || s.b < .79));
    // Only the requested contextual meter remains on screen.
    const forceOn = night.active() && s.hand && s.handStage !== 'released';
    const soundWanted = night.active()&&!forceOn&&['C1','C4'].includes(s.beat)&&(s.sources.length>0||s.band==='stiff'||s.A>=.25);
    $('forcePanel').hidden = !forceOn; $('soundStrip').hidden = !soundWanted;
    if (forceOn) {
      const easing = s.gripStage === 'ease';
      $('forceBand').style.left = easing ? '16%' : '74%'; $('forceBand').style.width = easing ? '32%' : '22%';
      $('forceFill').style.transform = `scaleX(${s.force.toFixed(3)})`;
      $('forcePanel').classList.toggle('too-loud', s.strain > .45);
      $('forcePanel').setAttribute('aria-valuenow', Math.round(s.force * 100));
      placeGauge($('forcePanel'), s.o);
    }
    if (!$('soundStrip').hidden) {
      $('maskFill').style.transform = `scaleX(${Math.min(1, s.L / 1.2).toFixed(3)})`;
      $('soundStrip').classList.toggle('covered', s.covered); $('soundStrip').classList.toggle('ending', s.preWarn);
      $('attentionTrack').hidden = s.A < .25; $('attentionFill').style.transform = `scaleX(${Math.min(1, s.A).toFixed(3)})`;
      $('soundStrip').setAttribute('aria-valuenow', Math.round(Math.min(1, s.L / 1.2) * 100));
      placeGauge($('soundStrip'), s.o);
    }
    // QA surface (read-only).
    Object.assign(scene.dataset, { beat: s.beat, gaze: s.gazeDown ? 'down' : 'front', cover: s.covered ? 'on' : 'off', mimic: s.mimic, wedge: s.wedge,
      latch: s.seatedFlag ? 'seated' : s.b > .02 ? 'part' : 'up', light: s.light ? 'on' : 'off', hand: s.hand ? s.handStage : 'none', grip: s.gripStage });
    // Result screen after the loss tail.
    if (night.state !== lastState) { lastState = night.state; resultAge = 0; if (['won', 'lost'].includes(night.state)) { resetInput(); } }
    if (['won', 'lost'].includes(night.state) && resultAge >= (night.state === 'won' ? .2 : .95) && !scene.dataset.end) showEnd();
    const focused = document.activeElement;
    if (night.state === 'playing' && focused && focused.classList && focused.classList.contains('hotspot') && focused.disabled) {
      const next = [handle, boltHit].find(el => !el.disabled && !el.hidden);
      if (next) next.focus({ preventScroll: true });
    }
  }
  function frame(nowMs) {
    lastRawDt = lastFrame ? (nowMs - lastFrame) / 1000 : 0;
    const dt = lastFrame ? Math.min(.08, (nowMs - lastFrame) / 1000) : 0; lastFrame = nowMs;
    night.update(dt); if (['won', 'lost'].includes(night.state)) resultAge += dt;
    const leanWanted = night.state === 'playing' && night.turn === 0 && !night.held && !night.gazeDown &&
      (night.beat === 'P0' || (night.beat === 'F3' && !night.seatedFlag) || (night.beat === 'C7' && night.boltHeld));
    lean = reduced ? (leanWanted ? 1 : 0) : Math.max(0, Math.min(1, lean + (leanWanted ? 1 : -1) * dt / .45));
    if (night.active()) gazeInput();
    if (keyTravel && night.held && !night.gripping()) { const cap=keyFast?night.cap():Math.min(night.cap(),T.focus.quietSpeed); const chunk = Math.sign(keyTravel) * Math.min(Math.abs(keyTravel), cap * dt); night.drag(chunk, 0); keyTravel -= chunk; if (Math.abs(keyTravel) < 1e-6) keyTravel = 0; }
    else if (!night.held) keyTravel = 0;
    const events = night.events.splice(0);
    handleEvents(events);
    if (audio) { const sound = night.soundState(); audio.mirror(sound.streams); audio.setBeds(sound.beds); }
    render(); requestAnimationFrame(frame);
  }

  // ---- loading ------------------------------------------------------------------------------------------
  const IMAGES=['apartment.png','door.png','hand.png','hand-grip.png','eyes.webp','latch-body.webp','latch-bolt.webp'];
  audioFiles = window.RoomSound.prefetch();
  Promise.all(IMAGES.map(src => new Promise((resolve, reject) => { const img = new Image(); img.onload = resolve; img.onerror = reject; img.src = `./assets/${src}`; })))
    .then(() => { assetsReady = true; begin('start'); })
    .catch(() => { scene.setAttribute('aria-label', '그림을 불러오지 못했습니다. 페이지를 새로고침해 주세요.'); });
  // Read-only QA surface: a frozen snapshot and the audio graph's actual values. No setters.
  Object.defineProperty(window, 'doorH4', { value: Object.freeze({ snapshot: () => night.snapshot(), audioProbe: () => audio ? { ...audio.probe(), lastRawDt, sinceFrame: (performance.now() - lastFrame) / 1000 } : null, soundState: () => night.soundState() }) });
  render(); requestAnimationFrame(frame);
})();
