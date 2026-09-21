'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../orbit-bridge.js'),'utf8');
function harness(load,enabled=true){
 const layers=[];let invalidations=0;const canvas={dataset:{},ownerDocument:{createElement(){const layer={style:{},setAttribute(){},remove(){this.removed=true;}};layers.push(layer);return layer;}},after(){}};
 const scope={URLSearchParams};vm.runInNewContext(source+'\nglobalThis.Bridge=UndertoneOrbitBridge;',scope);
 const bridge=new scope.Bridge(canvas,()=>invalidations++,{enabled,load});return{bridge,canvas,layers,invalidations:()=>invalidations};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('unsupported WebGPU never loads the optional bundle or creates a surface',()=>{
 let loads=0;const h=harness(()=>{loads++;},false);h.bridge.prepare('orbit');assert.equal(loads,0);assert.equal(h.layers.length,0);assert.equal(h.bridge.draw({}),false);
});
test('only Energy Orbit loads WebGPU, with one in-flight initialization',async()=>{
 let loads=0,draws=0,disposals=0;const renderer={draw(){draws++;},dispose(){disposals++;}};
 const h=harness(async()=>{loads++;return{createOrbitRenderer:async()=>renderer};});
 h.bridge.prepare('rain');assert.equal(loads,0);h.bridge.prepare('orbit');h.bridge.prepare('orbit');await flush();
 assert.equal(loads,1);assert.equal(h.bridge.draw({time:4}),true);assert.equal(draws,1);assert.equal(h.canvas.dataset.renderer,'webgpu');
 h.bridge.prepare('dunes');assert.equal(disposals,1);assert.equal(h.layers[0].removed,true);assert.equal(h.canvas.dataset.renderer,'canvas2d');
});
test('leaving during adapter acquisition disposes the late device without showing it',async()=>{
 let finish,disposals=0;const h=harness(async()=>({createOrbitRenderer:()=>new Promise(resolve=>finish=resolve)}));
 h.bridge.prepare('orbit');await flush();h.bridge.prepare('tides');finish({draw(){throw Error('should not draw');},dispose(){disposals++;}});await flush();
 assert.equal(disposals,1);assert.equal(h.bridge.renderer,null);assert.equal(h.layers[0].removed,true);
});
test('leaving before module load skips GPU acquisition altogether',async()=>{
 let finish,acquisitions=0;const h=harness(()=>new Promise(resolve=>finish=resolve));h.bridge.prepare('orbit');h.bridge.prepare('rain');
 finish({createOrbitRenderer(){acquisitions++;}});await flush();assert.equal(acquisitions,0);
});
test('adapter failure keeps Canvas and does not retry every frame',async()=>{
 let loads=0;const h=harness(async()=>{loads++;throw Error('No adapter');});h.bridge.prepare('orbit');await flush();
 for(let i=0;i<30;i++)h.bridge.prepare('orbit');assert.equal(loads,1);assert.equal(h.bridge.state,'unavailable');assert.equal(h.bridge.draw({}),false);assert.match(h.canvas.dataset.orbitError,/No adapter/);
});
test('draw failure and device loss restore Canvas and dispose resources',async()=>{
 let disposals=0;const h=harness(async()=>({createOrbitRenderer:async()=>({draw(){throw Error('GPU lost');},dispose(){disposals++;}})}));h.bridge.prepare('orbit');await flush();
 assert.equal(h.bridge.draw({}),false);assert.equal(disposals,1);assert.equal(h.canvas.dataset.renderer,'canvas2d');assert.equal(h.bridge.failed,true);
 let fail;const h2=harness(async()=>({createOrbitRenderer:async(_canvas,options)=>{fail=options.onFailure;return{draw(){},dispose(){disposals++;}};}}));h2.bridge.prepare('orbit');await flush();fail(Error('device lost'));
 assert.equal(h2.bridge.renderer,null);assert.equal(h2.bridge.failed,true);assert.equal(disposals,2);
});
test('page teardown is idempotent and cannot revive a pending renderer',async()=>{
 let finish,disposals=0;const h=harness(async()=>({createOrbitRenderer:()=>new Promise(resolve=>finish=resolve)}));h.bridge.prepare('orbit');await flush();h.bridge.dispose();h.bridge.dispose();
 finish({dispose(){disposals++;}});await flush();h.bridge.prepare('orbit');assert.equal(disposals,1);assert.equal(h.layers.length,1);assert.equal(h.bridge.disposed,true);
});
test('a renderer that cannot submit a frame is removed before Canvas fallback',async()=>{
 let disposals=0;const h=harness(async()=>({createOrbitRenderer:async()=>({draw(){return false;},dispose(){disposals++;}})}));h.bridge.prepare('orbit');await flush();
 assert.equal(h.bridge.draw({}),false);assert.equal(h.bridge.renderer,null);assert.equal(h.layers[0].removed,true);assert.equal(disposals,1);assert.equal(h.canvas.dataset.renderer,'canvas2d');
});

test('normal URLs enable WebGPU when supported; explicit Canvas and unsupported browsers retain fallback',()=>{
 for(const [gpu,search,expected] of [[{},'',true],[{},'?renderer=webgpu',true],[{},'?renderer=canvas',false],[undefined,'',false],[undefined,'?renderer=webgpu',false]]){
  const scope={URLSearchParams,navigator:{gpu},location:{search}};
  vm.runInNewContext(source+'\nglobalThis.Bridge=UndertoneOrbitBridge;',scope);
  const bridge=new scope.Bridge({dataset:{}},()=>{});
  assert.equal(bridge.enabled,expected,`gpu=${!!gpu}, search=${search}`);
 }
});
