'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness(){
 const instances=[],handlers={},settings={motion:0,blackout:false,eco:false,scene:'horizon',theme:'mono',brightness:100};
 const media={matches:false,addEventListener(){}};
 class Bridge{
  constructor(){this.draws=[];this.prepared=[];this.disposed=false;instances.push(this);}
  prepare(scene){this.prepared.push(scene);}
  draw(parameters){this.draws.push(parameters);return true;}
  hide(){}dispose(){this.disposed=true;}
 }
 const canvas={getContext:()=>({setTransform(){}}),getBoundingClientRect:()=>({width:390,height:844})};
 const scope={UndertoneBlackHoleBridge:Bridge,window:{devicePixelRatio:2,matchMedia:()=>media,addEventListener:(event,fn)=>handlers[event]=fn},document:{hidden:false},requestAnimationFrame(){}};
 vm.runInNewContext(fs.readFileSync('visuals.js','utf8')+'\nglobalThis.Visual=UndertoneVisuals;',scope);
 const visual=new scope.Visual(canvas,()=>settings,()=>0);
 return {visual,settings,scope,instances,media,handlers};
}
test('Event horizon receives the host viewport, clock, variation and palette',()=>{
 const h=harness();h.visual.reseed(4580);h.visual.frame(1000);
 const first=h.instances[0].draws[0];
 assert.equal(first.width,390);assert.equal(first.height,844);assert.equal(first.time,h.visual.time);assert.equal(first.seed,4580);
 assert.equal(first.palette[3],'#b567d6');
 h.settings.motion=60;h.visual.frame(1100);
 assert.ok(h.visual.time>0);assert.equal(h.instances[0].draws.at(-1).time,h.visual.time);
});
test('Event horizon shares zero-motion, reduced-motion, hidden and blackout boundaries',()=>{
 const h=harness();h.visual.frame(1000);h.visual.frame(1100);assert.equal(h.instances[0].draws.length,1);
 h.media.matches=true;h.settings.motion=60;h.visual.dirty=true;h.visual.frame(1200);h.visual.frame(1300);
 assert.equal(h.instances[0].draws.length,2);assert.equal(h.visual.time,0);
 h.scope.document.hidden=true;h.visual.dirty=true;h.visual.frame(1400);assert.equal(h.instances[0].draws.length,2);
 h.scope.document.hidden=false;h.settings.blackout=true;h.visual.frame(1500);assert.equal(h.instances[0].draws.length,2);
 h.handlers.pagehide();assert.equal(h.instances[0].disposed,true);h.handlers.pageshow();assert.equal(h.instances.length,2);
});
