/* Event horizon GPU surface. The app owns scheduling, state and audio. */
class UndertoneBlackHoleBridge {
 constructor(canvas,invalidate,options={}) {
  this.base=canvas;this.invalidate=invalidate;this.renderer=null;this.pendingRenderer=null;this.layer=null;
  this.pending=false;this.failed=false;this.generation=0;this.disposed=false;this.stillKey='';
  this.load=options.load||(()=>import('./vendor/black-hole.js'));
  this.enabled=options.enabled??(!!globalThis.navigator?.gpu&&new URLSearchParams(globalThis.location?.search||'').get('renderer')!=='canvas');
  this.status(this.enabled?'idle':'canvas');
 }
 status(value,error){this.state=value;if(this.base.dataset){this.base.dataset.blackHoleStatus=value;if(error)this.base.dataset.blackHoleError=String(error.message||error);}}
 prepare(scene){
  if(this.disposed)return;
  if(scene!=='horizon'){if(this.pending||this.renderer)this.release();return;}
  if(!this.enabled||this.failed||this.pending||this.renderer)return;
  this.pending=true;const generation=++this.generation;this.status('loading');
  const layer=this.base.ownerDocument.createElement('canvas');
  layer.setAttribute('aria-hidden','true');layer.setAttribute('data-scene-renderer','horizon');
  layer.style.pointerEvents='none';layer.style.display='none';layer.style.opacity='0';
  layer.style.transition=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'none':'opacity .7s cubic-bezier(.22,1,.36,1)';
  this.base.after(layer);this.layer=layer;
  const fail=error=>{if(generation!==this.generation||this.disposed)return;this.release();this.failed=true;this.status('unavailable',error);this.invalidate();};
  this.load().then(async module=>{
   if(generation!==this.generation||this.disposed)return;
   const renderer=module.createBlackHoleRenderer(layer,{onFailure:fail});
   this.pendingRenderer=renderer;
   await renderer.ready;
   if(generation!==this.generation||this.disposed)return;
   this.pendingRenderer=null;this.renderer=renderer;this.pending=false;
   this.status('ready');this.invalidate();
  }).catch(fail);
 }
 draw(parameters){
  if(!this.renderer||this.disposed)return false;
  try{
   const bounds=this.base.getBoundingClientRect?.();
   const still=parameters.motion===0||parameters.reducedMotion;
   const key=still?JSON.stringify([bounds?.width,bounds?.height,parameters.width,parameters.height,parameters.seed,parameters.brightness,parameters.eco,parameters.palette]):'';
   // Focus/visibility can invalidate the app even with motion off. Keep the
   // existing GPU image rather than resubmitting an unchanged expensive scene.
   if(!still||key!==this.stillKey){
    const submitted=this.renderer.update(parameters);
    if(submitted===false)throw new Error('Event horizon did not submit a frame');
    this.stillKey=key;
   }
   if(!this.layer||!this.renderer)return false;
   const first=this.layer.style.display==='none';this.layer.style.display='block';
   if(first){const layer=this.layer,next=globalThis.requestAnimationFrame||((fn)=>fn());layer.style.opacity='0';next(()=>{if(this.layer===layer)layer.style.opacity='1';});}
   if(this.base.dataset)this.base.dataset.renderer='webgpu';
   return true;
  }catch(error){this.release();this.failed=true;this.status('unavailable',error);this.invalidate();return false;}
 }
 hide(){if(this.layer)this.layer.style.display='none';}
 release(){
  ++this.generation;this.pending=false;this.stillKey='';this.hide();
  const renderer=this.renderer||this.pendingRenderer;this.renderer=null;this.pendingRenderer=null;
  try{renderer?.dispose();}finally{this.layer?.remove();this.layer=null;}
  if(this.base.dataset)this.base.dataset.renderer='canvas2d';this.status('idle');
 }
 dispose(){if(this.disposed)return;this.release();this.disposed=true;}
}
