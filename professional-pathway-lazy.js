// NUBEMO 4.0 — gestione percorso senza runtime completo.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  if(!client)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  let busy=false;
  let patientListReady=false;
  let patientListPromise=null;

  function loadScript(src,errorMessage){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.onload=resolve;
      script.onerror=()=>reject(new Error(errorMessage));
      document.body.appendChild(script);
    });
  }
  function hasScript(fragment){return [...document.scripts].some(script=>String(script.src||'').includes(fragment));}
  function parse(value,fallback){try{return JSON.parse(value)}catch(_){return fallback}}

  function currentPatientId(){
    const drawer=document.querySelector('[data-drawer-patient]')?.dataset.drawerPatient;
    if(drawer)return String(drawer);
    const title=document.querySelector('.patient-global-title')?.textContent?.trim()||'';
    const rows=parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]',[]);
    if(Array.isArray(rows)){
      const row=rows.find(item=>item?.id&&title.includes(String(item.name||'').trim()));
      if(row)return String(row.id);
    }
    return '';
  }

  function localPatient(patientId){
    const rows=parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]',[]);
    return Array.isArray(rows)?rows.find(row=>String(row?.id||'')===String(patientId))||null:null;
  }

  async function ensureDependencies(){
    if(!window.nubemoProfessionalServices){
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40clean04','Impossibile caricare i servizi paziente.');
      if(!window.nubemoProfessionalServices)throw new Error('Servizi paziente non disponibili.');
    }
  }

  async function refreshPatients(){
    const services=window.nubemoProfessionalServices;
    const dashboard=window.nubemoProfessionalDashboardBootstrap;
    const ctx=window.nubemoProfessionalContext||{};
    const professionalId=ctx.professional?.id;
    if(!services||!professionalId)throw new Error('Contesto professionista non disponibile.');

    const [loaded]=await Promise.all([
      services.loadPatients(professionalId),
      dashboard?.loadPatientsList?.(true)
    ]);
    window.nubemoProfessionalContext={
      ...window.nubemoProfessionalContext,
      patients:loaded.activePatients,
      endedPatients:loaded.endedPatients
    };
    patientListReady=true;
    return loaded;
  }

  async function ensureManagement(){
    if(!hasScript('professional-patient-management.js')){
      await loadScript('professional-patient-management.js?v=nubemo40clean04','Impossibile preparare la gestione del percorso.');
    }
    window.nubemoReloadProfessionalPatients=refreshPatients;
  }

  async function ensurePatientListLifecycle(){
    if(patientListReady)return;
    if(patientListPromise)return patientListPromise;
    patientListPromise=(async()=>{
      await ensureDependencies();
      const services=window.nubemoProfessionalServices;
      const professionalId=window.nubemoProfessionalContext?.professional?.id;
      if(!services||!professionalId)throw new Error('Contesto professionista non disponibile.');
      const loaded=await services.loadPatients(professionalId);
      window.nubemoProfessionalContext={
        ...window.nubemoProfessionalContext,
        patients:loaded.activePatients,
        endedPatients:loaded.endedPatients
      };
      await ensureManagement();
      patientListReady=true;
    })().finally(()=>{patientListPromise=null;});
    return patientListPromise;
  }

  async function endPathway(){
    if(busy)return;
    const patientId=currentPatientId();
    if(!patientId)return alert('Paziente non disponibile.');
    const row=localPatient(patientId);
    const name=String(row?.name||'il paziente');
    if(!confirm(`Terminare il percorso di ${name}?\n\nI dati resteranno disponibili nello storico in sola lettura.`))return;

    busy=true;
    const started=performance.now();
    try{
      const {error}=await client.rpc('end_current_professional_patient_pathway',{p_patient_id:patientId});
      if(error)throw error;
      await ensureDependencies();
      await refreshPatients();
      await ensureManagement();
      console.log(`[NUBEMO PERF] Termina percorso lazy: ${Math.round(performance.now()-started)} ms`);
      const nav=document.querySelector('[data-view="patients"],[data-drawer-view="patients"]');
      if(nav)nav.click();else window.location.reload();
    }catch(error){
      console.error('NUBEMO Termina percorso lazy:',error);
      alert(error?.message||'Non è stato possibile terminare il percorso. Riprova.');
    }finally{
      busy=false;
    }
  }

  document.addEventListener('click',event=>{
    const patientsNav=event.target?.closest?.('[data-view="patients"],[data-drawer-view="patients"],#openUnreadLabPatients,#openUnreadPatients');
    if(patientsNav){
      void ensurePatientListLifecycle().catch(error=>console.error('NUBEMO percorsi terminati lazy:',error));
    }

    const button=event.target?.closest?.('#deletePatient');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void endPathway();
  },true);
})();