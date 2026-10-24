const {test} = require('node:test');
const assert = require('node:assert/strict');
const Door = require('../dist/horror/core.js');
function tick(m, seconds) { for(let t=0; t<seconds; t+=.02) m.update(.02); }
function move(m, p) { m.begin(); m.moveTo(p); m.release(); }
function firstKnock() { const m = new Door(); m.start(); tick(m,1.1); move(m,.3); tick(m,.04); assert.equal(m.phase,'knock1'); return m; }
function firstHand() { const m=firstKnock(); tick(m,3.8); assert.equal(m.phase,'open1'); move(m,.66); tick(m,.04); assert.equal(m.hand,true); return m; }
function resist(m) {
  m.begin();
  for(let t=0;t<19 && m.state==='playing' && m.handStage!=='released';t+=.02){
    m.setForce(m.gripStage==='ease' ? .32 : .84); m.update(.02);
  }
  assert.equal(m.state,'playing'); assert.equal(m.handStage,'released'); assert.ok(m.defended>=2);
  m.moveTo(0); m.release();
}
test('both telegraphed resistance encounters are winnable, including the knock overlap',()=>{
  const m=firstHand(); resist(m); assert.equal(m.handsStopped,1); tick(m,2.5);
  assert.equal(m.phase,'reopen'); move(m,.55); tick(m,.04); assert.equal(m.phase,'knock2');
  tick(m,2.3); assert.equal(m.hand,true); resist(m); assert.equal(m.phase,'settle');
  assert.equal(m.violation,0); assert.equal(m.state,'playing'); tick(m,6.1);
  assert.equal(m.state,'won'); assert.equal(m.knocksPassed,2); assert.equal(m.handsStopped,2);
});
test('holding the handle perfectly still counts as stopping for a knock',()=>{
  const m=firstKnock(); m.begin(); tick(m,3.8); assert.equal(m.held,true);
  assert.equal(m.knocksPassed,1); assert.equal(m.state,'playing');
});
test('sustained door travel after the knock reaction grace fails with a clear cause',()=>{
  const m=firstKnock(); tick(m,1.7); move(m,.6);
  assert.equal(m.state,'lost'); assert.equal(m.reason,'knock'); assert.equal(m.held,false);
  const t=m.time,p=m.opening; tick(m,9); move(m,1); assert.equal(m.time,t); assert.equal(m.opening,p);
});
test('an ignored hand fails, and mere waiting cannot win',()=>{
  const m=firstHand(); tick(m,6); assert.equal(m.state,'lost'); assert.equal(m.reason,'hand');
  const idle=new Door(); idle.start(); tick(idle,90); assert.equal(idle.phase,'learn'); assert.notEqual(idle.state,'won');
});
test('pause freezes the deadline, releases input, and restart resets every encounter',()=>{
  const m=firstHand(); m.begin(); m.setPaused(true); const s=m.snapshot(); tick(m,20); m.moveTo(0);
  assert.deepEqual(m.snapshot(),s); assert.equal(m.held,false); m.setPaused(false); resist(m);
  assert.equal(m.handsStopped,1); m.start();
  assert.equal(m.phase,'learn'); assert.equal(m.opening,0); assert.equal(m.hand,false); assert.equal(m.knock,false);
  assert.equal(m.handsStopped,0); assert.equal(m.knocksPassed,0); assert.equal(m.paused,false);
});
test('a blind slam cannot bypass the required stop and hand responses',()=>{
  const m=firstKnock(); move(m,0); tick(m,3.8); assert.equal(m.phase,'open1'); assert.equal(m.state,'playing');
  tick(m,20); assert.equal(m.state,'playing'); assert.equal(m.handsStopped,0);
});
test('one fast close, one giant pointer jump and a stale pointer delta cannot bypass the grip',()=>{
  const m=firstHand(); const before=m.opening; move(m,0); assert.equal(m.opening,before); assert.equal(m.handsStopped,0);
  m.begin(); m.drag(10); tick(m,.2); assert.ok(m.opening>.3); assert.equal(m.handsStopped,0);
  m.release(); tick(m,2.1); const pushed=m.opening; m.begin(); m.drag(.001); m.update(.02);
  assert.ok(Math.abs(m.opening-pushed)<.03); assert.equal(m.handsStopped,0);
});
test('no constant-force policy wins, and maximum force loses through noise rather than silent timeout',()=>{
  for(let force=0;force<=1.001;force+=.05){
    const m=firstHand(); m.begin(); m.setForce(force); tick(m,21);
    assert.equal(m.state,'lost',`constant force ${force}`); assert.equal(m.handsStopped,0);
  }
  const m=firstHand(); m.begin(); m.setForce(1); tick(m,15); assert.equal(m.reason,'strain');
});
test('release and pause erase force; a resumed grip has time to regrab',()=>{
  const m=firstHand(); m.begin(); m.setForce(.9); tick(m,.3); m.release();
  assert.equal(m.force,0); assert.equal(m.forceTarget,0); m.begin(); m.setForce(.8); m.setPaused(true);
  assert.equal(m.force,0); m.setPaused(false); const p=m.opening; tick(m,.5);
  assert.equal(m.opening,p); assert.ok(m.resumeGrace>0);
});
test('knock impacts follow the hush and freeze with the simulation clock',()=>{
  const m=firstKnock(); assert.ok(m.events.some(e=>e.type==='hush'));
  tick(m,.7); assert.equal(m.events.filter(e=>e.type==='knock-hit').length,0);
  m.setPaused(true); tick(m,2); assert.equal(m.events.filter(e=>e.type==='knock-hit').length,0);
  m.setPaused(false); tick(m,.4); assert.equal(m.events.filter(e=>e.type==='knock-hit').length,1);
  tick(m,1.5); assert.equal(m.events.filter(e=>e.type==='knock-hit').length,3);
});
