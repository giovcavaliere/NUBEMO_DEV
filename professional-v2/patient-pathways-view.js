import {capturePathwaySnapshot,getPathwayHistoryModel} from "./patient-pathways-model.js";
import {labFields,openDocumentFile} from "./patient-documents-view.js?v=pathway-archive-20261009";

const OBJECTIVES=[
  ["weight_loss","Dimagrimento"],
  ["weight_gain","Aumento di peso"],
  ["body_recomposition","Ricomposizione corporea"],
  ["maintenance","Mantenimento"],
  ["nutrition_education","Educazione alimentare"],
  ["clinical_support","Supporto a patologia / condizione specifica"],
  ["sports_performance","Performance sportiva"],
  ["other","Altro"]
];

const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const todayIso=()=>new Date().toISOString().slice(0,10);
const fmtDate=value=>{
  if(!value) return "—";
  const date=new Date(String(value).length===10?`${value}T12:00:00`:value);
  return Number.isNaN(date.getTime())?String(value):new Intl.DateTimeFormat("it-IT").format(date);
};
const objectiveLabel=(key,custom="")=>key==="other"
  ? String(custom||"Altro").trim()
  : OBJECTIVES.find(([value])=>value===key)?.[1]||"Non specificato";

function pathways(model){
  if(!model.data.pathways) model.data.pathways={items:[],ui:{historyOpen:false,selectedHistoryId:null}};
  if(!Array.isArray(model.data.pathways.items)) model.data.pathways.items=[];
  if(!model.data.pathways.ui) model.data.pathways.ui={historyOpen:false,selectedHistoryId:null};
  return model.data.pathways;
}

function activePathway(model){
  return pathways(model).items.find(item=>item.status==="active")||null;
}

function pendingPathway(model){
  return pathways(model).items.find(item=>item.status==="pending")||null;
}

function endedPathways(model){
  return pathways(model).items
    .filter(item=>item.status==="ended")
    .sort((a,b)=>String(b.endedAt||b.startedAt||"").localeCompare(String(a.endedAt||a.startedAt||"")));
}

function pathwayStatusCard(model){
  const active=activePathway(model);
  const pending=pendingPathway(model);
  const current=active||pending;
  const ended=endedPathways(model);

  if(!current){
    return `<section class="pathway-card pathway-card-empty">
      <div class="pathway-card-main">
        <span class="pathway-symbol" aria-hidden="true">↗</span>
        <div>
          <span class="pathway-eyebrow">PERCORSO</span>
          <h2>Nessun percorso attivo</h2>
          <p>L'anagrafica del paziente è disponibile. Apri il percorso quando vuoi iniziare la presa in carico.</p>
        </div>
      </div>
      <div class="pathway-card-actions">
        ${ended.length?`<button type="button" class="pathway-secondary" data-pathway-history>Storico percorsi <span>${ended.length}</span></button>`:""}
        <button type="button" class="pathway-primary" data-pathway-new>Apri nuovo percorso</button>
      </div>
    </section>`;
  }

  const isPending=current.status==="pending";
  return `<section class="pathway-card ${isPending?"is-pending":"is-active"}">
    <div class="pathway-card-main">
      <span class="pathway-symbol" aria-hidden="true">${isPending?"⌛":"✓"}</span>
      <div>
        <div class="pathway-card-heading">
          <span class="pathway-eyebrow">PERCORSO ${isPending?"PROPOSTO":"ATTUALE"}</span>
          <span class="pathway-status ${isPending?"pending":"active"}">${isPending?"In attesa":"In corso"}</span>
        </div>
        <h2>${escapeHtml(current.objectiveLabel||objectiveLabel(current.objectiveKey,current.customObjective))}</h2>
        <p>Inizio: <strong>${fmtDate(current.startedAt||current.proposedAt)}</strong>${current.objectiveNote?`<span>·</span>${escapeHtml(current.objectiveNote)}`:""}</p>
      </div>
    </div>
    <div class="pathway-card-actions">
      ${ended.length?`<button type="button" class="pathway-secondary" data-pathway-history>Storico percorsi <span>${ended.length}</span></button>`:""}
      ${isPending
        ? '<span class="pathway-pending-note">In attesa dell’accettazione del paziente</span>'
        : '<button type="button" class="pathway-secondary" data-pathway-edit>Gestisci</button><button type="button" class="pathway-danger" data-pathway-end>Concludi percorso</button>'}
    </div>
  </section>`;
}

function historyPanel(model){
  const state=pathways(model);
  if(!state.ui.historyOpen) return "";
  const ended=endedPathways(model);

  return `<section class="pathway-history">
    <header class="pathway-history-head">
      <div>
        <span class="pathway-eyebrow">PERCORSI</span>
        <h2>Storico percorsi</h2>
        <p>Percorsi conclusi con questo professionista.</p>
      </div>
      <button type="button" class="pathway-close" data-pathway-history-close aria-label="Chiudi storico">×</button>
    </header>
    <div class="pathway-history-list">
      ${ended.length?ended.map(item=>`<button type="button" class="pathway-history-row" data-pathway-history-open="${escapeHtml(item.id)}">
        <span class="pathway-history-copy">
          <strong>${escapeHtml(item.objectiveLabel||objectiveLabel(item.objectiveKey,item.customObjective))}</strong>
          <small>${fmtDate(item.startedAt)} → ${fmtDate(item.endedAt)}</small>
        </span>
        <span class="pathway-status ended">Concluso</span>
        <span class="pathway-arrow" aria-hidden="true">›</span>
      </button>`).join(""):'<p class="pathway-history-empty">Nessun percorso concluso.</p>'}
    </div>
  </section>`;
}

export function renderPathwayManagement(model){
  return `<div class="pathway-management">${pathwayStatusCard(model)}${historyPanel(model)}</div>`;
}

const anamnesisLabels={goalWeight:"Peso obiettivo (kg)",minWeight:"Peso minimo storico (kg)",maxWeight:"Peso massimo storico (kg)",reasonableWeight:"Peso concordato (kg)",theoreticalWeight:"Peso teorico (kg)",objectives:"Obiettivi",work:"Attività lavorativa",activity:"Attività fisica",activityFactor:"Fattore attività",smoking:"Fumo",alcohol:"Alcol",diagnosis:"Diagnosi / motivo",bowel:"Alvo",metabolism:"Metabolismo basale",feeg:"FEEG / fabbisogno",impedance:"Impedenziometria",previousDiets:"Diete pregresse",allergies:"Allergie / intolleranze",medications:"Farmaci / integrazione",giIssues:"Disturbi gastrointestinali",pastConditions:"Patologie / interventi pregressi",observations:"Osservazioni"};
const familyLabels={obesity:"Obesità",diabetes:"Diabete",hypertension:"Ipertensione",cardiovascular:"Cardiovascolare",dyslipidemia:"Dislipidemie",thyroid:"Tiroide"};
const readValue=value=>value===null||value===undefined||value===""?"—":typeof value==="boolean"?value?"Sì":"No":String(value);
const readFields=fields=>`<dl class="pathway-record-fields">${fields.map(([label,value])=>`<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(readValue(value))}</dd></div>`).join("")}</dl>`;
const readRecord=(title,fields,extra="")=>`<article class="pathway-record"><h4>${escapeHtml(title)}</h4>${readFields(fields)}${extra}</article>`;

function renderHistorySection(section,history){
  if(section.items===null) return '<p class="pathway-section-empty">Dettaglio non archiviato per questo percorso.</p>';
  if(!section.items.length) return '<p class="pathway-section-empty">Nessun elemento archiviato per questo percorso.</p>';
  if(section.key==="anamnesis"){
    const a=section.items[0];
    return readFields(Object.entries(anamnesisLabels).map(([key,label])=>[label,a[key]]))+
      `<h4 class="pathway-family-title">Familiarità</h4>${readFields(Object.entries(familyLabels).map(([key,label])=>[label,a.family?.[key]]))}`;
  }
  if(section.key==="measurements") return history.measurementRows.map(row=>readRecord(`${row.dateText} · ${row.timeText}`,
    [...row.values,...row.details].map(item=>[item.label,item.text]).concat([["Note",row.notes]]),row.ffmNote?`<p>${escapeHtml(row.ffmNote)}</p>`:"")).join("");
  if(section.key==="diary") return history.diaryDays.map(day=>readRecord(fmtDate(day.date),
    [["Peso",day.weight!=null?`${day.weight} kg`:null],["Acqua",day.water],["Energia registrata / stimata",day.kcalText],["Qualità dati",day.note],["Note",day.notes]],
    day.meals.map(meal=>readRecord(`${meal.label} · ${meal.time||"—"}`,[["Descrizione",meal.originalText],["Energia registrata / stimata",meal.kcal!=null?`${meal.kcal} kcal`:null]],
      meal.components.length?`<ul class="pathway-food-list">${meal.components.map(item=>`<li>${escapeHtml(item.text||"—")} · ${escapeHtml(item.kcal==null?"Energia non disponibile":`${item.kcal} kcal`)}</li>`).join("")}</ul>`:"")).join(""))).join("");
  return section.items.map(item=>{
    if(section.key==="visits") return readRecord(item.title||"Visita",[["Data",fmtDate(item.date)],["Tipo",{first:"Prima visita",control:"Controllo"}[item.type]||item.type],["Stato",item.status==="completed"?"Completata":item.status],["Descrizione",item.description],["Note",item.notes]]);
    if(section.key==="notes") return readRecord(fmtDate(item.createdAt),[["Nota",item.text],["Ultimo aggiornamento",item.updatedAt?fmtDate(item.updatedAt):"—"]]);
    if(section.key==="reports") return readRecord(`Referto · ${fmtDate(item.reportDate)}`,
      [["Stato",item.status==="confirmed"?"Confermato":item.status],...labFields.map(([key,label])=>[label,item.values?.[key]]),["Note",item.notes]]);
    const isPlan=section.key==="plans";
    const fileIndex=history.files.indexOf(item);
    return readRecord(item.title||(isPlan?"Piano alimentare":"Documento"),[["Data",fmtDate(isPlan?item.validFrom:item.date)],
      ["File",item.fileName],[isPlan?"Nota professionista":"Descrizione",isPlan?item.professionalNote:item.description],
      ...(isPlan?[]:[["Categoria",{analysis:"Analisi",report:"Referto",other:"Altro"}[item.category]||item.category],["Provenienza",item.origin]])],
      item.file instanceof Blob?`<button type="button" data-history-file="${fileIndex}">Apri allegato</button>`:'<p class="pathway-file-unavailable">Allegato non disponibile in questa sessione.</p>');
  }).join("");
}

function openHistoryDialog(root,pathway,attachDialog){
  const history=getPathwayHistoryModel(pathway);
  history.files=[...(history.snapshot.documents||[]),...(history.snapshot.plans||[])];
  const dialog=document.createElement("dialog");
  dialog.className="pathway-history-dialog";
  dialog.setAttribute("aria-labelledby","pathway-history-title");
  dialog.setAttribute("aria-describedby","pathway-history-readonly");
  dialog.innerHTML=`<div class="pathway-history-sheet">
    <header class="pathway-history-head">
      <div><span class="pathway-eyebrow">CARTELLA DEL PERCORSO</span><h2 id="pathway-history-title">Storico percorso</h2></div>
      <button type="button" class="pathway-close" data-close aria-label="Chiudi storico percorso">×</button>
    </header>
    <div class="pathway-archive-heading"><h3>${escapeHtml(pathway.objectiveLabel||objectiveLabel(pathway.objectiveKey,pathway.customObjective))}</h3><span class="pathway-status ended">Concluso</span></div>
    <p class="pathway-archive-dates">${escapeHtml(fmtDate(pathway.startedAt))} → ${escapeHtml(fmtDate(pathway.endedAt))}</p>
    <p class="pathway-readonly-note" id="pathway-history-readonly">Percorso storico in sola lettura</p>
    <dl class="pathway-archive-summary">${history.summary.map(([label,value])=>`<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
    ${pathway.objectiveNote||pathway.closingNote?`<aside class="pathway-archive-notes" aria-label="Note del percorso">${[["Nota obiettivo",pathway.objectiveNote],["Nota di chiusura",pathway.closingNote]].filter(([,value])=>value).map(([label,value])=>`<div class="pathway-history-note"><h4>${label}</h4><p>${escapeHtml(value)}</p></div>`).join("")}</aside>`:""}
    <div class="pathway-archive-sections">${history.sections.map(section=>`<details class="pathway-archive-section"><summary><span>${section.label}</span>${section.key!=="anamnesis"?`<span class="pathway-section-count">${section.count??"—"}</span>`:""}<svg class="pathway-section-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="pathway-section-body">${renderHistorySection(section,history)}</div></details>`).join("")}</div>
    <footer><button type="button" class="pathway-secondary" data-close>Chiudi storico</button></footer>
  </div>`;
  dialog.querySelectorAll("[data-history-file]").forEach(button=>button.addEventListener("click",()=>{
    const item=history.files[Number(button.dataset.historyFile)];
    if(item?.file instanceof Blob) openDocumentFile(item);
  }));
  attachDialog(root,dialog);
}

function dialogShell(title,body,submitLabel){
  return `<form method="dialog">
    <header><h2>${escapeHtml(title)}</h2><button type="button" data-close aria-label="Chiudi">×</button></header>
    ${body}
    <footer><button type="button" data-close>Annulla</button><button type="submit" value="save">${escapeHtml(submitLabel)}</button></footer>
  </form>`;
}

function objectiveFields(pathway={}){
  const currentKey=pathway.objectiveKey||"weight_loss";
  return `<div class="pathway-dialog-fields">
    <label><span>Data di inizio</span><input name="startedAt" type="date" value="${escapeHtml(pathway.startedAt||todayIso())}" required></label>
    <label><span>Obiettivo principale</span><select name="objectiveKey" data-pathway-objective>${OBJECTIVES.map(([value,label])=>`<option value="${value}" ${currentKey===value?"selected":""}>${escapeHtml(label)}</option>`).join("")}</select></label>
    <label class="pathway-custom-objective" data-pathway-custom ${currentKey==="other"?"":"hidden"}><span>Specifica obiettivo</span><input name="customObjective" value="${escapeHtml(pathway.customObjective||"")}" maxlength="100"></label>
    <label class="pathway-note-field"><span>Nota obiettivo <small>(facoltativa)</small></span><textarea name="objectiveNote" rows="4" maxlength="300" placeholder="Breve indicazione utile per contestualizzare il percorso.">${escapeHtml(pathway.objectiveNote||"")}</textarea></label>
  </div>`;
}

function syncCustomObjective(dialog){
  const select=dialog.querySelector("[data-pathway-objective]");
  const field=dialog.querySelector("[data-pathway-custom]");
  const input=field?.querySelector("input");
  const sync=()=>{
    const isOther=select?.value==="other";
    if(field) field.hidden=!isOther;
    if(input) input.required=!!isOther;
  };
  select?.addEventListener("change",sync);
  sync();
}

function openNewDialog(root,model,onChange,attachDialog){
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog pathway-dialog";
  dialog.innerHTML=dialogShell("Apri nuovo percorso",
    `<p>Il paziente esiste già come anagrafica. Il percorso viene creato solo ora.</p>${objectiveFields()}`,
    "Apri percorso"
  );
  syncCustomObjective(dialog);
  attachDialog(root,dialog,values=>{
    const objectiveKey=String(values.get("objectiveKey")||"weight_loss");
    const customObjective=String(values.get("customObjective")||"").trim();
    if(objectiveKey==="other"&&!customObjective) return;
    const hasOtherActivePathway=Boolean(model.data.pathways?.hasOtherActivePathway);
    const startedAt=String(values.get("startedAt")||todayIso());
    const item={
      id:`${model.data.identity.id}-pathway-${Date.now()}`,
      status:hasOtherActivePathway?"pending":"active",
      startedAt:hasOtherActivePathway?null:startedAt,
      proposedAt:startedAt,
      endedAt:null,
      objectiveKey,
      customObjective,
      objectiveLabel:objectiveLabel(objectiveKey,customObjective),
      objectiveNote:String(values.get("objectiveNote")||"").trim()
    };
    pathways(model).items.push(item);
    pathways(model).ui.historyOpen=false;
    pathways(model).ui.selectedHistoryId=null;
    if(item.status==="active") model.data.journey.startedAt=startedAt;
    onChange();
  });
}

function openEditDialog(root,model,onChange,attachDialog){
  const current=activePathway(model);
  if(!current) return;
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog pathway-dialog";
  dialog.innerHTML=dialogShell("Gestisci percorso",objectiveFields(current),"Salva");
  syncCustomObjective(dialog);
  attachDialog(root,dialog,values=>{
    const objectiveKey=String(values.get("objectiveKey")||"weight_loss");
    const customObjective=String(values.get("customObjective")||"").trim();
    if(objectiveKey==="other"&&!customObjective) return;
    current.startedAt=String(values.get("startedAt")||current.startedAt||todayIso());
    current.objectiveKey=objectiveKey;
    current.customObjective=customObjective;
    current.objectiveLabel=objectiveLabel(objectiveKey,customObjective);
    current.objectiveNote=String(values.get("objectiveNote")||"").trim();
    model.data.journey.startedAt=current.startedAt;
    onChange();
  });
}

function openEndDialog(root,model,onChange,attachDialog){
  const current=activePathway(model);
  if(!current) return;
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog pathway-dialog pathway-end-dialog";
  dialog.innerHTML=dialogShell("Concludi percorso",
    `<p>Il percorso verrà spostato nello storico e resterà consultabile in sola lettura.</p>
     <div class="pathway-end-summary"><strong>${escapeHtml(current.objectiveLabel||objectiveLabel(current.objectiveKey,current.customObjective))}</strong><span>Iniziato il ${fmtDate(current.startedAt)}</span></div>
     <label class="pathway-closing-note"><span>Nota di chiusura <small>(facoltativa)</small></span><textarea name="closingNote" rows="4" maxlength="400" placeholder="Esito del percorso, indicazioni finali o motivo della chiusura."></textarea></label>`,
    "Concludi percorso"
  );
  attachDialog(root,dialog,values=>{
    current.status="ended";
    current.endedAt=todayIso();
    current.closingNote=String(values.get("closingNote")||"").trim();
    current.snapshot=capturePathwaySnapshot(model.data,current);
    model.data.journey.startedAt=null;
    pathways(model).ui.historyOpen=true;
    pathways(model).ui.selectedHistoryId=null;
    onChange();
  });
}

export function bindPathwayManagement(root,model,onChange,attachDialog){
  root.querySelector("[data-pathway-new]")?.addEventListener("click",()=>openNewDialog(root,model,onChange,attachDialog));
  root.querySelector("[data-pathway-edit]")?.addEventListener("click",()=>openEditDialog(root,model,onChange,attachDialog));
  root.querySelector("[data-pathway-end]")?.addEventListener("click",()=>openEndDialog(root,model,onChange,attachDialog));
  root.querySelector("[data-pathway-history]")?.addEventListener("click",()=>{
    pathways(model).ui.historyOpen=true;
    pathways(model).ui.selectedHistoryId=null;
    onChange();
  });
  root.querySelector("[data-pathway-history-close]")?.addEventListener("click",()=>{
    pathways(model).ui.historyOpen=false;
    pathways(model).ui.selectedHistoryId=null;
    onChange();
  });
  root.querySelectorAll("[data-pathway-history-open]").forEach(button=>button.addEventListener("click",()=>{
    const selected=endedPathways(model).find(item=>item.id===button.dataset.pathwayHistoryOpen);
    if(selected) openHistoryDialog(root,selected,attachDialog);
  }));
}
