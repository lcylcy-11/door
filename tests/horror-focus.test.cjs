const {test}=require('node:test');
const assert=require('node:assert/strict');
const Night=require('../dist/horror/night.js');
const C=require('../dist/horror/captions.js');
const T=Night.T;
function tick(m,seconds,policy,dt=1/60){for(let i=0;i<Math.ceil(seconds/dt)&&m.active();i++){if(policy)policy(m,dt);m.update(dt);}}
function resist(m){if(!m.held)m.grip();if(m.handStage==='grip'){const target=m.gripStage==='ease'?.32:.84;m.drag(0,-(target-m.forceTarget)/T.hand.forceGain);}}
function run({dt=1/60,delay=0,noGaze=false,ignoreHand=false,record}={}){
  const m=new Night();m.start();const events=[],hist=[];
  for(let t=0;t<90&&m.state==='playing';t+=dt){
    hist.push(m.snapshot());if(hist.length>Math.max(1,Math.round(delay/dt)))hist.shift();const s=hist[0];
    if(s.beat==='C1'){if(!m.held)m.grip();m.drag(.045*dt);}
    if(s.beat==='C3'&&s.hand&&!ignoreHand){if(!m.held)m.grip();if(s.handStage==='grip'){const target=s.gripStage==='ease'?.32:.84;m.drag(0,-(target-m.forceTarget)/T.hand.forceGain);}}
    if(s.beat==='C4'){m.setGaze(!noGaze);if(!m.held)m.grip();m.drag(-(s.band==='stiff'?.045:.17)*dt);if(s.flush)m.letGo();}
    if(s.beat==='F3')m.grabBolt();
    m.update(dt);events.push(...m.events.splice(0));if(record)record(m.snapshot());
  }
  return {m,events};
}
test('one compact round has only opening, blackout, one hand, blind closing and a single lock',()=>{
  assert.deepEqual(Night.BEATS,['C1','C2','C3','C4','F3','END']);
  const {m,events}=run();assert.equal(m.state,'won');assert.ok(m.time<50&&m.time>20,`duration ${m.time}`);
  assert.equal(events.filter(e=>e.type==='scratch').length,1);assert.equal(events.filter(e=>e.type==='latch-click').length,1);
  assert.deepEqual(events.filter(e=>e.type==='beat').map(e=>e.beat),Night.BEATS);
  for(const event of events)assert.doesNotMatch(event.type,/mimic|wedge|drawer|^pull$|shoves/);
});
test('slow opening remains safe with no outside sound at all',()=>{
  const m=new Night();m.start();m.startProgram(1000);m.grip();
  tick(m,12,(m,dt)=>{if(m.beat==='C1')m.drag(.045*dt);});
  assert.equal(m.state,'playing');assert.ok(['C2','C3'].includes(m.beat));assert.ok(m.A<.01);
});
test('rushing the stiff rail is dangerous, while the identical covered move is safe',()=>{
  function cross(cover){const m=new Night();m.start();m.o=.145;m.flush=false;m.preview=0;m.startProgram(1000);if(cover)m.spawn('elevator',{t:3,hold:100});m.grip();tick(m,3,(m,dt)=>m.drag(.12*dt));return m;}
  assert.equal(cross(false).reason,'noise');const quiet=cross(true);assert.equal(quiet.state,'playing');assert.ok(quiet.A<.01);
});
test('stopping immediately halts the door and quiet recovers attention promptly',()=>{
  const m=new Night();m.start();m.startProgram(1000);m.grip();m.drag(.05);m.update(1/60);const at=m.o;m.A=.5;m.lastGain=m.time;
  tick(m,3);assert.equal(m.o,at);assert.ok(m.A<.4);
});
test('telegraphed hand can be resisted; maximum force and no resistance both lose',()=>{
  for(const kind of ['good','max','none']){const m=new Night();m.start('C3');tick(m,22,(m)=>{if(m.beat==='C4'&&kind==='good')m.setGaze(true);if(m.hand&&kind==='good')resist(m);else if(m.hand&&kind==='max'){m.grip();if(m.handStage==='grip')m.drag(0,-1);}});
    if(kind==='good'){assert.equal(m.state,'playing');assert.ok(['C4','F3'].includes(m.beat));}
    else assert.equal(m.reason,kind==='max'?'strain':'hand');
  }
});
test('hand warning precedes strain failure and only one encounter exists',()=>{
 const m=new Night();m.start('C3');const ev=[];for(let i=0;i<1200&&m.active();i++){if(m.hand){m.grip();m.drag(0,-1);}m.update(1/60);ev.push(...m.events.splice(0));}
 assert.equal(m.reason,'strain');assert.ok(ev.findIndex(e=>e.type==='strain-warning')<ev.findIndex(e=>e.type==='lose'));
});
test('ignoring the eyes loses, but looking down while closing wins',()=>{
  assert.equal(run({noGaze:true}).m.reason,'eyes');assert.equal(run().m.state,'won');
});
test('eyes cannot be waited out by looking down without closing the door',()=>{
  const m=new Night();m.start('C4');m.grip();m.setGaze(true);tick(m,16);
  assert.equal(m.state,'playing');assert.equal(m.beat,'C4');assert.equal(m.eyes,'open');
});
test('one click locks only a fully shut, released door and completes the ending',()=>{
  const m=new Night();m.start();assert.equal(m.grabBolt(),false);m.start('F3');m.grip();assert.equal(m.grabBolt(),false);m.letGo();assert.equal(m.grabBolt(),true);assert.equal(m.beat,'END');assert.equal(m.b,1);tick(m,3);assert.equal(m.state,'won');
});
test('retired tools are inaccessible and do not interrupt the retained controls',()=>{
  for(const cp of ['C1','C3','C4','F3']){const m=new Night();m.start(cp);assert.equal(m.canWedge(),false);assert.equal(m.canSwitch(),false);assert.equal(m.canTurn(),false);assert.equal(m.toggleWedge(),false);assert.equal(m.setTurn(true),false);assert.equal(m.prop,false);}
});
test('looking down is contextual and never leaves the lock or ending in the gaze mode',()=>{
  const m=new Night();m.start();m.setGaze(true);assert.equal(m.gazeDown,false);m.start('C4');m.setGaze(true);assert.equal(m.gazeDown,true);m.start('F3');m.setGaze(true);assert.equal(m.gazeDown,false);m.grabBolt();m.setGaze(true);assert.equal(m.gazeDown,false);
});
test('checkpoint retry restores the encounter and preserves user feedback',()=>{
  const {m}=run({ignoreHand:true});assert.equal(m.reason,'hand');m.retry();assert.equal(m.beat,'C3');assert.equal(m.state,'playing');assert.ok(m.A<=.3);assert.equal(m.o,.5);
});
test('pause freezes each retained threat and restart removes old inputs',()=>{
  for(const cp of ['C1','C3','C4']){const m=new Night();m.start(cp);tick(m,2);m.setPaused(true);const before=m.snapshot();m.update(.08);assert.deepEqual(m.snapshot(),before);m.start();assert.equal(m.beat,'C1');assert.equal(m.A,0);assert.equal(m.held,false);}
});
test('same retained sequence is winnable across frame rates and human reaction delay',()=>{
  for(const dt of [1/30,1/60,1/144])assert.equal(run({dt}).m.state,'won');
  assert.equal(run({delay:.25}).m.state,'won');
});
test('sound and visual captions cover every emitted signal without obsolete instructions',()=>{
  const {events}=run();for(const e of events){const spec=C.EVENTS[e.type];if(spec?.sound)assert.ok(spec.text&&spec.loc&&spec.visual,`missing sound twin ${e.type}`);}
  const m=new Night();for(const cp of ['C1','C3','C4','F3']){m.start(cp);assert.doesNotMatch(C.line(m.snapshot(),'hold').join(' '),/슬리퍼|서랍|걸림쇠|노크와 노크/);}
});
test('sound streams match judged masking level and remain mute-independent',()=>{
  const m=new Night();m.start();m.spawn('elevator',{t:3,hold:100});m.update(1/60);const view=m.soundState(),s=m.snapshot().sources[0];assert.ok(Math.abs(view.streams.elevator.gain/T.masks.base.elevator-s.e)<1e-8);assert.equal(m.covered,true);
});
test('random input cannot escape bounds, produce invalid numbers, or revive removed phases',()=>{
  for(let seed=1;seed<=120;seed++){let n=seed;const rand=()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);const m=new Night();m.start(['C1','C3','C4'][seed%3]);
    for(let i=0;i<360&&m.active();i++){if(rand()<.07)m.grip();if(rand()<.04)m.letGo();m.setGaze(rand()<.4);m.drag((rand()-.5)*.1);m.update(1/60);assert.ok(m.o>=0&&m.o<=1);assert.ok(m.A>=0&&m.A<=1);assert.ok(Number.isFinite(m.force));assert.ok(Night.BEATS.includes(m.beat));m.events.splice(0);}
  }
});
