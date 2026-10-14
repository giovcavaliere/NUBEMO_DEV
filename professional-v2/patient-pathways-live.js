import {renderPathwayManagement} from "./patient-pathways-view.js?v=pathway-archive-20261009";

const OBJECTIVES=[
 ["weight_loss","Dimagrimento"],["weight_gain","Aumento di peso"],
 ["body_recomposition","Ricomposizione corporea"],["maintenance","Mantenimento"],
 ["nutrition_education","Educazione alimentare"],
 ["clinical_support","Supporto a patologia / condizione specifica"],
 ["sports_performance","Performance sportiva"],["other","Altro"]
];
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const formatDate=value=>value?new Intl.DateTimeFormat("it-IT").format(new Date(String(value).length===10?value+"T12:00:00":value)):"—";
const objectiveLabel=item=>item.objective_key==="other"?(item.custom_objective||"Altro"):OBJECTIVES.find(([key])=>key===item.objective_key)?.[1]||"Non specificato";
const isoDate=value=>value?String(value).slice(0,10):"";
export function pathwayViewModel(pathways){
 return {data:{pathways:{items:pathways.map(p=>({
   id:p.id,status:p.status,startedAt:p.pathway_start_date||isoDate(p.started_at),
   proposedAt:p.pathway_start_date||null,endedAt:p.ended_at,
   objectiveKey:p.objective_key||"",objectiveLabel:objectiveLabel(p),
   customObjective:p.custom_objective||"",objectiveNote:p.objective_note||"",
   closingNote:p.closing_note||""
 })),ui:{historyOpen:false,selectedHistoryId:null}}}};
}
export async function manageRealPathway(patientId,action,values={}){
 const client=window.nubemoSupabase;
 if(!client||!window.NUBEMO_PRO2_PROFILE?.id)throw Error("Sessione non disponibile.");
 const {error}=await client.rpc("pro2_manage_pathway",{
   p_patient_id:patientId,p_action:action,p_pathway_id:values.id||null,
   p_start_date:values.startedAt||null,p_objective_key:values.objectiveKey||null,
   p_custom_objective:values.customObjective||null,p_objective_note:values.objectiveNote||null,
   p_closing_note:values.closingNote||null
 });
 if(error)throw Error(error.message||"Operazione non riuscita.");
}
export function bindRealPathway(root,patientId,pathways,onSaved){
 const model=pathwayViewModel(pathways);
 const region=root.querySelector(".pathway-management");
 if(!region)return;
 function repaint(){
  region.innerHTML=renderPathwayManagement(model);
  bind();
 }
 function showDialog(title,body,submitText,onConfirm){
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog pathway-dialog";
  dialog.innerHTML=`<form><header><h2>${escapeHtml(title)}</h2><button type="button" data-close aria-label="Chiudi">×</button></header>${body}<footer><button type="button" data-close>Annulla</button><button type="submit">${escapeHtml(submitText)}</button></footer><p role="alert" data-pathway-error></p></form>`;
  root.append(dialog);
  dialog.querySelector("[data-close]").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>dialog.remove(),{once:true});
  dialog.querySelector("form").addEventListener("submit",async event=>{
   event.preventDefault();
   const button=dialog.querySelector("[type=submit]");
   button.disabled=true;
   const formData=new FormData(dialog.querySelector("form"));
   try{await onConfirm(formData);dialog.close();onSaved();}
   catch(err){dialog.querySelector("[data-pathway-error]").textContent=err.message||"Operazione non riuscita.";button.disabled=false;}
  });
  dialog.showModal();
  const selection=dialog.querySelector('[name="objectiveKey"]');
  if(selection){
   const custom=dialog.querySelector("[data-pathway-custom]");
   const update=()=>{custom.hidden=selection.value!=="other";custom.querySelector("input").required=selection.value==="other";};
   selection.addEventListener("change",update);update();
  }
 }
 function objectiveFields(item={}){
  const key=item.objectiveKey||"weight_loss";
  // Mantiene le stesse classi e gerarchie del form approvato.
  return `<div class="pathway-dialog-fields">
   <label><span>Data di inizio</span><input name="startedAt" type="date" value="${escapeHtml(item.startedAt||new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10))}" required></label>
   <label><span>Obiettivo principale</span><select name="objectiveKey">${OBJECTIVES.map(([value,label])=>`<option value="${value}" ${key===value?"selected":""}>${escapeHtml(label)}</option>`).join("")}</select></label>
   <label class="pathway-custom-objective" data-pathway-custom hidden><span>Specifica obiettivo</span><input name="customObjective" value="${escapeHtml(item.customObjective||"")}" maxlength="100"></label>
   <label class="pathway-note-field"><span>Nota obiettivo <small>(facoltativa)</small></span><textarea name="objectiveNote" rows="4" maxlength="300" placeholder="Breve indicazione utile per contestualizzare il percorso.">${escapeHtml(item.objectiveNote||"")}</textarea></label>
  </div>`;
 }
 const values=data=>({
   startedAt:String(data.get("startedAt")||""),
   objectiveKey:String(data.get("objectiveKey")||""),
   customObjective:String(data.get("customObjective")||"").trim(),
   objectiveNote:String(data.get("objectiveNote")||"").trim()
 });
 function bind(){
  region.querySelector("[data-pathway-new]")?.addEventListener("click",()=>{
   showDialog("Apri nuovo percorso",`<p>Il paziente esiste già come anagrafica. Il percorso viene creato solo ora.</p>${objectiveFields()}`,"Apri percorso",
    data=>manageRealPathway(patientId,"create",values(data)));
  });
  region.querySelector("[data-pathway-edit]")?.addEventListener("click",()=>{
   const item=model.data.pathways.items.find(p=>p.status==="active");if(!item)return;
   showDialog("Gestisci percorso",objectiveFields(item),"Salva",
    data=>manageRealPathway(patientId,"update",{id:item.id,...values(data)}));
  });
  region.querySelector("[data-pathway-end]")?.addEventListener("click",()=>{
   const item=model.data.pathways.items.find(p=>p.status==="active");if(!item)return;
   showDialog("Concludi percorso",`<p>Il percorso verrà spostato nello storico e resterà consultabile in sola lettura.</p>
     <div class="pathway-end-summary"><strong>${escapeHtml(item.objectiveLabel)}</strong><span>Iniziato il ${formatDate(item.startedAt)}</span></div>
     <label class="pathway-closing-note"><span>Nota di chiusura <small>(facoltativa)</small></span><textarea name="closingNote" rows="4" maxlength="400" placeholder="Esito del percorso, indicazioni finali o motivo della chiusura."></textarea></label>`,"Concludi percorso",
    data=>manageRealPathway(patientId,"end",{id:item.id,closingNote:String(data.get("closingNote")||"").trim()}));
  });
  region.querySelector("[data-pathway-history]")?.addEventListener("click",()=>{
   model.data.pathways.ui.historyOpen=true;repaint();
  });
  region.querySelector("[data-pathway-history-close]")?.addEventListener("click",()=>{
   model.data.pathways.ui.historyOpen=false;repaint();
  });
  region.querySelectorAll("[data-pathway-history-open]").forEach(button=>button.addEventListener("click",()=>{
   const item=model.data.pathways.items.find(p=>p.id===button.dataset.pathwayHistoryOpen);
   if(!item)return;
   showHistory(item);
  }));
 }
 function showHistory(item){
  const dialog=document.createElement("dialog");
  dialog.className="pathway-history-dialog";
  dialog.innerHTML=`<div class="pathway-history-sheet">
   <header class="pathway-history-head"><div><span class="pathway-eyebrow">CARTELLA DEL PERCORSO</span><h2>Storico percorso</h2></div><button type="button" class="pathway-close" data-close aria-label="Chiudi">×</button></header>
   <div class="pathway-archive-heading"><h3>${escapeHtml(item.objectiveLabel)}</h3><span class="pathway-status ended">Concluso</span></div>
   <p class="pathway-archive-dates">${formatDate(item.startedAt)} → ${formatDate(item.endedAt)}</p>
   <p class="pathway-readonly-note">Percorso storico in sola lettura</p>
   ${item.objectiveNote?`<aside class="pathway-archive-notes"><div class="pathway-history-note"><h4>Nota obiettivo</h4><p>${escapeHtml(item.objectiveNote)}</p></div></aside>`:""}
   ${item.closingNote?`<aside class="pathway-archive-notes"><div class="pathway-history-note"><h4>Nota di chiusura</h4><p>${escapeHtml(item.closingNote)}</p></div></aside>`:""}
   <p>Il dettaglio clinico archiviato sarà consultabile dopo la migrazione delle rispettive sezioni.</p>
   <footer><button type="button" class="pathway-secondary" data-close>Chiudi storico</button></footer>
  </div>`;
  root.append(dialog);
  dialog.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>dialog.close()));
  dialog.addEventListener("close",()=>dialog.remove(),{once:true});
  dialog.showModal();
 }
 bind();
}
