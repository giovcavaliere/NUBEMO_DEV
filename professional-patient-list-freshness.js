// NUBEMO 4.0 — stato canonico elenco Pazienti/Draft tra viste.
(() => {
  'use strict';

  const patientBypass=new WeakSet();
  const eventBypass=new WeakSet();
  let refreshing=null;
  let agendaPreparing=null;

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

      if(!hasScript('professional-patient-lifecycle-bridge.js'))
        await loadScript('professional-patient-lifecycle-bridge.js?v=nubemo40clean04','Impossibile preparare i contatti dell’Agenda.');
      await window.nubemoPatientLifecycleBridge?.ready;

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

    void refreshPatientList().then(()=>{
      patientBypass.add(action);
      action.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    }).catch(error=>{
      console.error('NUBEMO refresh elenco pazienti:',error);
      alert('Non riesco ad aggiornare l’elenco pazienti. Riprova.');
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