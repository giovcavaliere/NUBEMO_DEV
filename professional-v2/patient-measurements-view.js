import {buildMeasurementChart,measurementFromForm,getMeasurementFormPreview,isMeasurementDate} from "./patient-measurements-model.js";

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
  const shape='<path d="M100 20C92 20 87 26 87 35L87 43C85 43 85 47 88 51C88 58 91 62 95 65L95 69H105L105 65C109 62 112 58 112 51C115 47 115 43 113 43L113 35C113 26 108 20 100 20Z"/><path d="M95 66C95 71 91 73 84 75L78 77C72 80 69 85 68 93L65 117C64 127 61 136 61 146L60 171C59 181 56 189 55 197L54 208Q54 213 57 216L59 216L59 208L60 213Q62 216 63 213L64 198C65 187 68 180 68 169L70 147L72 128L77 105L77 138C77 149 75 159 74 169C72 183 74 199 77 211L78 238C77 250 80 263 81 277L79 288C77 295 75 297 79 299H89C94 297 94 293 92 290L92 280C92 265 94 254 94 239L97 207Q100 202 103 207L106 239C106 254 108 265 108 280L108 290C106 293 106 297 111 299H121C125 297 123 295 121 288L119 277C120 263 123 250 122 238L123 211C126 199 128 183 126 169C125 159 123 149 123 138L123 105L128 128L130 147L132 169C132 180 135 187 136 198L137 213Q138 216 140 213L141 208L141 216H143Q146 213 146 208L145 197C144 189 141 181 140 171L139 146C139 136 136 127 135 117L132 93C131 85 128 80 122 77L116 75C109 73 105 71 105 66Z"/>';
  return `<div class="measure-body-layout">
    <svg class="measure-body" viewBox="40 10 120 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Rappresentazione infografica della BIA. ${escapeHtml(composition.note)}">
      <defs><clipPath id="measure-body-clip">${shape}</clipPath></defs>
      <g clip-path="url(#measure-body-clip)"><rect x="20" y="20" width="160" height="280" fill="#e5e6df"/>${composition.bands.map(band=>`<rect x="20" y="${band.y}" width="160" height="${band.height}" class="measure-tone-${band.tone}"/>`).join("")}</g>
    </svg>
    <div class="measure-body-values">${composition.components.map(item=>`<div class="measure-body-value measure-value-${item.tone}"><span>${item.label}</span><strong>${escapeHtml(item.text)}</strong></div>`).join("")}<div class="measure-ffm"><span>FFM</span><strong>${escapeHtml(composition.ffmText)}</strong></div></div>
  </div><p class="detail-note">${escapeHtml(composition.note)}</p>${!composition.hasSegments?`<p class="detail-note">FM, ECM e BCM non rilevate; la figura resta neutra.</p>`:""}`;
}

function renderChart(chart){
  if(!chart) return `<p class="detail-empty">Nessun dato da rappresentare. Registra peso, FM% o MM% per iniziare l’andamento.</p>`;
  return `<div class="measure-trend-chart" role="img" aria-label="${escapeHtml(chart.series.map(item=>item.summary).join(". "))}">
    <svg viewBox="0 0 500 265" aria-hidden="true">
      ${chart.hasWeight?'<text x="46" y="16" class="measure-axis">Peso (kg)</text>':""}${chart.hasPercent?'<text x="454" y="16" text-anchor="end" class="measure-axis">Percentuali (%)</text>':""}
      ${chart.ticks.map(tick=>`<line x1="46" x2="454" y1="${tick.y}" y2="${tick.y}" class="measure-chart-grid"/>${chart.hasWeight?`<text x="38" y="${tick.y}" dominant-baseline="middle" text-anchor="end" class="measure-axis">${tick.weight}</text>`:""}${chart.hasPercent?`<text x="462" y="${tick.y}" dominant-baseline="middle" class="measure-axis">${tick.percent}</text>`:""}`).join("")}
      ${chart.series.map(series=>`<g style="color:${series.color}"><path d="${series.path}" class="measure-chart-line"/>${series.dots.map(point=>`<circle cx="${point.x}" cy="${point.y}" r="3.5" class="measure-chart-dot"><title>${escapeHtml(point.title)}</title></circle>`).join("")}</g>`).join("")}
      ${chart.labels.map(label=>`<text x="${label.x}" y="252" text-anchor="${label.edge}" class="measure-axis ${label.interior?"measure-axis-interior":""}">${escapeHtml(label.label)}</text>`).join("")}
    </svg>
  </div><div class="measure-chart-latest">${chart.series.map(item=>`<span><i class="measure-dot" style="background:${item.color}"></i>${item.label}<strong>${escapeHtml(item.latestText)}</strong></span>`).join("")}</div>`;
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
  const {composition,summary,chart,series,rows,deltas}=model;
  return `<section class="detail-measurements" aria-labelledby="measure-title">
    <div class="measure-title-row"><div><h2 id="measure-title">Misure</h2><p>Antropometria e composizione corporea, nel tempo.</p></div><button type="button" class="measure-new" data-measure-new>${icon("plus")}<span>Nuova misurazione</span></button></div>
    <div class="measure-summary" aria-label="Ultima misurazione">${summary.map(item=>`<article class="detail-kpi"><span class="detail-kpi-label">${item.label}</span><strong>${escapeHtml(item.text)}</strong><small>${escapeHtml(item.note)}</small></article>`).join("")}</div>
    <div class="measure-panels">
      <section class="detail-panel measure-composition-panel">${panelHeading("Composizione corporea",composition?.dateText)}${renderComposition(composition)}</section>
      <section class="detail-panel measure-body-panel">${panelHeading("Rappresentazione corporea",composition?.dateText)}${renderBody(composition)}</section>
      <section class="detail-panel measure-trend-panel">${panelHeading("Andamento nel tempo","Sintesi delle rilevazioni")}
        <div class="measure-series-controls" aria-label="Serie del grafico">${series.map(item=>`<button type="button" data-measure-series="${item.key}" aria-pressed="${item.points.length>0}" ${item.points.length?"":"disabled"}><i class="measure-dot" style="background:${item.color}"></i>${item.label} (${item.unit})</button>`).join("")}</div>
        <div data-measure-chart>${renderChart(chart)}</div><p class="detail-note">Peso sull’asse sinistro · percentuali sull’asse destro. Analisi approfondite nella futura tab Andamento.</p>
      </section>
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
  const selected=new Set(model.series.filter(item=>item.points.length).map(item=>item.key));
  root.querySelectorAll("[data-measure-series]").forEach(button=>button.addEventListener("click",()=>{
    const key=button.dataset.measureSeries;
    if(selected.has(key)) selected.delete(key);else selected.add(key);
    button.setAttribute("aria-pressed",String(selected.has(key)));
    const chart=buildMeasurementChart(model.series.filter(item=>selected.has(item.key)));
    root.querySelector("[data-measure-chart]").innerHTML=chart?renderChart(chart):'<p class="detail-empty">Seleziona una serie per visualizzarne l’andamento.</p>';
  }));
}
