const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const fmtDate=value=>value?new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value.length===10?`${value}T12:00:00`:value)):"—";
const icon=name=>`<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${name}"/></svg>`;
const categoryLabels={analysis:"Analisi",report:"Referti",other:"Altro"};
const filters=[["all","Tutti"],["analysis","Analisi"],["report","Referti"],["other","Altro"]];
const labFields=[
  ["glucose","Glicemia"],["cholesterol","Colesterolo"],["hdl","HDL"],["ldl","LDL"],
  ["triglycerides","Trigliceridi"],["got","GOT"],["gpt","GPT"],["uricAcid","Acido urico"],
  ["creatinine","Creatinina"],["ggt","GGT"],["tsh","TSH"],["vitaminD","Vitamina D"]
];

function documentStatus(doc,reports){
  if(doc.category==="analysis"){
    const report=reports.find(item=>item.documentId===doc.id);
    if(report?.status==="confirmed") return {label:"Registrato",tone:"success"};
    if(doc.unread) return {label:"Da leggere",tone:"warning"};
    return {label:"Letto",tone:"neutral"};
  }
  return doc.unread?{label:"Da leggere",tone:"warning"}:{label:"Letto",tone:"success"};
}

function renderRow(doc,reports){
  const status=documentStatus(doc,reports);
  const analysis=doc.category==="analysis";
  return `<article class="patient-document-row ${doc.unread?"is-unread":""}" data-document-id="${escapeHtml(doc.id)}">
    <div class="patient-document-main">
      <span class="patient-document-file">${icon("document")}</span>
      <div>
        <strong>${escapeHtml(doc.title||doc.fileName||"Documento")}</strong>
        <small>${escapeHtml(doc.fileName||"File")}</small>
      </div>
    </div>
    <span class="patient-document-category category-${escapeHtml(doc.category)}">${categoryLabels[doc.category]||"Altro"}</span>
    <time datetime="${escapeHtml(doc.date||"")}">${fmtDate(doc.date)}</time>
    <span class="patient-document-status ${status.tone}">${status.label}</span>
    <div class="patient-document-actions">
      <button type="button" class="document-icon-action" data-open-document="${escapeHtml(doc.id)}" aria-label="Apri documento" title="Apri">${icon("document")}</button>
      ${analysis?`<button type="button" class="document-icon-action document-analysis-action" data-edit-lab="${escapeHtml(doc.id)}" aria-label="${reports.some(item=>item.documentId===doc.id)?"Modifica valori analisi":"Registra valori analisi"}" title="${reports.some(item=>item.documentId===doc.id)?"Valori analisi":"Registra valori"}">${icon("edit")}</button>`:""}
      <button type="button" class="document-icon-action document-delete" data-delete-document="${escapeHtml(doc.id)}" aria-label="Elimina documento" title="Elimina">×</button>
    </div>
  </article>`;
}

export function renderDocuments(model){
  const data=model.data;
  const filter=data.documentUi?.filter||"all";
  const docs=[...(data.documents||[])].sort((a,b)=>String(b.date||b.uploadedAt||"").localeCompare(String(a.date||a.uploadedAt||"")));
  const filtered=filter==="all"?docs:docs.filter(doc=>doc.category===filter);
  const unread=docs.filter(doc=>doc.unread).length;
  return `<section class="patient-documents">
    <header class="patient-documents-head">
      <div class="patient-documents-title">
        <span class="patient-documents-title-icon">${icon("document")}</span>
        <div><h2>Documenti</h2><p>Gestisci i documenti del paziente.</p></div>
      </div>
      <button type="button" class="patient-documents-upload" data-upload-document>${icon("plus")}<span>Carica documento</span></button>
    </header>

    ${unread?`<div class="patient-documents-alert"><strong>${unread===1?"1 documento da leggere":`${unread} documenti da leggere`}</strong><span>I documenti caricati dal paziente restano in attesa finché non vengono aperti dal professionista.</span></div>`:""}

    <div class="patient-documents-toolbar">
      <nav class="patient-document-filters" aria-label="Filtra documenti">
        ${filters.map(([key,label])=>`<button type="button" class="${filter===key?"active":""}" data-document-filter="${key}" ${filter===key?'aria-pressed="true"':'aria-pressed="false"'}>${label}</button>`).join("")}
      </nav>
      <span class="patient-documents-order">Data più recente</span>
    </div>

    <div class="patient-document-table">
      <div class="patient-document-table-head"><span>Nome</span><span>Categoria</span><span>Data</span><span>Stato</span><span>Azioni</span></div>
      <div class="patient-document-list">
        ${filtered.length?filtered.map(doc=>renderRow(doc,data.laboratoryReports||[])).join(""):`<div class="patient-documents-empty">Nessun documento in questa categoria.</div>`}
      </div>
    </div>
  </section>`;
}

function attachDialog(root,dialog,onSave){
  root.append(dialog);
  dialog.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>dialog.close()));
  dialog.addEventListener("close",()=>{if(dialog.returnValue==="save")onSave?.(new FormData(dialog.querySelector("form")));dialog.remove();},{once:true});
  dialog.showModal();
}

function openUploadDialog(root,model,onChange){
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog document-dialog";
  dialog.innerHTML=`<form method="dialog">
    <header><h2>Carica documento</h2><button type="button" data-close aria-label="Chiudi">×</button></header>
    <p>Il documento caricato dal professionista nasce già come letto.</p>
    <div class="document-form-grid">
      <label class="document-field-wide">File<input name="file" type="file" accept=".pdf,application/pdf,image/*" required></label>
      <label>Categoria<select name="category"><option value="analysis">Analisi</option><option value="report">Referti</option><option value="other">Altro</option></select></label>
      <label>Data documento<input name="date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label>
      <label class="document-field-wide">Titolo<input name="title" required placeholder="Titolo documento"></label>
    </div>
    <footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Salva documento</button></footer>
  </form>`;
  const fileInput=dialog.querySelector('input[name="file"]'),titleInput=dialog.querySelector('input[name="title"]');
  fileInput.addEventListener("change",()=>{const f=fileInput.files?.[0];if(f&&!titleInput.value)titleInput.value=f.name.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ");});
  attachDialog(root,dialog,values=>{
    const file=fileInput.files?.[0];
    if(!file)return;
    model.data.documents.push({
      id:`doc-${Date.now()}`,category:String(values.get("category")||"other"),type:"document",
      title:String(values.get("title")||file.name).trim(),date:String(values.get("date")||""),
      fileName:file.name,mimeType:file.type,size:file.size,uploadedBy:"professional",uploadedAt:new Date().toISOString(),
      unread:false,file
    });
    onChange();
  });
}

function openLabDialog(root,model,document,onChange){
  const reports=model.data.laboratoryReports||(model.data.laboratoryReports=[]);
  const existing=reports.find(item=>item.documentId===document.id);
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog detail-dialog-wide document-lab-dialog";
  dialog.innerHTML=`<form method="dialog">
    <header><div><h2>Valori analisi</h2><p>${escapeHtml(document.title)}</p></div><button type="button" data-close aria-label="Chiudi">×</button></header>
    <div class="document-lab-grid">
      <label>Data referto<input name="reportDate" type="date" value="${escapeHtml(existing?.reportDate||document.date||"")}"></label>
      ${labFields.map(([key,label])=>`<label>${label}<input name="${key}" value="${escapeHtml(existing?.values?.[key]||"")}"></label>`).join("")}
      <label class="document-field-wide">Note<textarea name="notes" rows="4">${escapeHtml(existing?.notes||"")}</textarea></label>
    </div>
    <footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Salva valori</button></footer>
  </form>`;
  attachDialog(root,dialog,values=>{
    const record={
      id:existing?.id||`lab-${Date.now()}`,documentId:document.id,reportDate:String(values.get("reportDate")||document.date||""),
      status:"confirmed",values:Object.fromEntries(labFields.map(([key])=>[key,String(values.get(key)||"").trim()])),
      notes:String(values.get("notes")||"").trim(),updatedAt:new Date().toISOString()
    };
    if(existing)Object.assign(existing,record);else reports.push(record);
    document.unread=false;
    onChange();
  });
}

function openDocument(document,onChange){
  document.unread=false;
  if(document.file){
    const url=URL.createObjectURL(document.file);
    window.open(url,"_blank");
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }else{
    alert("Il file demo non contiene un PDF reale. In produzione verrà aperto il documento archiviato.");
  }
  onChange();
}

function deleteDocument(model,document,onChange){
  if(!confirm(`Eliminare “${document.title}”?`))return;
  const reports=model.data.laboratoryReports||(model.data.laboratoryReports=[]);
  const linked=reports.find(item=>item.documentId===document.id);
  if(linked&&confirm("Sono presenti anche valori di analisi registrati. Eliminare anche i dati collegati?")){
    model.data.laboratoryReports=reports.filter(item=>item.documentId!==document.id);
  }
  model.data.documents=model.data.documents.filter(item=>item.id!==document.id);
  onChange();
}

export function bindDocuments(root,model,onChange){
  root.querySelectorAll("[data-document-filter]").forEach(button=>button.addEventListener("click",()=>{
    model.data.documentUi={...(model.data.documentUi||{}),filter:button.dataset.documentFilter};
    onChange();
  }));
  root.querySelector("[data-upload-document]")?.addEventListener("click",()=>openUploadDialog(root,model,onChange));
  root.querySelectorAll("[data-open-document]").forEach(button=>button.addEventListener("click",()=>{
    const doc=model.data.documents.find(item=>item.id===button.dataset.openDocument);if(doc)openDocument(doc,onChange);
  }));
  root.querySelectorAll("[data-edit-lab]").forEach(button=>button.addEventListener("click",()=>{
    const doc=model.data.documents.find(item=>item.id===button.dataset.editLab);if(doc)openLabDialog(root,model,doc,onChange);
  }));
  root.querySelectorAll("[data-delete-document]").forEach(button=>button.addEventListener("click",()=>{
    const doc=model.data.documents.find(item=>item.id===button.dataset.deleteDocument);if(doc)deleteDocument(model,doc,onChange);
  }));
}
