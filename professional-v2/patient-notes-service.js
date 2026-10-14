const db=()=>window.nubemoSupabase;
const identity=()=>window.NUBEMO_PRO2_PROFILE;
async function ownProfessional(){
 const p=identity();
 if(!p?.id)throw Error("Sessione non disponibile.");
 const {data,error}=await db().from("professionals").select("id").eq("profile_id",p.id).single();
 if(error||!data)throw Error("Professionista non disponibile.");
 return data.id;
}
export async function loadRealNotes(patientId,activePathwayId){
 if(!activePathwayId)return [];
 const professionalId=await ownProfessional();
 const {data,error}=await db().from("professional_notes").select("id,content,created_at,updated_at")
 .eq("patient_id",patientId).eq("professional_id",professionalId).eq("pathway_id",activePathwayId)
 .is("deleted_at",null).order("created_at",{ascending:false});
 if(error)throw Error("Impossibile caricare le note: "+error.message);
 return (data||[]).map(n=>({id:n.id,text:n.content,createdAt:n.created_at,updatedAt:n.updated_at!==n.created_at?n.updated_at:null}));
}
export async function saveRealNote(patientId,pathwayId,id,content){
 if(!pathwayId)throw Error("Apri un percorso prima di inserire le note.");
 const professionalId=await ownProfessional();
 const text=String(content||"").trim();
 if(!text)throw Error("Inserisci il testo della nota.");
 const query=id?db().from("professional_notes").update({content:text}).eq("id",id).eq("patient_id",patientId).eq("pathway_id",pathwayId).eq("professional_id",professionalId):
 db().from("professional_notes").insert({content:text,patient_id:patientId,pathway_id:pathwayId,professional_id:professionalId});
 const {error}=await query;
 if(error)throw Error("Salvataggio non riuscito: "+error.message);
}
export async function deleteRealNote(patientId,pathwayId,id){
 if(!pathwayId)throw Error("Nessun percorso attivo.");
 const {error}=await db().rpc("pro2_soft_delete_professional_note",{
  p_note_id:id,p_patient_id:patientId,p_pathway_id:pathwayId
 });
 if(error)throw Error("Eliminazione non riuscita: "+error.message);
}
