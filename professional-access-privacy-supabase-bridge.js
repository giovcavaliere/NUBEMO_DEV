// NUBEMO 4.0 — Account/Privacy PRO su Supabase.
// Privacy separata in: informativa NUBEMO digitale + modulo del professionista firmato su carta.
(() => {
  'use strict';

  const services = window.nubemoProfessionalServices;
  const client = window.nubemoSupabase;
  const context = window.nubemoProfessionalContext || {};
  const app = document.getElementById('proApp');
  if (!services || !client || !app || !Array.isArray(context.patients)) return;

  let currentPatientId = '';
  let patching = false;
  let accountToken = 0;
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

  function contentSlot(host, domain, patientId) {
    const header = host?.querySelector(':scope > .patient-section-head');
    if (!host || !header) return null;
    [...host.children].forEach(child => { if (child !== header) child.remove(); });
    const slot = document.createElement('div');
    slot.className = 'nubemo-remote-tab-content';
    slot.dataset.domain = domain;
    slot.dataset.patientId = patientId;
    host.appendChild(slot);
    return slot;
  }

  async function invokePatientInviteAction(action, patientId) {
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError || !session?.access_token) throw new Error('Sessione professionista non disponibile.');
    const { data, error } = await client.functions.invoke('patient-invite-status', {
      body:{ action, patient_id:patientId },
      headers:{ Authorization:`Bearer ${session.access_token}` }
    });
    if (error || !data?.ok) throw new Error(data?.error || 'Operazione non completata.');
    return data;
  }

  async function patchAccount() {
    if (document.body.dataset.proView !== 'details' || activeTab() !== 'account') return;
    const row = currentPatient();
    const host = contentHost();
    if (!row || !host) return;
    const existing = host.querySelector(':scope > .nubemo-remote-tab-content[data-domain="account"]');
    if (existing?.dataset.patientId === row.id && existing.dataset.state === 'loaded') return;
    const slot = existing?.dataset.patientId === row.id ? existing : contentSlot(host,'account',row.id);
    if (!slot) return;
    const token = ++accountToken;
    const profile = row.profile || {};
    slot.dataset.state = 'loading';
    slot.innerHTML = `<div class="section-head"><h2>Account paziente</h2><span class="pill">Verifica...</span></div><p class="muted">Controllo stato account NUBEMO.</p>`;

    try {
      const account = await invokePatientInviteAction('check',row.id);
      if (token !== accountToken || activeTab() !== 'account' || currentPatient()?.id !== row.id || !slot.isConnected) return;
      const active = account.account_status === 'active';
      slot.dataset.state = 'loaded';
      slot.innerHTML = `<div class="section-head"><h2>Account paziente</h2><span class="pill">${active ? 'Attivo' : 'Invito da completare'}</span></div>
        <div class="pro-read-grid">
          <div><span>Paziente</span><b>${esc(patientName(row))}</b></div>
          <div><span>Email di accesso</span><b>${esc(account.email || profile.email || '—')}</b></div>
          <div><span>Stato account</span><b>${active ? 'Attivo' : 'Invito da completare'}</b></div>
          <div><span>Stato profilo NUBEMO</span><b>${esc(profile.status || 'active')}</b></div>
        </div>
        ${active ? '' : '<button class="secondary" type="button" data-resend-patient-invite style="margin-top:16px">Reinvia invito</button><p class="muted" data-account-message style="margin-top:10px"></p>'}`;

      const resend = slot.querySelector('[data-resend-patient-invite]');
      const accountMessage = slot.querySelector('[data-account-message]');
      resend?.addEventListener('click',async()=>{
        resend.disabled = true;
        resend.textContent = 'Invio…';
        if (accountMessage) accountMessage.textContent = '';
        try {
          await invokePatientInviteAction('resend',row.id);
          resend.textContent = 'Invito reinviato';
          if (accountMessage) accountMessage.textContent = 'Invito reinviato correttamente.';
        } catch (error) {
          console.error('NUBEMO patient invite resend:',error);
          resend.disabled = false;
          resend.textContent = 'Reinvia invito';
          if (accountMessage) accountMessage.textContent = error?.message || 'Impossibile reinviare l’invito.';
        }
      });
    } catch (error) {
      if (token !== accountToken || !slot.isConnected) return;
      slot.dataset.state = 'error';
      console.error('NUBEMO patient account status:',error);
      slot.innerHTML = `<div class="section-head"><h2>Account paziente</h2><span class="pill">Errore</span></div><p class="muted">Non è stato possibile leggere lo stato dell’account.</p>`;
    }
  }

  async function loadNubemoPrivacy(profileId) {
    const { data: docs, error: docsError } = await client.from('privacy_documents')
      .select('id,document_type,version,title,storage_bucket,storage_path,published_at,active,created_at')
      .eq('document_type','nubemo').eq('active',true)
      .order('published_at',{ascending:false,nullsFirst:false})
      .order('created_at',{ascending:false});
    if (docsError) throw docsError;

    const { data: acc, error: accError } = await client.from('privacy_acceptances')
      .select('id,profile_id,privacy_document_id,status,accepted_at,refused_at,created_at')
      .eq('profile_id',profileId);
    if (accError) throw accError;
    const map = new Map((acc || []).map(row => [row.privacy_document_id,row]));
    return (docs || []).map(doc => ({...doc,acceptance:map.get(doc.id)||null}));
  }

  async function loadProfessionalPrivacy(patientId) {
    const professionalId = context.professional?.id;
    const [{data:templates,error:templateError},{data:signed,error:signedError}] = await Promise.all([
      client.from('professional_privacy_documents')
        .select('id,professional_id,version,original_filename,storage_bucket,storage_path,active,created_at')
        .eq('professional_id',professionalId).eq('active',true)
        .order('created_at',{ascending:false}).limit(1),
      client.from('patient_professional_privacy')
        .select('id,professional_id,patient_id,professional_privacy_document_id,signed_storage_bucket,signed_storage_path,original_filename,uploaded_at,uploaded_by_user_id')
        .eq('professional_id',professionalId).eq('patient_id',patientId)
        .order('uploaded_at',{ascending:false}).limit(1)
    ]);
    if (templateError) throw templateError;
    if (signedError) throw signedError;
    return { template:(templates||[])[0]||null, signed:(signed||[])[0]||null };
  }

  async function openStoredPdf(bucket,path) {
    const popup = window.open('about:blank','_blank');
    try {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path,300);
      if (error || !data?.signedUrl) throw error || new Error('PDF non disponibile');
      if (popup) popup.location.replace(data.signedUrl);
      else window.location.href = data.signedUrl;
    } catch (error) {
      try { popup?.close(); } catch (_) {}
      throw error;
    }
  }

  function nubemoState(acceptance) {
    if (acceptance?.status === 'accepted') return 'Accettata';
    if (acceptance?.status === 'refused') return 'Rifiutata';
    return 'Da accettare';
  }

  async function uploadSignedPrivacy(row, template, file, slot) {
    if (!template) return alert('Carica prima il PDF privacy nel Profilo professionista.');
    if (!file) return;
    if (file.type !== 'application/pdf') return alert('Carica un file PDF.');
    if (file.size > 10 * 1024 * 1024) return alert('Il PDF supera il limite di 10 MB.');

    const professionalId = context.professional?.id;
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return alert('Sessione professionista non disponibile.');
    const path = `professionals/${professionalId}/patients/${row.id}/${crypto.randomUUID()}.pdf`;
    let uploaded = false;
    try {
      const { error: uploadError } = await client.storage.from('privacy-documents')
        .upload(path,file,{contentType:'application/pdf',upsert:false});
      if (uploadError) throw uploadError;
      uploaded = true;

      const { error: insertError } = await client.from('patient_professional_privacy').insert({
        professional_id:professionalId,
        patient_id:row.id,
        professional_privacy_document_id:template.id,
        signed_storage_bucket:'privacy-documents',
        signed_storage_path:path,
        original_filename:file.name || 'privacy-firmata.pdf',
        uploaded_by_user_id:user.id
      });
      if (insertError) throw insertError;

      slot.remove();
      queueMicrotask(patch);
    } catch (error) {
      console.error('NUBEMO signed professional privacy:',error);
      if (uploaded) await client.storage.from('privacy-documents').remove([path]).catch(()=>{});
      alert('Non è stato possibile caricare la privacy firmata.');
    }
  }

  async function patchPrivacy() {
    if (document.body.dataset.proView !== 'details' || activeTab() !== 'privacy') return;
    const row = currentPatient();
    const host = contentHost();
    if (!row || !host) return;
    const existing = host.querySelector(':scope > .nubemo-remote-tab-content[data-domain="privacy"]');
    if (existing?.dataset.patientId === row.id) return;

    const slot = contentSlot(host,'privacy',row.id);
    if (!slot) return;
    const token = ++privacyToken;
    slot.dataset.state = 'loading';
    slot.innerHTML = `<div class="section-head"><h2>Privacy</h2><span class="pill">Verifica...</span></div><p class="muted">Caricamento stato privacy.</p>`;

    try {
      const [nubemoDocs, professionalPrivacy] = await Promise.all([
        loadNubemoPrivacy(row.profile_id),
        loadProfessionalPrivacy(row.id)
      ]);
      if (token !== privacyToken || activeTab() !== 'privacy' || currentPatient()?.id !== row.id || !slot.isConnected) return;

      const nubemo = nubemoDocs[0] || null;
      const nubemoAcceptance = nubemo?.acceptance || null;
      const template = professionalPrivacy.template;
      const signed = professionalPrivacy.signed;
      const overall = nubemo && nubemoAcceptance?.status === 'accepted' && signed ? 'Completa' : 'Da completare';

      slot.dataset.state = 'loaded';
      slot.innerHTML = `
        <div class="section-head"><h2>Privacy</h2><span class="pill">${overall}</span></div>

        <div class="card" style="margin-top:16px">
          <div class="section-head"><h2>Privacy NUBEMO</h2><span class="pill">${nubemo ? nubemoState(nubemoAcceptance) : 'Nessuna informativa'}</span></div>
          ${nubemo ? `
            <div class="pro-read-grid">
              <div><span>Informativa</span><b>${esc(nubemo.title || 'Informativa privacy NUBEMO')}</b></div>
              <div><span>Versione</span><b>${esc(nubemo.version || '—')}</b></div>
              <div><span>Stato</span><b>${nubemoState(nubemoAcceptance)}</b></div>
              <div><span>Data accettazione</span><b>${nubemoAcceptance?.accepted_at ? new Date(nubemoAcceptance.accepted_at).toLocaleDateString('it-IT') : '—'}</b></div>
            </div>
            <button class="secondary compact" type="button" data-open-nubemo-privacy style="margin-top:16px">Apri informativa</button>`
          : '<p class="muted">Nessuna informativa privacy NUBEMO attiva è stata ancora pubblicata.</p>'}
        </div>

        <div class="card" style="margin-top:16px">
          <div class="section-head"><h2>Privacy professionista</h2><span class="pill">${signed ? 'Caricata' : 'Da acquisire'}</span></div>
          ${template ? `<p class="muted">Modulo attivo: <b>${esc(template.original_filename)}</b></p>` : '<p class="muted">Nessun PDF privacy è stato ancora caricato nel Profilo professionista.</p>'}
          ${signed ? `<div class="pro-read-grid" style="margin-top:14px"><div><span>Documento firmato</span><b>${esc(signed.original_filename)}</b></div><div><span>Caricato</span><b>${new Date(signed.uploaded_at).toLocaleDateString('it-IT')}</b></div></div>` : ''}
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
            <button class="secondary" type="button" data-print-professional-privacy ${template?'':'disabled'}>Stampa privacy</button>
            ${signed ? '<button class="secondary" type="button" data-open-signed-professional-privacy>Apri privacy firmata</button>' : ''}
            <label class="secondary file-button" ${template?'':'aria-disabled="true" style="opacity:.55;pointer-events:none"'}>Carica privacy firmata<input type="file" data-upload-signed-professional-privacy accept="application/pdf" hidden ${template?'':'disabled'}></label>
          </div>
        </div>`;

      slot.querySelector('[data-open-nubemo-privacy]')?.addEventListener('click',async()=>{
        try { await openStoredPdf(nubemo.storage_bucket,nubemo.storage_path); }
        catch (error) { console.error('NUBEMO privacy open:',error); alert('Non riesco ad aprire l’informativa NUBEMO.'); }
      });

      slot.querySelector('[data-print-professional-privacy]')?.addEventListener('click',async()=>{
        if (!template) return;
        try { await openStoredPdf(template.storage_bucket,template.storage_path); }
        catch (error) { console.error('Professional privacy print:',error); alert('Non riesco ad aprire il PDF privacy del professionista.'); }
      });

      slot.querySelector('[data-open-signed-professional-privacy]')?.addEventListener('click',async()=>{
        if (!signed) return;
        try { await openStoredPdf(signed.signed_storage_bucket,signed.signed_storage_path); }
        catch (error) { console.error('Signed privacy open:',error); alert('Non riesco ad aprire la privacy firmata.'); }
      });

      const signedInput = slot.querySelector('[data-upload-signed-professional-privacy]');
      signedInput?.addEventListener('change',()=>{
        const file = signedInput.files?.[0];
        if (file) void uploadSignedPrivacy(row,template,file,slot);
      });
    } catch (error) {
      if (token !== privacyToken || !slot.isConnected) return;
      slot.dataset.state = 'error';
      console.error('NUBEMO PRO privacy status:',error);
      slot.innerHTML = `<div class="section-head"><h2>Privacy</h2><span class="pill">Errore</span></div><p class="muted">Non è stato possibile leggere lo stato privacy del paziente.</p>`;
    }
  }

  function patch() {
    if (patching) return;
    patching = true;
    try {
      if (activeTab() === 'account') void patchAccount();
      if (activeTab() === 'privacy') void patchPrivacy();
    } finally { patching = false; }
  }

  const retiredLocalActions = new Set([
    'savePatientAccount','deletePatientAccount','downloadPrivacyForm',
    'uploadSignedPrivacy','signedPrivacyFile','openSignedPrivacy'
  ]);

  document.addEventListener('click', event => {
    remember(event.target);
    const retired = event.target?.closest?.('[id]');
    if (retired && retiredLocalActions.has(retired.id)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      queueMicrotask(patch);
      return;
    }
    if (event.target?.closest?.('[data-patient-tab]')) queueMicrotask(patch);
  },true);

  document.addEventListener('change', event => {
    if (event.target?.id === 'signedPrivacyFile') {
      event.preventDefault();
      event.stopImmediatePropagation();
      queueMicrotask(patch);
    }
  },true);

  const observer = new MutationObserver(() => queueMicrotask(patch));
  observer.observe(app,{childList:true,subtree:true});
  patch();

  window.nubemoProfessionalAccessPrivacyBridge = Object.freeze({patch});
})();
