
import {getAgendaEvents} from "./agenda-view.js";

const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const icon=name=>`<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${name}"/></svg>`;
const selectedVisitByPatient=new Map();
const correctionModeByEvent=new Set();

function fmtDate(value){
  if(!value)return "—";
  const [y,m,d]=String(value).split("-").map(Number);
  return new Date(y,m-1,d,12).toLocaleDateString("it-IT",{day:"numeric",month:"short",year:"numeric"});
}
function longDate(value){
  if(!value)return "—";
  const [y,m,d]=String(value).split("-").map(Number);
  return new Date(y,m-1,d,12).toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
}
function typeLabel(type){return type==="first"?"Prima visita":"Controllo";}
function modalityLabel(value){return value==="online"?"Online":value==="home"?"A domicilio":"In studio";}
function subjectIds(event){
  const ids=Array.isArray(event.patientIds)&&event.patientIds.length?event.patientIds:(event.patientId?[event.patientId]:[]);
  return [...new Set(ids.filter(Boolean).map(String))];
}
function belongsToPatient(event,data){
  if(event.type==="personal")return false;
  const patientId=String(data.identity.id);
  const ids=subjectIds(event);
  if(ids.includes(patientId))return true;
  const fullName=`${data.identity.firstName} ${data.identity.lastName}`.trim().toLocaleLowerCase("it");
  return !ids.length&&String(event.name||"").trim().toLocaleLowerCase("it")===fullName;
}
function visitRecord(event,patientId){
  const records=event.visitRecords&&typeof event.visitRecords==="object"?event.visitRecords:{};
  if(records[patientId])return records[patientId];
  if(event.visitRegistered)return {registered:true,note:event.visitNote||"",registeredAt:event.visitRegisteredAt||null};
  return {registered:false,note:"",registeredAt:null};
}
function visitEvents(data){
  return getAgendaEvents().filter(event=>belongsToPatient(event,data)).sort((a,b)=>`${b.date}T${b.start}`.localeCompare(`${a.date}T${a.start}`));
}
function statusMarkup(record){
  return record.registered?'<span class="visit-status registered">Visita registrata</span>':'<span class="visit-status pending">Da registrare</span>';
}
function listItem(event,data,selected){
  const patientId=String(data.identity.id);
  const record=visitRecord(event,patientId);
  const couple=subjectIds(event).length>1;
  const [y,m,d]=event.date.split("-");
  return `<button type="button" class="visit-list-item ${selected?"selected":""}" data-select-visit="${esc(event.id)}">
    <span class="visit-list-date"><strong>${d}</strong><small>${new Date(Number(y),Number(m)-1,Number(d),12).toLocaleDateString("it-IT",{month:"short"}).toUpperCase()}</small><em>${y}</em></span>
    <span class="visit-list-copy">
      <strong>${typeLabel(event.type)}${couple?' <span class="visit-couple">COPPIA</span>':""}</strong>
      <small>${esc(event.start)} · ${Number(event.duration)||30} min</small>
      <small>${modalityLabel(event.modality)}</small>
    </span>
    ${statusMarkup(record)}
    <span class="visit-list-arrow" aria-hidden="true">›</span>
  </button>`;
}

export function renderVisits(model){
  const data=model.data;
  const events=visitEvents(data);
  const patientId=String(data.identity.id);
  const requested=selectedVisitByPatient.get(patientId);
  const selected=events.find(event=>String(event.id)===String(requested))||events[0]||null;
  if(selected)selectedVisitByPatient.set(patientId,selected.id);

  return `<div class="detail-visits">
    <header class="visits-head">
      <div class="visits-head-copy">
        <span class="visits-head-icon">${icon("calendar")}</span>
        <div><h2>Visite</h2><p>Appuntamenti del paziente collegati direttamente all’Agenda.</p></div>
      </div>
    </header>

    ${events.length?`<div class="visits-layout">
      <aside class="visits-list-panel">
        <div class="visits-list-title"><h3>Elenco visite</h3><span>${events.length}</span></div>
        <div class="visits-list">${events.map(event=>listItem(event,data,selected?.id===event.id)).join("")}</div>
      </aside>
      ${selected?renderVisitDetail(selected,data):""}
    </div>`:`
      <section class="detail-panel visits-empty">
        <span class="visits-empty-icon">${icon("calendar")}</span>
        <div><strong>Nessuna visita</strong><p>Gli appuntamenti associati al paziente compariranno qui direttamente dall’Agenda.</p></div>
      </section>`}
  </div>`;
}

function renderVisitDetail(event,data){
  const patientId=String(data.identity.id);
  const record=visitRecord(event,patientId);
  const couple=subjectIds(event).length>1;
  const correction=correctionModeByEvent.has(String(event.id));
  return `<section class="visit-detail-card">
    <header class="visit-detail-head">
      <div>
        <div class="visit-detail-title-line"><h3>${typeLabel(event.type)}</h3>${couple?'<span class="visit-couple">COPPIA</span>':""}${statusMarkup(record)}</div>
        <p>${longDate(event.date)} · ${esc(event.start)} · ${Number(event.duration)||30} min · ${modalityLabel(event.modality)}</p>
      </div>
      <div class="visit-detail-actions">
        <button type="button" data-edit-appointment="${esc(event.id)}">${icon("edit")}<span>Appuntamento</span></button>
        <button type="button" class="visit-primary-action" data-open-visit="${esc(event.id)}">${record.registered?"Apri visita":"Registra visita"}</button>
      </div>
    </header>

    <div class="visit-notes-grid">
      <article class="visit-note-card">
        <span class="visit-note-icon appointment">${icon("calendar")}</span>
        <div><strong>Note appuntamento</strong><p>${event.notes?esc(event.notes):"Nessuna nota appuntamento."}</p></div>
      </article>
      <article class="visit-note-card">
        <span class="visit-note-icon visit">${icon("document")}</span>
        <div><strong>Note visita</strong><p>${record.note?esc(record.note):record.registered?"Nessuna nota visita.":"La visita non è ancora stata registrata."}</p></div>
      </article>
    </div>

    ${record.registered?`<div class="visit-lock-info">
      ${icon("check")}
      <div><strong>Visita registrata</strong><p>L’appuntamento collegato non può essere eliminato. Data, ora e durata sono bloccate salvo correzione esplicita.</p></div>
      ${correction?'<span class="visit-correction-badge">Correzione attiva</span>':""}
    </div>`:""}
  </section>`;
}

function makeDialog(root,className,title,description,body,footer,onClose){
  const dialog=document.createElement("dialog");
  dialog.className=`detail-dialog ${className}`;
  dialog.innerHTML=`<form method="dialog"><header><h2>${title}</h2><button type="button" data-close aria-label="Chiudi">×</button></header><p>${description}</p>${body}<footer>${footer}</footer></form>`;
  root.append(dialog);
  dialog.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>dialog.close()));
  dialog.addEventListener("close",()=>{onClose?.(dialog);dialog.remove();},{once:true});
  dialog.showModal();
  return dialog;
}

function overlaps(a,b){
  if(a.date!==b.date)return false;
  const minutes=value=>{const [h,m]=String(value).split(":").map(Number);return h*60+m;};
  const aStart=minutes(a.start),aEnd=aStart+(Number(a.duration)||30);
  const bStart=minutes(b.start),bEnd=bStart+(Number(b.duration)||30);
  return aStart<bEnd&&bStart<aEnd;
}

function openAppointmentDialog(root,event,data,onChange){
  const patientId=String(data.identity.id);
  const record=visitRecord(event,patientId);
  const locked=!!event.appointmentLocked||record.registered;
  const correction=correctionModeByEvent.has(String(event.id));
  const dateDisabled=locked&&!correction;
  const body=`<div class="visit-appointment-form">
    <label>Tipo visita<select name="type" ${locked?"disabled":""}><option value="first" ${event.type==="first"?"selected":""}>Prima visita</option><option value="control" ${event.type==="control"?"selected":""}>Controllo</option></select></label>
    <label>Data<input name="date" type="date" value="${esc(event.date)}" ${dateDisabled?"disabled":""}></label>
    <label>Ora<input name="start" type="time" value="${esc(event.start)}" ${dateDisabled?"disabled":""}></label>
    <label>Durata<select name="duration" ${dateDisabled?"disabled":""}>${[15,30,45,60,90,120].map(value=>`<option value="${value}" ${Number(event.duration)===value?"selected":""}>${value} minuti</option>`).join("")}</select></label>
    <label class="visit-form-wide">Note appuntamento<textarea name="notes" rows="4">${esc(event.notes||"")}</textarea></label>
  </div>
  ${locked?`<div class="visit-dialog-lock">${icon("check")}<span>Visita registrata: l’appuntamento non è eliminabile e data, ora e durata sono bloccate.</span></div>`:""}`;

  const footer=`
    ${!locked?'<button type="button" class="visit-dialog-delete" data-delete-appointment>Elimina appuntamento</button>':correction?'<button type="button" data-cancel-correction>Annulla correzione</button>':'<button type="button" data-enable-correction>Correggi data/ora visita</button>'}
    <button type="button" data-close>Annulla</button>
    <button type="submit" value="save">Salva modifiche</button>`;

  const dialog=makeDialog(root,"visit-appointment-dialog",record.registered?"Appuntamento · Visita registrata":"Appuntamento",record.registered?"L’appuntamento è collegato a una visita già registrata.":"Modifica i dati dell’appuntamento proveniente dall’Agenda.",body,footer,d=>{
    if(d.returnValue!=="save")return;
    const form=d.querySelector("form");
    const values=new FormData(form);
    const next={
      ...event,
      type:locked?event.type:String(values.get("type")||event.type),
      date:dateDisabled?event.date:String(values.get("date")||event.date),
      start:dateDisabled?event.start:String(values.get("start")||event.start),
      duration:dateDisabled?event.duration:Number(values.get("duration")||event.duration),
      notes:String(values.get("notes")||"").trim()
    };
    const conflict=getAgendaEvents().find(other=>other!==event&&String(other.id)!==String(event.id)&&overlaps(next,other));
    if(conflict){alert("Orario già occupato da un altro appuntamento.");return;}
    Object.assign(event,next);
    correctionModeByEvent.delete(String(event.id));
    onChange();
  });

  dialog.querySelector("[data-delete-appointment]")?.addEventListener("click",()=>{
    if(!confirm("Vuoi eliminare questo appuntamento?"))return;
    const events=getAgendaEvents(),index=events.indexOf(event);
    if(index>=0)events.splice(index,1);
    selectedVisitByPatient.delete(patientId);
    dialog.close();
    onChange();
  });
  dialog.querySelector("[data-enable-correction]")?.addEventListener("click",()=>{
    if(!confirm("Vuoi sbloccare data, ora e durata per correggere questa visita registrata?"))return;
    correctionModeByEvent.add(String(event.id));
    dialog.close();
    onChange();
    setTimeout(()=>openAppointmentDialog(root,event,data,onChange),0);
  });
  dialog.querySelector("[data-cancel-correction]")?.addEventListener("click",()=>{
    correctionModeByEvent.delete(String(event.id));
    dialog.close();
    onChange();
  });
}

function syncCompletedVisit(data,event,record){
  if(!record.registered)return;
  const existing=data.visits.find(visit=>String(visit.appointmentId||"")===String(event.id));
  const payload={appointmentId:event.id,date:event.date,type:event.type,status:"completed",title:typeLabel(event.type),description:record.note||"Visita registrata"};
  if(existing)Object.assign(existing,payload);
  else data.visits.push({id:`visit-${event.id}-${data.identity.id}`,...payload});
}

function openVisitDialog(root,event,data,onChange){
  const patientId=String(data.identity.id);
  const current=visitRecord(event,patientId);
  const firstSave=!current.registered;
  const body=`<div class="visit-register-summary">
      <div><span>Appuntamento</span><strong>${typeLabel(event.type)} · ${longDate(event.date)} · ${esc(event.start)}</strong></div>
      <div><span>Durata</span><strong>${Number(event.duration)||30} minuti</strong></div>
    </div>
    <div class="visit-register-form"><label>Nota visita<textarea name="visitNote" rows="7" placeholder="Inserisci le note relative alla visita">${esc(current.note||"")}</textarea></label></div>
    ${firstSave?'<p class="visit-register-help">Il primo salvataggio registra formalmente la visita e rende l’appuntamento collegato non eliminabile.</p>':'<p class="visit-register-help registered">La visita è già registrata. Puoi aggiornare la nota visita.</p>'}`;
  const footer='<button type="button" data-close>Annulla</button><button type="submit" value="save">Salva visita</button>';
  makeDialog(root,"visit-register-dialog",firstSave?"Registra visita":"Visita registrata",firstSave?"Registra la visita collegata all’appuntamento in Agenda.":"Consulta o aggiorna la nota della visita.",body,footer,dialog=>{
    if(dialog.returnValue!=="save")return;
    const values=new FormData(dialog.querySelector("form"));
    event.visitRecords=event.visitRecords&&typeof event.visitRecords==="object"?event.visitRecords:{};
    const record={registered:true,note:String(values.get("visitNote")||"").trim(),registeredAt:current.registeredAt||new Date().toISOString()};
    event.visitRecords[patientId]=record;
    event.appointmentLocked=true;
    syncCompletedVisit(data,event,record);
    onChange();
  });
}

export function bindVisits(root,model,onChange){
  const data=model.data;
  root.querySelectorAll("[data-select-visit]").forEach(button=>button.addEventListener("click",()=>{selectedVisitByPatient.set(String(data.identity.id),button.dataset.selectVisit);onChange();}));
  root.querySelectorAll("[data-edit-appointment]").forEach(button=>button.addEventListener("click",()=>{const event=getAgendaEvents().find(item=>String(item.id)===String(button.dataset.editAppointment));if(event)openAppointmentDialog(root,event,data,onChange);}));
  root.querySelectorAll("[data-open-visit]").forEach(button=>button.addEventListener("click",()=>{const event=getAgendaEvents().find(item=>String(item.id)===String(button.dataset.openVisit));if(event)openVisitDialog(root,event,data,onChange);}));
}
