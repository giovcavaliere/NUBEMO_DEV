const client=()=>window.nubemoSupabase;
const COLUMNS=["goal_weight_kg","min_weight_kg","max_weight_kg","reasonable_weight_kg","theoretical_weight_kg","objectives","work","activity","activity_factor","smoking","alcohol","diagnosis","bowel","metabolism","feeg","impedance","family_obesity","family_diabetes","family_hypertension","family_cardiovascular","family_dyslipidemia","family_thyroid","previous_diets","allergies","medications","gi_issues","past_conditions","observations"];
export const clinicalFields={
 goalWeight:"goal_weight_kg",minWeight:"min_weight_kg",maxWeight:"max_weight_kg",reasonableWeight:"reasonable_weight_kg",theoreticalWeight:"theoretical_weight_kg",objectives:"objectives",
 work:"work",activity:"activity",activityFactor:"activity_factor",smoking:"smoking",alcohol:"alcohol",diagnosis:"diagnosis",bowel:"bowel",metabolism:"metabolism",feeg:"feeg",impedance:"impedance",
 previousDiets:"previous_diets",allergies:"allergies",medications:"medications",giIssues:"gi_issues",pastConditions:"past_conditions",observations:"observations",
 "family.obesity":"family_obesity","family.diabetes":"family_diabetes","family.hypertension":"family_hypertension","family.cardiovascular":"family_cardiovascular","family.dyslipidemia":"family_dyslipidemia","family.thyroid":"family_thyroid"
};
async function checked(query,reason){const {data,error}=await query;if(error)throw Error(reason+": "+error.message);return data;}
export async function loadLivePatientProfile(patientId,overview){
 const pathway=overview.pathways.find(p=>p.status==="active")||overview.pathways.find(p=>p.status==="pending");
 const record=await checked(client().from("patients").select("id,profile_id,birth_date,sex,height_cm,status,fiscal_code,address,postal_code,city,province,show_calories_to_patient").eq("id",patientId).single(),"Anagrafica");
 const profile=await checked(client().from("profiles").select("first_name,last_name,email,phone,status,auth_user_id").eq("id",record.profile_id).single(),"Contatti");
 const clinical=pathway?await checked(client().from("patient_clinical_profiles").select(COLUMNS.join(",")).eq("patient_id",patientId).eq("pathway_id",pathway.id).maybeSingle(),"Anamnesi"):null;
 const privacy=await checked(client().from("patient_professional_privacy").select("id,uploaded_at,original_filename,professional_privacy_document_id").eq("professional_patient_id",overview.link.id).order("uploaded_at",{ascending:false}).limit(1),"Privacy");
 return {record,profile,clinical,privacy:privacy?.[0]||null,pathwayId:pathway?.id||null,editable:overview.link.status!=="ended"&&pathway?.status==="active"};
}
export async function saveLivePatientIdentity(patientId,profileId,values){
 const first_name=String(values.firstName||"").trim(),last_name=String(values.lastName||"").trim();
 if(!first_name||!last_name)throw Error("Nome e cognome sono obbligatori.");
 const height=values.height===""?null:Number(values.height);
 if(height!==null&&(!Number.isFinite(height)||height<50||height>250))throw Error("Altezza non valida.");
 await checked(client().from("profiles").update({first_name,last_name,email:values.email||null,phone:values.phone||null}).eq("id",profileId),"Salvataggio contatti");
 await checked(client().from("patients").update({birth_date:values.birthDate||null,sex:values.sex||null,height_cm:height,fiscal_code:values.fiscalCode?.trim()||null,address:values.address?.trim()||null,postal_code:values.postalCode?.trim()||null,city:values.city?.trim()||null,province:values.province?.trim()||null,show_calories_to_patient:values.showCaloriesToPatient==="on"}).eq("id",patientId),"Salvataggio anagrafica");
}
export async function saveLiveClinical(patientId,pathwayId,values){
 if(!pathwayId)throw Error("È necessario un percorso attivo.");
 const payload={patient_id:patientId,pathway_id:pathwayId};
 for(const [key,val] of Object.entries(values)){
  const column=clinicalFields[key];
  if(!column)continue;
  if(column.startsWith("family_"))payload[column]=val===true;
  else if(["goal_weight_kg","min_weight_kg","max_weight_kg","reasonable_weight_kg","theoretical_weight_kg","activity_factor"].includes(column)){
   const number=String(val??"").trim();
   payload[column]=number===""?null:Number(number);
   if(payload[column]!==null&&!Number.isFinite(payload[column]))throw Error("Valore numerico non valido.");
  }else payload[column]=String(val??"").trim()||null;
 }
 // A pathway has at most one clinical profile; update existing row, otherwise insert.
 const existing=await checked(client().from("patient_clinical_profiles").select("patient_id").eq("patient_id",patientId).eq("pathway_id",pathwayId).maybeSingle(),"Verifica anamnesi");
 if(existing){const {patient_id,pathway_id,...changes}=payload;await checked(client().from("patient_clinical_profiles").update(changes).eq("patient_id",patientId).eq("pathway_id",pathwayId),"Salvataggio anamnesi");}
 else await checked(client().from("patient_clinical_profiles").insert(payload),"Creazione anamnesi");
}
