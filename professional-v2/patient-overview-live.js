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
 const {data:pathways,error:pathwayError}=await client.from("patient_pathways").select("id,status,started_at,ended_at,pathway_start_date,created_at").eq("professional_patient_id",link.id).order("created_at",{ascending:false});
 if(pathwayError)throw Error("Impossibile caricare i percorsi reali.");
 return {patient,link,pathways:pathways||[]};
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
