/* Original, code-drawn 2D artwork. The same painter runs in browser and QA. */
(function(root){
  'use strict';
  const P={
    comic:{ink:'#393441',wall:'#efdab0',wall2:'#f7e7bf',floor:'#ca9d70',wood:'#a97752',frame:'#835d44',glass:'#c2d3bb',shadow:'#704b3a33',paper:'#fff7df',accent:'#e9ad72',light:'#ffe9a7',sofa:'#79a796',sofa2:'#9dc1aa',plant:'#6f9b73',night:'#456171',line:3.5},
    cute:{ink:'#74605b',wall:'#f7e8dc',wall2:'#fff2e1',floor:'#dfbf9a',wood:'#c79d80',frame:'#b08a72',glass:'#d7e7d6',shadow:'#a9816920',paper:'#fffaf1',accent:'#d9b6b3',light:'#ffedc6',sofa:'#afd3c2',sofa2:'#cbe1cf',plant:'#a0bda0',night:'#a1b9c7',line:2.3},
    horror:{ink:'#b1b99b',wall:'#536058',wall2:'#3a4b43',floor:'#7b7158',wood:'#777157',frame:'#b3ac88',glass:'#647a6c',shadow:'#010908a8',paper:'#27382f',accent:'#afa27b',light:'#d6c188',sofa:'#4e6153',sofa2:'#637261',plant:'#536a53',night:'#152a31',line:1.5}
  };
  const text=(c,t,x,y,size=15,color='#66514b',align='left',bold=false)=>{c.fillStyle=color;c.font=`${bold?'700':'400'} ${size}px "Malgun Gothic", sans-serif`;c.textAlign=align;c.textBaseline='middle';c.fillText(t,x,y);};
  function rr(c,x,y,w,h,r,fill,stroke,lw=2){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
  function line(c,points,color,width=2){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
  function ellipse(c,x,y,rx,ry,fill,stroke,lw=2){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
  function poly(c,points,fill,stroke,lw=2){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
  function star(c,x,y,r,color,rotation=0){const pts=[];for(let i=0;i<8;i++){let a=i*Math.PI/4+rotation,rr=i%2?r*.35:r;pts.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);}poly(c,pts,color);}
  function heart(c,x,y,size,color){c.save();c.translate(x,y);c.scale(size,size);c.beginPath();c.moveTo(0,.5);c.bezierCurveTo(-1,-.05,-.8,-1,0,-.5);c.bezierCurveTo(.8,-1,1,-.05,0,.5);c.fillStyle=color;c.fill();c.restore();}
  function plant(c,x,y,p,cute=false,scale=1){c.save();c.translate(x,y);c.scale(scale,scale);poly(c,[[-17,-1],[17,-1],[12,27],[-12,27]],p.wood,p.ink,p.line);line(c,[[0,0],[0,-59]],p.plant,3);for(let i=0;i<5;i++){c.save();c.translate(0,-16-i*10);c.rotate(i%2?-.7:.7);ellipse(c,i%2?-9:9,-3,14,7,p.plant,p.ink,1);c.restore();}if(cute){ellipse(c,-4,12,1.4,2,p.ink);ellipse(c,4,12,1.4,2,p.ink);line(c,[[-2,17],[0,19],[2,17]],p.ink,1);}c.restore();}
  function flower(c,x,y,r,p){for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ellipse(c,x+Math.cos(a)*r*.6,y+Math.sin(a)*r*.6,r*.45,r*.45,p.accent);}ellipse(c,x,y,r*.34,r*.34,p.light);}
  function mug(c,x,y,p,cute=false,scale=1){c.save();c.translate(x,y);c.scale(scale,scale);ellipse(c,16,-8,7,8,null,p.ink,2);rr(c,-13,-20,27,25,5,p.paper,p.ink,2);ellipse(c,0,-19,11,3,p.wood,p.ink,1);if(cute)heart(c,0,-7,5,'#d49e9c');else line(c,[[-6,-12],[5,-12]],p.accent,3);c.restore();}
  function wallFrame(c,x,y,w,h,p,cute){rr(c,x,y,w,h,3,p.wood,p.ink,p.line);rr(c,x+6,y+6,w-12,h-12,1,p.paper);if(cute){flower(c,x+w/2,y+h/2,Math.min(w,h)*.26,p);}else{poly(c,[[x+12,y+h-13],[x+w*.45,y+18],[x+w-10,y+h-13]],p.plant);ellipse(c,x+w*.75,y+17,7,7,p.accent);}}
  function bubble(c,x,y,t,p,theme){
    c.save();const width=Math.min(300,Math.max(65,t.length*14+25));x=Math.max(width/2+18,Math.min(1262-width/2,x));
    if(theme==='comic'){const pts=[];for(let i=0;i<16;i++){let a=i*Math.PI/8;pts.push([x+Math.cos(a)*(i%2?width/2:width/2+8),y+Math.sin(a)*(i%2?22:29)]);}poly(c,pts,p.paper,p.ink,2.8);}
    else{rr(c,x-width/2,y-23,width,43,13,p.paper,p.ink,theme==='cute'?2:1);poly(c,[[x-8,y+18],[x-5,y+32],[x+7,y+18]],p.paper,p.ink,1.5);}
    text(c,t,x,y,theme==='horror'?14:16,p.ink,'center',theme!=='horror');c.restore();
  }
  function upstairs(c,s,p,theme){
    const cute=theme==='cute',horror=theme==='horror';
    c.fillStyle=p.wall;c.fillRect(0,0,1280,460);
    // First-person room depth: converging floor and side walls.
    poly(c,[[0,0],[315,28],[315,383],[0,460]],p.wall2,p.ink,p.line);
    poly(c,[[1280,0],[975,28],[975,383],[1280,460]],p.wall2,p.ink,p.line);
    poly(c,[[0,460],[315,383],[975,383],[1280,460]],p.floor,p.ink,p.line);
    for(let i=0;i<14;i++){const x=i*100-50;line(c,[[640+(x-640)*.54,383],[x,460]],p.wood,1.2);}
    line(c,[[0,428],[1280,428]],p.wood,1);line(c,[[0,453],[1280,453]],p.wood,1);
    rr(c,315,26,660,369,1,p.frame,p.ink,p.line);
    rr(c,327,38,636,348,1,p.night,p.ink,1);
    // Kitchen beyond the sliding door, exposed as the panel moves.
    c.save();c.beginPath();c.rect(329,40,632,345);c.clip();
    c.fillStyle=horror?'#3b4a40':cute?'#f1edda':'#dae1bb';c.fillRect(329,40,632,345);
    rr(c,470,75,235,102,1,p.glass,p.ink,1);
    for(let x=480;x<710;x+=31)line(c,[[x,76],[x,176]],p.frame,.6);for(let y=85;y<177;y+=30)line(c,[[471,y],[704,y]],p.frame,.6);
    rr(c,480,242,420,150,1,p.plant,p.ink,2);rr(c,473,232,435,17,2,p.paper,p.ink,2);
    for(let x=492;x<900;x+=100){rr(c,x,255,87,118,1,p.sofa,p.ink,1.2);rr(c,x+25,267,34,4,2,p.wood);}
    ellipse(c,640,224,45,9,p.ink);rr(c,615,195,50,33,6,p.wood,p.ink,2);ellipse(c,640,194,23,5,p.paper,p.ink,2);
    rr(c,356,130,95,245,7,p.paper,p.ink,2);line(c,[[359,213],[448,213]],p.frame,2);rr(c,432,231,5,42,2,p.wood);
    rr(c,776,70,149,138,4,p.plant,p.ink,2);line(c,[[851,72],[851,206]],p.frame,2);
    plant(c,872,228,p,cute,.65);
    if(cute){flower(c,385,169,9,p);star(c,720,101,6,p.light);}
    // Frosted door: its translation shows the actual opening and closing.
    const dx=-480*s.door;
    c.save();c.translate(dx,0);rr(c,335,44,620,335,1,p.glass,p.ink,2);
    c.globalAlpha=horror?.28:.35;for(let x=346;x<952;x+=15)line(c,[[x,51],[x,372]],p.paper,3);c.globalAlpha=1;
    for(const x of [337,946])rr(c,x,42,10,340,1,p.wood,p.ink,1.5);
    rr(c,335,43,620,12,1,p.wood,p.ink,1);rr(c,335,368,620,12,1,p.wood,p.ink,1);
    rr(c,895,195,14,85,6,horror?'#aba582':p.paper,p.ink,2.5);rr(c,901,205,5,63,2,p.frame);
    c.restore();c.restore();
    rr(c,310,20,670,15,2,p.wood,p.ink,p.line);rr(c,311,385,670,11,2,p.wood,p.ink,p.line);
    // Everyday details establish scale and keep the view recognizably first-person.
    wallFrame(c,82,95,105,137,p,cute);line(c,[[108,88],[134,66],[163,88]],p.ink,1.5);
    rr(c,220,232,42,59,4,p.paper,p.ink,2);rr(c,229,241,24,20,3,p.wall,p.frame,1);
    plant(c,1090,367,p,cute,1.65);
    rr(c,1165,156,16,218,4,p.wood,p.ink,2);line(c,[[1135,178],[1211,178]],p.wood,9);
    if(cute){flower(c,1174,150,23,p);ellipse(c,1146,389,26,13,'#e5c3b0',p.ink,2);ellipse(c,1203,392,26,13,'#e5c3b0',p.ink,2);}
    else{poly(c,[[1140,193],[1198,193],[1211,301],[1127,299]],p.sofa,p.ink,2);}
    // Soft ceiling light and small floor labels.
    poly(c,[[1005,9],[1095,9],[1115,55],[985,55]],p.light,p.ink,2);line(c,[[1050,0],[1050,10]],p.ink,2);
    rr(c,25,23,158,35,cute?16:4,p.paper,p.ink,horror?1:2);text(c,'302호  ·  우리 집',104,41,13,p.ink,'center',true);
    text(c,'1인칭으로 중문 열고 닫기',1250,43,12,p.ink,'right');
    text(c,s.door<.03?'문 닫힘':s.door>.97?'문 열림':`문 ${Math.round(s.door*100)}% 열림`,31,435,12,p.ink);
    // A cropped sleeve in the foreground, rather than a wire-loop prop.
    c.save();c.translate(1005,447);c.rotate(-.3);rr(c,0,-11,230,75,25,cute?'#dcb8ba':horror?'#50584a':'#d9a25d',p.ink,p.line);ellipse(c,0,17,37,30,cute?'#ffefdf':horror?'#969980':'#e4bb8d',p.ink,p.line);for(let i=0;i<3;i++)line(c,[[-18+i*12,-4],[-21+i*12,14]],p.ink,1.3);c.restore();
    if(cute){star(c,248,110,12,'#e3bca2',.2);heart(c,1040,127,10,'#d2a5a4');}
  }
  function control(c,s,p,theme,options){
    const route=options.route,progress=options.distance||0,grab=!!s.grab;const at=options.point||route.points[0],cursor=grab&&options.cursor?options.cursor:at;
    c.save();c.beginPath();c.rect(0,0,1280,460);c.clip();
    // A drawn guidance overlay over the door. It is not a physical wire or ring.
    for(let i=0;i<route.segments.length;i++){
      const seg=route.segments[i],done=seg.start+seg.length<=progress,active=i===(at.index||0);
      line(c,[[seg.a.x,seg.a.y],[seg.b.x,seg.b.y]],theme==='horror'?'#15282288':'#fff7dfb0',active?17:13);
      c.globalAlpha=done?.3:active?1:.65;line(c,[[seg.a.x,seg.a.y],[seg.b.x,seg.b.y]],seg.zone.color,active?4.5:3.2);c.globalAlpha=1;
      if(seg.start<progress&&seg.start+seg.length>progress){const f=(progress-seg.start)/seg.length;line(c,[[seg.a.x,seg.a.y],[seg.a.x+seg.dx*f,seg.a.y+seg.dy*f]],p.ink,2);}
    }
    route.points.forEach((pt,i)=>{const active=i===(at.index||0)+1;rr(c,pt.x-4,pt.y-4,8,8,2,active?p.paper:p.wall,p.ink,active?1.8:.9);});
    const end=route.points.at(-1);star(c,end.x,end.y,11,p.accent,.8);text(c,'도착',end.x,end.y+20,10,p.ink,'center');
    // The control marker is a small hand on the displayed movement trail.
    const off=s.off||options.contact;c.save();c.translate(cursor.x,cursor.y);if(theme==='comic'&&off)c.rotate(Math.sin(s.time*35)*.15);
    ellipse(c,0,4,20,7,p.shadow);
    rr(c,-13,-11,26,25,8,off?'#e3a186':p.paper,p.ink,2.2);
    for(let i=0;i<3;i++)line(c,[[-6+i*6,-9],[-6+i*6,0]],p.ink,1.3);
    rr(c,-17,-3,8,15,4,off?'#e3a186':p.paper,p.ink,1.8);rr(c,-9,11,18,7,2,p.accent,p.ink,1.4);
    c.restore();
    if(!s.running||(!grab&&s.time<3)){rr(c,cursor.x-86,cursor.y+29,172,27,8,p.paper,p.ink,1.4);text(c,'손 모양을 잡고 경로 따라가기',cursor.x,cursor.y+43,10,p.ink,'center');}
    if(off){for(let i=0;i<5;i++){const a=i*Math.PI*.4+s.time;line(c,[[cursor.x+Math.cos(a)*23,cursor.y+Math.sin(a)*23],[cursor.x+Math.cos(a)*33,cursor.y+Math.sin(a)*33]],'#d48c67',2);}text(c,'덜컹!',cursor.x+26,cursor.y-27,theme==='comic'?24:17,p.ink,'left',true);}
    // Speed bands communicate the changing input requirement, not a noise score.
    const zone=route.segments[at.index||0].zone,next=route.segments[Math.min(route.segments.length-1,(at.index||0)+1)].zone;
    rr(c,998,80,250,115,theme==='cute'?16:4,p.paper,p.ink,theme==='comic'?2.3:1.2);
    text(c,'이 구간의 손 움직임',1013,100,10,p.ink);text(c,zone.name,1231,101,17,zone.color,'right',true);
    rr(c,1014,122,215,8,4,p.wall);rr(c,1014+zone.min/400*215,122,(zone.max-zone.min)/400*215,8,4,zone.color);
    const needle=Math.min(1,(s.speed||0)/400)*215;poly(c,[[1014+needle,118],[1009+needle,112],[1019+needle,112]],p.ink);
    const quality=!grab||s.speedState==='stopped'?'멈추면 이웃도 진정해요':s.grace>0?'속도를 맞춰주세요':s.speedState==='good'?'좋아요, 이 속도 그대로':s.speedState==='slow'?'조금 더 빠르게 움직여요':'조금 더 천천히 움직여요';
    text(c,quality,1014,150,11,p.ink);text(c,'다음 구간  '+next.name,1014,177,10,p.ink);
    text(c,route.name,27,87,12,p.ink);text(c,`${Math.round(progress/route.length*100)}%`,27,108,10,p.ink);
    const lx=31,ly=137;for(let i=0;i<3;i++){const z=root.QuietPath.zones[i];rr(c,lx,ly+i*23,14,4,2,z.color);text(c,z.name,lx+22,ly+i*23+2,10,p.ink);}
    if(s.word>0&&!off){const copy=theme==='comic'?{slam:'쾅!!!',scrape:'드르르르륵!',stiff:'뻐어억…',bump:'덜컹!'}:theme==='horror'?{slam:'쿵.',scrape:'끼이익…',stiff:'끅…',bump:'탁.'}:{slam:'쿵…!',scrape:'드르륵…',stiff:'뻑뻑…',bump:'덜컹!'};c.save();c.translate(688,84);c.rotate(theme==='comic'?-.1:0);text(c,copy[s.wordText]||'',0,0,theme==='comic'?32:23,p.ink,'center',theme!=='horror');c.restore();}
    c.restore();
  }
  const Portrait=root.QuietPortrait||(typeof require==='function'?require('./portrait.js'):null);
  function paint(c,s,options={}){
    const theme=options.theme||'cute',base=P[theme]||P.cute;
    const p=s.eerie?{...P.horror,wall:'#4c5954',wall2:'#303c3a',ink:'#a7b6a8',paper:'#253433',glass:'#647268'}:base;
    c.save();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,1280,800);
    c.fillStyle=s.eerie?'#10191e':p.wall2;c.fillRect(0,0,1280,800);
    Portrait.lower(c,s,p,theme,options);
    const first=c.parts.length;
    upstairs(c,s,p,theme);
    if(s.eerie){
      const grad=c.createRadialGradient(650,245,70,650,245,720);grad.addColorStop(0,'#09111800');grad.addColorStop(1,'#03080c80');c.fillStyle=grad;c.fillRect(0,0,1280,460);
      c.globalAlpha=.09;for(let i=0;i<75;i++){c.fillStyle=i%2?'#9bada4':'#071118';c.fillRect((i*157)%1280,(i*233)%460,16+i%8,1);}c.globalAlpha=1;
    }else if(theme==='comic'){
      c.globalAlpha=.05;for(let y=12;y<450;y+=19)for(let x=8;x<295;x+=19)ellipse(c,x,y,1,1,p.ink);c.globalAlpha=1;
    }
    control(c,s,p,theme,options);
    const upperMarkup=c.parts.splice(first).join('');
    Portrait.upper(c,upperMarkup,s,options);
    if(!s.bursting)Portrait.seam(c,s,p);
    Portrait.impact(c,s,p,options);
    if(s.turnTime>0&&!options.reduced){
      c.globalAlpha=Math.min(.6,s.turnTime);c.fillStyle='#071218';c.fillRect(0,82,1280,9);c.fillRect(0,311,1280,4);c.globalAlpha=1;
    }
    c.restore();
  }
  root.QuietArt={paint,palettes:P};if(typeof module!=='undefined'&&module.exports)module.exports=root.QuietArt;
})(typeof window!=='undefined'?window:globalThis);
