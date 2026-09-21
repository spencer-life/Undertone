/* Undertone audio engine. Native Web Audio; no recordings, dependencies or requests.
   Beat signals bypass music effects to preserve left/right separation.
   All levels are relative digital gain, NEVER an estimate of ear-level dB SPL. */
'use strict';

const UT_SCORES={
 velvet:{name:'Velvet room',chords:[[50,57,60,64,69],[46,53,57,60,65],[53,60,64,67,72],[48,55,60,62,67]],notes:[62,65,69,72,74,77],seconds:22,cutoff:950},
 horizon:{name:'Open horizon',chords:[[48,55,59,62,67],[45,52,55,59,64],[41,48,52,57,60],[43,50,55,57,62]],notes:[60,64,67,71,74,79],seconds:18,cutoff:1350},
 nocturne:{name:'After midnight',chords:[[45,52,55,59,64],[41,48,52,55,60],[48,55,59,62,67],[43,50,53,57,62]],notes:[57,60,64,67,71,72],seconds:27,cutoff:720}
};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function seededRandom(seed){let state=(seed>>>0)||1;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}

class UndertoneAudio {
 constructor(){this.ctx=null;this.voices=[];this.nodes=[];this.noiseSources={};this.score='velvet';this.scoreEpoch=0;this.chordIndex=0;this.nextChord=0;this.nextNote=0;this.running=false;this.ready=false;this.endAt=null;this.scheduler=null;this.liveSettings=null;this.testBusy=false;this.chordName='';this.textureMode='fallback';this.textureNode=null;this._pauseToken=0;}
 gain(value=0){const g=this.ctx.createGain();g.gain.value=value;return g;}
 smooth(param,value,time=.12){const t=this.ctx.currentTime;param.cancelScheduledValues(t);param.setTargetAtTime(value,t,Math.max(.015,time));}
 async init(settings){
  if(this.ctx){await this.ctx.resume();return;}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('This browser does not support Web Audio. Try a newer browser.');
  this.ctx=new AC({latencyHint:'playback'});const c=this.ctx;try{c.destination.channelCount=2;}catch(_){}
  this.input=this.gain(1);this.master=this.gain(0);this.session=this.gain(1);this.transport=this.gain(0);
  this.limiter=c.createDynamicsCompressor();this.limiter.threshold.value=-8;this.limiter.knee.value=12;this.limiter.ratio.value=10;this.limiter.attack.value=.012;this.limiter.release.value=.38;
  this.highpass=c.createBiquadFilter();this.highpass.type='highpass';this.highpass.frequency.value=25;this.highpass.Q.value=.5;
  this.input.connect(this.highpass);this.highpass.connect(this.limiter);this.limiter.connect(this.master);this.master.connect(this.session);this.session.connect(this.transport);this.transport.connect(c.destination);
  this.analyser=c.createAnalyser();this.analyser.fftSize=256;this.transport.connect(this.analyser);this.meterData=new Float32Array(256);
  this.pad=this.gain();this.melody=this.gain();this.rain=this.gain();this.ocean=this.gain();this.noise=this.gain();
  this.musicFilter=c.createBiquadFilter();this.musicFilter.type='lowpass';this.musicFilter.frequency.value=950;this.musicFilter.Q.value=.45;
  this.pad.connect(this.musicFilter);this.musicFilter.connect(this.input);this.melody.connect(this.input);
  this.musicDelay=c.createDelay?c.createDelay(1):null;this.delayWet=this.gain(.11);this.delayPan=c.createStereoPanner?c.createStereoPanner():null;this.filterLfo=c.createOscillator();this.filterLfo.frequency.value=.023;this.filterDepth=this.gain(85);this.filterLfo.connect(this.filterDepth);this.filterDepth.connect(this.musicFilter.frequency);this.filterLfo.start();this.nodes.push(this.filterLfo);
  if(this.musicDelay){this.musicDelay.delayTime.value=.31;this.musicFilter.connect(this.musicDelay);this.melody.connect(this.musicDelay);if(this.delayPan){this.delayPan.pan.value=.22;this.musicDelay.connect(this.delayPan);this.delayPan.connect(this.delayWet);}else this.musicDelay.connect(this.delayWet);this.delayWet.connect(this.input);}
  this.reverb=c.createConvolver();this.reverb.buffer=this.impulse(4.2);this.wet=this.gain(.28);this.musicFilter.connect(this.reverb);this.melody.connect(this.reverb);this.reverb.connect(this.wet);this.wet.connect(this.input);
  this.rain.connect(this.input);this.ocean.connect(this.input);this.noise.connect(this.input);
  this.beatBus=this.gain();this.binaural=this.gain(0);this.speaker=this.gain(0);this.beatBus.connect(this.input);
  this.left=c.createOscillator();this.right=c.createOscillator();this.left.type=this.right.type='sine';
  this.merger=c.createChannelMerger(2);this.left.connect(this.merger,0,0);this.right.connect(this.merger,0,1);this.merger.connect(this.binaural);this.binaural.connect(this.beatBus);
  this.roomOsc=c.createOscillator();this.roomOsc.type='sine';this.roomMod=this.gain(.70);this.roomLfo=c.createOscillator();this.roomLfo.type='sine';this.roomDepth=this.gain(.30);this.roomLfo.connect(this.roomDepth);this.roomDepth.connect(this.roomMod.gain);this.roomOsc.connect(this.roomMod);this.roomMod.connect(this.speaker);this.speaker.connect(this.beatBus);
  [this.left,this.right,this.roomOsc,this.roomLfo].forEach(n=>{n.start();this.nodes.push(n);});
  await this.initTextures(settings);
  this.liveSettings=settings;this.score=settings.score;this.apply(settings,true);this.ready=true;
  this.scoreEpoch=c.currentTime+.07;this.nextChord=this.scoreEpoch;this.nextNote=c.currentTime+3.5;this.schedule();
  this.scheduler=setInterval(()=>{if(this.running)this.schedule();},900);await c.resume();
 }
 async initTextures(settings){
  const c=this.ctx,secure=typeof window.isSecureContext!=='boolean'||window.isSecureContext;
  if(secure&&c.audioWorklet&&typeof AudioWorkletNode==='function')try{
   const url=new URL('audio-worklet.js',document.baseURI).href;await c.audioWorklet.addModule(url);
   this.textureNode=new AudioWorkletNode(c,'undertone-textures',{numberOfOutputs:3,outputChannelCount:[2,2,2]});
   this.textureNode.connect(this.noise,0);this.textureNode.connect(this.rain,1);this.textureNode.connect(this.ocean,2);
   this.textureNode.port.postMessage({type:'settings',noiseType:settings.noiseType});this.textureNode.port.postMessage({type:'seed',seed:Date.now()});
   this.nodes.push(this.textureNode);this.textureMode='worklet';return;
  }catch(_){this.textureNode=null;}
  this.initFallbackTextures();
 }
 initFallbackTextures(){
  const c=this.ctx,make=kind=>{const seed=(Date.now()+({noise:17,rain:31,ocean:47}[kind]||kind.length*97))>>>0,p=c.createScriptProcessor(2048,0,2);p._kind=kind;p._state={rng:seededRandom(seed),brown:[0,0],pink:[{b0:0,b1:0,b2:0,b3:0,b4:0,b5:0,b6:0},{b0:0,b1:0,b2:0,b3:0,b4:0,b5:0,b6:0}],ocean:[0,0],noiseTarget:'brown',noiseWeights:{brown:1,pink:0,white:0}};p.onaudioprocess=e=>{for(let ch=0;ch<2;ch++){const d=e.outputBuffer.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=this.fallbackSample(kind,ch,p._state);}};p.connect(kind==='noise'?this.noise:kind==='rain'?this.rain:this.ocean);this.nodes.push(p);return p;};
 this.fallbackSources={noise:make('noise'),rain:make('rain'),ocean:make('ocean')};
  this.noiseSources=this.fallbackSources;
  }
 texture(type,bus){
  // Kept as a compatibility hook for integrations that used the old helper.
  // Textures are now generated by the persistent worklet/fallback buses.
  const source=this[type];if(!source||!bus||source===bus)return source||null;source.connect(bus);return source;
 }
 fallbackSample(kind,ch,state){const w=state.rng()*2-1,p=state.pink[ch];p.b0=.99886*p.b0+w*.0555179;p.b1=.99332*p.b1+w*.0750759;p.b2=.969*p.b2+w*.153852;p.b3=.8665*p.b3+w*.3104856;p.b4=.55*p.b4+w*.5329522;p.b5=-.7616*p.b5-w*.016898;const pink=(p.b0+p.b1+p.b2+p.b3+p.b4+p.b5+p.b6+w*.5362)*.11;p.b6=w*.115926;state.brown[ch]=(state.brown[ch]+.018*w)/1.018;const brown=state.brown[ch]*3.25;if(kind==='noise'){const values={white:w,pink,brown},target=state.noiseTarget;if(ch===0){for(const type of ['brown','pink','white'])state.noiseWeights[type]+=((type===target?1:0)-state.noiseWeights[type])/(this.ctx.sampleRate*.45);const weightSum=state.noiseWeights.brown+state.noiseWeights.pink+state.noiseWeights.white;for(const type of ['brown','pink','white'])state.noiseWeights[type]/=weightSum;}return(values.brown*state.noiseWeights.brown+values.pink*state.noiseWeights.pink+values.white*state.noiseWeights.white)*.19;}if(kind==='rain')return pink*.11+w*.025;if(kind==='ocean'){state.ocean[ch]+=(brown*.12-state.ocean[ch])*.0028;return state.ocean[ch]*.45;}return 0;}
 impulse(seconds){const c=this.ctx,n=Math.floor(c.sampleRate*seconds),b=c.createBuffer(2,n,c.sampleRate),r=seededRandom(918273);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let previous=0;for(let i=0;i<n;i++){previous=.56*previous+.44*(r()*2-1);d[i]=previous*Math.pow(1-i/n,3.5)*.34;}}return b;}
 noiseBuffer(type,seconds=1){const c=this.ctx,n=Math.floor(c.sampleRate*seconds),b=c.createBuffer(2,n,c.sampleRate),r=seededRandom(0x91a2b3c4),state={brown:[0,0],pink:[{b0:0,b1:0,b2:0,b3:0,b4:0,b5:0,b6:0},{b0:0,b1:0,b2:0,b3:0,b4:0,b5:0,b6:0}]};for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<n;i++){const w=r()*2-1,p=state.pink[ch];p.b0=.99886*p.b0+w*.0555179;p.b1=.99332*p.b1+w*.0750759;p.b2=.969*p.b2+w*.153852;p.b3=.8665*p.b3+w*.3104856;p.b4=.55*p.b4+w*.5329522;p.b5=-.7616*p.b5-w*.016898;const pink=(p.b0+p.b1+p.b2+p.b3+p.b4+p.b5+p.b6+w*.5362)*.11;p.b6=w*.115926;state.brown[ch]=(state.brown[ch]+.018*w)/1.018;d[i]=(type==='white'?w:type==='pink'?pink:state.brown[ch]*3.25)*.19;}}return b;}
 apply(s,initial=false){if(!this.ctx)return;const set=(p,v,t=.12)=>initial?p.setValueAtTime(v,this.ctx.currentTime):this.smooth(p,v,t);this.liveSettings=s;
  set(this.master.gain,Math.pow(s.master/100,1.5)*.75);set(this.pad.gain,s.musicSource==='library'?0:s.pad/100*.85);set(this.melody.gain,s.musicSource==='library'?0:s.melody/100*.44);set(this.rain.gain,s.rain/100*.28);set(this.ocean.gain,s.ocean/100*.38);set(this.noise.gain,s.noise/100*.30);
  set(this.beatBus.gain,s.beats?s.beatVolume/100*.07:0);set(this.left.frequency,s.carrier-s.hz/2,.14);set(this.right.frequency,s.carrier+s.hz/2,.14);set(this.roomOsc.frequency,s.carrier,.14);set(this.roomLfo.frequency,s.hz,.14);set(this.binaural.gain,s.route==='headphones'?1:0);set(this.speaker.gain,s.route==='speakers'?1:0);
  if(this.textureNode)this.textureNode.port.postMessage({type:'settings',noiseType:s.noiseType});
  if(this.fallbackSources)for(const source of Object.values(this.fallbackSources)){const state=source._state;if(state.noiseTarget!==s.noiseType)state.noiseTarget=s.noiseType;}
  set(this.musicFilter.frequency,UT_SCORES[s.score].cutoff,1);
  if(this.score!==s.score){this.score=s.score;this.chordIndex=0;this.scoreEpoch=this.ctx.currentTime+.08;this.retireVoices();this.nextChord=this.scoreEpoch;this.nextNote=this.ctx.currentTime+3;}
 }
 retireVoices(){const t=this.ctx.currentTime;for(const v of this.voices){try{v.env.gain.cancelScheduledValues(t);v.env.gain.setTargetAtTime(0,t,.8);v.oscs.forEach(o=>o.stop(t+3));}catch(_){}}this.voices=[];}
 voice(midi,start,duration,peak,type='sine',bus=this.pad,detune=0){const c=this.ctx,frequency=440*Math.pow(2,(midi-69)/12),env=this.gain(),filter=c.createBiquadFilter(),pan=c.createStereoPanner?c.createStereoPanner():null,oscs=[],partials=[];filter.type='lowpass';filter.frequency.setValueAtTime(clamp(1100+frequency*2.6,900,4700),start);filter.Q.value=.45;if(pan)pan.pan.value=clamp(detune/18,-.9,.9);const attack=Math.min(4.8,duration*.24);env.gain.setValueAtTime(0,start);env.gain.linearRampToValueAtTime(peak,start+attack);env.gain.setValueAtTime(peak*.74,start+duration*.58);env.gain.setTargetAtTime(.0001,start+duration*.78,Math.max(.16,duration*.08));for(const [kind,mult,level,offset] of [['triangle',1,.72,-7],['sine',2,.22,7],['sine',.5,.18,0]]){const o=c.createOscillator(),partial=this.gain(level);o.type=kind;o.frequency.value=frequency*mult;o.detune.value=detune+offset;o.connect(partial);partial.connect(env);o.start(start);o.stop(start+duration+2.8);oscs.push(o);partials.push(partial);}if(pan){env.connect(filter);filter.connect(pan);pan.connect(bus);}else{env.connect(filter);filter.connect(bus);}const v={kind:'pad',oscs,partials,env,end:start+duration};this.voices.push(v);oscs[0].onended=()=>{try{filter.disconnect();if(pan)pan.disconnect();partials.forEach(node=>node.disconnect());env.disconnect();}catch(_){}const i=this.voices.indexOf(v);if(i!==-1)this.voices.splice(i,1);};}
 bell(midi,start){const c=this.ctx,frequency=440*Math.pow(2,(midi-69)/12),env=this.gain(),pan=c.createStereoPanner?c.createStereoPanner():null,oscs=[],partials=[];env.gain.setValueAtTime(.0001,start);env.gain.exponentialRampToValueAtTime(.11,start+.025);env.gain.exponentialRampToValueAtTime(.0001,start+5.8);for(const [mult,level] of [[1,.8],[2.01,.24],[3.98,.08]]){const o=c.createOscillator(),partial=this.gain(level);o.type='sine';o.frequency.value=frequency*mult;o.detune.value=(Math.random()-.5)*7;o.connect(partial);partial.connect(env);o.start(start);o.stop(start+6.2);oscs.push(o);partials.push(partial);}if(pan){pan.pan.setValueAtTime((Math.random()-.5)*.55,start);env.connect(pan);pan.connect(this.melody);}else env.connect(this.melody);const v={kind:'bell',oscs,partials,env,end:start+6};this.voices.push(v);oscs[0].onended=()=>{try{env.disconnect();if(pan)pan.disconnect();partials.forEach(node=>node.disconnect());}catch(_){}const i=this.voices.indexOf(v);if(i!==-1)this.voices.splice(i,1);};}
 schedule(){const now=this.ctx.currentTime,score=UT_SCORES[this.score];if(this.nextChord<now-1){this.chordIndex=0;this.scoreEpoch=now+.05;this.nextChord=this.scoreEpoch;}if(this.nextNote<now-1)this.nextNote=now+1;/* Keep two minutes of render-ahead so timer clamping cannot immediately expose a musical gap. */while(this.nextChord<now+120){const notes=score.chords[this.chordIndex%score.chords.length];notes.forEach((n,i)=>{this.voice(n,this.nextChord,score.seconds+5,.052/(1+i*.06),'triangle',this.pad,-9+i*4);this.voice(n+12,this.nextChord+.07,score.seconds+5,.015,'sine',this.pad,8-i*3);});this.chordName=['Dusk','Space','Stillness','Return'][this.chordIndex%4];this.nextChord+=score.seconds;this.chordIndex++;}while(this.nextNote<now+90){const chord=score.chords[Math.floor(Math.max(0,this.nextNote-this.scoreEpoch)/score.seconds)%score.chords.length];const chordTones=score.notes.filter(note=>chord.some(root=>((note-root)%12+12)%12===0));const pool=chordTones.length?chordTones:score.notes;const n=pool[Math.floor(Math.random()*pool.length)];this.bell(n,this.nextNote);this.nextNote+=5+Math.random()*7;}}
 async play(s){this._pauseToken++;await this.init(s);await this.ctx.resume();this.running=true;this.apply(s);this.schedule();this.smooth(this.transport.gain,1,.5);}
 async pause(){if(!this.ctx)return;this.running=false;const token=++this._pauseToken,t=this.ctx.currentTime,param=this.transport.gain;param.cancelScheduledValues(t);param.setValueAtTime(param.value,t);param.linearRampToValueAtTime(0,t+.22);await new Promise(r=>setTimeout(r,280));if(token!==this._pauseToken)return;param.setValueAtTime(0,this.ctx.currentTime);await this.ctx.suspend();}
 async stop(){if(!this.ctx)return;await this.pause();this.clearTimer();this.retireVoices();this.chordIndex=0;this.scoreEpoch=this.ctx.currentTime+.08;this.nextChord=this.scoreEpoch;this.nextNote=this.ctx.currentTime+3;}
 armTimer(seconds){if(!this.ctx)return;const t=this.ctx.currentTime,p=this.session.gain;p.cancelScheduledValues(t);p.setValueAtTime(1,t);if(seconds>0){this.endAt=t+seconds;const fade=Math.min(12,seconds*.4);p.setValueAtTime(1,this.endAt-fade);p.linearRampToValueAtTime(0,this.endAt);}else this.endAt=null;}
 clearTimer(){if(!this.ctx)return;this.endAt=null;const p=this.session.gain,t=this.ctx.currentTime;p.cancelScheduledValues(t);p.setValueAtTime(1,t);}
 remaining(){return this.endAt===null?null:Math.max(0,this.endAt-this.ctx.currentTime);}
 level(){if(!this.analyser||!this.running)return 0;this.analyser.getFloatTimeDomainData(this.meterData);let sum=0;for(const x of this.meterData)sum+=x*x;return Math.sqrt(sum/this.meterData.length);}
 async testChannel(side){if(this.testBusy)return;this.testBusy=true;const wasRunning=this.running;try{await this.init(this.liveSettings||{score:'velvet',noiseType:'brown'});await this.ctx.resume();const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=this.gain(),m=c.createChannelMerger(2);o.frequency.value=330;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.025,t+.05);g.gain.setValueAtTime(.025,t+.6);g.gain.exponentialRampToValueAtTime(.0001,t+.8);o.connect(g);g.connect(m,0,side==='left'?0:1);m.connect(c.destination);o.start(t);o.stop(t+.85);await new Promise(r=>setTimeout(r,950));try{o.disconnect();g.disconnect();m.disconnect();}catch(_){}if(!wasRunning)await c.suspend();}finally{this.testBusy=false;}}
 async destroy(){clearInterval(this.scheduler);this.scheduler=null;for(const n of this.nodes){try{n.disconnect();}catch(_){} }if(this.ctx)await this.ctx.close();this.ctx=null;this.ready=false;}
}
if(typeof window!=='undefined')window.UndertoneAudio=UndertoneAudio;
if(typeof module!=='undefined'&&module.exports)module.exports={UndertoneAudio,UT_SCORES};
