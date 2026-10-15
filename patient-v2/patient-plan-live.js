// NUBEMO Patient 2.0: read-only nutritional plans shared from Professional, never private notes.
const client=()=>window.nubemoSupabase;
const escape=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const pretty=d=>d?new Date(d+"T12:00:00").toLocaleDateString("it-IT"):"—";
let loadedFor=null;
let documents=new Map();
function details(plan){
 const doc=documents.get(plan.id);
 return '<div class="patient-plan-note"><strong>Indicazioni del professionista</strong><p>Consulta il piano PDF per le indicazioni alimentari. Le note interne del professionista non sono visibili al paziente.</p></div>'+
  '<div class="patient-plan-file"><span class="patient-plan-file-icon"><svg class="icon"><use href="#icon-document"/></svg></span>'+
  '<div class="patient-plan-file-info"><strong>'+escape(doc?.original_filename||"PDF non disponibile")+'</strong><small>'+(doc?"Documento condiviso dal professionista":"Nessun PDF associato")+'</small></div>'+
  (doc?'<div class="patient-plan-file-actions"><button class="patient-secondary" type="button" data-plan-open="'+escape(plan.id)+'">Apri PDF</button><button class="patient-secondary" type="button" data-plan-download="'+escape(plan.id)+'">Scarica</button></div>':"")+'</div>';
}
async function checked(promise){const {data,error}=await promise;if(error)throw error;return data;}
export async function mountPatientPlan(patientId,{reload=false}={}){
 const root=document.querySelector("[data-patient-plan-content]");
 if(!root)return;
 if(loadedFor===patientId&&!reload)return;
 root.innerHTML='<div class="module patient-plan-empty" role="status">Caricamento piani alimentari…</div>';
 try{
  const plans=await checked(client().from("nutrition_plans")
   .select("id,title,status,pathway_id,valid_from,valid_to,created_at")
   .eq("patient_id",patientId).is("deleted_at",null)
   .order("valid_from",{ascending:false}));
  const ids=plans.map(x=>x.id);
  let links=[],docs=[];
  if(ids.length){
   links=await checked(client().from("nutrition_plan_documents").select("nutrition_plan_id,document_id").in("nutrition_plan_id",ids));
   const docIds=[...new Set(links.map(l=>l.document_id))];
   if(docIds.length)docs=await checked(client().from("documents")
    .select("id,patient_id,pathway_id,original_filename,storage_bucket,storage_path")
    .in("id",docIds).eq("patient_id",patientId).is("deleted_at",null));
  }
  const docMap=new Map(docs.map(d=>[d.id,d]));
  documents=new Map(plans.map(plan=>{
   const match=links.find(l=>l.nutrition_plan_id===plan.id&&docMap.get(l.document_id)?.pathway_id===plan.pathway_id);
   return [plan.id,match?docMap.get(match.document_id):null];
  }));
  // The currently valid plan must belong to an active pathway and be marked active.
  const pathwayIds=[...new Set(plans.map(p=>p.pathway_id).filter(Boolean))];
  const pathways=pathwayIds.length?await checked(client().from("patient_pathways")
   .select("id,status").in("id",pathwayIds).eq("patient_id",patientId)):[];
  const activePaths=new Set(pathways.filter(p=>p.status==="active").map(p=>p.id));
  const current=plans.find(p=>p.status==="active"&&activePaths.has(p.pathway_id))||null;
  const history=plans.filter(p=>p.id!==current?.id);
  root.innerHTML='<div class="patient-plan-stack">'+
   '<section aria-labelledby="patient-plan-current-heading"><h2 class="patient-plan-section-title" id="patient-plan-current-heading">Piano in vigore</h2>'+
   (current?'<article class="module patient-plan-card"><div class="patient-plan-card-header"><div><h3>'+escape(current.title)+'</h3><p class="patient-plan-dates">Dal '+pretty(current.valid_from)+'</p></div><span class="pill green">Attivo</span></div>'+details(current)+'</article>':'<div class="module patient-plan-empty">Non è ancora disponibile un piano alimentare in vigore.</div>')+'</section>'+
   '<section aria-labelledby="patient-plan-history-heading"><h2 class="patient-plan-section-title" id="patient-plan-history-heading">Piani precedenti</h2>'+
   (history.length?'<div class="patient-plan-history">'+history.map(plan=>'<details class="module patient-plan-card"><summary><span><strong>'+escape(plan.title)+'</strong><small>Dal '+pretty(plan.valid_from)+(plan.valid_to?' al '+pretty(plan.valid_to):'')+'</small></span><span class="patient-plan-chevron" aria-hidden="true">⌄</span></summary><div class="patient-plan-history-body">'+details(plan)+'</div></details>').join("")+'</div>':'<div class="module patient-plan-empty">Nessun piano precedente.</div>')+'</section></div>';
  loadedFor=patientId;
  root.onclick=async e=>{
   const b=e.target.closest("[data-plan-open],[data-plan-download]");if(!b)return;
   const id=b.dataset.planOpen||b.dataset.planDownload;
   const doc=documents.get(id);if(!doc)return;
   const download=b.hasAttribute("data-plan-download");
   const popup=download?null:window.open("about:blank","_blank");
   if(popup)popup.opener=null;
   b.disabled=true;
   try{
    const {data,error}=await client().storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path,120,{download:download?doc.original_filename:undefined});
    if(error||!data?.signedUrl)throw error||Error("PDF non disponibile.");
    if(download){
     const a=document.createElement("a");a.href=data.signedUrl;a.download=doc.original_filename||"piano.pdf";document.body.append(a);a.click();a.remove();
    }else if(popup)popup.location.replace(data.signedUrl);
    else throw Error("Abilita le finestre popup per visualizzare il PDF.");
   }catch(error){popup?.close();window.alert(error.message||"Impossibile aprire il piano.");}finally{b.disabled=false;}
  };
 }catch(error){loadedFor=null;root.innerHTML='<div class="module patient-plan-empty" role="alert">Impossibile caricare i piani alimentari: '+escape(error.message)+'. <button class="patient-secondary" type="button" data-plan-retry>Riprova</button></div>';root.querySelector("[data-plan-retry]").onclick=()=>mountPatientPlan(patientId,{reload:true});}
}
