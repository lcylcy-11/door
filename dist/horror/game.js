(function () {
  'use strict';
  const $ = id => document.getElementById(id), model = new DoorNight();
  const scene = $('scene'), handle = $('handle');
  const text = {
    learn: ['방 안', '아래층에서는 TV 소리가 희미하게 들립니다.', '손잡이를 누른 채 왼쪽으로, 조금만 열어보세요.'],
    knock1: ['아래층', '쿵. 쿵. 쿵. — 아래에서 천장을 두드립니다.', '손을 멈추세요. TV 소리가 돌아올 때까지.'],
    open1: ['아래층', '다시 TV 소리가 들립니다. 잠잠해졌습니다.', '조금 더 열어서, 문 너머를 확인하세요.'],
    hand1: ['문틈', '손이다. 틈으로 손이 들어온다.', '지금은 빨리! 손잡이를 오른쪽으로 밀어 닫으세요.'],
    recover: ['문밖', '문 바로 뒤에서 무언가 긁다가 멎었습니다.', '잠깐 숨을 고르세요.'],
    reopen: ['문밖', '…방금, 내 이름을 부른 것 같았습니다.', '다시 한 번만. 손잡이를 왼쪽으로 밀어 확인하세요.'],
    knock2: ['아래층', '또다시, 아래에서 천장을 두드립니다.', '일단 멈추세요. 문틈도 지켜보세요.'],
    settle: ['아래층', '쾅. 아래층에서 의자를 끄는 소리가 납니다.', '이제 움직이지 마세요. 잠잠해질 때까지.'],
    finish: ['방 안', 'TV 소리가 돌아왔습니다. 손잡이를 놓습니다.', '문을 닫은 채, 잠깐 기다리세요.']
  };
  let pointer = null, anchorX = 0, anchorOpen = 0, lastFrame = 0, audio = null, muted = false;
  let lastSpeech = '', lastState = '', soundTimers = [], assetsReady = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function geometry() {
    const r = scene.getBoundingClientRect();
    // Match the artwork's explicit narrow-screen framing, not the outer box.
    const narrow = matchMedia('(max-width: 600px)').matches;
    return { width: r.width * (narrow ? 2.22222 : 1), offset: narrow ? -.81 * r.width : 0 };
  }
  function release() {
    model.release(); scene.classList.remove('dragging');
    if (pointer !== null && handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer);
    pointer = null;
  }
  function clearSoundTimers() { soundTimers.forEach(clearTimeout); soundTimers = []; }
  function initAudio() {
    if (audio) { audio.ctx.resume().catch(() => {}); return; }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = ctx.createGain(), ambient = ctx.createGain(), oscillator = ctx.createOscillator();
      master.gain.value = muted ? 0 : .42; master.connect(ctx.destination);
      oscillator.type = 'sine'; oscillator.frequency.value = 74; ambient.gain.value = .025;
      oscillator.connect(ambient); ambient.connect(master); oscillator.start();
      audio = { ctx, master, ambient }; ctx.resume().catch(() => {});
    } catch { muted = true; $('sound').textContent = '소리 지원 안 됨'; $('sound').disabled = true; }
  }
  function tone(frequency, length, gain, type = 'sine') {
    if (!audio || muted || model.paused) return;
    const t = audio.ctx.currentTime, osc = audio.ctx.createOscillator(), volume = audio.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * .38), t + length);
    volume.gain.setValueAtTime(.0001, t); volume.gain.exponentialRampToValueAtTime(gain, t + .008); volume.gain.exponentialRampToValueAtTime(.0001, t + length);
    osc.connect(volume); volume.connect(audio.master); osc.start(t); osc.stop(t + length + .02);
  }
  function knocks() {
    clearSoundTimers(); [0, 310, 670].forEach(delay => soundTimers.push(setTimeout(() => {
      if (model.active() && model.knock) tone(95, .22, .3, 'triangle');
    }, delay)));
  }
  function start() {
    if (!assetsReady) return;
    release(); clearSoundTimers(); initAudio(); model.start(); lastFrame = performance.now();
    $('intro').hidden = true; $('end').hidden = true; $('pauseLayer').hidden = true;
    $('pause').disabled = false; $('restart').disabled = false; handle.disabled = false;
    $('pause').textContent = '일시정지';
    scene.classList.add('playing'); scene.classList.remove('failure'); lastState = '';
    render(); handle.focus({ preventScroll: true });
  }
  function pause(value) {
    if (model.state !== 'playing') return;
    release(); clearSoundTimers(); model.setPaused(value); $('pauseLayer').hidden = !value;
    $('pause').textContent = value ? '이어서 하기' : '일시정지';
    if (audio) audio.master.gain.setTargetAtTime(value || muted ? 0 : .42, audio.ctx.currentTime, .04);
    if (value) $('resume').focus({ preventScroll: true });
    else { initAudio(); lastFrame = performance.now(); handle.focus({ preventScroll: true }); }
    render();
  }
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer !== null || !model.begin()) return;
    event.preventDefault(); pointer = event.pointerId; anchorX = event.clientX; anchorOpen = model.opening;
    handle.setPointerCapture(pointer); scene.classList.add('dragging');
  });
  handle.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer) return;
    const travel = geometry().width * 440 / 1600;
    model.moveTo(anchorOpen - (event.clientX - anchorX) / travel); render();
  });
  handle.addEventListener('pointerup', release); handle.addEventListener('pointercancel', release);
  handle.addEventListener('lostpointercapture', () => { pointer = null; model.release(); scene.classList.remove('dragging'); });
  handle.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); if (!model.begin()) return;
    model.moveTo(model.opening + (event.key === 'ArrowLeft' ? .065 : -.065)); model.release(); render();
  });
  $('start').addEventListener('click', start); $('again').addEventListener('click', start); $('restart').addEventListener('click', start);
  $('pause').addEventListener('click', () => pause(!model.paused)); $('resume').addEventListener('click', () => pause(false));
  $('sound').addEventListener('click', () => {
    muted = !muted; initAudio(); $('sound').textContent = muted ? '소리 꺼짐' : '소리 켜짐';
    $('sound').setAttribute('aria-pressed', String(!muted));
    if (audio) audio.master.gain.setTargetAtTime(muted || model.paused ? 0 : .42, audio.ctx.currentTime, .04);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); pause(!model.paused); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
  window.addEventListener('blur', () => pause(true)); window.addEventListener('resize', render);
  function end() {
    release(); clearSoundTimers(); handle.disabled = true; $('pause').disabled = true;
    const won = model.state === 'won';
    $('endTitle').textContent = won ? '이제 좀 조용하네.' : model.reason === 'hand' ? '문을 놓쳤다.' : '아랫집이 올라왔다.';
    $('endCopy').textContent = won ? '문은 닫혔습니다.\n그 말은, 아래에서 들린 게 아니었습니다.' : model.reason === 'hand' ? '손이 보이면 기다리지 마세요.\n손잡이를 오른쪽으로 밀어, 문을 끝까지 닫으세요.' : '노크가 들릴 때도 문을 움직였습니다.\n손이 없다면 멈추고, TV 소리가 돌아오길 기다리세요.';
    $('end').classList.toggle('lost', !won); $('end').hidden = false;
    scene.classList.toggle('failure', !won); $('again').focus({ preventScroll: true });
    if (audio) audio.ambient.gain.setTargetAtTime(0, audio.ctx.currentTime, .3);
  }
  function render() {
    const g = geometry(), width = scene.getBoundingClientRect().width;
    $('doorLayer').setAttribute('transform', `translate(${-440 * model.opening} 0)`);
    handle.style.left = `${g.offset + g.width * (1158 - 440 * model.opening) / 1600}px`;
    handle.style.top = '39%';
    $('handleHint').style.left = `${Math.min(width - 135, g.offset + g.width * (1050 - 440 * model.opening) / 1600)}px`;
    $('hand').setAttribute('opacity', model.hand ? '1' : '0');
    $('hand').setAttribute('x', String(1090 - Math.min(1, model.handAge / 2.5) * 140));
    $('hand').setAttribute('y', String(505 + (reduced ? 0 : Math.sin(model.time * 7) * 2)));
    $('corridorShade').setAttribute('opacity', model.hand ? '.23' : '.08');
    $('knockMark').setAttribute('opacity', model.knock ? String(.55 + Math.max(0, Math.sin(model.knockAge * 11)) * .45) : '0');
    scene.classList.toggle('knocking', model.knock); scene.classList.toggle('danger', model.hand || model.violation > .07); scene.dataset.phase = model.phase;
    let speech = text[model.phase] || text.learn;
    if (model.hand) speech = ['문틈', '손이다. 기다리면 안 된다.', '노크보다 먼저! 손잡이를 오른쪽으로, 끝까지 닫으세요.'];
    const key = speech.join('|');
    if (key !== lastSpeech) {
      $('location').textContent = speech[0]; $('subtitle').textContent = speech[1]; $('instruction').textContent = speech[2]; lastSpeech = key;
    }
    $('handleHint').textContent = model.hand ? '오른쪽으로 → 빨리 닫기' : model.knock ? '움직이지 마세요' : model.phase === 'recover' || model.phase === 'finish' ? '손잡이를 놓으세요' : '누른 채 ← 열기';
    $('handleHint').hidden = model.state !== 'playing' || model.paused;
    $('objective').textContent = model.state === 'won' ? '문 너머 확인하기 — 완료' : model.knocksPassed ? '다시 한 번 확인하고, 문을 닫으세요.' : '문 너머를 확인하고, 무사히 닫으세요.';
    handle.disabled = model.state !== 'playing' || model.paused;
    if (lastState !== model.state) { lastState = model.state; if (['won', 'lost'].includes(model.state)) end(); }
  }
  function frame(now) {
    const dt = lastFrame ? (now - lastFrame) / 1000 : 0; lastFrame = now; model.update(dt);
    const events = model.events.splice(0);
    for (const event of events) {
      if (event.type === 'knock') knocks();
      else if (event.type === 'scratch') tone(330, 1.2, .055, 'sawtooth');
      else if (event.type === 'slam') tone(65, .55, .42, 'triangle');
      else if (event.type === 'lose') tone(42, 1.5, .24, 'sawtooth');
      else if (event.type === 'start' && audio) audio.ambient.gain.setTargetAtTime(.025, audio.ctx.currentTime, .2);
    }
    if (audio && model.active()) audio.ambient.gain.setTargetAtTime(model.knock ? .005 : .025, audio.ctx.currentTime, .4);
    render(); requestAnimationFrame(frame);
  }
  const sources = ['apartment.png', 'door.png', 'hand.png'];
  Promise.all(sources.map(src => new Promise((resolve, reject) => {
    const img = new Image(); img.onload = resolve; img.onerror = reject; img.src = `./assets/${src}`;
  }))).then(() => { assetsReady = true; $('start').disabled = false; $('loadStatus').textContent = '마우스 드래그 · 약 1분 · Esc 일시정지'; }).catch(() => {
    $('loadStatus').textContent = '그림을 불러오지 못했습니다. 페이지를 새로고침해 주세요.';
  });
  Object.defineProperty(window, 'doorPrototypeSnapshot', { get: () => model.snapshot() });
  render(); requestAnimationFrame(frame);
})();
