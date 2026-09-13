// NUBEMO recovery 3.98 — bridge Note professionista -> Supabase.
// Step 3B: hydration lazy per paziente; pro.js resta owner della UI.
(() => {
  'use strict';

  const NOTES_KEY = 'diario-pro-notes-recovery-v1';
  const services = window.nubemoProfessionalServices;
  const context = window.nubemoProfessionalContext || {};
  if (!services || !Array.isArray(context.patients)) return;

  const storageProto = Object.getPrototypeOf(window.localStorage);
  const previousSetItem = storageProto.setItem;
  const remoteByPatient = new Map();
  const hydratedPatients = new Set();
  const hydrationPromises = new Map();
  const replayClicks = new WeakSet();
  let queue = Promise.resolve();

  const parse = value => {
    try { const obj = JSON.parse(value || '{}'); return obj && typeof obj === 'object' ? obj : {}; }
    catch (_) { return {}; }
  };

  function report(error) {
    console.error('NUBEMO PRO Supabase sync (note professionista):', error);
    window.dispatchEvent(new CustomEvent('nubemo:supabase-sync-error', {
      detail: { domain: 'note professionista', message: error?.message || String(error) }
    }));
  }

  function patientName(row) {
    const p=row?.profile||{};
    return [p.first_name,p.last_name].filter(Boolean).join(' ').trim()||p.email||'Paziente';
  }

  function inferPatientId() {
    const title=document.querySelector('.patient-global-title')?.textContent||'';
    const match=context.patients.find(p=>title.includes(patientName(p)));
    return match?.id||'';
  }

  function publishPatientNote(patientId, content) {
    const map=parse(window.localStorage.getItem(NOTES_KEY));
    if(content) map[patientId]=content;
    else delete map[patientId];
    previousSetItem.call(window.localStorage, NOTES_KEY, JSON.stringify(map));
  }

  async function ensurePatient(patientId, force=false) {
    if(!patientId) return;
    if(!force && hydratedPatients.has(patientId)) return;
    if(!force && hydrationPromises.has(patientId)) return hydrationPromises.get(patientId);
    const promise=(async()=>{
      const rows=await services.loadProfessionalNotes(patientId);
      const latest=Array.isArray(rows)&&rows.length?rows[0]:null;
      if(latest) remoteByPatient.set(patientId,latest); else remoteByPatient.delete(patientId);
      publishPatientNote(patientId,latest?.content||'');
      hydratedPatients.add(patientId);
    })().finally(()=>hydrationPromises.delete(patientId));
    hydrationPromises.set(patientId,promise);
    return promise;
  }

  async function sync(serialized) {
    const incoming = parse(serialized);
    for (const patientId of Object.keys(incoming)) {
      if(!hydratedPatients.has(patientId)) continue;
      const content = String(incoming[patientId] ?? '');
      const existing = remoteByPatient.get(patientId);
      if (existing) {
        if (String(existing.content || '') === content) continue;
        const updated = await services.updateProfessionalNote(existing.id, content);
        remoteByPatient.set(patientId, updated);
      } else if (content.trim()) {
        const created = await services.createProfessionalNote(patientId, content);
        remoteByPatient.set(patientId, created);
      }
    }
  }

  storageProto.setItem = function(key, value) {
    previousSetItem.call(this, key, value);
    if (this !== window.localStorage || String(key) !== NOTES_KEY) return;
    const serialized = String(value);
    queue = queue.then(() => sync(serialized)).catch(report);
  };

  // Inizializza la chiave virtuale senza interrogare Supabase.
  previousSetItem.call(window.localStorage, NOTES_KEY, '{}');

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-patient-tab="notes"],[data-drawer-tab="notes"]');
    if(!button||replayClicks.has(button)){if(button)replayClicks.delete(button);return;}
    const patientId=inferPatientId();
    if(!patientId||hydratedPatients.has(patientId))return;
    event.preventDefault();event.stopImmediatePropagation();
    void ensurePatient(patientId).then(()=>{replayClicks.add(button);button.click();}).catch(error=>{report(error);replayClicks.add(button);button.click();});
  },true);

  window.nubemoProfessionalNotesBridge = Object.freeze({
    ready: Promise.resolve(),
    ensurePatient,
    refresh: patientId=>ensurePatient(patientId,true),
    flush: async()=>{await Promise.all([...hydrationPromises.values()]);await queue;}
  });
})();
