// NUBEMO 4.0 — Visite professionista lazy e puntuali.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  const services=()=>window.nubemoProfessionalServices;
  if(!client)return;

  const APPT_KEY='diario-pro-appts-recovery-v1';
  const {getItem:nativeGetItem,setItem:nativeSetItem}=window.NubemoStorageKit.capture();

  const rowsByPatient=new Map();
  let currentPatientId='';
  let editingVisitId='';
  let saving=false;

  const parse=(value,fallback)=>{try{return JSON.parse(value)}catch(_){return fallback}};
  const localAppointments=()=>{
    const rows=parse(nativeGetItem.call(window.localStorage,APPT_KEY)||'[]',[]);
    return Array.isArray(rows)?rows:[];
  };
  const saveLocalAppointments=rows=>nativeSetItem.call(window.localStorage,APPT_KEY,JSON.stringify(rows||[]));

  function toLegacy(row,patientId){
    const start=new Date(row.starts_at);
    const end=new Date(row.ends_at||row.starts_at);
    const local=new Date(start.getTime()-start.getTimezoneOffset()*60000).toISOString();
    const duration=Math.max(1,Math.round((end-start)/60000)||30);
    const label=String(row.appointment_type||'').toLowerCase();
    const type=label.includes('prima')||label==='first'?'first':label.includes('personal')||label.includes('impegno')||label==='personal'?'personal':'control';
    return {
      id:row.id,
      patientId:type==='personal'?null:patientId,
      date:local.slice(0,10),
      time:local.slice(11,16),
      type,
      duration,
      title:type==='personal'?(row.notes||'Impegno personale'):'',
      note:type==='personal'?'':(row.notes||''),
      _visitLazy:true
    };
  }

  function publish(patientId,rows){
    const id=String(patientId||'');
    const current=localAppointments().filter(a=>String(a?.patientId||'')!==id);
    current.push(...(rows||[]).map(row=>toLegacy(row,id)));
    saveLocalAppointments(current);
  }

  async function ensurePatient(patientId,force=false){
    const id=String(patientId||'');
    if(!id)throw new Error('Paziente non valido.');
    currentPatientId=id;

    if(window.nubemoProfessionalLegacyAdapter?.ensurePatientHydrated){
      await window.nubemoProfessionalLegacyAdapter.ensurePatientHydrated(id);
      return services().loadPatientAppointments(id);
    }

    if(!force&&rowsByPatient.has(id)){
      publish(id,rowsByPatient.get(id));
      return rowsByPatient.get(id);
    }
    const rows=await services().loadPatientAppointments(id);
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

  function eventPayload(){
    const date=parseDateInput(value('eDate'));
    if(!date){alert('Inserisci la data nel formato gg-mm-aaaa');return null;}
    const type=value('eType')||'control';
    const patientId=type==='personal'?null:String(value('ePatient')||'');
    if(type!=='personal'&&!patientId){alert('Seleziona un paziente.');return null;}
    const time=String(value('eTime')||'');
    const start=new Date(`${date}T${time||'00:00'}:00`);
    if(Number.isNaN(start.getTime())){alert('Controlla data e ora.');return null;}
    const duration=Math.max(1,Number(value('eDuration'))||30);
    const end=new Date(start.getTime()+duration*60000);
    const title=type==='personal'?String(value('eTitle')||'Impegno personale'):'',
      note=String(value('eNote')||'');
    return {
      date,time,type,patientId,duration,title,note,
      startsAt:start.toISOString(),
      endsAt:end.toISOString(),
      appointmentType:type==='first'?'Prima visita':type==='personal'?'Impegno personale':'Controllo'
    };
  }

  async function hasConflict(payload){
    const professionalId=window.nubemoProfessionalContext?.professional?.id;
    if(!professionalId)return false;
    const {data,error}=await client.from('appointments')
      .select('id,starts_at,ends_at')
      .eq('professional_id',professionalId)
      .is('deleted_at',null);
    if(error)throw error;
    const start=new Date(payload.startsAt).getTime();
    const end=new Date(payload.endsAt).getTime();
    return (data||[]).some(row=>{
      if(String(row.id)===String(editingVisitId))return false;
      const otherStart=new Date(row.starts_at).getTime();
      const otherEnd=new Date(row.ends_at||row.starts_at).getTime();
      return start<otherEnd&&end>otherStart;
    });
  }

  async function updateAppointmentLink(appointmentId,patientId){
    const {data:links,error}=await client.from('appointment_patients')
      .select('id,patient_id,draft_patient_id')
      .eq('appointment_id',appointmentId);
    if(error)throw error;
    const old=links?.[0]||null;
    if(!patientId){
      if(old){
        const result=await client.from('appointment_patients').delete().eq('id',old.id);
        if(result.error)throw result.error;
      }
      return;
    }
    if(String(old?.patient_id||'')===String(patientId))return;
    if(old){
      const result=await client.from('appointment_patients').update({patient_id:patientId,draft_patient_id:null}).eq('id',old.id);
      if(result.error)throw result.error;
    }else{
      const result=await client.from('appointment_patients').insert({appointment_id:appointmentId,patient_id:patientId,draft_patient_id:null});
      if(result.error)throw result.error;
    }
  }

  async function setStartDateIfEmpty(patientId,date){
    if(!patientId||!date)return;
    const {data,error}=await client.from('patients').select('pathway_start_date').eq('id',patientId).single();
    if(error)throw error;
    if(data?.pathway_start_date)return;
    const result=await client.from('patients').update({pathway_start_date:date}).eq('id',patientId);
    if(result.error)throw result.error;
  }

  async function refreshAfterMutation(oldPatientId,newPatientId){
    const ids=[...new Set([oldPatientId,newPatientId].filter(Boolean).map(String))];
    for(const id of ids){
      const rows=await services().loadPatientAppointments(id);
      rowsByPatient.set(id,rows);
      publish(id,rows);
    }
  }

  async function saveEditedVisit(){
    if(saving||!editingVisitId)return;
    const payload=eventPayload();
    if(!payload)return;
    if(await hasConflict(payload)){
      alert('Orario già occupato da un altro appuntamento.');
      return;
    }

    saving=true;
    const button=document.getElementById('saveEvent');
    if(button)button.disabled=true;
    const oldPatientId=currentPatientId;
    try{
      const {error}=await client.from('appointments').update({
        starts_at:payload.startsAt,
        ends_at:payload.endsAt,
        appointment_type:payload.appointmentType,
        status:'scheduled',
        notes:payload.type==='personal'?(payload.title||payload.note||null):(payload.note||null)
      }).eq('id',editingVisitId);
      if(error)throw error;

      await updateAppointmentLink(editingVisitId,payload.patientId);
      if(payload.type==='first'&&payload.patientId)await setStartDateIfEmpty(payload.patientId,payload.date);
      await refreshAfterMutation(oldPatientId,payload.patientId);
      editingVisitId='';
      document.getElementById('cancelEvent')?.click();
    }finally{
      saving=false;
      if(button&&document.body.contains(button))button.disabled=false;
    }
  }

  async function deleteEditedVisit(){
    if(saving||!editingVisitId)return;
    if(!confirm('Vuoi eliminare questo appuntamento?'))return;
    saving=true;
    const id=editingVisitId;
    try{
      const {error}=await client.rpc('soft_delete_own_professional_appointment',{p_appointment_id:id});
      if(error)throw error;
      await refreshAfterMutation(currentPatientId,null);
      editingVisitId='';
      document.getElementById('cancelEvent')?.click();
    }finally{
      saving=false;
    }
  }

  document.addEventListener('click',event=>{
    if(window.nubemoProfessionalLegacyAdapter)return;

    const edit=event.target?.closest?.('[data-edit-visit]');
    if(edit){editingVisitId=String(edit.dataset.editVisit||'');return;}

    if(event.target?.closest?.('#cancelEvent')){
      editingVisitId='';
      return;
    }

    if(event.target?.closest?.('#saveEvent')&&editingVisitId){
      event.preventDefault();
      event.stopImmediatePropagation();
      void saveEditedVisit().catch(error=>{
        console.error('NUBEMO Visite save lazy:',error);
        alert('Non riesco a salvare la visita. Riprova.');
      });
      return;
    }

    if(event.target?.closest?.('#deleteEvent')&&editingVisitId){
      event.preventDefault();
      event.stopImmediatePropagation();
      void deleteEditedVisit().catch(error=>{
        console.error('NUBEMO Visite delete lazy:',error);
        alert('Non riesco a eliminare la visita. Riprova.');
      });
    }
  },true);

  window.nubemoProfessionalVisitsBridge=Object.freeze({
    ready:Promise.resolve(),
    ensurePatient,
    refresh:patientId=>ensurePatient(patientId||currentPatientId,true)
  });
})();
