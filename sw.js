const CACHE='nubemo-demo-v4.0-pathway19fix1';
const CORE=[
  './storage-bridge-kit.js?v=nubemo40clean04',
  './food-catalog.js?v=nubemo40clean04',
  './',
  './index.html',
  './privacy.html',
  './patient.html',
  './pro.html',
  './style.css?v=nubemo40clean04',
  './professional-responsive-fix.css?v=nubemo40clean04',
  './diary-pdf.js?v=nubemo40clean04',
  './app.js?v=nubemo40clean04',
  './pro.js?v=nubemo40clean04',
  './monubi-ui.js?v=nubemo40clean04',
  './config.js?v=nubemo-env-20260919',
  './supabase-client.js?v=nubemo-env-20260919',
  './password-visibility.js?v=nubemo40clean04',
  './nubemo-support.js?v=nubemo40clean04',
  './pro-profile.js?v=nubemo40clean04',
  './auth.js?v=nubemo40clean04',
  './privacy.js?v=nubemo40clean04',
  './patient-services.js?v=nubemo-pathway16',
  './patient-storage-pathway-bridge.js?v=nubemo-pathway18',
  './patient-labs-supabase-bridge.js?v=nubemo40clean04',
  './patient-legacy-supabase-adapter.js?v=nubemo40clean04',
  './patient-diary-calorie-persistence-bridge.js?v=nubemo-pathway16',
  './patient-settings-supabase-bridge.js?v=nubemo40clean04',
  './patient-document-read-supabase-bridge.js?v=nubemo40clean04',
  './patient-recovery-contract.js?v=nubemo40clean04',
  './patient-pathway-guard.js?v=nubemo-pathway16',
  './patient-measures-pdf.js?v=nubemo40clean04',
  './pdf-open-recovery-bridge.js?v=nubemo40clean04',
  './professional-storage-pathway-bridge.js?v=nubemo-pathway18',
  './professional-dashboard-bootstrap.js?v=nubemo40clean04',
  './professional-patient-summary-lazy.js?v=nubemo40clean04',
  './professional-services.js?v=nubemo40clean04',
  './professional-diary-calorie-supabase-bridge.js?v=nubemo40clean04',
  './professional-patient-diary-lazy.js?v=nubemo40clean04',
  './professional-patient-trend-lazy.js?v=nubemo40clean04',
  './professional-measures-supabase-bridge.js?v=nubemo40clean04',
  './professional-visits-supabase-bridge.js?v=nubemo40clean04',
  './professional-agenda-supabase-bridge.js?v=nubemo40clean04',
  './professional-patient-edit-lazy.js?v=nubemo40clean04',
  './professional-pathway-lazy.js?v=nubemo-pathway17',
  './professional-pathway-history.js?v=nubemo-pathway19fix1',
  './professional-patient-groups.js?v=nubemo-pathway19test1',
  './professional-new-patient-lazy.js?v=nubemo40clean04',
  './professional-patient-list-freshness.js?v=nubemo40clean04draftfix1',
  './professional-legacy-supabase-adapter.js?v=nubemo40clean04',
  './professional-patient-lifecycle-bridge.js?v=nubemo40clean04draftfix1',
  './professional-recovery-contract.js?v=nubemo40clean04',
  './professional-patient-settings-supabase-bridge.js?v=nubemo40clean04',
  './professional-settings-supabase-bridge.js?v=nubemo40clean04',
  './professional-notes-supabase-bridge.js?v=nubemo40clean04',
  './professional-documents-supabase-bridge.js?v=nubemo40clean04',
  './professional-document-read-supabase-bridge.js?v=nubemo40clean04',
  './professional-plans-supabase-bridge.js?v=nubemo40clean04',
  './professional-labs-supabase-bridge.js?v=nubemo40clean04',
  './professional-patient-management.js?v=nubemo40clean04',
  './professional-patient-invite-guard.js?v=nubemo40clean04',
  './professional-bmi-dashboard-fix.js?v=nubemo40clean04',
  './professional-access-privacy-supabase-bridge.js?v=nubemo40clean04',
  './professional-profile-privacy-supabase-bridge.js?v=nubemo40clean04',
  './professional-guard.js?v=nubemo40clean04',
  './manifest.json?v=nubemo40clean04',
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