// NUBEMO 4.0 — bootstrap Area Professionista Dashboard-only.
// Al login carica solo autenticazione, privacy, identità minima e payload Dashboard.
// Le sezioni vengono preparate con query puntuali quando possibile.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  const app=document.getElementById('proApp');
  const logoutButton=document.getElementById('proLogoutBtn');

  function showGuardError(message){if(!app)return;app.innerHTML=`<section class="card"><div class="eyebrow">NUBEMO PROFESSIONAL</div><h1>Accesso non consentito</h1><p>${message}</p><a href="./index.html">Torna al login</a></section>`;}
  function redirectToLogin(){window.location.replace('index.html');}
  function redirectToPrivacy(){window.location.replace('privacy.html');}
  function loadScript(src,errorMessage){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error(errorMessage));document.body.appendChild(script);});}
  function hasScript(fragment){return [...document.scripts].some(script=>String(script.src||'').includes(fragment));}
  function perfStart(label){return{label,startedAt:performance.now()};}
  function perfEnd(timer){const ms=Math.round(performance.now()-timer.startedAt);console.log(`[NUBEMO PERF] ${timer.label}: ${ms} ms`);return ms;}

  let professionalLogoPromise=null;
  let fullRuntimePromise=null;
  let patientSummaryLoaderPromise=null;
  let labsTabPromise=null;
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
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40lazy3a01','Impossibile caricare i servizi Supabase dell’Area Professionista.');
      const services=window.nubemoProfessionalServices;if(!services)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      const loaded=await services.loadPatients(ctx.professional.id);
      window.nubemoProfessionalContext={...window.nubemoProfessionalContext,patients:loaded.activePatients,endedPatients:loaded.endedPatients};
      window.nubemoReloadProfessionalPatients=async()=>{const loadedPatients=await services.loadPatients(window.nubemoProfessionalContext.professional.id);window.nubemoProfessionalContext.patients=loadedPatients.activePatients;window.nubemoProfessionalContext.endedPatients=loadedPatients.endedPatients;return loadedPatients.activePatients;};
      perfEnd(timer);

      timer=perfStart('Diario calorie persistite lazy');if(!hasScript('professional-diary-calorie-supabase-bridge.js'))await loadScript('professional-diary-calorie-supabase-bridge.js?v=nubemo40calpersist01','Impossibile preparare le calorie persistite del Diario.');perfEnd(timer);
      timer=perfStart('Adapter 3A lazy');if(!hasScript('professional-legacy-supabase-adapter.js'))await loadScript('professional-legacy-supabase-adapter.js?v=nubemo40lazy3a01','Impossibile preparare i dati dell’Area Professionista.');if(!window.nubemoProfessionalLegacyAdapter)throw new Error('Adattatore dati PRO non inizializzato.');await window.nubemoProfessionalLegacyAdapter.init(window.nubemoProfessionalContext);window.nubemoProfessionalDiaryCaloriesBridge?.installStorageOverlay?.();perfEnd(timer);
      timer=perfStart('Lifecycle lazy');if(!hasScript('professional-patient-lifecycle-bridge.js'))await loadScript('professional-patient-lifecycle-bridge.js?v=nubemo40stabilize01','Impossibile preparare i contatti e l’accesso paziente.');await window.nubemoPatientLifecycleBridge?.ready;perfEnd(timer);
      timer=perfStart('Recovery contract lazy');if(!hasScript('professional-recovery-contract.js'))await loadScript('professional-recovery-contract.js?v=nubemo40patientlife03','Impossibile applicare il contratto runtime dell’Area Professionista.');perfEnd(timer);
      timer=perfStart('Patient settings lazy');if(!hasScript('professional-patient-settings-supabase-bridge.js'))await loadScript('professional-patient-settings-supabase-bridge.js?v=nubemo398recovery19','Impossibile preparare le impostazioni dell’Area Paziente.');await window.nubemoProfessionalPatientSettingsBridge?.ready;perfEnd(timer);
      timer=perfStart('Professional settings lazy');if(!hasScript('professional-settings-supabase-bridge.js'))await loadScript('professional-settings-supabase-bridge.js?v=nubemo398recovery19','Impossibile preparare le impostazioni del professionista.');await window.nubemoProfessionalSettingsBridge?.ready;perfEnd(timer);
      timer=perfStart('Note bridge lazy');if(!hasScript('professional-notes-supabase-bridge.js'))await loadScript('professional-notes-supabase-bridge.js?v=nubemo40lazy3b01','Impossibile preparare le note del professionista.');perfEnd(timer);
      timer=perfStart('Documenti metadata lazy');if(!hasScript('professional-documents-supabase-bridge.js'))await loadScript('professional-documents-supabase-bridge.js?v=nubemo40lazy3b01','Impossibile preparare i documenti del paziente.');await window.nubemoProfessionalDocumentsBridge?.ready;perfEnd(timer);
      timer=perfStart('Stato lettura documenti lazy');if(!hasScript('professional-document-read-supabase-bridge.js'))await loadScript('professional-document-read-supabase-bridge.js?v=nubemo40querycleanup01','Impossibile preparare lo stato di lettura dei documenti.');await window.nubemoProfessionalDocumentReadBridge?.ready;perfEnd(timer);
      timer=perfStart('Piani bridge lazy');if(!hasScript('professional-plans-supabase-bridge.js'))await loadScript('professional-plans-supabase-bridge.js?v=nubemo40lazy3b01','Impossibile preparare i piani alimentari.');perfEnd(timer);
      timer=perfStart('Esami bridge lazy');if(!hasScript('professional-labs-supabase-bridge.js'))await loadScript('professional-labs-supabase-bridge.js?v=nubemo40lazy3b01','Impossibile preparare gli esami del paziente.');perfEnd(timer);
      timer=perfStart('Gestione pazienti lazy');if(!hasScript('professional-patient-management.js'))await loadScript('professional-patient-management.js?v=nubemo40phone01','Impossibile caricare la gestione dei pazienti.');perfEnd(timer);
      timer=perfStart('Account e Privacy paziente lazy');if(!hasScript('professional-access-privacy-supabase-bridge.js'))await loadScript('professional-access-privacy-supabase-bridge.js?v=nubemo40patientaccess02','Impossibile caricare Account e Privacy del paziente.');perfEnd(timer);
      timer=perfStart('Privacy professionista lazy');if(!hasScript('professional-profile-privacy-supabase-bridge.js'))await loadScript('professional-profile-privacy-supabase-bridge.js?v=nubemo40privacy02','Impossibile caricare il PDF privacy del professionista.');perfEnd(timer);

      window.nubemoProfessionalDashboardBootstrap?.disable?.();
      window.nubemoProfessionalDiaryCaloriesBridge?.installRuntimeHelpers?.();
      perfEnd(totalTimer);
      return true;
    })().catch(error=>{fullRuntimePromise=null;throw error;});
    return fullRuntimePromise;
  }
  window.nubemoEnsureProfessionalRuntime=ensureFullRuntime;

  async function ensurePatientSummaryLoader(){
    if(patientSummaryLoaderPromise)return patientSummaryLoaderPromise;
    patientSummaryLoaderPromise=(async()=>{
      if(!window.nubemoProfessionalPatientSummaryLazy){
        await loadScript('professional-patient-summary-lazy.js?v=nubemo40summary02','Impossibile preparare il riepilogo paziente.');
      }
      return window.nubemoProfessionalPatientSummaryLazy;
    })().catch(error=>{patientSummaryLoaderPromise=null;throw error;});
    return patientSummaryLoaderPromise;
  }

  function replayAction(action){
    replayClicks.add(action);
    action.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
  }

  function isDashboardAction(action){
    return action?.matches?.('[data-view="dashboard"],[data-drawer-view="dashboard"]');
  }

  function virtualPatient(patientId){
    try{
      const rows=JSON.parse(localStorage.getItem('diario-pro-extra-patients-v1')||'[]');
      return Array.isArray(rows)?rows.find(row=>String(row?.id||'')===String(patientId||''))||null:null;
    }catch(_){return null;}
  }

  function pointAction(target){
    const patient=target?.closest?.('[data-patient]');
    if(patient){
      const row=virtualPatient(patient.dataset.patient);
      if(row&&!row._draft&&row.relationshipStatus!=='draft')return patient;
    }
    return target?.closest?.('[data-bmi-category],[data-view="patients"],[data-drawer-view="patients"],#openUnreadLabPatients,#openUnreadPatients')||null;
  }

  async function preparePointAction(action){
    const bridge=window.nubemoProfessionalDashboardBootstrap;
    if(!bridge)return;
    if(action.matches('[data-patient]')){
      const timer=perfStart('Riepilogo paziente lazy');
      try{
        const loader=await ensurePatientSummaryLoader();
        await loader?.load?.(action.dataset.patient);
      }finally{perfEnd(timer);}
      return;
    }
    if(action.matches('[data-bmi-category]')){
      const timer=perfStart('BMI categoria lazy');
      try{await bridge.loadBmiCategory(action.dataset.bmiCategory);}finally{perfEnd(timer);}
      return;
    }
    const timer=perfStart('Elenco pazienti + draft lazy');
    try{await bridge.loadPatientsList();}finally{perfEnd(timer);}
  }

  function currentPatientId(){
    return document.querySelector('[data-drawer-patient]')?.dataset.drawerPatient||'';
  }

  function ensureSelectedPatientContext(patientId){
    if(!patientId)return;
    const ctx=window.nubemoProfessionalContext||{};
    const existing=Array.isArray(ctx.patients)?ctx.patients:[];
    if(existing.some(row=>String(row?.id||'')===String(patientId)))return;
    const patient=virtualPatient(patientId)||{};
    const minimal={
      id:String(patientId),
      profile_id:patient.profileId||null,
      profile:{
        first_name:patient.firstName||patient.name||'',
        last_name:patient.surname||'',
        email:patient.email||''
      }
    };
    window.nubemoProfessionalContext={...ctx,patients:[...existing,minimal]};
  }

  async function ensureLabsTab(patientId){
    if(!patientId)throw new Error('Paziente non disponibile.');
    if(labsTabPromise)return labsTabPromise.then(async()=>{
      await window.nubemoProfessionalDocumentsBridge?.ensurePatient?.(patientId);
      await window.nubemoProfessionalLabsBridge?.ensurePatient?.(patientId);
    });
    labsTabPromise=(async()=>{
      const timer=perfStart('Esami tab lazy');
      try{
        ensureSelectedPatientContext(patientId);
        if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40lazy3a01','Impossibile caricare i servizi Supabase dell’Area Professionista.');
        if(!window.nubemoProfessionalServices)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
        if(!hasScript('professional-documents-supabase-bridge.js'))await loadScript('professional-documents-supabase-bridge.js?v=nubemo40lazy3b01','Impossibile preparare i referti del paziente.');
        await window.nubemoProfessionalDocumentsBridge?.ready;
        await window.nubemoProfessionalDocumentsBridge?.ensurePatient?.(patientId);
        if(!hasScript('professional-document-read-supabase-bridge.js'))await loadScript('professional-document-read-supabase-bridge.js?v=nubemo40querycleanup01','Impossibile preparare lo stato di lettura dei referti.');
        await window.nubemoProfessionalDocumentReadBridge?.ready;
        if(!hasScript('professional-labs-supabase-bridge.js'))await loadScript('professional-labs-supabase-bridge.js?v=nubemo40lazy3b01','Impossibile preparare gli esami del paziente.');
        await window.nubemoProfessionalLabsBridge?.ready;
        await window.nubemoProfessionalLabsBridge?.ensurePatient?.(patientId);
      }finally{perfEnd(timer);}
    })().catch(error=>{labsTabPromise=null;throw error;});
    return labsTabPromise;
  }

  function patientTabName(action){
    if(action?.matches?.('[data-patient-tab]'))return action.dataset.patientTab||'';
    if(action?.matches?.('[data-drawer-tab]'))return action.dataset.drawerTab||'';
    return '';
  }

  async function prepareSpecificPatientTab(action){
    const name=patientTabName(action);
    if(name!=='labs')return false;
    const patientId=currentPatientId();
    await ensureLabsTab(patientId);
    return true;
  }

  function needsFullRuntime(target){
    const viewButton=target?.closest?.('[data-view]');
    if(viewButton&&['agenda','settings'].includes(viewButton.dataset.view))return true;
    const drawerView=target?.closest?.('[data-drawer-view]');
    if(drawerView&&['agenda','settings'].includes(drawerView.dataset.drawerView))return true;
    const patientTab=target?.closest?.('[data-patient-tab]');
    if(patientTab)return !['summary','anamnesis','labs'].includes(patientTab.dataset.patientTab);
    const drawerTab=target?.closest?.('[data-drawer-tab]');
    if(drawerTab)return !['summary','anamnesis','labs'].includes(drawerTab.dataset.drawerTab);
    return !!target?.closest?.('#goAgenda,[data-event],[data-patient],#newPatient,#editPatientProfileLegacy,#patientMenuEditProfile,#deletePatient');
  }

  async function prepareRuntimeAction(action){
    await ensureFullRuntime();
    if(!action?.matches?.('[data-patient-tab],[data-drawer-tab]'))return;
    const patientId=currentPatientId();
    const adapter=window.nubemoProfessionalLegacyAdapter;
    if(patientId&&adapter?.ensurePatientHydrated){
      const timer=perfStart('Paziente completo lazy');
      try{await adapter.ensurePatientHydrated(patientId);}finally{perfEnd(timer);}
    }
  }

  function installLazyRuntimeGate(){
    document.addEventListener('click',event=>{
      const target=event.target;
      if(!target)return;
      const anyAction=target.closest?.('[data-view],[data-drawer-view],[data-bmi-category],[data-patient-tab],[data-drawer-tab],#openUnreadLabPatients,#openUnreadPatients,#goAgenda,[data-event],[data-patient],#newPatient,#editPatientProfileLegacy,#patientMenuEditProfile,#deletePatient');
      if(!anyAction)return;
      if(replayClicks.has(anyAction)){replayClicks.delete(anyAction);return;}

      if(isDashboardAction(anyAction)){
        window.nubemoProfessionalDashboardBootstrap?.restoreDashboard?.();
        return;
      }

      const point=pointAction(target);
      if(point){
        event.preventDefault();event.stopImmediatePropagation();
        const wasDisabled='disabled' in point?point.disabled:false;
        if('disabled' in point)point.disabled=true;
        void preparePointAction(point).then(()=>{
          if('disabled' in point)point.disabled=wasDisabled;
          replayAction(point);
        }).catch(error=>{
          if('disabled' in point)point.disabled=wasDisabled;
          console.error('NUBEMO query puntuale:',error);
          alert('Non riesco a caricare questa sezione. Riprova.');
        });
        return;
      }

      if(anyAction.matches('[data-patient-tab],[data-drawer-tab]')&&patientTabName(anyAction)==='labs'){
        event.preventDefault();event.stopImmediatePropagation();
        const action=anyAction;
        const wasDisabled='disabled' in action?action.disabled:false;
        if('disabled' in action)action.disabled=true;
        void prepareSpecificPatientTab(action).then(()=>{
          if('disabled' in action)action.disabled=wasDisabled;
          replayAction(action);
        }).catch(error=>{
          if('disabled' in action)action.disabled=wasDisabled;
          console.error('NUBEMO Esami lazy:',error);
          alert('Non riesco a caricare gli esami. Riprova.');
        });
        return;
      }

      if(!needsFullRuntime(target))return;
      event.preventDefault();event.stopImmediatePropagation();
      const action=anyAction;
      const wasDisabled='disabled' in action?action.disabled:false;
      if('disabled' in action)action.disabled=true;
      void prepareRuntimeAction(action).then(()=>{
        if('disabled' in action)action.disabled=wasDisabled;
        replayAction(action);
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

      timer=perfStart('Dashboard bridge');await loadScript('professional-dashboard-bootstrap.js?v=nubemo40dashboard03','Impossibile preparare la Dashboard.');perfEnd(timer);
      timer=perfStart('Dashboard payload');await window.nubemoProfessionalDashboardBootstrap?.init?.(window.nubemoProfessionalContext);perfEnd(timer);

      if(logoutButton)logoutButton.style.display='inline-flex';
      timer=perfStart('pro.js');await loadScript('pro.js?v=nubemo40stabilize01','Impossibile caricare l’Area Professionista.');perfEnd(timer);
      installLazyRuntimeGate();

      perfEnd(totalTimer);
    }catch(error){console.error('NUBEMO Professional guard:',error);showGuardError('Non è stato possibile verificare l’accesso. Torna al login e riprova.');}
  }
  authorize();
})();