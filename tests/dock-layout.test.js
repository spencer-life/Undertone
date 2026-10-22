'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const source=app.slice(app.indexOf(' function updateDockLayout(){'),app.indexOf(" if(typeof ResizeObserver"));
function measure({height=844,visualHeight=height,offsetTop=0,dockHeight=247,bottom=10}={}){
 const values={},dock={offsetHeight:dockHeight};
 vm.runInNewContext(source+';updateDockLayout();',{cinema:true,innerHeight:height,window:{visualViewport:{height:visualHeight,offsetTop}},$:()=>dock,getComputedStyle:()=>({bottom:String(bottom)}),document:{documentElement:{style:{setProperty:(k,v)=>values[k]=parseFloat(v)}}}});
 return {top:height-values['--dock-clearance']-values['--picker-height'],bottom:height-values['--dock-clearance']};
}
test('phone picker clears the measured dock',()=>{const p=measure();assert.equal(p.bottom,575);assert.ok(p.top>=12);});
test('picker stays above the on-screen keyboard and within the visual viewport',()=>{const p=measure({visualHeight:400});assert.ok(p.bottom<=388);assert.ok(p.top>=12);});
test('panned keyboard viewport keeps picker within its visible bounds',()=>{const p=measure({visualHeight:400,offsetTop:150});assert.ok(p.bottom<=538);assert.ok(p.top>=162);});
test('short landscape picker clears the compact dock',()=>{const p=measure({height:320,dockHeight:121});assert.ok(p.bottom<=177);assert.ok(p.top>=12);});
