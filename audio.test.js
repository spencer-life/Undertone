'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const vm=require('node:vm');
const test=require('node:test');
const {UndertoneAudio,UT_SCORES}=require('./audio.js');

function processorClass(rate=48000){
  let Processor;
  const context={sampleRate:rate,AudioWorkletProcessor:class{constructor(){this.port={onmessage:null,postMessage(){}};}},registerProcessor(_name,klass){Processor=klass;}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'audio-worklet.js'),'utf8'),context,{filename:'audio-worklet.js'});
  return Processor;
}

function makeProcessor(kind,rate=48000){
  const Processor=processorClass(rate),processor=new Processor();
  processor.port.onmessage({data:{type:'settings',noiseType:kind}});
  return processor;
}

function processBlock(processor,blockSize){
  const output=Array.from({length:3},()=>Array.from({length:2},()=>new Float32Array(blockSize)));
  processor.process([],output);return output;
}

function renderSamples(kind,seconds=2,blockSize=128){
  const processor=makeProcessor(kind),samples=new Float32Array(seconds*48000),blocks=Math.ceil(samples.length/blockSize);
  let offset=0;
  for(let n=0;n<blocks;n++){const data=processBlock(processor,blockSize)[0][0];samples.set(data.subarray(0,Math.min(data.length,samples.length-offset)),offset);offset+=data.length;}
  return samples;
}

function longStats(kind,outputIndex){
  const rate=8000,processor=makeProcessor(kind,rate),sampleCount=65*rate,blockSize=256,centers=[];for(const period of [10,13,15])for(let second=period;second<65;second+=period)centers.push(second*rate);const energy=centers.map(()=>0),reference=centers.map(()=>0),counts=centers.map(()=>0),referenceCounts=centers.map(()=>0),window=Math.round(rate*.02),referenceOffset=Math.round(rate*.2);let peak=0,offset=0;
  while(offset<sampleCount){const data=processBlock(processor,blockSize)[outputIndex][0];for(let i=0;i<data.length&&offset+i<sampleCount;i++){const sample=data[i],absolute=offset+i;peak=Math.max(peak,Math.abs(sample));for(let b=0;b<centers.length;b++){const distance=Math.abs(absolute-centers[b]);if(distance<window/2){energy[b]+=sample*sample;counts[b]++;}else if(Math.abs(distance-referenceOffset)<window/2){reference[b]+=sample*sample;referenceCounts[b]++;}}}offset+=data.length;}
  return {peak,ratios:energy.map((sum,i)=>(sum/counts[i])/(reference[i]/referenceCounts[i]||1))};
}

test('continuous textures remain bounded through old 10/13/15-second loop boundaries',()=>{
  for(const kind of ['brown','pink','white']){
    const stats=longStats(kind,0),ratios=stats.ratios.slice().sort((a,b)=>a-b),median=ratios[Math.floor(ratios.length/2)];assert(stats.peak<.5,`${kind} clipped at ${stats.peak}`);assert(median>.7,`${kind} has an envelope seam median ratio ${median}`);
  }
  for(const outputIndex of [1,2]){
    const stats=longStats('pink',outputIndex),ratios=stats.ratios.slice().sort((a,b)=>a-b),median=ratios[Math.floor(ratios.length/2)];assert(stats.peak<.5,`texture ${outputIndex} clipped`);assert(median>.55,`texture ${outputIndex} has an envelope seam median ratio ${median}`);
  }
});

test('render output is block-size invariant and noise type changes crossfade',()=>{
  const a=renderSamples('pink',2,128),b=renderSamples('pink',2,256);let difference=0;for(let i=0;i<a.length;i++)difference=Math.max(difference,Math.abs(a[i]-b[i]));assert(difference<1e-6,`block size changed output by ${difference}`);
  const processor=makeProcessor('pink');let previous=processBlock(processor,128)[0][0][127];processor.port.onmessage({data:{type:'settings',noiseType:'white'}});let maximumJump=0;for(let n=0;n<200;n++){const data=processBlock(processor,128)[0][0];for(const sample of data){maximumJump=Math.max(maximumJump,Math.abs(sample-previous));previous=sample;}}assert(maximumJump<.5,`noise type transition clicked at ${maximumJump}`);
});

class MockParam {
  constructor(value=0){this.value=value;}
  cancelScheduledValues(){return this;}
  setValueAtTime(value){this.value=value;return this;}
  linearRampToValueAtTime(value){this.value=value;return this;}
  exponentialRampToValueAtTime(value){this.value=value;return this;}
  setTargetAtTime(value){this.value=value;return this;}
}
class MockNode {
  connect(){return this;}
  disconnect(){return this;}
}
class MockContext {
  constructor(){this.currentTime=0;this.sampleRate=48000;this.state='suspended';this.destination=new MockNode();this.destination.channelCount=2;}
  createGain(){const n=new MockNode();n.gain=new MockParam();return n;}
  createDynamicsCompressor(){const n=new MockNode();for(const key of ['threshold','knee','ratio','attack','release'])n[key]=new MockParam();return n;}
  createBiquadFilter(){const n=new MockNode();n.frequency=new MockParam();n.Q=new MockParam();return n;}
  createConvolver(){return new MockNode();}
  createAnalyser(){const n=new MockNode();n.fftSize=256;n.getFloatTimeDomainData=data=>data.fill(0);return n;}
  createChannelMerger(){return new MockNode();}
  createStereoPanner(){const n=new MockNode();n.pan=new MockParam();return n;}
  createOscillator(){const n=new MockNode();n.frequency=new MockParam();n.detune=new MockParam();n.start=()=>{};n.stop=()=>{};n.type='sine';return n;}
  createScriptProcessor(){return new MockNode();}
  createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length),numberOfChannels:channels,length};}
  async resume(){this.state='running';}
  async suspend(){this.state='suspended';}
  async close(){this.state='closed';}
}

test('pause, resume, timer, stop, and destroy preserve transport state',async()=>{
  const previousWindow=global.window;global.window={AudioContext:MockContext,isSecureContext:false};
  const settings={score:'velvet',noiseType:'brown',master:35,pad:70,melody:0,rain:10,ocean:10,noise:10,beats:true,beatVolume:14,carrier:220,hz:10,route:'speakers'};
  const audio=new UndertoneAudio();
  try{
    await audio.init(settings);assert.equal(audio.textureMode,'fallback');assert.deepEqual(Object.keys(UT_SCORES),['velvet','horizon','nocturne']);assert(audio.voices.some(voice=>voice.kind==='bell'),'melody events were not rendered ahead while muted');
    await audio.play(settings);assert.equal(audio.running,true);assert.equal(audio.ctx.state,'running');
    await audio.pause();assert.equal(audio.running,false);assert.equal(audio.ctx.state,'suspended');assert.equal(audio.transport.gain.value,0);
    await audio.play({...settings,melody:22});assert.equal(audio.running,true);assert.equal(audio.ctx.state,'running');assert(audio.liveSettings.melody===22);
    audio.chordIndex=77;audio.scoreEpoch=1;audio.nextChord=-20;audio.schedule();assert.equal(audio.scoreEpoch,.05,'scheduler starvation did not realign the score epoch');
    audio.armTimer(10);assert.equal(audio.remaining(),10);audio.clearTimer();assert.equal(audio.remaining(),null);
    await audio.stop();assert.equal(audio.running,false);assert.equal(audio.ctx.state,'suspended');assert.equal(audio.chordIndex,0);assert.equal(audio.nextChord,.08);assert.equal(audio.scoreEpoch,.08);await audio.destroy();assert.equal(audio.ctx,null);
  }finally{global.window=previousWindow;}
});
