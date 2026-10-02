'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('Orbit GPU budget preserves aspect and caps high-DPR full-screen work',async()=>{
 const {orbitRenderSize}=await import('../gpu/render-budget.mjs');
 for(const [w,h] of [[390,844],[834,1194],[1440,900],[3840,2160]]){
  const [x,y]=orbitRenderSize(w,h,2);
  assert.ok(x*y<925000);assert.ok(Math.abs(x/y-w/h)<0.01);
  const eco=orbitRenderSize(w,h,2,true);assert.ok(eco[0]<x&&eco[1]<y);
 }
});
