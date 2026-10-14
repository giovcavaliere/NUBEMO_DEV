const client=()=>window.nubemoSupabase;
async function checked(promise,context){const {data,error}=await promise;if(error)throw Error(context+": "+error.message);return data;}
const dateTime=(date,time)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw Error("Data e ora non valide.");const local=new Date(date+"T"+time+":00");if(Number.isNaN(local.getTime()))throw Error("Data e ora non valide.");return local.toISOString();};
const timeString=iso=>new Date(iso).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit",hour12:false});
const dateString=iso=>{const d=new Date(iso);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
export async function loadRealDraftPatients(){
 const rows=await checked(client().from("professional_patient_drafts").select("id,first_name,last_name,phone,status").eq("status","draft").order("created_at",{ascending:false}),"Caricamento draft");
 return (rows||[]).map(d=>({...d,email:"",isDraft:true}));
}
export async function createRealDraft(values){
 const identity=window.NUBEMO_PRO2_PROFILE;
 if(!identity?.id)throw Error("Sessione professionista assente.");
 const pro=await checked(client().from("professionals").select("id").eq("profile_id",identity.id).single(),"Identità professionista");
 const created=await checked(client().from("professional_patient_drafts").insert({professional_id:pro.id,first_name:values.firstName,last_name:values.lastName,phone:values.phone||null,created_by_user_id:(await client().auth.getUser()).data.user?.id,status:"draft"}).select("id,first_name,last_name,phone,status").single(),"Creazione draft");
 return {...created,email:"",isDraft:true};
}
export async function loadRealAgenda(patients=[]){
 const [appointments,links,visits,drafts]=await Promise.all([
  checked(client().from("appointments").select("id,starts_at,ends_at,appointment_type,status,notes,modality,studio_id,reminder_email_requested").is("deleted_at",null).order("starts_at",{ascending:true}),"Caricamento Agenda"),
  checked(client().from("appointment_patients").select("id,appointment_id,patient_id,draft_patient_id,pathway_id"),"Associazioni appuntamenti"),
  checked(client().from("appointment_visits").select("id,appointment_patient_id,appointment_id,patient_id,visit_note,registered_at"),"Registrazioni visite"),
  loadRealDraftPatients()
 ]);
 const byPatient=new Map([...patients,...drafts].map(x=>[x.id,x]));
 return (appointments||[]).filter(a=>!["cancelled","canceled"].includes(a.status)).map(a=>{
  const owners=(links||[]).filter(x=>x.appointment_id===a.id);
  const ids=owners.map(x=>x.patient_id||x.draft_patient_id).filter(Boolean);
  const visitRecords={};
  for(const v of (visits||[]).filter(x=>x.appointment_id===a.id))visitRecords[v.patient_id]={registered:true,note:v.visit_note,registeredAt:v.registered_at};
  const start=new Date(a.starts_at),end=new Date(a.ends_at);
  const duration=Math.round((end-start)/60000);
  const name=a.appointment_type==="personal"?"Impegno personale":ids.map(id=>byPatient.get(id)).map(p=>p?[p.first_name,p.last_name].filter(Boolean).join(" "):"Paziente").join(" + ");
  const type=a.appointment_type||"control";
  return {id:a.id,date:dateString(a.starts_at),start:timeString(a.starts_at),duration,type,name,meta:(type==="personal"?"Impegno personale":type==="first"?"Prima visita":"Controllo")+" · "+duration+" min",patientId:ids[0]||null,patientIds:ids,modality:a.modality||"studio",studioId:a.studio_id||"",notes:a.notes||"",couple:ids.length===2,visitRecords,appointmentLocked:Object.keys(visitRecords).length>0};
 });
}
export async function createRealAppointment(values,drafts){
 const ids=values.patientIds||[];
 const draftIds=ids.filter(id=>drafts.some(d=>d.id===id));
 const patientIds=ids.filter(id=>!draftIds.includes(id));
 const start=dateTime(values.date,values.start),end=new Date(new Date(start).getTime()+values.duration*60000).toISOString();
 return checked(client().rpc("pro2_create_appointment",{p_starts_at:start,p_ends_at:end,p_type:values.type,p_patient_ids:patientIds,p_draft_ids:draftIds,p_notes:values.notes||null,p_modality:values.modality||null,p_studio_id:values.studioId||null}),"Creazione appuntamento");
}
export async function saveRealVisit(appointmentId,patientId,note){
 return checked(client().rpc("save_professional_visit",{p_appointment_id:appointmentId,p_patient_id:patientId,p_visit_note:note}),"Salvataggio visita");
}
export async function updateRealAppointment(event,values,{correction=false}={}){
 const start=dateTime(values.date,values.start),end=new Date(new Date(start).getTime()+Number(values.duration)*60000).toISOString();
 if(correction){
  await checked(client().rpc("correct_registered_visit_datetime",{p_appointment_id:event.id,p_starts_at:start,p_ends_at:end}),"Correzione appuntamento");
 }
 const payload={notes:values.notes};
 if(!event.appointmentLocked){Object.assign(payload,{appointment_type:values.type,starts_at:start,ends_at:end});}
 await checked(client().from("appointments").update(payload).eq("id",event.id).is("deleted_at",null),"Modifica appuntamento");
}
export async function deleteRealAppointment(id){
 await checked(client().rpc("soft_delete_own_professional_appointment",{p_appointment_id:id}),"Eliminazione appuntamento");
}
