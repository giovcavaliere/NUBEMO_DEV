// NUBEMO 4.0 — Termina/Riattiva percorso senza runtime completo.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  if(!client)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  let busy=false;

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
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40clean02','Impossibile caricare i servizi paziente.');
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
    return loaded;
  }

  async function ensureManagement(){
    if(!hasScript('professional-patient-management.js')){
      await loadScript('professional-patient-management.js?v=nubemo40clean02','Impossibile preparare la gestione del percorso.');
    }
    window.nubemoReloadProfessionalPatients=refreshPatients;
  }

  async function endPathway(){
    if(busy)return;
    const patientId=currentPatientId();
    if(!patientId)return alert('Paziente non disponibile.');
    const row=localPatient(patientId);
    const name=String(row?.name||'il paziente');
    if(!confirm(`Terminare il percorso di ${name}?\n\nIl paziente non verrà cancellato e potrà essere riattivato in seguito.`))return;

    busy=true;
    const started=performance.now();
    try{
      await ensureDependencies();
      const professionalId=window.nubemoProfessionalContext?.professional?.id;
      if(!professionalId)throw new Error('Professionista non disponibile.');
      await window.nubemoProfessionalServices.setPatientPathwayStatus(professionalId,patientId,'ended');
      await refreshPatients();
      await ensureManagement();
      console.log(`[NUBEMO PERF] Termina percorso lazy: ${Math.round(performance.now()-started)} ms`);
      const nav=document.querySelector('[data-view="patients"],[data-drawer-view="patients"]');
      if(nav)nav.click();else window.location.reload();
    }catch(error){
      console.error('NUBEMO Termina percorso lazy:',error);
      alert('Non è stato possibile terminare il percorso. Riprova.');
    }finally{
      busy=false;
    }
  }

  // Registrato prima del guard: intercetta solo Termina percorso e impedisce il runtime completo.
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#deletePatient');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void endPathway();
  },true);
})();