(function () {
  'use strict';
  const T = window.DoorTuning, C = window.DoorCaptions;
  const $ = id => document.getElementById(id);
  const night = new window.DoorNight();
  const scene = $('scene'), stage = $('stage'), front = $('front'), rear = $('rear');
  const handle = $('handle'), boltHit = $('boltHit'), switchHit = $('switchHit'), slipperHit = $('slipperHit');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrowQuery = matchMedia('(max-width: 600px)');
  // Per-layout windows into the 1600x900 world (spec section 3). Rendering and hit-testing share them.
  // "lean" is a view-only 1.5x lean toward the bolt during the latch beats, so the small hardware reads.
  const VIEWS = {
    wide: { front: [0, 0, 1600, 900], down: [470, 319, 1032, 581], rear: [0, 0, 1600, 900], lean: [533, 300, 1067, 600] },
    narrow: { front: [583, 0, 720, 900], down: [752, 319, 464, 581], rear: [322, 0, 720, 900], lean: [910, 300, 480, 600] }
  };
  let lean = 0, lastRawDt = 0, keyTravel = 0, keyFast = false, rmbPrev = false;
  const cam = { front: VIEWS.wide.front, rear: VIEWS.wide.rear, W: 1, H: 1 };
  let audio = null, audioFiles = null, muted = false, assetsReady = false, lastFrame = 0, resultAge = 0, lastState = '', lastBeat = '';
  let gazeMode = 'hold', rmbHeld = false, gazeLatched = false, showNumbers = false;
  const drag = { handle: null, bolt: null, x: 0, y: 0 };
  let captionQueue = [], caption = null, lastLine = '', marks = { floor: -9, glass: -9, palm: -9, pop: -9 }, wedgeAnim = { from: 'rest', at: -9 };

  // ---- camera ------------------------------------------------------------------------------
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  function layoutCamera(s) {
    const r = stage.getBoundingClientRect(), set = narrowQuery.matches ? VIEWS.narrow : VIEWS.wide, g = s ? (reduced ? (s.gazeDown ? 1 : 0) : smooth(s.gaze)) : 0;
    cam.W = r.width; cam.H = r.height; cam.layout = narrowQuery.matches ? 'narrow' : 'wide';
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

  // ---- audio ---------------------------------------------------------------------------------
  function initAudio() {
    try { if (!audio) audio = new window.RoomSound(audioFiles); audio.sync(muted, night.paused); }
    catch { muted = true; $('sound').textContent = '소리 지원 안 됨'; $('sound').disabled = true; }
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
    if (gazeMode === 'hold') { if (right !== rmbHeld) { rmbHeld = right; gazeInput(); } }
    else if (right && !rmbPrev && event.type === 'pointermove') { gazeLatched = !gazeLatched; gazeInput(); }
    rmbPrev = right;
  }
  function startHandle(event) {
    if (drag.handle !== null || !night.grip()) return;
    event.preventDefault(); drag.handle = event.pointerId; drag.x = event.clientX;
    handle.setPointerCapture(event.pointerId); scene.classList.add('dragging');
  }
  handle.addEventListener('pointerdown', event => { readButtons(event); if (event.button === 0) startHandle(event); });
  handle.addEventListener('pointermove', event => {
    if (event.pointerId !== drag.handle) return;
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
    rmbPrev = true;
    if (gazeMode === 'hold') { rmbHeld = true; gazeInput(); } else { gazeLatched = !gazeLatched; gazeInput(); }
  });
  // With the right button already held (looking down), a left press or release arrives only as a
  // chorded pointermove (button 0, buttons changed) — no pointerdown/pointerup and no click. Route it.
  const CHORD_TARGETS = '#handle, #boltHit, #slipperHit, #switchHit, #switchProxy, #turn, #gazeToggle';
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
    if (event.pointerType === 'mouse' && event.button === 2 && gazeMode === 'hold') { rmbHeld = false; gazeInput(); }
  }, true);
  // Fallback for browsers that do not report chorded presses as pointer events.
  document.addEventListener('mouseup', event => { if (event.button === 2 && gazeMode === 'hold' && rmbHeld) { rmbHeld = false; gazeInput(); } }, true);
  switchHit.addEventListener('click', () => night.toggleLight());
  $('switchProxy').addEventListener('click', () => night.toggleLight());
  slipperHit.addEventListener('click', () => night.toggleWedge());
  $('turn').addEventListener('click', () => night.setTurn(!night.wantRear));
  $('gazeToggle').addEventListener('click', () => { gazeLatched = !gazeLatched; gazeInput(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); if (!event.repeat) pause(!night.paused); return; }
    if (event.target && ['INPUT'].includes(event.target.tagName)) return;
    if (event.repeat && event.code !== 'KeyS') return;
    if (event.code === 'KeyM') toggleMute();
    else if (!night.active()) return;
    else if (event.code === 'KeyQ') night.setTurn(!night.wantRear);
    else if (event.code === 'KeyL') night.toggleLight();
    else if (event.code === 'KeyW') night.toggleWedge();
    else if (event.code === 'KeyS' && !event.repeat) { gazeLatched = !gazeLatched; gazeInput(); }
  });

  // ---- lifecycle --------------------------------------------------------------------------------
  function resetInput() { releaseHandle(); releaseBolt(); rmbHeld = false; gazeLatched = false; }
  function begin(checkpoint) {
    if (!assetsReady) return;
    resetInput(); if (audio) audio.stopAll();
    if (checkpoint === 'retry') night.retry(); else night.start('C1', true);
    initAudio(); lastFrame = performance.now(); caption = null; captionQueue = []; lastLine = ''; resultAge = 0; lastState = ''; lastBeat = ''; keyTravel = 0;
    marks = { floor: -9, glass: -9, palm: -9, pop: -9 };
    $('intro').hidden = true; $('end').hidden = true; $('pauseLayer').hidden = true;
    $('pause').disabled = false; $('restart').disabled = false; $('pause').textContent = '일시정지';
    scene.classList.add('playing'); scene.dataset.end = '';
    render(); setTimeout(() => (night.beat === 'P0' ? boltHit : handle).focus({ preventScroll: true }), 0);
  }
  function pause(value) {
    if (night.state !== 'playing' || night.paused === value) return;
    resetInput(); night.setPaused(value); $('pauseLayer').hidden = !value;
    $('pause').textContent = value ? '이어서 하기' : '일시정지';
    if (audio) audio.sync(muted, value);
    if (value) $('resume').focus({ preventScroll: true });
    else { initAudio(); lastFrame = performance.now(); handle.focus({ preventScroll: true }); }
    render();
  }
  function toggleMute() {
    muted = !muted; initAudio(); $('sound').textContent = muted ? '소리 꺼짐' : '소리 켜짐';
    $('sound').setAttribute('aria-pressed', String(!muted)); if (audio) audio.sync(muted, night.paused);
  }
  $('start').addEventListener('click', () => begin('start'));
  $('again').addEventListener('click', () => begin('start'));
  $('restart').addEventListener('click', () => begin('start'));
  $('retry').addEventListener('click', () => begin('retry'));
  $('pause').addEventListener('click', () => pause(!night.paused));
  $('resume').addEventListener('click', () => pause(false));
  $('sound').addEventListener('click', toggleMute);
  const setGazeMode = toggle => { gazeMode = toggle ? 'toggle' : 'hold'; $('gazeMode').checked = toggle; $('gazeModeIntro').checked = toggle; rmbHeld = false; gazeInput(); };
  $('gazeMode').addEventListener('change', e => setGazeMode(e.target.checked));
  $('gazeModeIntro').addEventListener('change', e => setGazeMode(e.target.checked));
  $('showNumbers').addEventListener('change', e => { showNumbers = e.target.checked; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
  window.addEventListener('blur', () => pause(true));
  window.addEventListener('resize', () => { if (night.active() && (night.hand || night.eyes !== 'none' || night.mimic !== 'none' || night.drawer === 'open' || night.shoves)) pause(true); else resetInput(); render(); });

  // ---- end card -----------------------------------------------------------------------------------
  function showEnd() {
    const won = night.state === 'won', end = C.ENDINGS[night.reason];
    let title, copy, hint = '';
    if (won) { title = C.WIN.title; copy = C.WIN.copy; }
    else {
      title = Array.isArray(end.title) ? end.title[night.glassBeat() ? 1 : 0] : end.title;
      copy = typeof end.lesson === 'string' ? end.lesson : end.lesson[night.lastSource] || end.lesson.scrape;
      if (night.reason === 'noise' && night.lastSource === 'rattle' && night.beat === 'P0') copy = C.ENDINGS.noise.lesson.rattleUp;
      if (night.reason === 'hand' && night.failWhy === 'timeout') { title = C.ENDINGS.hand.timeoutTitle; copy = C.ENDINGS.hand.timeoutLesson; }
      if (night.reason === 'eyes' && gazeMode === 'toggle') copy = C.ENDINGS.eyes.lessonToggle;
      if (night.reason === 'drawer' && night.beat === 'C6c') copy = '문이 밀리는 중이면, 슬리퍼를 먼저 끼우고 뒤를 보세요.';
      if (night.failCounts[night.beat] >= 2) hint = end.hint;
    }
    $('endTitle').textContent = title; $('endCopy').textContent = copy;
    $('endHint').textContent = hint; $('endHint').hidden = !hint;
    $('end').classList.toggle('lost', !won); $('end').classList.toggle('won', won); $('end').hidden = false;
    scene.dataset.end = won ? 'win' : night.reason;
    (won ? $('again') : $('retry')).focus({ preventScroll: true });
  }

  // ---- events: sound twins and captions --------------------------------------------------------------
  function handleEvents(events) {
    for (const e of events) {
      const twin = C.EVENTS[e.type];
      if (audio && twin && twin.sound) audio.cue(e, twin.sound);
      if (e.type === 'warning') marks[e.glass ? 'glass' : 'floor'] = night.time;
      if (['glass-knock', 'loiter-tap', 'soft-knock'].includes(e.type)) marks.glass = night.time;
      if (['palm', 'palm-slap'].includes(e.type)) marks.palm = night.time;
      if (e.type === 'wedge-pop') marks.pop = night.time;
      if (['wedge-inserting', 'wedge-removing'].includes(e.type)) wedgeAnim = { from: e.type, at: night.time };
      if (!twin || !twin.text) continue;
      let loc = twin.loc, text = twin.text;
      if (e.type === 'warning') { loc = e.glass ? '문 유리' : '아래층'; text = (e.glass ? '똑. 똑. 똑.' : '쿵. 쿵. 쿵.') + (e.source === 'light' ? ' — 문틈으로 빛이 샌다. 불을 끄세요 (스위치 · L).' : ' — 소리 내지 마세요 (긁힘·스위치·슬리퍼·걸쇠).'); }
      if (e.type === 'push-defended') text = `버텼다 (${Math.min(e.count, T.hand.required)}/${T.hand.required}).`;
      if (e.type === 'wedge-refused') text = { shove: '미는 중에는 못 끼운다 — 밀고 난 직후에.', hand: '손잡이를 놓아야 슬리퍼를 끼울 수 있다.', range: '문이 조금 열려 있을 때만 끼울 수 있다.' }[e.reason] || text;
      if (e.type === 'cover-ending' && night.sources.some(x => x.src === 'traffic')) loc = '창밖';
      if (e.type === 'mask-start' && night.beat === 'C5' && !handleEvents.c5Mask) { handleEvents.c5Mask = true; loc = '복도 밖'; text = '윙— 엘리베이터. 긁힘만 가린다 — 손가락은 그대로다.'; }
      if (e.type === 'confirm' && e.route === 'lit') text = '불빛에 — 유리 너머, 누군가 서 있었다. 현관은 반쯤 열려 있다.';
      if (e.type === 'wedge-slip') text = e.level >= 2 ? '끼익 — 슬리퍼가 빠지려 한다 (2/3).' : '끽 — 슬리퍼가 밀렸다 (1/3).';
      if (e.type === 'glass-knock') text = e.slow ? '똑…… 똑…… 똑.' : ['똑.', '똑. 똑.', '똑. 똑. 똑.'][e.index] || '똑.';
      if (e.type === 'shove' && e.result === 'held') text = '쿵 — 버텼다.';
      if (e.type === 'shove' && e.result === 'open') text = '쿵 — 문이 밀려 열렸다!';
      if (e.type === 'shove' && e.result === 'wedge') continue;
      if (e.type === 'covered' && e.source === 'switch') text = '스위치 소리가 바깥 소리에 묻혔다.';
      if (e.type === 'breath' && e.visit === 'F3') { loc = '문 너머'; text = '…숨소리가 문 바로 뒤에.'; }
      const priority = C.PRIORITY[e.type] || 2;
      captionQueue = captionQueue.filter(c => c.priority >= priority || c.shownAt);
      captionQueue.push({ loc, text, priority, hold: Math.max(2200, text.length * 85), at: performance.now() });
      captionQueue.sort((a, b) => b.priority - a.priority);
    }
  }

  // ---- render -------------------------------------------------------------------------------------------
  const attr = (el, k, v) => el.setAttribute(k, typeof v === 'number' ? (Math.round(v * 100) / 100).toString() : v);
  function render() {
    const s = night.snapshot(), now = performance.now(), t = night.time;
    layoutCamera(s);
    const edgeHand = 1188 - 440 * s.o, edge = T.door.edgeX - 440 * s.o;
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
    place(switchHit, 382.5, 387.5, 85, 115);
    const switchVisible = !narrowQuery.matches;
    switchHit.hidden=true; switchHit.disabled=true;
    switchHit.classList.toggle('cue', s.beat === 'C2' && s.corridor === 'dead' && !s.confirmRoute && !s.light);
    $('switchProxy').hidden = !(narrowQuery.matches && night.state === 'playing' && night.switchUnlocked());
    $('switchProxy').disabled = !s.canSwitch;
    const sl = s.wedge === 'rest' ? [1105, 800, 190, 95] : [edge - 30, 728, 150, 64];
    place(slipperHit, sl[0] + sl[2] / 2, sl[1] + sl[3] / 2, sl[2], sl[3]);
    slipperHit.hidden=true; slipperHit.disabled=true;
    slipperHit.classList.toggle('cue', s.canWedge && ((s.beat === 'C6b' && night.absorbed >= 1 && s.wedge === 'rest') || (s.beat === 'C6c' && !s.shoves && s.wedge === 'in')));
    // Turn control and gaze toggle.
    const turnBtn = $('turn');
    turnBtn.hidden = !(night.state === 'playing' && night.turnUnlocked());
    turnBtn.disabled = !(s.wantRear ? night.active() : s.canTurn);
    $('turnLabel').textContent = s.wantRear ? '문' : '뒤'; turnBtn.querySelector('.arrow').textContent = s.wantRear ? '↷' : '↶';
    turnBtn.setAttribute('aria-label', s.wantRear ? '문 쪽으로 돌아서기' : '뒤돌아보기');
    turnBtn.classList.toggle('cue', (s.drawer === 'open' && !s.wantRear) || (s.drawer === 'shut' && s.wantRear));
    const gazeBtn = $('gazeToggle');
    gazeBtn.hidden = !(night.state === 'playing' && s.turn === 0 && !s.wantRear && s.beat==='C4');
    gazeBtn.setAttribute('aria-pressed', String(gazeLatched));
    $('gazeBadge').hidden = !s.gazeDown;
    $('leakChip').hidden = !(night.state === 'playing' && s.leak);
    // HUD: at most two panels (force > checklist > sound).
    const forceOn = night.active() && s.hand && s.handStage !== 'released';
    const checkOn = false;
    // The force panel and the checklist never coexist, so at most two panels show.
    const soundWanted = night.active()&&!forceOn&&['C1','C4'].includes(s.beat)&&(s.sources.length>0||s.band==='stiff'||s.A>=.25);
    $('forcePanel').hidden = !forceOn; $('checklist').hidden = !checkOn; $('soundStrip').hidden = !soundWanted; scene.classList.toggle('strip', soundWanted);
    if (forceOn) {
      const easing = s.gripStage === 'ease';
      $('forceBand').style.left = easing ? '16%' : '74%'; $('forceBand').style.width = easing ? '32%' : '22%';
      $('forceFill').style.transform = `scaleX(${s.force.toFixed(3)})`;
      $('forcePanel').classList.toggle('too-loud', s.strain > .45);
      $('forceCue').textContent = s.resumeGrace > 0 ? '손잡이를 다시 잡으세요' : s.handStage === 'retreat' ? '손이 빠진다' : s.handStage === 'approach' ? '손이 들어온다 — 잡으세요' : !s.held ? '손잡이를 잡고 → 밀기' : s.strain > .52 ? '문이 운다 — ← 힘 줄이기' : easing ? '손이 느슨하다 — ← 힘 줄이기' : s.gripStage === 'push' ? '밀쳐온다 — → 더 밀기' : '손가락이 굳는다 — 밀 준비';
    }
    if (checkOn) {
      $('ckClosed').classList.toggle('ok', s.flush && s.o <= T.door.flush); $('ckWedge').classList.toggle('ok', s.wedge === 'rest');
      $('ckHands').classList.toggle('ok', !s.held); $('ckNoHand').classList.toggle('ok', !s.hand && s.mimic === 'none');
      const ks = night.s.t - T.beats.f3Knocks, phase = ks < 0 ? -1 : (ks % T.beats.f3Period) / T.beats.f3Period;
      [...$('dots').children].forEach((dot, i) => dot.classList.toggle('on', phase >= 0 && phase >= i / 3 && phase < (i + 1) / 3));
    }
    if (!$('soundStrip').hidden) {
      $('maskFill').style.transform = `scaleX(${Math.min(1, s.L / 1.2).toFixed(3)})`;
      $('soundStrip').classList.toggle('covered', s.covered); $('soundStrip').classList.toggle('ending', s.preWarn);
      $('coverChip').textContent = s.covered ? (s.preWarn ? '곧 멎음' : '덮임') : s.sources.length ? '약함' : '조용';
      $('attentionTrack').hidden = s.A < .25; $('attentionFill').style.transform = `scaleX(${Math.min(1, s.A).toFixed(3)})`;
      $('soundLabel').textContent = s.A >= .25 ? '바깥 소리 · 기척' : '바깥 소리';
    }
    $('numbers').hidden = !(showNumbers && night.state !== 'ready');
    if (showNumbers) $('numbers').textContent = `beat ${s.beat}  o ${s.o.toFixed(3)}  b ${s.b.toFixed(2)}\n기척 A ${s.A.toFixed(2)}  가림 L ${s.L.toFixed(2)}${s.covered ? ' ●' : ''}\n시선 E ${s.E.toFixed(2)}  힘 ${s.force.toFixed(2)}`;
    // QA surface (read-only).
    Object.assign(scene.dataset, { beat: s.beat, gaze: s.gazeDown ? 'down' : 'front', cover: s.covered ? 'on' : 'off', mimic: s.mimic, wedge: s.wedge,
      latch: s.seatedFlag ? 'seated' : s.b > .02 ? 'part' : 'up', light: s.light ? 'on' : 'off', hand: s.hand ? s.handStage : 'none', grip: s.gripStage });
    // Captions: an event line wins for a moment, the steady line otherwise.
    const steady = C.line(s, gazeMode);
    // Each queued line stays at least 1.2 s; higher priority lines go first; ambience lines yield.
    if (caption && now - caption.shownAt >= 1200 && captionQueue.length) caption = null;
    if (caption && now - caption.shownAt >= caption.hold) caption = null;
    // Lines about a moment that has passed (older than 1.6 s, below teaching priority) are dropped, never shown late.
    captionQueue = captionQueue.filter(c => c.priority >= 3 || now - c.at < 1600);
    if (!caption && captionQueue.length) { caption = captionQueue.shift(); caption.shownAt = now; }
    const live = caption && night.state === 'playing';
    const loc = live ? caption.loc : steady[0], sub = live ? caption.text : steady[1], ins = steady[2];
    const key = `${loc}|${sub}|${ins}`;
    if (key !== lastLine) { $('location').textContent = loc; $('subtitle').textContent = sub; $('instruction').textContent = ins; lastLine = key; }
    $('instruction').classList.toggle('urgent', /!/.test(ins));
    $('objective').textContent = night.state === 'won' ? '문을 잠갔다.' : C.OBJECTIVES[s.beat] || '';
    $('roomCaption').textContent = s.turn >= .5 ? '침실 안쪽 · 서랍장' : '침실 쪽 · 중문';
    // Hints near controls.
    const hint = $('hint');
    let hintText = '', hx = 0, hy = 0;
    if (frontUsable && s.beat === 'P0' && !s.boltHeld) { hintText = '누른 채 ↑'; const p = toStage(1164.95, 700); hx = p.x; hy = p.y + 8; }
    else if (frontUsable && s.beat === 'C1' && !s.held && s.o < .02) { hintText = '누른 채 ← 열기'; const p = toStage(T.door.handleX - 440 * s.o, 500); hx = p.x; hy = p.y; }
    else if (frontUsable && boltBeat && s.beat !== 'P0' && !s.boltHeld && !s.held && !s.seatedFlag) { hintText = '한 번 눌러 잠그기'; const p = toStage(1164.95 - 440 * s.o, 700); hx = p.x; hy = p.y + 8; }
    hint.hidden = !hintText; if (hintText) { hint.textContent = hintText; hint.style.left = `${hx}px`; hint.style.top = `${hy}px`; }
    // Result screen after the loss tail.
    if (night.state !== lastState) { lastState = night.state; resultAge = 0; if (['won', 'lost'].includes(night.state)) { resetInput(); $('pause').disabled = true; } }
    if (['won', 'lost'].includes(night.state) && resultAge >= (night.state === 'won' ? .2 : .95) && $('end').hidden) showEnd();
    if (s.beat !== lastBeat) { lastBeat = s.beat; }
    const focused = document.activeElement;
    if (night.state === 'playing' && focused && focused.classList && (focused.classList.contains('hotspot') || focused.id === 'turn') && focused.disabled) {
      const next = [handle, boltHit, $('turn')].find(el => !el.disabled && !el.hidden);
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
    .then(() => { assetsReady = true; $('start').disabled = false; $('loadStatus').textContent = '열기 · 버티기 · 보지 않고 닫기 · Esc 일시정지'; })
    .catch(() => { $('loadStatus').textContent = '그림을 불러오지 못했습니다. 페이지를 새로고침해 주세요.'; });
  // Read-only QA surface: a frozen snapshot and the audio graph's actual values. No setters.
  Object.defineProperty(window, 'doorH4', { value: Object.freeze({ snapshot: () => night.snapshot(), audioProbe: () => audio ? { ...audio.probe(), lastRawDt, sinceFrame: (performance.now() - lastFrame) / 1000 } : null, soundState: () => night.soundState() }) });
  render(); requestAnimationFrame(frame);
})();
