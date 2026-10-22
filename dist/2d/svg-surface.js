/* SVG drawing surface: all scene geometry remains editable vector markup. */
(function(root){
  'use strict';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const num=n=>Math.round(n*1000)/1000;
  const mult=(m,n)=>[m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],m[0]*n[2]+m[2]*n[3],m[1]*n[2]+m[3]*n[3],m[0]*n[4]+m[2]*n[5]+m[4],m[1]*n[4]+m[3]*n[5]+m[5]];
  class SvgSurface{
    constructor(){this.parts=[];this.defs=[];this.stack=[];this.path='';this.n=0;this.m=[1,0,0,1,0,0];this.clips=[];this.fillStyle='#000';this.strokeStyle='#000';this.lineWidth=1;this.globalAlpha=1;this.lineCap='butt';this.lineJoin='miter';this.font='400 14px sans-serif';this.textAlign='left';this.textBaseline='alphabetic';}
    save(){this.stack.push({m:[...this.m],clips:[...this.clips],fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth,globalAlpha:this.globalAlpha,lineCap:this.lineCap,lineJoin:this.lineJoin,font:this.font,textAlign:this.textAlign,textBaseline:this.textBaseline});}
    restore(){Object.assign(this,this.stack.pop()||{});}
    setTransform(a,b,c,d,e,f){this.m=[a,b,c,d,e,f];}
    translate(x,y){this.m=mult(this.m,[1,0,0,1,x,y]);}
    scale(x,y){this.m=mult(this.m,[x,0,0,y,0,0]);}
    rotate(a){this.m=mult(this.m,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);}
    clearRect(){this.parts=[];this.defs=[];this.n=0;}
    beginPath(){this.path='';}
    moveTo(x,y){this.path+=`M${num(x)} ${num(y)} `;}
    lineTo(x,y){this.path+=`L${num(x)} ${num(y)} `;}
    quadraticCurveTo(x,y,a,b){this.path+=`Q${num(x)} ${num(y)} ${num(a)} ${num(b)} `;}
    bezierCurveTo(a,b,c,d,e,f){this.path+=`C${[a,b,c,d,e,f].map(num).join(' ')} `;}
    closePath(){this.path+='Z ';}
    rect(x,y,w,h){this.path+=`M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}Z `;}
    ellipse(x,y,rx,ry,rot){const angle=num(rot*180/Math.PI);this.path+=`M${num(x+rx)} ${num(y)} A${num(rx)} ${num(ry)} ${angle} 1 1 ${num(x-rx)} ${num(y)} A${num(rx)} ${num(ry)} ${angle} 1 1 ${num(x+rx)} ${num(y)}Z `;}
    transformAttr(){return ` transform="matrix(${this.m.map(num).join(' ')})"`;}
    style(value){return value&&value.svgGradient?`url(#${value.id})`:esc(value);}
    mark(markup){if(this.globalAlpha<=0)return;let p=`<g opacity="${num(this.globalAlpha)}">${markup}</g>`;for(const id of this.clips)p=`<g clip-path="url(#${id})">${p}</g>`;this.parts.push(p);}
    fill(){this.mark(`<path d="${this.path}" fill="${this.style(this.fillStyle)}"${this.transformAttr()}/>`);}
    stroke(){this.mark(`<path d="${this.path}" fill="none" stroke="${this.style(this.strokeStyle)}" stroke-width="${num(this.lineWidth)}" stroke-linecap="${this.lineCap}" stroke-linejoin="${this.lineJoin}"${this.transformAttr()}/>`);}
    fillRect(x,y,w,h){this.mark(`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${this.style(this.fillStyle)}"${this.transformAttr()}/>`);}
    clip(){const id=`clip${this.n++}`;this.defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${this.path}"${this.transformAttr()}/></clipPath>`);this.clips.push(id);}
    createRadialGradient(x1,y1,r1,x2,y2,r2){const id=`gradient${this.n++}`,g={svgGradient:true,id,stops:[]};this.defs.push(g);g.addColorStop=(offset,color)=>g.stops.push([offset,color]);g.markup=()=>`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${x2}" cy="${y2}" r="${r2}" fx="${x1}" fy="${y1}">${g.stops.map(([o,c])=>`<stop offset="${o}" stop-color="${esc(c)}"/>`).join('')}</radialGradient>`;return g;}
    fillText(t,x,y){const match=this.font.match(/(?:(\d+)\s+)?([\d.]+)px\s+(.+)/),weight=match?.[1]||400,size=match?.[2]||14,family=match?.[3]||'sans-serif';const anchor=this.textAlign==='center'?'middle':this.textAlign==='right'?'end':'start';this.mark(`<text x="${num(x)}" y="${num(y)}" fill="${this.style(this.fillStyle)}" font-size="${size}" font-weight="${weight}" font-family="${esc(family)}" text-anchor="${anchor}" dominant-baseline="${this.textBaseline==='middle'?'central':'alphabetic'}"${this.transformAttr()}>${esc(t)}</text>`);}
    content(){return `<defs>${this.defs.map(d=>typeof d==='string'?d:d.markup()).join('')}</defs>${this.parts.join('')}`;}
    svg(){return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">${this.content()}</svg>`;}
  }
  root.QuietSVG=SvgSurface;if(typeof module!=='undefined'&&module.exports)module.exports=SvgSurface;
})(typeof window!=='undefined'?window:globalThis);
