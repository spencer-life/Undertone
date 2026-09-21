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
test('blackout and hidden document stop rendering work',()=>{
 const h=visualHarness();h.settings.blackout=true;h.visual.frame(1000);assert.equal(h.paints(),0);h.settings.blackout=false;h.scope.document.hidden=true;h.visual.frame(2000);assert.equal(h.paints(),0);h.scope.document.hidden=false;h.visual.frame(3000);assert.equal(h.paints(),1);
});

test('orb geometry visibly changes with elapsed time',()=>{
 const {visual}=visualHarness();
 const sample=t=>{const points=[];const gradient={addColorStop(){}};const g={createRadialGradient:()=>gradient,fillRect(){},translate(){},rotate(v){points.push(v)},beginPath(){},lineTo(x,y){points.push(x,y)},moveTo(x,y){points.push(x,y)},stroke(){},save(){},restore(){},ellipse(...args){points.push(...args)}};visual.orbit(g,1000,600,t,['#000000','#222222','#555555','#999999','#ffffff'],1);return points;};
 const a=sample(0),b=sample(5);let square=0;for(let i=0;i<a.length;i++)square+=(a[i]-b[i])**2;assert(Math.sqrt(square/a.length)>10,'orb should move noticeably within five scene seconds');
});
