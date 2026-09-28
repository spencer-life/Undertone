'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const policy=()=>import('../gpu/optimized-black-hole/runtime-state.mjs');
test('Event horizon motion freezes at zero and reduced motion, and clamps resume gaps',async()=>{
 const {blackHoleTime}=await policy();
 assert.equal(blackHoleTime(4,1000,1100,0,false),4);
 assert.equal(blackHoleTime(4,1000,1100,100,true),4);
 assert.equal(blackHoleTime(4,null,1100,100,false),4);
 assert.equal(blackHoleTime(4,1000,990,100,false),4);
 assert.equal(blackHoleTime(4,1000,90000,60,false),blackHoleTime(4,1000,1100,60,false));
 assert.ok(blackHoleTime(4,1000,1100,100,false)>blackHoleTime(4,1000,1100,60,false));
});
test('Event horizon bounds render cost while preserving viewport aspect',async()=>{
 const {blackHoleViewport}=await policy();
 for(const [w,h] of [[390,844],[834,1194],[1194,834],[1728,900],[3840,2160]]){
  const [x,y]=blackHoleViewport(w,h);
  assert.ok(x>0&&y>0&&x*y<=925000);
  assert.ok(Math.abs(x/y-w/h)<0.01);
  const eco=blackHoleViewport(w,h,true);assert.ok(eco[0]<x&&eco[1]<y);
 }
});
test('Event horizon framing is centered and never masks the mobile scene',async()=>{
 const {blackHoleLayout,paletteColor}=await policy();
 const mobile=blackHoleLayout(390,844),desktop=blackHoleLayout(1440,900);
 assert.equal(mobile.centerFade,0);assert.equal(desktop.centerFade,0);
 assert.equal(mobile.centerX,0);assert.ok(mobile.fov<desktop.fov);
 assert.deepEqual(paletteColor('#ff0080'),[1,0,128/255,1]);
 assert.deepEqual(paletteColor('invalid'),[0.5,0.5,0.5,1]);
});
