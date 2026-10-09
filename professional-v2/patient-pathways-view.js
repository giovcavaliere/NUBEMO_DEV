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
  const selected=ended.find(item=>item.id===state.ui.selectedHistoryId)||null;

  if(selected){
    const summary=selected.snapshotSummary||{};
    return `<section class="pathway-history pathway-history-detail">
      <header class="pathway-history-head">
        <div>
          <span class="pathway-eyebrow">STORICO PERCORSO</span>
          <h2>${escapeHtml(selected.objectiveLabel||objectiveLabel(selected.objectiveKey,selected.customObjective))}</h2>
          <p>${fmtDate(selected.startedAt)} → ${fmtDate(selected.endedAt)}</p>
        </div>
        <button type="button" class="pathway-secondary" data-pathway-history-back>← Torna allo storico</button>
      </header>
      <div class="pathway-readonly-note"><strong>Percorso concluso</strong><span>I dati di questo percorso sono consultabili in sola lettura.</span></div>
      <div class="pathway-history-kpis">
        <div><span>Visite</span><strong>${summary.visits??"—"}</strong></div>
        <div><span>Misurazioni</span><strong>${summary.measurements??"—"}</strong></div>
        <div><span>Giornate diario</span><strong>${summary.diaryDays??"—"}</strong></div>
        <div><span>Documenti</span><strong>${summary.documents??"—"}</strong></div>
        <div><span>Piani</span><strong>${summary.plans??"—"}</strong></div>
        <div><span>Note</span><strong>${summary.notes??"—"}</strong></div>
      </div>
      ${selected.objectiveNote?`<div class="pathway-history-note"><span>Nota obiettivo</span><p>${escapeHtml(selected.objectiveNote)}</p></div>`:""}
    </section>`;
  }

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

function captureSnapshot(model){
  const weights=(model.weightSeries||[]).map(row=>Number(row.weight)).filter(Number.isFinite);
  return {
    visits:model.data.visits.filter(item=>item.status==="completed").length,
    measurements:model.data.measurements.length,
    diaryDays:model.data.diary?.days?.length||0,
    documents:model.data.documents.length,
    plans:model.data.nutritionPlans.length,
    notes:model.data.notes.length,
    initialWeight:weights.length?weights[0]:null,
    finalWeight:weights.length?weights.at(-1):null
  };
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
     <div class="pathway-end-summary"><strong>${escapeHtml(current.objectiveLabel||objectiveLabel(current.objectiveKey,current.customObjective))}</strong><span>Iniziato il ${fmtDate(current.startedAt)}</span></div>`,
    "Concludi percorso"
  );
  attachDialog(root,dialog,()=>{
    current.status="ended";
    current.endedAt=todayIso();
    current.snapshotSummary=captureSnapshot(model);
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
  root.querySelector("[data-pathway-history-back]")?.addEventListener("click",()=>{
    pathways(model).ui.selectedHistoryId=null;
    onChange();
  });
  root.querySelectorAll("[data-pathway-history-open]").forEach(button=>button.addEventListener("click",()=>{
    pathways(model).ui.selectedHistoryId=button.dataset.pathwayHistoryOpen||null;
    onChange();
  }));
}
