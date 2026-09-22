// NUBEMO 4.0 — Agenda professionista lazy e puntuale.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  const context=window.nubemoProfessionalContext||{};
  const professionalId=context.professional?.id;
  if(!client||!professionalId)return;

  const APPT_KEY='diario-pro-appts-recovery-v1';
  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  const {getItem:previousGetItem,setItem:previousSetItem}=window.NubemoStorageKit.capture();

  let remoteAppointments=[];
  let linkByAppointment=new Map();
  let queue=Promise.resolve();
  let syncVersion=0;
  let hydrated=false;
  let latestAppointmentsSerialized='[]';
  let agendaPatientsSerialized='[]';

  const parse=(value,fallback)=>{try{return JSON.parse(value)}catch(_){return fallback}};

  function syncAgendaPatientsFromCanonical(){
    agendaPatientsSerialized=window.localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]';
    return agendaPatientsSerialized;
  }

  function restoreAgendaPatients(){
    if(agendaPatientsSerialized)previousSetItem.call(window.localStorage,EXTRA_PATIENTS_KEY,agendaPatientsSerialized);
  }

  function localPatients(){
    const rows=parse(agendaPatientsSerialized||'[]',[]);
    return Array.isArray(rows)?rows:[];
  }

  function isDraft(subjectId){
    if(!subjectId)return false;
    if(window.nubemoPatientLifecycleBridge?.isDraft?.(subjectId))return true;
    const row=localPatients().find(item=>String(item?.id||'')===String(subjectId));
    return !!(row?._draft===true||row?.relationshipStatus==='draft');
  }

  function draftName(subjectId){
    const row=localPatients().find(item=>String(item?.id||'')===String(subjectId));
    if(!row)return 'il contatto provvisorio';
    const name=[row.firstName||row.first_name,row.surname||row.last_name].filter(Boolean).join(' ').trim();
    return name||'il contatto provvisorio';
  }

  async function askAndDeleteDraft(subjectId){
    if(!subjectId||!isDraft(subjectId))return;
    const name=draftName(subjectId);
    const removeDraft=window.confirm(`Appuntamento eliminato.\n\nVuoi eliminare anche il contatto provvisorio ${name}?`);
    if(!removeDraft)return;

    try{
      const {error}=await client.from('professional_patient_drafts')
        .delete()
        .eq('id',subjectId)
        .eq('professional_id',professionalId);
      if(error)throw error;
      await window.nubemoPatientLifecycleBridge?.refresh?.();
      syncAgendaPatientsFromCanonical();
    }catch(error){
      console.error('NUBEMO draft delete after appointment:',error);
      window.alert('L’appuntamento è stato eliminato, ma non è stato possibile eliminare il contatto provvisorio.');
    }
  }

  function subjectLink(subjectId){
    if(!subjectId)return{patient_id:null,draft_patient_id:null};
    return isDraft(subjectId)
      ?{patient_id:null,draft_patient_id:subjectId}
      :{patient_id:subjectId,draft_patient_id:null};
  }

  function remoteType(row){
    const label=String(row?.appointment_type||'').toLowerCase();
    return label.includes('prima')||label==='first'?'first':label.includes('personal')||label.includes('impegno')||label==='personal'?'personal':'control';
  }

  function legacyAppointment(row,subjectId){
    const start=new Date(row.starts_at);
    const end=new Date(row.ends_at||row.starts_at);
    const local=new Date(start.getTime()-start.getTimezoneOffset()*60000).toISOString();
    const duration=Math.max(1,Math.round((end-start)/60000)||30);
    const type=remoteType(row);
    return {
      id:String(row.id),
      patientId:type==='personal'?null:(subjectId||null),
      date:local.slice(0,10),
      time:local.slice(11,16),
      type,
      duration,
      title:type==='personal'?(row.notes||'Impegno personale'):'',
      note:type==='personal'?'':(row.notes||'')
    };
  }

  function publish(){
    const rows=remoteAppointments.map(row=>legacyAppointment(row,linkByAppointment.get(row.id)||null));
    latestAppointmentsSerialized=JSON.stringify(rows);
    previousSetItem.call(window.localStorage,APPT_KEY,latestAppointmentsSerialized);
  }

  async function hydrate(expectedVersion=null){
    const dashboard=window.nubemoProfessionalDashboardBootstrap;
    if(dashboard?.loadPatientsList)await dashboard.loadPatientsList(true);
    syncAgendaPatientsFromCanonical();

    const {data:rows,error}=await client.from('appointments')
      .select('id,professional_id,starts_at,ends_at,appointment_type,status,notes,created_by_user_id,created_at,updated_at')
      .eq('professional_id',professionalId)
      .is('deleted_at',null)
      .order('starts_at');
    if(error)throw error;
    remoteAppointments=rows||[];
    linkByAppointment=new Map();
    const ids=remoteAppointments.map(row=>row.id);
    if(ids.length){
      const result=await client.from('appointment_patients')
        .select('appointment_id,patient_id,draft_patient_id')
        .in('appointment_id',ids);
      if(result.error)throw result.error;
      (result.data||[]).forEach(link=>linkByAppointment.set(link.appointment_id,link.patient_id||link.draft_patient_id||null));
    }

    // Prima visita/controllo senza paziente non è un evento valido in NUBEMO.
    // Rimuove anche gli eventuali record fantasma creati dal vecchio payload Dashboard.
    const invalid=remoteAppointments.filter(row=>remoteType(row)!=='personal'&&!linkByAppointment.get(row.id));
    if(invalid.length){
      for(const row of invalid){
        const result=await client.rpc('soft_delete_own_professional_appointment',{p_appointment_id:row.id});
        if(result.error)throw result.error;
      }
      const invalidIds=new Set(invalid.map(row=>String(row.id)));
      remoteAppointments=remoteAppointments.filter(row=>!invalidIds.has(String(row.id)));
    }

    hydrated=true;
    if(expectedVersion===null||expectedVersion===syncVersion)publish();
    return remoteAppointments;
  }

  function appointmentPayload(a){
    const start=new Date(`${a.date}T${a.time||'00:00'}:00`);
    if(Number.isNaN(start.getTime()))throw new Error('Data o ora appuntamento non valida.');
    const duration=Math.max(1,Number(a.duration)||30);
    const end=new Date(start.getTime()+duration*60000);
    return {
      starts_at:start.toISOString(),
      ends_at:end.toISOString(),
      appointment_type:a.type==='first'?'Prima visita':a.type==='personal'?'Impegno personale':'Controllo',
      status:'scheduled',
      notes:a.type==='personal'?(a.title||a.note||null):(a.note||null)
    };
  }

  async function setStartDateIfEmpty(patientId,date){
    if(!patientId||!date||isDraft(patientId))return;
    const {data,error}=await client.from('patients').select('pathway_start_date').eq('id',patientId).single();
    if(error)throw error;
    if(data?.pathway_start_date)return;
    const result=await client.from('patients').update({pathway_start_date:date}).eq('id',patientId);
    if(result.error)throw result.error;
  }

  async function replaceLink(appointmentId,subjectId){
    const {data:links,error}=await client.from('appointment_patients')
      .select('id,patient_id,draft_patient_id')
      .eq('appointment_id',appointmentId);
    if(error)throw error;
    const old=links?.[0]||null;
    if(!subjectId){
      if(old){const result=await client.from('appointment_patients').delete().eq('id',old.id);if(result.error)throw result.error;}
      return;
    }
    const next=subjectLink(subjectId);
    const oldSubject=old?.patient_id||old?.draft_patient_id||null;
    if(String(oldSubject||'')===String(subjectId))return;
    if(old){const result=await client.from('appointment_patients').update(next).eq('id',old.id);if(result.error)throw result.error;}
    else{const result=await client.from('appointment_patients').insert({appointment_id:appointmentId,...next});if(result.error)throw result.error;}
  }

  async function createAppointment(a){
    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError||!user)throw userError||new Error('Utente non disponibile.');
    const {data,error}=await client.from('appointments').insert({
      professional_id:professionalId,
      created_by_user_id:user.id,
      ...appointmentPayload(a)
    }).select('id').single();
    if(error)throw error;
    if(a.type!=='personal'&&a.patientId){
      const link=await client.from('appointment_patients').insert({appointment_id:data.id,...subjectLink(a.patientId)});
      if(link.error){await client.rpc('soft_delete_own_professional_appointment',{p_appointment_id:data.id});throw link.error;}
    }
    if(a.type==='first'&&a.patientId)await setStartDateIfEmpty(a.patientId,a.date);
    return data.id;
  }

  async function updateAppointment(remote,a){
    const result=await client.from('appointments').update(appointmentPayload(a)).eq('id',remote.id);
    if(result.error)throw result.error;
    await replaceLink(remote.id,a.type==='personal'?null:(a.patientId||null));
    if(a.type==='first'&&a.patientId)await setStartDateIfEmpty(a.patientId,a.date);
  }

  async function sync(serialized,version){
    if(window.nubemoProfessionalLegacyAdapter)return;
    if(version!==syncVersion)return;
    const parsed=parse(serialized,[]);
    if(!Array.isArray(parsed))return;
    if(!hydrated)await hydrate(version);
    if(version!==syncVersion)return;

    // Le righe __dash_* sono solo aggregati grafici della Dashboard e non sono appuntamenti.
    const incoming=parsed.filter(a=>{
      if(!a?.date)return false;
      if(String(a.id||'').startsWith('__dash_'))return false;
      if(a.type!=='personal'&&!a.patientId)return false;
      return true;
    });

    const remoteById=new Map(remoteAppointments.map(row=>[String(row.id),row]));
    const retained=new Set();

    for(const a of incoming){
      if(version!==syncVersion)return;
      const remote=remoteById.get(String(a.id));
      if(remote){
        retained.add(String(remote.id));
        await updateAppointment(remote,a);
      }else{
        const id=await createAppointment(a);
        retained.add(String(id));
      }
    }

    if(version!==syncVersion)return;
    const handledDrafts=new Set();
    for(const remote of remoteAppointments){
      if(!retained.has(String(remote.id))){
        const subjectId=linkByAppointment.get(remote.id)||null;
        const draftSubject=subjectId&&isDraft(subjectId)?String(subjectId):'';
        const result=await client.rpc('soft_delete_own_professional_appointment',{p_appointment_id:remote.id});
        if(result.error)throw result.error;
        if(draftSubject&&!handledDrafts.has(draftSubject)){
          handledDrafts.add(draftSubject);
          await askAndDeleteDraft(draftSubject);
        }
      }
    }

    if(version===syncVersion)await hydrate(version);
  }

  async function flush(){
    await ready;
    let observed;
    do{
      observed=queue;
      await observed;
    }while(observed!==queue);
  }

  window.NubemoStorageKit.patch('professional-agenda-supabase-bridge',{
    setItem:function(key,value){
      previousSetItem.call(this,key,value);
      if(this!==window.localStorage||String(key)!==APPT_KEY)return;
      if(window.nubemoProfessionalLegacyAdapter)return;
      const serialized=String(value);
      latestAppointmentsSerialized=serialized;
      const version=++syncVersion;
      queue=queue.then(()=>sync(serialized,version)).catch(error=>{
        console.error('NUBEMO Agenda sync:',error);
        window.dispatchEvent(new CustomEvent('nubemo:supabase-sync-error',{detail:{domain:'agenda',message:error?.message||String(error)}}));
      });
    }
  }, [APPT_KEY]);

  document.addEventListener('click',event=>{
    const dashboardAction=event.target?.closest?.('[data-view="dashboard"],[data-drawer-view="dashboard"]');
    if(!dashboardAction)return;
    restoreAgendaPatients();
    if(latestAppointmentsSerialized)previousSetItem.call(window.localStorage,APPT_KEY,latestAppointmentsSerialized);
  },true);

  const ready=hydrate();

  window.nubemoProfessionalAgendaBridge=Object.freeze({
    ready,
    refresh:async()=>{await flush();return hydrate();},
    syncPatients:syncAgendaPatientsFromCanonical,
    flush,
    restoreContext:()=>{restoreAgendaPatients();if(latestAppointmentsSerialized)previousSetItem.call(window.localStorage,APPT_KEY,latestAppointmentsSerialized);}
  });
})();