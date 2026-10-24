const {test} = require('node:test');
const assert = require('node:assert/strict');
const Door = require('../dist/horror/core.js');
function tick(m, seconds) { for(let t=0; t<seconds; t+=.02) m.update(.02); }
function move(m, p) { m.begin(); m.moveTo(p); m.release(); }
function firstKnock() { const m = new Door(); m.start(); tick(m,1.1); move(m,.3); tick(m,.04); assert.equal(m.phase,'knock1'); return m; }
function firstHand() { const m=firstKnock(); tick(m,3); assert.equal(m.phase,'open1'); move(m,.66); tick(m,.04); assert.equal(m.hand,true); return m; }
test('the complete two-threat sequence permits a defensive slam during a knock',()=>{
  const m=firstHand(); move(m,0); assert.equal(m.handsStopped,1); tick(m,2.5);
  assert.equal(m.phase,'reopen'); move(m,.55); tick(m,.04); assert.equal(m.phase,'knock2');
  tick(m,1.3); assert.equal(m.hand,true); move(m,0); assert.equal(m.phase,'settle');
  assert.equal(m.violation,0); assert.equal(m.state,'playing'); tick(m,5.2);
  assert.equal(m.state,'won'); assert.equal(m.knocksPassed,2); assert.equal(m.handsStopped,2);
});
test('holding the handle perfectly still counts as stopping for a knock',()=>{
  const m=firstKnock(); m.begin(); tick(m,3); assert.equal(m.held,true);
  assert.equal(m.knocksPassed,1); assert.equal(m.state,'playing');
});
test('sustained door travel after the knock reaction grace fails with a clear cause',()=>{
  const m=firstKnock(); tick(m,.9); move(m,.6);
  assert.equal(m.state,'lost'); assert.equal(m.reason,'knock'); assert.equal(m.held,false);
  const t=m.time,p=m.opening; tick(m,9); move(m,1); assert.equal(m.time,t); assert.equal(m.opening,p);
});
test('an ignored hand fails, and mere waiting cannot win',()=>{
  const m=firstHand(); tick(m,4.3); assert.equal(m.state,'lost'); assert.equal(m.reason,'hand');
  const idle=new Door(); idle.start(); tick(idle,90); assert.equal(idle.phase,'learn'); assert.notEqual(idle.state,'won');
});
test('pause freezes the deadline, releases input, and restart resets every encounter',()=>{
  const m=firstHand(); m.begin(); m.setPaused(true); const s=m.snapshot(); tick(m,20); m.moveTo(0);
  assert.deepEqual(m.snapshot(),s); assert.equal(m.held,false); m.setPaused(false); move(m,0);
  assert.equal(m.handsStopped,1); m.start();
  assert.equal(m.phase,'learn'); assert.equal(m.opening,0); assert.equal(m.hand,false); assert.equal(m.knock,false);
  assert.equal(m.handsStopped,0); assert.equal(m.knocksPassed,0); assert.equal(m.paused,false);
});
test('a blind slam cannot bypass the required stop and hand responses',()=>{
  const m=firstKnock(); move(m,0); tick(m,3); assert.equal(m.phase,'open1'); assert.equal(m.state,'playing');
  tick(m,20); assert.equal(m.state,'playing'); assert.equal(m.handsStopped,0);
});
