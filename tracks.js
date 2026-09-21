/* Optional authored music player. It owns one clean stereo music source and
   connects it to the destination supplied by the caller (normally the shared
   safety limiter). It never touches the procedural beat or texture buses. */
'use strict';

const MAX_FILE_BYTES=80*1024*1024;
const MAX_PCM_BYTES=128*1024*1024;
const TRACK_FADE_SECONDS=1;
const TRACK_CACHE='undertone-library-v1';
const trackClamp=(value,min,max)=>Math.max(min,Math.min(max,value));

class UndertoneTrackPlayer {
 constructor(ctx,destination,{onStatus}={}){
  if(!ctx||!destination)throw new TypeError('UndertoneTrackPlayer needs an AudioContext and a destination node.');
  this.ctx=ctx;this.destination=destination;this.onStatus=typeof onStatus==='function'?onStatus:null;
  this.output=ctx.createGain();this.output.gain.value=.6;this.output.connect(destination);
  this._volume=100;this._currentTrack=null;this._loaded=null;this._active=null;this._retiring=new Set();this._playing=false;this._generation=0;this._abort=null;this._destroyed=false;
  this.loading=false;this.error=null;this.status='idle';this.offline=false;this.offlineAvailable=false;
 }
 get currentTrack(){return this._currentTrack;}
 get playing(){return this._playing;}
 setVolume(value){if(this._destroyed)return;const next=trackClamp(Number(value)||0,0,100);this._volume=next;const target=.6*next/100,param=this.output.gain,t=this.ctx.currentTime;param.cancelScheduledValues(t);param.setTargetAtTime(target,t,.08);}
 _notify(status,error=null){this.status=status;if(error)this.error=error;const payload={status:this.status,loading:this.loading,error:this.error,currentTrack:this._currentTrack,playing:this._playing,offline:this.offline,offlineAvailable:this.offlineAvailable};if(this.onStatus)try{this.onStatus(payload);}catch(_){} }
 _validateTrack(track){if(!track||typeof track!=='object')throw new TypeError('A track descriptor is required.');if(typeof track.id!=='string'||!track.id)throw new TypeError('A track id is required.');if(typeof track.url!=='string'||!track.url)throw new TypeError('A track URL is required.');if(track.loop!=='seamless'&&track.loop!=='crossfade')throw new TypeError('Track loop must be “seamless” or “crossfade”.');return track;}
 async _openCache(){const api=typeof globalThis!=='undefined'?globalThis.caches:null;if(!api||typeof api.open!=='function')return null;try{return await api.open(TRACK_CACHE);}catch(_){return null;}}
 async _getResponse(url,signal){const cache=await this._openCache();if(cache){try{const cached=await cache.match(url);if(cached){this.offline=true;this.offlineAvailable=true;return{response:cached,cache,fromCache:true};}}catch(_){} }this.offline=false;this.offlineAvailable=false;const response=await globalThis.fetch(url,signal?{signal}:undefined);return{response,cache,fromCache:false};}
 async load(track){
  this._validateTrack(track);if(this._destroyed)throw new Error('The track player has been destroyed.');
  const hadPending=!!this._abort||this.loading;const generation=++this._generation;if(this._abort)try{this._abort.abort();}catch(_){}this._abort=null;
  if(this._loaded&&this._currentTrack&&this._currentTrack.id===track.id){this.loading=false;if(hadPending)this._notify(this._playing?'playing':'ready');return this._currentTrack;}
  const controller=typeof AbortController==='function'?new AbortController():null;this._abort=controller;this.loading=true;this.error=null;this._notify('loading');
  try{
   let source=await this._getResponse(track.url,controller&&controller.signal);let response=source.response;if(generation!==this._generation)return null;if(!response||!response.ok)throw new Error(`Could not load track (${response?response.status:'network error'}).`);
   let cacheCandidate=!source.fromCache&&response&&typeof response.clone==='function'?response.clone():null;
   const advertised=Number(response.headers&&response.headers.get&&response.headers.get('content-length'));if(Number.isFinite(advertised)&&advertised>MAX_FILE_BYTES)throw new Error('This track is larger than the 80 MiB browser limit.');
   let encoded=await response.arrayBuffer();if(generation!==this._generation)return null;let encodedLength=encoded.byteLength;if(encodedLength>MAX_FILE_BYTES)throw new Error('This track is larger than the 80 MiB browser limit.');
   let decoded;try{decoded=await this.ctx.decodeAudioData(encoded);}catch(_){
    if(source.fromCache){this.offline=false;this.offlineAvailable=false;response=await globalThis.fetch(track.url,controller?{signal:controller.signal}:undefined);if(!response||!response.ok)throw new Error(`Could not load track (${response?response.status:'network error'}).`);cacheCandidate=response&&typeof response.clone==='function'?response.clone():null;const retryBytes=await response.arrayBuffer();if(retryBytes.byteLength>MAX_FILE_BYTES)throw new Error('This track is larger than the 80 MiB browser limit.');encoded=retryBytes;encodedLength=retryBytes.byteLength;try{decoded=await this.ctx.decodeAudioData(retryBytes);source.fromCache=false;}catch(__){throw new Error('This browser could not decode the FLAC track. Try a browser with FLAC support or provide a compatible source.');}}
    else throw new Error('This browser could not decode the FLAC track. Try a browser with FLAC support or provide a compatible source.');
   }
   if(generation!==this._generation)return null;if(!decoded||decoded.numberOfChannels!==2)throw new Error('Undertone tracks must decode as stereo (two channels).');
   if(!decoded.length)throw new Error('The decoded track is empty.');const pcmBytes=decoded.numberOfChannels*decoded.length*4;if(pcmBytes>MAX_PCM_BYTES)throw new Error('This decoded track exceeds the 128 MiB PCM memory limit.');
   if(!source.fromCache&&source.cache&&cacheCandidate&&encodedLength>0)try{await source.cache.put(track.url,cacheCandidate);this.offlineAvailable=true;}catch(_){this.offlineAvailable=false;}
   const playable=track.loop==='crossfade'?this._makeCrossfadeLoop(decoded,track.crossfadeSeconds):decoded;
   const loaded={track:{...track,duration:decoded.duration,sampleRate:decoded.sampleRate,channels:decoded.numberOfChannels},playable};
   if(generation!==this._generation)return null;
   this._loaded=loaded;this._currentTrack=loaded.track;this.loading=false;
   if(this._playing)this._crossfadeTo(loaded);else{this._stopAll();this._notify('ready');}
   return this._currentTrack;
  }catch(error){
   if(generation!==this._generation||error&&error.name==='AbortError')return null;
   this.error=error instanceof Error?error:new Error(String(error));this.loading=false;this._notify(this._playing?'playing':this._currentTrack?'ready':'error',this.error);throw this.error;
  }finally{if(generation===this._generation){this.loading=false;if(this._abort===controller)this._abort=null;}}
 }
 _makeCrossfadeLoop(source,requestedSeconds){
  const rate=source.sampleRate,frames=source.length;let overlap=Math.floor(rate*trackClamp(Number(requestedSeconds)||2,.05,15));overlap=Math.min(overlap,Math.floor(frames/2));if(overlap<2)return source;
  const result=this.ctx.createBuffer(2,frames-overlap,rate);
  for(let channel=0;channel<2;channel++){const input=source.getChannelData(channel),output=result.getChannelData(channel);for(let i=0;i<overlap;i++){const t=i/Math.max(1,overlap-1),tail=Math.cos(t*Math.PI/2),head=Math.sin(t*Math.PI/2);output[i]=input[frames-overlap+i]*tail+input[i]*head;}for(let i=overlap;i<frames-overlap;i++)output[i]=input[i];}
  return result;
 }
 _newSource(loaded,initialGain){
  const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=loaded.playable;source.loop=true;source.loopStart=0;source.loopEnd=loaded.playable.duration;gain.gain.value=initialGain;source.connect(gain);gain.connect(this.output);const entry={source,gain,loaded};source.onended=()=>{if(this._active===entry)this._active=null;this._retiring.delete(entry);try{gain.disconnect();}catch(_){} };source.start();return entry;
 }
 _stopEntry(entry){if(!entry)return;try{entry.source.onended=null;entry.source.stop();}catch(_){}try{entry.source.disconnect();}catch(_){}try{entry.gain.disconnect();}catch(_){}this._retiring.delete(entry);if(this._active===entry)this._active=null;}
 _stopActive(){if(this._active)this._stopEntry(this._active);}
 _stopAll(){this._stopActive();for(const entry of [...this._retiring])this._stopEntry(entry);}
 _crossfadeTo(loaded){
  const old=this._active,t=this.ctx.currentTime,fade=TRACK_FADE_SECONDS,newEntry=this._newSource(loaded,0);this._active=newEntry;
  const target=1,newGain=newEntry.gain.gain;newGain.setValueAtTime(0,t);newGain.linearRampToValueAtTime(target,t+fade);
  if(old){this._retiring.add(old);const oldGain=old.gain.gain;oldGain.cancelScheduledValues(t);oldGain.setValueAtTime(oldGain.value,t);oldGain.linearRampToValueAtTime(0,t+fade);try{old.source.stop(t+fade+.03);}catch(_){}setTimeout(()=>this._stopEntry(old),(fade+.2)*1000);}
  this._notify('playing');
 }
 async play(){if(this._destroyed)throw new Error('The track player has been destroyed.');if(!this._loaded){this.error=new Error('Load a track before playing.');this._notify('error',this.error);return false;}if(this._playing)return true;if(!this._active)this._active=this._newSource(this._loaded,1);else{const param=this._active.gain.gain;param.setTargetAtTime(1,this.ctx.currentTime,.08);}this._playing=true;this.error=null;this._notify('playing');return true;}
 pause(){if(this._destroyed)return;this._playing=false;this._notify(this._currentTrack?'paused':'idle');}
 stop(fadeSeconds=0){if(this._destroyed)return;this._generation++;if(this._abort)try{this._abort.abort();}catch(_){}this._abort=null;this.loading=false;this._playing=false;const fade=trackClamp(Number(fadeSeconds)||0,0,4),entry=this._active;if(entry&&fade>0){this._active=null;this._retiring.add(entry);const t=this.ctx.currentTime,param=entry.gain.gain;param.cancelScheduledValues(t);param.setValueAtTime(param.value,t);param.linearRampToValueAtTime(0,t+fade);try{entry.source.stop(t+fade+.03);}catch(_){}setTimeout(()=>this._stopEntry(entry),(fade+.2)*1000);}else this._stopAll();this._notify(this._currentTrack?'ready':'idle');}
 async destroy(){if(this._destroyed)return;this._destroyed=true;this._generation++;if(this._abort)try{this._abort.abort();}catch(_){}this._abort=null;this._playing=false;this._stopAll();try{this.output.disconnect();}catch(_){}this._loaded=null;this._currentTrack=null;this.loading=false;this._notify('destroyed');}
}

if(typeof window!=='undefined')window.UndertoneTrackPlayer=UndertoneTrackPlayer;
if(typeof module!=='undefined'&&module.exports)module.exports={UndertoneTrackPlayer,MAX_FILE_BYTES,MAX_PCM_BYTES};
