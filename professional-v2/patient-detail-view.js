import {renderProgress,bindProgress} from "./patient-progress-view.js";
import {renderMeasurements,bindMeasurements} from "./patient-measurements-view.js";
import {renderPlan,bindPlan} from "./patient-plan-view.js";
import {renderVisits,bindVisits} from "./patient-visits-view.js";
import {renderDocuments,bindDocuments} from "./patient-documents-view.js";
import {renderDiary,bindDiary} from "./patient-diary-view.js";

const tabs=[
  ["panoramica","Panoramica"],["profilo","Profilo"],["visite","Visite"],
  ["misure","Misure"],["andamento","Andamento"],["diario","Diario"],
  ["documenti","Documenti"],["piano","Piano"],["note","Note"]
];

const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const fmtNumber=(value,digits=1)=>value==null?"—":new Intl.NumberFormat("it-IT",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
const fmtDate=(value,options={day:"numeric",month:"short",year:"numeric"})=>value?new Intl.DateTimeFormat("it-IT",options).format(new Date(value.length===10?`${value}T12:00:00`:value)):"—";
const icon=(name)=>`<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${name}"/></svg>`;
const route=(id,tab)=>`#patient/${encodeURIComponent(id)}/${tab}`;
const field=(label,value)=>`<div class="detail-field"><dt>${label}</dt><dd>${escapeHtml(value||"—")}</dd></div>`;
const sectionHeading=(symbol,title,subtitle="")=>`<div class="detail-section-heading"><span class="detail-symbol">${icon(symbol)}</span><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:""}</div></div>`;
const patientInitials=identity=>[identity.firstName,identity.lastName]
  .map(value=>String(value||"").trim().charAt(0))
  .filter(Boolean)
  .join("")
  .toLocaleUpperCase("it");
const patientAvatar=identity=>identity.avatar
  ? `<img class="detail-avatar" src="${escapeHtml(identity.avatar)}" alt="">`
  : `<span class="detail-avatar detail-avatar-initials" aria-hidden="true">${escapeHtml(patientInitials(identity)||"—")}</span>`;

function renderHeader(model){
  const {data,age,kpis,firstVisit,lastControl}=model,{identity,journey}=data;
  const change=kpis.change;
  const status={active:"Attivo",pending:"In attesa",draft:"Bozza",terminated:"Terminato"}[identity.status]||identity.status;
  return `<header class="detail-hero">
    <div class="detail-person">
      ${patientAvatar(identity)}
      <div class="detail-person-copy">
        <div class="detail-name-line"><h1>${escapeHtml(identity.firstName)} ${escapeHtml(identity.lastName)}</h1><span class="detail-status">${escapeHtml(status)}</span></div>
        <p class="detail-demographics">${age!=null?`${escapeHtml(age)} anni`:"Età non disponibile"}<span>·</span>${escapeHtml(identity.sex||"Sesso non indicato")}<span>·</span>${journey.startedAt?`Dal ${fmtDate(journey.startedAt)}`:"Inizio non registrato"}</p>
        <p class="detail-journey-meta">${firstVisit?`Prima visita ${fmtDate(firstVisit.date)}`:"Prima visita non registrata"}<span>·</span>${lastControl?`Ultimo controllo ${fmtDate(lastControl.date)}`:"Nessun controllo registrato"}</p>
        <p class="detail-summary">${icon("document")}${escapeHtml(journey.summary||"Il percorso non ha ancora una sintesi.")}</p>
      </div>
    </div>
    <div class="detail-hero-kpis" aria-label="Dati sintetici del percorso">
      <div><strong>${kpis.completedVisits}</strong><span>visite completate</span></div>
      <div><strong>${model.journeyDays??"—"}</strong><span>giorni di percorso</span></div>
      <div><strong>${change==null?"—":`${change>0?"+":""}${fmtNumber(change)} kg`}</strong><span>rispetto all’inizio</span></div>
    </div>
  </header>`;
}

function renderKpis(model){
  const {kpis}=model;
  const cards=[
    ["Peso iniziale",kpis.initialWeight==null?"—":`${fmtNumber(kpis.initialWeight)} kg`,"Prima misurazione valida","calendar"],
    ["Peso attuale",kpis.currentWeight==null?"—":`${fmtNumber(kpis.currentWeight)} kg`,"Ultima misurazione valida","chart"],
    ["Variazione",kpis.change==null?"—":`${kpis.change>0?"+":""}${fmtNumber(kpis.change)} kg`,kpis.changePercent==null?"Nessun confronto":`${kpis.changePercent>0?"+":""}${fmtNumber(kpis.changePercent)}% dall’inizio`,"leaf"],
    ["Aderenza diario",`${kpis.adherence.percentage}%`,`${kpis.adherence.completed} giorni su ${kpis.adherence.considered}`,"check"],
    ["Visite completate",String(kpis.completedVisits),"Visite salvate","patients"],
    ["Prossimo appuntamento",kpis.nextAppointment?fmtDate(kpis.nextAppointment.startsAt,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"—",kpis.nextAppointment?.title||"Nessun appuntamento", "calendar"]
  ];
  return `<section class="detail-kpis" aria-label="Indicatori del percorso">${cards.map(([label,value,note,symbol])=>`<article class="detail-kpi"><span class="detail-kpi-icon">${icon(symbol)}</span><span class="detail-kpi-label">${label}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("")}</section>`;
}

function renderTimeline(model){
  return `<section class="detail-panel detail-timeline-panel">${sectionHeading("leaf","Percorso in sintesi","I momenti chiave del percorso.")}
    ${model.timeline.length?`<ol class="detail-timeline">${model.timeline.map(event=>`<li class="${event.status}"><span class="detail-timeline-dot" aria-hidden="true">${event.status==="completed"?"✓":""}</span><strong>${escapeHtml(event.title)}</strong><time datetime="${escapeHtml(event.date)}">${fmtDate(event.date)}</time><p>${escapeHtml(event.description)}</p></li>`).join("")}</ol>`:`<p class="detail-empty">Il percorso non ha ancora eventi registrati.</p>`}
  </section>`;
}

function renderFocus(model){
  return `<section class="detail-panel">${sectionHeading("check","Focus della settimana","Le attenzioni più utili ora.")}
    ${model.focus.length?`<div class="detail-focus-list">${model.focus.map(item=>`<a class="detail-focus ${item.severity}" href="${route(model.data.identity.id,item.targetRoute)}"><span class="detail-focus-mark" aria-hidden="true">${item.severity==="success"?"✓":item.severity==="warning"?"!":"·"}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></span><span aria-hidden="true">›</span></a>`).join("")}</div>`:`<p class="detail-empty">Nessuna attenzione particolare questa settimana.</p>`}
  </section>`;
}

function renderWeightChart(series){
  if(!series.length) return `<p class="detail-empty">Nessuna misurazione del peso disponibile.</p>`;
  if(series.length===1) return `<div class="detail-single-weight"><strong>${fmtNumber(series[0].value)} kg</strong><span>Prima rilevazione · ${fmtDate(series[0].date)}</span></div>`;
  const width=640,height=205,left=42,right=18,top=20,bottom=35;
  const values=series.map(p=>p.value),min=Math.min(...values),max=Math.max(...values);
  const pad=Math.max(1,(max-min)*.25),lo=Math.floor(min-pad),hi=Math.ceil(max+pad);
  const x=i=>left+i*(width-left-right)/(series.length-1);
  const y=value=>top+(hi-value)*(height-top-bottom)/(hi-lo||1);
  const points=series.map((p,i)=>[x(i),y(p.value)]);
  const path=points.map(([px,py],i)=>`${i?"L":"M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const area=`${path} L${points.at(-1)[0]} ${height-bottom} L${left} ${height-bottom} Z`;
  const ticks=Array.from({length:4},(_,i)=>lo+(hi-lo)*i/3);
  return `<div class="detail-chart" role="img" aria-label="Peso da ${fmtNumber(series[0].value)} a ${fmtNumber(series.at(-1).value)} chilogrammi, ${series.length} rilevazioni">
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><linearGradient id="detail-weight-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#98c7a3" stop-opacity=".35"/><stop offset="1" stop-color="#98c7a3" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map(t=>`<line x1="${left}" x2="${width-right}" y1="${y(t)}" y2="${y(t)}" class="detail-grid-line"/><text x="${left-9}" y="${y(t)+4}" text-anchor="end" class="detail-axis-label">${fmtNumber(t,0)}</text>`).join("")}
      <path d="${area}" fill="url(#detail-weight-fill)"/><path d="${path}" class="detail-chart-line"/>
      ${points.filter((_,i)=>series.length<=12||i===0||i===series.length-1).map(([px,py])=>`<circle cx="${px}" cy="${py}" r="4" class="detail-chart-dot"/>`).join("")}
      <text x="${left}" y="${height-8}" class="detail-axis-label">${fmtDate(series[0].date,{day:"numeric",month:"short"})}</text>
      <text x="${width-right}" y="${height-8}" text-anchor="end" class="detail-axis-label">${fmtDate(series.at(-1).date,{day:"numeric",month:"short"})}</text>
    </svg>
  </div>`;
}

function renderComposition(model){
  const {values,lastBiaDate}=model.composition;
  const definitions=[["weight","Peso"],["bodyFat","FM%"],["muscleMass","MM%"],["bcm","BCM%"]];
  return `<section class="detail-panel">${sectionHeading("chart","Misure e composizione",lastBiaDate?`Ultima BIA ${fmtDate(lastBiaDate)}`:"Ultimi valori disponibili")}
    ${Object.values(values).some(item=>item.value!=null)?`<div class="detail-measures">${definitions.map(([key,label])=>{const item=values[key];return `<div><span>${label}</span><strong>${item.value==null?"—":`${fmtNumber(item.value)} ${item.unit}`}</strong><small>${item.delta==null?"Nessun confronto":`${item.delta>0?"+":""}${fmtNumber(item.delta)} ${item.unit==="%"?"pp":item.unit} dalla precedente`}</small></div>`}).join("")}</div>`:`<p class="detail-empty">Nessuna misura disponibile. Puoi aggiungerla dalla tab Misure.</p>`}
    ${!lastBiaDate && values.weight.value!=null?`<p class="detail-note">Composizione corporea non ancora rilevata.</p>`:""}
  </section>`;
}

function renderOverview(model){
  const actions=[["Apri visita","visite","calendar"],["Leggi referti","documenti","document"],["Controlla diario","diario","check"],["Aggiungi misure","misure","chart"]];
  return `<div class="detail-overview">${renderKpis(model)}
    <div class="detail-overview-top">${renderTimeline(model)}${renderFocus(model)}</div>
    <div class="detail-overview-lower">
      <section class="detail-panel">${sectionHeading("chart","Andamento recente","Peso nelle ultime rilevazioni.")}${renderWeightChart(model.weightSeries)}</section>
      ${renderComposition(model)}
      <section class="detail-panel">${sectionHeading("leaf","Prossime azioni","Accessi rapidi alla scheda.")}
        <div class="detail-actions">${actions.map(([label,target,symbol])=>`<a href="${route(model.data.identity.id,target)}">${icon(symbol)}<span>${label}</span><span aria-hidden="true">›</span></a>`).join("")}</div>
      </section>
    </div>
    <section class="detail-panel">${sectionHeading("document","Documenti e attività recenti","Aggiornamenti in ordine cronologico.")}
      ${model.activity.length?`<ul class="detail-activity">${model.activity.map(item=>`<li><span class="detail-activity-icon">${icon(item.type==="email"?"mail":item.type==="visit"?"calendar":"document")}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description||item.origin||"")}${item.description&&item.origin?` · ${escapeHtml(item.origin)}`:""}</small></span><time datetime="${escapeHtml(item.date)}">${fmtDate(item.date)}</time></li>`).join("")}</ul>`:`<p class="detail-empty">Nessuna attività recente.</p>`}
    </section>
  </div>`;
}

function profileValue(label,value,unit=""){
  const hasValue=value!==""&&value!==null&&value!==undefined;
  return `<div class="detail-clinical-field"><span>${escapeHtml(label)}</span><strong>${hasValue?escapeHtml(`${value}${unit}`):"—"}</strong></div>`;
}

function activityFactorLabel(value){
  return {"1.2":"Sedentario","1.375":"Leggermente attivo","1.55":"Moderatamente attivo","1.725":"Molto attivo","1.9":"Estremamente attivo"}[String(value||"")]||"Non impostato";
}

function renderClinicalAccordion(key,title,body){
  return `<details class="detail-accordion" data-accordion="${key}">
    <summary><span>${escapeHtml(title)}</span><span class="detail-chevron" aria-hidden="true">⌄</span></summary>
    <div class="detail-accordion-body">
      ${body}
      <button type="button" class="detail-accordion-edit" data-edit-profile-section="${key}">${icon("edit")}<span>Modifica</span></button>
    </div>
  </details>`;
}

function renderProfile(model){
  const {identity,profile,privacy}=model.data;
  const a=profile.anamnesis||{};
  const family=a.family||{};
  const consent=privacy.consent?.status==="pending"?"In attesa":privacy.consent?.signedAt?`Firmato il ${fmtDate(privacy.consent.signedAt)}`:"Non registrato";

  const weightSection=`<div class="detail-clinical-grid">
    ${profileValue("Peso obiettivo",a.goalWeight," kg")}
    ${profileValue("Peso minimo storico",a.minWeight," kg")}
    ${profileValue("Peso massimo storico",a.maxWeight," kg")}
    ${profileValue("Peso ragionevole / concordato",a.reasonableWeight," kg")}
    ${profileValue("Peso teorico",a.theoreticalWeight," kg")}
    ${profileValue("Obiettivi",a.objectives)}
  </div>`;

  const lifestyleSection=`<div class="detail-clinical-grid">
    ${profileValue("Attività lavorativa",a.work)}
    ${profileValue("Attività fisica abituale",a.activity)}
    ${profileValue("Livello attività",activityFactorLabel(a.activityFactor))}
    ${profileValue("Fumo",a.smoking)}
    ${profileValue("Alcol",a.alcohol)}
  </div>`;

  const clinicalSection=`<div class="detail-clinical-grid">
    ${profileValue("Diagnosi / motivo",a.diagnosis)}
    ${profileValue("Alvo",a.bowel)}
    ${profileValue("Metabolismo basale",a.metabolism)}
    ${profileValue("FEEG / fabbisogno",a.feeg)}
    ${profileValue("Impedenziometria",a.impedance)}
  </div>`;

  const familySection=`<div class="detail-family-grid">
    ${[["Obesità",family.obesity],["Diabete",family.diabetes],["Ipertensione",family.hypertension],["Cardiovascolare",family.cardiovascular],["Dislipidemie",family.dyslipidemia],["Tiroide",family.thyroid]].map(([label,value])=>`<div><span>${escapeHtml(label)}</span><strong class="${value?"yes":"no"}">${value?"Sì":"No"}</strong></div>`).join("")}
  </div>`;

  const pathologicalSection=`<div class="detail-clinical-grid detail-clinical-grid-wide">
    ${profileValue("Diete pregresse",a.previousDiets)}
    ${profileValue("Allergie / intolleranze",a.allergies)}
    ${profileValue("Farmaci / integrazione",a.medications)}
    ${profileValue("Disturbi gastrointestinali",a.giIssues)}
    ${profileValue("Patologie / interventi pregressi",a.pastConditions)}
    ${profileValue("Osservazioni",a.observations)}
  </div>`;

  return `<div class="detail-profile">
    <div class="detail-profile-column">
      <section class="detail-panel detail-identity">${sectionHeading("profile","Anagrafica")}
        <dl class="detail-fields">${field("Nome",identity.firstName)}${field("Cognome",identity.lastName)}${field("Data di nascita",fmtDate(identity.birthDate))}${field("Sesso",identity.sex)}${field("Altezza",identity.height!==""&&identity.height!=null?`${identity.height} cm`:"—")}${field("Telefono",identity.phone)}${field("Email",identity.email)}${field("Account NUBEMO",{active:"Attivo",pending:"Invito in attesa",inactive:"Non attivo"}[identity.nubemoAccountStatus]||"Non attivo")}${field("Calorie visibili al paziente",identity.showCaloriesToPatient?"Sì":"No")}</dl>
        <button type="button" class="detail-inline-action" data-edit-identity>Vedi / Modifica anagrafica <span aria-hidden="true">›</span></button>
      </section>

      <section class="detail-panel detail-administration"><div class="detail-heading-action">${sectionHeading("check","Dati amministrativi")}<button type="button" class="detail-edit-button" data-edit-administration>${icon("edit")}<span>Modifica</span></button></div>
        <dl class="detail-fields">${field("Consenso privacy",consent)}${field("Comunicazioni",privacy.communications.email?"Email":"Non attive")}${field("Promemoria appuntamenti",privacy.reminders.email?"Email":"Non attivi")}${field("Note amministrative",privacy.administrativeNotes||"Nessuna nota")}</dl>
      </section>
    </div>

    <div class="detail-profile-column">
      <section class="detail-panel detail-history">${sectionHeading("document","Percorso e anamnesi")}
        <div class="detail-accordions">
          ${renderClinicalAccordion("weightGoals","Obiettivi e storia del peso",weightSection)}
          ${renderClinicalAccordion("lifestyle","Stile di vita",lifestyleSection)}
          ${renderClinicalAccordion("clinical","Dati clinici aggiuntivi",clinicalSection)}
          ${renderClinicalAccordion("family","Familiarità",familySection)}
          ${renderClinicalAccordion("pathological","Anamnesi patologica",pathologicalSection)}
        </div>
      </section>
    </div>
  </div>`;
}

function noteTimestamp(note){
  return note.updatedAt||note.createdAt;
}

function renderNotes(model){
  const notes=[...(model.data.notes||[])].sort((a,b)=>new Date(noteTimestamp(b))-new Date(noteTimestamp(a)));
  return `<div class="detail-notes">
    <header class="notes-head">
      <div class="notes-head-copy">
        <span class="notes-head-icon">${icon("edit")}</span>
        <div>
          <h2>Note</h2>
          <p>Annotazioni generali del professionista sul percorso del paziente.</p>
        </div>
      </div>
      <button type="button" class="notes-new" data-new-note>${icon("plus")}<span>Nuova nota</span></button>
    </header>

    <div class="notes-context">
      <span class="notes-context-icon">${icon("document")}</span>
      <p>Queste note sono indipendenti da <strong>Note visita</strong>, <strong>Note appuntamento</strong> e <strong>Note amministrative</strong>.</p>
    </div>

    ${notes.length?`<section class="notes-list" aria-label="Note del professionista">${notes.map((note,index)=>`
      <article class="note-card ${index===0?"note-card-latest":""}" data-note-id="${escapeHtml(note.id)}">
        <header class="note-card-head">
          <div class="note-card-meta">
            <span class="note-private-badge">${icon("edit")}<span>Nota professionista</span></span>
            <time datetime="${escapeHtml(noteTimestamp(note))}">${fmtDate(noteTimestamp(note),{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</time>
            ${note.updatedAt?`<span class="note-edited">Modificata</span>`:""}
          </div>
          <div class="note-card-actions" aria-label="Azioni nota">
            <button type="button" data-edit-note="${escapeHtml(note.id)}" aria-label="Modifica nota">${icon("edit")}<span>Modifica</span></button>
            <button type="button" class="note-delete" data-delete-note="${escapeHtml(note.id)}" aria-label="Elimina nota"><span>Elimina</span></button>
          </div>
        </header>
        <div class="note-card-body">
          <p>${escapeHtml(note.text)}</p>
        </div>
      </article>`).join("")}</section>`:`
      <section class="detail-panel notes-empty">
        <span class="notes-empty-icon">${icon("edit")}</span>
        <div><strong>Nessuna nota del professionista</strong><p>Usa “Nuova nota” per aggiungere un’annotazione generale sul percorso.</p></div>
      </section>`}
  </div>`;
}

function openNoteDialog(root,model,onChange,note=null){
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog note-dialog";
  dialog.innerHTML=`<form method="dialog">
    <header><h2>${note?"Modifica nota":"Nuova nota"}</h2><button type="button" data-close aria-label="Chiudi">×</button></header>
    <p>Nota generale del professionista. Non viene collegata automaticamente a una visita o a un appuntamento.</p>
    <div class="note-form">
      <label>Nota<textarea name="noteText" rows="8" required placeholder="Scrivi una nota sul percorso...">${escapeHtml(note?.text||"")}</textarea></label>
    </div>
    <footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Salva</button></footer>
  </form>`;
  attachDialog(root,dialog,values=>{
    const textValue=String(values.get("noteText")||"").trim();
    if(!textValue) return;
    if(note){
      note.text=textValue;
      note.updatedAt=new Date().toISOString();
    }else{
      model.data.notes.push({
        id:`note-${Date.now()}`,
        createdAt:new Date().toISOString(),
        updatedAt:null,
        text:textValue
      });
    }
    onChange();
  });
}

function openDeleteNoteDialog(root,model,note,onChange){
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog note-delete-dialog";
  dialog.innerHTML=`<form method="dialog">
    <header><h2>Elimina nota</h2><button type="button" data-close aria-label="Chiudi">×</button></header>
    <p>Vuoi eliminare questa nota? In questa demo l'operazione non può essere annullata fino al ricaricamento della pagina.</p>
    <footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Elimina</button></footer>
  </form>`;
  attachDialog(root,dialog,()=>{
    const index=model.data.notes.findIndex(item=>item.id===note.id);
    if(index>=0) model.data.notes.splice(index,1);
    onChange();
  });
}

function bindNotes(root,model,onChange){
  root.querySelector("[data-new-note]")?.addEventListener("click",()=>openNoteDialog(root,model,onChange));
  root.querySelectorAll("[data-edit-note]").forEach(button=>button.addEventListener("click",()=>{
    const note=model.data.notes.find(item=>item.id===button.dataset.editNote);
    if(note) openNoteDialog(root,model,onChange,note);
  }));
  root.querySelectorAll("[data-delete-note]").forEach(button=>button.addEventListener("click",()=>{
    const note=model.data.notes.find(item=>item.id===button.dataset.deleteNote);
    if(note) openDeleteNoteDialog(root,model,note,onChange);
  }));
}

export function renderPatientDetail(root,model,activeTab="panoramica",onIdentityChange=()=>{}){
  const {id,firstName,lastName}=model.data.identity;
  const tab=tabs.some(([key])=>key===activeTab)?activeTab:"panoramica";
  root.innerHTML=`<div class="patient-detail">
    <nav class="detail-breadcrumb" aria-label="Percorso"><a href="#patients">Pazienti</a><span aria-hidden="true">›</span><span>${escapeHtml(firstName)} ${escapeHtml(lastName)}</span></nav>
    ${renderHeader(model)}
    <nav class="detail-tabs" aria-label="Sezioni paziente">${tabs.map(([key,label])=>`<a href="${route(id,key)}" class="${tab===key?"active":""}" ${tab===key?'aria-current="page"':""}>${label}</a>`).join("")}</nav>
    <div class="detail-content">${tab==="panoramica"?renderOverview(model):tab==="profilo"?renderProfile(model):tab==="visite"?renderVisits(model):tab==="misure"?renderMeasurements(model.measurements):tab==="andamento"?renderProgress(model.progress):tab==="diario"?renderDiary(model.diary):tab==="documenti"?renderDocuments(model):tab==="piano"?renderPlan(model):tab==="note"?renderNotes(model):`<section class="detail-panel detail-placeholder">${sectionHeading("document",tabs.find(([key])=>key===tab)[1])}<p>Questa sezione sarà disponibile nei prossimi step.</p></section>`}</div>
  </div>`;
  root.querySelectorAll(".detail-accordion").forEach(details=>details.addEventListener("toggle",()=>{
    if(details.open) root.querySelectorAll(".detail-accordion").forEach(other=>{if(other!==details) other.open=false});
  }));
  root.querySelector("[data-edit-identity]")?.addEventListener("click",()=>openIdentityDialog(root,model,onIdentityChange));
  root.querySelectorAll("[data-edit-profile-section]").forEach(button=>button.addEventListener("click",event=>{
    event.preventDefault();
    openProfileSectionDialog(root,model,button.dataset.editProfileSection,onIdentityChange);
  }));
  root.querySelector("[data-edit-administration]")?.addEventListener("click",()=>openAdministrationDialog(root,model,onIdentityChange));
  if(tab==="visite") bindVisits(root,model,onIdentityChange);
  if(tab==="andamento") bindProgress(root,model.data,model.progress);
  if(tab==="misure") bindMeasurements(root,model.data,model.measurements,onIdentityChange,attachDialog);
  if(tab==="diario") bindDiary(root,model.diary,date=>{model.data.diary.ui={...(model.data.diary.ui||{}),selectedDate:date};onIdentityChange();});
  if(tab==="documenti") bindDocuments(root,model,onIdentityChange);
  if(tab==="piano") bindPlan(root,model,onIdentityChange);
  if(tab==="note") bindNotes(root,model,onIdentityChange);
}

function attachDialog(root,dialog,onSave){
  root.append(dialog);
  dialog.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>dialog.close()));
  dialog.addEventListener("close",()=>{
    if(dialog.returnValue==="save") onSave?.(new FormData(dialog.querySelector("form")));
    dialog.remove();
  },{once:true});
  dialog.showModal();
}

function openIdentityDialog(root,model,onChange){
  const {identity}=model.data;
  const sexOptions=["","Maschio","Femmina","Altro","Preferisco non indicarlo"];
  const accountOptions=[["inactive","Non attivo"],["pending","Invito in attesa"],["active","Attivo"]];
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog";
  dialog.innerHTML=`<form method="dialog"><header><h2>Anagrafica</h2><button type="button" data-close aria-label="Chiudi">×</button></header><p>Modifiche demo disponibili fino al ricaricamento della pagina.</p>
    <div class="detail-identity-form">
      <div class="detail-identity-row">
        <label><span>Nome</span><input name="firstName" value="${escapeHtml(identity.firstName||"")}"></label>
        <label><span>Cognome</span><input name="lastName" value="${escapeHtml(identity.lastName||"")}"></label>
      </div>
      <div class="detail-identity-row">
        <label><span>Data di nascita</span><input name="birthDate" type="date" value="${escapeHtml(identity.birthDate||"")}"></label>
        <label><span>Sesso</span><select name="sex">${sexOptions.map(option=>`<option value="${escapeHtml(option)}" ${identity.sex===option?"selected":""}>${escapeHtml(option||"Seleziona...")}</option>`).join("")}</select></label>
      </div>
      <div class="detail-identity-row">
        <label><span>Altezza (cm)</span><input name="height" type="number" min="50" max="250" step="0.1" value="${escapeHtml(identity.height??"")}"></label>
        <label><span>Account NUBEMO</span><select name="nubemoAccountStatus">${accountOptions.map(([value,label])=>`<option value="${value}" ${identity.nubemoAccountStatus===value?"selected":""}>${label}</option>`).join("")}</select></label>
      </div>
      <div class="detail-identity-row">
        <label><span>Codice fiscale</span><input name="fiscalCode" value="${escapeHtml(identity.fiscalCode||"")}"></label>
        <label><span>Indirizzo</span><input name="address" value="${escapeHtml(identity.address||"")}"></label>
      </div>
      <div class="detail-identity-row">
        <label><span>CAP</span><input name="postalCode" value="${escapeHtml(identity.postalCode||"")}"></label>
        <label><span>Città</span><input name="city" value="${escapeHtml(identity.city||"")}"></label>
      </div>
      <div class="detail-identity-row">
        <label><span>Provincia</span><input name="province" value="${escapeHtml(identity.province||"")}"></label>
        <label><span>Telefono</span><input name="phone" type="tel" value="${escapeHtml(identity.phone||"")}"></label>
      </div>
      <div class="detail-identity-row detail-identity-row-single">
        <label><span>Email</span><input name="email" type="email" value="${escapeHtml(identity.email||"")}"></label>
        <div class="detail-identity-option">
          <span>Calorie visibili al paziente</span>
          <label class="detail-identity-option-control">
            <input name="showCaloriesToPatient" type="checkbox" ${identity.showCaloriesToPatient?"checked":""}>
            <span>Mostra il calcolo delle calorie al paziente</span>
          </label>
        </div>
      </div>
    </div>
    <footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Salva</button></footer></form>`;
  attachDialog(root,dialog,values=>{
    ["firstName","lastName","birthDate","sex","fiscalCode","address","postalCode","city","province","phone","email"].forEach(key=>{
      identity[key]=String(values.get(key)||"").trim();
    });
    const heightRaw=String(values.get("height")||"").trim();
    identity.height=heightRaw===""?"":Number(heightRaw);
    identity.nubemoAccountStatus=String(values.get("nubemoAccountStatus")||"inactive");
    identity.showCaloriesToPatient=values.get("showCaloriesToPatient")==="on";
    onChange();
  });
}

function anamnesisInput(name,label,value,{type="text",rows=0,step="",options=null,wide=false}={}){
  const fieldClass=`detail-anamnesis-field${rows?" is-textarea":""}${wide?" is-wide":""}`;
  const labelMarkup=`<span class="detail-anamnesis-label">${escapeHtml(label)}</span>`;
  if(options){
    return `<label class="${fieldClass}">${labelMarkup}<select name="${name}">${options.map(([optionValue,optionLabel])=>`<option value="${escapeHtml(optionValue)}" ${String(value||"")===String(optionValue)?"selected":""}>${escapeHtml(optionLabel)}</option>`).join("")}</select></label>`;
  }
  if(rows){
    return `<label class="${fieldClass}">${labelMarkup}<textarea name="${name}" rows="${rows}">${escapeHtml(value||"")}</textarea></label>`;
  }
  return `<label class="${fieldClass}">${labelMarkup}<input name="${name}" type="${type}" ${step?`step="${step}"`:""} value="${escapeHtml(value??"")}"></label>`;
}

function openProfileSectionDialog(root,model,key,onChange){
  const a=model.data.profile.anamnesis;
  const family=a.family||(a.family={obesity:false,diabetes:false,hypertension:false,cardiovascular:false,dyslipidemia:false,thyroid:false});
  const activityOptions=[["","Non impostato"],["1.2","Sedentario"],["1.375","Leggermente attivo"],["1.55","Moderatamente attivo"],["1.725","Molto attivo"],["1.9","Estremamente attivo"]];
  const sectionMap={
    weightGoals:{
      title:"Obiettivi e storia del peso",
      fields:[
        anamnesisInput("goalWeight","Peso obiettivo (kg)",a.goalWeight,{type:"number",step:"0.1"}),
        anamnesisInput("minWeight","Peso minimo storico (kg)",a.minWeight,{type:"number",step:"0.1"}),
        anamnesisInput("maxWeight","Peso massimo storico (kg)",a.maxWeight,{type:"number",step:"0.1"}),
        anamnesisInput("reasonableWeight","Peso ragionevole / concordato (kg)",a.reasonableWeight,{type:"number",step:"0.1"}),
        anamnesisInput("theoreticalWeight","Peso teorico (kg)",a.theoreticalWeight,{type:"number",step:"0.1"}),
        anamnesisInput("objectives","Obiettivi",a.objectives,{rows:4,wide:true})
      ]
    },
    lifestyle:{
      title:"Stile di vita",
      fields:[
        anamnesisInput("work","Attività lavorativa",a.work,{rows:3}),
        anamnesisInput("activity","Attività fisica abituale",a.activity,{rows:3}),
        anamnesisInput("activityFactor","Livello attività per stima energetica",a.activityFactor,{options:activityOptions}),
        anamnesisInput("smoking","Fumo",a.smoking),
        anamnesisInput("alcohol","Alcol",a.alcohol)
      ]
    },
    clinical:{
      title:"Dati clinici aggiuntivi",
      fields:[
        anamnesisInput("diagnosis","Diagnosi / motivo",a.diagnosis,{rows:4,wide:true}),
        anamnesisInput("bowel","Alvo",a.bowel),
        anamnesisInput("metabolism","Metabolismo basale",a.metabolism),
        anamnesisInput("feeg","FEEG / fabbisogno",a.feeg),
        anamnesisInput("impedance","Impedenziometria",a.impedance)
      ]
    },
    pathological:{
      title:"Anamnesi patologica",
      fields:[
        anamnesisInput("previousDiets","Diete pregresse",a.previousDiets,{rows:4}),
        anamnesisInput("allergies","Allergie / intolleranze",a.allergies,{rows:4}),
        anamnesisInput("medications","Farmaci / integrazione",a.medications,{rows:4}),
        anamnesisInput("giIssues","Disturbi gastrointestinali",a.giIssues,{rows:4}),
        anamnesisInput("pastConditions","Patologie / interventi pregressi",a.pastConditions,{rows:4}),
        anamnesisInput("observations","Osservazioni",a.observations,{rows:4})
      ]
    },
    family:{title:"Familiarità",fields:[]}
  };
  const section=sectionMap[key];
  if(!section)return;

  const familyFields=key==="family"?`<fieldset class="detail-family-editor"><legend>Familiarità</legend>
    <div class="detail-family-options">${[["obesity","Obesità"],["diabetes","Diabete"],["hypertension","Ipertensione"],["cardiovascular","Cardiovascolare"],["dyslipidemia","Dislipidemie"],["thyroid","Tiroide"]].map(([fieldKey,label])=>`
      <label class="detail-family-option">
        <input type="checkbox" name="family-${fieldKey}" ${family[fieldKey]?"checked":""}>
        <span class="detail-family-option-box"><span class="detail-family-option-check">✓</span><strong>${label}</strong></span>
      </label>`).join("")}</div>
  </fieldset>`:"";

  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog detail-dialog-wide";
  dialog.innerHTML=`<form method="dialog"><header><h2>${escapeHtml(section.title)}</h2><button type="button" data-close aria-label="Chiudi">×</button></header><p>Aggiorna i dati dell’anamnesi del paziente.</p>
    <div class="detail-anamnesis-editor">${section.fields.join("")}${familyFields}</div>
    <footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Salva</button></footer></form>`;

  attachDialog(root,dialog,values=>{
    const numericKeys=["goalWeight","minWeight","maxWeight","reasonableWeight","theoreticalWeight"];
    section.fields.length&&["goalWeight","minWeight","maxWeight","reasonableWeight","theoreticalWeight","objectives","work","activity","activityFactor","smoking","alcohol","diagnosis","bowel","metabolism","feeg","impedance","previousDiets","allergies","medications","giIssues","pastConditions","observations"].forEach(fieldKey=>{
      if(!dialog.querySelector(`[name="${fieldKey}"]`))return;
      const raw=String(values.get(fieldKey)||"").trim();
      a[fieldKey]=numericKeys.includes(fieldKey)?(raw===""?"":Number(raw)):raw;
    });
    if(key==="family"){
      ["obesity","diabetes","hypertension","cardiovascular","dyslipidemia","thyroid"].forEach(fieldKey=>{family[fieldKey]=values.get(`family-${fieldKey}`)==="on";});
    }
    onChange();
  });
}

function openAdministrationDialog(root,model,onChange){
  const privacy=model.data.privacy;
  const consentStatus=privacy.consent?.status||(privacy.consent?.signedAt?"signed":"missing");
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog";
  dialog.innerHTML=`<form method="dialog"><header><h2>Dati amministrativi</h2><button type="button" data-close aria-label="Chiudi">×</button></header><p>Gestisci consenso e preferenze operative del paziente. NUBEMO 2.0 utilizza solo email.</p>
    <div class="detail-dialog-fields detail-dialog-fields-single">
      <label>Stato consenso privacy<select name="consentStatus"><option value="signed" ${consentStatus==="signed"?"selected":""}>Firmato</option><option value="pending" ${consentStatus==="pending"?"selected":""}>In attesa</option><option value="missing" ${consentStatus==="missing"?"selected":""}>Non registrato</option></select></label>
      <label>Data firma<input name="consentSignedAt" type="date" value="${escapeHtml(privacy.consent?.signedAt||"")}"></label>
      <label class="detail-check-field"><input name="communicationsEmail" type="checkbox" ${privacy.communications?.email?"checked":""}><span>Comunicazioni via email</span></label>
      <label class="detail-check-field"><input name="remindersEmail" type="checkbox" ${privacy.reminders?.email?"checked":""}><span>Promemoria appuntamenti via email</span></label>
      <label>Note amministrative<textarea name="administrativeNotes" rows="5">${escapeHtml(privacy.administrativeNotes||"")}</textarea></label>
    </div>
    <footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Salva</button></footer></form>`;
  attachDialog(root,dialog,values=>{
    const status=String(values.get("consentStatus")||"missing");
    const signedAt=status==="signed"?String(values.get("consentSignedAt")||"").trim():"";
    privacy.consent={...(privacy.consent||{}),status,signedAt:signedAt||null,documentId:privacy.consent?.documentId||null};
    privacy.communications={email:values.get("communicationsEmail")==="on"};
    privacy.reminders={email:values.get("remindersEmail")==="on"};
    privacy.administrativeNotes=String(values.get("administrativeNotes")||"").trim();
    onChange();
  });
}
