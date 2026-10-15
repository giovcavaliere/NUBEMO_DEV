import {getRecentActivity} from "./patient-detail-model.js";

const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const date=v=>v?new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"long",year:"numeric"}).format(new Date(v.length===10?v+"T12:00:00":v)):"Non registrata";
export async function loadPatientOverview(patientId,patients){
 const patient=patients.find(p=>p.id===patientId);
 if(!patient)throw Error("Paziente non associato al professionista.");
 const client=window.nubemoSupabase;
 const identity=window.NUBEMO_PRO2_PROFILE;
 if(!identity?.id||!client)throw Error("Sessione non disponibile.");
 const {data:pro,error:proError}=await client.from("professionals").select("id").eq("profile_id",identity.id).single();
 if(proError||!pro)throw Error("Professionista non disponibile.");
 const {data:link,error:linkError}=await client.from("professional_patients").select("id,status,created_at").eq("professional_id",pro.id).eq("patient_id",patientId).single();
 if(linkError||!link)throw Error("Paziente non autorizzato.");
 const {data:pathways,error:pathwayError}=await client.from("patient_pathways").select("id,status,started_at,ended_at,pathway_start_date,created_at,objective_key,custom_objective,objective_note,closing_note").eq("professional_patient_id",link.id).order("created_at",{ascending:false});
 if(pathwayError)throw Error("Impossibile caricare i percorsi reali.");
 return {patient,link,pathways:pathways||[],professionalId:pro.id};
}

export async function loadPatientRecentActivity({patient,pathways,professionalId}){
 const client=window.nubemoSupabase;
 if(!client||!window.NUBEMO_PRO2_PROFILE?.id||!professionalId)throw Error("Sessione non disponibile.");
 const ids=pathways.map(p=>p.id);
 if(!ids.length)return [];
 const limit=4;
 const rows=async query=>{const {data,error}=await query;if(error)throw Error("Impossibile caricare le attività recenti: "+error.message);return data||[];};
 // Each source is restricted to this patient's authorized professional relationship.
 const [documents,diary,visitLinks]=await Promise.all([
  rows(client.from("documents").select("id,pathway_id,title,original_filename,uploaded_by_user_id,created_at").eq("patient_id",patient.id).in("pathway_id",ids).is("deleted_at",null).order("created_at",{ascending:false}).limit(limit)),
  rows(client.from("diary_entries").select("id,pathway_id,entry_date,updated_at,created_at").eq("patient_id",patient.id).in("pathway_id",ids).is("deleted_at",null).order("updated_at",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).limit(limit)),
  rows(client.from("appointment_patients").select("id,pathway_id").eq("patient_id",patient.id).in("pathway_id",ids))
 ]);
 const authorIds=[...new Set(documents.map(d=>d.uploaded_by_user_id).filter(Boolean))];
 const [visits,authors]=await Promise.all([
  visitLinks.length?rows(client.from("appointment_visits").select("id,appointment_patient_id,registered_at,updated_at,appointments!inner(appointment_type,starts_at)").eq("patient_id",patient.id).eq("professional_id",professionalId).in("appointment_patient_id",visitLinks.map(v=>v.id)).is("appointments.deleted_at",null).order("updated_at",{ascending:false,nullsFirst:false}).order("registered_at",{ascending:false}).limit(limit)):[],
  authorIds.length?rows(client.from("profiles").select("auth_user_id,role").in("auth_user_id",authorIds)):[]
 ]);
 const roles=new Map(authors.map(a=>[a.auth_user_id,a.role]));
 const paths=new Map(pathways.map(p=>[p.id,p]));
 const links=new Map(visitLinks.map(v=>[v.id,v.pathway_id]));
 const historical=pathwayId=>paths.get(pathwayId)?.status==="ended"?" · Percorso concluso":"";
 const documentActivity=documents.map(d=>{
  const role=roles.get(d.uploaded_by_user_id);
  const origin=role==="professional"?"Professionista":role==="patient"?"Paziente":"";
  return {id:d.id,type:"document",date:d.created_at,title:d.title||d.original_filename||"Documento",
   description:(role==="professional"?"Caricato dal professionista":role==="patient"?"Caricato dal paziente":"Documento caricato")+historical(d.pathway_id),origin};
 });
 const visitActivity=visits.map(v=>({id:v.id,status:"completed",date:v.updated_at||v.registered_at,
  title:v.appointments?.appointment_type==="first"?"Prima visita":"Visita",
  description:(v.appointments?.starts_at?"Visita del "+date(v.appointments.starts_at):"Visita registrata")+historical(links.get(v.appointment_patient_id))}));
 const updates=diary.map(d=>({id:d.id,type:"diary",date:d.updated_at||d.created_at,title:"Diario aggiornato",
  description:(d.entry_date?"Compilazione del "+date(d.entry_date):"Diario alimentare")+historical(d.pathway_id)}));
 return getRecentActivity({documents:documentActivity,visits:visitActivity,diary:{updates},activities:[]},{limit});
}
export function renderPatientOverview(root,{patient,link,pathways}){
 const name=[patient.first_name,patient.last_name].filter(Boolean).join(" ");
 const active=pathways.find(p=>p.status==="active");
 const state=link.status==="ended"?"Relazione conclusa":link.status==="pending"?"Associazione in attesa":"Associato al professionista";
 root.innerHTML=`<div class="patient-detail-page">
   <div class="detail-panel">
     <a href="#patients" class="detail-back-link">← Torna ai pazienti</a>
     <h1>${esc(name)}</h1>
     <p>${esc(state)}</p>
     <div class="detail-fields">
       <div class="detail-field"><dt>Età</dt><dd>${patient.age==null?"Non indicata":esc(patient.age)+" anni"}</dd></div>
       <div class="detail-field"><dt>Email</dt><dd>${esc(patient.email||"Non indicata")}</dd></div>
       <div class="detail-field"><dt>Telefono</dt><dd>${esc(patient.phone||"Non indicato")}</dd></div>
       <div class="detail-field"><dt>Inserito il</dt><dd>${date(patient.created_at)}</dd></div>
     </div>
   </div>
   <section class="detail-panel">
     <h2>Panoramica del percorso</h2>
     ${active?`<p>Percorso attivo dal ${date(active.pathway_start_date||active.started_at)}.</p>`:
       '<p>Nessun percorso attivo. La creazione del percorso sarà disponibile nella fase dedicata.</p>'}
     <h3>Storico percorsi</h3>
     ${pathways.length?`<ul>${pathways.map(p=>`<li>${esc(p.status)} · ${date(p.pathway_start_date||p.started_at||p.created_at)}</li>`).join("")}</ul>`:
       '<p>Nessun percorso ancora registrato.</p>'}
   </section>
   <section class="detail-panel">
     <h2>Dati clinici e attività</h2>
     <p>Misure, visite, diario e documenti verranno collegati a Supabase nelle rispettive fasi di migrazione. Nessun dato dimostrativo è visualizzato.</p>
   </section>
 </div>`;
}
