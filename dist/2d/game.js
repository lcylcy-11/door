(function(){
  'use strict';
  const $=id=>document.getElementById(id),svg=$('game'),stage=$('stage');
  const data={
    comic:{tag:'COMEDY EDITION',title:'중문 하나에, 온 동네가 들썩.',copy:'들키지 않고 화장실 다녀오기 대작전.',eyebrow:'원룸 생활 대소동',intro:'문이 왜 이렇게<br>시끄러운 거야!',introCopy:'손잡이를 잡고 경로를 따라 움직이세요.<br>구간마다 요구 속도가 달라요!',win:'완벽한 야간 잠입!',winCopy:'화장실도 다녀왔고, 아랫집 아저씨의 드라마도 지켰습니다.',lose:'참다 참다, 꽈아앙!',loseCopy:'아랫집의 분노가 위층 화면을 산산조각 냈습니다.',daily:['아저씨는 드라마에 푹 빠져 있습니다.','차 한 잔과 함께 쉬는 중입니다.','컵을 정리하며 하루를 마무리합니다.'],listen:'어라? TV 밖에서 소리가 들립니다.',approach:'아저씨가 씩씩거리며 현관으로 향합니다!',return:'조용해지자 다시 하던 일로 돌아갑니다.'},
    horror:{tag:'AFTER HOURS EDITION',title:'그 소리에, 누군가 잠을 깼다.',copy:'아래층의 발소리가 멎을 때까지, 잠깐만.',eyebrow:'잠들지 못한 원룸의 밤',intro:'아래층은 아직<br>깨어 있다.',introCopy:'문을 여는 손끝에 집중하세요.<br>속도를 놓치면, 아래층이 먼저 알아챕니다.',win:'다시, 조용해졌다.',winCopy:'문을 닫았습니다. 복도에서는 더 이상 아무 소리도 들리지 않습니다.',lose:'네가 위에 있었구나.',loseCopy:'아랫집의 한계가 화면의 경계를 찢었습니다.',daily:['늦은 방송만 희미하게 들립니다.','식탁 앞에서 조용히 차를 마십니다.','주방에서 작은 그릇 소리가 납니다.'],listen:'아래층의 움직임이 멈췄습니다.',approach:'느린 발걸음이 현관 쪽으로 향합니다.',return:'소리가 멎자, 그림자가 방 안으로 돌아갑니다.'},
    cute:{tag:'SWEET / STRANGE',title:'귀엽다고, 괜찮은 건 아니에요.',copy:'조용할 땐 포근해요. 참는 얼굴이 바뀌기 전까진.',eyebrow:'우리의 조용한 약속',intro:'살금살금,<br>다녀올게요.',introCopy:'손잡이를 잡고 구간별 속도를 맞춰요.<br>아래층의 얼굴이 변하면, 잠깐 멈춰요.',win:'무사히 다녀왔어요!',winCopy:'아랫집 친구도 다시 포근한 시간을 보내고 있어요. 오늘도 조용한 밤이에요.',lose:'참던 얼굴이, 터졌다.',loseCopy:'위층 화면까지 부서졌어요. 다음엔 표정이 바뀌기 전에 소리를 멈춰봐요.',daily:['아랫집 친구는 구름 극장을 보고 있어요.','따뜻한 차와 쿠키로 쉬는 중이에요.','작은 컵을 가지런히 정리하고 있어요.'],listen:'친구의 귀가 쫑긋 올라갔어요.',approach:'친구가 무슨 소리인지 보러 가요.',return:'이제 조용해졌어요. 다시 쉬러 가요.'}
  };
  let theme='cute';try{const q=new URL(location.href).searchParams.get('theme');if(q in data)theme=q;}catch{}
  const model=new QuietNight(),controller=new QuietPath.PathController(0),surface=new QuietSVG();
  let cursor=null,contact=false,pointerTime=0,lastFrame=performance.now(),lastPaint=0,lastUI=0;
  let muted=false,audio=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setTheme(value){theme=value;document.documentElement.dataset.theme=value;const d=data[value];
    $('editionTag').textContent=d.tag;$('editionTitle').textContent=d.title;$('editionCopy').textContent=d.copy;$('introEyebrow').textContent=d.eyebrow;$('introTitle').innerHTML=d.intro;$('introCopy').innerHTML=d.introCopy;
    document.querySelectorAll('[data-theme]').forEach(el=>{if(el.tagName==='BUTTON')el.setAttribute('aria-pressed',el.dataset.theme===value?'true':'false');});
    try{const u=new URL(location.href);u.searchParams.set('theme',theme);history.replaceState(null,'',u);}catch{}
    if(model.over)showResult();lastPaint=0;updateUI();
  }
  function initAudio(){if(audio)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),master=ctx.createGain();master.gain.value=muted?0:.42;master.connect(ctx.destination);const buf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),samples=buf.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*.4;const noise=ctx.createBufferSource();noise.buffer=buf;noise.loop=true;const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=500;const gain=ctx.createGain();gain.gain.value=0;noise.connect(filter);filter.connect(gain);gain.connect(master);noise.start();audio={ctx,master,gain,filter};}catch{muted=true;$('sound').textContent='소리 OFF';}}
  function tone(freq,volume=.06,length=.13){if(!audio||muted)return;const {ctx,master}=audio,o=ctx.createOscillator(),g=ctx.createGain();o.type=theme==='comic'?'triangle':'sine';o.frequency.setValueAtTime(freq,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(freq*(theme==='comic'?1.6:.5),ctx.currentTime+length);g.gain.setValueAtTime(volume,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+length);o.connect(g);g.connect(master);o.start();o.stop(ctx.currentTime+length);}
  function resetPath(){controller.reset(model.step%4);cursor=null;contact=false;}
  function start(practice=false){initAudio();if(audio)audio.ctx.resume();model.start(practice);resetPath();$('intro').hidden=true;$('result').hidden=true;$('pauseLayer').hidden=true;stage.classList.remove('dragging');updateUI();}
  function release(){const old=model.step;model.release();cursor=null;contact=false;stage.classList.remove('dragging');if(model.step!==old)resetPath();updateUI();}
  function point(e){const r=svg.getBoundingClientRect();return model.toDoorPoint((e.clientX-r.left)/r.width*1280,(e.clientY-r.top)/r.height*800);}
  svg.addEventListener('pointerdown',e=>{if(e.button!==0||!model.running||model.paused||model.over||model.bursting)return;const xy=point(e),p=controller.point();if(Math.hypot(xy.x-p.x,xy.y-p.y)>43)return;if(model.begin()){model.demoRemaining=0;cursor=xy;pointerTime=performance.now();svg.setPointerCapture(e.pointerId);stage.classList.add('dragging');e.preventDefault();}});
  svg.addEventListener('pointermove',e=>{const xy=point(e);if(!model.grab){const p=controller.point();stage.classList.toggle('grab',model.running&&!model.over&&!model.bursting&&Math.hypot(xy.x-p.x,xy.y-p.y)<43);return;}if(model.paused||model.over||model.bursting)return;
    const now=performance.now(),dt=Math.max(.008,Math.min(.2,(now-pointerTime)/1000)),before=controller.distance,result=controller.move(xy.x,xy.y,e.pointerType==='touch'?28:19);
    cursor=xy;contact=result.contact;const speed=Math.abs(controller.distance-before)/dt;
    model.move(model.step%2===0?result.progress:1-result.progress,contact?99:0,dt,{zone:result.zone,speed});pointerTime=now;
  });
  svg.addEventListener('pointerup',release);svg.addEventListener('pointercancel',release);svg.addEventListener('lostpointercapture',release);svg.addEventListener('contextmenu',e=>e.preventDefault());
  function pause(){model.togglePause();cursor=null;stage.classList.remove('dragging');$('pauseLayer').hidden=!model.paused;updateUI();}
  function showResult(){
    if(!model.won&&model.burstTime<2.45)return;
    const d=data[theme];$('resultTag').textContent=model.won?'오늘도 조용한 밤':'아랫집의 한계';$('resultTitle').textContent=model.won?d.win:d.lose;$('resultCopy').textContent=model.won?d.winCopy:d.loseCopy;$('result').classList.toggle('loss',!model.won);$('result').hidden=false;
  }
  function updateUI(){
    $('progress').textContent=model.practice?'연습':`${Math.min(model.step,4)} / 4`;
    $('mission').textContent=model.bursting?'아랫집이 화면의 경계를 부쉈어요':model.demoRemaining>0?(model.demoKind==='burst'?'폭발 연출을 재생하고 있어요':'표정 변화와 진정을 살펴봐요'):`${model.step%2===0?'문 열기':'문 닫기'} · ${controller.route.name}`;
    const states={calm:'아랫집은 아직 편안해요.',listen:'작은 소리에 눈썹이 움직여요.',annoyed:'불편한 표정으로 참고 있어요.',pain:'위층 화면에 눌려 괴로워해요.',wrong:'방금, 얼굴이 달라졌어요. 소리를 멈춰요.',settling:'압박이 풀리며 다시 편안해져요.',burst:'더는 참을 수 없었어요.'};
    $('neighborStatus').textContent=states[model.mode]||states.calm;
    $('doorStatus').textContent=model.bursting?'경계가 무너졌어요.':model.off?'경로를 벗어나 문이 덜컹거려요.':model.grab?model.speedState==='good'?'좋아요, 지금 속도 그대로.':model.speedState==='slow'?'이 구간은 조금 더 빠르게.':model.speedState==='fast'?'이 구간은 조금 더 천천히.':'멈추면 아래층도 편해져요.':'손 모양을 잡고 경로를 따라가요.';
    document.documentElement.dataset.mood=model.eerie?'wrong':'soft';
    document.querySelectorAll('.step-dots i').forEach((el,i)=>el.classList.toggle('done',i<model.step));
  }
  document.querySelectorAll('.themes button').forEach(el=>el.addEventListener('click',()=>setTheme(el.dataset.theme)));
  $('start').addEventListener('click',()=>start());$('startPractice').addEventListener('click',()=>start(true));$('again').addEventListener('click',()=>start());$('keepPractice').addEventListener('click',()=>start(true));$('reset').addEventListener('click',()=>start(model.practice));$('pause').addEventListener('click',pause);$('resume').addEventListener('click',pause);
  $('demo').addEventListener('click',()=>{start(true);model.demo();updateUI();});
  $('burstDemo').addEventListener('click',()=>{start(false);model.demo(true);updateUI();});
  $('sound').addEventListener('click',()=>{muted=!muted;initAudio();$('sound').textContent=muted?'소리 OFF':'소리 ON';$('sound').setAttribute('aria-label',muted?'소리 켜기':'소리 끄기');if(audio)audio.master.gain.setTargetAtTime(muted?0:.42,audio.ctx.currentTime,.06);});
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&model.running&&!model.over)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&model.running&&!model.over&&!model.paused)pause();});
  function paint(){const point=controller.point();QuietArt.paint(surface,model,{theme,route:controller.route,distance:controller.distance,point,cursor,contact,reduced,demo:model.demoRemaining>0});svg.innerHTML=surface.content();}
  function frame(now){const dt=Math.min(.045,(now-lastFrame)/1000);lastFrame=now;model.update(dt);
    for(const event of model.events.splice(0)){
      if(event.type==='win'){showResult();tone(540,.07,.35);}
      else if(event.type==='burst'){tone(42,.15,.8);tone(85,.08,.5);stage.classList.remove('dragging');}
      else if(event.type==='turn'){tone(65,.075,.44);tone(137,.03,.32);}
      else if(event.type==='slam')tone(model.eerie?65:110,.07,.2);
      else if(event.type==='step')tone(480,.025,.1);
      else if(event.type==='calmed')tone(430,.015,.15);
    }
    if(model.over&&$('result').hidden&&(model.won||model.burstTime>=2.45))showResult();
    if(audio){const active=model.running&&!model.paused&&!model.over;audio.gain.gain.setTargetAtTime(active?model.noise*(model.eerie?.1:.06):0,audio.ctx.currentTime,.06);audio.filter.frequency.setTargetAtTime(model.eerie?160+model.noise*400:theme==='comic'?600+model.noise*1400:450+model.noise*700,audio.ctx.currentTime,.1);}
    if(now-lastPaint>42){paint();lastPaint=now;}if(now-lastUI>120){updateUI();lastUI=now;}requestAnimationFrame(frame);
  }
  setTheme(theme);paint();requestAnimationFrame(frame);
  Object.defineProperty(window,'quiet2dSnapshot',{get:()=>({...model.snapshot(),theme,pathProgress:controller.distance/controller.route.length,route:controller.route.name,zone:controller.route.segments[controller.point().index].zone.id})});
})();
