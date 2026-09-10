// NUBEMO recovery 3.98 — Account/Privacy PRO su Supabase.
// Conserva tab e struttura 3.98; sostituisce esclusivamente i contenuti che
// dipendevano da credenziali demo locali e PDF privacy locali.
(() => {
  'use strict';

  const services = window.nubemoProfessionalServices;
  const context = window.nubemoProfessionalContext || {};
  const app = document.getElementById('proApp');
  if (!services || !app || !Array.isArray(context.patients)) return;

  let currentPatientId = '';
  let patching = false;
  let privacyToken = 0;

  const esc = (value='') => String(value)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');

  function patientName(row) {
    const p = row?.profile || {};
    return [p.first_name,p.last_name].filter(Boolean).join(' ').trim() || p.email || 'Paziente';
  }

  function remember(target) {
    const patientButton = target?.closest?.('[data-patient]');
    if (patientButton?.dataset?.patient) currentPatientId = patientButton.dataset.patient;
    const drawerPatient = target?.closest?.('[data-drawer-patient]');
    if (drawerPatient?.dataset?.drawerPatient) currentPatientId = drawerPatient.dataset.drawerPatient;
  }

  function currentPatient() {
    if (currentPatientId) {
      const row = context.patients.find(p => p.id === currentPatientId);
      if (row) return row;
    }
    if (document.body.dataset.proView !== 'details') return null;
    const title = document.querySelector('.patient-global-title')?.textContent || '';
    const row = context.patients.find(p => title.includes(patientName(p))) || null;
    if (row) currentPatientId = row.id;
    return row;
  }

  function activeTab() {
    return document.querySelector('[data-patient-tab].active')?.dataset?.patientTab || '';
  }

  function contentHost() {
    return document.querySelector('.patient-content-card');
  }

  function patchAccount() {
    if (document.body.dataset.proView !== 'details' || activeTab() !== 'account') return;
    const row = currentPatient();
    const host = contentHost();
    if (!row || !host || host.dataset.supabaseAccount === row.id) return;
    const profile = row.profile || {};
    host.dataset.supabaseAccount = row.id;
    host.innerHTML = `<div class="section-head"><h2>Account paziente</h2><span class="pill">${profile.status === 'active' ? 'Attivo' : esc(profile.status || 'Attivo')}</span></div>
      <p class="muted">L’accesso all’Area Paziente è gestito da NUBEMO tramite Supabase Auth. Non vengono più create o conservate password demo locali.</p>
      <div class="pro-read-grid">
        <div><span>Paziente</span><b>${esc(patientName(row))}</b></div>
        <div><span>Email di accesso</span><b>${esc(profile.email || '—')}</b></div>
        <div><span>Stato profilo</span><b>${esc(profile.status || 'active')}</b></div>
        <div><span>Gestione credenziali</span><b>Supabase Auth</b></div>
      </div>`;
  }

  async function patchPrivacy() {
    if (document.body.dataset.proView !== 'details' || activeTab() !== 'privacy') return;
    const row = currentPatient();
    const host = contentHost();
    if (!row || !host) return;
    const token = ++privacyToken;
    host.dataset.supabasePrivacy = row.id;
    host.innerHTML = `<div class="section-head"><h2>Privacy</h2><span class="pill">Verifica...</span></div><p class="muted">Caricamento stato informativa.</p>`;
    try {
      const docs = await services.loadPrivacyStatus(row.profile_id);
      if (token !== privacyToken || activeTab() !== 'privacy' || currentPatient()?.id !== row.id) return;
      const accepted = docs.filter(d => !!d.acceptance).length;
      host.innerHTML = `<div class="section-head"><h2>Privacy</h2><span class="pill">${docs.length ? `${accepted}/${docs.length} accettate` : 'Nessuna informativa'}</span></div>
        <p class="muted">Le informative ufficiali sono pubblicate centralmente da NUBEMO. Il professionista consulta lo stato di accettazione del paziente.</p>
        ${docs.length ? `<div class="document-list">${docs.map(d => `<div class="document-row"><div><b>${esc(d.title || 'Informativa privacy')}</b><span>Versione ${esc(d.version || '—')} · ${d.acceptance ? `Accettata ${d.acceptance.accepted_at ? new Date(d.acceptance.accepted_at).toLocaleDateString('it-IT') : ''}` : 'Da accettare'}</span></div><button class="secondary compact" type="button" data-open-official-privacy="${d.id}">Apri</button></div>`).join('')}</div>` : '<p class="muted">Nessuna informativa privacy attiva è stata ancora pubblicata.</p>'}`;
      host.querySelectorAll('[data-open-official-privacy]').forEach(button => button.addEventListener('click', async () => {
        const doc = docs.find(d => d.id === button.dataset.openOfficialPrivacy);
        if (!doc) return;
        try {
          const url = await services.openDocumentUrl(doc, 300);
          if (!url) throw new Error('URL informativa non disponibile');
          window.open(url, '_blank', 'noopener');
        } catch (error) {
          console.error('NUBEMO PRO privacy open:', error);
          alert('Non riesco ad aprire l’informativa privacy.');
        }
      }));
    } catch (error) {
      if (token !== privacyToken) return;
      console.error('NUBEMO PRO privacy status:', error);
      host.innerHTML = `<div class="section-head"><h2>Privacy</h2><span class="pill">Errore</span></div><p class="muted">Non è stato possibile leggere lo stato privacy del paziente.</p>`;
    }
  }

  function patch() {
    if (patching) return;
    patching = true;
    try {
      patchAccount();
      if (activeTab() === 'privacy') void patchPrivacy();
    } finally { patching = false; }
  }

  document.addEventListener('click', event => {
    remember(event.target);
    const tab = event.target?.closest?.('[data-patient-tab]');
    if (tab) queueMicrotask(patch);
  }, true);

  const observer = new MutationObserver(() => queueMicrotask(patch));
  observer.observe(app, {childList:true, subtree:true});
  patch();

  window.nubemoProfessionalAccessPrivacyBridge = Object.freeze({ patch });
})();
