import {extractPdfText,parseLabValues} from "./lab-pdf-extractor.js?v=legacy-lab-20261015";
import {renderDocuments,labFields} from "./patient-documents-view.js?v=plan-document-link-20261015";
import {renderLivePatientOverview} from "./patient-detail-view.js";
import {loadDocuments,uploadDocument,openDocument,deleteDocument,saveLaboratoryValues} from "./patient-documents-live-service.js?v=plan-nav-20261015";

const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
function openDialog(root,html,save){
 const el=document.createElement("dialog");el.className="detail-dialog documents-upload-dialog";el.innerHTML=html;document.body.append(el);
 el.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>el.close()));
 el.addEventListener("close",()=>el.remove(),{once:true});
 const form=el.querySelector("form");
 form.addEventListener("submit",async e=>{
  e.preventDefault();if(!form.reportValidity())return;
  const button=form.querySelector('[type="submit"]');button.disabled=true;
  let msg=form.querySelector("[data-error]");
  if(!msg){msg=document.createElement("p");msg.dataset.error="";msg.setAttribute("role","alert");form.append(msg);}
  try{await save(new FormData(form),form);el.close();}
  catch(error){msg.textContent=error.message||"Operazione non riuscita.";button.disabled=false;}
 });
 el.showModal();
 return el;
}
export async function renderLivePatientDocuments(root,overview){
 const active=overview.pathways.find(p=>p.status==="active");
 const records=await loadDocuments(overview.patient.id,overview.pathways);
 const state={...records,documentUi:{filter:"all",unreadOnly:false}};
 renderLivePatientOverview(root,overview,"documenti",{});
 const content=root.querySelector(".detail-content");
 const draw=()=>{
  content.innerHTML=renderDocuments({data:state});
  const upload=content.querySelector("[data-upload-document]");
  if(!active){upload.disabled=true;upload.title="È necessario un percorso attivo.";}
  content.querySelectorAll("[data-document-filter]").forEach(b=>b.addEventListener("click",()=>{state.documentUi.filter=b.dataset.documentFilter;draw();}));
  content.querySelector("[data-unread-filter]")?.addEventListener("click",()=>{state.documentUi.unreadOnly=!state.documentUi.unreadOnly;draw();});
  const reload=async()=>{const next=await loadDocuments(overview.patient.id,overview.pathways);state.documents=next.documents;state.laboratoryReports=next.laboratoryReports;draw();};
  upload.addEventListener("click",()=>{
   if(!active)return;
   const today=new Date().toLocaleDateString("en-CA");
   openDialog(content,'<form><header><h2>Carica documento</h2><button type="button" data-close>×</button></header><div class="documents-upload-form">'+
    '<label class="documents-wide">File<input name="file" type="file" accept=".pdf,image/png,image/jpeg,image/webp" required></label>'+
    '<label>Categoria<select name="category"><option value="analysis">Analisi</option><option value="report">Referti</option><option value="other">Altro</option></select></label>'+
    '<label>Data documento<input name="date" type="date" value="'+today+'" required></label>'+
    '<label class="documents-wide">Titolo<input name="title" maxlength="200" required></label></div>'+
    '<footer><button type="button" data-close>Annulla</button><button type="submit">Carica</button></footer></form>',
    async(_,form)=>{const file=form.querySelector('[name="file"]').files[0];await uploadDocument(overview.patient.id,active,file,form.elements.title.value.trim(),form.elements.date.value,form.elements.category.value);await reload();});
  });
  content.querySelectorAll("[data-open-document]").forEach(b=>b.addEventListener("click",async()=>{
   const doc=state.documents.find(x=>x.id===b.dataset.openDocument);if(!doc)return;
   try{await openDocument(doc);await reload();}catch(error){alert(error.message||"Impossibile aprire il documento.");}
  }));
  content.querySelectorAll("[data-go-to-plan]").forEach(b=>b.addEventListener("click",()=>{const planId=b.dataset.goToPlan;if(!planId)return;sessionStorage.setItem("nubemo-pro2-select-plan-"+overview.patient.id,planId);location.hash="#patient/"+encodeURIComponent(overview.patient.id)+"/piano";}));
  content.querySelectorAll("[data-delete-document]").forEach(b=>{
   const doc=state.documents.find(x=>x.id===b.dataset.deleteDocument);
   if(!active||doc?.pathway_id!==active.id){b.disabled=true;b.title="Documento storico in sola lettura";return;}
   b.addEventListener("click",async()=>{
    if(!confirm('Eliminare "'+doc.title+'"? I valori delle analisi registrati resteranno conservati.'))return;
    try{await deleteDocument(doc);await reload();}catch(error){alert(error.message||"Eliminazione non riuscita.");}
   });
  });
  content.querySelectorAll("[data-register-analysis]").forEach(b=>{
   const doc=state.documents.find(x=>x.id===b.dataset.registerAnalysis);
   if(!active||doc?.pathway_id!==active.id){b.disabled=true;b.title="Analisi storica in sola lettura";return;}
   b.addEventListener("click",async()=>{
    const report=state.laboratoryReports.find(r=>r.documentId===doc.id);
    const inputs=labFields.map(([key,label])=>'<label>'+esc(label)+'<input name="'+key+'" value="'+esc(report?.values?.[key]||"")+'"></label>').join("");
    const dialog=openDialog(content,'<form><header><h2>Registra valori analisi</h2><button type="button" data-close>×</button></header>'+
     '<p data-pdf-lab-status role="status">Lettura automatica del PDF in corso…</p>'+
     '<div class="documents-upload-form"><label>Data referto<input name="reportDate" type="date" value="'+esc(report?.reportDate||doc.date)+'" required></label>'+
     inputs+'<label class="documents-wide">Note<textarea rows="3" name="notes">'+esc(report?.notes||"")+'</textarea></label></div>'+
     '<footer><button type="button" data-close>Annulla</button><button type="submit">Salva valori</button></footer></form>',
     async values=>{await saveLaboratoryValues(doc,report,values,labFields);await reload();});
    const status=dialog.querySelector("[data-pdf-lab-status]");
    try{
      if(!doc.original_filename?.toLowerCase().endsWith(".pdf")&&!doc.fileName?.toLowerCase().endsWith(".pdf"))throw Error("Il file non è un PDF.");
      const downloaded=await window.nubemoSupabase.storage.from(doc.storage_bucket).download(doc.storage_path);
      if(downloaded.error||!downloaded.data)throw downloaded.error||Error("Download PDF non riuscito.");
      const extracted=await extractPdfText(downloaded.data);
      const recognized=parseLabValues(extracted);
      let matched=0;
      for(const [key] of labFields){
        const input=dialog.querySelector('[name="'+key+'"]');
        if(input&&!input.value&&recognized[key]){input.value=recognized[key];matched++;}
      }
      status.textContent=matched?matched+" valori riconosciuti dal PDF. Verifica i dati e conferma il salvataggio.":"Nessun nuovo valore riconosciuto automaticamente. Puoi completare i campi manualmente.";
    }catch(error){
      status.textContent="Lettura automatica non disponibile: "+(error.message||"errore PDF")+". Puoi compilare i campi manualmente.";
    }
   });
  });
 };
 draw();
}
