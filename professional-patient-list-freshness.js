// NUBEMO 4.0 — stato canonico elenco Pazienti/Draft tra viste.
(() => {
  'use strict';

  const patientBypass=new WeakSet();
  const eventBypass=new WeakSet();
  let refreshing=null;
  let agendaPreparing=null;
  let lifecyclePreparing=null;

  function hasScript(fragment){
    return [...document.scripts].some(script=>String(script.src||'').includes(fragment));
  }

  function loadScript(src,errorMessage){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.onload=resolve;
      script.onerror=()=>reject(new Error(errorMessage));
      document.body.appendChild(script);
    });
  }

  function localDraft(patientId){
    try{
      const rows=JSON.parse(window.nubemoProfessionalRuntimeStore.storage.getItem('diario-pro-extra-patients-v1')||'[]');
      if(!Array.isArray(rows))return null;
      return rows.find(row=>String(row?.id||'')===String(patientId||'')&&(row?._draft===true||row?.relationshipStatus==='draft'))||null;
    }catch(_){return null;}
  }

  async function ensureLifecycleBridge(){
    if(window.nubemoPatientLifecycleBridge)return window.nubemoPatientLifecycleBridge;
    if(lifecyclePreparing)return lifecyclePreparing;
    lifecyclePreparing=(async()=>{
      if(!hasScript('professional-patient-lifecycle-bridge.js'))
        await loadScript('professional-patient-lifecycle-bridge.js?v=nubemo40clean04draftfix1','Impossibile preparare i contatti paziente.');
      await window.nubemoPatientLifecycleBridge?.ready;
      if(!window.nubemoPatientLifecycleBridge)throw new Error('Gestione contatti non disponibile.');
      return window.nubemoPatientLifecycleBridge;
    })().finally(()=>{lifecyclePreparing=null;});
    return lifecyclePreparing;
  }

  async function refreshPatientList(){
    const bridge=window.nubemoProfessionalDashboardBootstrap;
    if(!bridge?.loadPatientsList)return;
    if(refreshing)return refreshing;
    refreshing=bridge.loadPatientsList(true).finally(()=>{refreshing=null;});
    return refreshing;
  }

  async function prepareAgendaForDashboardEvent(){
    if(agendaPreparing)return agendaPreparing;
    agendaPreparing=(async()=>{
      const dashboard=window.nubemoProfessionalDashboardBootstrap;
      if(!dashboard?.loadPatientsList)throw new Error('Dashboard bridge non disponibile.');

      // Il click su un appuntamento Dashboard deve aprire lo stesso stato canonico
      // usato entrando dall'Agenda, mai il payload sintetico della Dashboard.
      await dashboard.loadPatientsList(true);

      if(!hasScript('professional-services.js'))
        await loadScript('professional-services.js?v=nubemo40clean04','Impossibile caricare i servizi Supabase dell’Agenda.');
      if(!window.nubemoProfessionalServices)throw new Error('Servizi Supabase Agenda non inizializzati.');

      if(!hasScript('professional-settings-supabase-bridge.js'))
        await loadScript('professional-settings-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare le impostazioni dell’Agenda.');
      await window.nubemoProfessionalSettingsBridge?.ready;

      await ensureLifecycleBridge();

      if(!hasScript('professional-agenda-supabase-bridge.js')){
        await loadScript('professional-agenda-supabase-bridge.js?v=nubemo40clean04','Impossibile preparare l’Agenda.');
        await window.nubemoProfessionalAgendaBridge?.ready;
      }else{
        await window.nubemoProfessionalAgendaBridge?.refresh?.();
      }

      if(!window.nubemoProfessionalAgendaBridge)throw new Error('Bridge Agenda non inizializzato.');
    })().finally(()=>{agendaPreparing=null;});
    return agendaPreparing;
  }

  // Pazienti deve sempre riflettere il DB dopo creazioni/modifiche.
  // In parallelo precarichiamo il lifecycle bridge: il primo click su un draft
  // non deve avviare il runtime completo dell'Area Professionista.
  document.addEventListener('click',event=>{
    const action=event.target?.closest?.('[data-view="patients"],[data-drawer-view="patients"],#openUnreadLabPatients,#openUnreadPatients');
    if(!action)return;

    if(patientBypass.has(action)){
      patientBypass.delete(action);
      return;
    }

    const bridge=window.nubemoProfessionalDashboardBootstrap;
    if(!bridge?.loadPatientsList)return;

    event.preventDefault();
    event.stopImmediatePropagation();

    void Promise.all([refreshPatientList(),ensureLifecycleBridge()]).then(()=>{
      patientBypass.add(action);
      action.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    }).catch(error=>{
      console.error('NUBEMO refresh elenco pazienti:',error);
      alert('Non riesco ad aggiornare l’elenco pazienti. Riprova.');
    });
  },true);

  // Un draft viene aperto direttamente dal lifecycle bridge prima che il guard
  // possa trattarlo come paziente reale e avviare il runtime completo.
  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-patient],[data-drawer-patient]');
    if(!target)return;
    const id=target.dataset.patient||target.dataset.drawerPatient||'';
    if(!localDraft(id))return;

    event.preventDefault();
    event.stopImmediatePropagation();

    void ensureLifecycleBridge().then(bridge=>{
      if(!bridge.openDraft?.(id))throw new Error('Contatto provvisorio non disponibile.');
    }).catch(error=>{
      console.error('NUBEMO apertura contatto draft:',error);
      alert('Non riesco ad aprire il contatto provvisorio. Riprova.');
    });
  },true);

  // Dalla Dashboard un appuntamento veniva aperto direttamente sul payload minimo
  // Dashboard. Prima del click reale allineiamo Agenda + pazienti da Supabase e poi
  // ripetiamo esattamente lo stesso click. Il percorso menu Agenda resta invariato.
  document.addEventListener('click',event=>{
    const action=event.target?.closest?.('[data-event]');
    if(!action||document.body.dataset.proView!=='dashboard')return;

    if(eventBypass.has(action)){
      eventBypass.delete(action);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    const wasDisabled='disabled' in action?action.disabled:false;
    if('disabled' in action)action.disabled=true;

    void prepareAgendaForDashboardEvent().then(()=>{
      if('disabled' in action)action.disabled=wasDisabled;
      eventBypass.add(action);
      action.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    }).catch(error=>{
      if('disabled' in action)action.disabled=wasDisabled;
      console.error('NUBEMO apertura appuntamento Dashboard:',error);
      alert('Non riesco ad aprire questo appuntamento. Riprova.');
    });
  },true);

  window.nubemoProfessionalPatientListFreshness=Object.freeze({
    refresh:refreshPatientList,
    prepareAgendaForDashboardEvent
  });
})();