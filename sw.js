// An atomic, versioned app shell prevents offline HTML / module mismatches.
const CACHE = 'undertone-v52';
const ASSETS = [
 './','./index.html','./styles.css','./layout.css','./audio.js',
 './audio-worklet.js','./music-library.js','./tracks.js','./orbit-bridge.js','./black-hole-bridge.js','./vendor/energy-orbit.js','./vendor/black-hole.js','./visuals.js','./webmcp.js','./app.js','./manifest.webmanifest',
 './icons/icon-192.png','./icons/icon-512.png','./icons/icon-512-maskable.png',
 './icons/apple-touch-icon.png','./assets/brand/undertone-wordmark.webp'
];
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache=>{
  const requests=ASSETS.map(asset=>new Request(new URL(asset,self.location.href),{cache:'reload'}));
  return cache.addAll(requests);
 }));
});
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('undertone-v')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 const shellDirectory=new URL('./',self.location.href).pathname;
 // Standalone labs and unknown routes must never replace or fall back to the app shell.
 if(event.request.mode==='navigate'&&![shellDirectory,shellDirectory+'index.html'].includes(new URL(event.request.url).pathname))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const request=event.request;
  if(request.mode==='navigate'){
   // Keep HTML and lazy-loaded assets on this worker's installed version.
   // A waiting worker fills its own cache and takes over after old clients close.
   return (await cache.match('./index.html'))||fetch(request);
  }
  return (await cache.match(request))||fetch(request);
 }));
});
