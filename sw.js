const CACHE='nubemo-demo-v4.0-clean02';
const CORE=[
  './storage-bridge-kit.js?v=nubemo40clean02',
  './food-catalog.js?v=nubemo40clean02',
  './',
  './index.html',
  './privacy.html',
  './patient.html',
  './pro.html',
  './style.css?v=nubemo40clean02',
  './professional-responsive-fix.css?v=nubemo40clean02',
  './diary-pdf.js?v=nubemo40clean02',
  './app.js?v=nubemo40clean02',
  './pro.js?v=nubemo40clean02',
  './monubi-ui.js?v=nubemo40clean02',
  './supabase-client.js?v=nubemo40clean02',
  './password-visibility.js?v=nubemo40clean02',
  './nubemo-support.js?v=nubemo40clean02',
  './pro-profile.js?v=nubemo40clean02',
  './auth.js?v=nubemo40clean02',
  './privacy.js?v=nubemo40clean02',
  './patient-services.js?v=nubemo40clean02',
  './patient-labs-supabase-bridge.js?v=nubemo40clean02',
  './patient-legacy-supabase-adapter.js?v=nubemo40clean02',
  './patient-diary-calorie-persistence-bridge.js?v=nubemo40clean02',
  './patient-settings-supabase-bridge.js?v=nubemo40clean02',
  './patient-document-read-supabase-bridge.js?v=nubemo40clean02',
  './patient-recovery-contract.js?v=nubemo40clean02',
  './patient-guard.js?v=nubemo40clean02',
  './patient-measures-pdf.js?v=nubemo40clean02',
  './pdf-open-recovery-bridge.js?v=nubemo40clean02',
  './professional-dashboard-bootstrap.js?v=nubemo40clean02',
  './professional-patient-summary-lazy.js?v=nubemo40clean02',
  './professional-services.js?v=nubemo40clean02',
  './professional-diary-calorie-supabase-bridge.js?v=nubemo40clean02',
  './professional-patient-diary-lazy.js?v=nubemo40clean02',
  './professional-patient-trend-lazy.js?v=nubemo40clean02',
  './professional-measures-supabase-bridge.js?v=nubemo40clean02',
  './professional-visits-supabase-bridge.js?v=nubemo40clean02',
  './professional-agenda-supabase-bridge.js?v=nubemo40clean02',
  './professional-patient-edit-lazy.js?v=nubemo40clean02',
  './professional-pathway-lazy.js?v=nubemo40clean02',
  './professional-new-patient-lazy.js?v=nubemo40clean02',
  './professional-patient-list-freshness.js?v=nubemo40clean02',
  './professional-legacy-supabase-adapter.js?v=nubemo40clean02',
  './professional-patient-lifecycle-bridge.js?v=nubemo40clean02',
  './professional-recovery-contract.js?v=nubemo40clean02',
  './professional-patient-settings-supabase-bridge.js?v=nubemo40clean02',
  './professional-settings-supabase-bridge.js?v=nubemo40clean02',
  './professional-notes-supabase-bridge.js?v=nubemo40clean02',
  './professional-documents-supabase-bridge.js?v=nubemo40clean02',
  './professional-document-read-supabase-bridge.js?v=nubemo40clean02',
  './professional-plans-supabase-bridge.js?v=nubemo40clean02',
  './professional-labs-supabase-bridge.js?v=nubemo40clean02',
  './professional-patient-management.js?v=nubemo40clean02',
  './professional-patient-invite-guard.js?v=nubemo40clean02',
  './professional-bmi-dashboard-fix.js?v=nubemo40clean02',
  './professional-access-privacy-supabase-bridge.js?v=nubemo40clean02',
  './professional-profile-privacy-supabase-bridge.js?v=nubemo40clean02',
  './professional-guard.js?v=nubemo40clean02',
  './manifest.json?v=nubemo40clean02',
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
  if(new URL(event.request.url).pathname==='/rest/v1/food_catalog')return;
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