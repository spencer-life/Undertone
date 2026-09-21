'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');

function harness(){
 const alphas=[];
 const gradient=()=>({addColorStop(offset,color){assert(!String(color).includes('NaN'),`invalid gradient stop ${color}`);}});
 const context=(record=true)=>({setTransform(){},createLinearGradient:gradient,createRadialGradient:gradient,clearRect(){},fillRect(){if(record)alphas.push(this.globalAlpha)},drawImage(){if(record)alphas.push(this.globalAlpha)},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){if(record)alphas.push(this.globalAlpha)},stroke(){if(record)alphas.push(this.globalAlpha)}});
 const scope={window:{devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener(){}},document:{hidden:false,createElement:()=>({getContext:()=>context(false)})},requestAnimationFrame(){}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../visuals.js'),'utf8')+'\nglobalThis.Visual=UndertoneVisuals;',scope);
 const canvas={getContext:()=>context(true),getBoundingClientRect:()=>({width:1000,height:600})};
 const settings={scene:'dunes',theme:'noir',motion:40,brightness:80};
 const visual=new scope.Visual(canvas,()=>settings,()=>0);
 const palette=['#09090c','#222228','#52525c','#909099','#d9d9df'];
 visual.canvasFrame.viewport.dpr=1;visual.canvasFrame.palette={name:'Noir',art:palette};
 return {visual,palette,context,alphas};
}

test('silk is seeded, animated, and reuses typed geometry buffers',()=>{
 const h=harness(),v=h.visual,g=h.context();v.reseed(604);v.silk(g,1000,600,0,h.palette,1);
 const cache=v.silkCache,points=cache.points,first=Array.from(points);
 v.silk(g,1000,600,5,h.palette,1);const moved=Array.from(points);
 assert.equal(v.silkCache,cache);assert.equal(v.silkCache.points,points);assert.notDeepEqual(moved,first);assert(moved.every(Number.isFinite));
 v.silk(g,1000,600,0,h.palette,1);assert.deepEqual(Array.from(points),first);
 v.reseed(605);v.silk(g,1000,600,0,h.palette,1);assert.notDeepEqual(Array.from(v.silkCache.points),first);
});

test('silk zero crossfade suppresses every main-canvas layer',()=>{
 const h=harness(),v=h.visual,g=h.context();v.reseed(604);h.alphas.length=0;v.silk(g,1000,600,3,h.palette,0);
 assert(h.alphas.length>0);assert(h.alphas.every(alpha=>alpha===0));
});
