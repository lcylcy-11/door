/* Door input, accumulated irritation, and the screen-breaking timeline. */
(function(root){
  'use strict';
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  class QuietNight{
    constructor(){this.reset();}
    reset(practice=false){Object.assign(this,{running:false,paused:false,over:false,won:false,practice,door:0,noise:0,impulse:0,stress:0,pressure:0,quiet:10,time:0,step:0,grab:false,off:false,mode:'calm',eerie:false,turnTime:0,burstTime:-1,demoKind:null,demoRemaining:0,word:0,wordText:'',events:[],peak:0,speed:0,speedState:'stopped',zone:null,grace:.2,lastMove:0});}
    start(practice=false){this.reset(practice);this.running=true;}
    emit(type,text){this.events.push({type,text,time:this.time});if(this.events.length>20)this.events.shift();}
    get bursting(){return this.burstTime>=0;}
    layout(){const split=460+this.pressure*218;return {split,scale:split/460,lowerTop:split+24,lowerHeight:776-split};}
    toDoorPoint(x,y){return {x,y:y/this.layout().scale};}
    begin(){if(this.running&&!this.paused&&!this.over&&!this.bursting){this.grab=true;this.grace=.24;return true;}return false;}
    move(position,deviation,dt,control=null){
      if(!this.grab||this.paused||this.over||this.bursting)return;
      const p=clamp(position),speed=Math.abs(p-this.door)/clamp(dt,.008,.2);
      this.off=Math.abs(deviation)>23;let noise=clamp((speed-.15)*.68);
      if(control){
        if(!this.zone||this.zone.id!==control.zone.id){this.grace=.2;this.zone=control.zone;}
        this.speed+=(control.speed-this.speed)*(1-Math.exp(-12*clamp(dt,.008,.2)));this.lastMove=this.time;
        this.speedState=this.speed<this.zone.min?'slow':this.speed>this.zone.max?'fast':'good';
        noise=this.grace>0?0:this.speedState==='slow'?clamp((this.zone.min-this.speed)/this.zone.min)*.4:this.speedState==='fast'?clamp((this.speed-this.zone.max)/this.zone.max)*.85:0;
      }
      this.impulse=Math.max(this.impulse,noise,this.off?.61:0);this.peak=Math.max(this.peak,this.impulse);
      if(this.off){this.word=.65;this.wordText='bump';}else if(noise>.22){this.word=.5;this.wordText=this.speedState==='slow'?'stiff':'scrape';}
      if(((p<.012&&this.door>=.012)||(p>.988&&this.door<=.988))&&speed>.6){this.impulse=Math.max(this.impulse,clamp(.25+speed*.2));this.word=.7;this.wordText='slam';this.emit('slam');}
      this.door=p;
    }
    release(){
      if(!this.grab)return;this.grab=false;this.off=false;
      if(this.over||this.paused||this.bursting)return;
      if((this.step%2===0&&this.door>.995)||(this.step%2===1&&this.door<.005)){
        this.step++;this.emit('step');if(this.step>=4){if(this.practice)this.step=0;else this.finish(true);}
      }
    }
    demo(explode=false){if(!this.running||this.over)this.start(!explode);this.demoKind=explode?'burst':'reaction';this.demoRemaining=explode?7:3.1;this.emit('demo');}
    explode(){
      if(this.bursting)return;this.burstTime=0;this.pressure=1;this.stress=100;this.eerie=true;this.mode='burst';this.grab=false;this.off=false;this.demoRemaining=0;
      this.emit('burst');if(!this.practice||this.demoKind==='burst')this.finish(false);
    }
    finish(won){if(this.over)return;this.over=true;this.won=won;this.grab=false;this.off=false;this.emit(won?'win':'lose');}
    togglePause(){if(!this.running||this.over)return;this.paused=!this.paused;this.release();}
    update(dt){
      dt=clamp(dt,0,.05);if(!this.running||this.paused)return;this.time+=dt;
      if(this.bursting){
        this.burstTime+=dt;this.noise*=Math.exp(-3*dt);
        if(this.practice&&!this.over&&this.burstTime>2.9){this.burstTime=-1;this.stress=12;this.pressure=.2;this.eerie=false;this.turnTime=0;this.quiet=2;this.impulse=0;this.demoKind=null;this.mode='settling';this.emit('calmed');}return;
      }
      this.grace=Math.max(0,this.grace-dt);this.turnTime=Math.max(0,this.turnTime-dt);this.word=Math.max(0,this.word-dt);
      if(this.time-this.lastMove>.16){this.speed*=Math.exp(-7*dt);this.speedState='stopped';}
      if(this.demoRemaining>0){this.demoRemaining=Math.max(0,this.demoRemaining-dt);this.impulse=Math.max(this.impulse,this.demoKind==='burst'?.87:.66);this.word=.2;this.wordText='scrape';}
      if(this.over)this.impulse=0;
      this.noise+=(this.impulse-this.noise)*(1-Math.exp(-16*dt));this.impulse=Math.max(0,this.impulse-1.7*dt);
      if(this.noise>.12){this.quiet=0;this.stress=clamp(this.stress+(this.noise-.1)*43*dt,0,100);}else{this.quiet+=dt;this.stress=Math.max(0,this.stress-(this.quiet>.7?15:3)*dt);}
      if(!this.eerie&&this.stress>=55){this.eerie=true;this.turnTime=.32;this.emit('turn');}
      if(this.eerie&&this.stress<28&&this.quiet>1){this.eerie=false;this.emit('calmed');}
      const target=clamp(this.stress/100*.94+this.noise*.06);this.pressure+=(target-this.pressure)*(1-Math.exp(-5*dt));
      const mode=this.eerie?'wrong':this.stress>38?'pain':this.stress>16?'annoyed':this.noise>.12?'listen':this.stress>2?'settling':'calm';
      if(mode!==this.mode){this.mode=mode;this.emit(mode);}
      if(this.stress>=100&&!this.won)this.explode();
    }
    snapshot(){return {running:this.running,paused:this.paused,over:this.over,won:this.won,practice:this.practice,door:this.door,noise:this.noise,stress:this.stress,pressure:this.pressure,quiet:this.quiet,time:this.time,step:this.step,grab:this.grab,off:this.off,mode:this.mode,eerie:this.eerie,burstTime:this.burstTime};}
  }
  root.QuietNight=QuietNight;if(typeof module!=='undefined'&&module.exports)module.exports=QuietNight;
})(typeof window!=='undefined'?window:globalThis);
