// NUBEMO 4.0 — Misure professionista lazy e puntuali.
(() => {
  'use strict';

  const services=()=>window.nubemoProfessionalServices;
  const client=window.nubemoSupabase;
  if(!client)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  const rowsByPatient=new Map();
  let currentPatientId='';
  let saving=false;

  const parse=(value,fallback)=>{try{return JSON.parse(value)}catch(_){return fallback}};
  const numberOrNull=value=>{if(value===''||value===undefined||value===null)return null;const n=Number(String(value).replace(',','.'));return Number.isFinite(n)?n:null;};

  function legacyMeasurement(row){
    return {
      _remoteId:row.id,
      date:row.measured_at,
      professionalWeight:row.weight_kg??'',
      waist:row.waist_cm??'',
      hips:row.hips_cm??'',
      notes:row.notes||''
    };
  }

  function publish(patientId,rows){
    const patients=parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]',[]);
    if(!Array.isArray(patients))throw new Error('Elenco pazienti non disponibile.');
    const index=patients.findIndex(row=>String(row?.id||'')===String(patientId));
    if(index<0)throw new Error('Paziente non disponibile nel contesto corrente.');
    patients[index]={...patients[index],measures:(rows||[]).map(legacyMeasurement)};
    localStorage.setItem(EXTRA_PATIENTS_KEY,JSON.stringify(patients));
  }

  async function ensurePatient(patientId,force=false){
    const id=String(patientId||'');
    if(!id)throw new Error('Paziente non valido.');
    currentPatientId=id;
    if(!force&&rowsByPatient.has(id)){
      publish(id,rowsByPatient.get(id));
      return rowsByPatient.get(id);
    }
    const rows=await services().loadPatientMeasurements(id);
    rowsByPatient.set(id,rows);
    publish(id,rows);
    return rows;
  }

  function parseDateInput(value){
    const match=String(value||'').trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if(!match)return '';
    const iso=`${match[3]}-${match[2]}-${match[1]}`;
    const d=new Date(`${iso}T12:00:00`);
    if(Number.isNaN(d.getTime())||d.getFullYear()!==Number(match[3])||d.getMonth()+1!==Number(match[2])||d.getDate()!==Number(match[1]))return '';
    return iso;
  }

  function value(id){return document.getElementById(id)?.value??'';}

  async function saveFromForm(){
    if(saving)return;
    const patientId=currentPatientId;
    if(!patientId)throw new Error('Paziente non disponibile.');

    const measuredAt=parseDateInput(value('pmDate'));
    if(!measuredAt){alert('Inserisci una data valida nel formato GG-MM-AAAA.');return;}

    const weight=numberOrNull(value('pmProfessionalWeight'));
    const waist=numberOrNull(value('pmWaist'));
    const hips=numberOrNull(value('pmHips'));
    if(weight!==null&&(weight<30||weight>300)){alert('Controlla il peso rilevato.');return;}
    if(waist!==null&&(waist<20||waist>300)){alert('Controlla il valore vita.');return;}
    if(hips!==null&&(hips<20||hips>300)){alert('Controlla il valore fianchi.');return;}

    saving=true;
    const button=document.getElementById('savePatientMeasure');
    if(button)button.disabled=true;
    try{
      let rows=rowsByPatient.get(patientId)||await ensurePatient(patientId);
      const oldDate=window.editMeasureDate||'';
      const oldRow=oldDate?rows.find(row=>String(row.measured_at)===String(oldDate)):null;
      const targetRow=rows.find(row=>String(row.measured_at)===String(measuredAt)&&row.id!==oldRow?.id)||null;
      const payload={measuredAt,weightKg:weight,waistCm:waist,hipsCm:hips,notes:String(value('pmNotes')||'').trim()||null};

      if(oldRow&&targetRow){
        await services().updatePatientMeasurement(targetRow.id,payload);
        const deleted=await client.rpc('soft_delete_associated_patient_measurement',{p_measurement_id:oldRow.id});
        if(deleted.error)throw deleted.error;
      }else if(oldRow){
        await services().updatePatientMeasurement(oldRow.id,payload);
      }else if(targetRow){
        await services().updatePatientMeasurement(targetRow.id,payload);
      }else{
        await services().createPatientMeasurement(patientId,payload);
      }

      rows=await services().loadPatientMeasurements(patientId);
      rowsByPatient.set(patientId,rows);
      publish(patientId,rows);
      window.editMeasureDate=null;
      document.getElementById('cancelPatientMeasure')?.click();
    }finally{
      saving=false;
      if(button&&document.body.contains(button))button.disabled=false;
    }
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#savePatientMeasure');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void saveFromForm().catch(error=>{
      console.error('NUBEMO Misure save lazy:',error);
      alert('Non riesco a salvare la misurazione. Riprova.');
    });
  },true);

  window.nubemoProfessionalMeasuresBridge=Object.freeze({
    ready:Promise.resolve(),
    ensurePatient,
    refresh:patientId=>ensurePatient(patientId||currentPatientId,true)
  });
})();
