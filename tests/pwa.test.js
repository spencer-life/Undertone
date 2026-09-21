'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function serviceWorker(){
 const handlers={},deleted=[],added=[],reads=[],network=[];
 const cache={addAll:async assets=>added.push(...assets),match:async key=>{reads.push(key);return key==='./index.html'?'cached-html':undefined;}};
 const context={URL,caches:{open:async()=>cache,keys:async()=>['undertone-v3','undertone-v11','undertone-v13','unrelated-cache','undertone-library-v1'],delete:async key=>deleted.push(key)},fetch:async req=>{network.push(req);return 'network';},self:{location:{origin:'https://undertone.test'},clients:{claim:async()=>{}},addEventListener:(type,fn)=>handlers[type]=fn}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);return {handlers,deleted,added,reads,network};
}
test('PWA shell caches every app script/style and worklet before activation',async()=>{
 const sw=serviceWorker();let ready;sw.handlers.install({waitUntil:p=>ready=p});await ready;
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const resources=[...html.matchAll(/(?:src|href)="(\.\/[^"#]+\.(?:js|css))"/g)].map(m=>m[1]);
 for(const asset of [...resources,'./audio-worklet.js'])assert(sw.added.includes(asset),`${asset} is missing offline`);
 for(const asset of sw.added)assert(fs.existsSync(path.resolve(root,asset)),`Missing precache file ${asset}`);
});
test('activation removes only obsolete Undertone caches',async()=>{
 const sw=serviceWorker();let ready;sw.handlers.activate({waitUntil:p=>ready=p});await ready;assert.deepEqual(sw.deleted,['undertone-v3','undertone-v11']);
});
test('offline shell stays versioned; missing modules do not receive HTML',async()=>{
 const sw=serviceWorker();let response;sw.handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://undertone.test/'},respondWith:p=>response=p});assert.equal(await response,'cached-html');
 const req={method:'GET',mode:'same-origin',url:'https://undertone.test/missing.js'};sw.handlers.fetch({request:req,respondWith:p=>response=p});assert.equal(await response,'network');assert.equal(sw.network[0],req);
});
