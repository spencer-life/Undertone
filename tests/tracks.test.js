'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {UndertoneTrackPlayer}=require('../tracks.js');

class Param{constructor(value=0){this.value=value;this.events=[];}cancelScheduledValues(time){this.events.push(['cancel',time]);return this;}setValueAtTime(value,time){this.value=value;this.events.push(['set',value,time]);return this;}linearRampToValueAtTime(value,time){this.value=value;this.events.push(['linear',value,time]);return this;}setTargetAtTime(value,time,constant){this.value=value;this.events.push(['target',value,time,constant]);return this;}}
class Node{constructor(){this.connections=[];}connect(node){this.connections.push(node);return node;}disconnect(){this.connections=[];}}
class Source extends Node{constructor(){super();this.buffer=null;this.loop=false;this.loopStart=0;this.loopEnd=0;this.started=0;this.stopped=0;this.onended=null;}start(){this.started++;}stop(){this.stopped++;if(this.onended)this.onended();}}
class Buffer{constructor(channels,length,rate=48000){this.numberOfChannels=channels;this.length=length;this.sampleRate=rate;this.duration=length/rate;this.channels=Array.from({length:channels},()=>new Float32Array(length));}getChannelData(channel){return this.channels[channel];}}
class Context{
 constructor(){this.currentTime=0;this.sampleRate=48000;this.destination=new Node();this.sources=[];this.buffers=[];this.decodeQueue=[];}
 createGain(){const node=new Node();node.gain=new Param();return node;}
 createBufferSource(){const source=new Source();this.sources.push(source);return source;}
 createBuffer(channels,length,rate){return new Buffer(channels,length,rate);}
 decodeAudioData(){const value=this.decodeQueue.shift();return value instanceof Error?Promise.reject(value):Promise.resolve(value);}
}
class DetachingContext extends Context{decodeAudioData(data){structuredClone(data,{transfer:[data]});return super.decodeAudioData(data);}}
function descriptor(id,loop='seamless'){return{id,title:id,url:`https://example.test/${id}.flac`,loop};}
function response(bytes=new ArrayBuffer(1024),status=200){return{ok:status>=200&&status<300,status,headers:{get(name){return name==='content-length'?String(bytes.byteLength):null;}},arrayBuffer:async()=>bytes,clone(){return response(bytes.slice(0),status);}};}
function decoded(frames=48000){const buffer=new Buffer(2,frames);for(let i=0;i<frames;i++){buffer.channels[0][i]=Math.sin(i*.07);buffer.channels[1][i]=Math.cos(i*.05);}return buffer;}
const nativeFetch=global.fetch;
test.beforeEach(()=>{global.fetch=async()=>response();});
test.afterEach(()=>{global.fetch=nativeFetch;});

test('loads lazily, preserves stereo, and starts one idempotent seamless source',async()=>{
  const ctx=new Context();ctx.decodeQueue.push(decoded());const statuses=[];const player=new UndertoneTrackPlayer(ctx,ctx.destination,{onStatus:event=>statuses.push(event)});
  const loaded=await player.load(descriptor('safe-space'));assert.equal(loaded.id,'safe-space');assert.equal(player.status,'ready');assert.equal(player.loading,false);assert.equal(ctx.sources.length,0,'load must not create a source while paused');
  assert.equal(player.currentTrack.duration,1);assert.equal(player.playing,false);assert.equal(await player.play(),true);assert.equal(await player.play(),true);assert.equal(ctx.sources.length,1,'play must be idempotent');assert.equal(ctx.sources[0].loop,true);assert.equal(ctx.sources[0].buffer.numberOfChannels,2);assert.equal(statuses.filter(event=>event.status==='playing').length,1);
  player.setVolume(50);assert.equal(player._active.gain.gain.value,1);assert.equal(player.output.gain.value,.3);
});

test('prepares one-time equal-power crossfade loop with a rotated continuous splice',async()=>{
  const ctx=new Context(),source=decoded(48000*4);source.channels[0].fill(.4);source.channels[1].fill(-.4);ctx.decodeQueue.push(source);const player=new UndertoneTrackPlayer(ctx,ctx.destination);await player.load({...descriptor('broken-glimmers','crossfade'),crossfadeSeconds:2});const playable=player._loaded.playable;assert.equal(playable.length,source.length-96000);assert.equal(playable.numberOfChannels,2);
  for(const channel of [0,1]){const data=playable.getChannelData(channel),start=Math.abs(data[0]),end=Math.abs(data[data.length-1]);assert(start>.1&&end>.1,'crossfade loop boundary faded to zero');assert(Math.abs(data[0]-data[data.length-1])<.25,'rotated crossfade splice is discontinuous');}
  assert.equal(ctx.sources.length,0,'preparation must not create playback sources');await player.play();assert.equal(ctx.sources.length,1);assert.equal(ctx.sources[0].buffer,playable);assert.equal(ctx.sources[0].loop,true);
});

test('last load wins and stale decode cannot replace the selected track',async()=>{
  const ctx=new Context(),pending=new Map(),oldFetch=global.fetch;global.fetch=url=>new Promise((resolve,reject)=>{pending.set(url,{resolve,reject});});
  try{const player=new UndertoneTrackPlayer(ctx,ctx.destination);const first=player.load(descriptor('first'));const second=player.load(descriptor('second'));await new Promise(resolve=>setImmediate(resolve));pending.get('https://example.test/second.flac').resolve(response());ctx.decodeQueue.push(decoded());await second;pending.get('https://example.test/first.flac').resolve(response());ctx.decodeQueue.push(decoded());await first;assert.equal(player.currentTrack.id,'second');assert.equal(player.status,'ready');}finally{global.fetch=oldFetch;}
});

test('requesting the current track cancels an in-flight different-track request',async()=>{
  const ctx=new Context(),oldFetch=global.fetch,pending=new Map();
  try{global.fetch=async()=>response();const player=new UndertoneTrackPlayer(ctx,ctx.destination);ctx.decodeQueue.push(decoded());await player.load(descriptor('first'));global.fetch=(url,options)=>new Promise((resolve,reject)=>{pending.set(url,{resolve,reject,signal:options&&options.signal});options&&options.signal&&options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));});const second=player.load(descriptor('second'));await new Promise(resolve=>setImmediate(resolve));assert.equal(pending.get('https://example.test/second.flac').signal.aborted,false);const same=await player.load(descriptor('first'));assert.equal(same.id,'first');assert.equal(pending.get('https://example.test/second.flac').signal.aborted,true);await second;assert.equal(player.currentTrack.id,'first');}finally{global.fetch=oldFetch;}
});

test('failed replacement preserves the existing track and reports a useful error',async()=>{
  const ctx=new Context(),oldFetch=global.fetch;
  try{const player=new UndertoneTrackPlayer(ctx,ctx.destination);ctx.decodeQueue.push(decoded());await player.load(descriptor('safe-space'));global.fetch=async()=>response(new ArrayBuffer(16),503);await assert.rejects(()=>player.load(descriptor('bad')),/Could not load track/);assert.equal(player.currentTrack.id,'safe-space');assert.equal(player.status,'ready');assert(player.error instanceof Error);}finally{global.fetch=oldFetch;}
});

test('caches only successfully decoded tracks and loads the cache before network',async()=>{
  const ctx=new Context(),oldFetch=global.fetch,oldCaches=global.caches,entries=new Map(),cache={async match(url){return entries.get(url)||null;},async put(url,value){entries.set(url,value);}};let fetches=0;global.caches={open:async()=>cache};global.fetch=async()=>{fetches++;return response(new ArrayBuffer(2048));};
  try{const first=new UndertoneTrackPlayer(ctx,ctx.destination);ctx.decodeQueue.push(decoded());await first.load(descriptor('safe-space'));assert.equal(fetches,1);assert.equal(entries.size,1);assert.equal(first.offlineAvailable,true);const secondContext=new Context();secondContext.decodeQueue.push(decoded());const second=new UndertoneTrackPlayer(secondContext,secondContext.destination);await second.load(descriptor('safe-space'));assert.equal(fetches,1,'cache hit unexpectedly fetched');assert.equal(second.offline,true);const failingCache={async match(){return null;},async put(){throw new Error('quota');}};global.caches={open:async()=>failingCache};const thirdContext=new Context();thirdContext.decodeQueue.push(decoded());const third=new UndertoneTrackPlayer(thirdContext,thirdContext.destination);await third.load(descriptor('other'));assert.equal(third.offlineAvailable,false);assert.equal(third.currentTrack.id,'other');}finally{global.fetch=oldFetch;global.caches=oldCaches;}
});

test('cache write uses the pre-decode byte length when decode detaches its input',async()=>{
  const oldFetch=global.fetch,oldCaches=global.caches,entries=new Map(),cache={async match(url){return entries.get(url)||null;},async put(url,value){entries.set(url,value);}};global.caches={open:async()=>cache};global.fetch=async()=>response(new ArrayBuffer(2048));
  try{const ctx=new DetachingContext();ctx.decodeQueue.push(decoded());const player=new UndertoneTrackPlayer(ctx,ctx.destination);await player.load(descriptor('detached'));assert.equal(entries.size,1);assert.equal(player.offlineAvailable,true);}finally{global.fetch=oldFetch;global.caches=oldCaches;}
});

test('repairs a corrupt cache entry and clears offline availability when repair fails',async()=>{
  const oldFetch=global.fetch,oldCaches=global.caches,entries=new Map(),cache={async match(url){return entries.get(url)||null;},async put(url,value){entries.set(url,value);}};let fetches=0;global.caches={open:async()=>cache};global.fetch=async()=>{fetches++;return response(new ArrayBuffer(2048));};
  try{const firstContext=new Context();firstContext.decodeQueue.push(decoded());const first=new UndertoneTrackPlayer(firstContext,firstContext.destination);await first.load(descriptor('repair'));const url='https://example.test/repair.flac',corrupt=response(new ArrayBuffer(1));entries.set(url,corrupt);const repairContext=new Context();repairContext.decodeQueue.push(new Error('corrupt cache'),decoded());const repaired=new UndertoneTrackPlayer(repairContext,repairContext.destination);await repaired.load(descriptor('repair'));assert.equal(fetches,2);assert.equal(repaired.offline,false);assert.equal(repaired.offlineAvailable,true);assert.notEqual(entries.get(url),corrupt);entries.set(url,corrupt);global.fetch=async()=>response(new ArrayBuffer(16),503);const failedContext=new Context();failedContext.decodeQueue.push(new Error('corrupt cache'));const failed=new UndertoneTrackPlayer(failedContext,failedContext.destination);await assert.rejects(()=>failed.load(descriptor('repair')),/Could not load track/);assert.equal(failed.offline,false);assert.equal(failed.offlineAvailable,false);}finally{global.fetch=oldFetch;global.caches=oldCaches;}
});

test('rejects mono and oversized decoded tracks before playback',async()=>{
  const ctx=new Context(),oldFetch=global.fetch;global.fetch=async()=>response();
  try{const player=new UndertoneTrackPlayer(ctx,ctx.destination);ctx.decodeQueue.push(new Buffer(1,100));await assert.rejects(()=>player.load(descriptor('mono')),/stereo/);assert.equal(player.currentTrack,null);ctx.decodeQueue.push({numberOfChannels:2,length:40*1024*1024,sampleRate:48000,duration:40*1024*1024/48000,getChannelData(){return new Float32Array(1);}});await assert.rejects(()=>player.load(descriptor('large')),/128 MiB/);assert.equal(player.currentTrack,null);}finally{global.fetch=oldFetch;}
});

test('pause flags playback, stop removes the source, and destroy aborts loading',async()=>{
  const ctx=new Context(),oldFetch=global.fetch;let rejectLoad;global.fetch=()=>new Promise((resolve,reject)=>{rejectLoad=reject;});
  try{const player=new UndertoneTrackPlayer(ctx,ctx.destination);ctx.decodeQueue.push(decoded());global.fetch=async()=>response();await player.load(descriptor('safe-space'));await player.play();player.pause();assert.equal(player.playing,false);assert.equal(ctx.sources[0].stopped,0);await player.play();player.stop(.7);assert.equal(player._active,null);await player.play();assert.notEqual(player._active.source,ctx.sources[0],'fade stop left a source scheduled for reuse');player.stop();assert.equal(player._active,null);assert.equal(player.status,'ready');global.fetch=()=>new Promise((resolve,reject)=>{rejectLoad=reject;});const loading=player.load(descriptor('pending'));await player.destroy();assert.equal(player.status,'destroyed');assert.equal(player.currentTrack,null);rejectLoad(new DOMException('Aborted','AbortError'));await loading.catch(()=>{});}finally{global.fetch=oldFetch;}
});

test('auto mix rotates at the AudioContext loop boundary with an eight-second crossfade',async()=>{
  const ctx=new Context(),statuses=[],first=descriptor('first'),second=descriptor('second');ctx.decodeQueue.push(new Buffer(2,20*48000));const player=new UndertoneTrackPlayer(ctx,ctx.destination,{onStatus:event=>statuses.push(event)});await player.load(first);await player.play();assert.equal(player.setAutoMix([first,second],true),true);assert.equal(player.autoMix,true);assert.equal(player._autoDueTime(),12);
  player._clearAutoTimer();ctx.currentTime=12;const oldEntry=player._active;ctx.decodeQueue.push(new Buffer(2,20*48000));await player._runAutoMix(player._autoEpoch);assert.equal(player.currentTrack.id,'second');assert.equal(ctx.sources.length,2);assert.deepEqual(player._active.gain.gain.events.at(-1),['linear',1,20]);assert.deepEqual(oldEntry.gain.gain.events.at(-1),['linear',0,20]);assert.equal(statuses.at(-1).currentTrack.id,'second');assert.equal(statuses.at(-1).autoMix,true);assert.equal(statuses.at(-1).trackChanged,true);assert.equal(statuses.at(-1).transitionReason,'auto');await player.destroy();
});

test('manual next uses the library order and keeps the normal one-second transition',async()=>{
  const ctx=new Context(),tracks=[descriptor('first'),descriptor('second'),descriptor('third')],player=new UndertoneTrackPlayer(ctx,ctx.destination);ctx.decodeQueue.push(new Buffer(2,20*48000));await player.load(tracks[0]);await player.play();player.setAutoMix(tracks,false);ctx.currentTime=5;ctx.decodeQueue.push(new Buffer(2,20*48000));const next=await player.nextTrack();assert.equal(next.id,'second');assert.equal(player.currentTrack.id,'second');assert.deepEqual(player._active.gain.gain.events.at(-1),['linear',1,6]);await player.destroy();
});

test('an auto-load failure keeps the current native loop and retries only next period',async()=>{
  const ctx=new Context(),first=descriptor('first'),second=descriptor('second'),player=new UndertoneTrackPlayer(ctx,ctx.destination);ctx.decodeQueue.push(new Buffer(2,20*48000));await player.load(first);await player.play();player.setAutoMix([first,second],true);player._clearAutoTimer();ctx.currentTime=12;global.fetch=async()=>response(new ArrayBuffer(16),503);await player._runAutoMix(player._autoEpoch);assert.equal(player.currentTrack.id,'first');assert.equal(player._active.loaded.track.id,'first');assert.equal(ctx.sources.length,1);assert.equal(player.status,'playing');assert.equal(player._autoRetryAt,32);assert(player._autoTimer!==null);await player.destroy();assert.equal(player._autoTimer,null);
});

test('cancelLoad aborts a pending replacement without stopping current playback',async()=>{
  const ctx=new Context(),first=descriptor('first'),second=descriptor('second'),player=new UndertoneTrackPlayer(ctx,ctx.destination);ctx.decodeQueue.push(decoded());await player.load(first);await player.play();let pendingSignal;global.fetch=(url,options)=>new Promise((resolve,reject)=>{pendingSignal=options&&options.signal;pendingSignal&&pendingSignal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));});const replacement=player.load(second);await new Promise(resolve=>setImmediate(resolve));assert.equal(player.cancelLoad(),true);assert.equal(pendingSignal.aborted,true);assert.equal(await replacement,null);assert.equal(player.currentTrack.id,'first');assert.equal(player.playing,true);assert.equal(player.status,'playing');assert.equal(player.loading,false);assert.equal(player.cancelLoad(),false);await player.destroy();
});

test('a manual selection aborts an in-flight automatic change and remains authoritative',async()=>{
  const ctx=new Context(),first=descriptor('first'),second=descriptor('second'),manual=descriptor('manual'),player=new UndertoneTrackPlayer(ctx,ctx.destination);ctx.decodeQueue.push(new Buffer(2,20*48000));await player.load(first);await player.play();player.setAutoMix([first,second],true);player._clearAutoTimer();let autoSignal;global.fetch=(url,options)=>url===second.url?new Promise((resolve,reject)=>{autoSignal=options.signal;autoSignal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));}):Promise.resolve(response());const automatic=player._runAutoMix(player._autoEpoch);await new Promise(resolve=>setImmediate(resolve));ctx.decodeQueue.push(new Buffer(2,20*48000));const selected=await player.load(manual);assert.equal(autoSignal.aborted,true);assert.equal(await automatic,undefined);assert.equal(selected.id,'manual');assert.equal(player.currentTrack.id,'manual');assert.equal(player._active.loaded.track.id,'manual');await player.destroy();
});

test('disabling, pausing, stopping, and destroying auto mix cancel its pending work',async()=>{
  const ctx=new Context(),first=descriptor('first'),second=descriptor('second'),player=new UndertoneTrackPlayer(ctx,ctx.destination);ctx.decodeQueue.push(new Buffer(2,20*48000));await player.load(first);await player.play();player.setAutoMix([first,second],true);assert(player._autoTimer!==null);player.pause();assert.equal(player._autoTimer,null);await player.play();assert(player._autoTimer!==null);player.setAutoMix([first,second],false);assert.equal(player._autoTimer,null);assert.equal(player.autoMix,false);player.setAutoMix([first,second],true);player.stop();assert.equal(player._autoTimer,null);await player.play();assert(player._autoTimer!==null);await player.destroy();assert.equal(player._autoTimer,null);assert.equal(player.currentTrack,null);
});
