/* The downstairs portrait and pressure seam are all live SVG geometry. */
(function(root){
  'use strict';
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const ink='#4e6570',white='#fffdf6';
  function text(c,t,x,y,size,color,align='left',bold=false){c.fillStyle=color;c.font=`${bold?700:400} ${size}px "Malgun Gothic", sans-serif`;c.textAlign=align;c.textBaseline='middle';c.fillText(t,x,y);}
  function line(c,pts,color,width=2){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
  function ellipse(c,x,y,rx,ry,fill,stroke,width=2){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
  function poly(c,pts,fill,stroke,width=2){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
  function round(c,x,y,w,h,r,fill,stroke,width=1){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
  function layout(s){return s.layout?s.layout():{split:460+(s.pressure||0)*218,scale:1+(s.pressure||0)*218/460,lowerTop:484+(s.pressure||0)*218,lowerHeight:316-(s.pressure||0)*218};}
  function star(c,x,y,rx,ry,fill,n=16){const pts=[];for(let i=0;i<n*2;i++){const a=i*Math.PI/n,r=i%2?.48:1;pts.push([x+Math.cos(a)*rx*r,y+Math.sin(a)*ry*r]);}poly(c,pts,fill);}
  function paw(c,x,y,rx,ry,wrong){ellipse(c,x,y,rx,ry,wrong?'#e7e9dc':white,wrong?'#101719':ink,wrong?3:2.5);for(let i=-1;i<=1;i++)line(c,[[x+i*rx*.28,y-ry*.4],[x+i*rx*.28,y+ry*.18]],wrong?'#1c2527':ink,1.5);}
  function face(c,s,cx,cy,rx,ry,burst=false){
    const wrong=!!s.eerie||burst,pressure=s.pressure||0,pain=s.stress>38&&!wrong,annoyed=s.stress>16&&!wrong;
    const outline=wrong?'#11191c':ink,fur=wrong?'#eceee3':white;
    c.save();c.translate(cx,cy);c.scale(rx/245,ry/100);
    // Small round ears and one soft, broad head remain recognizable after the cut.
    ellipse(c,-148,-91,31,34,fur,outline,3.5);ellipse(c,148,-91,31,34,fur,outline,3.5);
    c.beginPath();c.moveTo(-218,-42);c.bezierCurveTo(-193,-90,-112,-110,0,-109);c.bezierCurveTo(112,-110,193,-90,218,-42);c.bezierCurveTo(268,36,232,101,145,108);c.bezierCurveTo(74,124,-74,124,-145,108);c.bezierCurveTo(-232,101,-268,36,-218,-42);c.closePath();c.fillStyle=fur;c.fill();c.strokeStyle=outline;c.lineWidth=wrong?4:3.5;c.stroke();
    for(const side of [-1,1]){
      ellipse(c,side*160,26,36,20,wrong?'#b99499':'#f0bec8');
      for(let i=0;i<3;i++)line(c,[[side*160-13+i*13,20],[side*160-18+i*13,31]],wrong?'#59464e':ink,2.5);
    }
    if(wrong){
      // A hard shape change: the highlights disappear and the smile becomes too wide.
      for(const side of [-1,1]){
        ellipse(c,side*85,-23,17,29,'#090f14');ellipse(c,side*85,-21,burst?2.8:1.3,burst?2.8:3,burst?'#da6a66':'#d9e3d1');
        line(c,[[side*116,-64],[side*93,-70],[side*69,-67]],'#182025',2);
        line(c,[[side*111,5],[side*123,22],[side*116,40]],'#50585a',1.4);
      }
      c.beginPath();c.moveTo(-104,28);c.quadraticCurveTo(0,58,104,28);c.quadraticCurveTo(82,94,0,96);c.quadraticCurveTo(-82,94,-104,28);c.closePath();c.fillStyle='#101719';c.fill();c.strokeStyle='#101719';c.lineWidth=3;c.stroke();
      c.beginPath();c.moveTo(-94,34);c.quadraticCurveTo(0,61,94,34);c.lineTo(79,54);c.quadraticCurveTo(0,76,-79,54);c.closePath();c.fillStyle='#e4e6d8';c.fill();
      for(let i=-4;i<=4;i++){const x=i*17;line(c,[[x,46-Math.abs(i)*1.6],[x,65-Math.abs(i)*2]],'#1b2427',1.7);}
      for(let i=-8;i<=8;i++){const x=i*12;line(c,[[x,-95+Math.abs(i)*.8],[x+Math.sin(i)*2,-61+Math.abs(i)*.9]],'#687272',.7);}
      ellipse(c,0,10,4,2.5,'#101719');
    }else{
      const blink=!annoyed&&Math.sin(s.time*1.1)>.97;
      for(const side of [-1,1]){
        if(pain){line(c,[[side*85-17,-38],[side*85+6,-24],[side*85-17,-8]],outline,4);}
        else if(blink){c.beginPath();c.moveTo(side*85-15,-20);c.quadraticCurveTo(side*85,-30,side*85+15,-20);c.strokeStyle=outline;c.lineWidth=4;c.stroke();}
        else{ellipse(c,side*85,-22,18,25,outline);ellipse(c,side*85-4,-29,6.8,7.5,'#fff');ellipse(c,side*85+6,-13,4,2.7,'#d8e9e9');}
        if(annoyed)line(c,[[side*85-side*22,-67],[side*85+side*19,-53]],outline,4);else line(c,[[side*85-12,-65],[side*85+10,-67]],outline,3);
      }
      ellipse(c,0,11,5,3.5,outline);
      if(pain)line(c,[[-36,50],[-24,40],[-12,51],[0,42],[12,51],[24,40],[36,50]],outline,3);
      else if(annoyed){c.beginPath();c.moveTo(-22,55);c.quadraticCurveTo(0,37,22,55);c.strokeStyle=outline;c.lineWidth=3;c.stroke();}
      else{c.beginPath();c.moveTo(-19,32);c.quadraticCurveTo(-10,47,0,34);c.quadraticCurveTo(10,47,19,32);c.strokeStyle=outline;c.lineWidth=3;c.stroke();ellipse(c,0,47,7,7,'#be8e91');}
      if(pain||s.noise>.4){for(const side of [-1,1]){c.beginPath();c.moveTo(side*126,-32);c.bezierCurveTo(side*143,-10,side*139,9,side*127,4);c.bezierCurveTo(side*117,0,side*123,-14,side*126,-32);c.fillStyle='#b3d7e0';c.fill();c.strokeStyle=ink;c.lineWidth=1.8;c.stroke();}}
      if(pressure>.12){for(let i=0;i<3;i++)line(c,[[192+i*9,-66+i*6],[199+i*9,-55+i*6]],ink,1.4);}
    }
    c.restore();
  }
  function lower(c,s,p,theme,options={}){
    const l=layout(s),wrong=s.eerie,bg=wrong?'#172125':theme==='comic'?'#f5e6c6':theme==='horror'?'#809081':'#f6e6df';
    c.fillStyle=bg;c.fillRect(0,l.lowerTop,1280,l.lowerHeight);
    if(s.bursting)return;
    c.save();c.beginPath();c.rect(0,l.lowerTop,1280,l.lowerHeight);c.clip();
    if(wrong){for(let i=0;i<38;i++){const x=i*41;line(c,[[x,l.lowerTop],[640+(x-640)*1.4,800]],i%3?'#253438':'#493438',1);}c.globalAlpha=.1;for(let i=0;i<75;i++)c.fillRect((i*173)%1280,l.lowerTop+(i*23)%l.lowerHeight,20+(i%5)*7,1);c.globalAlpha=1;}
    else{for(let i=0;i<12;i++){const x=45+i*112,y=l.lowerTop+50+(i%3)*55;ellipse(c,x,y,3,3,i%2?'#e4bebc':'#e4d4ba');}line(c,[[0,794],[1280,794]],'#dbc8ba',2);}
    const rx=245+s.pressure*130,ry=Math.max(28,l.lowerHeight*.34),cy=l.lowerTop+l.lowerHeight*.56+Math.sin(s.time*1.8)*Math.max(0,1-s.pressure)*1.5;
    ellipse(c,640,795,rx*.92,8,wrong?'#080e12':'#dec9be');face(c,s,640,cy,rx,ry);
    if(s.pressure>.08){for(const side of [-1,1])paw(c,640+side*(rx-16),l.lowerTop+16,34+s.pressure*10,16,wrong);}
    else{paw(c,640-rx+10,778,34,17,false);paw(c,640+rx-10,778,34,17,false);}
    c.restore();
    const labelColor=wrong?'#bdc9c3':theme==='horror'?'#203c37':'#887676';
    text(c,'202호 / 아랫집의 얼굴',27,l.lowerTop+25,11,labelColor,'left',true);
    const label=wrong?'방금, 표정이 바뀌었다.':s.mode==='pain'?'그만… 눌리지 않게 해줘.':s.mode==='annoyed'?'조금씩, 참는 중.':s.mode==='listen'?'방금 무슨 소리였지?':s.mode==='settling'?'휴… 다시 조용해졌어.':'아직은, 포근한 밤.';
    text(c,label,1252,l.lowerTop+25,12,labelColor,'right');
    if(l.lowerHeight>190){
      text(c,wrong?'웃고 있는데,':'작은 소리에도',55,l.lowerTop+119,13,labelColor);text(c,wrong?'반갑지 않다.':'모두 느끼고 있어요.',55,l.lowerTop+143,13,labelColor);
      text(c,wrong?'네가 내는 소리.':'쉿, 살살 부탁해.',1225,l.lowerTop+143,14,labelColor,'right',wrong);
      if(!wrong){round(c,1085,l.lowerTop+178,140,30,15,'#fff9f1','#ddc6bd');text(c,'소음이 멎으면 편안해져요',1155,l.lowerTop+193,9,'#9b8982','center');}
    }
  }
  function seam(c,s,p){
    const {split}=layout(s),wrong=s.eerie;
    c.fillStyle=wrong?'#2a3435':'#bd9e89';c.fillRect(0,split,1280,24);line(c,[[0,split],[1280,split]],wrong?'#111719':'#927568',2.5);line(c,[[0,split+24],[1280,split+24]],wrong?'#070b10':'#927568',3);
    for(let i=0;i<31;i++){const hh=2+s.noise*14*(.4+.6*Math.abs(Math.sin(s.time*13+i*.8)));round(c,565+i*5,split+12-hh/2,2,hh,1,wrong?'#b77677':'#fff1db');}
    text(c,wrong?'더 누르지 마.':'위층의 소리가 아래층을 눌러요',26,split+12,9,wrong?'#c5c9b8':'#fff4e0');
    if(s.pressure>.1){for(const side of [-1,1]){const x=640+side*350;poly(c,[[x-5,split+8],[x+5,split+8],[x,split+17]],wrong?'#b27879':'#f5ddbd');}}
    if(wrong){for(const x of [340,616,922])line(c,[[x-24,split],[x-8,split+8],[x-18,split+15],[x+8,split+24]],'#080f13',2);}
  }
  function upper(c,markup,s,options={}){
    const l=layout(s);c.defs.push('<clipPath id="upperBounds"><path d="M0 0h1280v460H0Z"/></clipPath>');c.defs.push(`<g id="upperScene" clip-path="url(#upperBounds)">${markup}</g>`);
    if(!s.bursting){c.mark(`<g data-scene="upper" transform="scale(1 ${l.scale})"><use href="#upperScene"/></g>`);return;}
    const t=Math.max(0,s.burstTime-.13),e=clamp(t/.92),ease=1-Math.pow(1-e,3);
    for(let row=0;row<3;row++)for(let col=0;col<4;col++){
      const i=row*4+col,w=320,h=460/3,x=col*w,y=row*h,cx=x+w/2,cy=(y+h/2)*l.scale,id=`shard${i}`;
      c.defs.push(`<clipPath id="${id}"><path d="M${x} ${y}h${w}v${h}h-${w}Z"/></clipPath>`);
      const dx=(cx-640)*ease*.7,dy=(-190-(2-row)*60)*ease+t*t*22,rotation=options.reduced?0:(i%2?1:-1)*ease*(12+i*2);
      c.mark(`<g data-shard="${i}" opacity="${1-clamp((t-1.2)/1.2)*.75}" transform="translate(${dx} ${dy}) rotate(${rotation} ${cx} ${cy})"><g transform="scale(1 ${l.scale})" clip-path="url(#${id})"><use href="#upperScene"/></g></g>`);
    }
  }
  function impact(c,s,p,options={}){
    if(!s.bursting)return;const t=s.burstTime,{split}=layout(s),e=clamp((t-.1)/.54),rise=1-Math.pow(1-e,3);
    const cx=640,cy=758-rise*343,rx=375+rise*72,ry=34+rise*178;
    c.save();
    if(t>.1){star(c,640,split-12,500+rise*130,110+rise*360,'#080f14',22);star(c,640,split-10,410+rise*80,80+rise*275,'#69474a',22);star(c,640,split-10,370+rise*80,70+rise*240,'#141d21',22);}
    if(!options.reduced&&t<.7){c.translate(Math.sin(t*66)*(1-e)*8,Math.cos(t*51)*(1-e)*4);}
    face(c,s,cx,cy,rx,ry,true);
    for(const side of [-1,1]){const x=640+side*(360+rise*40),y=split+10-rise*220;paw(c,x,y,52,34,true);for(let i=0;i<3;i++){const tx=x+side*(70+i*44),ty=y-30-i*45;poly(c,[[tx,ty],[tx+side*23,ty-14],[tx+side*28,ty+22]],i%2?'#c6c2a6':'#9c8f78','#172025',1);}}
    if(t>.6){text(c,'조 용 히 .',640,86,options.reduced?35:38,'#eeeadd','center',true);text(c,'아래층의 한계가, 위층을 부쉈다.',640,130,12,'#bdbab0','center');}
    if(t<.22){c.globalAlpha=.28;c.fillStyle='#181f23';c.fillRect(0,0,1280,800);c.globalAlpha=1;}
    c.restore();
  }
  const api={lower,seam,upper,impact,layout,face};root.QuietPortrait=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
