// NUBEMO recovery 3.98 — identità paziente e stato percorso su Supabase.
// Il flusso "Modifica scheda" resta integralmente quello 3.98: il legacy
// adapter persiste le modifiche. Qui gestiamo solo creazione Auth e fine percorso.
(() => {
  'use strict';

  const app = document.getElementById('proApp');
  const services = window.nubemoProfessionalServices;
  const client = window.nubemoSupabase;
  if (!services || !client || !app) return;

  let currentPatientId = '';
  let patching = false;
  let creatingPatient = false;

  const esc = (value='') => String(value)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
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

  function readItalianDate(id) {
    const value=String(document.getElementById(id)?.value||'').trim();
    if(!value)return null;
    const m=value.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if(!m)return '';
    const iso=`${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    const date=new Date(`${iso}T12:00:00`);
    return !Number.isNaN(date.getTime())&&date.getFullYear()===Number(m[3])&&date.getMonth()+1===Number(m[2])&&date.getDate()===Number(m[1])?iso:'';
  }

  function optionalNumber(id) {
    const raw=String(document.getElementById(id)?.value||'').trim().replace(',','.');
    if(raw==='')return null;
    const value=Number(raw);
    return Number.isFinite(value)?value:NaN;
  }

  function clinicalFromForm() {
    const text=id=>String(document.getElementById(id)?.value||'').trim()||null;
    const checked=id=>!!document.getElementById(id)?.checked;
    return {
      goalWeight:optionalNumber('npGoal'),minWeight:optionalNumber('npMinWeight'),maxWeight:optionalNumber('npMaxWeight'),reasonableWeight:optionalNumber('npReasonableWeight'),theoreticalWeight:optionalNumber('npTheoreticalWeight'),
      work:text('npWork'),activity:text('npActivity'),activityFactor:optionalNumber('npActivityFactor'),smoking:text('npSmoking'),alcohol:text('npAlcohol'),diagnosis:text('npDiagnosis'),bowel:text('npBowel'),metabolism:text('npMetabolism'),feeg:text('npFeeg'),impedance:text('npImpedance'),
      familyObesity:checked('npFamObesity'),familyDiabetes:checked('npFamDiabetes'),familyHypertension:checked('npFamHypertension'),familyCardiovascular:checked('npFamCardiovascular'),familyDyslipidemia:checked('npFamDyslipidemia'),familyThyroid:checked('npFamThyroid'),
      previousDiets:text('npPreviousDiets'),allergies:text('npAllergies'),medications:text('npMedications'),giIssues:text('npGiIssues'),pastConditions:text('npPastConditions'),observations:text('npObservations'),objectives:text('npObjectives')
    };
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

  async function createRealPatient() {
    if(creatingPatient||document.body.dataset.proView!=='newPatient')return;
    const firstName=String(document.getElementById('npName')?.value||'').trim();
    const lastName=String(document.getElementById('npSurname')?.value||'').trim();
    const email=String(document.getElementById('npEmail')?.value||'').trim().toLowerCase();
    const birthDate=readItalianDate('npBirth');
    const sex=document.getElementById('npSex')?.value||null;
    const height=optionalNumber('npHeight');
    const clinical=clinicalFromForm();
    if(!firstName||!lastName)return alert('Inserisci nome e cognome.');
    if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return alert('Inserisci un indirizzo email valido.');
    if(birthDate==='')return alert('Controlla la data di nascita.');
    if(height!==null&&(!Number.isFinite(height)||height<80||height>250))return alert('Controlla l’altezza inserita.');
    for(const value of [clinical.goalWeight,clinical.minWeight,clinical.maxWeight,clinical.reasonableWeight,clinical.theoreticalWeight]){
      if(value!==null&&(!Number.isFinite(value)||value<30||value>300))return alert('Controlla i valori di peso inseriti.');
    }
    const button=document.getElementById('saveNewPatient');
    creatingPatient=true;if(button){button.disabled=true;button.textContent='Creazione...';}
    try{
      const {data,error}=await client.functions.invoke('swift-endpoint',{body:{action:'create-patient',first_name:firstName,last_name:lastName,email,birth_date:birthDate,sex,height_cm:height,pathway_start_date:null}});
      if(error)throw error;
      if(!data?.ok||!data?.patient_id)throw new Error(data?.error||'Creazione paziente non completata.');
      try{await services.savePatientAnamnesis(data.patient_id,clinical);}catch(clinicalError){console.error('NUBEMO recovery create patient anamnesis:',clinicalError);alert('Il paziente è stato creato e invitato, ma alcuni dati anamnestici non sono stati salvati. La scheda verrà ricaricata.');}
      if(typeof window.nubemoReloadProfessionalPatients==='function')await window.nubemoReloadProfessionalPatients();
      window.location.reload();
    }catch(error){
      console.error('NUBEMO recovery create patient:',error);
      alert(`Non è stato possibile creare il paziente. ${error?.message||''}`.trim());
      creatingPatient=false;if(button){button.disabled=false;button.textContent='Salva paziente';}
    }
  }

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

  async function reactivatePathway(patientId,button) {
    const row=endedPatients().find(p=>p.id===patientId);
    if(!row)return alert('Percorso terminato non disponibile.');
    if(!window.confirm(`Riattivare il percorso di ${patientName(row)}?`))return;
    if(button){button.disabled=true;button.textContent='Riattivazione...';}
    try{
      await services.setPatientPathwayStatus(context().professional?.id,row.id,'active');
      if(typeof window.nubemoReloadProfessionalPatients==='function')await window.nubemoReloadProfessionalPatients();
      const nav=document.querySelector('[data-view="patients"]');if(nav)nav.click();else window.location.reload();
    }catch(error){console.error('NUBEMO recovery reactivate pathway:',error);alert('Non è stato possibile riattivare il percorso.');if(button){button.disabled=false;button.textContent='Riattiva percorso';}}
  }

  function patchDetails() {
    if(document.body.dataset.proView!=='details')return;
    const patientId=inferCurrentPatient();if(!patientId)return;
    // Nessun secondo pulsante Modifica: quello 3.98 resta l’unico owner.
    const deleteButton=document.getElementById('deletePatient');
    if(deleteButton){
      if(deleteButton.textContent!=='Termina percorso')deleteButton.textContent='Termina percorso';
      if(deleteButton.dataset.endPathway!==patientId)deleteButton.dataset.endPathway=patientId;
    }
  }

  function patchEndedPatients() {
    if(document.body.dataset.proView!=='patients')return;
    const rows=endedPatients();
    const existing=document.getElementById('endedPatientsCard');
    if(!rows.length){existing?.remove();return;}
    const signature=rows.map(row=>`${row.id}:${row.relationship?.ended_at||''}:${patientName(row)}`).join('|');
    if(existing?.dataset.signature===signature)return;
    existing?.remove();
    const activeCard=app.querySelector('section.card');if(!activeCard)return;
    const card=document.createElement('section');card.className='card';card.id='endedPatientsCard';card.dataset.signature=signature;
    card.innerHTML=`<div class="section-head"><h2>Percorsi terminati</h2></div><div class="pro3-patients">${rows.map(row=>`<div class="pro3-patient" style="font-weight:400"><div class="patient-avatar">${esc(patientName(row).split(' ').map(x=>x[0]).slice(0,2).join(''))}</div><div><span style="display:block;font-size:15px;font-weight:700;color:#34484f">${esc(patientName(row))}</span><span style="display:block;margin-top:3px;font-size:12px;color:#7b898f">Percorso terminato${row.relationship?.ended_at?' · '+new Date(row.relationship.ended_at).toLocaleDateString('it-IT'):''}</span></div><button class="mini" type="button" data-reactivate-patient="${row.id}">Riattiva percorso</button></div>`).join('')}</div>`;
    activeCard.insertAdjacentElement('afterend',card);
    card.querySelectorAll('[data-reactivate-patient]').forEach(button=>button.addEventListener('click',()=>reactivatePathway(button.dataset.reactivatePatient,button)));
  }

  function patch(){if(patching)return;patching=true;try{patchNewPatientForm();patchDetails();patchEndedPatients();}finally{patching=false;}}

  document.addEventListener('click',event=>{
    rememberPatient(event.target);
    if(event.target?.closest?.('#saveNewPatient')&&document.body.dataset.proView==='newPatient'){
      event.preventDefault();event.stopImmediatePropagation();void createRealPatient();return;
    }
    const end=event.target?.closest?.('#deletePatient[data-end-pathway]');
    if(end){event.preventDefault();event.stopImmediatePropagation();void endPathway(end.dataset.endPathway);return;}
  },true);

  const observer=new MutationObserver(()=>queueMicrotask(patch));observer.observe(app,{childList:true,subtree:true});patch();
})();
