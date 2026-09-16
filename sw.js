const CACHE='nubemo-demo-v4.0-profilo01';
const CORE=[
  './storage-bridge-kit.js?v=nubemo40clean01',
  './food-catalog.js?v=nubemo40clean01',
  './',
  './index.html',
  './privacy.html',
  './patient.html',
  './pro.html',
  './style.css?v=nubemo40clean01',
  './professional-responsive-fix.css?v=nubemo40clean01',
  './diary-pdf.js?v=nubemo40clean01',
  './app.js?v=nubemo40clean01',
  './pro.js?v=nubemo40clean01',
  './monubi-ui.js?v=nubemo40clean01',
  './supabase-client.js?v=nubemo40clean01',
  './password-visibility.js?v=nubemo40clean01',
  './nubemo-support.js?v=nubemo40clean01',
  './pro-profile.js?v=nubemo40clean01',
  './auth.js?v=nubemo40clean01',
  './privacy.js?v=nubemo40clean01',
  './patient-services.js?v=nubemo40clean01',
  './patient-labs-supabase-bridge.js?v=nubemo40clean01',
  './patient-legacy-supabase-adapter.js?v=nubemo40clean01',
  './patient-diary-calorie-persistence-bridge.js?v=nubemo40clean01',
  './patient-settings-supabase-bridge.js?v=nubemo40clean01',
  './patient-document-read-supabase-bridge.js?v=nubemo40clean01',
  './patient-recovery-contract.js?v=nubemo40clean01',
  './patient-guard.js?v=nubemo40clean01',
  './patient-measures-pdf.js?v=nubemo40clean01',
  './pdf-open-recovery-bridge.js?v=nubemo40clean01',
  './professional-dashboard-bootstrap.js?v=nubemo40clean01',
  './professional-patient-summary-lazy.js?v=nubemo40clean01',
  './professional-services.js?v=nubemo40clean01',
  './professional-diary-calorie-supabase-bridge.js?v=nubemo40clean01',
  './professional-patient-diary-lazy.js?v=nubemo40clean01',
  './professional-patient-trend-lazy.js?v=nubemo40clean01',
  './professional-measures-supabase-bridge.js?v=nubemo40clean01',
  './professional-visits-supabase-bridge.js?v=nubemo40clean01',
  './professional-agenda-supabase-bridge.js?v=nubemo40clean01',
  './professional-patient-edit-lazy.js?v=nubemo40clean01',
  './professional-pathway-lazy.js?v=nubemo40clean01',
  './professional-new-patient-lazy.js?v=nubemo40clean01',
  './professional-patient-list-freshness.js?v=nubemo40clean01',
  './professional-legacy-supabase-adapter.js?v=nubemo40clean01',
  './professional-patient-lifecycle-bridge.js?v=nubemo40clean01',
  './professional-recovery-contract.js?v=nubemo40clean01',
  './professional-patient-settings-supabase-bridge.js?v=nubemo40clean01',
  './professional-settings-supabase-bridge.js?v=nubemo40clean01',
  './professional-notes-supabase-bridge.js?v=nubemo40clean01',
  './professional-documents-supabase-bridge.js?v=nubemo40clean01',
  './professional-document-read-supabase-bridge.js?v=nubemo40clean01',
  './professional-plans-supabase-bridge.js?v=nubemo40clean01',
  './professional-labs-supabase-bridge.js?v=nubemo40clean01',
  './professional-patient-management.js?v=nubemo40clean01',
  './professional-patient-invite-guard.js?v=nubemo40clean01',
  './professional-bmi-dashboard-fix.js?v=nubemo40clean01',
  './professional-access-privacy-supabase-bridge.js?v=nubemo40clean01',
  './professional-profile-privacy-supabase-bridge.js?v=nubemo40clean01',
  './professional-guard.js?v=nubemo40clean01',
  './manifest.json?v=nubemo40clean01',
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