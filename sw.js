// An atomic, versioned app shell prevents offline HTML / module mismatches.
const CACHE = 'undertone-v12';
const ASSETS = [
 './','./index.html','./styles.css','./layout.css','./audio.js',
 './audio-worklet.js','./music-library.js','./tracks.js','./orbit-bridge.js','./vendor/energy-orbit.js','./visuals.js','./webmcp.js','./app.js','./manifest.webmanifest',
 './icons/icon-192.png','./icons/icon-512.png','./icons/icon-512-maskable.png',
 './icons/apple-touch-icon.png'
];
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
 // New versions wait until existing tabs close; do not replace a playing app.
});
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('undertone-v')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const request=event.request;
  if(request.mode==='navigate')return (await cache.match('./index.html'))||fetch(request);
  return (await cache.match(request))||fetch(request);
 }));
});
