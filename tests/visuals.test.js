'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function visualHarness(){
 const context2d={setTransform(){}};const canvas={width:0,height:0,getContext:()=>context2d,getBoundingClientRect:()=>({width:1000,height:600})};
 const settings={motion:40,blackout:false,eco:false,scene:'rain',theme:'noir',brightness:80};const media={matches:false,addEventListener(){}};
 const scope={window:{devicePixelRatio:3,matchMedia:()=>media,addEventListener(){}},document:{hidden:false},requestAnimationFrame(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../visuals.js'),'utf8')+'\nglobalThis.Visual=UndertoneVisuals;',scope);
 const visual=new scope.Visual(canvas,()=>settings,()=>0);let paints=0;visual.render=()=>paints++;
 return {visual,canvas,settings,media,scope,paints:()=>paints};
}
test('visual variations are deterministic and DPR is capped for TVs',()=>{
 const {visual,canvas}=visualHarness();visual.reseed(111);const first=JSON.stringify(visual.drops);visual.reseed(112);assert.notEqual(JSON.stringify(visual.drops),first);visual.reseed(111);assert.equal(JSON.stringify(visual.drops),first);assert.equal(canvas.width,1500);assert.equal(canvas.height,900);
});
test('zero movement and system reduced motion render a still scene',()=>{
 const h=visualHarness();h.settings.motion=0;h.visual.frame(1000);const t=h.visual.time;h.visual.frame(2000);assert.equal(h.paints(),1);assert.equal(h.visual.time,t);
 h.settings.motion=40;h.media.matches=true;h.visual.dirty=true;h.visual.frame(3000);h.visual.frame(4000);assert.equal(h.paints(),2);assert.equal(h.visual.time,t);
});
test('still mode zeros audio reactivity even when a dirty repaint occurs during music',()=>{
 const h=visualHarness();h.settings.motion=0;h.visual.audio=()=>({energy:1,bass:1,mid:1,high:1});
 h.visual.audioState.energy=.8;h.visual.audioState.bass=.7;h.visual.audioState.mid=.6;h.visual.audioState.high=.5;h.visual.audioState.pulse=.9;h.visual.audioBaseline=.5;
 h.visual.dirty=true;h.visual.frame(1000);
 assert.deepEqual({...h.visual.audioState},{energy:0,bass:0,mid:0,high:0,pulse:0});assert.equal(h.visual.audioBaseline,0);
});
test('motion curve has a useful normal pace, a fast top end, and restrained music boost',()=>{
 const h=visualHarness(),v=h.visual,idle={energy:0,bass:0,mid:0,high:0,pulse:0},music={energy:.7,bass:.8,mid:.6,high:.4,pulse:.75};
 h.settings.motion=40;const normal=v.motionRate(h.settings,idle);assert(normal>1&&normal<1.2,`motion 40 should be near 1x, got ${normal}`);
 h.settings.motion=100;const fast=v.motionRate(h.settings,idle),reactive=v.motionRate(h.settings,music);assert(fast>=2.9&&fast<=3.1,`motion 100 should reach about 3x, got ${fast}`);assert(reactive>fast&&reactive<=4,'music should lift speed without exceeding the cap');
 h.settings.motion=0;assert.equal(v.motionRate(h.settings,music),0,'motion zero must stay still even with music');
});
test('audio envelope exposes smoothed bands and a decaying onset pulse',()=>{
 const h=visualHarness(),v=h.visual;
 for(let i=0;i<5;i++)v.updateAudio({energy:.8,bass:1,mid:.65,high:.35},.05);
 assert(v.audioState.energy>.3);assert(v.audioState.bass>v.audioState.high);assert(v.audioState.pulse>0,'rising music should create an onset pulse');
 const peak=v.audioState.pulse;for(let i=0;i<16;i++)v.updateAudio({energy:0,bass:0,mid:0,high:0},.05);
 assert(v.audioState.pulse<peak,'pulse should release instead of sticking');
});
test('blackout and hidden document stop rendering work',()=>{
 const h=visualHarness();h.settings.blackout=true;h.visual.frame(1000);assert.equal(h.paints(),0);h.settings.blackout=false;h.scope.document.hidden=true;h.visual.frame(2000);assert.equal(h.paints(),0);h.scope.document.hidden=false;h.visual.frame(3000);assert.equal(h.paints(),1);
});

test('orb geometry visibly changes with elapsed time',()=>{
 const {visual}=visualHarness();
 const sample=t=>{const points=[];const gradient={addColorStop(){}};const g={createRadialGradient:()=>gradient,fillRect(){},translate(){},rotate(v){points.push(v)},beginPath(){},lineTo(x,y){points.push(x,y)},moveTo(x,y){points.push(x,y)},stroke(){},save(){},restore(){},ellipse(...args){points.push(...args)}};visual.orbit(g,1000,600,t,['#000000','#222222','#555555','#999999','#ffffff'],1);return points;};
 const a=sample(0),b=sample(5);let square=0;for(let i=0;i<a.length;i++)square+=(a[i]-b[i])**2;assert(Math.sqrt(square/a.length)>10,'orb should move noticeably within five scene seconds');
});

function gpuVisualHarness(){
 const handlers={},instances=[],settings={motion:0,blackout:false,eco:false,scene:'orbit',theme:'ocean',brightness:80};
 const media={matches:false,addEventListener(){}};
 class Bridge{constructor(){this.draws=[];this.disposed=false;instances.push(this);}prepare(){}draw(p){this.draws.push(p);return true;}hide(){}dispose(){this.disposed=true;}}
 const canvas={getContext:()=>({setTransform(){}}),getBoundingClientRect:()=>({width:1000,height:600})};
 const scope={UndertoneOrbitBridge:Bridge,window:{devicePixelRatio:3,matchMedia:()=>media,addEventListener:(event,fn)=>handlers[event]=fn},document:{hidden:false},requestAnimationFrame(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../visuals.js'),'utf8')+'\nglobalThis.Visual=UndertoneVisuals;',scope);
 const visual=new scope.Visual(canvas,()=>settings,()=>0);return{visual,instances,settings,scope,handlers,media};
}
test('GPU shares the still, hidden, blackout, and DPR boundaries of the visual clock',()=>{
 const h=gpuVisualHarness();h.visual.frame(1000);h.visual.frame(2000);assert.equal(h.instances[0].draws.length,1);assert.equal(h.instances[0].draws[0].dpr,1.5);
 h.settings.motion=50;h.media.matches=true;h.visual.dirty=true;h.visual.frame(3000);h.visual.frame(4000);assert.equal(h.instances[0].draws.length,2);assert.equal(h.visual.time,0);
 h.scope.document.hidden=true;h.visual.dirty=true;h.visual.frame(5000);h.scope.document.hidden=false;h.settings.blackout=true;h.visual.frame(6000);assert.equal(h.instances[0].draws.length,2);
 h.settings.blackout=false;h.visual.frame(7000);assert.equal(h.instances[0].draws.length,3);
});
test('BFCache page lifecycle releases and recreates the GPU bridge without another visual clock',()=>{
 const h=gpuVisualHarness();h.visual.frame(1000);h.handlers.pagehide();assert.equal(h.instances[0].disposed,true);h.handlers.pageshow();assert.equal(h.instances.length,2);h.visual.frame(2000);assert.equal(h.instances[1].draws.length,1);
});

test('Canvas frame contract reuses storage and preserves theme, time and controls',()=>{
 const h=visualHarness(),v=h.visual;v.time=7;v.reseed(42);
 const a=v.canvasContract(h.settings),viewport=a.viewport;h.settings.motion=0;h.settings.brightness=30;h.media.matches=true;
 const b=v.canvasContract(h.settings);assert.equal(a,b);assert.equal(b.viewport,viewport);assert.equal(b.audio,v.audioState);assert.equal(b.seed,42);assert.equal(b.time,7+42*.0037);assert.equal(b.motion,0);assert.equal(b.brightness,.3);assert.equal(b.reducedMotion,true);assert.equal(b.palette.name,'Noir');assert.equal(b.viewport.dpr,1.5);
});
test('contours are seeded, finite, animated and reuse buffers and glow surface',()=>{
 const h=visualHarness(),v=h.visual;let canvases=0;const alphas=[];
 const context=(record=true)=>({setTransform(){},createRadialGradient:()=>({addColorStop(){}}),clearRect(){},fillRect(){if(record)alphas.push(this.globalAlpha)},beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){if(record)alphas.push(this.globalAlpha)},drawImage(){if(record)alphas.push(this.globalAlpha)}});
 h.scope.document.createElement=()=>{canvases++;return {getContext:()=>context(false)}};
 const g=context();v.canvasContract(h.settings);const p=v.canvasFrame.palette.art;
 const sample=(seed,time,w=1000,h=600)=>{v.reseed(seed);v.contours(g,w,h,time,p,1);return Array.from(v.contourCache.points)};
 const a=sample(604,3),buffer=v.contourCache.points,glow=v.contourCache.glow;
 assert.deepEqual(sample(604,3),a);assert.equal(v.contourCache.points,buffer);assert.equal(v.contourCache.glow,glow);assert.equal(canvases,1);
 assert.notDeepEqual(sample(605,3),a);assert.notDeepEqual(sample(604,10),a);
 const moving=sample(604,5.7);const rms=Math.sqrt(moving.reduce((sum,x,i)=>sum+(x-a[i])**2,0)/a.length);assert(rms>5,'default motion should visibly deform contours over five wall-clock seconds');
 for(const [w,h] of [[320,700],[1920,500]]){const points=sample(604,3,w,h);assert(points.every(Number.isFinite));assert(points.length<=88*161*2);}
 alphas.length=0;v.contours(g,1920,500,3,p,0);assert(alphas.every(a=>a===0),'zero crossfade opacity must suppress every main-canvas layer');
});
