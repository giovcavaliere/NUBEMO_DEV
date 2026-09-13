// NUBEMO recovery 3.98 — bootstrap Area Professionista
// Il frontend resta quello 3.98; Supabase è il livello dati/infrastruttura.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const app = document.getElementById('proApp');
  const logoutButton = document.getElementById('proLogoutBtn');

  function showGuardError(message) {
    if (!app) return;
    app.innerHTML = `<section class="card"><div class="eyebrow">NUBEMO PROFESSIONAL</div><h1>Accesso non consentito</h1><p>${message}</p><a href="./index.html">Torna al login</a></section>`;
  }
  function redirectToLogin() { window.location.replace('index.html'); }
  function redirectToPrivacy() { window.location.replace('privacy.html'); }
  function loadScript(src, errorMessage) { return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error(errorMessage));document.body.appendChild(script);}); }

  async function requiresPrivacyGate(profileId) {
    const {data:doc,error:docError}=await client.from('privacy_documents')
      .select('id').eq('document_type','nubemo').eq('active',true)
      .order('published_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false})
      .limit(1).maybeSingle();
    if(docError)throw docError;
    if(!doc?.id)return false;
    const {data:acceptance,error:acceptanceError}=await client.from('privacy_acceptances')
      .select('status').eq('profile_id',profileId).eq('privacy_document_id',doc.id).maybeSingle();
    if(acceptanceError)throw acceptanceError;
    return acceptance?.status!=='accepted';
  }

  async function logout() {
    if (logoutButton) logoutButton.disabled = true;
    try {
      await window.nubemoProfessionalNotesBridge?.flush?.();
      await window.nubemoProfessionalSettingsBridge?.flush?.();
      await window.nubemoProfessionalPatientSettingsBridge?.flush?.();
      await window.nubemoProfessionalDocumentReadBridge?.flush?.();
      await window.nubemoProfessionalLabsBridge?.flush?.();
      await window.nubemoProfessionalLegacyAdapter?.flush?.();
      await client.auth.signOut();
    } finally { redirectToLogin(); }
  }
  window.nubemoProfessionalLogout = logout;
  logoutButton?.addEventListener('click', logout);

  async function authorize() {
    try {
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError || !session) return redirectToLogin();
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) return redirectToLogin();
      const { data: profile, error: profileError } = await client.from('profiles').select('id,auth_user_id,role,status,first_name,last_name,email').eq('auth_user_id', user.id).single();
      if (profileError || !profile) { showGuardError('Profilo NUBEMO non disponibile per questo account.'); setTimeout(redirectToLogin,900); return; }
      if (profile.role !== 'professional' || profile.status !== 'active') return redirectToLogin();
      if (await requiresPrivacyGate(profile.id)) return redirectToPrivacy();
      const { data: professional, error: professionalError } = await client.from('professionals').select('id,profile_id,status,qualification,display_name,tax_code,vat_number,phone,address,zip,city,province,logo_storage_path').eq('profile_id', profile.id).maybeSingle();
      if (professionalError || !professional) { showGuardError('Profilo professionale NUBEMO non disponibile.'); return; }

      let logoData='';
      if(professional.logo_storage_path){try{const {data:logoBlob,error:logoError}=await client.storage.from('professional-assets').download(professional.logo_storage_path);if(logoError)throw logoError;logoData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('Logo non leggibile'));reader.readAsDataURL(logoBlob);});}catch(logoError){console.error('NUBEMO professional logo load:',logoError);}}

      await loadScript('professional-services.js?v=nubemo398recovery19','Impossibile caricare i servizi Supabase dell’Area Professionista.');
      const services=window.nubemoProfessionalServices;if(!services)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      const loaded=await services.loadPatients(professional.id);
      window.nubemoProfessionalContext={user,profile,professional,logoData,patients:loaded.activePatients,endedPatients:loaded.endedPatients};
      window.nubemoReloadProfessionalPatients=async()=>{const loadedPatients=await services.loadPatients(professional.id);window.nubemoProfessionalContext.patients=loadedPatients.activePatients;window.nubemoProfessionalContext.endedPatients=loadedPatients.endedPatients;return loadedPatients.activePatients;};

      await loadScript('professional-legacy-supabase-adapter.js?v=nubemo398recovery19','Impossibile preparare i dati dell’Area Professionista.');
      if(!window.nubemoProfessionalLegacyAdapter)throw new Error('Adattatore dati PRO non inizializzato.');
      await window.nubemoProfessionalLegacyAdapter.init(window.nubemoProfessionalContext);
      await loadScript('professional-recovery-contract.js?v=nubemo398recovery21','Impossibile applicare il contratto runtime dell’Area Professionista.');
      await loadScript('professional-patient-settings-supabase-bridge.js?v=nubemo398recovery19','Impossibile preparare le impostazioni dell’Area Paziente.');await window.nubemoProfessionalPatientSettingsBridge?.ready;
      await loadScript('professional-settings-supabase-bridge.js?v=nubemo398recovery19','Impossibile preparare le impostazioni del professionista.');await window.nubemoProfessionalSettingsBridge?.ready;
      await loadScript('professional-notes-supabase-bridge.js?v=nubemo398recovery19','Impossibile preparare le note del professionista.');await window.nubemoProfessionalNotesBridge?.ready;
      await loadScript('professional-documents-supabase-bridge.js?v=nubemo398improvement06','Impossibile preparare i documenti del paziente.');await window.nubemoProfessionalDocumentsBridge?.ready;
      await loadScript('professional-document-read-supabase-bridge.js?v=nubemo398recovery26','Impossibile preparare lo stato di lettura dei documenti.');await window.nubemoProfessionalDocumentReadBridge?.ready;
      await loadScript('professional-plans-supabase-bridge.js?v=nubemo398recovery19','Impossibile preparare i piani alimentari.');await window.nubemoProfessionalPlansBridge?.ready;
      await loadScript('professional-labs-supabase-bridge.js?v=nubemo398improvement06','Impossibile preparare gli esami del paziente.');await window.nubemoProfessionalLabsBridge?.ready;
      if(logoutButton)logoutButton.style.display='inline-flex';
      await loadScript('food-catalog.js?v=nubemo398foodcatalog01','Impossibile caricare il catalogo alimenti.');
      await window.nubemoFoodCatalog.load(client);
      await loadScript('pro.js?v=nubemo398patientmenu01','Impossibile caricare l’Area Professionista.');
      await loadScript('professional-patient-management.js?v=nubemo398recovery21','Impossibile caricare la gestione dei pazienti.');
      await loadScript('professional-access-privacy-supabase-bridge.js?v=nubemo40privacy01','Impossibile caricare Account e Privacy del paziente.');
      await loadScript('professional-profile-privacy-supabase-bridge.js?v=nubemo40privacy02','Impossibile caricare il PDF privacy del professionista.');
    } catch(error){console.error('NUBEMO Professional guard:',error);showGuardError('Non è stato possibile verificare l’accesso. Torna al login e riprova.');}
  }
  authorize();
})();
