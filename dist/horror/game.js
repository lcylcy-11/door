(function () {
  'use strict';
  const $ = id => document.getElementById(id), model = new DoorNight();
  const scene = $('scene'), handle = $('handle');
  const text = {
    learn: ['방 안', '아래층에서는 TV 소리가 희미하게 들립니다.', '손잡이를 누른 채 왼쪽으로, 조금만 열어보세요.'],
    knock1: ['아래층', '쿵. 쿵. 쿵. — 아래에서 천장을 두드립니다.', '손을 멈추세요. TV 소리가 돌아올 때까지.'],
    open1: ['아래층', '다시 TV 소리가 들립니다. 잠잠해졌습니다.', '조금 더 열어서, 문 너머를 확인하세요.'],
    hand1: ['문틈', '나무를 긁는 소리. 손끝이 들어옵니다.', '손잡이를 잡고 오른쪽으로 밀어 준비하세요.'],
    recover: ['문밖', '문 바로 뒤에서 무언가 긁다가 멎었습니다.', '잠깐 숨을 고르세요.'],
    reopen: ['문밖', '…아직, 문 바로 뒤에 숨소리가 남아 있습니다.', '다시 한 번만. 손잡이를 왼쪽으로 밀어 확인하세요.'],
    knock2: ['아래층', '또다시, 아래에서 천장을 두드립니다.', '일단 멈추세요. 문틈도 지켜보세요.'],
    settle: ['아래층', '쾅. 아래층에서 의자를 끄는 소리가 납니다.', '이제 움직이지 마세요. 잠잠해질 때까지.'],
    finish: ['방 안', 'TV 소리가 돌아왔습니다. 손잡이를 놓습니다.', '문을 닫은 채, 잠깐 기다리세요.']
  };
  let pointer = null, lastPointerX = 0, lastFrame = 0, audio = null, muted = false;
  let lastSpeech = '', lastState = '', resultAge = 0, assetsReady = false;
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
  function initAudio() {
    try { if (!audio) audio = new RoomSound(); audio.sync(muted, model.paused); }
    catch { muted = true; $('sound').textContent = '소리 지원 안 됨'; $('sound').disabled = true; }
  }
  function start() {
    if (!assetsReady) return;
    release(); if (audio) audio.stopVoices(); model.start(); initAudio(); lastFrame = performance.now();
    $('intro').hidden = true; $('end').hidden = true; $('pauseLayer').hidden = true;
    $('pause').disabled = false; $('restart').disabled = false; handle.disabled = false;
    $('pause').textContent = '일시정지';
    scene.classList.add('playing'); scene.classList.remove('failure'); lastState = ''; resultAge = 0;
    render(); handle.focus({ preventScroll: true });
  }
  function pause(value) {
    if (model.state !== 'playing') return;
    release(); model.setPaused(value); $('pauseLayer').hidden = !value;
    $('pause').textContent = value ? '이어서 하기' : '일시정지';
    if (audio) audio.sync(muted, value);
    if (value) $('resume').focus({ preventScroll: true });
    else { initAudio(); lastFrame = performance.now(); handle.focus({ preventScroll: true }); }
    render();
  }
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer !== null || !model.begin()) return;
    event.preventDefault(); pointer = event.pointerId; lastPointerX = event.clientX;
    handle.setPointerCapture(pointer); scene.classList.add('dragging');
  });
  handle.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer) return;
    const travel = geometry().width * 440 / 1600;
    const dx = event.clientX - lastPointerX; lastPointerX = event.clientX;
    model.drag(dx / travel); render();
  });
  handle.addEventListener('pointerup', release); handle.addEventListener('pointercancel', release);
  handle.addEventListener('lostpointercapture', () => { pointer = null; model.release(); scene.classList.remove('dragging'); });
  handle.addEventListener('keydown', event => {
    if (event.key === ' ') { event.preventDefault(); release(); return; }
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); if (!model.begin()) return;
    model.drag(event.key === 'ArrowRight' ? .04 : -.04);
    if (!model.hand || model.handStage === 'released') model.release();
    render();
  });
  $('start').addEventListener('click', start); $('again').addEventListener('click', start); $('restart').addEventListener('click', start);
  $('pause').addEventListener('click', () => pause(!model.paused)); $('resume').addEventListener('click', () => pause(false));
  $('sound').addEventListener('click', () => {
    muted = !muted; initAudio(); $('sound').textContent = muted ? '소리 꺼짐' : '소리 켜짐';
    $('sound').setAttribute('aria-pressed', String(!muted));
    if (audio) audio.sync(muted, model.paused);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); pause(!model.paused); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
  window.addEventListener('blur', () => pause(true)); window.addEventListener('resize', () => { if (model.active() && model.hand) pause(true); else release(); render(); });
  function end() {
    release(); handle.disabled = true; $('pause').disabled = true;
    const won = model.state === 'won', strain = model.reason === 'strain';
    $('endTitle').textContent = won ? '이제 좀 조용하네.' : strain ? '그 소리를 들었다.' : model.reason === 'hand' ? '문이 밀려 열렸다.' : '아랫집이 올라왔다.';
    $('endCopy').textContent = won ? '문은 닫혔습니다.\n그 말은, 아래에서 들린 게 아니었습니다.' : strain ? '너무 세게 미는 동안 문이 크게 삐걱거렸습니다.\n손이 잠잠해지면, 잡은 채 왼쪽으로 힘을 줄이세요.' : model.reason === 'hand' ? '손잡이를 잡고 오른쪽으로 밀어 버티세요.\n손가락이 굳으면 더 밀고, 문이 울면 힘을 줄이세요.' : '노크가 들릴 때 문을 움직였습니다.\n손이 없다면, TV 소리가 돌아올 때까지 기다리세요.';
    $('end').classList.toggle('lost', !won); $('end').hidden = false;
    scene.classList.toggle('failure', !won); $('again').focus({ preventScroll: true });
  }
  function handSpeech() {
    if (model.handStage === 'approach') return ['문틈', '손톱이 나무를 긁는다. 손끝이 틈으로 들어온다.', '손잡이를 잡은 채 오른쪽으로 밀어 준비하세요.'];
    if (model.handStage === 'retreat') return ['문틈', '붙잡던 손가락이, 하나씩 미끄러집니다.', '힘을 풀어도 됩니다. 손이 빠지면 문을 닫으세요.'];
    if (model.handStage === 'released') return ['문틈', '손이 빠졌다. 지금이다.', '이제 손잡이를 오른쪽으로, 끝까지 닫으세요.'];
    if (model.gripNoise > .52) return ['아래층', '문이 운다. 아래에서 다시, 쿵.', '잡은 채 왼쪽으로 힘을 줄이세요. 놓지는 마세요.'];
    if (model.gripStage === 'push') return ['문틈', '손이 문을 밀어 벌린다.', '오른쪽으로 더 밀어 버티세요.'];
    if (model.gripStage === 'ease') return ['문틈', '손의 힘이 잠깐 느슨해졌습니다.', '잡은 채 왼쪽으로 조금. 문이 울지 않게 힘을 줄이세요.'];
    return ['문틈', '손가락이 굳는다. 다시 밀쳐오려 한다.', '손잡이를 잡고 오른쪽으로, 힘을 실으세요.'];
  }
  function render() {
    const g = geometry(), width = scene.getBoundingClientRect().width;
    const ending = model.state === 'lost' && resultAge < .95;
    const contactShake = reduced ? 0 : Math.sin(model.time * 87) * model.contact * 2;
    const strainShake = reduced ? 0 : Math.sin(model.time * 63) * model.gripNoise * 1.7;
    const impactShake = reduced ? 0 : model.impact * Math.sin(model.time * 104) * 2.5;
    const visualOpen = ending && model.reason === 'hand' ? Math.min(1, model.opening + resultAge * .45) : model.opening;
    const edge = 1188 - 440 * visualOpen;
    $('doorLayer').setAttribute('transform', `translate(${-440 * visualOpen + contactShake + strainShake} 0)`);
    const camera = `translate(0, ${impactShake}px)`;
    $('world').style.transform = camera; scene.querySelector('.apartment').style.transform = camera;
    handle.style.left = `${g.offset + g.width * (1158 - 440 * model.opening + contactShake + strainShake) / 1600}px`;
    $('handleHint').style.left = `${Math.max(12, Math.min(width - 190, g.offset + g.width * (1010 - 440 * model.opening) / 1600))}px`;
    const approach = Math.min(1, model.handAge / DoorNight.RULES.approach);
    const retreat = model.handStage === 'retreat' ? Math.min(1, model.retreatTime / .7) : 0;
    const visible = model.hand && model.handStage !== 'released';
    const grip = visible && model.handStage !== 'approach';
    $('hand').setAttribute('opacity', visible && !grip ? String(Math.min(1, approach * 2)) : '0');
    $('hand').setAttribute('x', String(1190 + (edge - 1225) * Math.sin(approach * Math.PI / 2)));
    $('hand').setAttribute('y', String(420 + (1 - approach) * 75));
    $('handGrip').setAttribute('opacity', grip ? String(1 - retreat) : '0');
    $('handGrip').setAttribute('x', String(edge - 48 + retreat * 265 + contactShake));
    $('handGrip').setAttribute('y', String(405 + (reduced ? 0 : Math.sin(model.gripTime * 4) * (model.gripStage === 'push' ? 3 : 1))));
    $('corridorShade').setAttribute('opacity', visible ? '.25' : '.08');
    const floorSignal = (model.knock && model.knockAge >= DoorNight.RULES.knockLead) || (model.noiseWarned && model.gripNoise > .45);
    $('knockMark').setAttribute('opacity', floorSignal ? String(.25 + model.impact * .75) : '0');
    scene.classList.toggle('knocking', model.knock); scene.classList.toggle('gripped', grip);
    scene.classList.toggle('danger', model.gripNoise > .5 || model.violation > .07);
    scene.dataset.phase = model.phase; scene.dataset.hand = model.handStage; scene.dataset.grip = model.gripStage;
    scene.dataset.defended = String(model.defended); scene.dataset.force = model.force.toFixed(3);
    let speech = text[model.phase] || text.learn;
    if (model.knock && model.knockAge < DoorNight.RULES.knockLead && !model.hand) speech = ['아래층', '…TV 소리가 뚝, 끊겼습니다.', '누군가, 소리를 듣고 있습니다.'];
    if (model.hand) speech = handSpeech();
    const key = speech.join('|');
    if (key !== lastSpeech) { $('location').textContent = speech[0]; $('subtitle').textContent = speech[1]; $('instruction').textContent = speech[2]; lastSpeech = key; }
    $('forceFeedback').hidden = !model.active() || !model.hand || model.handStage === 'released';
    const easing = model.gripStage === 'ease';
    $('forceBand').style.left = easing ? '16%' : '74%'; $('forceBand').style.width = easing ? '32%' : '22%';
    $('forceFill').style.transform = `scaleX(${model.force})`;
    $('forceFeedback').classList.toggle('too-loud', model.gripNoise > .45);
    $('forceCue').textContent = model.resumeGrace > 0 ? '손잡이를 다시 잡으세요' : model.handStage === 'retreat' ? '손이 빠진다 — 닫을 준비' : !model.held ? '손잡이를 잡고 → 밀기' : model.gripNoise > .52 ? '문이 운다 — ← 힘 줄이기' : easing ? '손이 느슨하다 — ← 힘 줄이기' : model.gripStage === 'push' ? '밀쳐온다 — → 더 밀기' : '손가락이 굳는다 — 밀 준비';
    $('handleHint').textContent = model.hand ? model.handStage === 'released' ? '오른쪽으로 → 닫기' : '누른 채 → 밀기 / ← 힘 빼기' : model.knock ? '움직이지 마세요' : ['recover', 'finish'].includes(model.phase) ? '손잡이를 놓으세요' : '누른 채 ← 열기';
    $('handleHint').hidden = !model.active(); handle.disabled = !model.active();
    $('objective').textContent = model.state === 'won' ? '문 너머 확인하기 — 완료' : model.knocksPassed ? '붙잡힌 문을 지키고, 닫으세요.' : '문 너머를 확인하고, 무사히 닫으세요.';
    if (model.state !== lastState) {
      lastState = model.state; resultAge = 0;
      if (['won', 'lost'].includes(model.state)) { release(); $('pause').disabled = true; }
    }
    if (['won', 'lost'].includes(model.state) && resultAge >= .95 && $('end').hidden) end();
  }
  function frame(now) {
    const dt = lastFrame ? Math.min(.08, (now - lastFrame) / 1000) : 0; lastFrame = now;
    model.update(dt); if (['won', 'lost'].includes(model.state)) resultAge += dt;
    const events = model.events.splice(0);
    if (audio) { for (const event of events) audio.event(event); audio.update(model); }
    render(); requestAnimationFrame(frame);
  }
  const sources = ['apartment.png', 'door.png', 'hand.png', 'hand-grip.png'];
  Promise.all(sources.map(src => new Promise((resolve, reject) => {
    const img = new Image(); img.onload = resolve; img.onerror = reject; img.src = `./assets/${src}`;
  }))).then(() => { assetsReady = true; $('start').disabled = false; $('loadStatus').textContent = '마우스 드래그 · 약 1분 · Esc 일시정지'; }).catch(() => {
    $('loadStatus').textContent = '그림을 불러오지 못했습니다. 페이지를 새로고침해 주세요.';
  });
  Object.defineProperty(window, 'doorPrototypeSnapshot', { get: () => model.snapshot() });
  render(); requestAnimationFrame(frame);
})();
