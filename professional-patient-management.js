// NUBEMO — identità paziente e stato percorso su Supabase.
// Il flusso "Modifica scheda" resta integralmente quello esistente: il motore UI
// adapter persiste le modifiche. Qui gestiamo identità, recapiti e stato percorso.
(() => {
  'use strict';

  const app = document.getElementById('proApp');
  const services = window.nubemoProfessionalServices;
  const client = window.nubemoSupabase;
  if (!services || !client || !app) return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  let currentPatientId = '';
  let patching = false;

  const context = () => window.nubemoProfessionalContext || {};
  const activePatients = () => Array.isArray(context().patients) ? context().patients : [];
  const endedPatients = () => Array.isArray(context().endedPatients) ? context().endedPatients : [];
  const allPatients = () => [...activePatients(),...endedPatients()];
  const patientById = id => allPatients().find(row => row.id === id) || null;
  const patientName = row => {
    const p=row?.profile||{};
    return [p.first_name,p.last_name].filter(Boolean).join(' ').trim() || p.email || 'Paziente';
  };

  function rememberPatient(target) {
    const b=target?.closest?.('[data-patient]');
    if(b?.dataset?.patient)currentPatientId=b.dataset.patient;
    const d=target?.closest?.('[data-drawer-patient]');
    if(d?.dataset?.drawerPatient)currentPatientId=d.dataset.drawerPatient;
  }

  function inferCurrentPatient() {
    if(currentPatientId&&patientById(currentPatientId))return currentPatientId;
    if(document.body.dataset.proView!=='details')return '';
    const title=document.querySelector('.patient-global-title')?.textContent?.trim()||'';
    const row=activePatients().find(p=>title.includes(patientName(p)));
    if(row)currentPatientId=row.id;
    return currentPatientId;
  }

  function editPatientId(){
    if(currentPatientId&&patientById(currentPatientId))return currentPatientId;
    const first=String(document.getElementById('epName')?.value||'').trim();
    const last=String(document.getElementById('epSurname')?.value||'').trim();
    const row=activePatients().find(x=>String(x.profile?.first_name||'').trim()===first&&String(x.profile?.last_name||'').trim()===last);
    if(row)currentPatientId=row.id;
    return currentPatientId;
  }

  function patchNewPatientForm() {
    if(document.body.dataset.proView!=='newPatient'||document.getElementById('npEmail'))return;
    const surname=document.getElementById('npSurname');
    if(!surname)return;
    const label=document.createElement('label');label.htmlFor='npEmail';label.textContent='Email';
    const input=document.createElement('input');input.id='npEmail';input.type='email';input.inputMode='email';input.autocomplete='email';input.placeholder='es. mario.rossi@email.it';
    const note=document.createElement('small');note.className='muted';note.textContent='A questo indirizzo verrà inviato l’invito per accedere all’Area Paziente.';
    surname.insertAdjacentElement('afterend',note);
    surname.insertAdjacentElement('afterend',input);
    surname.insertAdjacentElement('afterend',label);
  }

  function patchEditPatientPhone(){
    if(document.body.dataset.proView!=='editProfile'||document.getElementById('epPhone'))return;
    const surname=document.getElementById('epSurname');if(!surname)return;
    const row=patientById(editPatientId());
    const label=document.createElement('label');label.htmlFor='epPhone';label.textContent='Telefono';
    const input=document.createElement('input');input.id='epPhone';input.type='tel';input.inputMode='tel';input.autocomplete='tel';input.value=row?.profile?.phone||'';
    surname.insertAdjacentElement('afterend',input);surname.insertAdjacentElement('afterend',label);
  }

  function stageEditedPatientPhone(){
    const id=editPatientId(),input=document.getElementById('epPhone');if(!id||!input)return;
    try{
      const rows=JSON.parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]');
      if(!Array.isArray(rows))return;
      const row=rows.find(x=>x?.id===id);if(!row)return;
      row.phone=String(input.value||'').trim();
      localStorage.setItem(EXTRA_PATIENTS_KEY,JSON.stringify(rows));
    }catch(error){console.error('NUBEMO patient phone stage:',error);}
  }

  // La creazione del paziente e' gestita da
  // professional-patient-lifecycle-bridge.js (Edge Function patient-lifecycle).
  // Qui esisteva una seconda implementazione completa verso la Edge Function
  // swift-endpoint, mai raggiunta: il lifecycle bridge si carica prima e
  // blocca l'evento. E' stata rimossa.

  async function endPathway(patientId) {
    const row=activePatients().find(p=>p.id===patientId);
    if(!row)return alert('Paziente attivo non disponibile.');
    if(!window.confirm(`Terminare il percorso di ${patientName(row)}?\n\nIl paziente non verrà cancellato e potrà essere riattivato in seguito.`))return;
    try{
      await services.setPatientPathwayStatus(context().professional?.id,row.id,'ended');
      if(typeof window.nubemoReloadProfessionalPatients==='function')await window.nubemoReloadProfessionalPatients();
      currentPatientId='';
      const nav=document.querySelector('[data-view="patients"]');
      if(nav)nav.click();else window.location.reload();
    }catch(error){console.error('NUBEMO recovery end pathway:',error);alert('Non è stato possibile terminare il percorso.');}
  }

  function patchDetails() {
    if(document.body.dataset.proView!=='details')return;
    const patientId=inferCurrentPatient();if(!patientId)return;
    const deleteButton=document.getElementById('deletePatient');
    if(deleteButton){
      if(deleteButton.textContent!=='Termina percorso')deleteButton.textContent='Termina percorso';
      if(deleteButton.dataset.endPathway!==patientId)deleteButton.dataset.endPathway=patientId;
    }
  }

  // I pazienti terminati sono ora renderizzati unicamente da
  // professional-patient-groups.js. La vecchia card endedPatientsCard
  // duplicava la stessa categoria e non deve più essere ricreata.
  function removeLegacyEndedPatientsCard(){
    document.getElementById('endedPatientsCard')?.remove();
  }

  function patch(){
    if(patching)return;
    patching=true;
    try{
      patchNewPatientForm();
      patchEditPatientPhone();
      patchDetails();
      removeLegacyEndedPatientsCard();
    }finally{patching=false;}
  }

  document.addEventListener('click',event=>{
    rememberPatient(event.target);
    if(event.target?.closest?.('#saveEditProfile')&&document.body.dataset.proView==='editProfile')stageEditedPatientPhone();
    const end=event.target?.closest?.('#deletePatient[data-end-pathway]');
    if(end){event.preventDefault();event.stopImmediatePropagation();void endPathway(end.dataset.endPathway);return;}
  },true);

  const observer=new MutationObserver(()=>queueMicrotask(patch));
  observer.observe(app,{childList:true,subtree:true});
  patch();
})();