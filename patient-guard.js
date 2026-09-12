// NUBEMO recovery 3.98 — bootstrap Area Paziente
// Il frontend resta quello 3.98; Supabase gestisce autenticazione e contesto.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const app = document.getElementById('app');
  const logoutButton = document.getElementById('patientLogoutBtn');

  function backToLogin() { window.location.replace('index.html'); }

  function showError(message) {
    if (!app) return;
    app.innerHTML = `<section class="card"><div class="eyebrow">NUBEMO PAZIENTE</div><h1>Accesso non disponibile</h1><p class="muted">${String(message || 'Impossibile aprire l’Area Paziente.')}</p><button class="secondary" id="patientBackLogin" type="button">Torna all'accesso</button></section>`;
    document.getElementById('patientBackLogin')?.addEventListener('click', backToLogin);
  }

  function loadScript(src, errorMessage) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(errorMessage));
      document.body.appendChild(script);
    });
  }

  function loadPatientApp() {
    return loadScript('app.js?v=nubemo398foodcatalog01','Impossibile caricare l’Area Paziente.');
  }

  async function logout() {
    try {
      await window.nubemoPatientDocumentReadBridge?.flush?.();
      await window.nubemoPatientLegacyAdapter?.flush?.();
      await client.auth.signOut();
    } finally { backToLogin(); }
  }

  async function openCurrentPlan(planId = null) {
    const services = window.nubemoPatientServices;
    const context = window.nubemoPatientContext;
    if (!services || !context?.patient?.id) return alert('Piano alimentare non disponibile.');
    try {
      const [docs, plans] = await Promise.all([services.loadDocuments(context.patient.id), services.loadPlans(context.patient.id)]);
      const links = await services.loadPlanDocuments((plans || []).map(p => p.id));
      let documentId = planId;
      if (!documentId) {
        const today = new Date().toISOString().slice(0,10);
        const candidates = (plans || []).filter(p => !p.valid_from || p.valid_from <= today).sort((a,b) => String(b.valid_from || b.created_at || '').localeCompare(String(a.valid_from || a.created_at || '')));
        const current = candidates[0] || (plans || [])[0];
        documentId = (links || []).find(l => l.nutrition_plan_id === current?.id)?.document_id || null;
      }
      const doc = (docs || []).find(d => d.id === documentId);
      if (!doc) return alert('Piano alimentare non disponibile.');
      const url = await services.openDocument(doc);
      if (!url) throw new Error('URL piano non disponibile.');
      await window.nubemoPatientDocumentReadBridge?.markRead?.(documentId);
      window.location.href = url;
    } catch (error) {
      console.error('NUBEMO patient plan open:', error);
      alert('Non riesco ad aprire il piano alimentare.');
    }
  }

  async function bootstrap() {
    try {
      if (!client || !window.nubemoPatientServices || !window.nubemoPatientLegacyAdapter) throw new Error('Servizi di accesso non disponibili.');
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) return backToLogin();

      const context = await window.nubemoPatientServices.loadContext();
      window.nubemoPatientContext = context;
      await window.nubemoPatientLegacyAdapter.init(context);
      await loadScript('patient-settings-supabase-bridge.js?v=nubemo398recovery19','Impossibile applicare le impostazioni dell’Area Paziente.');
      await loadScript('patient-document-read-supabase-bridge.js?v=nubemo398recovery26','Impossibile preparare lo stato di lettura dei documenti.');
      await window.nubemoPatientDocumentReadBridge?.ready;

      if (logoutButton) logoutButton.style.display = 'inline-flex';
      window.patientLogout = logout;

      await loadScript('food-catalog.js?v=nubemo398foodcatalog01','Impossibile caricare il catalogo alimenti.');
      await window.nubemoFoodCatalog.load(client);
      await loadPatientApp();
      await loadScript('patient-measures-pdf.js?v=nubemo398improvement01','Impossibile preparare il PDF delle misurazioni.');
      window.nubemoPatientLegacyAdapter.bindLegacyApp?.();
      await loadScript('patient-recovery-contract.js?v=nubemo398recovery19','Impossibile applicare il contratto dell’Area Paziente.');

      // La dashboard 3.98 apre il piano corrente senza passare un id.
      // Questo resolver mantiene quel contratto ma recupera file e relazione da Supabase.
      window.openPatientPlan = openCurrentPlan;
    } catch (error) {
      console.error('NUBEMO Patient guard:', error);
      showError(error?.message);
    }
  }

  logoutButton?.addEventListener('click', logout);
  bootstrap();
})();
