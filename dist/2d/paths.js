(function(root){
  'use strict';
  const raw=[
    {name:'계단 경로',points:[[904,240],[904,330],[824,330],[824,270],[754,270],[754,200],[824,200],[824,125],[614,125],[614,200],[684,200],[684,345],[544,345],[544,410],[424,410],[424,240]]},
    {name:'번개 경로',points:[[424,240],[424,150],[494,150],[559,215],[624,150],[689,215],[754,150],[819,215],[884,150],[929,215],[864,280],[799,345],[734,280],[669,345],[604,280],[539,345],[474,410],[684,410],[764,410],[834,340],[904,340],[904,240]]},
    {name:'지그재그 경로',points:[[904,240],[904,125],[824,125],[824,195],[754,195],[754,125],[684,125],[684,195],[614,195],[614,125],[544,125],[544,195],[474,195],[474,270],[544,270],[544,340],[614,340],[614,410],[474,410],[424,360],[424,240]]},
    {name:'마지막 굽이',points:[[424,240],[424,325],[499,325],[499,400],[574,400],[574,325],[649,325],[649,400],[724,400],[724,325],[799,325],[799,250],[724,250],[724,175],[649,175],[649,110],[799,110],[799,175],[904,175],[904,240]]}
  ];
  const zones=[{id:'slow',name:'살살',min:30,max:95,color:'#7ca8bf'},{id:'steady',name:'보통',min:85,max:175,color:'#73aa91'},{id:'fast',name:'빠르게',min:175,max:300,color:'#dfaa72'}];
  function makeRoute(index){const r=raw[index%raw.length],points=r.points.map(p=>({x:p[0],y:p[1]})),segments=[];let length=0;
    const pattern=[0,1,0,2,0,1,2,0,1,0,2,0,1,0,2,1,0];
    for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);segments.push({a,b,dx,dy,length:l,start:length,zone:zones[pattern[(i+index)%pattern.length]]});length+=l;}
    return {name:r.name,points,segments,length};
  }
  function pointAt(route,distance){const d=Math.max(0,Math.min(route.length,distance));const s=route.segments.find(s=>d<=s.start+s.length)||route.segments.at(-1),t=(d-s.start)/s.length;return{x:s.a.x+s.dx*t,y:s.a.y+s.dy*t,index:route.segments.indexOf(s),distance:d};}
  function projectSegment(x,y,s){const t=Math.max(0,Math.min(1,((x-s.a.x)*s.dx+(y-s.a.y)*s.dy)/(s.length*s.length)));const px=s.a.x+s.dx*t,py=s.a.y+s.dy*t;return{x:px,y:py,distance:Math.hypot(x-px,y-py),along:s.start+t*s.length};}
  class PathController{
    constructor(index=0){this.reset(index);}
    reset(index){this.route=makeRoute(index);this.distance=0;this.contact=false;this.last=pointAt(this.route,0);}
    point(){return pointAt(this.route,this.distance);}
    move(x,y,tolerance=19){
      const at=this.point(),lo=Math.max(0,at.index-1),hi=Math.min(this.route.segments.length-1,at.index+1);
      let best=null;for(let i=lo;i<=hi;i++){const p=projectSegment(x,y,this.route.segments[i]);if(!best||p.distance<best.distance)best=p;}
      let safe=best.distance<=tolerance;
      if(safe){const count=Math.ceil(Math.hypot(x-this.last.x,y-this.last.y)/5);for(let i=1;i<count;i++){const px=this.last.x+(x-this.last.x)*i/count,py=this.last.y+(y-this.last.y)*i/count;let nearest=Infinity;for(let j=lo;j<=hi;j++)nearest=Math.min(nearest,projectSegment(px,py,this.route.segments[j]).distance);if(nearest>tolerance){safe=false;break;}}}
      this.contact=!safe;
      if(safe){this.distance=best.along;this.last={x,y};}
      const p=this.point();return{progress:this.distance/this.route.length,contact:this.contact,point:p,deviation:best.distance,zone:this.route.segments[p.index].zone};
    }
  }
  const api={PathController,makeRoute,pointAt,zones};root.QuietPath=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
