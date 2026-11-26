const CACHE='savings-studio-v13';
const FILES=['./','./index.html','./assets/styles.css?v=13','./assets/app.mjs?v=13','./assets/calc.mjs?v=13','./assets/daily.mjs?v=13','./assets/fixed.mjs?v=13','./assets/favicon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest','./sitemap.xml'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&new URL(event.request.url).pathname.startsWith(new URL(self.registration.scope).pathname)){
      const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));
    }
    return response;
  }).catch(async()=>{
    const cached=await caches.match(event.request);if(cached)return cached;
    if(event.request.mode==='navigate')return caches.match('./');
    return Response.error();
  }));
});