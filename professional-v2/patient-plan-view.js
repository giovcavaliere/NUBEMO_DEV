const esc=value=>String(value??"").replace(/[&<>"\']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","\'":"&#039;"}[char]));
const icon=name=>`<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${name}"/></svg>`;
const fmtDate=value=>value?new Intl.DateTimeFormat("it-IT",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`)):"—";
const selectedPlanByPatient=new Map();

function dateValue(value){const time=new Date(`${value}T12:00:00`).getTime();return Number.isFinite(time)?time:0;}
function todayKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}

function getPlanState(data){
  const plans=[...(data.nutritionPlans||[])].sort((a,b)=>dateValue(b.validFrom)-dateValue(a.validFrom));
  const today=todayKey();
  const current=plans.find(plan=>plan.validFrom&&plan.validFrom<=today)||null;
  const future=plans.filter(plan=>plan.validFrom&&plan.validFrom>today);
  const previous=plans.filter(plan=>plan!==current&&!future.includes(plan));
  return {plans,current,future,previous,today};
}

function statusFor(plan,state){
  if(state.current?.id===plan.id)return {label:"IN VIGORE",className:"current"};
  if(plan.validFrom&&plan.validFrom>state.today)return {label:"PROGRAMMATO",className:"future"};
  return {label:"PRECEDENTE",className:"past"};
}

function renderListItem(plan,state,selected){
  const status=statusFor(plan,state);
  return `<button type="button" class="plan-list-item ${selected?"selected":""}" data-select-plan="${esc(plan.id)}">
    <span class="plan-list-dot ${status.className}" aria-hidden="true"></span>
    <span class="plan-list-copy"><strong>${esc(plan.title||"Piano alimentare")}</strong><small>${plan.validFrom?`Valido dal ${fmtDate(plan.validFrom)}`:"Decorrenza non indicata"}</small></span>
    ${status.className!=="past"?`<span class="plan-list-badge ${status.className}">${status.label}</span>`:""}
  </button>`;
}

export function renderPlan(model){
  const state=getPlanState(model.data);
  const patientId=model.data.identity.id;
  const requested=selectedPlanByPatient.get(patientId);
  const selected=state.plans.find(plan=>plan.id===requested)||state.current||state.future[0]||state.plans[0]||null;
  if(selected)selectedPlanByPatient.set(patientId,selected.id);
  const selectedStatus=selected?statusFor(selected,state):null;

  return `<div class="detail-plan">
    <header class="plan-head">
      <div class="plan-head-copy"><span class="plan-head-icon">${icon("document")}</span><div><h2>Piano alimentare</h2><p>Gestione dei piani alimentari assegnati al paziente.</p></div></div>
      <button type="button" class="plan-upload" data-upload-plan>${icon("plus")}<span>Carica nuovo piano</span></button>
    </header>
    ${state.plans.length?`<div class="plan-layout">
      <aside class="plan-sidebar" aria-label="Piani alimentari del paziente">
        <section class="plan-sidebar-section"><h3>Piano in vigore</h3>${state.current?renderListItem(state.current,state,selected?.id===state.current.id):`<p class="plan-sidebar-empty">Nessun piano attualmente in vigore.</p>`}</section>
        ${state.future.length?`<section class="plan-sidebar-section"><h3>Programmati</h3><div class="plan-list">${state.future.map(plan=>renderListItem(plan,state,selected?.id===plan.id)).join("")}</div></section>`:""}
        <section class="plan-sidebar-section"><h3>Piani precedenti</h3>${state.previous.length?`<div class="plan-list">${state.previous.map(plan=>renderListItem(plan,state,selected?.id===plan.id)).join("")}</div>`:`<p class="plan-sidebar-empty">Nessun piano precedente.</p>`}</section>
      </aside>
      ${selected?`<section class="plan-detail-card">
        <header class="plan-detail-head"><div><div class="plan-detail-title-line"><h3>${esc(selected.title||"Piano alimentare")}</h3><span class="plan-status ${selectedStatus.className}">${selectedStatus.label}</span></div><p>${selected.validFrom?`Valido dal ${fmtDate(selected.validFrom)}`:"Decorrenza non indicata"}</p></div>
          <div class="plan-detail-actions"><button type="button" data-open-plan="${esc(selected.id)}">${icon("document")}<span>Apri PDF</span></button><button type="button" class="plan-danger" data-delete-plan="${esc(selected.id)}"><span>Elimina</span></button></div></header>
        <div class="plan-file-box"><span class="plan-file-icon">${icon("document")}</span><span><strong>${esc(selected.fileName||"Piano alimentare.pdf")}</strong><small>Documento PDF del piano</small></span><button type="button" data-open-plan="${esc(selected.id)}">Apri</button></div>
        <section class="plan-note-box"><header><div><span>Nota interna</span><small>Non visibile al paziente</small></div><button type="button" data-edit-plan-note="${esc(selected.id)}">${icon("edit")}<span>Modifica</span></button></header><p>${selected.professionalNote?esc(selected.professionalNote):"Nessuna nota inserita."}</p></section>
      </section>`:""}
    </div>`:`<section class="detail-panel plan-empty"><span class="plan-empty-icon">${icon("document")}</span><div><strong>Nessun piano alimentare caricato</strong><p>Carica il primo PDF e indica la data da cui deve essere valido.</p></div><button type="button" class="plan-upload" data-upload-plan>${icon("plus")}<span>Carica piano</span></button></section>`}
  </div>`;
}

function makeDialog(root,title,description,body,saveLabel,onSave){
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog plan-dialog";
  dialog.innerHTML=`<form method="dialog"><header><h2>${title}</h2><button type="button" data-close aria-label="Chiudi">×</button></header><p>${description}</p>${body}<footer><button type="button" data-close>Annulla</button><button type="submit" value="save">${saveLabel}</button></footer></form>`;
  root.append(dialog);
  dialog.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>dialog.close()));
  dialog.addEventListener("close",()=>{if(dialog.returnValue==="save")onSave(new FormData(dialog.querySelector("form")));dialog.remove();},{once:true});
  dialog.showModal();
}

function openUpload(root,model,onChange){
  const body=`<div class="plan-form"><label>File PDF<input name="planFile" type="file" accept=".pdf,application/pdf" required></label><label>Titolo piano<input name="planTitle" type="text" required placeholder="Es. Piano dimagrimento – Fase 1"></label><label>Valido dal<input name="planValidFrom" type="date" required></label><label>Nota professionista <small>Facoltativa · non visibile al paziente</small><textarea name="planNote" rows="4" placeholder="Nota interna sul piano..."></textarea></label></div>`;
  makeDialog(root,"Carica nuovo piano","Pubblica un nuovo piano alimentare PDF per il paziente.",body,"Pubblica piano",values=>{
    const file=values.get("planFile"),title=String(values.get("planTitle")||"").trim(),validFrom=String(values.get("planValidFrom")||"").trim(),professionalNote=String(values.get("planNote")||"").trim();
    if(!(file instanceof File)||!file.name||!title||!validFrom)return;
    if(!file.name.toLowerCase().endsWith(".pdf")&&file.type!=="application/pdf")return;
    const plan={id:`plan-${Date.now()}`,title,validFrom,fileName:file.name,professionalNote,uploadedAt:new Date().toISOString(),file};
    model.data.nutritionPlans.push(plan);selectedPlanByPatient.set(model.data.identity.id,plan.id);onChange();
  });
}

function openNote(root,model,plan,onChange){
  const body=`<div class="plan-form"><label>Nota<textarea name="planNote" rows="6">${esc(plan.professionalNote||"")}</textarea></label></div>`;
  makeDialog(root,"Nota del piano","Nota interna del professionista. Non è visibile al paziente.",body,"Salva nota",values=>{plan.professionalNote=String(values.get("planNote")||"").trim();plan.updatedAt=new Date().toISOString();onChange();});
}

function openDelete(root,model,plan,onChange){
  makeDialog(root,"Elimina piano",`Vuoi eliminare “${esc(plan.title||"Piano alimentare")}” dallo storico?`,"","Elimina",()=>{const index=model.data.nutritionPlans.findIndex(item=>item.id===plan.id);if(index>=0)model.data.nutritionPlans.splice(index,1);if(selectedPlanByPatient.get(model.data.identity.id)===plan.id)selectedPlanByPatient.delete(model.data.identity.id);onChange();});
}

export function bindPlan(root,model,onChange){
  root.querySelectorAll("[data-select-plan]").forEach(button=>button.addEventListener("click",()=>{selectedPlanByPatient.set(model.data.identity.id,button.dataset.selectPlan);onChange();}));
  root.querySelectorAll("[data-upload-plan]").forEach(button=>button.addEventListener("click",()=>openUpload(root,model,onChange)));
  root.querySelectorAll("[data-open-plan]").forEach(button=>button.addEventListener("click",()=>{const plan=model.data.nutritionPlans.find(item=>item.id===button.dataset.openPlan);if(!plan)return;if(plan.file instanceof File){const url=URL.createObjectURL(plan.file);window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000);return;}alert("Il PDF di questo piano demo non è disponibile. I PDF caricati durante la sessione si aprono normalmente.");}));
  root.querySelectorAll("[data-edit-plan-note]").forEach(button=>button.addEventListener("click",()=>{const plan=model.data.nutritionPlans.find(item=>item.id===button.dataset.editPlanNote);if(plan)openNote(root,model,plan,onChange);}));
  root.querySelectorAll("[data-delete-plan]").forEach(button=>button.addEventListener("click",()=>{const plan=model.data.nutritionPlans.find(item=>item.id===button.dataset.deletePlan);if(plan)openDelete(root,model,plan,onChange);}));
}