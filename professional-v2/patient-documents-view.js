const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const icon=name=>`<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${name}"/></svg>`;
const fmtDate=value=>value?new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`)):"—";
const filters=[["all","Tutti"],["analysis","Analisi"],["report","Referti"],["other","Altro"]];
const categoryLabel={analysis:"Analisi",report:"Referti",other:"Altro"};
const labFields=[
  ["glucose","Glicemia"],["cholesterol","Colesterolo"],["hdl","HDL"],["ldl","LDL"],
  ["triglycerides","Trigliceridi"],["got","GOT"],["gpt","GPT"],["uricAcid","Acido urico"],
  ["creatinine","Creatinina"],["ggt","GGT"],["tsh","TSH"],["vitaminD","Vitamina D"]
];

function reportFor(data,documentId){
  return (data.laboratoryReports||[]).find(item=>item.documentId===documentId)||null;
}

function statusFor(doc,data){
  if(doc.category==="analysis"&&reportFor(data,doc.id)?.status==="confirmed")return {label:"Registrato",tone:"registered"};
  return doc.unread?{label:"Da leggere",tone:"unread"}:{label:"Letto",tone:"read"};
}

function categoryDocuments(data){
  const filter=data.documentUi?.filter||"all";
  const docs=[...(data.documents||[])].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  return filter==="all"?docs:docs.filter(doc=>doc.category===filter);
}

function visibleDocuments(data){
  const docs=categoryDocuments(data);
  return data.documentUi?.unreadOnly?docs.filter(doc=>doc.unread):docs;
}

function renderDocument(doc,data){
  const status=statusFor(doc,data);
  const lab=reportFor(data,doc.id);
  return `<article class="documents-row ${doc.unread?"is-unread":""}">
    <div class="documents-file">
      <span class="documents-file-icon">${icon("document")}</span>
      <div><strong>${esc(doc.title||doc.fileName||"Documento")}</strong><small>${esc(doc.fileName||"Documento allegato")}</small></div>
    </div>
    <div class="documents-cell documents-category-cell"><small>Categoria</small><span class="documents-category documents-category-${esc(doc.category)}">${esc(categoryLabel[doc.category]||"Altro")}</span></div>
    <div class="documents-cell documents-date-cell"><small>Data</small><time datetime="${esc(doc.date||"")}">${fmtDate(doc.date)}</time></div>
    <div class="documents-cell documents-status-cell"><small>Stato</small><span class="documents-status documents-status-${status.tone}">${status.label}</span></div>
    <div class="documents-actions" aria-label="Azioni documento">
      <button type="button" class="documents-action" data-open-document="${esc(doc.id)}" aria-label="Apri documento" title="Apri documento">${icon("eye")}</button>
      ${doc.category==="analysis"?`<button type="button" class="documents-action documents-action-analysis" data-register-analysis="${esc(doc.id)}" aria-label="${lab?"Modifica valori analisi":"Registra valori analisi"}" title="${lab?"Modifica valori":"Registra valori"}">${icon("lab")}</button>`:""}
      <button type="button" class="documents-action documents-action-delete" data-delete-document="${esc(doc.id)}" aria-label="Elimina documento" title="Elimina documento">${icon("trash")}</button>
    </div>
  </article>`;
}

export function renderDocuments(model){
  const data=model.data;
  const filter=data.documentUi?.filter||"all";
  const unreadOnly=data.documentUi?.unreadOnly===true;
  const inCategory=categoryDocuments(data);
  const docs=visibleDocuments(data);
  const hasUnread=inCategory.some(doc=>doc.unread);
  return `<div class="documents-view">
    <header class="documents-head">
      <div class="documents-head-copy">
        <span class="documents-head-icon">${icon("document")}</span>
        <div><h2>Documenti</h2><p>Gestisci i documenti del paziente.</p></div>
      </div>
      <button type="button" class="documents-upload" data-upload-document>${icon("plus")}<span>Carica documento</span></button>
    </header>

    <div class="documents-toolbar">
      <div class="documents-filter-wrap">
        <nav class="documents-filters" aria-label="Filtra documenti">
          ${filters.map(([key,label])=>`<button type="button" data-document-filter="${key}" class="${filter===key?"active":""}" aria-pressed="${filter===key}">${label}</button>`).join("")}
        </nav>
        <button type="button" class="documents-unread-filter ${unreadOnly?"active":""}" data-unread-filter aria-label="Mostra solo documenti da leggere" title="Documenti da leggere" aria-pressed="${unreadOnly}">
          ${icon("document")}
          ${hasUnread?'<span class="documents-unread-dot" aria-hidden="true"></span>':""}
        </button>
      </div>
      <span class="documents-sort">Data più recente</span>
    </div>

    <section class="documents-table">
      <div class="documents-table-head"><span>Documento</span><span>Categoria</span><span>Data</span><span>Stato</span><span>Azioni</span></div>
      <div class="documents-list">${docs.length?docs.map(doc=>renderDocument(doc,data)).join(""):`<div class="documents-empty">${unreadOnly?"Nessun documento da leggere in questa categoria.":"Nessun documento in questa categoria."}</div>`}</div>
    </section>
  </div>`;
}

function attachSimpleDialog(root,dialog,onSave){
  root.append(dialog);
  dialog.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>dialog.close()));
  dialog.addEventListener("close",()=>{if(dialog.returnValue==="save")onSave?.(new FormData(dialog.querySelector("form")),dialog);dialog.remove();},{once:true});
  dialog.showModal();
}

function openUploadDialog(root,model,onChange){
  const today=new Date().toISOString().slice(0,10);
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog documents-upload-dialog";
  dialog.innerHTML=`<form method="dialog">
    <header><h2>Carica documento</h2><button type="button" data-close aria-label="Chiudi">×</button></header>
    <p>I documenti caricati dal professionista vengono considerati già letti.</p>
    <div class="documents-upload-form">
      <label class="documents-wide">File<input name="file" type="file" accept=".pdf,application/pdf,image/*" required></label>
      <label>Categoria<select name="category"><option value="analysis">Analisi</option><option value="report">Referti</option><option value="other">Altro</option></select></label>
      <label>Data documento<input name="date" type="date" value="${today}" required></label>
      <label class="documents-wide">Titolo<input name="title" type="text" required></label>
    </div>
    <footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Salva documento</button></footer>
  </form>`;
  attachSimpleDialog(root,dialog,(values,current)=>{
    const file=current.querySelector('input[name="file"]')?.files?.[0];
    const title=String(values.get("title")||"").trim(),date=String(values.get("date")||"").trim(),category=String(values.get("category")||"other");
    if(!(file instanceof File)||!file.name||!title||!date)return;
    model.data.documents.push({id:`doc-${Date.now()}`,category,date,title,fileName:file.name,mimeType:file.type||"",uploadedBy:"professional",unread:false,file});
    onChange();
  });
  const file=dialog.querySelector('input[name="file"]'),title=dialog.querySelector('input[name="title"]');
  file.addEventListener("change",()=>{const selected=file.files?.[0];if(selected&&!title.value)title.value=selected.name.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ");});
}

function openAnalysisDialog(root,model,doc,onChange){
  const existing=reportFor(model.data,doc.id);
  const dialog=document.createElement("dialog");
  dialog.className="documents-analysis-dialog";
  dialog.innerHTML=`<form method="dialog" class="documents-analysis-shell">
    <header class="documents-analysis-header">
      <div><h2>Registra valori analisi</h2><p>Trascrivi i valori letti dal PDF. Il record resta collegato al documento.</p></div>
      <button type="button" class="documents-analysis-close" data-close aria-label="Chiudi">×</button>
    </header>
    <div class="documents-analysis-body">
      <section class="documents-analysis-file">
        <span class="documents-file-icon">${icon("document")}</span>
        <div><strong>${esc(doc.title)}</strong><small>${esc(doc.fileName||"")}</small></div>
        <button type="button" data-open-analysis-pdf>Apri PDF</button>
      </section>
      <div class="documents-analysis-form">
        <label>Data referto<input name="reportDate" type="date" value="${esc(existing?.reportDate||doc.date||"")}"></label>
        ${labFields.map(([key,label])=>`<label>${label}<input name="${key}" type="text" inputmode="decimal" value="${esc(existing?.values?.[key]||"")}"></label>`).join("")}
        <label class="documents-analysis-wide">Note<textarea name="notes" rows="4">${esc(existing?.notes||"")}</textarea></label>
      </div>
    </div>
    <footer class="documents-analysis-footer"><button type="button" data-close>Annulla</button><button type="submit" value="save">Salva valori</button></footer>
  </form>`;
  root.append(dialog);
  dialog.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>dialog.close()));
  dialog.querySelector("[data-open-analysis-pdf]")?.addEventListener("click",()=>openDocument(doc,onChange));
  dialog.addEventListener("close",()=>{
    if(dialog.returnValue==="save"){
      const values=new FormData(dialog.querySelector("form"));
      const reports=model.data.laboratoryReports||(model.data.laboratoryReports=[]);
      const record={id:existing?.id||`lab-${Date.now()}`,documentId:doc.id,reportDate:String(values.get("reportDate")||doc.date||""),status:"confirmed",values:Object.fromEntries(labFields.map(([key])=>[key,String(values.get(key)||"").trim()])),notes:String(values.get("notes")||"").trim(),updatedAt:new Date().toISOString()};
      if(existing)Object.assign(existing,record);else reports.push(record);
      doc.unread=false;
      onChange();
    }
    dialog.remove();
  },{once:true});
  dialog.showModal();
}

function openDocument(doc,onChange){
  doc.unread=false;
  if(doc.file instanceof File){
    const url=URL.createObjectURL(doc.file);
    window.open(url,"_blank","noopener");
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }else{
    alert("Il PDF demo non è disponibile. I documenti caricati durante la sessione si aprono normalmente.");
  }
  onChange();
}

function openDeleteDialog(root,model,doc,onChange){
  const linked=reportFor(model.data,doc.id);
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog documents-delete-dialog";
  dialog.innerHTML=`<form method="dialog"><header><h2>Elimina documento</h2><button type="button" data-close aria-label="Chiudi">×</button></header><p>Vuoi eliminare “${esc(doc.title)}”?</p>${linked?'<label class="documents-delete-values"><input name="deleteValues" type="checkbox"><span>Elimina anche i valori analisi registrati</span></label>':""}<footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Elimina</button></footer></form>`;
  attachSimpleDialog(root,dialog,values=>{
    model.data.documents=model.data.documents.filter(item=>item.id!==doc.id);
    if(linked&&values.get("deleteValues")==="on")model.data.laboratoryReports=(model.data.laboratoryReports||[]).filter(item=>item.documentId!==doc.id);
    onChange();
  });
}

export function bindDocuments(root,model,onChange){
  root.querySelectorAll("[data-document-filter]").forEach(button=>button.addEventListener("click",()=>{
    model.data.documentUi={...(model.data.documentUi||{}),filter:button.dataset.documentFilter};
    onChange();
  }));
  root.querySelector("[data-unread-filter]")?.addEventListener("click",()=>{
    model.data.documentUi={...(model.data.documentUi||{}),unreadOnly:model.data.documentUi?.unreadOnly!==true};
    onChange();
  });
  root.querySelector("[data-upload-document]")?.addEventListener("click",()=>openUploadDialog(root,model,onChange));
  root.querySelectorAll("[data-open-document]").forEach(button=>button.addEventListener("click",()=>{
    const doc=model.data.documents.find(item=>item.id===button.dataset.openDocument);if(doc)openDocument(doc,onChange);
  }));
  root.querySelectorAll("[data-register-analysis]").forEach(button=>button.addEventListener("click",()=>{
    const doc=model.data.documents.find(item=>item.id===button.dataset.registerAnalysis);if(doc)openAnalysisDialog(root,model,doc,onChange);
  }));
  root.querySelectorAll("[data-delete-document]").forEach(button=>button.addEventListener("click",()=>{
    const doc=model.data.documents.find(item=>item.id===button.dataset.deleteDocument);if(doc)openDeleteDialog(root,model,doc,onChange);
  }));
}
