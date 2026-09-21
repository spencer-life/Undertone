/* Optional Energy Orbit GPU surface. Owns resources, never owns animation/state/audio. */
class UndertoneOrbitBridge {
 constructor(canvas, invalidate, options={}) {
  this.base=canvas;this.invalidate=invalidate;this.renderer=null;this.layer=null;
  this.pending=false;this.failed=false;this.generation=0;this.disposed=false;
  this.load=options.load||(()=>import('./vendor/energy-orbit.js'));
  this.enabled=options.enabled??(!!globalThis.navigator?.gpu&&new URLSearchParams(globalThis.location?.search||'').get('renderer')==='webgpu');
  this.status(this.enabled?'idle':'canvas');
 }
 status(value,error){
  this.state=value;
  if(this.base.dataset){this.base.dataset.orbitStatus=value;this.base.dataset.renderer='canvas2d';
   if(error)this.base.dataset.orbitError=String(error.message||error);}
 }
 prepare(scene){
  if(this.disposed)return;
  if(scene!=='orbit'){if(this.pending||this.renderer)this.release();return;}
  if(!this.enabled||this.failed||this.pending||this.renderer)return;
  this.pending=true;const generation=++this.generation;this.status('loading');
  // Separate contexts are essential: a Canvas 2D surface cannot become WebGPU.
  const layer=this.base.ownerDocument.createElement('canvas');
  layer.setAttribute('aria-hidden','true');layer.style.pointerEvents='none';
  layer.style.display='none';this.base.after(layer);this.layer=layer;
  const fail=error=>{
   if(generation!==this.generation||this.disposed)return;
   this.release();this.failed=true;this.status('unavailable',error);this.invalidate();
  };
  this.load().then(module=>generation===this.generation&&!this.disposed?module.createOrbitRenderer(layer,{onFailure:fail}):null).then(renderer=>{
   if(!renderer)return;
   if(generation!==this.generation||this.disposed){renderer.dispose();layer.remove();return;}
   this.renderer=renderer;this.pending=false;this.status('ready');this.invalidate();
  }).catch(fail);
 }
 draw(parameters){
  if(!this.renderer||this.disposed)return false;
  try{
   const submitted=this.renderer.draw(parameters);
   if(!this.layer||!this.renderer)return false;
   if(submitted===false)throw new Error('WebGPU frame was not submitted');
   this.layer.style.display='block';
   if(this.base.dataset)this.base.dataset.renderer='webgpu';
   return true;
  }catch(error){this.release();this.failed=true;this.status('unavailable',error);this.invalidate();return false;}
 }
 hide(){if(this.layer)this.layer.style.display='none';if(this.base.dataset)this.base.dataset.renderer='canvas2d';}
 release(){
  ++this.generation;this.pending=false;this.hide();
  const renderer=this.renderer;this.renderer=null;
  try{renderer?.dispose();}finally{this.layer?.remove();this.layer=null;}
  this.status('idle');
 }
 dispose(){if(this.disposed)return;this.release();this.disposed=true;}
}
