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

function getReport(data,documentId){
  return (data.laboratoryReports||[]).find(item=>item.documentId===documentId)||null;
}

function getStatus(doc,data){
  const report=doc.category==="analysis"?getReport(data,doc.id):null;
  if(report?.status==="confirmed")return {label:"Registrato",tone:"registered"};
  if(doc.unread)return {label:"Da leggere",tone:"unread"};
  return {label:"Letto",tone:"read"};
}

function getVisibleDocuments(data){
  const filter=data.documentUi?.filter||"all";
  const docs=[...(data.documents||[])].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  return filter==="all"?docs:docs.filter(doc=>doc.category===filter);
}

function renderDocument(doc,data){
  const status=getStatus(doc,data);
  const hasLab=getReport(data,doc.id);
  return `<article class="docs-row ${doc.unread?"is-unread":""}">
    <div class="docs-file">
      <span class="docs-file-icon">${icon("document")}</span>
      <div><strong>${esc(doc.title||doc.fileName||"Documento")}</strong><small>${esc(doc.fileName||"Documento allegato")}</small></div>
    </div>
    <span class="docs-category docs-category-${esc(doc.category)}">${esc(categoryLabel[doc.category]||"Altro")}</span>
    <time datetime="${esc(doc.date||"")}">${fmtDate(doc.date)}</time>
    <span class="docs-status docs-status-${status.tone}">${status.label}</span>
    <div class="docs-actions">
      <button type="button" class="docs-action" data-open-doc="${esc(doc.id)}" aria-label="Apri documento" title="Apri documento">${icon("eye")}</button>
      ${doc.category==="analysis"?`<button type="button" class="docs-action docs-action-lab" data-lab-doc="${esc(doc.id)}" aria-label="${hasLab?"Modifica valori analisi":"Registra valori analisi"}" title="${hasLab?"Modifica valori":"Registra valori"}">${icon("lab")}</button>`:""}
      <button type="button" class="docs-action docs-action-delete" data-delete-doc="${esc(doc.id)}" aria-label="Elimina documento" title="Elimina documento">${icon("trash")}</button>
    </div>
  </article>`;
}

export function renderDocuments(model){
  const data=model.data;
  const filter=data.documentUi?.filter||"all";
  const docs=getVisibleDocuments(data);
  const unread=(data.documents||[]).filter(doc=>doc.unread).length;

  return `<div class="docs-view">
    <header class="docs-head">
      <div class="docs-head-copy">
        <span class="docs-head-icon">${icon("document")}</span>
        <div><h2>Documenti</h2><p>Gestione dei documenti del paziente.</p></div>
      </div>
      <button type="button" class="docs-upload" data-upload-doc>${icon("plus")}<span>Carica documento</span></button>
    </header>

    ${unread?`<div class="docs-unread-note"><span class="docs-unread-dot" aria-hidden="true"></span><div><strong>${unread===1?"1 documento da leggere":`${unread} documenti da leggere`}</strong><p>I documenti caricati dal paziente restano da leggere finché non vengono aperti dal professionista.</p></div></div>`:""}

    <div class="docs-toolbar">
      <nav class="docs-filters" aria-label="Filtra documenti">
        ${filters.map(([key,label])=>`<button type="button" data-doc-filter="${key}" class="${filter===key?"active":""}" aria-pressed="${filter===key}">${label}</button>`).join("")}
      </nav>
      <span class="docs-sort">Data più recente</span>
    </div>

    <section class="docs-card">
      <div class="docs-grid-head" aria-hidden="true"><span>Documento</span><span>Categoria</span><span>Data</span><span>Stato</span><span>Azioni</span></div>
      <div class="docs-list">${docs.length?docs.map(doc=>renderDocument(doc,data)).join(""):`<div class="docs-empty">Nessun documento in questa categoria.</div>`}</div>
    </section>
  </div>`;
}

function makeDialog(root,{title,description,body,saveLabel="Salva",wide=false,onSave}){
  const dialog=document.createElement("dialog");
  dialog.className=`detail-dialog docs-dialog${wide?" docs-dialog-wide":""}`;
  dialog.innerHTML=`<form method="dialog"><header><div><h2>${title}</h2>${description?`<p>${description}</p>`:""}</div><button type="button" data-close aria-label="Chiudi">×</button></header>${body}<footer><button type="button" data-close>Annulla</button><button type="submit" value="save">${saveLabel}</button></footer></form>`;
  root.append(dialog);
  dialog.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>dialog.close()));
  dialog.addEventListener("close",()=>{if(dialog.returnValue==="save")onSave?.(new FormData(dialog.querySelector("form")),dialog);dialog.remove();},{once:true});
  dialog.showModal();
}

function openUploadDialog(root,model,onChange){
  const today=new Date().toISOString().slice(0,10);
  const body=`<div class="docs-form">
    <label class="docs-field-wide">File<input name="file" type="file" accept=".pdf,application/pdf,image/*" required></label>
    <label>Categoria<select name="category"><option value="analysis">Analisi</option><option value="report">Referti</option><option value="other">Altro</option></select></label>
    <label>Data documento<input name="date" type="date" value="${today}" required></label>
    <label class="docs-field-wide">Titolo<input name="title" type="text" required></label>
  </div>`;
  makeDialog(root,{title:"Carica documento",description:"I documenti caricati dal professionista vengono considerati già letti.",body,saveLabel:"Salva documento",onSave:(values,dialog)=>{
    const input=dialog.querySelector('input[name="file"]');
    const file=input.files?.[0];
    const title=String(values.get("title")||"").trim(),date=String(values.get("date")||"").trim(),category=String(values.get("category")||"other");
    if(!(file instanceof File)||!file.name||!title||!date)return;
    model.data.documents.push({id:`doc-${Date.now()}`,category,date,title,fileName:file.name,mimeType:file.type||"",uploadedBy:"professional",unread:false,file});
    onChange();
  }});
  const dialog=root.querySelector("dialog.docs-dialog:last-of-type");
  const fileInput=dialog?.querySelector('input[name="file"]'),titleInput=dialog?.querySelector('input[name="title"]');
  fileInput?.addEventListener("change",()=>{const file=fileInput.files?.[0];if(file&&!titleInput.value)titleInput.value=file.name.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ");});
}

function openLabDialog(root,model,doc,onChange){
  const existing=getReport(model.data,doc.id);
  const body=`<div class="docs-lab-context">
      <span class="docs-file-icon">${icon("document")}</span>
      <div><strong>${esc(doc.title)}</strong><small>${esc(doc.fileName||"")}</small></div>
      <button type="button" class="docs-open-inline" data-open-lab-pdf>Apri PDF</button>
    </div>
    <div class="docs-lab-form">
      <label>Data referto<input name="reportDate" type="date" value="${esc(existing?.reportDate||doc.date||"")}"></label>
      ${labFields.map(([key,label])=>`<label>${label}<input name="${key}" value="${esc(existing?.values?.[key]||"")}"></label>`).join("")}
      <label class="docs-field-wide">Note<textarea name="notes" rows="4">${esc(existing?.notes||"")}</textarea></label>
    </div>`;
  makeDialog(root,{title:"Registra valori analisi",description:"Trascrivi i valori letti dal PDF. Il record resta collegato al documento.",body,saveLabel:"Salva valori",wide:true,onSave:values=>{
    const reports=model.data.laboratoryReports||(model.data.laboratoryReports=[]);
    const record={id:existing?.id||`lab-${Date.now()}`,documentId:doc.id,reportDate:String(values.get("reportDate")||doc.date||""),status:"confirmed",values:Object.fromEntries(labFields.map(([key])=>[key,String(values.get(key)||"").trim()])),notes:String(values.get("notes")||"").trim(),updatedAt:new Date().toISOString()};
    if(existing)Object.assign(existing,record);else reports.push(record);
    doc.unread=false;
    onChange();
  }});
  root.querySelector("dialog.docs-dialog:last-of-type [data-open-lab-pdf]")?.addEventListener("click",()=>openDocument(doc,onChange));
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
  const linked=getReport(model.data,doc.id);
  const body=linked?`<div class="docs-delete-note"><strong>Analisi collegate</strong><p>Questo PDF ha valori registrati. Eliminando il documento puoi scegliere se mantenere o eliminare anche i valori.</p><label class="docs-delete-choice"><input name="deleteValues" type="checkbox"><span>Elimina anche i valori registrati</span></label></div>`:"";
  makeDialog(root,{title:"Elimina documento",description:`Vuoi eliminare “${esc(doc.title)}”?`,body,saveLabel:"Elimina",onSave:values=>{
    model.data.documents=model.data.documents.filter(item=>item.id!==doc.id);
    if(linked&&values.get("deleteValues")==="on")model.data.laboratoryReports=(model.data.laboratoryReports||[]).filter(item=>item.documentId!==doc.id);
    onChange();
  }});
}

export function bindDocuments(root,model,onChange){
  root.querySelectorAll("[data-doc-filter]").forEach(button=>button.addEventListener("click",()=>{
    model.data.documentUi={...(model.data.documentUi||{}),filter:button.dataset.docFilter};
    onChange();
  }));
  root.querySelector("[data-upload-doc]")?.addEventListener("click",()=>openUploadDialog(root,model,onChange));
  root.querySelectorAll("[data-open-doc]").forEach(button=>button.addEventListener("click",()=>{
    const doc=model.data.documents.find(item=>item.id===button.dataset.openDoc);if(doc)openDocument(doc,onChange);
  }));
  root.querySelectorAll("[data-lab-doc]").forEach(button=>button.addEventListener("click",()=>{
    const doc=model.data.documents.find(item=>item.id===button.dataset.labDoc);if(doc)openLabDialog(root,model,doc,onChange);
  }));
  root.querySelectorAll("[data-delete-doc]").forEach(button=>button.addEventListener("click",()=>{
    const doc=model.data.documents.find(item=>item.id===button.dataset.deleteDoc);if(doc)openDeleteDialog(root,model,doc,onChange);
  }));
}
