(function () {
  'use strict';
  const $ = id => document.getElementById(id), M = window.DoorLoop, Art = window.LoopArt;
  const model = new M(), scene = $('scene'), world = $('world'), handle = $('handle'), hole = $('peephole');
  const props = new window.LoopProps(model, Art, scene);
  props.beforeOpen = () => { release(); stopPeek(); };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, narrow = matchMedia('(max-width:600px)');
  const pointer = { id: null, x: 0, y: 0, lastX: 0, hole: null };
  const cam = { x: 0, w: 1600, W: 1, H: 1, left: 0, top: 0, scale: 1 };
  let ready = false, last = 0, roomDrawn = -1, lastState = '', sound = null, mute = false, scrapeAt = -10, walkStep = -1;
  let iconKind = '', gestureKind = '', keyboardMotion = 0;
  const rawAudio = window.RoomSound.prefetch();
  const smooth = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  function initAudio() {
    try { if (!sound) sound = new window.RoomSound(rawAudio); sound.sync(mute, model.paused); } catch { sound = null; }
  }
  function camera() {
    const rect = scene.getBoundingClientRect();
    Object.assign(cam, { W: rect.width, H: rect.height, left: rect.left, top: rect.top, x: narrow.matches ? 530 : 0, w: narrow.matches ? 720 : 1600 });
    cam.scale = Math.max(cam.W / cam.w, cam.H / 900);
    world.setAttribute('viewBox', `${cam.x} 0 ${cam.w} 900`);
  }
  function point(p) { return { x: (p.x - cam.x) * cam.scale + (cam.W - cam.w * cam.scale) / 2, y: p.y * cam.scale + (cam.H - 900 * cam.scale) / 2 }; }
  function hotspot(el, p, w, h) {
    const v = point(p); el.style.left = `${v.x}px`; el.style.top = `${v.y}px`;
    el.style.width = `${Math.max(44, w * cam.scale)}px`; el.style.height = `${Math.max(44, h * cam.scale)}px`;
  }
  function buildRoom() {
    roomDrawn = model.room;
    const g = Art.layout(model.rule.door);
    world.innerHTML = `${Art.defs()}<defs><mask id="roomShell" maskUnits="userSpaceOnUse" x="-30000" y="-30000" width="60000" height="60000"><rect x="-30000" y="-30000" width="60000" height="60000" fill="#fff"/><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="#000"/></mask><clipPath id="walkPortal" clipPathUnits="userSpaceOnUse"><rect id="walkAperture" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}"/></clipPath></defs>
      <g id="incomingClip" clip-path="url(#walkPortal)" visibility="hidden"><g id="incoming">${Art.room('n', model.room + 1, false)}</g></g><g id="outgoing">${Art.room('a', model.room)}<g clip-path="url(#aopening)">${Art.grip('tugFingers')}</g></g>
      <g id="woodChips" visibility="hidden">${Array.from({length:8},(_,i)=>`<rect id="chip${i}" x="-5" y="-8" width="${5+i%3*3}" height="${8+i%2*7}" fill="#fff" stroke="#000" stroke-width="2"/>`).join('')}</g>
      <g id="clubSwing" visibility="hidden" fill="#fff"><path d="M1334 910h12L1124 448h-12Z"/><path d="M1084 421h62v27h-62Z" stroke="#000" stroke-width="4"/><path d="M1310 852h18l26 59h-18Z" fill="#000" stroke="#fff" stroke-width="3"/></g>
      <g id="lens" opacity="0"><rect x="-2000" y="-1500" width="5600" height="3900" fill="#000"/>
        ${Art.lens()}
        <g clip-path="url(#lensCircle)"><g id="lensRoom" transform="translate(191 153) scale(.645)">${Art.room('p', model.room + 1, false)}</g>
          ${Art.silhouette('visitorBody')}</g>
        <g id="lensReady" fill="none" stroke="#fff" stroke-width="8"><path d="M600 316v-32h32m336 0h32v32m0 268v32h-32m-336 0h-32v-32"/></g>
      </g>`;
    $('apresence').innerHTML = `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="url(#dot25)"/>${Art.silhouette('tugGhost')}`;
    iconKind = ''; gestureKind = ''; walkStep = -1;
  }
  function release() {
    if (pointer.id !== null && handle.hasPointerCapture(pointer.id)) handle.releasePointerCapture(pointer.id);
    pointer.id = null; model.release(); keyboardMotion = 0; scene.classList.remove('dragging');
  }
  function stopPeek() {
    if (pointer.hole !== null && hole.hasPointerCapture(pointer.hole)) hole.releasePointerCapture(pointer.hole);
    pointer.hole = null; model.peek(false);
  }
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !ready || !model.grip()) return;
    e.preventDefault(); initAudio(); pointer.id = e.pointerId; pointer.x = pointer.lastX = e.clientX; pointer.y = e.clientY;
    handle.setPointerCapture(e.pointerId); scene.classList.add('dragging');
  });
  handle.addEventListener('pointermove', e => {
    if (e.pointerId !== pointer.id) return;
    const dx = e.clientX - pointer.lastX; pointer.lastX = pointer.x = e.clientX; pointer.y = e.clientY;
    if (model.rule.door === 'hinge') {
      const g=Art.layout('hinge'), start=Art.point('hinge',0), current=Art.point('hinge',model.open);
      const cosine=Math.max(Math.cos(1.25),Math.min(1,(current.x+dx/cam.scale-g.x)/(start.x-g.x)));
      model.drag(Math.acos(cosine)/1.25-model.open);
    } else model.drag(model.rule.direction * dx / (cam.scale * Art.layout(model.rule.door).travel));
  });
  handle.addEventListener('pointerup', e => { if (e.pointerId === pointer.id) release(); });
  handle.addEventListener('pointercancel', release);
  handle.addEventListener('lostpointercapture', () => { if (pointer.id !== null) { pointer.id = null; model.release(); scene.classList.remove('dragging'); } });
  hole.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !model.peek(true)) return;
    e.preventDefault(); initAudio(); release(); pointer.hole = e.pointerId; hole.setPointerCapture(e.pointerId);
  });
  hole.addEventListener('pointerup', stopPeek); hole.addEventListener('pointercancel', stopPeek);
  hole.addEventListener('lostpointercapture', () => { if (pointer.hole !== null) { pointer.hole = null; model.peek(false); } });
  scene.addEventListener('pointerdown', e => {
    if (!ready || e.button !== 0) return;
    initAudio();
    if (['lost', 'won'].includes(model.state)) { e.stopPropagation(); model.retry(); return; }
    if (model.paused) { model.setPaused(false); last = performance.now(); }
  }, true);
  scene.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (!ready) return;
    if (e.key === 'Escape') { e.preventDefault(); if (!e.repeat) { release(); stopPeek(); model.setPaused(!model.paused); initAudio(); last = performance.now(); } return; }
    if (['lost', 'won'].includes(model.state) && e.key === 'Enter') { e.preventDefault(); model.retry(); return; }
    if (e.code === 'KeyM' && !e.repeat) { mute = !mute; initAudio(); return; }
    if (e.code === 'KeyP' && !e.repeat) { e.preventDefault(); model.peek(!model.peeking); initAudio(); return; }
    if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); if (document.activeElement === hole) model.peek(!model.peeking); else if (model.held) release(); else model.grip(); initAudio(); return; }
    if (e.key === ' ') { e.preventDefault(); release(); stopPeek(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); if (!model.held) model.grip();
      keyboardMotion = (e.key === 'ArrowLeft' ? -1 : 1) * model.rule.direction * (model.tug ? .42 : model.rule.fragile ? .18 : .6); initAudio();
    }
  });
  document.addEventListener('keyup', e => { if (e.key.startsWith('Arrow')) keyboardMotion = 0; });
  function suspend() { release(); stopPeek(); model.setPaused(true); if (sound) sound.sync(mute, true); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
  window.addEventListener('blur', suspend);
  window.addEventListener('resize', () => { camera(); release(); stopPeek(); });
  function cueIcon(kind) {
    if (kind === iconKind) return; iconKind = kind;
    const svg = kind === 'glass' ? '<path d="M5 2h14v20H5ZM13 2v5H9v4h5v5h-4v6"/>' : kind === 'hands' ? '<path d="M5 14V7h3V3h3v8h2V2h3v9h2V5h3v12h-3v4H8v-3H5l-3-4v-3h3Z"/>' : '<path d="M2 10h3V7h4V5h6v2h4v3h3v4h-3v3h-4v2H9v-2H5v-3H2Z"/><path d="M10 9h4v6h-4Z" fill="#fff"/>';
    $('meterIcon').innerHTML = '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter">' + svg + '</g>';
  }
  function gesture(s, hp, pp) {
    const r = model.rule, inspect = r.spy && !s.inspected && !s.tug, close = (r.hands && !s.released) || s.tug;
    const retry = (s.state === 'lost' && s.age > 1.5) || (s.state === 'won' && s.age > 2);
    const waiting = (r.watch || r.listen) && s.occupied && !s.tug;
    const propHint = props.hint(s);
    const kind = retry ? 'retry' : propHint ? propHint.kind : inspect ? 'peek' : close ? 'close' : waiting ? 'wait' : r.direction === 1 ? 'right' : 'left';
    const el = $('gesture'), anchor = retry ? { x: cam.W / 2, y: cam.H / 2 } : point(propHint ? propHint.point : inspect ? pp : hp), dir = close ? -r.direction : r.direction;
    const visible = !props.panel && (retry || (model.active() && s.tug && s.tugPhase !== 'retreat' && !s.held) || (model.active() && !s.held && !s.peeking && s.idle > 1.6 && (!s.moved || inspect || close || waiting || propHint || s.open < .15)));
    el.style.opacity = visible ? '1' : '0'; el.style.left = anchor.x + 'px'; el.style.top = anchor.y + 'px';
    if (kind !== gestureKind) {
      gestureKind = kind;
      if (inspect) el.innerHTML = '<path d="M-24-8h8v-8h32v8h8V8h-8v8h-32V8h-8Z" fill="#000" stroke="#fff" stroke-width="3"/><path d="M-4-6H4V6H-4Z" fill="#fff"/><path id="tapPulse" d="M-30-24v-6h6m48 0h6v6m0 48v6h-6m-48 0h-6v-6" fill="none" stroke="#fff" stroke-width="3"/>';
      else if (propHint) el.innerHTML = kind === 'up' ? '<g transform="translate(16 20) scale(.6)">' + Art.hand + '</g><path d="M-16 25v-50m-9 9 9-9 9 9" stroke="#fff" stroke-width="3" fill="none"/>' : '<g transform="scale(.7)">' + Art.hand + '</g><path id="tapPulse" d="M-28-25v-8h8m35 0h8v8m0 37v8h-8m-35 0h-8v-8" stroke="#fff" stroke-width="3" fill="none"/>';
      else if (waiting) el.innerHTML = '<g transform="scale(.8)">' + Art.hand + '</g><path d="M-26 34h52M-26 40h52" fill="none" stroke="#fff" stroke-width="3"/>';
      else if (retry) el.innerHTML = '<path d="M-21-15h30v6h9v24H0v-6h12V-3H-9V6h-18v-27h6Z" fill="#fff" stroke="#000" stroke-width="2"/>';
      else el.innerHTML = '<g id="ghostHand">' + Art.hand + '</g><path d="M' + (dir*17) + ' -32h' + (dir*31) + 'm' + (-dir*10) + '-9 ' + (dir*10) + ' 9 ' + (-dir*10) + ' 9" stroke="#fff" fill="none" stroke-width="3"/>';
    }
    const ghost = $('ghostHand');
    if (ghost) { const motion = reduced ? 0 : Math.round(dir * (r.fragile ? 9 : 22) * Math.sin(s.time * (r.fragile ? 1.2 : 2.3)) / 4) * 4; ghost.setAttribute('transform', 'translate(' + motion + ' 0) scale(.8)'); }
    const pulse = $('tapPulse'); if (pulse) pulse.setAttribute('visibility', reduced || Math.sin(s.time * 2) > -.4 ? 'visible' : 'hidden');
  }
  function meter(s, hp) {
    const r = model.rule, el = $('meter');
    el.hidden = !(model.active() && (s.held || s.tug) && !s.peeking && (s.tug || r.fragile || r.watch || r.spy || (r.hands && !s.released)));
    if (el.hidden) return;
    const kind = s.tug || (r.hands && !s.released) ? 'hands' : r.fragile ? 'glass' : 'eye'; cueIcon(kind);
    const value = s.tug ? s.effort : kind === 'hands' ? s.press / M.RULES.press : kind === 'glass' ? Math.min(1, s.speed) : s.danger;
    $('meterFill').style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`;
    $('safeBand').hidden = !s.tug && kind !== 'glass';
    $('safeBand').style.left = s.tug ? `${s.targetMin*100}%` : '0'; $('safeBand').style.width = s.tug ? `${(s.targetMax-s.targetMin)*100}%` : '27%';
    el.classList.toggle('warning', s.danger > .3 || !!s.blocked);
    el.setAttribute('aria-valuenow', Math.round(Math.max(0, Math.min(1, value)) * 100));
    const p = pointer.id !== null ? { x: pointer.x - cam.left, y: pointer.y - cam.top } : point(hp);
    const w = el.offsetWidth, h = el.offsetHeight, pad = 12, gap = 24;
    let x = p.x + gap, y = p.y + gap;
    if (x + w > cam.W - pad) x = p.x - w - gap;
    if (y + h > cam.H - pad) y = p.y - h - gap;
    el.style.left = `${Math.max(pad, Math.min(x, cam.W - w - pad))}px`; el.style.top = `${Math.max(pad, Math.min(y, cam.H - h - pad))}px`;
  }
  function render() {
    if (roomDrawn !== model.room) buildRoom();
    const s = model.snapshot(), r = model.rule, reverse = r.direction === 1;
    camera();
    const geometry = Art.layout(r.door);
    const tremble = r.fragile && !reduced ? Math.sin(s.time * 82) * s.danger * 2 : 0;
    $('aleaf').setAttribute('transform', Art.pose(r.door, s.open, reverse) + (tremble ? ` translate(${tremble} 0)` : ''));
    $('aleaf').style.filter = '';
    const cracks = $('aliveCracks'); if (cracks) cracks.setAttribute('visibility', s.danger > .12 ? 'visible' : 'hidden');
    const hp = Art.point(r.door, s.open, reverse), pp = Art.point(r.door, s.open, reverse, true);
    hotspot(handle, hp, 83, 132); hotspot(hole, pp, 58, 58);
    handle.disabled = !ready || !model.active() || s.peeking || !!props.panel;
    hole.hidden = !(r.spy && model.active());
    if (s.peeking) { hole.style.left = '50%'; hole.style.top = '50%'; hole.style.width = '100%'; hole.style.height = '100%'; }
    const shadow = $('ashadow');
    if (shadow) {
      const phase = s.patrolPhase / M.RULES.occupied;
      shadow.setAttribute('opacity', s.occupied ? 1 : 0);
      // The silhouette stays inside the pane for the entire dangerous interval.
      shadow.setAttribute('transform', `translate(${geometry.w * (.34 + Math.min(1, phase) * .32)} ${geometry.h * .53}) scale(1.35)`);
    }
    if ($('ahands')) { $('ahands').setAttribute('transform', `translate(${105 * (1 - s.handFade)} 0)`); $('ahands').setAttribute('opacity', s.handFade); }
    const flicker = r.listen ? (s.noise > .7 ? .35 : 0) : model.room >= 2 && !reduced ? Math.max(0, Math.sin(s.time * 6.7) - .92) * (1.5 + model.room * .2) : 0;
    const floor = $('asignalFloor');
    floor.setAttribute('opacity', (r.listen && s.noise > .35) || s.preReturn ? 1 : 0);
    floor.setAttribute('transform', `translate(0 ${Math.round(s.noise * 4)})`);
    const activeGhost = s.tug && s.state === 'playing', retreat = s.tugPhase === 'retreat' ? s.tugPhaseProgress : 0;
    $('apresence').setAttribute('visibility', activeGhost ? 'visible' : 'hidden');
    const ghost = $('tugGhost'); ghost.setAttribute('opacity', '1');
    ghost.setAttribute('transform', `translate(${reverse ? geometry.x + 50 : geometry.right - 50} ${geometry.y + geometry.h * .61}) scale(${1.3 - retreat * .7})`);
    const fingers = $('tugFingers'), edge = reverse ? geometry.x + geometry.travel * s.open : geometry.right - geometry.travel * s.open;
    const tugShake = !reduced && s.tugPhase === 'pull' ? Math.round(Math.sin(s.time * 37) * 3) : 0;
    fingers.setAttribute('opacity', activeGhost ? 1 : 0);
    fingers.setAttribute('transform', `translate(${edge + tugShake + (reverse ? -1 : 1) * retreat * 90} ${hp.y}) scale(${(reverse ? -1 : 1) * (1 - retreat * .5)} ${s.tugPhase === 'ease' ? .83 : 1})`);
    $('alampFlicker').setAttribute('opacity', flicker);
    $('lens').setAttribute('opacity', s.peeking ? 1 : 0); scene.classList.toggle('peeking', s.peeking);
    const visitor = $('visitorBody'), phase = s.patrolPhase / M.RULES.occupied;
    visitor.setAttribute('opacity', s.occupied ? 1 : 0);
    $('lensReady').setAttribute('visibility', s.inspected ? 'visible' : 'hidden');
    visitor.setAttribute('transform', `translate(${550 + phase * 500} 469) scale(1.35)`);
    // A single spatial camera crosses the aperture. The next room is behind a portal,
    // and is never dissolved over the current room. The final pose is exactly identity.
    const p = s.state === 'won' ? 1 : s.transition;
    const outgoing = $('outgoing'), incoming = $('incoming'), incomingClip = $('incomingClip');
    if (s.state === 'crossing' || s.state === 'won') {
      const walk = smooth(p), zoom = 1 / (1 - .97 * walk), nextScale = .5 / (1 - .5 * walk);
      const center = cam.x + cam.w / 2, doorX = geometry.x + geometry.w / 2, doorY = geometry.y + geometry.h / 2;
      const focusX = doorX + (center - doorX) * walk, focusY = doorY + (450 - doorY) * walk;
      const bob = reduced ? 0 : Math.round(Math.sin(p * Math.PI * 10) * 4 * Math.sin(p * Math.PI));
      const sway = reduced ? 0 : Math.round(Math.sin(p * Math.PI * 5) * 2 * Math.sin(p * Math.PI));
      const tx = focusX - doorX * zoom + sway, ty = focusY - doorY * zoom + bob;
      outgoing.setAttribute('transform', 'translate(' + tx + ' ' + ty + ') scale(' + zoom + ')');
      outgoing.setAttribute('mask', 'url(#roomShell)');
      incomingClip.setAttribute('visibility', 'visible');
      const aperture = $('walkAperture');
      aperture.setAttribute('x', geometry.x * zoom + tx); aperture.setAttribute('y', geometry.y * zoom + ty);
      aperture.setAttribute('width', geometry.w * zoom); aperture.setAttribute('height', geometry.h * zoom);
      incoming.setAttribute('transform', 'translate(' + (focusX * (1 - nextScale) + sway) + ' ' + (focusY - 450 * nextScale + bob) + ') scale(' + nextScale + ')');
    } else {
      outgoing.setAttribute('transform', ''); outgoing.removeAttribute('mask'); incomingClip.setAttribute('visibility', 'hidden');
    }
    const lost = s.state === 'lost';
    $('danger').style.opacity = (lost || (s.danger > .12 && (reduced || Math.sin(s.time * 9) > 0))) ? '1' : '0';
    $('danger').style.setProperty('--pressure', Math.round((lost ? .13 : s.danger * .1) * cam.W / 4) * 4 + 'px');
    $('blackout').style.opacity = !ready || (lost && s.age > .9) ? '1' : '0';
    scene.classList.toggle('paused', s.paused); scene.classList.toggle('lost', lost);
    props.render(s, cam, point, hotspot);
    $('clubSwing').setAttribute('visibility', r.breakable && s.strikeAge < .42 ? 'visible' : 'hidden');
    $('clubSwing').setAttribute('transform', `rotate(${-55 * Math.sin(Math.min(1,s.strikeAge/.42)*Math.PI)} 1340 900)`);
    const chipsOn=r.breakable&&s.strikeAge<.65&&!reduced;
    $('woodChips').setAttribute('visibility',chipsOn?'visible':'hidden');
    if(chipsOn)for(let i=0;i<8;i++){
      const age=s.strikeAge,x=900+(i-3.5)*age*115,y=460-age*(110+i%3*40)+age*age*640;
      $(`chip${i}`).setAttribute('transform',`translate(${Math.round(x/2)*2} ${Math.round(y/2)*2}) rotate(${i*37+age*260})`);
    }
    gesture(s, hp, pp); meter(s, hp);
    Object.assign(scene.dataset, { room: String(s.room), door: r.door, rule: s.id, state: s.state, occupied: String(s.occupied), inspected: String(s.inspected), hands: s.released ? 'clear' : 'holding', peeking: String(s.peeking), paused: String(s.paused), opening: s.open.toFixed(3), tug: String(s.tug), tugPhase: s.tugPhase, tension: s.tension.toFixed(3), noise: s.noise.toFixed(3), returning: String(s.preReturn) });
  }
  function audioEvents(events, s) {
    if (!sound) return;
    for (const e of events) {
      if (e.type === 'cross') { sound.play('rear-floor-creak', .22, { rate: .8 }); sound.play('door-scrape', .17); }
      else if (e.type === 'enter') sound.play('latch-click', .11);
      else if (e.type === 'glass') sound.play('latch-rattle', .22);
      else if (['watched', 'unseen', 'fingers'].includes(e.type)) sound.play('knock-wood', .35, { rate: .75 });
      else if (e.type === 'withdraw') sound.play('door-scrape', .18, { rate: .6 });
      else if (e.type === 'lose') { sound.play('knock-wood', .7, { rate: .55 }); sound.play('breath-near', .35); }
      else if (e.type === 'clear') sound.play('latch-click', .08);
      else if (e.type === 'step') sound.play('rear-floor-creak', .24, { rate: .65 });
      else if (e.type === 'return-warning') sound.play('rear-floor-creak', .1, { rate: .55 });
      else if (e.type === 'caught') { sound.play('knock-wood', .45, { rate: .6 }); sound.play('breath-near', .25); }
      else if (e.type === 'tug-pull') { sound.play('door-scrape', .32, { rate: .7 }); sound.play('knock-wood', .2, { rate: .65 }); }
      else if (e.type === 'tug-ease') sound.play('door-scrape', .12, { rate: .5 });
      else if (e.type === 'banish') sound.play('knock-wood', .3, { rate: .85 });
      else if (e.type === 'escaped') sound.play('door-scrape', .1, { rate: .6 });
      else if (e.type === 'pickup') sound.play('latch-click', .13);
      else if (['unlock','code-unlocked','pick-unlocked','pin-freed'].includes(e.type)) sound.play('latch-click', .3);
      else if (e.type === 'dial') sound.play('latch-click', .08, { rate: 1.3 });
      else if (e.type === 'strike') { sound.play('knock-wood', .7, { rate: .6 }); sound.play('latch-rattle', .3); }
      else if (e.type === 'door-broken') sound.play('drawer-thud', .7, { rate: .7 });
    }
    if (s.held && s.speed > .04 && model.total - scrapeAt > .6) { sound.play('door-scrape', .035 + s.danger * .08, { rate: .65 + Math.min(.7, s.speed) }); scrapeAt = model.total; }
    if (s.state === 'crossing') {
      const step = Math.floor(s.transition * 5);
      if (step !== walkStep) { walkStep = step; sound.play('rear-floor-creak', .13, { rate: step % 2 ? .9 : 1.05 }); }
    }
    sound.setBeds({ room: .1, tv: 0, strain: s.tug ? s.danger * .15 : 0, tension: s.tug ? .15 + s.danger * .3 : 0 });
  }
  function frame(now) {
    const dt = last ? Math.min(.08, (now - last) / 1000) : 0; last = now;
    if (ready && keyboardMotion && model.active() && model.held) model.drag(keyboardMotion * dt);
    if (ready) model.update(dt);
    const s = model.snapshot();
    if (s.state !== lastState) { if (!model.active()) { release(); stopPeek(); } lastState = s.state; }
    audioEvents(model.events.splice(0), s); render(); requestAnimationFrame(frame);
  }
  // Artwork is SVG geometry: no image download or raster preprocessing blocks play.
  ready = true; last = performance.now(); model.start();
  render(); handle.focus({ preventScroll: true }); requestAnimationFrame(frame);
})();
