const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const controls=(event,locked)=>`<div class="visit-appointment-form">
<label>Tipo appuntamento<select name="type" ${locked?"disabled":""}>${(event.type==="personal"?[["personal","Impegno personale"]]:[["first","Prima visita"],["control","Controllo"]]).map(([type,label])=>`<option value="${type}" ${event.type===type?"selected":""}>${label}</option>`).join("")}</select></label>
<label>Data<input type="date" name="date" required value="${esc(event.date)}" ${locked?"disabled":""}></label>
<label>Ora<input type="time" name="start" required value="${esc(event.start)}" ${locked?"disabled":""}></label>
<label>Durata (minuti)<select name="duration" ${locked?"disabled":""}>${[...new Set([15,30,45,60,90,120,180,240,360,Number(event.duration)])].filter(n=>n>0).sort((a,b)=>a-b).map(n=>`<option value="${n}" ${n===event.duration?"selected":""}>${n} minuti</option>`).join("")}</select></label>
<label class="visit-form-wide">Note appuntamento<textarea name="notes" rows="4">${esc(event.notes)}</textarea></label></div>`;
export function openLiveAgendaEditor(root,event,api){
 const locked=!!event.appointmentLocked;
 const dialog=document.createElement("dialog");
 dialog.className="detail-dialog visit-appointment-dialog";
 dialog.innerHTML=`<form>
 <header><h2>${event.type==="personal"?"Impegno personale":event.type==="first"?"Prima visita":"Controllo"}</h2><button type="button" data-close aria-label="Chiudi">×</button></header>
 <p>${esc(event.name)} · ${locked?"Visita registrata: appuntamento protetto.":"Modifica l'appuntamento nell'Agenda."}</p>
 ${controls(event,locked)}
 ${locked?'<label class="visit-dialog-lock"><input type="checkbox" data-enable-correction> Correggi esplicitamente data, ora e durata</label>':""}
 <p role="alert" data-error hidden></p>
 <footer>${!locked?'<button type="button" class="visit-dialog-delete" data-delete-appointment>Elimina appuntamento</button>':""}
 <button type="button" data-close>Annulla</button><button type="submit">Salva modifiche</button></footer>
 </form>`;
 root.append(dialog);
 const form=dialog.querySelector("form"),error=dialog.querySelector("[data-error]");
 const report=e=>{error.hidden=false;error.textContent=e.message||"Operazione non riuscita";};
 dialog.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>dialog.close()));
 dialog.addEventListener("close",()=>dialog.remove(),{once:true});
 dialog.querySelector("[data-enable-correction]")?.addEventListener("change",e=>{
  form.elements.date.disabled=!e.target.checked;form.elements.start.disabled=!e.target.checked;form.elements.duration.disabled=!e.target.checked;
 });
 form.addEventListener("submit",async e=>{
  e.preventDefault();if(!form.reportValidity())return;
  const values=new FormData(form),correction=!!dialog.querySelector("[data-enable-correction]")?.checked;
  if(correction&&!confirm("Confermi la correzione esplicita dell'orario di una visita registrata?"))return;
  const payload={date:correction||!locked?String(values.get("date")):event.date,start:correction||!locked?String(values.get("start")):event.start,
   duration:correction||!locked?Number(values.get("duration")):event.duration,type:locked?event.type:String(values.get("type")),notes:String(values.get("notes")||"").trim()};
  const button=form.querySelector('[type="submit"]');button.disabled=true;error.hidden=true;
  try{await api.update(event,payload,{correction});dialog.close();api.refresh();}
  catch(err){report(err);button.disabled=false;}
 });
 dialog.querySelector("[data-delete-appointment]")?.addEventListener("click",async()=>{
  if(!confirm("Eliminare definitivamente dalla vista questo appuntamento non registrato?"))return;
  const button=dialog.querySelector("[data-delete-appointment]");button.disabled=true;error.hidden=true;
  try{await api.remove(event.id);dialog.close();api.refresh();}
  catch(err){report(err);button.disabled=false;}
 });
 dialog.showModal();
}
