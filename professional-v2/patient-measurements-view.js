import {measurementFromForm,getMeasurementFormPreview,isMeasurementDate} from "./patient-measurements-model.js";
import {patientBodyPath} from "./patient-body-graphic.js";

const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const icon=name=>`<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${name}"/></svg>`;
const panelHeading=(title,note="")=>`<div class="measure-panel-heading"><h3>${title}</h3>${note?`<span>${escapeHtml(note)}</span>`:""}</div>`;
const emptyComposition=()=>`<div class="measure-empty-composition">${icon("profile")}<strong>Composizione corporea non ancora rilevata</strong><p>Aggiungi i valori BIA quando disponibili. Puoi registrare anche solo il peso o le circonferenze.</p></div>`;

function renderComposition(composition){
  if(!composition) return emptyComposition();
  return `${composition.stackExcess?`<p class="measure-over-scale">Oltre il riferimento 100% · valori rilevati, senza ridimensionamento</p>`:""}<div class="measure-composition-chart" style="--measure-stack-excess:${composition.stackExcess}" role="img" aria-label="Pile FFM / FM e BCM / ECM su scala assoluta da 0 a 100 percento. ${composition.stacks.map(stack=>stack.segments.map(item=>`${item.label}: ${item.text}`).join("; ")).join("; ")}${composition.stackExcess?". I valori oltre 100 percento proseguono sopra la scala.":""}">
    <div class="measure-scale" aria-hidden="true"><span>100%</span><span>80%</span><span>60%</span><span>40%</span><span>20%</span><span>0%</span></div>
    <div class="measure-bars">${composition.stacks.map(stack=>`<div class="measure-bar-column"><div class="measure-bar-track">${stack.segments.filter(item=>item.height>0).map(item=>`<div class="measure-bar-fill measure-tone-${item.tone}" style="height:${item.height}%;bottom:${item.bottom}%">${item.showLabel?`<span>${item.label}<strong>${escapeHtml(item.text)}</strong></span>`:""}</div>`).join("")}<span class="measure-bar-reference" aria-hidden="true"></span></div><strong>${stack.label}</strong></div>`).join("")}</div>
  </div><div class="measure-composition-key">${composition.stacks.map(stack=>`<div class="measure-stack-key">${stack.segments.map(item=>`<div><i class="measure-dot measure-tone-${item.tone}"></i><span>${item.label}</span><strong>${escapeHtml(item.text)}</strong><small>${item.description}</small></div>`).join("")}</div>`).join("")}</div>
  <div class="measure-ffm"><span>${escapeHtml(composition.ffmLabel)}</span><strong>${escapeHtml(composition.ffmText)}</strong></div>
  ${composition.ffmNote?`<p class="detail-note">${escapeHtml(composition.ffmNote)}</p>`:""}`;
}

function renderBody(composition){
  if(!composition) return emptyComposition();
  // One continuous, symmetric outline; the existing BIA bands only change its colour.
  const shape=`<path d="${patientBodyPath}"/>`;
  return `<div class="measure-body-layout">
    <svg class="measure-body" viewBox="44 14 112 292" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Rappresentazione infografica della BIA. ${escapeHtml(composition.note)}">
      <defs><clipPath id="measure-body-clip">${shape}</clipPath><linearGradient id="measure-body-light" x1="0" x2="1"><stop stop-color="#fff" stop-opacity=".2"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".1"/></linearGradient></defs>
      <g clip-path="url(#measure-body-clip)"><rect x="20" y="20" width="160" height="280" fill="#e5e6df"/>${composition.bands.map(band=>`<rect x="20" y="${band.y}" width="160" height="${band.height}" class="measure-tone-${band.tone}"/>`).join("")}<rect x="20" y="20" width="160" height="280" fill="url(#measure-body-light)"/></g>
    </svg>
    <div class="measure-body-values">${composition.components.map(item=>`<div class="measure-body-value measure-value-${item.tone}"><span>${item.label}</span><strong>${escapeHtml(item.text)}</strong></div>`).join("")}<div class="measure-ffm"><span>FFM</span><strong>${escapeHtml(composition.ffmText)}</strong></div></div>
  </div><p class="detail-note">${escapeHtml(composition.note)}</p>${!composition.hasSegments?`<p class="detail-note">FM, ECM e BCM non rilevate; la figura resta neutra.</p>`:""}`;
}

function renderHistory(rows){
  if(!rows.length) return `<p class="detail-empty">Nessuna misurazione registrata. Aggiungi la prima rilevazione per iniziare lo storico.</p>`;
  return `<div class="measure-history">${rows.map(row=>`<article class="measure-history-row" data-measure-row="${escapeHtml(row.id)}">
    <details class="measure-history-details"><summary aria-label="Dettagli misurazione del ${escapeHtml(row.dateText)} ${escapeHtml(row.timeText)}">
      <span class="measure-history-date"><span class="measure-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path d="m4 6 4 4 4-4"/></svg></span><span><time datetime="${row.date}">${escapeHtml(row.dateText)}</time><small>${escapeHtml(row.timeText)}</small></span></span>
      <span class="measure-history-metrics">${row.values.map(item=>`<span class="measure-history-metric measure-metric-${item.key}"><span>${item.label}</span><strong>${escapeHtml(item.text)}</strong></span>`).join("")}</span>
    </summary><div class="measure-history-expanded"><dl>${row.details.map(item=>`<div><dt>${item.label}</dt><dd>${escapeHtml(item.text)}</dd></div>`).join("")}<div class="measure-history-notes"><dt>Note</dt><dd>${escapeHtml(row.notes)}</dd></div></dl>${row.ffmNote?`<p class="detail-note">${escapeHtml(row.ffmNote)}</p>`:""}</div></details>
    <div class="measure-history-actions"><button type="button" data-measure-edit="${escapeHtml(row.id)}" aria-label="Modifica misurazione del ${escapeHtml(row.dateText)}" title="Modifica">${icon("edit")}</button><button type="button" class="measure-delete" data-measure-delete="${escapeHtml(row.id)}" aria-label="Elimina misurazione del ${escapeHtml(row.dateText)}" title="Elimina"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg></button></div>
  </article>`).join("")}</div>`;
}

export function renderMeasurements(model){
  const {composition,summary,rows,deltas}=model;
  return `<section class="detail-measurements" aria-labelledby="measure-title">
    <div class="measure-title-row"><div><h2 id="measure-title">Misure</h2><p>Antropometria e composizione corporea, nel tempo.</p></div><button type="button" class="measure-new" data-measure-new>${icon("plus")}<span>Nuova misurazione</span></button></div>
    <div class="measure-summary" aria-label="Ultima misurazione">${summary.map(item=>`<article class="detail-kpi"><span class="detail-kpi-label">${item.label}</span><strong>${escapeHtml(item.text)}</strong><small>${escapeHtml(item.note)}</small></article>`).join("")}</div>
    <div class="measure-panels">
      <section class="detail-panel measure-composition-panel">${panelHeading("Composizione corporea",composition?.dateText)}${renderComposition(composition)}</section>
      <section class="detail-panel measure-body-panel">${panelHeading("Rappresentazione corporea",composition?.dateText)}${renderBody(composition)}</section>

    </div>
    <section class="detail-panel measure-history-panel">${panelHeading("Storico misurazioni",`${rows.length} ${rows.length===1?"rilevazione":"rilevazioni"}`)}
      ${rows.length?`<div class="measure-deltas"><span>Rispetto alla misura precedente</span>${deltas.map(item=>`<span><b>${item.label}</b> ${escapeHtml(item.text)}</span>`).join("")}</div>`:""}${renderHistory(rows)}
    </section>
  </section>`;
}

function numberField(label,key,measurement,{percentage=false}={}){
  return `<label><span>${label}</span><input name="${key}" type="number" inputmode="decimal" min="${percentage?0:.1}" ${percentage?'max="100"':""} step="0.01" value="${escapeHtml(measurement?.[key]??"")}" placeholder="Facoltativo"></label>`;
}

function openMeasurementDialog(root,data,viewModel,onChange,attachDialog,id=null){
  const existing=id?data.measurements.find(item=>item.id===id):null;
  const now=new Date(),localDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const localTime=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog detail-dialog-wide measure-dialog";
  dialog.innerHTML=`<form method="dialog"><header><h2>${existing?"Modifica misurazione":"Nuova misurazione"}</h2><button type="button" data-close aria-label="Chiudi">×</button></header><p>Solo la data è obbligatoria. Modifiche demo disponibili fino al ricaricamento della pagina.</p>
    <div class="measure-form-body">
      <fieldset><legend>Rilevazione</legend><div class="measure-form-grid"><label><span>Data *</span><input name="date" type="date" required value="${escapeHtml(existing?.date||localDate)}"></label><label><span>Ora</span><input name="time" type="time" value="${escapeHtml(existing?existing.time||"":localTime)}"></label>${numberField("Peso (kg)","weight",existing)}${numberField("Altezza (cm)","height",existing)}</div>
        <div class="measure-form-hint"><span>BMI: <output data-measure-bmi>—</output> · richiede peso e altezza di questa rilevazione.</span>${viewModel.lastHeight?`<button type="button" data-measure-use-height>Usa altezza ${viewModel.lastHeight.value} cm del ${escapeHtml(viewModel.lastHeight.dateText)}</button>`:""}</div>
      </fieldset>
      <fieldset><legend>Circonferenze</legend><div class="measure-form-grid">${numberField("Vita (cm)","waist",existing)}${numberField("Fianchi (cm)","hips",existing)}${numberField("Braccio (cm)","arm",existing)}${numberField("Coscia (cm)","thigh",existing)}</div></fieldset>
      <fieldset><legend>Composizione corporea</legend><div class="measure-form-grid">${numberField("FM% · massa grassa","bodyFat",existing,{percentage:true})}${numberField("MM% · massa muscolare","muscleMass",existing,{percentage:true})}${numberField("ECM% · massa extracellulare","ecm",existing,{percentage:true})}${numberField("BCM% · massa cellulare","bcm",existing,{percentage:true})}</div>
        <div class="measure-form-hint"><span>FFM (BCM + ECM): <output data-measure-ffm aria-live="polite">—</output></span><span>Calcolata solo quando ECM e BCM sono presenti.${existing?.ffm!=null?` FFM esplicita registrata: ${escapeHtml(existing.ffm)}% (conservata).`:""}</span></div>
      </fieldset>
      <label class="measure-form-notes"><span>Note</span><textarea name="notes" rows="3" placeholder="Annotazioni sulla rilevazione">${escapeHtml(existing?.notes||"")}</textarea></label>
    </div><footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Salva misurazione</button></footer></form>`;
  const form=dialog.querySelector("form");
  const updatePreview=()=>{const preview=getMeasurementFormPreview(new FormData(form),existing);dialog.querySelector("[data-measure-bmi]").textContent=preview.bmiText;dialog.querySelector("[data-measure-ffm]").textContent=preview.ffmText};
  form.addEventListener("input",()=>{form.elements.date.setCustomValidity("");updatePreview()});
  form.addEventListener("submit",event=>{
    if(!isMeasurementDate(form.elements.date.value)){event.preventDefault();form.elements.date.setCustomValidity("Inserisci una data valida.");form.reportValidity()}
  });
  dialog.querySelector("[data-measure-use-height]")?.addEventListener("click",()=>{form.elements.height.value=viewModel.lastHeight.value;updatePreview()});
  updatePreview();
  attachDialog(root,dialog,values=>{
    const measurement=measurementFromForm(values,existing);
    if(existing) data.measurements[data.measurements.findIndex(item=>item.id===id)]=measurement;
    else data.measurements.push(measurement);
    onChange();
    root.querySelector("[data-measure-new]")?.focus({preventScroll:true});
  });
}

function openDeleteDialog(root,data,row,onChange,attachDialog){
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog measure-delete-dialog";
  dialog.innerHTML=`<form method="dialog"><header><h2>Elimina misurazione</h2><button type="button" data-close aria-label="Chiudi">×</button></header><p>Eliminare la misurazione del <strong>${escapeHtml(row.dateText)}${row.timeText!=="—"?` alle ${escapeHtml(row.timeText)}`:""}</strong>? Verrà rimossa dallo storico e dai grafici.</p><footer><button type="button" data-close autofocus>Annulla</button><button type="submit" value="save">Elimina</button></footer></form>`;
  attachDialog(root,dialog,()=>{
    data.measurements=data.measurements.filter(item=>item.id!==row.id);
    onChange();
    root.querySelector("[data-measure-new]")?.focus({preventScroll:true});
  });
}

export function bindMeasurements(root,data,model,onChange,attachDialog){
  root.querySelector("[data-measure-new]")?.addEventListener("click",()=>openMeasurementDialog(root,data,model,onChange,attachDialog));
  root.querySelectorAll("[data-measure-edit]").forEach(button=>button.addEventListener("click",()=>openMeasurementDialog(root,data,model,onChange,attachDialog,button.dataset.measureEdit)));
  root.querySelectorAll("[data-measure-delete]").forEach(button=>button.addEventListener("click",()=>openDeleteDialog(root,data,model.rows.find(row=>row.id===button.dataset.measureDelete),onChange,attachDialog)));
  root.querySelectorAll(".measure-history-details").forEach(details=>details.addEventListener("toggle",()=>{
    if(details.open) root.querySelectorAll(".measure-history-details").forEach(other=>{if(other!==details) other.open=false});
  }));
}
