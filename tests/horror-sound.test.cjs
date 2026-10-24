const {test}=require('node:test');
const assert=require('node:assert/strict');
const Sound=require('../dist/horror/sound.js');
test('wood impacts have a bounded audible attack, resonant body and decaying room tail at real sample rates',()=>{
  for(const rate of [44100,48000]){
    const data=Sound.knockSamples(rate), energy=(a,b)=>{
      let sum=0; for(let i=Math.floor(a*rate);i<Math.floor(b*rate);i++)sum+=data[i]*data[i];
      return Math.sqrt(sum/((b-a)*rate));
    };
    assert.equal(data.length,Math.floor(rate*1.05)); assert.ok(data.every(x=>Number.isFinite(x)&&Math.abs(x)<=.92));
    assert.ok(energy(.001,.03)>.08); assert.ok(energy(.05,.15)>.025); assert.ok(energy(.8,1)<energy(.05,.15)*.02);
    assert.equal(Math.abs(data[0]),0); assert.deepEqual(data,Sound.knockSamples(rate));
  }
});
