const db=()=>window.nubemoSupabase;
const fields={weight:"weight_kg",height:"height_cm",waist:"waist_cm",hips:"hips_cm",arm:"arm_cm",thigh:"thigh_cm",bodyFat:"fm_pct",muscleMass:"mm_pct",ecm:"ecm_pct",bcm:"bcm_pct",ffm:"ffm_pct"};
const columns=["id","measured_at","measured_time","notes","created_at",...Object.values(fields)].join(",");
async function result(query,message){const {data,error}=await query;if(error)throw Error(message+": "+error.message);return data;}
export async function loadLiveMeasurements(patientId,pathwayId){
 if(!pathwayId)return [];
 const data=await result(db().from("patient_measurements").select(columns).eq("patient_id",patientId).eq("pathway_id",pathwayId).is("deleted_at",null).order("measured_at",{ascending:true}).order("measured_time",{ascending:true}),"Caricamento misurazioni");
 return (data||[]).map(row=>({id:row.id,date:row.measured_at,time:row.measured_time?String(row.measured_time).slice(0,5):"",notes:row.notes||"",...Object.fromEntries(Object.entries(fields).map(([name,key])=>[name,row[key]==null?null:Number(row[key])]))}));
}
export async function saveLiveMeasurement(patientId,pathwayId,measurement){
 if(!pathwayId)throw Error("È necessario un percorso attivo.");
 const {id,date,time,notes}=measurement;
 const payload={measured_at:date,measured_time:time||null,notes:notes||null};
 for(const [field,column] of Object.entries(fields))payload[column]=measurement[field]??null;
 if(id&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){
  await result(db().from("patient_measurements").update(payload).eq("id",id).eq("patient_id",patientId).eq("pathway_id",pathwayId).is("deleted_at",null),"Modifica misurazione");
 }else{
  const {data:{user},error}=await db().auth.getUser();
  if(error||!user)throw Error("Sessione non disponibile.");
  await result(db().from("patient_measurements").insert({...payload,patient_id:patientId,pathway_id:pathwayId,created_by_user_id:user.id}),"Salvataggio misurazione");
 }
}
export async function deleteLiveMeasurement(patientId,pathwayId,id){
 await result(db().rpc("pro2_soft_delete_measurement",{p_id:id,p_patient_id:patientId,p_pathway_id:pathwayId}),"Eliminazione misurazione");
}
