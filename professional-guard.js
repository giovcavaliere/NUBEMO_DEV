// NUBEMO 4.0 — bootstrap Area Professionista Dashboard-only.
// Al login carica solo autenticazione, privacy, identità minima e payload Dashboard.
// Il runtime completo viene caricato al primo click che lo richiede.
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
  let fullRuntimePromise=null;
  const replayClicks=new WeakSet();

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

  async function refreshFullIdentity(){
    const ctx=window.nubemoProfessionalContext||{};
    const profileId=ctx.profile?.id;
    const professionalId=ctx.professional?.id;
    if(!profileId||!professionalId)throw new Error('Contesto professionista incompleto.');
    const [profileResult,professionalResult]=await Promise.all([
      client.from('profiles').select('id,auth_user_id,role,status,first_name,last_name,email').eq('id',profileId).single(),
      client.from('professionals').select('id,profile_id,status,qualification,display_name,tax_code,vat_number,phone,address,zip,city,province,logo_storage_path').eq('id',professionalId).single()
    ]);
    if(profileResult.error)throw profileResult.error;
    if(professionalResult.error)throw professionalResult.error;
    window.nubemoProfessionalContext={...ctx,profile:profileResult.data,professional:professionalResult.data};
    return window.nubemoProfessionalContext;
  }

  async function ensureFullRuntime(){
    if(fullRuntimePromise)return fullRuntimePromise;
    fullRuntimePromise=(async()=>{
      const totalTimer=perfStart('Runtime completo lazy');
      let timer=perfStart('Identità completa lazy');
      const ctx=await refreshFullIdentity();
      perfEnd(timer);

      timer=perfStart('Services + elenco pazienti lazy');
      await loadScript('professional-services.js?v=nubemo40lazy3a01','Impossibile caricare i servizi Supabase dell’Area Professionista.');
      const services=window.nubemoProfessionalServices;if(!services)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      const loaded=await services.loadPatients(ctx.professional.id);
      window.nubemoProfessionalContext={...window.nubemoProfessionalContext,patients:loaded.activePatients,endedPatients:loaded.endedPatients};
      window.nubemoReloadProfessionalPatients=async()=>{const loadedPatients=await services.loadPatients(window.nubemoProfessionalContext.professional.id);window.nubemoProfessionalContext.patients=loadedPatients.activePatients;window.nubemoProfessionalContext.endedPatients=loadedPatients.endedPatients;return loadedPatients.activePatients;};
      perfEnd(timer);

      timer=perfStart('Diario calorie persistite lazy');await loadScript('professional-diary-calorie-supabase-bridge.js?v=nubemo40calpersist01','Impossibile preparare le calorie persistite del Diario.');perfEnd(timer);
      timer=perfStart('Adapter 3A lazy');await loadScript('professional-legacy-supabase-adapter.js?v=nubemo40lazy3a01','Impossibile preparare i dati dell’Area Professionista.');if(!window.nubemoProfessionalLegacyAdapter)throw new Error('Adattatore dati PRO non inizializzato.');await window.nubemoProfessionalLegacyAdapter.init(window.nubemoProfessionalContext);window.nubemoProfessionalDiaryCaloriesBridge?.installStorageOverlay?.();perfEnd(timer);
      timer=perfStart('Lifecycle lazy');await loadScript('professional-patient-lifecycle-bridge.js?v=nubemo40querycleanup01','Impossibile preparare i contatti e l’accesso paziente.');await window.nubemoPatientLifecycleBridge?.ready;perfEnd(timer);
      timer=perfStart('Recovery contract lazy');await loadScript('professional-recovery-contract.js?v=nubemo40patientlife03','Impossibile applicare il contratto runtime dell’Area Professionista.');perfEnd(timer);
      timer=perfStart('Patient settings lazy');await loadScript('professional-patient-settings-supabase-bridge.js?v=nubemo398recovery19','Impossibile preparare le impostazioni dell’Area Paziente.');await window.nubemoProfessionalPatientSettingsBridge?.ready;perfEnd(timer);
      timer=perfStart('Professional settings lazy');await loadScript('professional-settings-supabase-bridge.js?v=nubemo398recovery19','Impossibile preparare le impostazioni del professionista.');await window.nubemoProfessionalSettingsBridge?.ready;perfEnd(timer);
      timer=perfStart('Note bridge lazy');await loadScript('professional-notes-supabase-bridge.js?v=nubemo40lazy3b01','Impossibile preparare le note del professionista.');perfEnd(timer);
      timer=perfStart('Documenti metadata lazy');await loadScript('professional-documents-supabase-bridge.js?v=nubemo40lazy3b01','Impossibile preparare i documenti del paziente.');await window.nubemoProfessionalDocumentsBridge?.ready;perfEnd(timer);
      timer=perfStart('Stato lettura documenti lazy');await loadScript('professional-document-read-supabase-bridge.js?v=nubemo40querycleanup01','Impossibile preparare lo stato di lettura dei documenti.');await window.nubemoProfessionalDocumentReadBridge?.ready;perfEnd(timer);
      timer=perfStart('Piani bridge lazy');await loadScript('professional-plans-supabase-bridge.js?v=nubemo40lazy3b01','Impossibile preparare i piani alimentari.');perfEnd(timer);
      timer=perfStart('Esami bridge lazy');await loadScript('professional-labs-supabase-bridge.js?v=nubemo40lazy3b01','Impossibile preparare gli esami del paziente.');perfEnd(timer);
      timer=perfStart('Gestione pazienti lazy');await loadScript('professional-patient-management.js?v=nubemo40phone01','Impossibile caricare la gestione dei pazienti.');perfEnd(timer);
      timer=perfStart('Account e Privacy paziente lazy');await loadScript('professional-access-privacy-supabase-bridge.js?v=nubemo40patientaccess02','Impossibile caricare Account e Privacy del paziente.');perfEnd(timer);
      timer=perfStart('Privacy professionista lazy');await loadScript('professional-profile-privacy-supabase-bridge.js?v=nubemo40privacy02','Impossibile caricare il PDF privacy del professionista.');perfEnd(timer);

      window.nubemoProfessionalDashboardBootstrap?.disable?.();
      window.nubemoProfessionalDiaryCaloriesBridge?.installRuntimeHelpers?.();
      perfEnd(totalTimer);
      return true;
    })().catch(error=>{fullRuntimePromise=null;throw error;});
    return fullRuntimePromise;
  }
  window.nubemoEnsureProfessionalRuntime=ensureFullRuntime;

  function needsFullRuntime(target){
    const viewButton=target?.closest?.('[data-view]');
    if(viewButton&&['patients','agenda','settings'].includes(viewButton.dataset.view))return true;
    const drawerView=target?.closest?.('[data-drawer-view]');
    if(drawerView&&['patients','agenda','settings'].includes(drawerView.dataset.drawerView))return true;
    return !!target?.closest?.('#goAgenda,[data-event],[data-bmi-category],#openUnreadLabPatients,#openUnreadPatients');
  }

  function installLazyRuntimeGate(){
    document.addEventListener('click',event=>{
      const target=event.target;
      if(!target||!needsFullRuntime(target))return;
      const action=target.closest?.('[data-view],[data-drawer-view],#goAgenda,[data-event],[data-bmi-category],#openUnreadLabPatients,#openUnreadPatients');
      if(!action)return;
      if(replayClicks.has(action)){replayClicks.delete(action);return;}
      if(fullRuntimePromise){
        event.preventDefault();event.stopImmediatePropagation();
      }else{
        event.preventDefault();event.stopImmediatePropagation();
      }
      const wasDisabled='disabled' in action?action.disabled:false;
      if('disabled' in action)action.disabled=true;
      void ensureFullRuntime().then(()=>{
        if('disabled' in action)action.disabled=wasDisabled;
        replayClicks.add(action);
        action.click();
      }).catch(error=>{
        if('disabled' in action)action.disabled=wasDisabled;
        console.error('NUBEMO runtime lazy:',error);
        alert('Non riesco a caricare questa sezione. Riprova.');
      });
    },true);
  }

  async function authorize(){
    const totalTimer=perfStart('TOTALE bootstrap Area Professionista');
    try{
      let timer=perfStart('Auth sessione');const{data:{session},error:sessionError}=await client.auth.getSession();perfEnd(timer);if(sessionError||!session)return redirectToLogin();
      timer=perfStart('Auth utente');const{data:{user},error:userError}=await client.auth.getUser();perfEnd(timer);if(userError||!user)return redirectToLogin();
      timer=perfStart('Profilo utente minimo');const{data:profile,error:profileError}=await client.from('profiles').select('id,auth_user_id,role,status').eq('auth_user_id',user.id).single();perfEnd(timer);if(profileError||!profile){showGuardError('Profilo NUBEMO non disponibile per questo account.');setTimeout(redirectToLogin,900);return;}if(profile.role!=='professional'||profile.status!=='active')return redirectToLogin();
      timer=perfStart('Privacy gate');const privacyRequired=await requiresPrivacyGate(profile.id);perfEnd(timer);if(privacyRequired)return redirectToPrivacy();
      timer=perfStart('Profilo professionista minimo');const{data:professional,error:professionalError}=await client.from('professionals').select('id,profile_id,status,logo_storage_path').eq('profile_id',profile.id).maybeSingle();perfEnd(timer);if(professionalError||!professional){showGuardError('Profilo professionale NUBEMO non disponibile.');return;}

      window.nubemoProfessionalContext={user,profile,professional,logoData:'',patients:[],endedPatients:[]};

      timer=perfStart('Dashboard bridge');await loadScript('professional-dashboard-bootstrap.js?v=nubemo40dashboard01','Impossibile preparare la Dashboard.');perfEnd(timer);
      timer=perfStart('Dashboard payload');await window.nubemoProfessionalDashboardBootstrap?.init?.(window.nubemoProfessionalContext);perfEnd(timer);

      if(logoutButton)logoutButton.style.display='inline-flex';
      timer=perfStart('pro.js');await loadScript('pro.js?v=nubemo40dashboard01','Impossibile caricare l’Area Professionista.');perfEnd(timer);
      installLazyRuntimeGate();

      perfEnd(totalTimer);
    }catch(error){console.error('NUBEMO Professional guard:',error);showGuardError('Non è stato possibile verificare l’accesso. Torna al login e riprova.');}
  }
  authorize();
})();
