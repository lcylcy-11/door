const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base = path.resolve(__dirname, '../dist/2d');
const QuietNight = require(path.join(base, 'core.js'));
const QuietPath = require(path.join(base, 'paths.js'));
const QuietSVG = require(path.join(base, 'svg-surface.js'));
const QuietArt = require(path.join(base, 'art.js'));

function tick(model, seconds, before) {
  for (let t = 0; t < seconds; t += .02) { if (before) before(t); model.update(.02); }
}

test('all four paths are traversable and reject future-node jumps', () => {
  for (let i = 0; i < 4; i++) {
    const c = new QuietPath.PathController(i), seen = new Set();
    const jump = c.move(c.route.points.at(-1).x, c.route.points.at(-1).y);
    assert.equal(jump.contact, true); assert.equal(c.distance, 0);
    for (const s of c.route.segments) {
      seen.add(s.zone.id); const n = Math.ceil(s.length / 4);
      for (let k = 1; k <= n; k++) assert.equal(c.move(s.a.x+s.dx*k/n, s.a.y+s.dy*k/n).contact, false);
    }
    assert.equal(seen.size, 3); assert.ok(Math.abs(c.distance-c.route.length) < .001);
  }
  const c = new QuietPath.PathController(); c.move(904, 300);
  assert.equal(c.move(824, 330).contact, true);
});

test('speed bands reward the indicated speed and penalize both extremes', () => {
  for (const zone of QuietPath.zones) for (const kind of ['good', 'slow', 'fast']) {
    const m = new QuietNight(); m.start(true); m.begin();
    const speed = kind==='good' ? (zone.min+zone.max)/2 : kind==='slow' ? zone.min*.15 : zone.max*2;
    let p=.2; tick(m, 1, () => m.move(p+=.0001, 0, .02, {zone, speed}));
    assert.equal(m.speedState, kind);
    assert.ok(kind==='good' ? m.noise<.02 : m.noise>.2);
  }
});

test('noise presses the portrait and switches abruptly to the eerie expression', () => {
  const m = new QuietNight(); m.start();
  tick(m, 1.2, () => { m.impulse=.66; }); assert.equal(m.eerie, false); assert.equal(m.mode, 'annoyed');
  tick(m, .8, () => { m.impulse=.66; }); assert.equal(m.mode, 'pain');
  tick(m, .6, () => { m.impulse=.66; }); assert.equal(m.eerie, true); assert.equal(m.mode, 'wrong');
  assert.ok(m.layout().split>550); assert.equal(m.events.filter(e=>e.type==='turn').length, 1);
  const pressed=m.pressure; tick(m, 7);
  assert.equal(m.over, false); assert.equal(m.eerie, false); assert.equal(m.mode, 'calm'); assert.ok(m.pressure<pressed*.1);
});

test('pointer coordinates follow the moving upper screen', () => {
  const m = new QuietNight();
  for (const pressure of [0, .35, .8, 1]) {
    m.pressure=pressure; const l=m.layout(), p=m.toDoorPoint(904, 330*l.scale);
    assert.equal(p.x, 904); assert.ok(Math.abs(p.y-330)<.000001); assert.ok(l.lowerHeight>0);
  }
});

test('sustained noise triggers one burst, blocks input, and advances the ending timeline', () => {
  const m = new QuietNight(); m.start(); m.begin();
  tick(m, 4, () => { m.impulse=.9; });
  assert.equal(m.over, true); assert.equal(m.won, false); assert.equal(m.bursting, true); assert.equal(m.begin(), false);
  const p=m.door, t=m.burstTime; m.move(1, 0, .1); tick(m, 3);
  assert.equal(m.door, p); assert.ok(m.burstTime>t+2.9); assert.equal(m.events.filter(e=>e.type==='burst').length, 1);
});

test('practice recovers after a burst, and both previews have distinct outcomes', () => {
  const practice = new QuietNight(); practice.start(true); tick(practice, 4, () => { practice.impulse=.9; });
  assert.equal(practice.bursting, true); tick(practice, 3.2); assert.equal(practice.over, false); assert.equal(practice.bursting, false);
  const short = new QuietNight(); short.start(true); short.demo(); tick(short, 3.2);
  assert.equal(short.eerie, true); assert.equal(short.over, false); tick(short, 9); assert.equal(short.eerie, false);
  const long = new QuietNight(); long.start(); long.demo(true); tick(long, 8);
  assert.equal(long.over, true); assert.equal(long.won, false); assert.ok(long.burstTime>2.45);
});

test('four full strokes at the indicated path speeds win the game', () => {
  const m = new QuietNight(); m.start();
  for (let index=0; index<4; index++) {
    const c=new QuietPath.PathController(index); m.begin();
    for (const s of c.route.segments) {
      const speed=(s.zone.min+s.zone.max)/2, n=Math.ceil(s.length/(speed*.02)), dt=s.length/n/speed;
      for (let k=1; k<=n; k++) {
        const before=c.distance, r=c.move(s.a.x+s.dx*k/n, s.a.y+s.dy*k/n);
        m.move(index%2===0?r.progress:1-r.progress, r.contact?99:0, dt, {zone:r.zone, speed:Math.abs(c.distance-before)/dt});
        m.update(dt); assert.equal(m.over, false);
      }
    }
    m.release();
  }
  assert.equal(m.won, true); assert.equal(m.step, 4);
});

test('pause freezes the simulation and restart clears the mood and burst', () => {
  const m=new QuietNight(); m.start(); m.demo(); m.togglePause(); const snap=m.snapshot();
  tick(m, 2); assert.deepEqual(m.snapshot(), snap); m.start(); assert.equal(m.stress, 0); assert.equal(m.eerie, false); assert.equal(m.burstTime, -1);
});

test('all themes render finite SVG, including compressed and shattered states', () => {
  for (const theme of ['cute','comic','horror']) for (const phase of ['calm','wrong','burst']) {
    const m=new QuietNight(); m.start();
    if (phase==='wrong') { m.stress=70; m.pressure=.7; m.eerie=true; }
    if (phase==='burst') { m.explode(); tick(m, .8); }
    const c=new QuietPath.PathController(), surface=new QuietSVG();
    QuietArt.paint(surface,m,{theme,route:c.route,distance:0,point:c.point(),reduced:true});
    const svg=surface.svg(); assert.ok(!/NaN|undefined|Infinity|<canvas/.test(svg)); assert.ok(svg.includes('<path'));
    assert.equal((svg.match(/data-shard=/g)||[]).length, phase==='burst'?12:0);
  }
});

test('browser controller changes mood, delays its result, and resets correctly', () => {
  const listeners={}, elements={}; let frame, clock=100;
  function el(id,dataset={}) { return {id,dataset,tagName:'BUTTON',hidden:false,textContent:'',innerHTML:'',setAttribute(){},classList:{add(){},remove(){},toggle(){}},addEventListener(t,fn){listeners[id+':'+t]=fn;},getBoundingClientRect:()=>({left:0,top:0,width:1280,height:800}),setPointerCapture(){}}; }
  const themes=['comic','horror','cute'].map(t=>el('theme-'+t,{theme:t})), dots=[0,1,2,3].map(i=>el('dot'+i));
  const document={documentElement:{dataset:{}},getElementById:id=>elements[id]??(elements[id]=el(id)),querySelectorAll:q=>q==='.step-dots i'?dots:themes,addEventListener:(t,fn)=>{listeners['doc:'+t]=fn;}};
  const context={document,URL,location:{href:'https://example.test/2d/?theme=cute'},history:{replaceState(){}},performance:{now:()=>clock},matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{frame=fn;},QuietNight,QuietPath,QuietSVG,QuietArt}; context.window=context;
  vm.runInNewContext(fs.readFileSync(path.join(base,'game.js'),'utf8'),context);
  function advance(seconds) { for (let i=0;i<Math.ceil(seconds/.02);i++){clock+=20;frame(clock);} }
  listeners['start:click'](); assert.equal(elements.intro.hidden,true);
  listeners['game:pointerdown']({button:0,clientX:904,clientY:240,pointerId:1,preventDefault(){}}); clock+=80;
  listeners['game:pointermove']({clientX:904,clientY:245,pointerType:'mouse'}); assert.ok(context.quiet2dSnapshot.pathProgress>0);
  listeners['game:pointerup']();
  listeners['demo:click'](); advance(3.2); assert.equal(document.documentElement.dataset.mood,'wrong');
  advance(9); assert.equal(document.documentElement.dataset.mood,'soft'); assert.equal(elements.result.hidden,true);
  listeners['burstDemo:click'](); advance(3.4); assert.equal(context.quiet2dSnapshot.over,true); assert.equal(elements.result.hidden,true);
  advance(3); assert.equal(elements.result.hidden,false);
  listeners['reset:click'](); assert.equal(elements.result.hidden,true); assert.equal(document.documentElement.dataset.mood,'soft');
});
