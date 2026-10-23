'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../black-hole-bridge.js'),'utf8');
function harness(load,enabled=true){
 const layers=[];let invalidations=0;const canvas={dataset:{},ownerDocument:{createElement(){const layer={style:{},setAttribute(){},remove(){this.removed=true;}};layers.push(layer);return layer;}},after(){}};
 const scope={URLSearchParams};vm.runInNewContext(source+'\nglobalThis.Bridge=UndertoneBlackHoleBridge;',scope);
 const bridge=new scope.Bridge(canvas,()=>invalidations++,{enabled,load});return{bridge,canvas,layers,invalidations:()=>invalidations};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('unsupported WebGPU keeps the Canvas Event horizon fallback',()=>{
 let loads=0;const h=harness(()=>{loads++;},false);h.bridge.prepare('horizon');assert.equal(loads,0);assert.equal(h.layers.length,0);assert.equal(h.bridge.draw({}),false);
});
test('only Event horizon loads its renderer and forwards scene state',async()=>{
 let loads=0,updates=0,disposals=0;const renderer={ready:Promise.resolve(),update(){updates++;return true;},dispose(){disposals++;}};
 const h=harness(async()=>{loads++;return{createBlackHoleRenderer:()=>renderer};});
 h.bridge.prepare('orbit');assert.equal(loads,0);h.bridge.prepare('horizon');h.bridge.prepare('horizon');await flush();await flush();
 assert.equal(loads,1);assert.equal(h.bridge.draw({motion:72}),true);assert.equal(updates,1);assert.equal(h.canvas.dataset.renderer,'webgpu');
 h.bridge.prepare('rain');assert.equal(disposals,1);assert.equal(h.layers[0].removed,true);
});
test('leaving during initialization disposes a late renderer',async()=>{
 let resolveReady,disposals=0;const renderer={ready:new Promise(resolve=>resolveReady=resolve),update(){},dispose(){disposals++;}};
 const h=harness(async()=>({createBlackHoleRenderer:()=>renderer}));
 h.bridge.prepare('horizon');await flush();h.bridge.prepare('tides');resolveReady();await flush();await flush();
 assert.equal(disposals,1);assert.equal(h.bridge.renderer,null);assert.equal(h.layers[0].removed,true);
});
test('module or renderer failure keeps the Canvas fallback and does not retry',async()=>{
 let loads=0;const h=harness(async()=>{loads++;throw Error('No adapter');});h.bridge.prepare('horizon');await flush();await flush();
 for(let i=0;i<10;i++)h.bridge.prepare('horizon');assert.equal(loads,1);assert.equal(h.bridge.state,'unavailable');assert.match(h.canvas.dataset.blackHoleError,/No adapter/);
});
test('renderer failure callback releases the GPU surface',async()=>{
 let fail,disposals=0;const renderer={ready:Promise.resolve(),update(){},dispose(){disposals++;}};
 const h=harness(async()=>({createBlackHoleRenderer:(_canvas,options)=>{fail=options.onFailure;return renderer;}}));
 h.bridge.prepare('horizon');await flush();await flush();fail(Error('device lost'));
 assert.equal(h.bridge.renderer,null);assert.equal(h.bridge.failed,true);assert.equal(disposals,1);
});
test('page teardown is idempotent and cannot revive the scene',async()=>{
 let disposals=0;const renderer={ready:Promise.resolve(),update(){},dispose(){disposals++;}};
 const h=harness(async()=>({createBlackHoleRenderer:()=>renderer}));h.bridge.prepare('horizon');await flush();await flush();h.bridge.dispose();h.bridge.dispose();h.bridge.prepare('horizon');
 assert.equal(disposals,1);assert.equal(h.bridge.disposed,true);
});
