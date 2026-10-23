'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const source=app.slice(app.indexOf(' function updateDockLayout(){'),app.indexOf(" if(typeof ResizeObserver"));
function measure({height=844,visualHeight=height,offsetTop=0,dockHeight=124,bottom=10}={}){
 const values={},dock={offsetHeight:dockHeight};
 vm.runInNewContext(source+';updateDockLayout();',{cinema:true,innerHeight:height,window:{visualViewport:{height:visualHeight,offsetTop}},$:()=>dock,getComputedStyle:()=>({bottom:String(bottom)}),document:{documentElement:{style:{setProperty:(k,v)=>values[k]=parseFloat(v)}}}});
 return {top:height-values['--dock-clearance']-values['--picker-height'],bottom:height-values['--dock-clearance']};
}
test('phone picker clears the measured compact dock',()=>{const p=measure();assert.equal(p.bottom,698);assert.ok(p.top>=12);});
test('picker stays above the on-screen keyboard and within the visual viewport',()=>{const p=measure({visualHeight:400});assert.ok(p.bottom<=388);assert.ok(p.top>=12);});
test('panned keyboard viewport keeps picker within its visible bounds',()=>{const p=measure({visualHeight:400,offsetTop:150});assert.ok(p.bottom<=538);assert.ok(p.top>=162);});
test('short landscape picker clears the compact dock',()=>{const p=measure({height:320,dockHeight:121});assert.ok(p.bottom<=177);assert.ok(p.top>=12);});

test('active timer stays visible and in the timer button accessible name',()=>{
 const start=app.indexOf(' function updateTimer(){'),end=app.indexOf(' function setTimer(',start);
 const fn=app.slice(start,end);
 const elements={timerReadout:{textContent:''},timerButton:{attrs:{},setAttribute(k,v){this.attrs[k]=v}},sessionProgress:{style:{}}};
 const scope={state:{timer:25},sessionStart:1,currentSessionTimer:()=>90,timeFormat:()=> '01:30',clamp:(x,min,max)=>Math.max(min,Math.min(max,x)),$:id=>elements[id]};
 vm.runInNewContext(fn+';updateTimer();',scope);
 assert.equal(elements.timerReadout.textContent,'01:30');
 assert.match(elements.timerButton.attrs['aria-label'],/25 minutes, 01:30 remaining/);
 assert.match(elements.timerButton.title,/Timer: 25 minutes/);
});

test('visible play label and accessible name stay aligned with playback state',()=>{
 const start=app.indexOf(' function updatePlayback(){'),end=app.indexOf(' async function togglePlay(',start);
 const fn=app.slice(start,end);
 for(const playing of [false,true]){
  const elements={playIcon:{setAttribute(){}},playButtonLabel:{textContent:''},playButton:{setAttribute(k,v){this[k]=v}},stagePlay:{},musicQuickSub:{},musicQuickButton:{setAttribute(k,v){this[k]=v}},transportPeek:{},breathOverlay:{},stageCenter:{style:{}}};
  const scope={playing,sessionStart:null,musicLoading:false,state:{musicSource:'generated',autoMix:false,breathing:false},document:{body:{classList:{toggle(){},remove(){}}}},navigator:{},$:id=>elements[id],icon:()=>'',musicTitle:()=> 'Quiet track',stopTransportTimer(){},scheduleTransportTuck(){},syncBreathingGuide(){}};
  vm.runInNewContext(fn+';updatePlayback();',scope);
  assert.equal(elements.playButtonLabel.textContent,playing?'Pause':'Play');
  assert.match(elements.playButton['aria-label'],playing?/^Pause/:/^Play/);
 }
});
