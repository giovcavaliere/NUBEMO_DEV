const CACHE='nubemo-demo-v4-patient2';
const CORE=[
  './',
  './index.html',
  './patient.html',
  './pro.html',
  './style.css?v=nubemo40patient1',
  './diary-pdf.js?v=nubemo40patient1',
  './patient-services.js?v=nubemo40patient1',
  './patient-app.js?v=nubemo40patient1',
  './patient-measurements.js?v=nubemo40patient1',
  './patient-guard.js?v=nubemo40patient1',
  './monubi-ui.js?v=nubemo40patient1',
  './supabase-client.js?v=nubemo40patient1',
  './manifest.json?v=nubemo40patient1',
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
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
    const copy=response.clone();
    if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
    return response;
  }).catch(async()=>{
    const cached=await caches.match(event.request);
    if(cached)return cached;
    if(event.request.mode==='navigate')return caches.match('./index.html');
    throw new Error('Offline e risorsa non in cache');
  }));
});
