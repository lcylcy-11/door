/* 문 좀 살살 — two homes, one shared night. All play stays in the browser. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const stage = $('stage'), upper = $('upstairs'), lower = $('downstairs');
  const clamp = (x, a=0, b=1) => Math.max(a, Math.min(b, x));
  const lerp = (a,b,t) => a+(b-a)*t;
  const smooth = (a,b,k,dt) => lerp(a,b,1-Math.exp(-k*dt));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({canvas:$('world'),antialias:true,alpha:false,powerPreference:'high-performance'});
  } catch(e) { $('intro').hidden=true; $('webglError').hidden=false; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.2;
  renderer.autoClear=false;

  const upScene=new THREE.Scene(), downScene=new THREE.Scene();
  upScene.background=new THREE.Color('#3a4844');
  upScene.fog=new THREE.Fog('#3a4844',8,20);
  downScene.background=new THREE.Color('#6d7e6a');
  const upCam=new THREE.PerspectiveCamera(57,1,.05,40);
  const downCam=new THREE.OrthographicCamera(-8,8,4,-4,.1,80);
  downCam.position.set(6,8,25); downCam.lookAt(0,.9,0);
  const mats={};
  function mat(color, roughness=.82){ return new THREE.MeshStandardMaterial({color,roughness}); }
  const wood=mat('#826344'), trim=mat('#bca47a'), black=mat('#253638'), brass=mat('#b8a477',.4), cream=mat('#ded5b7');
  function box(parent,w,h,d,x,y,z,m,rotation=0){
    const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), typeof m==='string'?mat(m):m);
    o.position.set(x,y,z);o.rotation.y=rotation;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  }
  function cyl(parent,r1,r2,h,x,y,z,m,segments=18){
    const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),typeof m==='string'?mat(m):m);
    o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  }
  function sphere(parent,r,x,y,z,m,sx=1,sy=1,sz=1){
    const o=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),typeof m==='string'?mat(m):m);
    o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;parent.add(o);return o;
  }
  function textTexture(text,color='#c6d0c1',bg='#30423b',font=44){
    const c=document.createElement('canvas');c.width=512;c.height=128;
    const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle=color;ctx.font=`500 ${font}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64);
    const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;return tx;
  }
  function planeText(parent,text,w,h,x,y,z,color,bg){
    const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:textTexture(text,color,bg)}));
    o.position.set(x,y,z);parent.add(o);return o;
  }
  function woodTexture(){
    const c=document.createElement('canvas');c.width=512;c.height=512;const ctx=c.getContext('2d');
    ctx.fillStyle='#8b7455';ctx.fillRect(0,0,512,512);
    for(let i=0;i<16;i++){ctx.fillStyle=i%2?'#8d7657':'#967e60';ctx.fillRect(i*32,0,31,512);ctx.fillStyle='#66583e';ctx.fillRect(i*32,0,1,512);}
    let n=7123;const rnd=()=>{n=(n*16807)%2147483647;return n/2147483647;};
    for(let i=0;i<380;i++){ctx.strokeStyle=`rgba(69,46,25,${rnd()*.12})`;ctx.beginPath();const x=rnd()*512,y=rnd()*512;ctx.moveTo(x,y);ctx.bezierCurveTo(x-5,y+35,x+7,y+70,x+1,y+120);ctx.stroke();}
    const tx=new THREE.CanvasTexture(c);tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.repeat.set(2,2);tx.colorSpace=THREE.SRGBColorSpace;return tx;
  }
  function plant(parent,x,z,scale=1){
    const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
    cyl(g,.19,.14,.33,0,.165,0,mat('#ad8765'));
    cyl(g,.012,.012,.75,0,.64,0,mat('#6a7652'),8);
    for(let i=0;i<7;i++){const a=i*2.4;const o=sphere(g,.19,Math.cos(a)*.15,.5+i*.07,Math.sin(a)*.14,mat(i%2?'#66866a':'#81977b'),.6,1.5,.22);o.rotation.z=Math.cos(a)*.7;o.rotation.y=a;}
    return g;
  }
  function lamp(parent,x,z,height=1.8){
    cyl(parent,.24,.27,.06,x,.03,z,black);cyl(parent,.018,.018,height,x,height/2,z,brass,10);
    const shade=cyl(parent,.27,.43,.32,x,height,z,mat('#e5d0a3'));shade.material.side=THREE.DoubleSide;
    const l=new THREE.PointLight('#ffd79b',8,6,2);l.position.set(x,height-.18,z);parent.add(l);return l;
  }
  function frame(parent,x,y,z,w,h){
    box(parent,w,h,.06,x,y,z,wood);box(parent,w-.08,h-.08,.025,x,y,z+.045,mat('#dfd4b8'));
    box(parent,w*.42,h*.45,.02,x-.04,y-.03,z+.065,mat('#8a9c83'));
    sphere(parent,.06,x+w*.2,y+h*.2,z+.08,mat('#ceae73'),1,1,.15);
  }
  function rug(parent,w,d,x,z,color){const o=box(parent,w,.025,d,x,.025,z,mat(color));return o;}

  // Upstairs: a first-person view of a sliding, ribbed-glass apartment door.
  upScene.add(new THREE.HemisphereLight('#c9ddc6','#474738',2.1));
  const warm=new THREE.PointLight('#ffdb9e',35,12,2);warm.position.set(2.5,2.9,2.7);warm.castShadow=true;warm.shadow.mapSize.set(1024,1024);upScene.add(warm);
  const cool=new THREE.PointLight('#96c7bf',22,10,2);cool.position.set(-1,2.4,-3);upScene.add(cool);
  const floorMat=new THREE.MeshStandardMaterial({map:woodTexture(),roughness:.8,color:'#b4ac8e'});
  box(upScene,10,.12,12,0,-.08,-.6,floorMat);
  box(upScene,.15,3.4,10,-4,1.7,0,mat('#8b9583'));box(upScene,.15,3.4,10,4,1.7,0,mat('#b2ae93'));
  box(upScene,8,3.4,.18,0,1.7,-5,mat('#8a9d91'));box(upScene,8,.12,10,0,3.25,0,mat('#afa88d'));
  box(upScene,2.6,3.1,.22,-2.84,1.55,0,mat('#a6aa90'));box(upScene,2.6,3.1,.22,2.84,1.55,0,mat('#b0b19a'));
  box(upScene,8,.12,.11,0,.06,0,wood);
  box(upScene,.11,2.72,.24,-1.53,1.36,.01,wood);box(upScene,.11,2.72,.24,1.53,1.36,.01,wood);
  box(upScene,3.2,.14,.25,0,2.72,.01,wood);box(upScene,6,.05,.12,-1.35,2.8,.08,black);
  box(upScene,3.2,.025,.24,0,.015,.03,brass);
  const door=new THREE.Group();upScene.add(door);
  const glassMat=new THREE.MeshStandardMaterial({color:'#9cae98',roughness:.65,metalness:.08,transparent:true,opacity:.68});
  box(door,2.94,2.61,.065,0,1.35,.075,glassMat);
  for(let x=-1.42;x<1.45;x+=.073){box(door,.013,2.48,.025,x,1.35,.13,mat('#b5bca0'));}
  for(const x of [-1.48,1.48])box(door,.065,2.68,.13,x,1.35,.1,wood);
  for(const y of [.045,2.65])box(door,3.02,.09,.13,0,y,.1,wood);
  box(door,.045,.42,.075,1.09,1.26,.2,black);box(door,.085,.045,.13,1.09,1.45,.17,brass);box(door,.085,.045,.13,1.09,1.07,.17,brass);
  // Kitchen beyond the door.
  const cabinet=mat('#526b61');
  box(upScene,2.55,.88,.73,2.3,.44,-3.95,cabinet);box(upScene,2.67,.075,.85,2.3,.92,-3.9,mat('#d6d3b6'));
  for(const x of [1.48,2.3,3.12]){box(upScene,.75,.69,.025,x,.45,-3.57,mat('#657d6c'));box(upScene,.23,.025,.035,x,.72,-3.54,brass);}
  box(upScene,2.62,.66,.36,2.3,2.1,-4.15,cabinet);
  for(let i=0;i<8;i++)box(upScene,.016,.72,.02,1.05+i*.35,1.38,-4.52,mat('#a0b2a0'));
  const kitchenStrip=new THREE.PointLight('#ffe1ad',6,4);kitchenStrip.position.set(2.3,1.7,-4);upScene.add(kitchenStrip);
  box(upScene,.48,.035,.4,1.6,.97,-3.8,black);cyl(upScene,.15,.15,.18,1.6,1.07,-3.8,mat('#99a69a'));
  box(upScene,.85,1.94,.72,-2.75,.97,-4.12,mat('#a7b7a1'));box(upScene,.8,.015,.02,-2.75,1.34,-3.745,black);box(upScene,.025,.45,.07,-2.42,.94,-3.73,brass);
  box(upScene,1.0,2.25,.07,-1.27,1.125,-4.7,mat('#738d80'));box(upScene,1.1,.07,.12,-1.27,2.28,-4.65,trim);
  planeText(upScene,'BATH',.45,.13,-1.27,1.8,-4.65,'#d4dbc6','#738d80');
  sphere(upScene,.035,-.94,1,-4.62,brass);
  plant(upScene,3.5,-1.4,1.1);frame(upScene,2.75,1.7,.14,.55,.72);
  box(upScene,.14,.23,.045,2.05,1.15,.14,cream);
  const ceilingShade=cyl(upScene,.29,.45,.2,1.8,2.98,1.55,mat('#b89966'));
  cyl(upScene,.008,.008,.3,1.8,3.18,1.55,black,8);
  rug(upScene,1.7,.65,0,2.15,'#697e69');
  // A cropped first-person sleeve and hand, visible only during a drag.
  const hand=new THREE.Group();upCam.add(hand);upScene.add(upCam);hand.visible=false;
  const skin=mat('#c7a383'),sleeve=mat('#a47853');
  const arm=cyl(hand,.058,.09,.47,.27,-.32,-.58,sleeve);arm.rotation.z=-.35;arm.rotation.x=.35;
  const palm=sphere(hand,.077,.20,-.12,-.68,skin,.78,1.3,.58);palm.rotation.z=-.3;
  for(let i=0;i<4;i++){const f=cyl(hand,.013,.015,.09,.155+i*.025,-.071,-.69,skin,10);f.rotation.x=.4;}

  // Downstairs: an open-front dollhouse, so ordinary life stays visible.
  downScene.add(new THREE.HemisphereLight('#e3e8c4','#5d6e54',2.25));
  const sun=new THREE.DirectionalLight('#ffe8bd',2.6);sun.position.set(-4,8,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=5;sun.shadow.camera.bottom=-5;downScene.add(sun);
  box(downScene,12.8,.22,4.5,0,-.13,0,new THREE.MeshStandardMaterial({map:woodTexture(),color:'#c2a276',roughness:.9}));
  box(downScene,12.8,.17,.12,0,-.1,2.27,wood);
  box(downScene,12.8,2.5,.13,0,1.25,-2.25,mat('#9ca58b'));box(downScene,.13,2.5,4.4,-6.4,1.25,0,mat('#8b9a82'));
  box(downScene,12.8,.12,.08,0,.06,-2.15,trim);box(downScene,.08,.12,4.3,-6.3,.06,0,trim);
  // Windows, framed prints, clock.
  box(downScene,2.0,1.35,.08,-3.4,1.6,-2.13,wood);
  box(downScene,1.86,1.21,.035,-3.4,1.6,-2.07,mat('#304f51'));
  for(const x of [-3.85,-2.95])box(downScene,.035,1.2,.04,x,1.6,-2.035,trim);
  box(downScene,1.86,.04,.04,-3.4,1.6,-2.03,trim);
  for(let i=0;i<7;i++){const x=-4.2+i*.23;box(downScene,.12,.2+(i%3)*.13,.01,x,1.24,-2.045,mat('#597474'));sphere(downScene,.017,x,1.5+(i%3)*.13,-2.025,mat('#d9c184'),1,1,.2);}
  for(const x of [-4.55,-2.25]){box(downScene,.32,1.52,.12,x,1.63,-2.0,mat('#c5b995'));for(let i=0;i<5;i++)box(downScene,.015,1.5,.04,x-.13+i*.065,1.63,-1.91,mat('#b2a786'));}
  frame(downScene,-.7,1.75,-2.1,.68,.85);frame(downScene,.2,1.86,-2.1,.52,.65);
  const clockFace=cyl(downScene,.24,.24,.06,2.65,1.98,-2.13,cream);clockFace.rotation.x=Math.PI/2;
  box(downScene,.015,.16,.015,2.65,2.03,-2.082,black);const clockHand=box(downScene,.13,.015,.015,2.7,1.98,-2.08,black);
  // TV on the left, angled toward a sofa.
  const tvGroup=new THREE.Group();tvGroup.position.set(-5.8,0,.35);tvGroup.rotation.y=Math.PI/2;downScene.add(tvGroup);
  box(tvGroup,1.4,.4,.38,0,.25,0,mat('#7a634b'));box(tvGroup,1.35,.83,.09,0,1.02,0,black);
  const tvCanvas=document.createElement('canvas');tvCanvas.width=256;tvCanvas.height=144;const tvCtx=tvCanvas.getContext('2d');
  const tvTexture=new THREE.CanvasTexture(tvCanvas);tvTexture.colorSpace=THREE.SRGBColorSpace;
  const tvScreen=new THREE.Mesh(new THREE.PlaneGeometry(1.22,.7),new THREE.MeshBasicMaterial({map:tvTexture}));tvScreen.position.set(0,1.02,.051);tvGroup.add(tvScreen);
  box(tvGroup,.08,.18,.08,0,.55,0,black);
  const tvLight=new THREE.PointLight('#a5d8ce',3,4,2);tvLight.position.set(-5.2,1.15,.35);downScene.add(tvLight);
  // Sage sofa, cushions, throw, low table, slippers.
  const couch=new THREE.Group();couch.position.set(-3.65,0,-.25);couch.rotation.y=-Math.PI/2;downScene.add(couch);
  const upholstery=mat('#637c6c'),cushion=mat('#8d9d7a');
  box(couch,2.35,.36,.86,0,.33,0,upholstery);box(couch,2.35,.65,.2,0,.75,-.4,upholstery);
  for(const x of [-1.13,1.13])box(couch,.19,.52,.94,x,.55,0,upholstery);
  for(const x of [-.54,.54])box(couch,1,.14,.76,x,.55,.02,cushion);
  const pillow=box(couch,.45,.44,.16,.8,.85,-.22,mat('#d3b78a'));pillow.rotation.z=.18;
  box(couch,.5,.05,.82,-.66,.65,.04,mat('#bda982'));
  for(const x of [-.86,.86])for(const z of [-.25,.25])cyl(couch,.035,.03,.23,x,.12,z,wood,8);
  rug(downScene,3.5,2.6,-3.6,.2,'#b1a17e');
  const coffee=new THREE.Group();coffee.position.set(-4.95,0,.45);downScene.add(coffee);
  box(coffee,.7,.06,1.4,0,.48,0,wood);
  for(const x of [-.25,.25])for(const z of [-.53,.53])box(coffee,.04,.45,.04,x,.23,z,wood);
  box(coffee,.22,.035,.32,0,.535,.35,mat('#d8d0b0'));box(coffee,.08,.025,.24,.1,.55,-.25,black);
  for(const x of [-3.52,-3.25]){const shoe=sphere(downScene,.1,x,.07,.7,mat('#826e54'),.85,.48,1.5);}
  plant(downScene,-5.9,-1.6,1.2);lamp(downScene,-2.2,-1.6,1.8);
  // Dining space with a kettle, cup, chair, and kitchen counter.
  const teaTable=cyl(downScene,.63,.63,.075,-.15,.72,.5,mat('#c5aa7c'),32);
  cyl(downScene,.055,.1,.7,-.15,.36,.5,wood);cyl(downScene,.36,.36,.05,-.15,.04,.5,wood);
  cyl(downScene,.1,.08,.17,-.32,.84,.4,cream);cyl(downScene,.07,.07,.008,-.32,.93,.4,mat('#4d432c'));
  cyl(downScene,.14,.13,.2,.12,.87,.65,mat('#798d76'));sphere(downScene,.1,.12,1,.65,mat('#798d76'),1,.3,1);
  box(downScene,.41,.04,.32,-.15,.79,.75,mat('#e2d6b4'));
  const chair=new THREE.Group();chair.position.set(.95,0,.5);chair.rotation.y=Math.PI/2;downScene.add(chair);
  box(chair,.53,.09,.55,0,.46,0,mat('#7b8c6d'));box(chair,.53,.6,.06,0,.79,-.26,wood);
  for(const x of [-.2,.2])for(const z of [-.2,.2])box(chair,.04,.44,.04,x,.22,z,wood);
  box(downScene,2.1,.82,.63,1.1,.41,-1.75,mat('#7b8e77'));box(downScene,2.2,.06,.7,1.1,.85,-1.73,mat('#dbcb9e'));
  for(const x of [.42,1.1,1.78]){box(downScene,.61,.7,.02,x,.42,-1.42,mat('#879a7d'));box(downScene,.17,.02,.03,x,.68,-1.39,brass);}
  box(downScene,.83,1.7,.7,2.8,.85,-1.75,mat('#c3c3a4'));box(downScene,.75,.025,.03,2.8,1.15,-1.38,black);box(downScene,.02,.35,.04,3.1,.75,-1.37,brass);
  cyl(downScene,.12,.1,.18,1,.97,-1.68,mat('#ad8f5f'));plant(downScene,1.6,-1.65,.38);
  // Entrance: a real destination, not a gauge.
  box(downScene,.12,2.45,1.1,3.6,1.225,-1.72,mat('#a8ab8d'));
  box(downScene,1.33,2.2,.11,5.25,1.1,-2.12,mat('#566d60'));
  box(downScene,1.46,.07,.15,5.25,2.24,-2.07,trim);for(const x of [4.55,5.95])box(downScene,.07,2.23,.15,x,1.1,-2.07,trim);
  sphere(downScene,.037,5.72,1.04,-2.04,brass);planeText(downScene,'202',.24,.12,5.25,1.75,-2.045,'#e6ddba','#566d60');
  rug(downScene,2.05,1.27,5.15,-1.27,'#7c8d76');box(downScene,.7,.75,.48,4,.38,-1.8,wood);
  for(const x of [4.85,5.16])sphere(downScene,.11,x,.07,-1.4,mat('#b9a080'),.75,.4,1.3);
  box(downScene,.32,.52,.05,4.07,1.49,-2.12,mat('#c9c8a7'));planeText(downScene,'GOOD NIGHT',.58,.1,4.05,1.97,-2.12,'#545e47','#9ca58b');
  const entranceLamp=new THREE.PointLight('#ffdfaa',4,4);entranceLamp.position.set(5,2.05,-.7);downScene.add(entranceLamp);
  // Neighbor: pajamas, slippers, reading glasses, and an expressive head.
  const npc=new THREE.Group();downScene.add(npc);
  const body=new THREE.Group();npc.add(body);
  const pajamas=mat('#a88568'),pants=mat('#607467'),hairMat=mat('#424c3d'),npcSkin=mat('#d3b38b');
  const torso=box(body,.43,.55,.29,0,1.03,0,pajamas);sphere(body,.22,0,1.23,0,pajamas,1,.5,.7);
  const head=new THREE.Group();head.position.y=1.54;body.add(head);
  sphere(head,.245,0,0,0,npcSkin,.88,1.08,.86);sphere(head,.246,0,.09,-.025,hairMat,.91,.82,.86);
  box(head,.36,.09,.09,0,.12,.16,hairMat);sphere(head,.055,0,-.02,.209,npcSkin,.6,.7,1);
  for(const x of [-.084,.084]){sphere(head,.018,x,.018,.204,black,1,.65,.6);box(head,.095,.015,.014,x,.076,.211,hairMat);const lens=new THREE.Mesh(new THREE.TorusGeometry(.066,.007,6,16),black);lens.position.set(x,.025,.221);head.add(lens);}
  box(head,.035,.008,.012,0,.025,.23,black);const mouth=box(head,.06,.012,.014,0,-.1,.19,mat('#886c4d'));
  const arms=[], legs=[];
  for(const side of [-1,1]){
    const a=new THREE.Group();a.position.set(side*.28,1.22,0);body.add(a);cyl(a,.085,.07,.43,0,-.21,0,pajamas);sphere(a,.075,0,-.44,0,npcSkin);arms.push(a);
    const leg=new THREE.Group();leg.position.set(side*.115,.78,0);body.add(leg);cyl(leg,.1,.08,.42,0,-.2,0,pants);const shin=new THREE.Group();shin.position.y=-.4;leg.add(shin);cyl(shin,.08,.065,.35,0,-.17,0,pants);sphere(shin,.09,0,-.34,.055,mat('#d1bf94'),1,.5,1.6);legs.push({leg,shin});
  }
  const heldMug=cyl(arms[1],.07,.058,.12,0,-.44,.05,cream);heldMug.visible=false;

  // Sound is synthesized locally, and starts only after the player's gesture.
  let audio=null,muted=false;
  function initAudio(){
    if(audio)return;
    try{
      const ctx=new (window.AudioContext||window.webkitAudioContext)();
      const master=ctx.createGain();master.gain.value=muted?0:.6;master.connect(ctx.destination);
      const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.45;
      const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
      const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=700;filter.Q.value=.65;
      const gain=ctx.createGain();gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(master);source.start();
      const hum=ctx.createOscillator();hum.frequency.value=80;const hg=ctx.createGain();hg.gain.value=.006;hum.connect(hg);hg.connect(master);hum.start();
      audio={ctx,master,gain,filter};
    }catch(e){muted=true;$('sound').classList.add('muted');}
  }
  function beep(freq=180,volume=.05,duration=.1){
    if(!audio||muted)return;const {ctx,master}=audio;const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(freq,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.45,ctx.currentTime+duration);g.gain.setValueAtTime(volume,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);o.connect(g);g.connect(master);o.start();o.stop(ctx.currentTime+duration);
  }

  const state={running:false,paused:false,over:false,won:false,practice:false,interrupted:false,door:0,noise:0,noiseTarget:0,stress:0,quiet:10,time:0,step:0,grab:false,off:false,peak:0,activity:0,activityTime:0,mode:'daily',bubbleTimer:0,wordTimer:0,position:new THREE.Vector2(-3.65,.12),walk:0};
  const activities=[{label:'TV 보는 중',x:-3.65,z:.12,seated:true,angle:-Math.PI/2,caption:'아랫집에서는 아직 TV를 보고 있습니다.'},{label:'차 마시는 중',x:.86,z:.5,seated:true,angle:-Math.PI/2,caption:'따뜻한 차 한 잔. 평범한 밤이 이어집니다.'},{label:'주방 정리 중',x:1.1,z:-.94,seated:false,angle:Math.PI,caption:'컵을 정리하며 하루를 마무리하고 있습니다.'}];
  const endpoint=new THREE.Vector2(5.15,-1.2);
  const waveBars=[];for(let i=0;i<23;i++){const el=document.createElement('i');$('wave').append(el);waveBars.push(el);}
  let w=0,h=0,upperH=0,lowerY=0,lowerH=0,screenPoints=[],lastPointer=null,lookX=0,lookY=0;
  const v3=new THREE.Vector3();
  function project(x,y,z,camera,vw,vh){v3.set(x,y,z).project(camera);return {x:(v3.x*.5+.5)*vw,y:(-.5*v3.y+.5)*vh};}
  function resize(){
    const rect=stage.getBoundingClientRect();w=rect.width;h=rect.height;upperH=upper.offsetHeight;lowerY=lower.offsetTop;lowerH=lower.offsetHeight;
    renderer.setSize(w,h,false);upCam.aspect=w/upperH;upCam.updateProjectionMatrix();
    const halfW=w<700?7.4:8.0,halfH=halfW/(w/lowerH);downCam.left=-halfW;downCam.right=halfW;downCam.top=halfH;downCam.bottom=-halfH;downCam.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);resize();
  function bubble(text,duration=2.1){$('thought').textContent=text;$('thought').classList.add('show');state.bubbleTimer=duration;}
  function word(text,loud=false){if(state.wordTimer>.15&&$('soundWord').textContent===text)return;$('soundWord').textContent=text;$('soundWord').classList.toggle('loud',loud);$('soundWord').classList.add('show');state.wordTimer=.65;}
  function start(practice=false){
    initAudio();if(audio)audio.ctx.resume();
    Object.assign(state,{running:true,paused:false,over:false,won:false,practice,interrupted:false,door:0,noise:0,noiseTarget:0,stress:0,quiet:10,time:0,step:0,grab:false,off:false,peak:0,activity:0,activityTime:0,mode:'daily',bubbleTimer:0,wordTimer:0,position:new THREE.Vector2(-3.65,.12),walk:0});
    $('intro').hidden=true;$('result').hidden=true;$('paused').hidden=true;stage.classList.add('playing');stage.classList.remove('dragging','off-path');$('thought').classList.remove('show');$('soundWord').classList.remove('show');updateMission();
  }
  function updateMission(){
    $('mission').textContent=state.practice?'소음과 이웃의 반응 살펴보기':state.step<2?'화장실, 조용히 다녀오기':'이제 방으로 돌아갈 시간';
    $('stepLabel').textContent=state.practice?'연습':`${state.step} / 4`;
    document.querySelectorAll('.steps>span').forEach((e,i)=>e.classList.toggle('done',i<state.step));
  }
  function finish(win){
    if(state.over)return;
    if(state.practice&&win)return;
    state.over=true;state.won=win;state.grab=false;stage.classList.remove('dragging','off-path');hand.visible=false;
    $('resultEyebrow').textContent=win?'오늘도 이웃의 평화를 지켰어요':'202호의 방문';
    $('resultTitle').textContent=win?'무사히 다녀왔습니다.':'문 좀 살살 닫아주세요.';
    $('resultCopy').textContent=win?'중문을 조용히 여닫고 방으로 돌아왔습니다. 아랫집은 평범한 밤을 계속 보냅니다.':'참다못한 아랫집 사람이 현관까지 왔습니다. 손잡이를 더 천천히 움직이고, 반응이 보이면 잠깐 멈춰보세요.';
    $('result').hidden=false;if(!win){bubble('참는 것도 한계가 있지!',5);beep(90,.22,.5);setTimeout(()=>beep(105,.18,.35),220);}
  }
  function release(){
    if(!state.grab)return;state.grab=false;state.off=false;lastPointer=null;stage.classList.remove('dragging','off-path');hand.visible=false;
    if(!state.practice&&!state.over&&!state.paused){
      const open=state.step%2===0;
      if((open&&state.door>.965)||(!open&&state.door<.035)){
        state.step++;updateMission();
        if(state.step>=4)finish(true);
        else {$('gripTip').textContent=state.step%2?'이제 천천히 닫아주세요':'다시 열고 방으로 돌아가세요';beep(460,.025,.11);}
      }
    }
  }
  function movePointer(e){
    const r=upper.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
    lookX=clamp((x/r.width-.5)*2,-1,1);lookY=clamp((y/r.height-.5)*2,-1,1);
    if(!state.running||state.paused||state.over)return;
    if(!state.grab){const grip=screenPoints[Math.round(state.door*30)];upper.classList.toggle('cursor-grab',!!grip&&Math.hypot(x-grip.x,y-grip.y)<45);return;}
    const p0=screenPoints[0],p1=screenPoints[30];if(!p0||!p1)return;
    const p=clamp((x-p0.x)/(p1.x-p0.x)),expected=screenPoints[Math.round(p*30)];
    const deviation=Math.abs(y-expected.y);state.off=deviation>24;
    stage.classList.toggle('off-path',state.off);
    const now=performance.now(),dt=lastPointer?clamp((now-lastPointer.t)/1000,.008,.2):.02;
    if(lastPointer){
      const speed=Math.abs(p-state.door)/dt;
      const movementNoise=clamp((speed-.14)*.68);
      state.noiseTarget=Math.max(state.noiseTarget,movementNoise,state.off?.62:0);
      state.peak=Math.max(state.peak,movementNoise);
      if(movementNoise>.5)word('드르르륵',movementNoise>.85);
      if(state.off)word('덜컹!',true);
      const edge=(p<.012&&state.door>.012)||(p>.988&&state.door<.988);
      if(edge&&speed>.38){state.noiseTarget=Math.min(1,Math.max(state.noiseTarget,.4+speed*.23));word(p<.1?'쿵!':'탁!',true);beep(p<.1?94:155,.07+clamp(speed)*.12,.2);}
    }
    state.door=p;lastPointer={x,y,t:now};
    $('gripTip').textContent=state.off?'길 밖으로 나갔어요. 덜컹!':'좋아요. 급하게 움직이지 마세요';
  }
  upper.addEventListener('pointerdown',e=>{
    if(!state.running||state.paused||state.over||e.button!==0)return;
    const r=upper.getBoundingClientRect(),grip=screenPoints[Math.round(state.door*30)];
    if(!grip||Math.hypot(e.clientX-r.left-grip.x,e.clientY-r.top-grip.y)>60)return;
    state.grab=true;stage.classList.add('dragging');hand.visible=true;upper.setPointerCapture(e.pointerId);lastPointer={t:performance.now(),x:e.clientX-r.left,y:e.clientY-r.top};initAudio();if(audio)audio.ctx.resume();e.preventDefault();
  });
  upper.addEventListener('pointermove',movePointer);upper.addEventListener('pointerup',release);upper.addEventListener('pointercancel',release);upper.addEventListener('lostpointercapture',release);upper.addEventListener('contextmenu',e=>e.preventDefault());
  $('start').addEventListener('click',()=>start());$('restart').addEventListener('click',()=>start(state.practice));$('again').addEventListener('click',()=>start());$('practice').addEventListener('click',()=>start(true));
  function pause(){if(!state.running||state.over)return;state.paused=!state.paused;$('paused').hidden=!state.paused;release();}
  $('pause').addEventListener('click',pause);$('resume').addEventListener('click',pause);
  document.addEventListener('keydown',e=>{if(e.code==='Escape')pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.running&&!state.paused&&!state.over)pause();});
  $('sound').addEventListener('click',()=>{muted=!muted;$('sound').classList.toggle('muted',muted);$('sound').setAttribute('aria-label',muted?'소리 켜기':'소리 끄기');$('sound').title=muted?'소리 켜기':'소리 끄기';if(audio)audio.master.gain.setTargetAtTime(muted?0:.6,audio.ctx.currentTime,.05);});

  function updateNeighbor(dt){
    if(state.noise>.12){state.quiet=0;state.stress=clamp(state.stress+state.noise*43*dt,0,100);}else{state.quiet+=dt;state.stress=Math.max(0,state.stress-(state.quiet>1?11:3)*dt);}
    const activity=activities[state.activity];let target=new THREE.Vector2(activity.x,activity.z),mode='daily';
    if(state.noise>.15||state.stress>15&&state.quiet<1.45){
      state.interrupted=true;mode=state.stress>13?'approach':'listen';if(mode==='approach')target.copy(endpoint);else target.copy(state.position);
    }else if(state.position.distanceTo(target)>.08)mode=state.interrupted?'return':'commute';
    if(mode!==state.mode){
      if(mode==='listen'){bubble('응…?');$('lowerCaption').textContent='위층에서 소리가 들려 잠깐 귀를 기울입니다.';}
      if(mode==='approach'){bubble(state.stress>55?'또 중문 소리야?':'무슨 소리지?');$('lowerCaption').textContent='소음을 따라 현관 쪽으로 향합니다. 지금 멈춰도 늦지 않았어요.';}
      if(mode==='return'){bubble('조용해졌네.');$('lowerCaption').textContent='소리가 잦아들자 하던 일로 돌아갑니다.';}
      if(mode==='daily'){$('lowerCaption').textContent=activity.caption;state.interrupted=false;}
      if(mode==='commute')$('lowerCaption').textContent=state.activity===1?'차 한 잔을 마시러 식탁으로 갑니다.':'천천히 하루를 마무리하고 있습니다.';
      state.mode=mode;
    }
    const distance=state.position.distanceTo(target),walking=distance>.045;
    if(walking){
      const dx=target.x-state.position.x,dz=target.y-state.position.y,speed=mode==='approach'?1.1+state.stress*.006:1.15;
      const f=Math.min(1,speed*dt/distance);state.position.lerp(target,f);
      const targetAngle=Math.atan2(dx,dz);npc.rotation.y+=Math.atan2(Math.sin(targetAngle-npc.rotation.y),Math.cos(targetAngle-npc.rotation.y))*Math.min(1,dt*7);
      state.walk+=dt*7.5;
      if(Math.sin(state.walk)>.95&&Math.sin(state.walk-dt*7.5)<=.95&&mode==='approach')beep(120,.018,.08);
    }else{
      let angle=mode==='listen'?Math.atan2(endpoint.x-state.position.x,endpoint.y-state.position.y):activity.angle;
      npc.rotation.y+=Math.atan2(Math.sin(angle-npc.rotation.y),Math.cos(angle-npc.rotation.y))*Math.min(1,dt*5);
    }
    npc.position.set(state.position.x,0,state.position.y);
    const seated=!walking&&(mode==='daily'||mode==='return')&&activity.seated;
    body.position.y=smooth(body.position.y,seated?-.27:0,7,dt);
    torso.rotation.z=walking&&!reduced?Math.sin(state.walk)*.022:0;
    for(let i=0;i<2;i++){
      const gait=walking&&!reduced?Math.sin(state.walk+i*Math.PI)*.44:0;
      legs[i].leg.rotation.x=smooth(legs[i].leg.rotation.x,seated?-Math.PI/2:gait,9,dt);
      legs[i].shin.rotation.x=smooth(legs[i].shin.rotation.x,seated?Math.PI/2:Math.max(0,-gait*.7),9,dt);
      arms[i].rotation.x=smooth(arms[i].rotation.x,seated?-.7:-gait*.65,8,dt);
      arms[i].rotation.z=seated?(i?-.12:.12):0;
    }
    head.rotation.y=smooth(head.rotation.y,(mode==='listen'||mode==='approach')?.2:Math.sin(state.time*.4)*.06,4,dt);
    mouth.scale.x=mode==='approach'?1.3:1;heldMug.visible=seated&&state.activity===1;
    if(mode==='daily'){state.activityTime+=dt;if(state.activityTime>19){state.activityTime=0;state.activity=(state.activity+1)%activities.length;}}
    $('neighborState').classList.toggle('alert',mode==='listen'||mode==='approach');
    $('neighborState').querySelector('b').textContent=mode==='approach'?'현관으로 이동 중':mode==='listen'?'귀 기울이는 중':mode==='return'?'하던 일로 돌아가는 중':mode==='commute'?'방 안을 이동하는 중':activities[state.activity].label;
    if(mode==='approach'&&state.position.distanceTo(endpoint)<.24){if(!state.practice)finish(false);else{bubble('문 좀 살살 닫아주세요.',3);state.stress=55;}}
  }
  function drawTV(t){
    tvCtx.fillStyle='#6a9690';tvCtx.fillRect(0,0,256,144);tvCtx.fillStyle='#e0bd7a';tvCtx.beginPath();tvCtx.arc(200,30,13,0,Math.PI*2);tvCtx.fill();
    tvCtx.fillStyle='#466f67';tvCtx.beginPath();tvCtx.moveTo(0,100);for(let i=0;i<7;i++)tvCtx.lineTo(i*47,55+Math.sin(i*4)*25);tvCtx.lineTo(256,144);tvCtx.lineTo(0,144);tvCtx.fill();
    tvCtx.fillStyle='#91b0a0';tvCtx.fillRect(0,108,256,36);tvCtx.fillStyle='#d8cba1';const bx=(t*8)%310-25;tvCtx.fillRect(bx,115,29,6);tvCtx.fillStyle='#eff0cf';tvCtx.font='10px sans-serif';tvCtx.fillText('MIDNIGHT NATURE',12,20);tvTexture.needsUpdate=true;
  }
  let last=performance.now(),tvTime=0,uiTime=0;
  function tick(now){
    requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.045);last=now;
    const active=state.running&&!state.paused&&!state.over;
    if(active){
      state.time+=dt;state.noise=smooth(state.noise,state.noiseTarget,16,dt);state.noiseTarget=Math.max(0,state.noiseTarget-dt*1.7);if(!state.grab&&state.noise<.008)state.noise=0;
      updateNeighbor(dt);state.bubbleTimer=Math.max(0,state.bubbleTimer-dt);if(state.bubbleTimer===0)$('thought').classList.remove('show');
      state.wordTimer=Math.max(0,state.wordTimer-dt);if(state.wordTimer===0)$('soundWord').classList.remove('show');
    } else if(state.over){state.noise=smooth(state.noise,0,4,dt);if(state.won){state.time+=dt;updateNeighbor(dt);}}
    if(audio) {audio.gain.gain.setTargetAtTime(active?state.noise*.09:0,audio.ctx.currentTime,.06);audio.filter.frequency.setTargetAtTime(280+state.noise*1200,audio.ctx.currentTime,.1);}
    const shake=active&&!reduced?state.noise*.005:0;
    upCam.position.set(lookX*.035+Math.sin(now*.047)*shake,1.55+lookY*-.015,3.6);upCam.lookAt(lookX*.06,1.33,0);upCam.updateMatrixWorld();
    door.position.x=-2.48*state.door;
    door.rotation.z=active&&!reduced?Math.sin(now*.06)*state.noise*.0015:0;
    hand.rotation.z=state.off?Math.sin(now*.02)*.025:0;
    screenPoints=[];let path='';for(let i=0;i<=30;i++){const p=i/30;const point=project(1.09-2.48*p,1.26+Math.sin(p*Math.PI)*.028,.25,upCam,w,upperH);screenPoints.push(point);path+=(i?' L ':'M ')+point.x.toFixed(1)+' '+point.y.toFixed(1);}
    $('guideLine').setAttribute('d',path);$('guideShadow').setAttribute('d',path);
    const current=screenPoints[Math.round(state.door*30)],end=screenPoints[state.door>.5?0:30];
    for(const name of ['gripRing','gripDot']){$(name).setAttribute('cx',current.x);$(name).setAttribute('cy',current.y);}
    $('guideEnd').setAttribute('cx',end.x);$('guideEnd').setAttribute('cy',end.y);
    $('gripTip').style.left=clamp(current.x,110,w-110)+'px';$('gripTip').style.top=(current.y+38)+'px';
    $('guide').style.opacity=state.running&&!state.over?1:0;$('gripTip').style.opacity=state.running&&!state.over?1:0;
    const face=project(state.position.x,2.03,state.position.y,downCam,w,lowerH);$('thought').style.left=clamp(face.x+12,70,w-110)+'px';$('thought').style.top=clamp(face.y,63,lowerH-45)+'px';
    tvTime+=dt;if(tvTime>.12){drawTV(state.time);tvTime=0;}
    uiTime+=dt;if(uiTime>.08){
      for(let i=0;i<waveBars.length;i++){waveBars[i].style.height=(2+state.noise*15*(.3+.7*Math.abs(Math.sin(state.time*17+i*.85))))+'px';waveBars[i].style.background=state.noise>.5?'#efb087':'#b4cebd';}
      $('noiseLabel').textContent=state.noise>.65?'벽을 타고 울리는 소음':state.noise>.2?'아랫집까지 들리는 소리':state.noise>.05?'작은 문 소리':'조용한 밤';
      $('doorStatus').textContent=state.grab?(state.off?'문이 레일에 부딪히고 있습니다':state.noise>.45?'문이 너무 빠르게 움직입니다':'손잡이를 천천히 움직이고 있습니다'):state.door<.04?'중문이 닫혀 있습니다':state.door>.96?'중문이 열려 있습니다':'손잡이를 다시 잡아 이어서 움직이세요';
      uiTime=0;
    }
    renderer.setScissorTest(true);
    renderer.setViewport(0,h-upperH,w,upperH);renderer.setScissor(0,h-upperH,w,upperH);renderer.clear(true,true,true);renderer.render(upScene,upCam);
    renderer.setViewport(0,h-lowerY-lowerH,w,lowerH);renderer.setScissor(0,h-lowerY-lowerH,w,lowerH);renderer.clear(true,true,true);renderer.render(downScene,downCam);
  }
  npc.position.set(-3.65,0,.12);npc.rotation.y=-Math.PI/2;body.position.y=-.27;legs.forEach(({leg,shin})=>{leg.rotation.x=-Math.PI/2;shin.rotation.x=Math.PI/2;});
  drawTV(0);requestAnimationFrame(tick);
  // A small, read-only diagnostic snapshot for local deterministic QA.
  Object.defineProperty(window,'quietDoorSnapshot',{get:()=>({running:state.running,paused:state.paused,over:state.over,practice:state.practice,door:state.door,noise:state.noise,stress:state.stress,mode:state.mode,step:state.step,position:{x:state.position.x,z:state.position.y},path:screenPoints.map(p=>({...p}))})});
})();
