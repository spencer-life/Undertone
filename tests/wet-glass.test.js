'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function harness(){
 let gradients=0,canvases=0;const paints=[];
 const gradient=()=>{gradients++;return {addColorStop(offset,color){assert(!color.includes('NaN'))}}};
 const context=(record=false)=>({globalAlpha:1,setTransform(){},save(){},restore(){},translate(){},scale(){},createLinearGradient:gradient,createRadialGradient:gradient,fillRect(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},ellipse(){},clip(){},drawImage(image,...args){assert(image);assert(args.every(Number.isFinite));if(record)paints.push({image,args,alpha:this.globalAlpha});}});
 const scope={window:{devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener(){}},document:{hidden:false,createElement:()=>{canvases++;return{getContext:()=>context()}}},requestAnimationFrame(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../visuals.js'),'utf8')+'\nglobalThis.Visual=UndertoneVisuals;globalThis.palette=UT_THEMES.ocean.art;',scope);
 const canvas={getContext:()=>context(),getBoundingClientRect:()=>({width:1000,height:600})};const visual=new scope.Visual(canvas,()=>({}),()=>0);
 return {visual,palette:scope.palette,g:context(true),paints,counts:()=>({gradients,canvases})};
}
test('wet glass reuses sprites and gradients; foreground rain moves deterministically',()=>{
 const h=harness(),v=h.visual;const draw=t=>{h.paints.length=0;v.wetGlass(h.g,1000,600,t,h.palette,1);return h.paints.map(p=>p.args)};
 const start=draw(0),resources=h.counts(),plate=v.glassPlate;
 const moved=draw(3);assert.notDeepEqual(moved,start);assert.deepEqual(h.counts(),resources);assert.equal(v.glassPlate,plate);assert.deepEqual(draw(0),start);
 v.reseed(605);assert.notDeepEqual(draw(0),start);assert.equal(h.counts().canvases,resources.canvases);
});
test('wet glass preserves zero opacity and handles a tiny resized viewport',()=>{
 const h=harness();h.visual.wetGlass(h.g,8,8,2,h.palette,0);assert(h.paints.length>0);assert(h.paints.every(p=>p.alpha===0));
});
