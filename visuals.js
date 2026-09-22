/* Slow generative scenes, not neurological measurements or flashing stimulation.
   DPR / frame rate are capped for TVs; OS reduced-motion gets a still composition. */
const UT_THEMES={
 noir:{name:'Noir',bg:'#080809',bg2:'#0e0e10',surface:'#131316',raised:'#202023',text:'#f4f4f5',secondary:'#c7c7cc',muted:'#95959e',line:'#343438',accent:'#ebebee',strong:'#ffffff',ink:'#111114',art:['#09090c','#222228','#52525c','#909099','#d9d9df']},
 slate:{name:'Midnight slate',bg:'#0b1119',bg2:'#101925',surface:'#152030',raised:'#1e2d3e',text:'#f0f4fa',secondary:'#bbcbdc',muted:'#91a5bb',line:'#34475e',accent:'#abc7e8',strong:'#d0e4fa',ink:'#121e2c',art:['#0c131f','#202f47','#456082','#7794b6','#c0d6ee']},
 frost:{name:'Frost',bg:'#101617',bg2:'#151e20',surface:'#1b282b',raised:'#243438',text:'#f1f8f7',secondary:'#bfd2d2',muted:'#91aaad',line:'#354e53',accent:'#c2e3df',strong:'#e3f5f3',ink:'#152729',art:['#0f191c','#243b41','#4d7379','#8bb5b6','#d1e9e5']},
 rose:{name:'Rose Dark',bg:'#131315',bg2:'#141416',surface:'#1c1c1f',raised:'#232326',text:'#faf8f5',secondary:'#dac0c9',muted:'#a28a93',line:'#42383e',accent:'#ffafd3',strong:'#f472b6',ink:'#23171e',art:['#141416','#30232b','#765365','#b97d96','#efb4cc']},
 ocean:{contourAccents:['#32cedc','#477cfa','#9974ef'],name:'Deep ocean',bg:'#11161b',bg2:'#121a20',surface:'#19242c',raised:'#22313a',text:'#f3f7f8',secondary:'#b9d0df',muted:'#92aab9',line:'#384c5b',accent:'#a6d6f2',strong:'#73b9e3',ink:'#152631',art:['#11191f','#233e4c','#406b81','#7aa4b7','#b7dce8']},
 moss:{name:'Moss',bg:'#141815',bg2:'#151c17',surface:'#1e2821',raised:'#28342b',text:'#f4f6ee',secondary:'#c5d2bd',muted:'#a1b09b',line:'#414e3d',accent:'#bdddab',strong:'#94c37d',ink:'#1e2a18',art:['#141b17','#2c3d32','#51654a','#859774','#c6d8b0']},
 ember:{name:'Ember',bg:'#191513',bg2:'#201915',surface:'#2a211b',raised:'#35291f',text:'#fff5ea',secondary:'#dfc9b1',muted:'#b59d83',line:'#524233',accent:'#f4c194',strong:'#eba76e',ink:'#2c1d13',art:['#1d1713','#493226','#7e5139','#b27a51','#e6b887']},
 violet:{name:'Night violet',bg:'#17141c',bg2:'#1c1723',surface:'#251e2e',raised:'#30273b',text:'#f7f1fb',secondary:'#d3c2e4',muted:'#ad98bd',line:'#4a3c59',accent:'#d5b4ed',strong:'#ba91db',ink:'#271c32',art:['#19151f','#372b46','#62507c','#9982b2','#d8bde9']},
 mono:{name:'Graphite',bg:'#151516',bg2:'#19191a',surface:'#222224',raised:'#2d2d30',text:'#f7f5f0',secondary:'#d2d0ca',muted:'#a9a6a0',line:'#47474c',accent:'#e4dfd5',strong:'#c3bdb0',ink:'#232220',art:['#171719','#303033','#57565b','#939096','#d6d0d5']}
};
// Original Canvas rendering, informed by the Figma scene board and React Bits'
// layered motion / restrained lighting. No framework or graphics dependencies.
class UndertoneVisuals {
 constructor(canvas,getSettings,getAudio) {
  this.canvas=canvas; this.g=canvas.getContext('2d',{alpha:false});
  this.settings=getSettings; this.audio=getAudio; this.time=0; this.last=0;
  this.audioState={energy:0,bass:0,mid:0,high:0,pulse:0};
  this.audioBaseline=0;
  this.canvasFrame={time:0,viewport:{width:0,height:0,dpr:1},seed:604,palette:null,motion:0,brightness:1,reducedMotion:false,audio:this.audioState};
  this.lastPaint=0; this.energy=0; this.dirty=true; this.activeScene=null;
  this.orbitGPU=typeof UndertoneOrbitBridge==='function'?new UndertoneOrbitBridge(canvas,()=>{this.dirty=true;}):null;
  // BFCache releases the GPU device; a restored page lazily acquires a new one.
  window.addEventListener('pagehide',()=>{this.orbitGPU?.dispose();});
  window.addEventListener('pageshow',()=>{if(this.orbitGPU?.disposed){this.orbitGPU=new UndertoneOrbitBridge(canvas,()=>{this.dirty=true;});this.dirty=true;}});
  this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  this.reduced.addEventListener?.('change',()=>{this.dirty=true;});
  this.resize=()=>{
   const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5);
   this.width=r.width;this.height=r.height;
   canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));
   this.g?.setTransform(dpr,0,0,dpr,0,0);this.dirty=true;this.glassKey='';
  };
  window.addEventListener('resize',this.resize);
  if(window.ResizeObserver){this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);}
  this.resize();this.reseed(604);this.frame=this.frame.bind(this);requestAnimationFrame(this.frame);
 }
 reseed(seed){
  this.seed=seed;let k=seed>>>0;
  const random=()=>{k=(1664525*k+1013904223)>>>0;return k/4294967296;};
  this.drops=Array.from({length:210},()=>({x:random(),y:random(),r:1.4+Math.pow(random(),2)*6.8,phase:random()*6.28,speed:.015+random()*.03,moving:random()<.16}));
  this.mist=Array.from({length:650},()=>({x:random(),y:random(),r:.35+random()*1.1,alpha:.12+random()*.3}));
  this.farRain=Array.from({length:65},()=>({x:random(),y:random(),speed:.09+random()*.15,len:.018+random()*.05}));
  this.lights=Array.from({length:27},()=>({x:random(),y:.2+random()*.67,r:.012+random()*.032,alpha:.2+random()*.65,warm:random()>.55}));
  this.offset=seed*.0037;this.glassKey='';this.dirty=true;
 }
 hex(h){return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));}
 rgba(h,a){return `rgba(${this.hex(h).join(',')},${a})`;}
 blend(a,b,f){const x=this.hex(a),y=this.hex(b);return `rgb(${x.map((v,i)=>Math.round(v+(y[i]-v)*f)).join(',')})`;}
 color(p,x){const n=Math.max(0,Math.min(.999,x))*(p.length-1),i=Math.floor(n);return this.blend(p[i],p[i+1],n-i);}
 updateAudio(raw,dt){
  const clip=value=>Math.max(0,Math.min(1,Number(value)||0));
  const source=typeof raw==='number'?{energy:raw,bass:raw,mid:raw*.75,high:raw*.45}:(raw||{});
  const target={energy:clip(source.energy),bass:clip(source.bass),mid:clip(source.mid),high:clip(source.high)};
  const step=Math.max(0,Math.min(Number(dt)||0,.1));
  const follow=(current,next,attack,release)=>{
   if(step<=0)return current;
   const tau=next>current?attack:release;
   return current+(next-current)*(1-Math.exp(-step/tau));
  };
  const state=this.audioState;
  state.energy=follow(state.energy,target.energy,.055,.34);
  state.bass=follow(state.bass,target.bass,.045,.30);
  state.mid=follow(state.mid,target.mid,.060,.32);
  state.high=follow(state.high,target.high,.035,.24);
  const onset=state.bass*.50+state.mid*.35+state.high*.15;
  const positive=Math.max(0,onset-this.audioBaseline);
  if(step>0)this.audioBaseline+=(onset-this.audioBaseline)*(1-Math.exp(-step/.48));
  const pulseTarget=clip(positive*4.6+Math.max(0,onset-.60)*.18);
  state.pulse=follow(state.pulse,pulseTarget,.030,.24);
  return state;
 }
 motionRate(s,audio=this.audioState){
  const m=Math.max(0,Math.min(1,(Number(s.motion)||0)/100));
  if(m<=0)return 0;
  // Motion 40 is a useful everyday pace; 100 is intentionally much faster
  // than the old 1.08x ceiling. Music adds a restrained temporary lift.
  const base=.12+2.88*Math.pow(m,1.20);
  const reactive=1+audio.energy*.10+audio.bass*.12+audio.pulse*.24;
  return Math.min(4,base*reactive);
 }
 frame(ms){
  requestAnimationFrame(this.frame);const s=this.settings(),dt=this.last?Math.min((ms-this.last)/1000,.1):0;this.last=ms;
  if(s.scene!=='orbit')this.orbitGPU?.prepare(s.scene);
  if(document.hidden||s.blackout)return;
  this.orbitGPU?.prepare(s.scene);
  const audio=this.updateAudio(this.audio(),dt);
  const still=s.motion===0||this.reduced.matches;
  if(!still)this.time+=dt*this.motionRate(s,audio);
  if(!this.dirty&&(still||ms-this.lastPaint<1000/(s.eco?20:30)))return;
  const paintDt=this.lastPaint?Math.min((ms-this.lastPaint)/1000,.2):0;this.lastPaint=ms;
  if(s.scene!==this.activeScene){this.previousScene=this.activeScene;this.activeScene=s.scene;this.transition=still?1:0;}
  this.transition=Math.min(1,(this.transition||0)+paintDt/.9);
  this.energy=Math.max(0,Math.min(1,audio.energy*.70+audio.bass*.18+audio.pulse*.32));
  this.render(s);this.dirty=false;
 }
 render(s){
  const g=this.g,w=this.width,h=this.height;if(!g||!w||!h)return;
  if(s.scene==='orbit'&&this.transition>=1&&this.orbitGPU?.draw({width:w,height:h,dpr:Math.min(window.devicePixelRatio||1,1.5),time:this.time,seed:this.seed,theme:s.theme,brightness:s.brightness,eco:s.eco,energy:this.energy}))return;
  this.orbitGPU?.hide();
  const contract=this.canvasContract(s),p=contract.palette.art,t=contract.time;g.globalAlpha=1;g.fillStyle=p[0];g.fillRect(0,0,w,h);
  if(this.previousScene&&this.transition<1){this.renderScene(this.previousScene,g,w,h,t,p,1-this.transition);this.renderScene(this.activeScene,g,w,h,t,p,this.transition);}
  else{this.renderScene(this.activeScene,g,w,h,t,p,1);this.previousScene=null;}
  // Dark corners keep controls legible, without masking the central art.
  const vignetteKey=[w,h,contract.viewport.dpr].join(':');
  if(this.vignetteKey!==vignetteKey){this.vignette=g.createRadialGradient(w*.5,h*.42,h*.12,w*.5,h*.45,Math.max(w*.62,h*.74));this.vignette.addColorStop(0,'#0000');this.vignette.addColorStop(1,'#0009');this.vignetteKey=vignetteKey;}
  g.fillStyle=this.vignette;g.fillRect(0,0,w,h);
  g.globalAlpha=1-s.brightness/100;g.fillStyle=p[0];g.fillRect(0,0,w,h);g.globalAlpha=1;
 }
 canvasContract(s){
  const c=this.canvasFrame;c.time=this.time+this.offset;c.viewport.width=this.width;c.viewport.height=this.height;c.viewport.dpr=Math.min(window.devicePixelRatio||1,1.5);c.seed=this.seed;c.palette=UT_THEMES[s.theme];c.motion=s.motion/100;c.brightness=s.brightness/100;c.reducedMotion=this.reduced.matches;c.audio=this.audioState;return c;
 }
 renderScene(scene,g,w,h,t,p,a){g.save();g.globalAlpha=a;if(scene==='rain')this.wetGlass(g,w,h,t,p,a);else if(scene==='dunes')this.silk(g,w,h,t,p,a);else if(scene==='orbit')this.orbit(g,w,h,t,p,a);else this.contours(g,w,h,t,p,a);g.restore();}
 glow(g,x,y,r,color,opacity){const v=g.createRadialGradient(x,y,0,x,y,r);v.addColorStop(0,this.rgba(color,opacity));v.addColorStop(.45,this.rgba(color,opacity*.4));v.addColorStop(1,this.rgba(color,0));g.fillStyle=v;g.fillRect(x-r,y-r,r*2,r*2);}
 contours(g,w,h,t,p,a){
  const c=this.canvasFrame,theme=c.palette||UT_THEMES.ocean,audio=c.audio||this.audioState;
  const count=w<650?64:88,segments=160;
  const key=[w,h,c.viewport.dpr,this.seed,theme.name].join(':');
  let cache=this.contourCache;
  if(!cache||cache.key!==key){
   // Allocate only on viewport/theme/seed changes. No Path2D or gradient churn.
   const glow=cache?.glow||document.createElement('canvas');
   glow.width=Math.max(1,Math.ceil(w*.5));glow.height=Math.max(1,Math.ceil(h*.5));
   const light=glow.getContext('2d');light.setTransform(.5,0,0,.5,0,0);
   let k=this.seed>>>0;const random=()=>{k=(1664525*k+1013904223)>>>0;return k/4294967296;};
   const phase=Array.from({length:6},()=>random()*Math.PI*2);
   const accents=theme.contourAccents||[p[3],p[2],p[4]];
   const makeGradients=context=>accents.map((color,j)=>{
    const x=w*(.20+j*.29),y=h*(j===1?.30:.57);
    const gradient=context.createRadialGradient(x,y,0,x,y,Math.min(w,h)*.36);
    gradient.addColorStop(0,color);gradient.addColorStop(.30,this.rgba(color,.86));gradient.addColorStop(.72,this.rgba(color,.24));gradient.addColorStop(1,this.rgba(color,0));return gradient;
   });
   const gradients=makeGradients(g),glowGradients=makeGradients(light);
   const cos=new Float32Array(segments+1),sin=new Float32Array(segments+1);
   for(let i=0;i<=segments;i++){cos[i]=Math.cos(i/segments*Math.PI*2);sin[i]=Math.sin(i/segments*Math.PI*2);}
   cache=this.contourCache={key,glow,light,phase,gradients,glowGradients,accents,cos,sin,points:new Float32Array(count*(segments+1)*2),colors:Array.from({length:count},(_,j)=>this.color(p,.29+.24*(1-j/count))),dark:this.blend(p[0],'#000000',.77)};
  }
  const {points,phase,cos,sin,light,glow,gradients}=cache;
  const rx=w*.48,ry=h*.43,cx=w*.50,cy=h*.46;
  // Shared smooth elevation field: broad saddles and drifting asymmetric lobes.
  // Irrationally related slow periods avoid a single repeating rotation.
  const drift=Math.sin(t*.23+phase[0]),breath=Math.sin(t*.317+phase[1]);
  const bassShape=1+audio.bass*.28+audio.pulse*.16,midShape=1+audio.mid*.18,highShape=1+audio.high*.18;
  for(let j=0;j<count;j++){
   const d=j/(count-1),r=.12+d*1.20,base=j*(segments+1)*2;
   for(let i=0;i<=segments;i++){
    const q=i/segments*Math.PI*2;
    const fold=1+.19*bassShape*Math.sin(q*3+phase[2]+d*1.8+drift*.65)+.10*midShape*Math.cos(q*2-phase[3]+d*2.5)+.035*highShape*Math.sin(q*5+phase[4]+breath*.65);
    const x=cos[i]*r*fold,y=sin[i]*r;
    points[base+i*2]=cx+rx*(x+.17*(1+audio.bass*.10)*Math.sin(y*2.8+phase[5]+drift*.55)+.06*Math.sin(d*4+phase[0]));
    points[base+i*2+1]=cy+ry*(y*(.82+.14*Math.cos(q*2+d*2+phase[1]))+.17*(1+audio.mid*.10)*Math.sin(x*2.7+phase[3]+breath*.48));
   }
  }
  g.globalAlpha=a;g.fillStyle=cache.dark;g.fillRect(0,0,w,h);
  light.clearRect(0,0,w,h);light.lineJoin='round';light.lineCap='round';
  // Only six elevation lines contribute glow, spatially masked by cached gradients.
  for(let n=0;n<6;n++){
   const j=Math.round(count*(.18+n*.105)),base=j*(segments+1)*2;
   light.beginPath();for(let i=0;i<=segments;i++){const x=points[base+i*2],y=points[base+i*2+1];i?light.lineTo(x,y):light.moveTo(x,y);}light.closePath();
   light.strokeStyle=cache.glowGradients[n%3];light.lineWidth=3;light.shadowColor=cache.accents[n%3];light.shadowBlur=9;light.globalAlpha=Math.min(1,.55+audio.mid*.08+audio.pulse*.10);light.stroke();
  }
  light.shadowBlur=0;g.globalAlpha=a*.8;g.drawImage(glow,0,0,w,h);
  g.lineJoin='round';g.lineCap='round';
  for(let j=count-1;j>=0;j--){
   const d=j/(count-1),base=j*(segments+1)*2;
   g.beginPath();for(let i=0;i<=segments;i++){const x=points[base+i*2],y=points[base+i*2+1];i?g.lineTo(x,y):g.moveTo(x,y);}g.closePath();
   const depth=.5+.5*Math.sin(d*8+phase[2]);
   g.strokeStyle=cache.colors[j];g.globalAlpha=a*(.18+depth*.20)*(1-Math.pow(d,5)*.65);g.lineWidth=.55+depth*.40;g.stroke();
   for(let n=0;n<6;n++)if(j===Math.round(count*(.18+n*.105))){g.strokeStyle=gradients[n%3];g.globalAlpha=a*Math.min(1,.78+.12*Math.sin(t*.09+n)+audio.mid*.08+audio.pulse*.08);g.lineWidth=1.25+depth*.4+audio.high*.12;g.stroke();}
  }
  g.globalAlpha=a;
 }
 silk(g,w,h,t,p,a){
  // Silk is built from a small number of broad translucent sheets and a
  // quieter set of supporting strands. Geometry and all color/gradient work is
  // cached by viewport, theme, and seed; only the typed point buffers move.
  const c=this.canvasFrame,theme=c.palette||UT_THEMES.ocean,audio=c.audio||this.audioState;
  const narrow=w<650,layers=narrow?7:9,samples=narrow?52:76,supports=narrow?18:28;
  const key=[Math.round(w),Math.round(h),c.viewport.dpr,this.seed,theme.name].join(':');
  let cache=this.silkCache;
  if(!cache||cache.key!==key){
   const glow=cache?.glow||document.createElement('canvas');
   glow.width=Math.max(1,Math.ceil(w*.5));glow.height=Math.max(1,Math.ceil(h*.5));
   const light=glow.getContext('2d');light.setTransform(.5,0,0,.5,0,0);
   let k=this.seed>>>0;const random=()=>{k=(1664525*k+1013904223)>>>0;return k/4294967296;};
   const baseY=new Float32Array(layers),tilt=new Float32Array(layers),amp=new Float32Array(layers);
   const amp2=new Float32Array(layers),freq=new Float32Array(layers),phase=new Float32Array(layers);
   const speed=new Float32Array(layers),widths=new Float32Array(layers),opacity=new Float32Array(layers);
   const colors=[],gradients=[];
   const rgbaColor=(color,alpha)=>color[0]==='r'?color.replace('rgb(','rgba(').replace(')',','+alpha+')'):this.rgba(color,alpha);
   for(let j=0;j<layers;j++){
    const d=j/(layers-1);
    baseY[j]=.10+d*.78+(random()-.5)*.035;
    tilt[j]=(random()-.5)*.12;
    amp[j]=.040+random()*.055;
    amp2[j]=.012+random()*.025;
    freq[j]=1.45+random()*1.15;
    phase[j]=random()*Math.PI*2;
    // Visible fold travel at the default motion setting, not minute-long drift.
    speed[j]=.16+random()*.16;
    widths[j]=.040+random()*.055*(j===1||j===layers-2?1.25:.8);
    opacity[j]=.54+random()*.26;
    const shade=.22+d*.26+(random()-.5)*.04;
    const color=this.color(p,shade);colors[j]=color;
    const gradient=g.createLinearGradient(0,h*(baseY[j]-.17),0,h*(baseY[j]+.17));
    gradient.addColorStop(0,rgbaColor(this.color(p,Math.max(.12,shade-.16)),0));
    gradient.addColorStop(.22,rgbaColor(this.color(p,Math.max(.16,shade-.04)),.20));
    gradient.addColorStop(.50,rgbaColor(this.color(p,Math.min(.98,shade+.18)),.34));
    gradient.addColorStop(.72,rgbaColor(this.color(p,Math.min(.98,shade+.06)),.16));
    gradient.addColorStop(1,rgbaColor(this.color(p,Math.max(.12,shade-.14)),0));
    gradients[j]=gradient;
   }
   const supportY=new Float32Array(supports),supportTilt=new Float32Array(supports);
   const supportAmp=new Float32Array(supports),supportFreq=new Float32Array(supports);
   const supportPhase=new Float32Array(supports),supportSpeed=new Float32Array(supports);
   const supportWidth=new Float32Array(supports),supportOpacity=new Float32Array(supports),supportColors=[];
   for(let j=0;j<supports;j++){
    const parent=Math.floor(j*layers/supports),d=j/(supports-1);
    supportY[j]=baseY[parent]+(random()-.5)*widths[parent]*2.2;
    supportTilt[j]=tilt[parent]+(random()-.5)*.035;
    supportAmp[j]=amp[parent]*(.48+random()*.36);
    supportFreq[j]=freq[parent]*(.86+random()*.32);
    supportPhase[j]=phase[parent]+(random()-.5)*1.4;
    supportSpeed[j]=speed[parent]*(.82+random()*.42);
    supportWidth[j]=.45+random()*.72;
    supportOpacity[j]=.18+random()*.26;
    supportColors[j]=this.color(p,.27+d*.46+(random()-.5)*.06);
   }
   const glowGradients=[];
   const glowStops=[p[2],p[3],p[4]];
   for(let j=0;j<3;j++){
    const x=w*(.23+j*.27),y=h*(.30+(j%2)*.28),r=Math.min(w,h)*(.38+.08*(j%2));
    const gradient=light.createRadialGradient(x,y,0,x,y,r);
    gradient.addColorStop(0,this.rgba(glowStops[j],.16));gradient.addColorStop(.36,this.rgba(glowStops[j],.075));gradient.addColorStop(1,this.rgba(glowStops[j],0));
    glowGradients[j]=gradient;
   }
   cache=this.silkCache={key,glow,light,baseY,tilt,amp,amp2,freq,phase,speed,widths,opacity,colors,gradients,
    supportY,supportTilt,supportAmp,supportFreq,supportPhase,supportSpeed,supportWidth,supportOpacity,supportColors,
    glowGradients,points:new Float32Array(layers*(samples+1)*4),supportPoints:new Float32Array(supports*(samples+1)*2),dark:this.blend(p[0],'#000000',.72),layers,samples,supports};
  }
  const {light,glow,glowGradients,points,supportPoints}=cache;
  g.globalAlpha=a;g.fillStyle=cache.dark;g.fillRect(0,0,w,h);
  // A half-resolution atmospheric pass keeps the dark field alive between the
  // sheets without creating radial gradients during animation.
  light.clearRect(0,0,w,h);light.globalAlpha=.68;light.fillStyle=glowGradients[0];light.fillRect(0,0,w,h);
  light.globalAlpha=.46;light.fillStyle=glowGradients[1];light.fillRect(0,0,w,h);
  light.globalAlpha=.32;light.fillStyle=glowGradients[2];light.fillRect(0,0,w,h);
  light.globalAlpha=1;g.globalAlpha=a*.72;g.drawImage(glow,0,0,w,h);

  g.lineJoin='round';g.lineCap='round';
  const stride=(cache.samples+1)*4,span=1.16;
  for(let j=0;j<cache.layers;j++){
   const base=j*stride,phase=cache.phase[j]+t*cache.speed[j],d=j/(cache.layers-1);
   for(let i=0;i<=cache.samples;i++){
    const u=i/cache.samples*span-.08,x=u*w;
    const wave=Math.sin(u*cache.freq[j]*Math.PI*2+phase)*cache.amp[j]*(1+audio.bass*.22+audio.pulse*.14)+Math.sin(u*3.7-phase*1.31+d*5.2+t*.075)*cache.amp2[j]*(1+audio.mid*.18);
    const center=h*(cache.baseY[j]+cache.tilt[j]*(u-.5)+wave);
    const half=h*cache.widths[j]*(.80+.16*Math.sin(u*2.2+phase*.57+d*4))*(1+audio.bass*.06);
    const index=base+i*4;points[index]=x;points[index+1]=center-half;points[index+2]=x;points[index+3]=center+half;
   }
   g.beginPath();
   for(let i=0;i<=cache.samples;i++){const index=base+i*4;i?g.lineTo(points[index],points[index+1]):g.moveTo(points[index],points[index+1]);}
   for(let i=cache.samples;i>=0;i--){const index=base+i*4;g.lineTo(points[index+2],points[index+3]);}
   g.closePath();g.fillStyle=cache.gradients[j];g.globalAlpha=a*Math.min(1,.48+cache.opacity[j]*.34+audio.energy*.06+audio.pulse*.04);g.fill();
   // A soft center seam gives the sheet a fold direction without outlining it.
   g.beginPath();
   for(let i=0;i<=cache.samples;i++){const index=base+i*4;const y=(points[index+1]+points[index+3])*.5;i?g.lineTo(points[index],y):g.moveTo(points[index],y);}
   g.strokeStyle=cache.colors[j];g.globalAlpha=a*Math.min(1,.075+cache.opacity[j]*.07+audio.high*.055+audio.pulse*.035);g.lineWidth=.65+((j===1||j===cache.layers-2) ? .45 : 0)+audio.high*.10;g.stroke();
  }
  const supportStride=(cache.samples+1)*2;
  for(let j=0;j<cache.supports;j++){
   const base=j*supportStride,phase=cache.supportPhase[j]+t*cache.supportSpeed[j];
   for(let i=0;i<=cache.samples;i++){
    const u=i/cache.samples*span-.08,x=u*w;
    const y=h*(cache.supportY[j]+cache.supportTilt[j]*(u-.5)+Math.sin(u*cache.supportFreq[j]*Math.PI*2+phase)*cache.supportAmp[j]*(1+audio.mid*.16)+Math.sin(u*5.1-phase*.73+j)*.008*(1+audio.high*.16));
    supportPoints[base+i*2]=x;supportPoints[base+i*2+1]=y;
   }
   g.beginPath();
   for(let i=0;i<=cache.samples;i++){const index=base+i*2;i?g.lineTo(supportPoints[index],supportPoints[index+1]):g.moveTo(supportPoints[index],supportPoints[index+1]);}
   g.strokeStyle=cache.supportColors[j];g.globalAlpha=a*Math.min(1,cache.supportOpacity[j]+audio.high*.035);g.lineWidth=cache.supportWidth[j]+audio.high*.06;g.stroke();
  }
  g.globalAlpha=a;
 }
 orbit(g,w,h,t,p,a){
  const cx=w*.5,cy=h*.43,r=Math.min(w*.33,h*.32);
  this.glow(g,cx,cy,r*1.65,p[2],.28);
  // Dark core and luminous atmospheric limb give the orbit actual volume.
  const sphere=g.createRadialGradient(cx-r*.22,cy-r*.3,r*.04,cx,cy,r);
  sphere.addColorStop(0,this.rgba(p[2],.1));sphere.addColorStop(.65,this.rgba(p[1],.25));sphere.addColorStop(.92,this.rgba(p[3],.17));sphere.addColorStop(1,this.rgba(p[0],0));g.fillStyle=sphere;g.fillRect(cx-r,cy-r,r*2,r*2);
  g.translate(cx,cy);g.rotate(-.4+t*.075);
  for(let j=0;j<68;j++){
   const d=j/67,inclination=d*Math.PI+t*.18,phase=t*.32+d*4.5;
   g.beginPath();
   for(let i=0;i<=180;i++){
    const q=i/180*Math.PI*2,warp=1+.045*Math.sin(q*3+phase)+.018*Math.cos(q*7-phase);
    const x=Math.cos(q)*r*(.87+.17*Math.sin(d*3.14))*warp;
    const y=Math.sin(q)*r*Math.cos(inclination)*.85+Math.sin(q*2+phase)*r*.035;
    i?g.lineTo(x,y):g.moveTo(x,y);
   }
   g.strokeStyle=this.color(p,.28+.53*Math.pow(Math.sin(d*Math.PI),2));g.globalAlpha=a*(.06+.19*Math.pow(Math.sin(d*9+t*.12)*.5+.5,3));g.lineWidth=.7;g.stroke();
  }
  // A few close elliptical paths carry broad, softly graduated highlights.
  for(let j=0;j<4;j++){
   g.save();g.rotate(.25+j*.31+Math.sin(t*.12+j)*.16);
   for(let k=0;k<80;k++){
    const q=k/80*Math.PI*2,head=t*(.32+j*.04)+j*1.8;
    const light=Math.pow(Math.max(0,Math.cos(q-head)),14);
    g.beginPath();g.ellipse(0,0,r*(1.13+j*.025),r*(.39+j*.12),0,q,q+Math.PI*2/80+.003);
    g.strokeStyle=p[3];g.globalAlpha=a*(.025+light*.38);g.lineWidth=.8+light*.65;g.stroke();
   }g.restore();
  }
  g.globalAlpha=a;
 }
 glassBackground(w,h,p){
  const key=[Math.round(w),Math.round(h),this.seed,p.join('')].join(':');if(this.glassKey===key)return;
  this.glassKey=key;const c=this.glass||document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);const g=c.getContext('2d');
  const bg=g.createLinearGradient(0,0,w,h);bg.addColorStop(0,p[0]);bg.addColorStop(.48,p[1]);bg.addColorStop(1,p[0]);g.fillStyle=bg;g.fillRect(0,0,w,h);
  const scale=Math.min(w,h);
  this.glow(g,w*.25,h*.38,scale*.65,p[2],.28);this.glow(g,w*.72,h*.57,scale*.55,p[3],.20);
  // Defocused lamps and their vertical reflections; no skyline or window grid.
  for(const light of this.lights){
   const x=light.x*w,y=light.y*h,r=scale*light.r;
   const color=light.warm?this.blend(p[3],'#ddc7a2',p===UT_THEMES.noir.art?0:.28):p[3];
   g.save();g.translate(x,y);g.scale(1,1.15);const halo=g.createRadialGradient(0,0,r*.15,0,0,r*2.6);halo.addColorStop(0,color);halo.addColorStop(.18,this.rgba(p[4],.7));halo.addColorStop(.44,this.rgba(p[3],.28));halo.addColorStop(1,this.rgba(p[3],0));g.globalAlpha=light.alpha*.68;g.fillStyle=halo;g.fillRect(-r*3,-r*3,r*6,r*6);g.restore();
   g.save();g.translate(x,y+r*2);g.scale(1,4);this.glow(g,0,0,r*1.1,p[3],light.alpha*.045);g.restore();
  }
  this.glass=c;
  // Small drop sprites avoid rebuilding hundreds of gradients every frame.
  const bead=this.bead||document.createElement('canvas');bead.width=bead.height=48;const b=bead.getContext('2d');
  const shadow=b.createRadialGradient(23,25,8,24,24,19);shadow.addColorStop(0,'#0000');shadow.addColorStop(.72,'#0002');shadow.addColorStop(.88,'#0008');shadow.addColorStop(1,'#0000');b.fillStyle=shadow;b.fillRect(0,0,48,48);
  b.beginPath();b.ellipse(24,24,15,18,0,0,Math.PI*2);const body=b.createLinearGradient(10,7,33,42);body.addColorStop(0,'#ffffff1a');body.addColorStop(.3,'#00000016');body.addColorStop(.75,'#ffffff05');body.addColorStop(1,'#ffffff6b');b.fillStyle=body;b.fill();
  b.beginPath();b.ellipse(24,24,14.3,17.3,0,.18,1.75);b.strokeStyle='#e6eef299';b.lineWidth=.9;b.stroke();b.beginPath();b.ellipse(21,18,8,10,-.2,3.65,4.7);b.strokeStyle='#ffffff5e';b.lineWidth=.75;b.stroke();this.bead=bead;
  // Cache static condensation and tiny refracting beads into a foreground plate.
  const plate=this.glassPlate||document.createElement('canvas');plate.width=c.width;plate.height=c.height;
  const pg=plate.getContext('2d');
  for(const m of this.mist){pg.globalAlpha=m.alpha*.34;pg.drawImage(bead,m.x*w-m.r,m.y*h-m.r,m.r*2,m.r*2.5);}
  for(let i=0;i<this.drops.length;i++){const d=this.drops[i];if(!d.moving)this.glassDrop(pg,d,i,w,h,0,1);}
  this.glassPlate=plate;
  // Two reusable alpha-gradient sprites replace dozens of gradients per frame.
  const streak=this.rainStreak||document.createElement('canvas');streak.width=8;streak.height=128;
  const sg=streak.getContext('2d'),rain=sg.createLinearGradient(0,0,0,128);
  rain.addColorStop(0,this.rgba(p[4],0));rain.addColorStop(.8,this.rgba(p[3],.15));rain.addColorStop(1,this.rgba(p[4],.27));sg.fillStyle=rain;sg.fillRect(3,0,1.5,128);this.rainStreak=streak;
  const trail=this.dropTrail||document.createElement('canvas');trail.width=24;trail.height=128;
  const tg=trail.getContext('2d'),wet=tg.createLinearGradient(0,0,0,128);
  wet.addColorStop(0,this.rgba(p[3],0));wet.addColorStop(.60,this.rgba(p[3],.045));wet.addColorStop(1,this.rgba(p[4],.17));tg.strokeStyle=wet;tg.lineWidth=2;
  tg.beginPath();for(let i=0;i<=32;i++){const y=i*4,x=12+Math.sin(i*.20)*2;i?tg.lineTo(x,y):tg.moveTo(x,y);}tg.stroke();this.dropTrail=trail;
 }
 glassDrop(g,d,index,w,h,t,a){
  const travel=d.moving?(t*d.speed+.008*Math.sin(t*.8+d.phase)):0;
  const y=((d.y+travel)%1.22)*h-h*.08,x=d.x*w+(d.moving?Math.sin(y*.018+d.phase)*1.8:0);
  const r=d.r*(w<650?1:1.35)*(index%19===0?1.65:1),stretch=d.moving?1.55:1.12;
  if(d.moving){g.globalAlpha=a*.8;g.drawImage(this.dropTrail,x-r*.7,y-(40+r*12),r*1.4,40+r*12);}
  g.save();g.globalAlpha=a*.9;g.beginPath();g.ellipse(x,y,r*.68,r*.82*stretch,0,0,Math.PI*2);g.clip();
  const sample=Math.max(1,Math.min(20,w,h));
  const sx=Math.max(0,Math.min(w-sample,(w-x)*.78)),sy=Math.max(0,Math.min(h-sample,y*.72));
  g.drawImage(this.glass,sx,sy,sample,sample,x-r,y-r*stretch,r*2,r*2*stretch);g.restore();
  g.globalAlpha=a*(d.moving?.94:.78);g.drawImage(this.bead,x-r,y-r*stretch,r*2,r*2*stretch);
 }
 wetGlass(g,w,h,t,p,a){
  const audio=this.canvasFrame.audio||this.audioState;
  this.glassBackground(w,h,p);g.globalAlpha=a;g.drawImage(this.glass,0,0,w,h);
  // Distant rain stays restrained. The shared music-reactive clock supplies most
  // of the speed response; spectral energy only nudges length and luminance.
  for(const drop of this.farRain){const y=((drop.y+t*drop.speed)%1.2)*h-h*.1,x=drop.x*w+Math.sin(t*.09+drop.y)*4;
   const len=drop.len*h*(1+audio.bass*.08);g.globalAlpha=a*Math.min(1,.65+audio.energy*.06+audio.pulse*.04);g.drawImage(this.rainStreak,x-2,y-len,4,len);
  }
  g.globalAlpha=a;g.drawImage(this.glassPlate,0,0,w,h);
  for(let i=0;i<this.drops.length;i++){const d=this.drops[i];if(d.moving)this.glassDrop(g,d,i,w,h,t,a*Math.min(1,1+audio.high*.06+audio.pulse*.04));}
  g.globalAlpha=a;
 }
}
