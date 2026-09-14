// NUBEMO recovery 3.98 — bootstrap Area Professionista
// Step 3C: calorie Diario lette da valori persistiti; nessun catalogo alimenti nel bootstrap PRO.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  const app=document.getElementById('proApp');
  const logoutButton=document.getElementById('proLogoutBtn');

  function showGuardError(message){if(!app)return;app.innerHTML=`<section class="card"><div class="eyebrow">NUBEMO PROFESSIONAL</div><h1>Accesso non consentito</h1><p>${message}</p><a href="./index.html">Torna al login</a></section>`;}
  function redirectToLogin(){window.location.replace('index.html');}
  function redirectToPrivacy(){window.location.replace('privacy.html');}
  function loadScript(src,errorMessage){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error(errorMessage));document.body.appendChild(script);});}
  function perfStart(label){return{label,startedAt:performance.now()};}
  function perfEnd(timer){const ms=Math.round(performance.now()-timer.startedAt);console.log(`[NUBEMO PERF] ${timer.label}: ${ms} ms`);return ms;}

  let professionalLogoPromise=null;
  async function ensureProfessionalLogoLoaded(){
    const ctx=window.nubemoProfessionalContext;
    const path=ctx?.professional?.logo_storage_path;
    if(!path)return '';
    if(ctx?.logoData)return ctx.logoData;
    if(professionalLogoPromise)return professionalLogoPromise;
    professionalLogoPromise=(async()=>{
      const timer=perfStart('Logo professionista lazy');
      try{
        const{data:logoBlob,error:logoError}=await client.storage.from('professional-assets').download(path);
        if(logoError)throw logoError;
        const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('Logo non leggibile'));reader.readAsDataURL(logoBlob);});
        if(window.nubemoProfessionalContext)window.nubemoProfessionalContext.logoData=dataUrl;
        return dataUrl;
      }finally{perfEnd(timer);}
    })().catch(error=>{professionalLogoPromise=null;console.error('NUBEMO professional logo load:',error);return '';});
    return professionalLogoPromise;
  }
  window.nubemoEnsureProfessionalLogoLoaded=ensureProfessionalLogoLoaded;

  async function requiresPrivacyGate(profileId){const{data:doc,error:docError}=await client.from('privacy_documents').select('id').eq('document_type','nubemo').eq('active',true).order('published_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(1).maybeSingle();if(docError)throw docError;if(!doc?.id)return false;const{data:acceptance,error:acceptanceError}=await client.from('privacy_acceptances').select('status').eq('profile_id',profileId).eq('privacy_document_id',doc.id).maybeSingle();if(acceptanceError)throw acceptanceError;return acceptance?.status!=='accepted';}

  async function logout(){if(logoutButton)logoutButton.disabled=true;try{await window.nubemoProfessionalNotesBridge?.flush?.();await window.nubemoProfessionalSettingsBridge?.flush?.();await window.nubemoProfessionalPatientSettingsBridge?.flush?.();await window.nubemoProfessionalDocumentReadBridge?.flush?.();await window.nubemoProfessionalLabsBridge?.flush?.();await window.nubemoProfessionalLegacyAdapter?.flush?.();await client.auth.signOut();}finally{redirectToLogin();}}
  window.nubemoProfessionalLogout=logout;logoutButton?.addEventListener('click',logout);

  async function authorize(){
    const totalTimer=perfStart('TOTALE bootstrap Area Professionista');
    try{
      let timer=perfStart('Auth sessione');const{data:{session},error:sessionError}=await client.auth.getSession();perfEnd(timer);if(sessionError||!session)return redirectToLogin();
      timer=perfStart('Auth utente');const{data:{user},error:userError}=await client.auth.getUser();perfEnd(timer);if(userError||!user)return redirectToLogin();
      timer=perfStart('Profilo utente');const{data:profile,error:profileError}=await client.from('profiles').select('id,auth_user_id,role,status,first_name,last_name,email').eq('auth_user_id',user.id).single();perfEnd(timer);if(profileError||!profile){showGuardError('Profilo NUBEMO non disponibile per questo account.');setTimeout(redirectToLogin,900);return;}if(profile.role!=='professional'||profile.status!=='active')return redirectToLogin();
      timer=perfStart('Privacy gate');const privacyRequired=await requiresPrivacyGate(profile.id);perfEnd(timer);if(privacyRequired)return redirectToPrivacy();
      timer=perfStart('Profilo professionista');const{data:professional,error:professionalError}=await client.from('professionals').select('id,profile_id,status,qualification,display_name,tax_code,vat_number,phone,address,zip,city,province,logo_storage_path').eq('profile_id',profile.id).maybeSingle();perfEnd(timer);if(professionalError||!professional){showGuardError('Profilo professionale NUBEMO non disponibile.');return;}

      const logoData='';

      timer=perfStart('Services + elenco pazienti');
      await loadScript('professional-services.js?v=nubemo40lazy3a01','Impossibile caricare i servizi Supabase dell’Area Professionista.');
      const services=window.nubemoProfessionalServices;if(!services)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      const loaded=await services.loadPatients(professional.id);
      window.nubemoProfessionalContext={user,profile,professional,logoData,patients:loaded.activePatients,endedPatients:loaded.endedPatients};
      window.nubemoReloadProfessionalPatients=async()=>{const loadedPatients=await services.loadPatients(professional.id);window.nubemoProfessionalContext.patients=loadedPatients.activePatients;window.nubemoProfessionalContext.endedPatients=loadedPatients.endedPatients;return loadedPatients.activePatients;};
      perfEnd(timer);

      timer=perfStart('Diario calorie persistite');await loadScript('professional-diary-calorie-supabase-bridge.js?v=nubemo40calpersist01','Impossibile preparare le calorie persistite del Diario.');perfEnd(timer);
      timer=perfStart('Adapter 3A');await loadScript('professional-legacy-supabase-adapter.js?v=nubemo40lazy3a01','Impossibile preparare i dati dell’Area Professionista.');if(!window.nubemoProfessionalLegacyAdapter)throw new Error('Adattatore dati PRO non inizializzato.');await window.nubemoProfessionalLegacyAdapter.init(window.nubemoProfessionalContext);window.nubemoProfessionalDiaryCaloriesBridge?.installStorageOverlay?.();perfEnd(timer);
      timer=perfStart('Lifecycle');await loadScript('professional-patient-lifecycle-bridge.js?v=nubemo40querycleanup01','Impossibile preparare i contatti e l’accesso paziente.');await window.nubemoPatientLifecycleBridge?.ready;perfEnd(timer);
      timer=perfStart('Recovery contract');await loadScript('professional-recovery-contract.js?v=nubemo40patientlife03','Impossibile applicare il contratto runtime dell’Area Professionista.');perfEnd(timer);
      timer=perfStart('Patient settings');await loadScript('professional-patient-settings-supabase-bridge.js?v=nubemo398recovery19','Impossibile preparare le impostazioni dell’Area Paziente.');await window.nubemoProfessionalPatientSettingsBridge?.ready;perfEnd(timer);
      timer=perfStart('Professional settings');await loadScript('professional-settings-supabase-bridge.js?v=nubemo398recovery19','Impossibile preparare le impostazioni del professionista.');await window.nubemoProfessionalSettingsBridge?.ready;perfEnd(timer);

      timer=perfStart('Note bridge lazy');await loadScript('professional-notes-supabase-bridge.js?v=nubemo40lazy3b01','Impossibile preparare le note del professionista.');perfEnd(timer);
      timer=perfStart('Documenti metadata');await loadScript('professional-documents-supabase-bridge.js?v=nubemo40lazy3b01','Impossibile preparare i documenti del paziente.');await window.nubemoProfessionalDocumentsBridge?.ready;perfEnd(timer);
      timer=perfStart('Stato lettura documenti');await loadScript('professional-document-read-supabase-bridge.js?v=nubemo40querycleanup01','Impossibile preparare lo stato di lettura dei documenti.');await window.nubemoProfessionalDocumentReadBridge?.ready;perfEnd(timer);
      timer=perfStart('Piani bridge lazy');await loadScript('professional-plans-supabase-bridge.js?v=nubemo40lazy3b01','Impossibile preparare i piani alimentari.');perfEnd(timer);
      timer=perfStart('Esami bridge lazy');await loadScript('professional-labs-supabase-bridge.js?v=nubemo40lazy3b01','Impossibile preparare gli esami del paziente.');perfEnd(timer);

      if(logoutButton)logoutButton.style.display='inline-flex';
      timer=perfStart('pro.js');await loadScript('pro.js?v=nubemo40calpersist01','Impossibile caricare l’Area Professionista.');window.nubemoProfessionalDiaryCaloriesBridge?.installRuntimeHelpers?.();perfEnd(timer);
      timer=perfStart('Gestione pazienti');await loadScript('professional-patient-management.js?v=nubemo40phone01','Impossibile caricare la gestione dei pazienti.');perfEnd(timer);
      timer=perfStart('Account e Privacy paziente');await loadScript('professional-access-privacy-supabase-bridge.js?v=nubemo40patientaccess02','Impossibile caricare Account e Privacy del paziente.');perfEnd(timer);
      timer=perfStart('Privacy professionista');await loadScript('professional-profile-privacy-supabase-bridge.js?v=nubemo40privacy02','Impossibile caricare il PDF privacy del professionista.');perfEnd(timer);

      perfEnd(totalTimer);
    }catch(error){console.error('NUBEMO Professional guard:',error);showGuardError('Non è stato possibile verificare l’accesso. Torna al login e riprova.');}
  }
  authorize();
})();
