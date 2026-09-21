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
  this.canvasFrame={time:0,viewport:{width:0,height:0,dpr:1},seed:604,palette:null,motion:0,brightness:1,reducedMotion:false};
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
 frame(ms){
  requestAnimationFrame(this.frame);const s=this.settings(),dt=this.last?Math.min((ms-this.last)/1000,.1):0;this.last=ms;
  if(s.scene!=='orbit')this.orbitGPU?.prepare(s.scene);
  if(document.hidden||s.blackout)return;
  this.orbitGPU?.prepare(s.scene);
  const still=s.motion===0||this.reduced.matches;
  if(!still)this.time+=dt*(.18+s.motion/100*.9);
  if(!this.dirty&&(still||ms-this.lastPaint<1000/(s.eco?20:30)))return;
  const paintDt=this.lastPaint?Math.min((ms-this.lastPaint)/1000,.2):0;this.lastPaint=ms;
  if(s.scene!==this.activeScene){this.previousScene=this.activeScene;this.activeScene=s.scene;this.transition=still?1:0;}
  this.transition=Math.min(1,(this.transition||0)+paintDt/.9);
  this.energy+=(this.audio()-this.energy)*.025;this.render(s);this.dirty=false;
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
  const c=this.canvasFrame;c.time=this.time+this.offset;c.viewport.width=this.width;c.viewport.height=this.height;c.viewport.dpr=Math.min(window.devicePixelRatio||1,1.5);c.seed=this.seed;c.palette=UT_THEMES[s.theme];c.motion=s.motion/100;c.brightness=s.brightness/100;c.reducedMotion=this.reduced.matches;return c;
 }
 renderScene(scene,g,w,h,t,p,a){g.save();g.globalAlpha=a;if(scene==='rain')this.wetGlass(g,w,h,t,p,a);else if(scene==='dunes')this.silk(g,w,h,t,p,a);else if(scene==='orbit')this.orbit(g,w,h,t,p,a);else this.contours(g,w,h,t,p,a);g.restore();}
 glow(g,x,y,r,color,opacity){const v=g.createRadialGradient(x,y,0,x,y,r);v.addColorStop(0,this.rgba(color,opacity));v.addColorStop(.45,this.rgba(color,opacity*.4));v.addColorStop(1,this.rgba(color,0));g.fillStyle=v;g.fillRect(x-r,y-r,r*2,r*2);}
 contours(g,w,h,t,p,a){
  const c=this.canvasFrame,theme=c.palette||UT_THEMES.ocean;
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
  const drift=Math.sin(t*.071+phase[0]),breath=Math.sin(t*.103+phase[1]);
  for(let j=0;j<count;j++){
   const d=j/(count-1),r=.12+d*1.20,base=j*(segments+1)*2;
   for(let i=0;i<=segments;i++){
    const q=i/segments*Math.PI*2;
    const fold=1+.19*Math.sin(q*3+phase[2]+d*1.8+drift*.17)+.10*Math.cos(q*2-phase[3]+d*2.5)+.035*Math.sin(q*5+phase[4]+breath*.20);
    const x=cos[i]*r*fold,y=sin[i]*r;
    points[base+i*2]=cx+rx*(x+.17*Math.sin(y*2.8+phase[5]+drift*.12)+.06*Math.sin(d*4+phase[0]));
    points[base+i*2+1]=cy+ry*(y*(.82+.14*Math.cos(q*2+d*2+phase[1]))+.17*Math.sin(x*2.7+phase[3]+breath*.12));
   }
  }
  g.globalAlpha=a;g.fillStyle=cache.dark;g.fillRect(0,0,w,h);
  light.clearRect(0,0,w,h);light.lineJoin='round';light.lineCap='round';
  // Only six elevation lines contribute glow, spatially masked by cached gradients.
  for(let n=0;n<6;n++){
   const j=Math.round(count*(.18+n*.105)),base=j*(segments+1)*2;
   light.beginPath();for(let i=0;i<=segments;i++){const x=points[base+i*2],y=points[base+i*2+1];i?light.lineTo(x,y):light.moveTo(x,y);}light.closePath();
   light.strokeStyle=cache.glowGradients[n%3];light.lineWidth=3;light.shadowColor=cache.accents[n%3];light.shadowBlur=9;light.globalAlpha=.55;light.stroke();
  }
  light.shadowBlur=0;g.globalAlpha=a*.8;g.drawImage(glow,0,0,w,h);
  g.lineJoin='round';g.lineCap='round';
  for(let j=count-1;j>=0;j--){
   const d=j/(count-1),base=j*(segments+1)*2;
   g.beginPath();for(let i=0;i<=segments;i++){const x=points[base+i*2],y=points[base+i*2+1];i?g.lineTo(x,y):g.moveTo(x,y);}g.closePath();
   const depth=.5+.5*Math.sin(d*8+phase[2]);
   g.strokeStyle=cache.colors[j];g.globalAlpha=a*(.18+depth*.20)*(1-Math.pow(d,5)*.65);g.lineWidth=.55+depth*.40;g.stroke();
   for(let n=0;n<6;n++)if(j===Math.round(count*(.18+n*.105))){g.strokeStyle=gradients[n%3];g.globalAlpha=a*(.82+.15*Math.sin(t*.09+n));g.lineWidth=1.25+depth*.4;g.stroke();}
  }
  g.globalAlpha=a;
 }
 silk(g,w,h,t,p,a){
  // A softly lit folded surface: closely spaced ribbons, multiple slow scales.
  this.glow(g,w*.65,h*.3,w*.6,p[2],.19);
  const count=w<650?95:150,step=w<650?9:10;
  g.lineCap='round';
  for(let j=0;j<count;j++){
   const d=j/(count-1),phase=d*5.4;
   g.beginPath();
   for(let x=-20;x<=w+20;x+=step){
    const u=x/w;
    const fold=Math.sin(u*5.3+phase+t*.12)*.16+Math.sin(u*9.1-phase*1.4-t*.085)*.045+Math.sin(u*2.4+d*7+t*.07)*.14;
    const y=h*(.13+d*.65+fold*Math.sin(Math.PI*(.1+d*.8)))+Math.sin(u*18+d*4+t*.16)*h*.006;
    x===-20?g.moveTo(x,y):g.lineTo(x,y);
   }
   const ridge=Math.pow(Math.max(0,Math.sin(d*18+t*.13)),7),rim=Math.sin(Math.PI*d);
   g.strokeStyle=this.color(p,.22+ridge*.53+rim*.08);g.globalAlpha=a*(.20+ridge*.45)*rim;g.lineWidth=h/count*.85;g.stroke();
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
  this.glassKey=key;const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);const g=c.getContext('2d');
  const bg=g.createLinearGradient(0,0,w,h);bg.addColorStop(0,p[0]);bg.addColorStop(.48,p[1]);bg.addColorStop(1,p[0]);g.fillStyle=bg;g.fillRect(0,0,w,h);
  const scale=Math.min(w,h);
  this.glow(g,w*.25,h*.38,scale*.65,p[2],.28);this.glow(g,w*.72,h*.57,scale*.55,p[3],.20);
  // Defocused lamps and their vertical reflections; no skyline or window grid.
  for(const light of this.lights){
   const x=light.x*w,y=light.y*h,r=scale*light.r;
   const color=light.warm?this.blend(p[3],'#ddc7a2',p===UT_THEMES.noir.art?0:.28):p[3];
   g.save();g.translate(x,y);g.scale(1,1.15);const halo=g.createRadialGradient(0,0,r*.15,0,0,r*2.6);halo.addColorStop(0,color);halo.addColorStop(.30,this.rgba(p[3],.5));halo.addColorStop(1,this.rgba(p[3],0));g.globalAlpha=light.alpha*.43;g.fillStyle=halo;g.fillRect(-r*3,-r*3,r*6,r*6);g.restore();
   g.save();g.translate(x,y+r*2);g.scale(1,4);this.glow(g,0,0,r*1.1,p[3],light.alpha*.045);g.restore();
  }
  this.glass=c;
  // Small drop sprites avoid rebuilding hundreds of gradients every frame.
  const bead=document.createElement('canvas');bead.width=bead.height=48;const b=bead.getContext('2d');
  const shadow=b.createRadialGradient(23,25,8,24,24,19);shadow.addColorStop(0,'#0000');shadow.addColorStop(.72,'#0002');shadow.addColorStop(.88,'#0008');shadow.addColorStop(1,'#0000');b.fillStyle=shadow;b.fillRect(0,0,48,48);
  b.beginPath();b.ellipse(24,24,15,18,0,0,Math.PI*2);const body=b.createLinearGradient(10,7,33,42);body.addColorStop(0,'#ffffff1a');body.addColorStop(.3,'#00000016');body.addColorStop(.75,'#ffffff05');body.addColorStop(1,'#ffffff6b');b.fillStyle=body;b.fill();
  b.beginPath();b.ellipse(24,24,14.3,17.3,0,.18,1.75);b.strokeStyle='#e6eef299';b.lineWidth=.9;b.stroke();b.beginPath();b.ellipse(21,18,8,10,-.2,3.65,4.7);b.strokeStyle='#ffffff5e';b.lineWidth=.75;b.stroke();this.bead=bead;
 }
 wetGlass(g,w,h,t,p,a){
  this.glassBackground(w,h,p);g.globalAlpha=a;g.drawImage(this.glass,0,0,w,h);
  // Distant rainfall lives behind the glass and travels nearly vertically.
  for(const drop of this.farRain){const y=((drop.y+t*drop.speed)%1.2)*h-h*.1,x=drop.x*w+Math.sin(t*.09+drop.y)*4;
   const len=drop.len*h,trail=g.createLinearGradient(x,y-len,x,y);trail.addColorStop(0,this.rgba(p[4],0));trail.addColorStop(1,this.rgba(p[4],.13));g.strokeStyle=trail;g.lineWidth=.6;g.beginPath();g.moveTo(x-2,y-len);g.lineTo(x,y);g.stroke();}
  for(const m of this.mist){g.globalAlpha=a*m.alpha*.42;g.drawImage(this.bead,m.x*w-m.r,m.y*h-m.r,m.r*2,m.r*2.5);}
  for(const d of this.drops){
   const travel=d.moving?(t*d.speed+.013*Math.sin(t*1.3+d.phase)):0;
   const y=((d.y+travel)%1.22)*h-h*.08;
   const x=d.x*w+(d.moving?Math.sin(y*.018+d.phase)*1.8:0);
   const r=d.r*(w<650?.85:1.15),stretch=d.moving?1.65:1.18;
   if(d.moving){
    const tail=35+r*12;const wet=g.createLinearGradient(x,y-tail,x,y);wet.addColorStop(0,'#ffffff00');wet.addColorStop(.55,'#c8d8e509');wet.addColorStop(1,'#d7e5f126');
    g.strokeStyle=wet;g.globalAlpha=a*.7;g.lineWidth=Math.max(1,r*.54);g.beginPath();
    for(let j=0;j<=14;j++){const yy=y-tail+j*tail/14,xx=d.x*w+Math.sin(yy*.018+d.phase)*1.8;j?g.lineTo(xx,yy):g.moveTo(xx,yy);}g.stroke();
   }
   // Each bead acts as a tiny lens, magnifying a displaced part of the light field.
   g.save();g.globalAlpha=a*.85;g.beginPath();g.ellipse(x,y,r*.68,r*.82*stretch,0,0,Math.PI*2);g.clip();
   const sx=Math.max(0,Math.min(w-20,(w-x)*.78)),sy=Math.max(0,Math.min(h-20,y*.72));
   g.drawImage(this.glass,sx,sy,20,20,x-r,y-r*stretch,r*2,r*2*stretch);g.restore();
   g.globalAlpha=a*(d.moving?.8:.72);g.drawImage(this.bead,x-r,y-r*stretch,r*2,r*2*stretch);
  }
  g.globalAlpha=a;
 }
}
