// NUBEMO — bootstrap Area Paziente pathway-aware
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const app = document.getElementById('app');
  const logoutButton = document.getElementById('patientLogoutBtn');
  const nav = document.querySelector('nav');

  const esc = (value='') => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const backToLogin = () => window.location.replace('index.html');
  const goToPrivacy = () => window.location.replace('privacy.html');
  const hideNav = () => { if (nav) nav.style.display='none'; };
  const showNav = () => { if (nav) nav.style.display=''; };

  function loadScript(src, errorMessage) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(errorMessage));
      document.body.appendChild(script);
    });
  }

  async function loadPatientApp() {
    const response = await fetch('app.js?v=nubemo-pathway20b', { cache:'no-store' });
    if (!response.ok) throw new Error('Impossibile caricare l’Area Paziente.');
    const source = await response.text();
    const legacyStorageToken = 'local' + 'Storage';
    const runtimeSource = source.split(legacyStorageToken).join('window.nubemoPatientRuntimeStore.storage');
    const blobUrl = URL.createObjectURL(new Blob([runtimeSource, '\n//# sourceURL=nubemo-patient-runtime-app.js\n'], {type:'text/javascript'}));
    try {
      await loadScript(blobUrl, 'Impossibile avviare l’Area Paziente.');
    } finally {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }
  }

  function showError(message) {
    hideNav();
    if (!app) return;
    app.innerHTML = `<section class="card"><div class="eyebrow">NUBEMO PAZIENTE</div><h1>Accesso non disponibile</h1><p class="muted">${esc(message || 'Impossibile aprire l’Area Paziente.')}</p><button class="secondary" id="patientBackLogin" type="button">Torna all'accesso</button></section>`;
    document.getElementById('patientBackLogin')?.addEventListener('click', backToLogin);
  }

  function showNoActivePathway() {
    hideNav();
    if (!app) return;
    app.innerHTML = `<section class="card"><div class="eyebrow">NUBEMO PAZIENTE</div><h1>Nessun percorso attivo</h1><p class="muted">Al momento non hai un percorso attivo in NUBEMO. Quando un professionista ti proporrà un nuovo percorso, potrai accettarlo da questa area.</p></section>`;
  }

  async function requiresPrivacyGate(profileId) {
    const {data:doc,error:docError}=await client.from('privacy_documents').select('id').eq('document_type','nubemo').eq('active',true).order('published_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(docError)throw docError;
    if(!doc?.id)return false;
    const {data:acceptance,error:acceptanceError}=await client.from('privacy_acceptances').select('status').eq('profile_id',profileId).eq('privacy_document_id',doc.id).maybeSingle();
    if(acceptanceError)throw acceptanceError;
    return acceptance?.status!=='accepted';
  }

  async function logout() {
    try {
      await window.nubemoPatientDocumentReadBridge?.flush?.();
      await window.nubemoPatientRuntimeStore?.flush?.();
      await client.auth.signOut();
    } finally { backToLogin(); }
  }

  async function openCurrentPlan(planId = null) {
    const services = window.nubemoPatientServices;
    const context = window.nubemoPatientContext;
    if (!services || !context?.activePathway?.id) return alert('Piano alimentare non disponibile.');
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

  async function startActiveArea(context) {
    if (!context?.activePathway?.id) return showNoActivePathway();
    showNav();
    window.nubemoPatientContext = context;
    await window.nubemoPatientRuntimeStore.init(context);
    await loadScript('patient-document-read-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare lo stato di lettura dei documenti.');
    await window.nubemoPatientDocumentReadBridge?.ready;
    if (logoutButton) logoutButton.style.display='inline-flex';
    window.patientLogout = logout;
    await loadScript('food-catalog.js?v=nubemo40clean04','Impossibile caricare il catalogo alimenti.');
    await window.nubemoFoodCatalog.load(client);
    await loadPatientApp();
    await loadScript('patient-measures-pdf.js?v=nubemo40clean04','Impossibile preparare il PDF delle misurazioni.');
    window.nubemoPatientRuntimeStore.bindLegacyApp?.();
    await loadScript('patient-recovery-contract.js?v=nubemo40clean04','Impossibile applicare il contratto dell’Area Paziente.');
    window.openPatientPlan = openCurrentPlan;
  }

  function showPendingPathways(context) {
    hideNav();
    if (!app) return;
    const pending = context.pendingPathways || [];
    const hasCurrent = !!context.activePathway?.id;
    const rows = pending.map(p => `<div class="document-row"><div><b>${esc(p.professional_name || 'Professionista')}</b><span>${p.pathway_start_date ? `Percorso dal ${esc(p.pathway_start_date)}` : 'Nuova proposta di percorso'}</span></div><button class="primary compact" type="button" data-accept-pathway="${esc(p.pathway_id)}">Accetta percorso</button></div>`).join('');
    app.innerHTML = `<section class="card"><div class="eyebrow">NUBEMO PAZIENTE</div><h1>Nuovo percorso proposto</h1><p class="muted">${hasCurrent ? 'Attenzione: accettando una nuova proposta, il percorso attualmente attivo verrà concluso e quello selezionato diventerà il nuovo percorso attivo.' : 'Accettando la proposta, il percorso selezionato diventerà il tuo percorso attivo.'}</p><div class="document-list">${rows}</div>${hasCurrent ? '<div class="head-actions" style="margin-top:16px"><button class="secondary" id="continueCurrentPathway" type="button">Continua con il percorso attuale</button></div>' : ''}</section>`;

    document.querySelectorAll('[data-accept-pathway]').forEach(button => button.addEventListener('click', async () => {
      const pathwayId = button.dataset.acceptPathway;
      if (!pathwayId) return;
      button.disabled = true;
      const oldText = button.textContent;
      button.textContent = 'Attivazione...';
      try {
        await window.nubemoPatientServices.acceptPendingPathway(pathwayId);
        window.location.reload();
      } catch (error) {
        console.error('NUBEMO pathway acceptance:', error);
        alert(error?.message || 'Non è stato possibile attivare il percorso.');
        button.disabled = false;
        button.textContent = oldText;
      }
    }));

    document.getElementById('continueCurrentPathway')?.addEventListener('click', () => startActiveArea(context).catch(error => showError(error?.message)));
  }

  async function bootstrap() {
    try {
      if (!client || !window.nubemoPatientServices || !window.nubemoPatientRuntimeStore) throw new Error('Servizi di accesso non disponibili.');
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) return backToLogin();

      const context = await window.nubemoPatientServices.loadContext();
      if (await requiresPrivacyGate(context.profile.id)) return goToPrivacy();

      if (logoutButton) logoutButton.style.display='inline-flex';
      window.patientLogout = logout;

      if ((context.pendingPathways || []).length) return showPendingPathways(context);
      if (!context.activePathway?.id) return showNoActivePathway();
      await startActiveArea(context);
    } catch (error) {
      console.error('NUBEMO Patient pathway guard:', error);
      showError(error?.message);
    }
  }

  logoutButton?.addEventListener('click', logout);
  bootstrap();
})();
