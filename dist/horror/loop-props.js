(function (root) {
  'use strict';
  const SVG = 'http://www.w3.org/2000/svg';
  const SEGMENTS = ['abcedf', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgecd', 'abc', 'abcdefg', 'abfgcd'];
  const STROKES = { a:[2,0,12,3], b:[13,2,3,12], c:[13,16,3,12], d:[2,27,12,3], e:[0,16,3,12], f:[0,2,3,12], g:[2,13,12,3] };
  function digits(value, x, y, scale = 1, ink = '#fff') {
    return `<g transform="translate(${x} ${y}) scale(${scale})" fill="${ink}">${String(value).split('').map((v,i) => `<g transform="translate(${i*22} 0)">${[...SEGMENTS[Number(v)]].map(k => { const r=STROKES[k];return `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}"/>`; }).join('')}</g>`).join('')}</g>`;
  }
  function icon(kind) {
    const shapes = {
      key:'<path d="M3 5h8v8H8v3h8v-3h3v3h3v4H6v-7H3ZM6 8v2h2V8Z"/>',
      note:'<path d="M5 2h11l5 5v16H5Zm10 2v5h4M8 14h10m-10 4h7"/>',
      code:'<path d="M4 2h12l5 5v16H4Zm11 2v5h4M7 13h2v6H7Zm5 0h2v6h-2Zm5 0h2v6h-2Z"/>',
      pin:'<path d="M6 3h13v4H6Zm5 4h4v14h-4Z"/>',
      pick:'<path d="M4 22V8q0-6 6-6t6 6v14h-3V8q0-3-3-3T7 8v14Z"/>',
      club:'<path d="M5 2h3v16h13v5H9v-3H5Z"/>'
    };
    return `<svg viewBox="0 0 26 26" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter">${shapes[kind] || shapes.note}</g></svg>`;
  }
  class Props {
    constructor(model, art, scene) {
      this.model=model;this.art=art;this.scene=scene;this.panel='';this.room=-1;this.camera=null;this.drag=null;this.noteRoom=2;
      this.buttons={};
      for(const kind of ['key','note','code','pick','club','hardware','strike']) {
        const button=document.createElement('button');button.className='hotspot pickup';button.hidden=true;
        button.id=kind+'Hit';button.setAttribute('aria-label',({key:'열쇠 줍기',note:'메모 줍기',code:'번호 메모 줍기',pick:'락픽 줍기',club:'골프채 줍기',hardware:'문 잠금 장치',strike:'골프채로 문 두드리기'})[kind]);
        scene.append(button);this.buttons[kind]=button;
        if(kind!=='hardware')button.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();if(kind==='strike')model.strike();else if(model.collect(kind)&&(kind==='note'||kind==='code')){this.noteRoom=model.room;this.open(kind==='code'?'memo':'note');}});
      }
      const hardware=this.buttons.hardware;hardware.classList.add('hardware');
      hardware.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;e.preventDefault();e.stopPropagation();const r=model.rule;
        if(r.hinge&&!model.unlocked){this.drag={id:e.pointerId,y:e.clientY};hardware.setPointerCapture(e.pointerId);}
        else if(r.code&&!model.unlocked)this.open('code');
        else if(r.pick&&!model.unlocked){if(model.inventory.has('pick'))this.open('pick');}
        else if(r.lock&&!model.unlocked)model.useLock();
      });
      hardware.addEventListener('pointermove',e=>{if(!this.drag||e.pointerId!==this.drag.id)return;const dy=this.drag.y-e.clientY;this.drag.y=e.clientY;model.dragHardware(dy/((this.camera?.scale||1)*145));});
      const end=e=>{if(this.drag&&e.pointerId===this.drag.id){this.drag=null;if(hardware.hasPointerCapture(e.pointerId))hardware.releasePointerCapture(e.pointerId);}};
      hardware.addEventListener('pointerup',end);hardware.addEventListener('pointercancel',end);
      this.pocket=document.createElement('div');this.pocket.className='pockets';this.pocket.setAttribute('aria-label','주운 물건');scene.append(this.pocket);
      this.pocketButtons={};
      for(const item of ['key','note','code','pin','pick','club']){
        const b=document.createElement('button');b.hidden=true;b.innerHTML=icon(item);b.setAttribute('aria-label',({key:'주운 열쇠',note:'주운 메모 보기',code:'번호 메모 보기',pin:'뽑은 경첩 핀',pick:'주운 락픽',club:'주운 골프채'})[item]);
        b.addEventListener('click',()=>{if(item==='note'){const pages=model.snapshot().notePages,i=pages.indexOf(this.noteRoom);this.noteRoom=pages[(i+1)%pages.length];}if(item==='note'||item==='code')this.open(item==='code'?'memo':'note');});this.pocket.append(b);this.pocketButtons[item]=b;
      }
      this.overlay=document.createElement('div');this.overlay.className='inspection';this.overlay.hidden=true;
      this.overlay.innerHTML='<div class="inspection-shade"></div><div class="inspection-object"></div>';
      this.object=this.overlay.lastElementChild;scene.append(this.overlay);
      this.overlay.firstElementChild.addEventListener('pointerdown',()=>this.close());
      document.addEventListener('keydown',e=>{if(this.panel&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close();}},true);
      window.addEventListener('blur',()=>this.model.setTorque(false));
    }
    open(kind){if(this.beforeOpen)this.beforeOpen();this.model.release();this.model.setTorque(false);this.panel=kind;this.flipped=false;this.overlay.hidden=false;this.drawPanel();}
    close(){this.panel='';this.overlay.hidden=true;this.model.setTorque(false);}
    paper(code=false,x=24,y=60){
      const fragments={2:['천장은 밤마다','누군가의 바닥이','되었다.'],6:['접어 보낸 종이는','문 아래에서','다시 돌아왔다.'],9:['발끝을 들자','의자 하나가','끝내 비어 있었다.']};
      const lines=code?['같은 밤을 가리키는','시계는 하나도','없었다.']:(fragments[this.noteRoom]||fragments[2]);
      if(!code&&!this.flipped&&this.art.memoryPhoto)return `<g><path d="M${x} ${y}h134v154l-9-2-12 3-14-2-17 3-19-3-20 2-16-3-27 2Z" fill="#fff" stroke="#000" stroke-width="2"/><g transform="translate(${x+11} ${y+17})">${this.art.memoryPhoto(this.noteRoom)}</g><path d="M${x+105} ${y+139}h13v-6m-6 1 6-6 6 6" fill="none" stroke="#000" stroke-width="2"/></g>`;
      const clocks=code?[3,1,7].map((hour,i)=>{const cx=x+30+i*37,cy=y+49,a=hour*Math.PI/6-Math.PI/2;return `<g fill="none" stroke="#000" stroke-width="1.5"><path d="M${cx-12} ${cy-12}h24v24h-24Z"/><path d="M${cx} ${cy-9}v9l${Math.round(Math.cos(a)*8)} ${Math.round(Math.sin(a)*8)}"/></g>`;}).join(''):'';
      const writing=`<text x="${x+13}" y="${y+(code?92:49)}" fill="#000" font-family="Batang,serif" font-size="11">${lines.map((line,i)=>`<tspan x="${x+13}" dy="${i?19:0}">${line}</tspan>`).join('')}</text>`;
      return `<g><path d="M${x} ${y}h134v154l-9-4-8 6-10-5-11 4-9-4-10 5-12-5-11 4-9-3-13 4-10-5-12 4V${y}Z" fill="#fff" stroke="#000" stroke-width="3"/><path d="M${x+12} ${y+12}h102m-102 121h43" stroke="#000" stroke-width="2"/>${clocks}${writing}</g>`;
    }
    drawPanel(){
      const prefix='<svg viewBox="0 0 520 340" shape-rendering="crispEdges" aria-hidden="true"><defs><pattern id="panelDots" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#000"/><rect width="1" height="1" fill="#fff"/></pattern></defs>';
      let art='',controls='';
      if(this.panel==='code'){
        art=(this.model.inventory.has('code')?this.paper(true):'')+'<path d="M244 139V75h22V51h81v24h22v64h-24V81h-77v58Z" fill="url(#panelDots)" stroke="#fff" stroke-width="3"/><path d="M215 132h188v149H215Z" fill="#000" stroke="#fff" stroke-width="4"/><path d="M226 144h166v119H226Z" fill="url(#panelDots)"/><g id="dialArt"></g><path d="M285 295h49v18h-49Z" fill="#fff"/><path d="m296 303 8 6 18-15" stroke="#000" fill="none" stroke-width="4"/>';
        for(let i=0;i<3;i++)controls+=`<button class="dial dial-up" data-dial="${i}" data-step="1" style="left:${(232+i*53)/5.2}%;top:45%;width:9%;height:15%" aria-label="${i+1}번째 번호 올리기"></button><button class="dial dial-down" data-dial="${i}" data-step="-1" style="left:${(232+i*53)/5.2}%;top:60%;width:9%;height:15%" aria-label="${i+1}번째 번호 내리기"></button>`;
        controls+='<button class="confirm" style="left:54%;top:85%;width:13%;height:10%" aria-label="번호 자물쇠 열기"></button>';
      }else if(this.panel==='pick'){
        art='<path d="M95 49h330v245H95Z" fill="#000" stroke="#fff" stroke-width="3"/><path d="M108 62h304v219H108Z" fill="url(#panelDots)"/><circle cx="260" cy="170" r="83" fill="#000" stroke="#fff" stroke-width="7"/><g id="barrel"><path d="M244 145h32v49h-32Z" fill="#fff"/><path d="M252 153h16v34h-16Z" fill="#000"/><path d="M257 176h109v12H257Z" fill="#fff"/><path d="M353 176h18v55h-18Z" fill="#fff"/></g><g id="pickNeedle"><path d="M258 165V57h5v108Z" fill="#fff"/><path d="M255 57h11V31h-11Z" fill="#fff" stroke="#000" stroke-width="2"/></g><path d="M203 294h113v21H203Z" fill="#000" stroke="#fff" stroke-width="2"/><path d="M210 305h44m-7-5 7 5-7 5m24-5h36m-7-5 7 5-7 5" fill="none" stroke="#fff" stroke-width="2"/>';
        controls='<button class="angle-handle" aria-label="락픽 각도 조절"></button><button class="torque-handle" aria-label="회전 도구 누르고 돌리기"></button>';
      }else {art=this.paper(this.panel==='memo',190,70);if(this.panel==='note')controls='<button class="photo-flip" style="left:36%;top:20%;width:28%;height:49%" aria-label="사진 앞뒷면 보기"></button>';}
      this.object.innerHTML=prefix+art+'</svg>'+controls;
      const flip=this.object.querySelector('.photo-flip');if(flip)flip.addEventListener('click',()=>{this.flipped=!this.flipped;this.drawPanel();});
      if(this.panel==='code'){
        this.object.querySelectorAll('[data-dial]').forEach(b=>b.addEventListener('click',()=>this.model.turnDial(Number(b.dataset.dial),Number(b.dataset.step))));
        this.object.querySelector('.confirm').addEventListener('click',()=>{this.model.confirmCode();if(this.model.unlocked)this.close();});
      }
      if(this.panel==='pick'){
        const angle=this.object.querySelector('.angle-handle'),torque=this.object.querySelector('.torque-handle');let picking=null;
        const turn=e=>{const r=this.object.getBoundingClientRect(),cx=r.left+r.width*.5,cy=r.top+r.height*.5;this.model.setPickAngle(Math.max(-1,Math.min(1,Math.atan2(e.clientX-cx,cy-e.clientY)/1.15)));};
        angle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();picking=e.pointerId;angle.setPointerCapture(e.pointerId);turn(e);});
        angle.addEventListener('pointermove',e=>{if(e.pointerId===picking)turn(e);});
        const stop=e=>{if(e.pointerId===picking){picking=null;if(angle.hasPointerCapture(e.pointerId))angle.releasePointerCapture(e.pointerId);}};
        angle.addEventListener('pointerup',stop);angle.addEventListener('pointercancel',stop);
        torque.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();torque.setPointerCapture(e.pointerId);this.model.setTorque(true);});
        const release=()=>this.model.setTorque(false);torque.addEventListener('pointerup',release);torque.addEventListener('pointercancel',release);torque.addEventListener('lostpointercapture',release);
      }
      this.renderPanel(this.model.snapshot());
    }
    renderPanel(s){
      if(!this.panel)return;
      if(s.unlocked&&['code','pick'].includes(this.panel)){this.close();return;}
      if(this.panel==='code'){
        const group=this.object.querySelector('#dialArt');
        if(group)group.innerHTML=s.dialValues.map((v,i)=>`<g><rect x="${232+i*53}" y="156" width="43" height="91" fill="#000" stroke="#fff" stroke-width="2"/><path d="m${246+i*53} 167 7-6 7 6m-14 68 7 6 7-6" stroke="#fff" fill="none"/>${digits(v,244+i*53,180,1.15)}</g>`).join('');
      }
      if(this.panel==='pick'){
        this.object.querySelector('#barrel').setAttribute('transform',`rotate(${s.barrel*88} 260 170)`);
        this.object.querySelector('#pickNeedle').setAttribute('transform',`rotate(${s.pickAngle*66 + Math.sin(s.total*43)*s.pickStress*3} 260 170)`);
        const angle=this.object.querySelector('.angle-handle'),theta=s.pickAngle*1.15;
        angle.style.left=(50+Math.sin(theta)*24)+'%';angle.style.top=(50-Math.cos(theta)*38)+'%';
        this.object.classList.toggle('strained',s.pickStress>.55);
      }
    }
    hint(s){
      if(this.panel||!this.model.active()||s.unlocked)return null;const r=this.model.rule;
      if(r.lock)return {point:this.art.propPoint(s.keyAvailable?'key':'lock'),kind:'tap'};
      if(r.code)return {point:this.art.propPoint(s.codeAvailable?'code':'lock'),kind:'tap'};
      if(r.pick)return {point:this.art.propPoint(s.pickAvailable?'pick':'lock'),kind:'tap'};
      if(r.hinge)return {point:this.art.propPoint('hinge'),kind:'up'};
      if(r.breakable)return {point:s.clubAvailable?this.art.propPoint('club'):{x:900,y:460},kind:'tap'};
      return null;
    }
    render(s,cam,point,hotspot){
      this.camera=cam;
      if(this.room!==s.room){this.room=s.room;this.close();this.drag=null;}
      const available={key:s.keyAvailable,note:s.noteAvailable,code:s.codeAvailable,pick:s.pickAvailable,club:s.clubAvailable};
      for(const [kind,on] of Object.entries(available)){
        const button=this.buttons[kind];button.hidden=!(on&&this.model.active()&&!this.panel);
        if(on)hotspot(button,this.art.propPoint(kind),kind==='club'?80:65,kind==='club'?220:65);
        const prop=document.getElementById('a'+kind[0].toUpperCase()+kind.slice(1)+'Item')||document.getElementById('a'+kind+'Item');if(prop)prop.setAttribute('visibility',on?'visible':'hidden');
      }
      const r=this.model.rule, hardware=this.buttons.hardware;
      hardware.hidden=!(this.model.active()&&!s.unlocked&&(r.lock||r.code||r.pick||r.hinge)&&!this.panel);
      if(!hardware.hidden){const p=this.art.propPoint(r.hinge?'hinge':'lock');hotspot(hardware,{x:p.x,y:p.y-(r.hinge?s.pinProgress*125:0)},80,r.hinge?130:100);}
      hardware.style.cursor=r.hinge?'ns-resize':'pointer';
      const lock=document.getElementById('alock');if(lock)lock.setAttribute('visibility',s.unlocked?'hidden':'visible');
      const pin=document.getElementById('ahingePin');if(pin){pin.setAttribute('transform',`translate(0 ${-s.pinProgress*125})`);pin.setAttribute('visibility',s.pinProgress>=.95?'hidden':'visible');}
      const strike=this.buttons.strike;strike.hidden=!(r.breakable&&!s.unlocked&&this.model.active()&&!this.panel);if(!strike.hidden)hotspot(strike,{x:900,y:470},310,660);
      for(const [item,b] of Object.entries(this.pocketButtons))b.hidden=!s.inventory.includes(item);
      this.pocket.hidden=!s.inventory.length||s.state==='crossing';
      for(let i=1;i<=3;i++){const damage=document.getElementById('adamage'+i);if(damage)damage.setAttribute('opacity',s.damage>=i/3-.001?1:0);}
      this.renderPanel(s);
      this.scene.classList.toggle('inspecting',!!this.panel);
    }
  }
  root.LoopProps=Props;
})(window);
