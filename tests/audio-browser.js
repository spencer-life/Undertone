'use strict';
const result=document.getElementById('results');
const settings={preset:'focus',route:'headphones',hz:40,carrier:340,beats:true,beatVolume:14,master:35,pad:76,melody:20,rain:0,ocean:0,noise:8,noiseType:'pink',score:'horizon'};
const assert=(value,message)=>{if(!value)throw new Error(message);};
const stats=(data,start=0,end=data.length)=>{let square=0,peak=0;for(let i=start;i<end;i++){assert(Number.isFinite(data[i]),'Nonfinite output');square+=data[i]*data[i];peak=Math.max(peak,Math.abs(data[i]));}return {rms:Math.sqrt(square/(end-start)),peak};};
const at=(data,frequency,rate)=>{let re=0,im=0;for(let i=rate;i<rate*2;i++){const t=2*Math.PI*frequency*i/rate;re+=data[i]*Math.cos(t);im+=data[i]*Math.sin(t);}return Math.hypot(re,im)*2/rate;};
async function render(patch,duration=32,track=null){
 const Native=window.AudioContext,ctx=new OfflineAudioContext(2,48000*duration,48000);
 // The production engine creates its context internally. Substitute only the
 // output device for a real OfflineAudioContext; keep every production node.
 ctx.resume=()=>Promise.resolve();window.AudioContext=function(){return ctx;};
 const engine=new UndertoneAudio();let player=null;
 try{await engine.init({...settings,musicSource:track?'library':'generated',...patch});clearInterval(engine.scheduler);if(track){player=new UndertoneTrackPlayer(ctx,engine.limiter);player.setVolume(patch.music??70);await player.load(track);await player.play();}engine.running=true;engine.transport.gain.cancelScheduledValues(0);engine.transport.gain.setValueAtTime(1,0);const mode=engine.textureMode;const buffer=await ctx.startRendering();return {buffer,mode};}
 finally{window.AudioContext=Native;if(player)await player.destroy();clearInterval(engine.scheduler);engine.nodes.forEach(n=>{try{n.disconnect();}catch{}});}
}
document.getElementById('run').onclick=async()=>{
 const button=document.getElementById('run');button.disabled=true;result.textContent='Rendering…';const lines=[];
 const log=line=>{lines.push(line);result.textContent=lines.join('\n');};
 try{
  for(const [label,patch] of [['Focus defaults',{}],['All layers at maximum',{master:100,pad:100,melody:100,rain:100,ocean:100,noise:100,beatVolume:100}]]){
   const {buffer,mode}=await render(patch);assert(mode==='worklet','Expected AudioWorklet, got '+mode);
   const left=buffer.getChannelData(0),right=buffer.getChannelData(1),s=stats(left,48000*6);
   assert(s.peak<.95,label+' clips');assert(s.rms>.0005,label+' is inaudible');
   let min=Infinity,max=0;for(let sec=6;sec<31;sec++){const rms=stats(left,sec*48000,(sec+1)*48000).rms;min=Math.min(min,rms);max=Math.max(max,rms);}
   assert(min>max*.06,label+' has a near-silent sustained gap');
   assert(left.some((v,i)=>Math.abs(v-right[i])>1e-5),label+' collapsed to mono');
   log(`PASS ${label}: peak ${s.peak.toFixed(5)}, RMS ${s.rms.toFixed(5)}, quietest/loudest second ${(min/max).toFixed(3)}, ${mode}`);
  }
  const oceanOnly=await render({master:100,pad:0,melody:0,rain:0,ocean:100,noise:0,beats:false,beatVolume:0},20);
  const oceanStats=stats(oceanOnly.buffer.getChannelData(0),48000*3);
  assert(oceanStats.rms>.005,'Ocean is too quiet after output filtering');
  log(`PASS isolated ocean through full output: peak ${oceanStats.peak.toFixed(5)}, RMS ${oceanStats.rms.toFixed(5)}`);
  const quiet={master:100,pad:0,melody:0,rain:0,ocean:0,noise:0,beatVolume:100};
  const {buffer}=await render(quiet,3),left=buffer.getChannelData(0),right=buffer.getChannelData(1);
  const leftCarrier=at(left,320,48000),leftLeak=at(left,360,48000),rightCarrier=at(right,360,48000),rightLeak=at(right,320,48000);
  assert(leftCarrier>leftLeak*100&&rightCarrier>rightLeak*100,'Binaural carriers are not separated by at least 40 dB');
  log(`PASS 40 Hz headphone separation: L320/R360 Hz; leakage ${Math.max(leftLeak/leftCarrier,rightLeak/rightCarrier).toExponential(2)}`);
  const speaker=await render({...quiet,route:'speakers'},3),sl=speaker.buffer.getChannelData(0),sr=speaker.buffer.getChannelData(1);
  assert(sl.every((v,i)=>Math.abs(v-sr[i])<1e-7),'Speaker signal should be mono');
  assert(at(sl,340,48000)>.01&&at(sl,300,48000)>.001&&at(sl,380,48000)>.001,'Speaker AM carrier or sidebands absent');
  log('PASS speaker mode: identical channels, 340 Hz carrier and ±40 Hz modulation sidebands');
  for(const track of Object.values(UT_TRACKS)){
   const {buffer,mode}=await render({master:100,music:100,beatVolume:100,rain:100,ocean:100,noise:100},40,track);
   const left=buffer.getChannelData(0),right=buffer.getChannelData(1),s=stats(left,48000*5);
   assert(s.peak<.98,track.title+' full mix clips');assert(s.rms>.005,track.title+' music is unexpectedly quiet');
   assert(left.some((v,i)=>Math.abs(v-right[i])>1e-4),track.title+' lost stereo');
   log(`PASS ${track.title} FLAC + maximum live layers: peak ${s.peak.toFixed(5)}, RMS ${s.rms.toFixed(5)}, stereo, ${mode}`);
  }
  log('ALL CHECKS PASSED. These are signal tests, not a subjective listening assessment.');
 }catch(error){log('FAIL '+error.stack);}finally{button.disabled=false;}
};
