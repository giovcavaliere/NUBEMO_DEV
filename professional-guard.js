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
  let planTabPromise=null;
  let documentsTabPromise=null;
  let privacyTabPromise=null;
  let accountTabPromise=null;
  let diaryTabPromise=null;
  let trendTabPromise=null;
  let measuresTabPromise=null;
  let visitsTabPromise=null;
  let notesTabPromise=null;
  let agendaPromise=null;
  let professionalProfilePromise=null;
  const patientAccessContextPromises=new Map();
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

  async function logout(){if(logoutButton)logoutButton.disabled=true;try{await window.nubemoProfessionalAgendaBridge?.flush?.();await window.nubemoProfessionalNotesBridge?.flush?.();await window.nubemoProfessionalSettingsBridge?.flush?.();await window.nubemoProfessionalPatientSettingsBridge?.flush?.();await window.nubemoProfessionalDocumentReadBridge?.flush?.();await window.nubemoProfessionalLabsBridge?.flush?.();await window.nubemoProfessionalLegacyAdapter?.flush?.();await client.auth.signOut();}finally{redirectToLogin();}}
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
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40clean04','Impossibile caricare i servizi Supabase dell’Area Professionista.');
      const services=window.nubemoProfessionalServices;if(!services)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      const loaded=await services.loadPatients(ctx.professional.id);
      window.nubemoProfessionalContext={...window.nubemoProfessionalContext,patients:loaded.activePatients,endedPatients:loaded.endedPatients};
      window.nubemoReloadProfessionalPatients=async()=>{const loadedPatients=await services.loadPatients(window.nubemoProfessionalContext.professional.id);window.nubemoProfessionalContext.patients=loadedPatients.activePatients;window.nubemoProfessionalContext.endedPatients=loadedPatients.endedPatients;return loadedPatients.activePatients;};
      perfEnd(timer);

      timer=perfStart('Diario calorie persistite lazy');if(!hasScript('professional-diary-calorie-supabase-bridge.js'))await loadScript('professional-diary-calorie-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare le calorie persistite del Diario.');perfEnd(timer);
      timer=perfStart('Adapter 3A lazy');if(!hasScript('professional-legacy-supabase-adapter.js'))await loadScript('professional-legacy-supabase-adapter.js?v=nubemo40clean04','Impossibile preparare i dati dell’Area Professionista.');if(!window.nubemoProfessionalLegacyAdapter)throw new Error('Adattatore dati PRO non inizializzato.');await window.nubemoProfessionalLegacyAdapter.init(window.nubemoProfessionalContext);window.nubemoProfessionalDiaryCaloriesBridge?.installStorageOverlay?.();perfEnd(timer);
      timer=perfStart('Lifecycle lazy');if(!hasScript('professional-patient-lifecycle-bridge.js'))await loadScript('professional-patient-lifecycle-bridge.js?v=nubemo40clean04','Impossibile preparare i contatti e l’accesso paziente.');await window.nubemoPatientLifecycleBridge?.ready;perfEnd(timer);
      timer=perfStart('Recovery contract lazy');if(!hasScript('professional-recovery-contract.js'))await loadScript('professional-recovery-contract.js?v=nubemo40clean04','Impossibile applicare il contratto runtime dell’Area Professionista.');perfEnd(timer);
      timer=perfStart('Patient settings lazy');if(!hasScript('professional-patient-settings-supabase-bridge.js'))await loadScript('professional-patient-settings-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare le impostazioni dell’Area Paziente.');await window.nubemoProfessionalPatientSettingsBridge?.ready;perfEnd(timer);
      timer=perfStart('Professional settings lazy');if(!hasScript('professional-settings-supabase-bridge.js'))await loadScript('professional-settings-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare le impostazioni del professionista.');await window.nubemoProfessionalSettingsBridge?.ready;perfEnd(timer);
      timer=perfStart('Note bridge lazy');if(!hasScript('professional-notes-supabase-bridge.js'))await loadScript('professional-notes-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare le note del professionista.');perfEnd(timer);
      timer=perfStart('Documenti metadata lazy');if(!hasScript('professional-documents-supabase-bridge.js'))await loadScript('professional-documents-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare i documenti del paziente.');await window.nubemoProfessionalDocumentsBridge?.ready;perfEnd(timer);
      timer=perfStart('Stato lettura documenti lazy');if(!hasScript('professional-document-read-supabase-bridge.js'))await loadScript('professional-document-read-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare lo stato di lettura dei documenti.');await window.nubemoProfessionalDocumentReadBridge?.ready;perfEnd(timer);
      timer=perfStart('Piani bridge lazy');if(!hasScript('professional-plans-supabase-bridge.js'))await loadScript('professional-plans-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare i piani alimentari.');perfEnd(timer);
      timer=perfStart('Esami bridge lazy');if(!hasScript('professional-labs-supabase-bridge.js'))await loadScript('professional-labs-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare gli esami del paziente.');perfEnd(timer);
      timer=perfStart('Gestione pazienti lazy');if(!hasScript('professional-patient-management.js'))await loadScript('professional-patient-management.js?v=nubemo40clean04','Impossibile caricare la gestione dei pazienti.');perfEnd(timer);
      timer=perfStart('Account e Privacy paziente lazy');if(!hasScript('professional-access-privacy-supabase-bridge.js'))await loadScript('professional-access-privacy-supabase-bridge.js?v=nubemo40clean04','Impossibile caricare Account e Privacy del paziente.');perfEnd(timer);
      timer=perfStart('Privacy professionista lazy');if(!hasScript('professional-profile-privacy-supabase-bridge.js'))await loadScript('professional-profile-privacy-supabase-bridge.js?v=nubemo40clean04','Impossibile caricare il PDF privacy del professionista.');perfEnd(timer);

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
      if(!window.nubemoProfessionalPatientSummaryLazy)await loadScript('professional-patient-summary-lazy.js?v=nubemo40clean04','Impossibile preparare il riepilogo paziente.');
      return window.nubemoProfessionalPatientSummaryLazy;
    })().catch(error=>{patientSummaryLoaderPromise=null;throw error;});
    return patientSummaryLoaderPromise;
  }

  function replayAction(action){replayClicks.add(action);action.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));}
  function isDashboardAction(action){return action?.matches?.('[data-view="dashboard"],[data-drawer-view="dashboard"]');}
  function isAgendaAction(action){return action?.matches?.('[data-view="agenda"],[data-drawer-view="agenda"],#goAgenda');}
  function isProfessionalProfileAction(action){return action?.matches?.('[data-view="settings"],[data-drawer-view="settings"]');}

  function virtualPatient(patientId){try{const rows=JSON.parse(localStorage.getItem('diario-pro-extra-patients-v1')||'[]');return Array.isArray(rows)?rows.find(row=>String(row?.id||'')===String(patientId||''))||null:null;}catch(_){return null;}}

  function pointAction(target){
    const patient=target?.closest?.('[data-patient]');
    if(patient){const row=virtualPatient(patient.dataset.patient);if(row&&!row._draft&&row.relationshipStatus!=='draft')return patient;}
    return target?.closest?.('[data-bmi-category],[data-view="patients"],[data-drawer-view="patients"],#openUnreadLabPatients,#openUnreadPatients')||null;
  }

  async function preparePointAction(action){
    const bridge=window.nubemoProfessionalDashboardBootstrap;if(!bridge)return;
    if(action.matches('[data-patient]')){const timer=perfStart('Riepilogo paziente lazy');try{const loader=await ensurePatientSummaryLoader();await loader?.load?.(action.dataset.patient);}finally{perfEnd(timer);}return;}
    if(action.matches('[data-bmi-category]')){const timer=perfStart('BMI categoria lazy');try{await bridge.loadBmiCategory(action.dataset.bmiCategory);}finally{perfEnd(timer);}return;}
    const timer=perfStart('Elenco pazienti + draft lazy');try{await bridge.loadPatientsList();}finally{perfEnd(timer);}
  }

  function currentPatientId(){return document.querySelector('[data-drawer-patient]')?.dataset.drawerPatient||'';}

  function ensureSelectedPatientContext(patientId){
    if(!patientId)return null;
    const ctx=window.nubemoProfessionalContext||{};const existing=Array.isArray(ctx.patients)?ctx.patients:[];
    let row=existing.find(item=>String(item?.id||'')===String(patientId))||null;if(row)return row;
    const patient=virtualPatient(patientId)||{};
    row={id:String(patientId),profile_id:patient.profileId||null,profile:{first_name:patient.firstName||patient.name||'',last_name:patient.surname||'',email:patient.email||'',auth_user_id:patient.authUserId||null,status:patient.profileStatus||'active'}};
    window.nubemoProfessionalContext={...ctx,patients:[...existing,row]};return row;
  }

  async function ensurePatientAccessContext(patientId){
    if(!patientId)throw new Error('Paziente non disponibile.');
    const row=ensureSelectedPatientContext(patientId);
    if(row?.profile_id&&row?.profile&&Object.prototype.hasOwnProperty.call(row.profile,'auth_user_id')&&row.profile.id)return row;
    if(patientAccessContextPromises.has(patientId))return patientAccessContextPromises.get(patientId);
    const promise=(async()=>{
      const {data:patientRow,error:patientError}=await client.from('patients').select('id,profile_id').eq('id',patientId).single();if(patientError)throw patientError;
      const {data:profile,error:profileError}=await client.from('profiles').select('id,auth_user_id,first_name,last_name,email,status').eq('id',patientRow.profile_id).single();if(profileError)throw profileError;
      const current=ensureSelectedPatientContext(patientId);current.profile_id=patientRow.profile_id;current.profile={...(current.profile||{}),...profile};return current;
    })().finally(()=>patientAccessContextPromises.delete(patientId));
    patientAccessContextPromises.set(patientId,promise);return promise;
  }

  async function ensureLabsTab(patientId){
    if(!patientId)throw new Error('Paziente non disponibile.');
    if(labsTabPromise)return labsTabPromise.then(async()=>{await window.nubemoProfessionalDocumentsBridge?.ensurePatient?.(patientId);await window.nubemoProfessionalLabsBridge?.ensurePatient?.(patientId);});
    labsTabPromise=(async()=>{const timer=perfStart('Esami tab lazy');try{
      ensureSelectedPatientContext(patientId);
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40clean04','Impossibile caricare i servizi Supabase dell’Area Professionista.');
      if(!window.nubemoProfessionalServices)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      if(!hasScript('professional-documents-supabase-bridge.js'))await loadScript('professional-documents-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare i referti del paziente.');await window.nubemoProfessionalDocumentsBridge?.ready;await window.nubemoProfessionalDocumentsBridge?.ensurePatient?.(patientId);
      if(!hasScript('professional-document-read-supabase-bridge.js'))await loadScript('professional-document-read-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare lo stato di lettura dei referti.');await window.nubemoProfessionalDocumentReadBridge?.ready;
      if(!hasScript('professional-labs-supabase-bridge.js'))await loadScript('professional-labs-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare gli esami del paziente.');await window.nubemoProfessionalLabsBridge?.ready;await window.nubemoProfessionalLabsBridge?.ensurePatient?.(patientId);
    }finally{perfEnd(timer);}})().catch(error=>{labsTabPromise=null;throw error;});return labsTabPromise;
  }

  async function ensurePlanTab(patientId){
    if(!patientId)throw new Error('Paziente non disponibile.');
    if(planTabPromise)return planTabPromise.then(async()=>{window.nubemoProfessionalPlansBridge?.setCurrentPatient?.(patientId);await window.nubemoProfessionalDocumentsBridge?.ensurePatient?.(patientId);await window.nubemoProfessionalPlansBridge?.ensurePatient?.(patientId);});
    planTabPromise=(async()=>{const timer=perfStart('Piano tab lazy');try{
      ensureSelectedPatientContext(patientId);
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40clean04','Impossibile caricare i servizi Supabase dell’Area Professionista.');if(!window.nubemoProfessionalServices)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      if(!hasScript('professional-documents-supabase-bridge.js'))await loadScript('professional-documents-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare i documenti del piano.');await window.nubemoProfessionalDocumentsBridge?.ready;await window.nubemoProfessionalDocumentsBridge?.ensurePatient?.(patientId);
      if(!hasScript('professional-plans-supabase-bridge.js'))await loadScript('professional-plans-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare i piani alimentari.');await window.nubemoProfessionalPlansBridge?.ready;window.nubemoProfessionalPlansBridge?.setCurrentPatient?.(patientId);await window.nubemoProfessionalPlansBridge?.ensurePatient?.(patientId);
    }finally{perfEnd(timer);}})().catch(error=>{planTabPromise=null;throw error;});return planTabPromise;
  }

  async function ensureDocumentsTab(patientId){
    if(!patientId)throw new Error('Paziente non disponibile.');
    if(documentsTabPromise)return documentsTabPromise.then(async()=>{await window.nubemoProfessionalDocumentsBridge?.ensurePatient?.(patientId);});
    documentsTabPromise=(async()=>{const timer=perfStart('Documenti tab lazy');try{
      ensureSelectedPatientContext(patientId);
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40clean04','Impossibile caricare i servizi Supabase dell’Area Professionista.');if(!window.nubemoProfessionalServices)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      if(!hasScript('professional-documents-supabase-bridge.js'))await loadScript('professional-documents-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare i documenti del paziente.');await window.nubemoProfessionalDocumentsBridge?.ready;await window.nubemoProfessionalDocumentsBridge?.ensurePatient?.(patientId);
      if(!hasScript('professional-document-read-supabase-bridge.js'))await loadScript('professional-document-read-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare lo stato di lettura dei documenti.');await window.nubemoProfessionalDocumentReadBridge?.ready;
    }finally{perfEnd(timer);}})().catch(error=>{documentsTabPromise=null;throw error;});return documentsTabPromise;
  }

  async function ensurePrivacyTab(patientId){
    if(!patientId)throw new Error('Paziente non disponibile.');
    if(privacyTabPromise)return privacyTabPromise.then(async()=>{await ensurePatientAccessContext(patientId);window.nubemoProfessionalAccessPrivacyBridge?.setCurrentPatient?.(patientId);});
    privacyTabPromise=(async()=>{const timer=perfStart('Privacy tab lazy');try{
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40clean04','Impossibile caricare i servizi Supabase dell’Area Professionista.');if(!window.nubemoProfessionalServices)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      await ensurePatientAccessContext(patientId);
      if(!hasScript('professional-access-privacy-supabase-bridge.js'))await loadScript('professional-access-privacy-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare la privacy del paziente.');if(!window.nubemoProfessionalAccessPrivacyBridge)throw new Error('Bridge Privacy non inizializzato.');window.nubemoProfessionalAccessPrivacyBridge.setCurrentPatient?.(patientId);
    }finally{perfEnd(timer);}})().catch(error=>{privacyTabPromise=null;throw error;});return privacyTabPromise;
  }

  async function ensureAccountTab(patientId){
    if(!patientId)throw new Error('Paziente non disponibile.');
    if(accountTabPromise)return accountTabPromise.then(async()=>{await ensurePatientAccessContext(patientId);window.nubemoProfessionalAccessPrivacyBridge?.setCurrentPatient?.(patientId);});
    accountTabPromise=(async()=>{const timer=perfStart('Account tab lazy');try{
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40clean04','Impossibile caricare i servizi Supabase dell’Area Professionista.');if(!window.nubemoProfessionalServices)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      await ensurePatientAccessContext(patientId);
      if(!hasScript('professional-access-privacy-supabase-bridge.js'))await loadScript('professional-access-privacy-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare l’account del paziente.');if(!window.nubemoProfessionalAccessPrivacyBridge)throw new Error('Bridge Account non inizializzato.');window.nubemoProfessionalAccessPrivacyBridge.setCurrentPatient?.(patientId);
    }finally{perfEnd(timer);}})().catch(error=>{accountTabPromise=null;throw error;});return accountTabPromise;
  }

  async function ensureDiaryTab(patientId){
    if(!patientId)throw new Error('Paziente non disponibile.');
    if(diaryTabPromise)return diaryTabPromise.then(async()=>{await window.nubemoProfessionalPatientDiaryLazy?.load?.(patientId,30);window.nubemoProfessionalDiaryCaloriesBridge?.installRuntimeHelpers?.();});
    diaryTabPromise=(async()=>{const timer=perfStart('Diario tab lazy · 30 giorni');try{
      ensureSelectedPatientContext(patientId);
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40clean04','Impossibile caricare i servizi Supabase dell’Area Professionista.');
      if(!window.nubemoProfessionalServices)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      if(!hasScript('professional-diary-calorie-supabase-bridge.js'))await loadScript('professional-diary-calorie-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare le calorie persistite del Diario.');
      if(!hasScript('professional-patient-diary-lazy.js'))await loadScript('professional-patient-diary-lazy.js?v=nubemo40clean04','Impossibile preparare il Diario del paziente.');
      if(!window.nubemoProfessionalPatientDiaryLazy)throw new Error('Loader Diario non inizializzato.');
      await window.nubemoProfessionalPatientDiaryLazy.load(patientId,30);
      window.nubemoProfessionalDiaryCaloriesBridge?.installRuntimeHelpers?.();
    }finally{perfEnd(timer);}})().catch(error=>{diaryTabPromise=null;throw error;});
    return diaryTabPromise;
  }

  async function ensureTrendTab(patientId){
    if(!patientId)throw new Error('Paziente non disponibile.');
    if(trendTabPromise)return trendTabPromise.then(async()=>{await window.nubemoProfessionalPatientTrendLazy?.load?.(patientId);});
    trendTabPromise=(async()=>{const timer=perfStart('Andamento tab lazy · storico pesi');try{
      ensureSelectedPatientContext(patientId);
      if(!hasScript('professional-patient-trend-lazy.js'))await loadScript('professional-patient-trend-lazy.js?v=nubemo40clean04','Impossibile preparare l’andamento del paziente.');
      if(!window.nubemoProfessionalPatientTrendLazy)throw new Error('Loader Andamento non inizializzato.');
      await window.nubemoProfessionalPatientTrendLazy.load(patientId);
    }finally{perfEnd(timer);}})().catch(error=>{trendTabPromise=null;throw error;});
    return trendTabPromise;
  }

  async function ensureMeasuresTab(patientId){
    if(!patientId)throw new Error('Paziente non disponibile.');
    if(measuresTabPromise)return measuresTabPromise.then(async()=>{await window.nubemoProfessionalMeasuresBridge?.ensurePatient?.(patientId);});
    measuresTabPromise=(async()=>{const timer=perfStart('Misure tab lazy');try{
      ensureSelectedPatientContext(patientId);
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40clean04','Impossibile caricare i servizi Supabase dell’Area Professionista.');
      if(!window.nubemoProfessionalServices)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      if(!hasScript('professional-measures-supabase-bridge.js'))await loadScript('professional-measures-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare le misure del paziente.');
      await window.nubemoProfessionalMeasuresBridge?.ready;
      if(!window.nubemoProfessionalMeasuresBridge)throw new Error('Bridge Misure non inizializzato.');
      await window.nubemoProfessionalMeasuresBridge.ensurePatient(patientId);
    }finally{perfEnd(timer);}})().catch(error=>{measuresTabPromise=null;throw error;});
    return measuresTabPromise;
  }

  async function ensureVisitsTab(patientId){
    if(!patientId)throw new Error('Paziente non disponibile.');
    if(visitsTabPromise)return visitsTabPromise.then(async()=>{await window.nubemoProfessionalVisitsBridge?.ensurePatient?.(patientId);});
    visitsTabPromise=(async()=>{const timer=perfStart('Visite tab lazy');try{
      ensureSelectedPatientContext(patientId);
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40clean04','Impossibile caricare i servizi Supabase dell’Area Professionista.');
      if(!window.nubemoProfessionalServices)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      if(!hasScript('professional-visits-supabase-bridge.js'))await loadScript('professional-visits-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare le visite del paziente.');
      await window.nubemoProfessionalVisitsBridge?.ready;
      if(!window.nubemoProfessionalVisitsBridge)throw new Error('Bridge Visite non inizializzato.');
      await window.nubemoProfessionalVisitsBridge.ensurePatient(patientId);
    }finally{perfEnd(timer);}})().catch(error=>{visitsTabPromise=null;throw error;});
    return visitsTabPromise;
  }

  async function ensureNotesTab(patientId){
    if(!patientId)throw new Error('Paziente non disponibile.');
    if(notesTabPromise)return notesTabPromise.then(async()=>{await window.nubemoProfessionalNotesBridge?.ensurePatient?.(patientId);});
    notesTabPromise=(async()=>{const timer=perfStart('Note tab lazy');try{
      ensureSelectedPatientContext(patientId);
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40clean04','Impossibile caricare i servizi Supabase dell’Area Professionista.');
      if(!window.nubemoProfessionalServices)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      if(!hasScript('professional-notes-supabase-bridge.js'))await loadScript('professional-notes-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare le note del paziente.');
      await window.nubemoProfessionalNotesBridge?.ready;
      if(!window.nubemoProfessionalNotesBridge)throw new Error('Bridge Note non inizializzato.');
      await window.nubemoProfessionalNotesBridge.ensurePatient(patientId);
    }finally{perfEnd(timer);}})().catch(error=>{notesTabPromise=null;throw error;});
    return notesTabPromise;
  }

  async function ensureAgenda(){
    if(agendaPromise)return agendaPromise.then(async()=>{await window.nubemoProfessionalAgendaBridge?.refresh?.();});
    agendaPromise=(async()=>{const timer=perfStart('Agenda lazy');try{
      const dashboard=window.nubemoProfessionalDashboardBootstrap;
      if(!dashboard)throw new Error('Dashboard bridge non disponibile.');
      await dashboard.loadPatientsList();
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40clean04','Impossibile caricare i servizi Supabase dell’Area Professionista.');
      if(!window.nubemoProfessionalServices)throw new Error('Servizi Supabase Area Professionista non inizializzati.');
      if(!hasScript('professional-settings-supabase-bridge.js'))await loadScript('professional-settings-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare le impostazioni dell’Agenda.');
      await window.nubemoProfessionalSettingsBridge?.ready;
      if(!hasScript('professional-patient-lifecycle-bridge.js'))await loadScript('professional-patient-lifecycle-bridge.js?v=nubemo40clean04','Impossibile preparare i contatti dell’Agenda.');
      await window.nubemoPatientLifecycleBridge?.ready;
      if(!hasScript('professional-agenda-supabase-bridge.js'))await loadScript('professional-agenda-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare l’Agenda.');
      if(!window.nubemoProfessionalAgendaBridge)throw new Error('Bridge Agenda non inizializzato.');
      await window.nubemoProfessionalAgendaBridge.ready;
    }finally{perfEnd(timer);}})().catch(error=>{agendaPromise=null;throw error;});
    return agendaPromise;
  }

  async function ensureProfessionalProfile(){
    if(professionalProfilePromise)return professionalProfilePromise;
    professionalProfilePromise=(async()=>{const timer=perfStart('Profilo professionista lazy');try{
      await refreshFullIdentity();
      if(!hasScript('professional-settings-supabase-bridge.js'))await loadScript('professional-settings-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare le impostazioni del professionista.');
      await window.nubemoProfessionalSettingsBridge?.ready;
      if(!window.nubemoProfessionalSettingsBridge)throw new Error('Bridge impostazioni professionista non inizializzato.');
      await ensureProfessionalLogoLoaded();
    }finally{perfEnd(timer);}})().catch(error=>{professionalProfilePromise=null;throw error;});
    return professionalProfilePromise;
  }

  function patientTabName(action){if(action?.matches?.('[data-patient-tab]'))return action.dataset.patientTab||'';if(action?.matches?.('[data-drawer-tab]'))return action.dataset.drawerTab||'';return '';}

  async function prepareSpecificPatientTab(action){
    const name=patientTabName(action);const patientId=currentPatientId();
    if(name==='labs'){await ensureLabsTab(patientId);return true;}
    if(name==='plan'){await ensurePlanTab(patientId);return true;}
    if(name==='documents'){await ensureDocumentsTab(patientId);return true;}
    if(name==='privacy'){await ensurePrivacyTab(patientId);return true;}
    if(name==='account'){await ensureAccountTab(patientId);return true;}
    if(name==='diary'){await ensureDiaryTab(patientId);return true;}
    if(name==='trend'){await ensureTrendTab(patientId);return true;}
    if(name==='measures'){await ensureMeasuresTab(patientId);return true;}
    if(name==='visits'){await ensureVisitsTab(patientId);return true;}
    if(name==='notes'){await ensureNotesTab(patientId);return true;}
    return false;
  }

  function needsFullRuntime(target){
    const patientTab=target?.closest?.('[data-patient-tab]');if(patientTab)return !['summary','anamnesis','labs','plan','documents','privacy','account','diary','trend','measures','visits','notes'].includes(patientTab.dataset.patientTab);
    const drawerTab=target?.closest?.('[data-drawer-tab]');if(drawerTab)return !['summary','anamnesis','labs','plan','documents','privacy','account','diary','trend','measures','visits','notes'].includes(drawerTab.dataset.drawerTab);
    return !!target?.closest?.('[data-patient],#newPatient,#editPatientProfileLegacy,#patientMenuEditProfile,#deletePatient,#downloadProBackup,#uploadProBackup');
  }

  async function prepareRuntimeAction(action){
    await ensureFullRuntime();if(!action?.matches?.('[data-patient-tab],[data-drawer-tab]'))return;
    const patientId=currentPatientId();const adapter=window.nubemoProfessionalLegacyAdapter;
    if(patientId&&adapter?.ensurePatientHydrated){const timer=perfStart('Paziente completo lazy');try{await adapter.ensurePatientHydrated(patientId);}finally{perfEnd(timer);}}
  }

  function installLazyRuntimeGate(){
    document.addEventListener('click',event=>{
      const target=event.target;if(!target)return;
      const anyAction=target.closest?.('[data-view],[data-drawer-view],[data-bmi-category],[data-patient-tab],[data-drawer-tab],#openUnreadLabPatients,#openUnreadPatients,#goAgenda,[data-event],[data-patient],#newPatient,#editPatientProfileLegacy,#patientMenuEditProfile,#deletePatient,#downloadProBackup,#uploadProBackup');
      if(!anyAction)return;
      if(replayClicks.has(anyAction)){replayClicks.delete(anyAction);return;}
      if(isDashboardAction(anyAction)){window.nubemoProfessionalDashboardBootstrap?.restoreDashboard?.();return;}
      if(isAgendaAction(anyAction)){
        event.preventDefault();event.stopImmediatePropagation();const action=anyAction;const wasDisabled='disabled' in action?action.disabled:false;if('disabled' in action)action.disabled=true;
        void ensureAgenda().then(()=>{if('disabled' in action)action.disabled=wasDisabled;replayAction(action);}).catch(error=>{if('disabled' in action)action.disabled=wasDisabled;console.error('NUBEMO Agenda lazy:',error);alert('Non riesco a caricare l’Agenda. Riprova.');});return;
      }
      if(isProfessionalProfileAction(anyAction)){
        event.preventDefault();event.stopImmediatePropagation();const action=anyAction;const wasDisabled='disabled' in action?action.disabled:false;if('disabled' in action)action.disabled=true;
        void ensureProfessionalProfile().then(()=>{if('disabled' in action)action.disabled=wasDisabled;replayAction(action);}).catch(error=>{if('disabled' in action)action.disabled=wasDisabled;console.error('NUBEMO Profilo professionista lazy:',error);alert('Non riesco a caricare il Profilo professionista. Riprova.');});return;
      }
      const point=pointAction(target);
      if(point){event.preventDefault();event.stopImmediatePropagation();const wasDisabled='disabled' in point?point.disabled:false;if('disabled' in point)point.disabled=true;void preparePointAction(point).then(()=>{if('disabled' in point)point.disabled=wasDisabled;replayAction(point);}).catch(error=>{if('disabled' in point)point.disabled=wasDisabled;console.error('NUBEMO query puntuale:',error);alert('Non riesco a caricare questa sezione. Riprova.');});return;}

      const specificTabs=['labs','plan','documents','privacy','account','diary','trend','measures','visits','notes'];
      if(anyAction.matches('[data-patient-tab],[data-drawer-tab]')&&specificTabs.includes(patientTabName(anyAction))){
        event.preventDefault();event.stopImmediatePropagation();
        const action=anyAction;const tabName=patientTabName(action);const wasDisabled='disabled' in action?action.disabled:false;if('disabled' in action)action.disabled=true;
        void prepareSpecificPatientTab(action).then(()=>{if('disabled' in action)action.disabled=wasDisabled;replayAction(action);}).catch(error=>{
          if('disabled' in action)action.disabled=wasDisabled;console.error(`NUBEMO ${tabName} lazy:`,error);
          const messages={plan:'Non riesco a caricare il piano. Riprova.',documents:'Non riesco a caricare i documenti. Riprova.',privacy:'Non riesco a caricare la privacy. Riprova.',account:'Non riesco a caricare l’account. Riprova.',diary:'Non riesco a caricare il diario. Riprova.',trend:'Non riesco a caricare l’andamento. Riprova.',measures:'Non riesco a caricare le misure. Riprova.',visits:'Non riesco a caricare le visite. Riprova.',notes:'Non riesco a caricare le note. Riprova.',labs:'Non riesco a caricare gli esami. Riprova.'};
          alert(messages[tabName]||'Non riesco a caricare questa sezione. Riprova.');
        });return;
      }

      if(!needsFullRuntime(target))return;
      event.preventDefault();event.stopImmediatePropagation();const action=anyAction;const wasDisabled='disabled' in action?action.disabled:false;if('disabled' in action)action.disabled=true;
      void prepareRuntimeAction(action).then(()=>{if('disabled' in action)action.disabled=wasDisabled;replayAction(action);}).catch(error=>{if('disabled' in action)action.disabled=wasDisabled;console.error('NUBEMO runtime lazy:',error);alert('Non riesco a caricare questa sezione. Riprova.');});
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
      timer=perfStart('Dashboard bridge');await loadScript('professional-dashboard-bootstrap.js?v=nubemo40clean04','Impossibile preparare la Dashboard.');perfEnd(timer);
      timer=perfStart('Dashboard payload');await window.nubemoProfessionalDashboardBootstrap?.init?.(window.nubemoProfessionalContext);perfEnd(timer);
      if(logoutButton)logoutButton.style.display='inline-flex';
      timer=perfStart('pro.js');await loadScript('pro.js?v=nubemo-visits-couple1','Impossibile caricare l’Area Professionista.');perfEnd(timer);
      installLazyRuntimeGate();perfEnd(totalTimer);
    }catch(error){console.error('NUBEMO Professional guard:',error);showGuardError('Non è stato possibile verificare l’accesso. Torna al login e riprova.');}
  }
  authorize();
})();