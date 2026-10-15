const db=()=>window.nubemoSupabase;
const fileName=n=>String(n||"documento").normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,120);
async function userId(){const {data,error}=await db().auth.getUser();if(error||!data.user)throw Error("Sessione non valida.");return data.user.id;}
async function rows(query){const {data,error}=await query;if(error)throw error;return data||[];}
export async function loadDocuments(patientId,pathways){
 const ids=pathways.map(p=>p.id);
 if(!ids.length)return {documents:[],laboratoryReports:[]};
 const documents=await rows(db().from("documents").select("id,patient_id,pathway_id,category,sub_category,title,document_date,original_filename,uploaded_by_user_id,storage_bucket,storage_path,created_at").eq("patient_id",patientId).in("pathway_id",ids).is("deleted_at",null).order("created_at",{ascending:false}));
 const planDocs=documents.length?await rows(db().from("nutrition_plan_documents").select("document_id,nutrition_plan_id").in("document_id",documents.map(d=>d.id))):[];
 const planIds=[...new Set(planDocs.map(link=>link.nutrition_plan_id))];
 const livePlans=planIds.length?await rows(db().from("nutrition_plans").select("id,deleted_at").in("id",planIds)):[];
 const activePlanIds=new Set(livePlans.filter(plan=>plan.deleted_at===null).map(plan=>plan.id));
 const linkedActiveDocuments=new Set(planDocs.filter(link=>activePlanIds.has(link.nutrition_plan_id)).map(link=>link.document_id));
 const profile=window.NUBEMO_PRO2_PROFILE?.id;
 const reads=profile&&documents.length?await rows(db().from("document_read_status").select("document_id,read_at").eq("profile_id",profile).in("document_id",documents.map(d=>d.id))):[];
 const readMap=new Map(reads.map(r=>[r.document_id,r.read_at]));
 const uid=await userId();
 const reports=await rows(db().from("laboratory_reports").select("id,document_id,report_date,status").eq("patient_id",patientId).in("pathway_id",ids).is("deleted_at",null));
 const values=reports.length?await rows(db().from("laboratory_values").select("report_id,test_code,test_name,value_text,notes").in("report_id",reports.map(r=>r.id))):[];
 return {documents:documents.map(d=>({...d,linkedToActivePlan:linkedActiveDocuments.has(d.id),isPlanDocument:d.category==="plan"||d.sub_category==="meal_plan",category:d.sub_category==="blood_test"?"analysis":d.sub_category==="health_other"?"report":"other",date:d.document_date||d.created_at.slice(0,10),fileName:d.original_filename,uploadedBy:d.uploaded_by_user_id===uid?"professional":"patient",unread:d.uploaded_by_user_id!==uid&&!readMap.get(d.id)})),
  laboratoryReports:reports.map(r=>({id:r.id,documentId:r.document_id,reportDate:r.report_date,status:r.status,values:Object.fromEntries(values.filter(v=>v.report_id===r.id).map(v=>[v.test_code||v.test_name,v.value_text||""])),notes:values.find(v=>v.report_id===r.id&&v.test_code==="__notes__")?.notes||""}))};
}
export async function uploadDocument(patientId,pathway,file,title,date,category){
 if(!pathway||pathway.status!=="active")throw Error("È necessario un percorso attivo.");
 if(!file||file.size<1||file.size>20971520)throw Error("Il file deve essere compreso tra 1 byte e 20 MB.");
 if(!["application/pdf","image/png","image/jpeg","image/webp"].includes(file.type))throw Error("Formato non consentito.");
 const uid=await userId();
 const path=patientId+"/"+pathway.id+"/"+crypto.randomUUID()+"-"+fileName(file.name);
 const bucket=db().storage.from("patient-documents");
 const uploaded=await bucket.upload(path,file,{upsert:false,contentType:file.type});if(uploaded.error)throw uploaded.error;
 const sub=category==="analysis"?"blood_test":category==="report"?"health_other":null;
 const dbCategory=category==="other"?"other":"health";
 const {error}=await db().from("documents").insert({patient_id:patientId,pathway_id:pathway.id,category:dbCategory,sub_category:sub,title,document_date:date,original_filename:file.name,mime_type:file.type,size_bytes:file.size,storage_bucket:"patient-documents",storage_path:path,uploaded_by_user_id:uid});
 if(error){await bucket.remove([path]);throw error;}
}
export async function openDocument(doc){
 const {data,error}=await db().storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path,120);if(error)throw error;
 window.open(data.signedUrl,"_blank","noopener,noreferrer");
 const uid=await userId();if(doc.uploaded_by_user_id===uid)return;
 const profile=window.NUBEMO_PRO2_PROFILE?.id;if(!profile)throw Error("Profilo professionista mancante.");
 const {error:readError}=await db().from("document_read_status").upsert({document_id:doc.id,profile_id:profile,read_at:new Date().toISOString()},{onConflict:"document_id,profile_id"});
 if(readError)throw readError;
}
export async function deleteDocument(doc){
 const links=await rows(db().from("nutrition_plan_documents").select("nutrition_plan_id").eq("document_id",doc.id));
 if(links.length){
  const plans=await rows(db().from("nutrition_plans").select("id").in("id",links.map(link=>link.nutrition_plan_id)).is("deleted_at",null));
  if(plans.length)throw Error("Questo PDF appartiene a un piano alimentare. Gestisci l'eliminazione dalla tab Piano.");
 }
 const {error}=await db().rpc("soft_delete_associated_patient_document",{p_document_id:doc.id});if(error)throw error;
}
export async function saveLaboratoryValues(doc,report,values,fields){
 const uid=await userId(),profile=window.NUBEMO_PRO2_PROFILE?.id;
 const professionals=await rows(db().from("professionals").select("id").eq("profile_id",profile));if(!professionals.length)throw Error("Professionista non disponibile.");
 let id=report?.id;
 const base={report_date:String(values.get("reportDate")||doc.date),status:"confirmed",reviewed_by_professional_id:professionals[0].id,reviewed_at:new Date().toISOString()};
 if(!id){const {data,error}=await db().from("laboratory_reports").insert({...base,patient_id:doc.patient_id,pathway_id:doc.pathway_id,document_id:doc.id,title:doc.title,created_by_user_id:uid}).select("id").single();if(error)throw error;id=data.id;}
 else{const {error}=await db().from("laboratory_reports").update(base).eq("id",id);if(error)throw error;}
 const existing=await rows(db().from("laboratory_values").select("id,test_code").eq("report_id",id));
 const prior=new Map(existing.map(x=>[x.test_code,x.id]));
 for(const [key,label] of fields){
  const value=String(values.get(key)||"").trim();
  if(prior.has(key)){const {error}=await db().from("laboratory_values").update({value_text:value||null}).eq("id",prior.get(key));if(error)throw error;}
  else if(value){const {error}=await db().from("laboratory_values").insert({report_id:id,test_code:key,test_name:label,value_text:value});if(error)throw error;}
 }
 const notes=String(values.get("notes")||"").trim();
 if(prior.has("__notes__")){const {error}=await db().from("laboratory_values").update({notes}).eq("id",prior.get("__notes__"));if(error)throw error;}
 else if(notes){const {error}=await db().from("laboratory_values").insert({report_id:id,test_code:"__notes__",test_name:"Note",notes});if(error)throw error;}
}
