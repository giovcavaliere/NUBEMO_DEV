// NUBEMO Patient 2.0 — documenti reali del proprio percorso, senza dati demo.
const db=()=>window.nubemoSupabase;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const icon=n=>'<svg class="icon" aria-hidden="true"><use href="#icon-'+n+'"/></svg>';
const categories={analysis:"Analisi",report:"Referti",other:"Altro"};
const filters=[["all","Tutti"],["analysis","Analisi"],["report","Referti"],["other","Altro"]];
const state={filter:"all",unreadOnly:false,records:[],patientId:null,profileId:null,userId:null,activePathway:null};
const query=async promise=>{const {data,error}=await promise;if(error)throw error;return data||[];};
const date=d=>new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(d+"T12:00:00"));
const kind=d=>d.sub_category==="blood_test"?"analysis":d.sub_category==="health_other"?"report":"other";
const uploadedBy=d=>d.uploaded_by_user_id===state.userId?"patient":"professional";
const status=d=>uploadedBy(d)==="patient"?"Caricato":d.unread?"Da leggere":"Letto";
function render(){
 const root=document.querySelector("[data-patient-documents-content]");if(!root)return;
 const candidates=state.records.filter(d=>state.filter==="all"||d.displayCategory===state.filter);
 const shown=candidates.filter(d=>!state.unreadOnly||(d.unread&&uploadedBy(d)==="professional"));
 root.innerHTML='<div class="documents-view"><header class="documents-head"><div class="documents-head-copy"><span class="documents-head-icon">'+icon("document")+'</span><div><h2>Documenti</h2><p>Visualizza e carica i documenti del tuo percorso.</p></div></div><button class="documents-upload" type="button" data-patient-document-upload '+(!state.activePathway?'disabled title="È necessario un percorso attivo"':'')+'>'+icon("plus")+'<span>Carica documento</span></button></header>'+
 '<div class="documents-toolbar"><div class="documents-filter-wrap"><nav class="documents-filters" aria-label="Filtra documenti">'+filters.map(([k,label])=>'<button type="button" data-patient-document-filter="'+k+'" class="'+(state.filter===k?"active":"")+'" aria-pressed="'+(state.filter===k)+'">'+label+'</button>').join("")+'</nav>'+
 '<button type="button" class="documents-unread-filter '+(state.unreadOnly?"active":"")+'" data-patient-document-unread aria-label="Mostra solo documenti da leggere" title="Solo da leggere" aria-pressed="'+state.unreadOnly+'">'+icon("document")+(candidates.some(d=>d.unread&&uploadedBy(d)==="professional")?'<span class="documents-unread-dot" aria-hidden="true"></span>':"")+'</button></div><span class="documents-sort">Data più recente</span></div>'+
 '<section class="documents-table"><div class="documents-table-head"><span>Documento</span><span>Caricato da</span><span>Data</span><span>Stato</span><span>Azioni</span></div><div class="documents-list">'+
 (shown.length?shown.map(d=>'<article class="documents-row '+(d.unread?"is-unread":"")+'"><div class="documents-file"><span class="documents-file-icon">'+icon("document")+'</span><div><strong>'+esc(d.title)+'</strong><small>'+esc(d.original_filename)+' · '+categories[d.displayCategory]+'</small></div></div>'+
 '<div class="documents-cell documents-category-cell"><small>Caricato da</small><span class="documents-category documents-category-'+d.displayCategory+'">'+(uploadedBy(d)==="patient"?"Paziente":"Professionista")+'</span></div>'+
 '<div class="documents-cell documents-date-cell"><small>Data</small><time datetime="'+esc(d.date)+'">'+date(d.date)+'</time></div>'+
 '<div class="documents-cell documents-status-cell"><small>Stato</small><span class="documents-status documents-status-'+(uploadedBy(d)==="patient"?"registered":d.unread?"unread":"read")+'">'+status(d)+'</span></div>'+
 '<div class="documents-actions"><button class="documents-action" data-document-open="'+d.id+'" type="button" aria-label="Apri documento" title="Apri documento">'+icon("eye")+'</button>'+
 (uploadedBy(d)==="patient"&&d.category==="health"&&d.pathway_id===state.activePathway?'<button class="documents-action documents-action-delete" type="button" data-document-delete="'+d.id+'" aria-label="Elimina documento" title="Elimina documento">'+icon("trash")+'</button>':"")+'</div></article>').join(""):'<div class="documents-empty">'+(state.unreadOnly?"Nessun documento da leggere in questa categoria.":"Nessun documento in questa categoria.")+'</div>')+'</div></section></div>';
}
async function reload(patientId){
 const root=document.querySelector("[data-patient-documents-content]");
 root.innerHTML='<div class="module patient-plan-empty" role="status">Caricamento documenti…</div>';
 const docs=await query(db().from("documents").select("id,patient_id,pathway_id,category,sub_category,title,document_date,original_filename,uploaded_by_user_id,storage_bucket,storage_path,created_at").eq("patient_id",patientId).is("deleted_at",null).order("created_at",{ascending:false}));
 const reads=docs.length?await query(db().from("document_read_status").select("document_id,read_at").eq("profile_id",state.profileId).in("document_id",docs.map(d=>d.id))):[];
 const readMap=new Map(reads.map(r=>[r.document_id,r.read_at]));
 // Category 'plan' belongs to the Plan tab, not the Patient Documents filters.
 state.records=docs.filter(d=>d.category!=="plan").map(d=>({...d,displayCategory:kind(d),date:d.document_date||d.created_at.slice(0,10),unread:d.uploaded_by_user_id!==state.userId&&!readMap.get(d.id)}));
 render();
}
function dialog(html,onSave){
 const el=document.createElement("dialog");el.className="detail-dialog documents-upload-dialog";el.innerHTML=html;document.body.append(el);
 el.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>el.close()));
 el.addEventListener("close",()=>el.remove(),{once:true});
 el.querySelector("form").onsubmit=async e=>{
  e.preventDefault();if(!el.querySelector("form").reportValidity())return;
  const button=el.querySelector('[type="submit"]');button.disabled=true;
  let msg=el.querySelector("[data-error]");if(!msg){msg=document.createElement("p");msg.dataset.error="";msg.setAttribute("role","alert");el.querySelector("form").append(msg);}
  try{await onSave(el);el.close();await reload(state.patientId)}catch(error){msg.textContent=error.message||"Operazione non riuscita";button.disabled=false;}
 };
 el.showModal();return el;
}
const safeName=n=>String(n||"documento").normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,120);
async function upload(el){
 if(!state.activePathway)throw Error("È necessario un percorso attivo.");
 const form=el.querySelector("form");const file=form.elements.file.files[0];
 if(!file||file.size<1||file.size>20*1024*1024)throw Error("Dimensione massima 20 MB.");
 if(!["application/pdf","image/png","image/jpeg","image/webp"].includes(file.type))throw Error("Formato file non supportato.");
 const cat=form.elements.category.value;
 if(!Object.hasOwn(categories,cat))throw Error("Categoria non valida.");
 const title=String(form.elements.title.value||"").trim();if(!title)throw Error("Titolo obbligatorio.");
 const path=state.patientId+"/"+state.activePathway+"/"+crypto.randomUUID()+"-"+safeName(file.name);
 const bucket=db().storage.from("patient-documents");
 const u=await bucket.upload(path,file,{upsert:false,contentType:file.type});if(u.error)throw u.error;
 const subtype=cat==="analysis"?"blood_test":cat==="report"?"health_other":"health_other";
 const insert=await db().from("documents").insert({patient_id:state.patientId,pathway_id:state.activePathway,category:"health",sub_category:subtype,title,document_date:form.elements.date.value,original_filename:file.name,mime_type:file.type,size_bytes:file.size,storage_bucket:"patient-documents",storage_path:path,uploaded_by_user_id:state.userId});
 if(insert.error){await bucket.remove([path]);throw insert.error;}
}
async function openDoc(doc){
 const popup=window.open("about:blank","_blank");if(popup)popup.opener=null;
 if(!popup)throw Error("Abilita le finestre popup.");
 try{
  const r=await db().storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path,120);
  if(r.error||!r.data?.signedUrl)throw r.error||Error("Documento non disponibile.");
  popup.location.replace(r.data.signedUrl);
  if(uploadedBy(doc)==="professional"){
   const ack=await db().from("document_read_status").upsert({document_id:doc.id,profile_id:state.profileId,read_at:new Date().toISOString()},{onConflict:"document_id,profile_id"});
   if(ack.error)throw ack.error;
   doc.unread=false;render();
  }
 }catch(error){popup.close();throw error;}
}
export async function mountPatientDocuments(context){
 state.patientId=context.patient.id;state.profileId=context.profile.id;state.userId=context.user.id;
 state.activePathway=await query(db().rpc("current_active_pathway_id"));
 const root=document.querySelector("[data-patient-documents-content]");
 root.onclick=async e=>{
  const f=e.target.closest("[data-patient-document-filter]");if(f){state.filter=f.dataset.patientDocumentFilter;render();return;}
  if(e.target.closest("[data-patient-document-unread]")){state.unreadOnly=!state.unreadOnly;render();return;}
  if(e.target.closest("[data-patient-document-upload]")){
   if(!state.activePathway)return;
   const today=new Date().toLocaleDateString("en-CA");
   const el=dialog('<form><header><h2>Carica documento</h2><button type="button" data-close>×</button></header><div class="documents-upload-form"><label class="documents-wide">File PDF o immagine<input name="file" type="file" accept=".pdf,application/pdf,image/png,image/jpeg,image/webp" required></label><label>Categoria<select name="category"><option value="analysis">Analisi</option><option value="report">Referti</option><option value="other">Altro</option></select></label><label>Data documento<input name="date" type="date" value="'+today+'" required></label><label class="documents-wide">Titolo<input name="title" maxlength="200" required></label></div><footer><button type="button" data-close>Annulla</button><button type="submit">Carica documento</button></footer></form>',upload);
   el.querySelector('[name="file"]').onchange=e=>{const title=el.querySelector('[name="title"]');if(!title.value&&e.target.files[0])title.value=e.target.files[0].name.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ");};
   return;
  }
  const open=e.target.closest("[data-document-open]");if(open){const doc=state.records.find(d=>d.id===open.dataset.documentOpen);if(doc)try{await openDoc(doc)}catch(error){alert(error.message)}return;}
  const del=e.target.closest("[data-document-delete]");if(del){
   const doc=state.records.find(d=>d.id===del.dataset.documentDelete);
   if(!doc||uploadedBy(doc)!=="patient"||doc.pathway_id!==state.activePathway)return;
   dialog('<form><header><h2>Elimina documento</h2><button type="button" data-close>×</button></header><p>Vuoi eliminare “'+esc(doc.title)+'”?</p><footer><button type="button" data-close>Annulla</button><button type="submit">Elimina documento</button></footer></form>',async()=>{
    const r=await db().rpc("patient2_soft_delete_own_document",{p_document_id:doc.id});if(r.error)throw r.error;
   });
  }
 };
 await reload(state.patientId);
}
