import {renderPlan,selectRealPlan} from "./patient-plan-view.js?v=plan-single-open-20261015";
import {renderLivePatientOverview} from "./patient-detail-view.js";
import {loadLivePlans,publishPlan,openPlanFile,updatePlanNote,removePlan} from "./patient-plan-live-service.js?v=plan-private-notes-20261015";
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function modal(title,body,saveLabel,onSave){
 const d=document.createElement("dialog");d.className="detail-dialog plan-dialog";
 d.innerHTML='<form><header><h2>'+escape(title)+'</h2><button type="button" data-close aria-label="Chiudi">×</button></header>'+body+'<footer><button type="button" data-close>Annulla</button><button type="submit" data-plan-submit>'+escape(saveLabel)+'</button></footer><p data-error role="alert"></p></form>';
 document.body.append(d);d.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",event=>{event.preventDefault();d.close();}));d.addEventListener("close",()=>d.remove(),{once:true});
 d.querySelector("form").addEventListener("submit",async e=>{e.preventDefault();const button=d.querySelector('[data-plan-submit]');button.disabled=true;try{await onSave(new FormData(d.querySelector("form")),d);d.close();}catch(error){d.querySelector("[data-error]").textContent=error.message||"Operazione non riuscita";button.disabled=false;}});
 d.showModal();
}
export async function renderLivePatientPlans(root,overview){
 const patientId=overview.patient.id;
 const active=overview.pathways.find(p=>p.status==="active");
 let plans=await loadLivePlans(patientId,overview.pathways);
 const pendingPlan=sessionStorage.getItem("nubemo-pro2-select-plan-"+patientId);
 if(pendingPlan){selectRealPlan(patientId,pendingPlan);sessionStorage.removeItem("nubemo-pro2-select-plan-"+patientId);}
 renderLivePatientOverview(root,overview,"piano",{});
 const body=root.querySelector(".detail-content");
 const model={data:{identity:{id:patientId},nutritionPlans:plans}};
 const refresh=async()=>{plans=await loadLivePlans(patientId,overview.pathways);model.data.nutritionPlans=plans;draw();};
 function draw(){
  body.innerHTML=renderPlan(model);
  body.querySelectorAll("[data-select-plan]").forEach(b=>b.addEventListener("click",()=>{selectRealPlan(patientId,b.dataset.selectPlan);draw();}));
  body.querySelectorAll("[data-upload-plan]").forEach(b=>{
   if(!active){b.disabled=true;b.title="Richiede un percorso attivo";return;}
   b.addEventListener("click",()=>modal("Carica nuovo piano",'<p>Pubblica un nuovo piano alimentare PDF per il paziente.</p><div class="plan-form"><label>File PDF<input name="file" type="file" accept="application/pdf,.pdf" required></label><label>Titolo piano<input name="title" required maxlength="200"></label><label>Valido dal<input name="validFrom" type="date" required></label><label>Nota professionista <small>Non visibile al paziente</small><textarea name="note" rows="4"></textarea></label></div>','Pubblica piano',async(data,dialog)=>{
    await publishPlan(patientId,active,dialog.querySelector('[name="file"]').files[0],String(data.get("title")||""),String(data.get("validFrom")||""),String(data.get("note")||""));await refresh();
   }));
  });
  body.querySelectorAll("[data-open-plan]").forEach(b=>b.addEventListener("click",async()=>{const p=plans.find(x=>x.id===b.dataset.openPlan);if(!p)return;try{await openPlanFile(p);}catch(error){alert(error.message||"Impossibile aprire il piano");}}));
  body.querySelectorAll("[data-edit-plan-note]").forEach(b=>{
   const p=plans.find(x=>x.id===b.dataset.editPlanNote);
   if(!p||!active||p.pathwayId!==active.id){b.disabled=true;b.title="Piano storico in sola lettura";return;}
   b.addEventListener("click",()=>modal("Nota del piano",'<p>Nota interna, non visibile al paziente.</p><div class="plan-form"><label>Nota<textarea name="note" rows="6">'+escape(p.professionalNote)+'</textarea></label></div>','Salva nota',async values=>{await updatePlanNote(p,String(values.get("note")||""));await refresh();}));
  });
  body.querySelectorAll("[data-delete-plan]").forEach(b=>{
   const p=plans.find(x=>x.id===b.dataset.deletePlan);
   if(!p||!active||p.pathwayId!==active.id){b.disabled=true;b.title="Piano storico in sola lettura";return;}
   b.addEventListener("click",()=>modal("Elimina piano",'<p>Eliminare "'+escape(p.title)+'" dallo storico dei piani? Il PDF associato sarà conservato nella cartella documenti.</p>','Elimina',async()=>{await removePlan(p);await refresh();}));
  });
 }
 draw();
}
