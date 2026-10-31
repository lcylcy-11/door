const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Loop = require('../dist/horror/loop.js');
const Art = require('../dist/horror/loop-art.js');
function tick(m, seconds, speed = 0, fps = 60) {
  const n = Math.ceil(seconds * fps), dt = seconds / n;
  for (let i = 0; i < n; i++) { if (speed) m.drag(speed * dt); m.update(dt); }
}
function at(room) { const m = new Loop(); m.room = room; m.enter(); return m; }
function trigger(m, fps = 60) { m.grip(); m.drag(m.rule.ambush ? .4 : .05); m.update(1 / fps); }
function rescue(m, fps = 60, reaction = .35) {
  const dt = 1 / fps;
  if (!m.tug) trigger(m, fps);
  assert.equal(m.tug, true); tick(m, reaction, 0, fps);
  for (let i = 0; i < fps * 15 && m.tug && m.state === 'playing'; i++) {
    m.grip(); if (m.tugPhase === 'pull' || m.tugPhase === 'ease') m.drag(-.42 * dt); m.update(dt);
  }
}
function solve(m, fps = 60) {
  const dt = 1 / fps;
  for (let step = 0; step < fps * 300 && !['won', 'lost'].includes(m.state); step++) {
    if (m.active()) {
      const r = m.rule;
      if (m.tug) { m.grip(); if (m.tugPhase === 'pull' || m.tugPhase === 'ease') m.drag(-.42 * dt); }
      else if (r.lock && !m.unlocked) { m.collect('key'); m.collect('note'); m.useLock(); }
      else if (r.code && !m.unlocked) { m.collect('code'); m.snapshot().codeDigits.forEach((v, i) => m.turnDial(i, v - m.dialValues[i])); m.confirmCode(); }
      else if (r.hinge && !m.unlocked) m.dragHardware(.2);
      else if (r.pick && !m.unlocked) { m.collect('pick'); m.setPickAngle(Loop.RULES.pickSweetspot); m.setTorque(true); }
      else if (r.breakable && !m.unlocked) { m.collect('club'); m.strike(); }
      else if (r.spy && !m.inspected) m.peek(true);
      else { if (m.peeking) m.peek(false); m.grip(); if (!m.occupied()) m.drag(.8 * dt); }
    }
    m.update(dt);
  }
  return m;
}

test('the ten-room order introduces mirrored control, separate hardware puzzles, and one mandatory ambush', () => {
  assert.deepEqual(Loop.ROOMS.map(r => r.id), ['ordinary','mirrored','keylock','shadow','combination','peephole','hinge','lockpick','ambush','barricade']);
  assert.equal(Loop.ROOMS[1].direction, 1); assert.ok(Loop.ROOMS.every((r,i) => i === 1 || r.direction === -1));
  assert.equal(Loop.ROOMS.some(r => r.fragile || r.hands), false);
});

test('the first two doors only require their own opening direction, with no speed or waiting conditions', () => {
  for (const room of [0,1]) for (const speed of [.08,2]) {
    const m = at(room); m.grip(); tick(m, 1 / speed, speed);
    assert.equal(m.state, 'crossing'); assert.equal(m.danger, 0); assert.equal(m.tug, false);
  }
  const source=fs.readFileSync(path.join(__dirname,'../dist/horror/loop.js'),'utf8');
  assert.doesNotMatch(source,/Math\.random|\bDate\b|\bperformance\b/);
});

test('the key is collected before the lock opens, is consumed once, and a locked pull is harmless', () => {
  const m=at(2);m.grip();tick(m,2,.8);assert.equal(m.open,0);assert.equal(m.danger,0);assert.equal(m.unlocked,false);
  assert.equal(m.useLock(),false);assert.equal(m.collect('key'),true);assert.equal(m.collect('key'),false);
  assert.equal(m.useLock(),true);assert.equal(m.useLock(),false);assert.equal(m.inventory.has('key'),false);
  assert.equal(m.snapshot().keyAvailable,false);tick(m,1.3,.8);assert.equal(m.state,'crossing');
  assert.equal(at(0).collect('key'),false);
});

test('collected items, optional notes and solved hardware survive retry without duplicating consumed keys', () => {
  const m=at(2);m.collect('key');m.collect('note');m.useLock();
  const inv=m.snapshot().inventory;assert.deepEqual(inv,['note']);assert.ok(Object.isFrozen(inv));assert.throws(()=>inv.push('key'),TypeError);
  m.state='lost';m.age=1;m.retry();assert.equal(m.unlocked,true);assert.equal(m.snapshot().keyAvailable,false);assert.ok(m.inventory.has('note'));
  m.room=6;m.enter();for(let i=0;i<4;i++)m.dragHardware(.25);assert.ok(m.inventory.has('pin'));m.enter();assert.equal(m.pinProgress,1);assert.equal(m.unlocked,true);
  m.start();assert.equal(m.inventory.size,0);assert.equal(m.room,0);
});

test('separate note pages accumulate in the three story rooms, survive retry and clear only on restart', () => {
  const m=at(2);assert.equal(m.snapshot().noteAvailable,true);assert.equal(m.collect('note'),true);assert.equal(m.collect('note'),false);
  assert.deepEqual(m.snapshot().notePages,[2]);assert.equal(m.snapshot().noteAvailable,false);
  m.room=6;m.enter();assert.equal(m.snapshot().noteAvailable,true);assert.equal(m.collect('note'),true);
  assert.deepEqual(m.snapshot().notePages,[2,6]);assert.deepEqual(m.snapshot().inventory,['note']);
  m.state='lost';m.age=1;m.retry();assert.deepEqual(m.snapshot().notePages,[2,6]);assert.equal(m.snapshot().noteAvailable,false);
  m.room=9;m.enter();assert.equal(m.snapshot().noteAvailable,true);assert.equal(m.collect('note'),true);assert.equal(m.collect('note'),false);
  const pages=m.snapshot().notePages;assert.deepEqual(pages,[2,6,9]);assert.ok(Object.isFrozen(pages));assert.throws(()=>pages.push(4),TypeError);
  m.room=4;m.enter();assert.equal(m.snapshot().noteAvailable,false);assert.equal(m.collect('note'),false);assert.equal(m.collect('code'),true);
  assert.deepEqual(m.snapshot().notePages,[2,6,9]);assert.deepEqual(m.snapshot().inventory,['note','code']);
  m.start();assert.deepEqual(m.snapshot().notePages,[]);assert.equal(m.inventory.has('note'),false);
});

test('the shadow must disappear before opening; a mistimed pull starts a readable rescue encounter', () => {
  const m=at(3);assert.equal(m.occupied(),true);trigger(m);assert.equal(m.tug,true);assert.equal(m.tugPhase,'windup');assert.equal(m.state,'playing');
  const quiet=at(3);tick(quiet,3.2);assert.equal(quiet.occupied(),false);quiet.grip();tick(quiet,1.5,.8);assert.equal(quiet.state,'crossing');
  const untouched=at(3);tick(untouched,30);assert.equal(untouched.state,'playing');assert.equal(untouched.tug,false);
});

test('the combination memo reveals a stable code and each dial wraps independently before confirmation', () => {
  const m=at(4);assert.deepEqual(m.snapshot().codeDigits,[3,1,7]);assert.equal(m.snapshot().codeAvailable,true);
  m.turnDial(0,3);m.turnDial(1,1);m.turnDial(2,-1);assert.deepEqual(m.dialValues,[3,1,9]);m.turnDial(2,8);assert.deepEqual(m.dialValues,[3,1,7]);
  assert.equal(m.confirmCode(),false);assert.equal(m.danger,0);m.collect('code');assert.equal(m.confirmCode(),true);assert.equal(m.snapshot().codeAvailable,false);
  m.grip();tick(m,1.3,.8);assert.equal(m.state,'crossing');
  const wrong=at(4);wrong.collect('code');assert.equal(wrong.confirmCode(),false);assert.equal(wrong.unlocked,false);assert.equal(wrong.danger,0);
  assert.equal(wrong.turnDial(99,1),false);assert.equal(wrong.turnDial(0,NaN),false);
});

test('unseen safe inspection mistakes stay harmless, and the peephole shows the real recurring patrol', () => {
  const m=at(5);assert.equal(m.rule.spy,true);assert.equal(m.rule.listen,true);tick(m,3.2);m.grip();tick(m,.1,.7);
  assert.ok(m.open<=.09);assert.equal(m.tug,false);assert.equal(m.danger,0);m.peek(true);tick(m,.7);assert.equal(m.inspected,true);assert.equal(m.held,false);
  m.peek(false);m.grip();tick(m,1.5,.8);assert.equal(m.state,'crossing');
  const returning=at(5);returning.peek(true);tick(returning,4);assert.equal(returning.inspected,true);returning.peek(false);tick(returning,4.3);trigger(returning);assert.equal(returning.tug,true);
});

test('vertical hinge extraction frees the door and collects the pin without an extra tool', () => {
  const m=at(6);assert.equal(m.collect('pin'),false);m.grip();tick(m,2,.8);assert.equal(m.open,0);assert.equal(m.danger,0);
  m.dragHardware(-.2);assert.equal(m.pinProgress,0);for(let i=0;i<3;i++)m.dragHardware(.25);assert.equal(m.unlocked,false);assert.equal(m.pinProgress,.75);
  m.dragHardware(.25);assert.equal(m.unlocked,true);assert.equal(m.pinProgress,1);assert.ok(m.inventory.has('pin'));assert.equal(m.snapshot().pinAvailable,false);
  assert.equal(m.dragHardware(.2),false);tick(m,1.3,.8);assert.equal(m.state,'crossing');
});

test('lockpicking gives continuous angle-dependent stops, springs back, and unlocks only under correct torque', () => {
  const m=at(7);assert.equal(m.setPickAngle(-.28),false);assert.equal(m.setTorque(true),false);m.collect('pick');
  m.setPickAngle(1);m.setTorque(true);tick(m,2);const far=m.barrel;assert.ok(far>0&&far<.4);assert.ok(m.pickStress>.8);assert.equal(m.unlocked,false);
  m.setTorque(false);tick(m,.4);assert.equal(m.barrel,0);assert.equal(m.pickStress,0);
  m.setPickAngle(0);m.setTorque(true);tick(m,2);assert.ok(m.barrel>far+.3);assert.equal(m.unlocked,false);
  m.setPickAngle(Loop.RULES.pickSweetspot);tick(m,2);assert.equal(m.unlocked,true);assert.equal(m.barrel,1);assert.equal(m.torque,false);assert.ok(m.inventory.has('pick'));
  m.grip();tick(m,1.3,.8);assert.equal(m.state,'crossing');
});

test('the golf club is the only way through the barricade and three spaced strikes break it', () => {
  const m=at(9);m.grip();tick(m,2,2);assert.equal(m.open,0);assert.equal(m.damage,0);assert.equal(m.danger,0);assert.equal(m.strike(),false);
  m.collect('club');assert.equal(m.strike(),true);assert.equal(m.damage,.34);assert.equal(m.strike(),false);tick(m,.4);m.strike();assert.equal(m.damage,.68);assert.equal(m.unlocked,false);
  tick(m,.4);m.strike();assert.equal(m.damage,1);assert.equal(m.unlocked,true);assert.equal(m.open,0);assert.equal(m.strike(),false);
  tick(m,1.3,.8);assert.equal(m.state,'crossing');tick(m,2.2);assert.equal(m.state,'won');assert.ok(m.inventory.has('club'));
});

test('ambush catches a normal opening even in a clear room and cannot be bypassed with a fast yank', () => {
  for(const delta of [.4,100]){const m=at(8);assert.equal(m.occupied(),false);m.open=.34;m.grip();m.drag(delta);m.update(1/60);assert.equal(m.tug,true);assert.equal(m.ambushTriggered,true);assert.equal(m.ambushDefeated,false);assert.equal(m.state,'playing');assert.ok(m.open<Loop.RULES.openAt);}
});

test('the ambush must be defeated, fully closed, and explicitly reopened before moving onward', () => {
  const m=at(8);rescue(m);assert.equal(m.tug,false);assert.equal(m.ambushTriggered,true);assert.equal(m.ambushDefeated,true);assert.equal(m.open,0);assert.equal(m.held,false);
  tick(m,3);assert.equal(m.state,'playing');m.grip();tick(m,1.3,.8);assert.equal(m.state,'crossing');assert.equal(m.tug,false);tick(m,2.2);assert.equal(m.room,9);
});

test('the fishing needle follows actual effort while phase targets move and remain reachable', () => {
  const m=at(8);trigger(m);tick(m,Loop.RULES.tugWindup);assert.equal(m.tugPhase,'pull');tick(m,.4,-.42);const pull=m.snapshot();
  assert.ok(pull.effort>=pull.targetMin&&pull.effort<=pull.targetMax);assert.ok(pull.resist>0);assert.ok(pull.targetMin<pull.targetMax);
  while(m.tugPhase==='pull')tick(m,1/60,-.42);const ease=m.snapshot();assert.equal(ease.tugPhase,'ease');assert.notEqual(ease.targetMin,pull.targetMin);assert.ok(ease.targetMin<.7&&ease.targetMax>.7);
  rescue(m);assert.equal(m.ambushDefeated,true);
});

test('moderate closing rescues both patrol mistakes and the forced ambush at several frame rates', () => {
  for(const fps of [30,60,120])for(const room of [3,5,8]){const m=at(room);rescue(m,fps,.35);assert.equal(m.state,'playing','room '+room+', fps '+fps);assert.equal(m.tug,false);assert.equal(m.open,0);assert.equal(m.tension,0);assert.ok(m.events.some(e=>e.type==='banish'));assert.ok(m.events.some(e=>e.type==='escaped'));}
});

test('windup cannot be skipped, and absent resistance, opening, or excessive yanking eventually loses', () => {
  const early=at(8);trigger(early);tick(early,Loop.RULES.tugWindup-.2,-2);assert.equal(early.tugPhase,'windup');assert.equal(early.tug,true);assert.ok(early.open>=.15);
  for(const speed of [0,.8,-2]){const m=at(8);trigger(m);tick(m,9,speed);assert.equal(m.state,'lost');assert.equal(m.reason,'tug');}
});

test('footstep pulses, silhouette occupation and the advance warning use the actual patrol clock', () => {
  const m=at(5);assert.ok(m.snapshot().noise>0);tick(m,1.8);assert.ok(m.events.filter(e=>e.type==='step').length>=2);tick(m,1.5);assert.equal(m.occupied(),false);assert.equal(m.snapshot().noise,0);
  m.events.length=0;tick(m,2);assert.ok(!m.events.some(e=>e.type==='step'));tick(m,2.3);assert.equal(m.snapshot().preReturn,true);assert.ok(m.events.some(e=>e.type==='return-warning'));tick(m,.8);assert.equal(m.occupied(),true);
});

test('pause freezes tug and torque, retry preserves inventory but resets the ambush attempt', () => {
  const m=at(8);trigger(m);tick(m,1.3,-.3);m.setPaused(true);const before=m.snapshot();tick(m,2);assert.deepEqual(m.snapshot(),before);m.setPaused(false);const clock=m.tugClock;tick(m,.4);assert.equal(m.tugClock,clock);
  m.grip();tick(m,10);assert.equal(m.state,'lost');tick(m,1);m.retry();assert.equal(m.room,8);assert.equal(m.tug,false);assert.equal(m.ambushTriggered,false);assert.equal(m.ambushDefeated,false);
  const pick=at(7);pick.collect('pick');pick.setTorque(true);pick.setPaused(true);assert.equal(pick.torque,false);assert.ok(pick.inventory.has('pick'));
});

test('the full ten-room route wins across frame rates without bypassing the forced ambush', () => {
  for(const fps of [30,60,120]){const m=solve(new Loop(),fps);assert.equal(m.state,'won','fps '+fps+', room '+m.room);assert.equal(m.room,9);assert.ok(m.inventory.has('pin'));assert.ok(m.inventory.has('code'));assert.ok(m.inventory.has('pick'));assert.ok(m.inventory.has('club'));}
});

test('door leaf transforms and their handle/peephole hit points stay consistent for sliding and hinged doors', () => {
  const left=Art.point('plain',0),right=Art.point('plain',0,true),g=Art.layout('plain');assert.ok(left.x>g.x+g.w*.8);assert.ok(right.x<g.x+g.w*.2);
  for(const type of Object.keys(Art.DOORS))for(const reverse of [false,true])for(const opening of [0,.2,.7,1]){
    const box=Art.layout(type),pose=Art.pose(type,opening,reverse),raw=pose.slice(pose.indexOf('(')+1,-1).trim().split(/[ ,]+/).map(Number);
    const affine=pose.startsWith('matrix')?raw:[1,0,0,1,raw[0],raw[1]];assert.equal(affine.length,6);assert.ok(affine.every(Number.isFinite));
    if(type!=='hinge')assert.doesNotMatch(pose,/scale|skew|matrix|rotate/);
    for(const spy of [false,true]){const start=Art.point(type,0,reverse,spy),pt=Art.point(type,opening,reverse,spy),x=start.x-box.x,y=start.y-box.y;assert.ok(Math.abs(pt.x-(affine[0]*x+affine[2]*y+affine[4]))<1e-8,type+' horizontal mismatch');assert.ok(Math.abs(pt.y-(affine[1]*x+affine[3]*y+affine[5]))<1e-8,type+' vertical mismatch');}
  }
});

test('pixel SVG rooms, nested portals, props and optical previews contain no raster assets or text', () => {
  const monochrome=/^(?:#000(?:000)?|#fff(?:fff)?|black|white|none|url\(#[^)]*\))$/i,defs=Art.defs();
  for(let i=0;i<=Loop.ROOMS.length;i++){
    const svg=defs+Art.room('a',i)+Art.room('n',Math.min(i+1,Loop.ROOMS.length))+Art.room('p',i,false)+Art.lens()+Art.grip('tugGhost');
    assert.doesNotMatch(svg,/NaN|undefined|Infinity|<text\b|<image\b|data:image|\.(?:png|jpe?g|webp|gif)\b/i);
    const ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]),unique=new Set(ids);assert.equal(unique.size,ids.length,'duplicate SVG id in room '+i);
    for(const ref of svg.matchAll(/url\(#([^)]+)\)|(?:href|xlink:href)="#([^"]+)"/g))assert.ok(unique.has(ref[1]||ref[2]),'missing SVG ref '+(ref[1]||ref[2]));
    for(const colour of svg.matchAll(/\b(?:fill|stroke|stop-color)="([^"]+)"/g))assert.match(colour[1],monochrome);
    assert.match(Art.room('index',i,false),new RegExp('data-room-index="'+i+'"'));
  }
  const html=fs.readFileSync(path.join(__dirname,'../dist/horror/index.html'),'utf8');assert.doesNotMatch(html,/<h[1-6]\b|<p\b|<footer\b|<header\b|<nav\b|<text\b/);
  assert.doesNotMatch(Art.room('exit',Loop.ROOMS.length),/id="exit(?:shadow|hands)"/);
});
