const CACHE='nubemo-demo-v3.98-recovery13';
const CORE=[
  './',
  './index.html',
  './patient.html',
  './pro.html',
  './style.css?v=nubemo398recovery13',
  './diary-pdf.js?v=nubemo398recovery13',
  './app.js?v=nubemo398recovery13',
  './pro.js?v=nubemo398recovery13',
  './monubi-ui.js?v=nubemo398recovery13',
  './supabase-client.js?v=nubemo398recovery13',
  './auth.js?v=nubemo398recovery13',
  './patient-services.js?v=nubemo398recovery13',
  './patient-legacy-supabase-adapter.js?v=nubemo398recovery13',
  './patient-guard.js?v=nubemo398recovery13',
  './professional-services.js?v=nubemo398recovery13',
  './professional-legacy-supabase-adapter.js?v=nubemo398recovery13',
  './professional-settings-supabase-bridge.js?v=nubemo398recovery13',
  './professional-notes-supabase-bridge.js?v=nubemo398recovery13',
  './professional-documents-supabase-bridge.js?v=nubemo398recovery13',
  './professional-plans-supabase-bridge.js?v=nubemo398recovery13',
  './professional-patient-management.js?v=nubemo398recovery13',
  './professional-access-privacy-supabase-bridge.js?v=nubemo398recovery13',
  './professional-guard.js?v=nubemo398recovery13',
  './manifest.json?v=nubemo398recovery13',
  './assets/nubemo-brand-clean-v2.png',
  './assets/nubemo-n-icon-180.png',
  './assets/nubemo-n-icon-192.png',
  './assets/nubemo-n-icon-512.png'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(
    fetch(event.request,{cache:'no-store'})
      .then(response=>{
        const copy=response.clone();
        if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
        return response;
      })
      .catch(async()=>{
        const cached=await caches.match(event.request);
        if(cached)return cached;
        if(event.request.mode==='navigate')return caches.match('./index.html');
        throw new Error('Offline e risorsa non in cache');
      })
  );
});
