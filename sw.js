const CACHE='nubemo-demo-v3.98-recovery24';
const CORE=[
  './',
  './index.html',
  './patient.html',
  './pro.html',
  './style.css?v=nubemo398recovery19',
  './diary-pdf.js?v=nubemo398recovery19',
  './app.js?v=nubemo398recovery19',
  './pro.js?v=nubemo398recovery19',
  './monubi-ui.js?v=nubemo398recovery19',
  './supabase-client.js?v=nubemo398recovery19',
  './auth.js?v=nubemo398recovery19',
  './patient-services.js?v=nubemo398recovery24',
  './patient-labs-supabase-bridge.js?v=nubemo398recovery19',
  './patient-legacy-supabase-adapter.js?v=nubemo398recovery23',
  './patient-settings-supabase-bridge.js?v=nubemo398recovery19',
  './patient-document-read-supabase-bridge.js?v=nubemo398recovery19',
  './patient-recovery-contract.js?v=nubemo398recovery19',
  './patient-guard.js?v=nubemo398recovery19',
  './professional-services.js?v=nubemo398recovery19',
  './professional-legacy-supabase-adapter.js?v=nubemo398recovery19',
  './professional-recovery-contract.js?v=nubemo398recovery21',
  './professional-patient-settings-supabase-bridge.js?v=nubemo398recovery19',
  './professional-settings-supabase-bridge.js?v=nubemo398recovery19',
  './professional-notes-supabase-bridge.js?v=nubemo398recovery19',
  './professional-documents-supabase-bridge.js?v=nubemo398recovery19',
  './professional-document-read-supabase-bridge.js?v=nubemo398recovery19',
  './professional-plans-supabase-bridge.js?v=nubemo398recovery19',
  './professional-labs-supabase-bridge.js?v=nubemo398recovery19',
  './professional-patient-management.js?v=nubemo398recovery21',
  './professional-access-privacy-supabase-bridge.js?v=nubemo398recovery22',
  './professional-guard.js?v=nubemo398recovery22',
  './manifest.json?v=nubemo398recovery19',
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