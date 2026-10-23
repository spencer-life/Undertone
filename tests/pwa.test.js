'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function serviceWorker({fetchImpl=async()=>'network',workerUrl='https://undertone.test/sw.js'}={}){
 const handlers={},deleted=[],added=[],reads=[],network=[],skipped=[],addedRequests=[],stored=new Map([['./index.html','cached-html']]);
 const cache={addAll:async assets=>{addedRequests.push(...assets);added.push(...assets.map(a=>typeof a==='string'?a:'./'+a.url.slice(new URL('./',workerUrl).href.length)));},put:async(key,value)=>stored.set(key,value),match:async key=>{reads.push(key);return stored.get(key);}};
 const context={URL,Request,caches:{open:async()=>cache,keys:async()=>['undertone-v3','undertone-v11','undertone-v13','undertone-v14','undertone-v15','undertone-v16','undertone-v17','undertone-v18','undertone-v19','undertone-v20','undertone-v21','undertone-v22','undertone-v23','undertone-v24','undertone-v25','undertone-v26','undertone-v27','undertone-v28','undertone-v29','undertone-v30','undertone-v50','undertone-v51','undertone-v52','unrelated-cache','undertone-library-v1'],delete:async key=>deleted.push(key)},fetch:async req=>{network.push(req);return fetchImpl(req);},self:{location:{origin:new URL(workerUrl).origin,href:workerUrl},skipWaiting:async()=>skipped.push(true),clients:{claim:async()=>{}},addEventListener:(type,fn)=>handlers[type]=fn}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);return {handlers,deleted,added,reads,network,stored,skipped,addedRequests};
}
test('PWA shell caches every app script/style and worklet before activation',async()=>{
 const sw=serviceWorker();let ready;sw.handlers.install({waitUntil:p=>ready=p});await ready;
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const resources=[...html.matchAll(/(?:src|href)="(\.\/[^"#]+\.(?:js|css))"/g)].map(m=>m[1]);
 for(const asset of [...resources,'./audio-worklet.js'])assert(sw.added.includes(asset),`${asset} is missing offline`);
 for(const asset of sw.added)assert(fs.existsSync(path.resolve(root,asset)),`Missing precache file ${asset}`);
 assert(sw.addedRequests.every(request=>request.cache==='reload'),'new-version installation must bypass stale HTTP responses');
});
test('activation removes only obsolete Undertone caches',async()=>{
 const sw=serviceWorker();let ready;sw.handlers.activate({waitUntil:p=>ready=p});await ready;assert.deepEqual(sw.deleted,['undertone-v3','undertone-v11','undertone-v13','undertone-v14','undertone-v15','undertone-v16','undertone-v17','undertone-v18','undertone-v19','undertone-v20','undertone-v21','undertone-v22','undertone-v23','undertone-v24','undertone-v25','undertone-v26','undertone-v27','undertone-v28','undertone-v29','undertone-v30','undertone-v50','undertone-v51']);
});
test('offline shell stays versioned; missing modules do not receive HTML',async()=>{
 const sw=serviceWorker();let response;sw.handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://undertone.test/'},respondWith:p=>response=p});assert.equal(await response,'cached-html');assert.equal(sw.network.length,0);
 const req={method:'GET',mode:'same-origin',url:'https://undertone.test/missing.js'};sw.handlers.fetch({request:req,respondWith:p=>response=p});assert.equal(await response,'network');assert.equal(sw.network.at(-1),req);
});

test('lab navigation cannot replace the main offline shell, including scoped installs',async()=>{
 for(const base of ['https://undertone.test/','https://undertone.test/sub/']){
  let online=true;
  const fetchImpl=async req=>{if(!online)throw Error('offline');return {ok:true,clone:()=>req.url.includes('/labs/')?'lab-html':'app-html'};};
  const sw=serviceWorker({fetchImpl,workerUrl:base+'sw.js'});
  const navigate=async url=>{
   const request={method:'GET',mode:'navigate',url};let response;
   sw.handlers.fetch({request,respondWith:p=>response=p});
   return response===undefined?fetchImpl(request):response;
  };
  await navigate(base+'labs/energy-orbit/');
  assert.equal(sw.stored.get('./index.html'),'cached-html','lab poisoned the shell cache');
  online=false;assert.equal(await navigate(base),'cached-html');
  online=true;await navigate(base+'index.html?mix=focus');
  assert.equal(sw.stored.get('./index.html'),'cached-html');
  online=false;assert.equal(await navigate(base),'cached-html');
 }
});

test('installing an update does not force it over open controlled clients',async()=>{
 const sw=serviceWorker();let ready;sw.handlers.install({waitUntil:p=>ready=p});await ready;
 assert.equal(sw.skipped.length,0,'an update must wait for existing clients to close');
});

test('an active worker keeps its cached HTML when newer network HTML is available',async()=>{
 const fresh={ok:true,clone:()=> 'newer-html'};const sw=serviceWorker({fetchImpl:async()=>fresh});let response;
 sw.handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://undertone.test/index.html?mix=focus'},respondWith:p=>response=p});
 assert.equal(await response,'cached-html','new HTML must wait for the new worker version');
 assert.equal(sw.stored.get('./index.html'),'cached-html');assert.equal(sw.network.length,0);
});
