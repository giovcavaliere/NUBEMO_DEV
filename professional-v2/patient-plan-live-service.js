const client=()=>window.nubemoSupabase;
async function query(promise){const {data,error}=await promise;if(error)throw error;return data;}
async function auth(){const {data,error}=await client().auth.getUser();if(error||!data.user)throw Error("Sessione non valida");return data.user;}
export async function loadLivePlans(patientId,pathways){
 const ids=pathways.map(x=>x.id);if(!ids.length)return [];
 const plans=await query(client().from("nutrition_plans").select("id,patient_id,professional_id,pathway_id,title,status,valid_from,valid_to,professional_note,created_at").eq("patient_id",patientId).in("pathway_id",ids).is("deleted_at",null).order("valid_from",{ascending:false}));
 if(!plans.length)return [];
 const links=await query(client().from("nutrition_plan_documents").select("nutrition_plan_id,document_id").in("nutrition_plan_id",plans.map(p=>p.id)));
 const docIds=[...new Set(links.map(l=>l.document_id))];
 const docs=docIds.length?await query(client().from("documents").select("id,patient_id,pathway_id,original_filename,storage_bucket,storage_path").in("id",docIds).eq("patient_id",patientId).is("deleted_at",null)):[];
 const docsById=new Map(docs.map(d=>[d.id,d]));
 return plans.map(plan=>{
  const doc=links.filter(l=>l.nutrition_plan_id===plan.id).map(l=>docsById.get(l.document_id)).find(d=>d&&d.pathway_id===plan.pathway_id);
  return {id:plan.id,pathwayId:plan.pathway_id,title:plan.title,validFrom:plan.valid_from,validTo:plan.valid_to,professionalNote:plan.professional_note||"",fileName:doc?.original_filename||"Documento non disponibile",document:doc||null,status:plan.status};
 });
}
const safeName=s=>String(s).normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,130);
export async function publishPlan(patientId,pathway,file,title,validFrom,note){
 if(pathway?.status!=="active")throw Error("Per pubblicare è necessario un percorso attivo.");
 if(!title.trim()||!validFrom||!file)throw Error("Compila tutti i campi richiesti.");
 if(file.type!=="application/pdf"||!file.name.toLowerCase().endsWith(".pdf")||file.size>20*1024*1024||file.size===0)throw Error("Seleziona un PDF valido, massimo 20 MB.");
 const user=await auth();
 const {data:pro,error:proError}=await client().from("professionals").select("id").eq("profile_id",window.NUBEMO_PRO2_PROFILE?.id).single();if(proError||!pro)throw Error("Professionista non disponibile.");
 const path=patientId+"/"+pathway.id+"/"+crypto.randomUUID()+"-"+safeName(file.name);
 const storage=client().storage.from("patient-documents");
 const uploaded=await storage.upload(path,file,{contentType:"application/pdf",upsert:false});if(uploaded.error)throw uploaded.error;
 let documentId=null,planId=null;
 try{
  const {data:document,error:docErr}=await client().from("documents").insert({patient_id:patientId,pathway_id:pathway.id,category:"plan",sub_category:"meal_plan",title:title.trim(),document_date:validFrom,valid_from:validFrom,professional_note:note||null,original_filename:file.name,mime_type:"application/pdf",size_bytes:file.size,storage_bucket:"patient-documents",storage_path:path,uploaded_by_user_id:user.id}).select("id").single();if(docErr)throw docErr;documentId=document.id;
  const {data:plan,error:planErr}=await client().from("nutrition_plans").insert({patient_id:patientId,pathway_id:pathway.id,professional_id:pro.id,title:title.trim(),valid_from:validFrom,professional_note:note||null,status:"active"}).select("id").single();if(planErr)throw planErr;planId=plan.id;
  const {error:linkErr}=await client().from("nutrition_plan_documents").insert({nutrition_plan_id:planId,document_id:documentId});if(linkErr)throw linkErr;
 }catch(error){
  if(planId)await client().rpc("soft_delete_associated_nutrition_plan",{p_plan_id:planId});
  if(documentId)await client().rpc("soft_delete_associated_patient_document",{p_document_id:documentId});
  else await storage.remove([path]);
  throw error;
 }
}
export async function openPlanFile(plan){
 if(!plan.document)throw Error("Il PDF non è disponibile.");
 const {data,error}=await client().storage.from(plan.document.storage_bucket).createSignedUrl(plan.document.storage_path,120);
 if(error)throw error;
 window.open(data.signedUrl,"_blank","noopener,noreferrer");
}
export async function updatePlanNote(plan,note){
 const {error}=await client().from("nutrition_plans").update({professional_note:note.trim()||null}).eq("id",plan.id);if(error)throw error;
}
export async function removePlan(plan){
 const {error}=await client().rpc("soft_delete_own_professional_nutrition_plan",{p_plan_id:plan.id});if(error)throw error;
}
