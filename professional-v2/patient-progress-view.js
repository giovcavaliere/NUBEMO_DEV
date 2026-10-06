import {getProgressViewModel,progressPeriods,circumferenceOptions,biaOptions} from "./patient-progress-model.js";

const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const icon=name=>`<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${name}"/></svg>`;
const controls=(items,selected,attribute,label)=>`<div class="progress-segments" role="group" aria-label="${label}">${items.map(item=>`<button type="button" ${attribute}="${item.key}" aria-pressed="${item.key===selected}">${item.label}</button>`).join("")}</div>`;
const heading=(title,note)=>`<div><h3>${title}</h3><p>${note}</p></div>`;
const empty=message=>`<div class="progress-empty">${icon("chart")}<strong>${message}</strong><span>Le misurazioni si aggiungono dalla tab Misure.</span></div>`;

function renderChart(chart,label,emptyMessage){
  if(!chart) return empty(emptyMessage);
  const percent=chart.axisUnit==="%";
  return `<div class="progress-chart" role="img" aria-label="${escapeHtml(chart.series.map(item=>item.summary).join(". "))}">
    <span class="progress-axis-title">${label} (${chart.axisUnit})</span>
    <div class="progress-chart-plot">
      <svg viewBox="46 34 408 191" preserveAspectRatio="none" aria-hidden="true">
        ${chart.ticks.map(tick=>`<line x1="46" x2="454" y1="${tick.y}" y2="${tick.y}" class="progress-chart-grid"/>`).join("")}
        ${chart.labels.map(item=>`<line x1="${item.x}" x2="${item.x}" y1="34" y2="225" class="progress-chart-grid progress-chart-grid-vertical"/>`).join("")}
        ${chart.reference?`<line x1="46" x2="454" y1="${chart.reference.y}" y2="${chart.reference.y}" class="progress-chart-goal"/>`:""}
        ${chart.series.map(series=>`${series.area?`<path d="${series.area}" class="progress-chart-area"/>`:""}<path d="${series.path}" style="color:${series.color}" class="progress-chart-line"/>`).join("")}
      </svg>
      ${chart.ticks.map(tick=>`<span class="progress-axis progress-chart-tick" style="--progress-y:${tick.y}">${percent?tick.percent:tick.weight}</span>`).join("")}
      ${chart.series.map(series=>series.dots.map(point=>`<span class="progress-chart-dot" style="--progress-x:${point.x};--progress-y:${point.y};color:${series.color}" title="${escapeHtml(point.title)}"></span>`).join("")).join("")}
      ${chart.labels.map(item=>`<span class="progress-axis progress-chart-date progress-date-${item.edge} ${item.interior?"progress-axis-interior":""}" style="--progress-x:${item.x}">${escapeHtml(item.label)}</span>`).join("")}
    </div>
  </div><div class="progress-chart-latest">${chart.series.map(item=>`<span><i class="measure-dot" style="background:${item.color}"></i>${item.label}<strong>${escapeHtml(item.latestText)}</strong></span>`).join("")}${chart.reference?`<span class="progress-goal-label">${escapeHtml(chart.reference.text)}</span>`:""}</div>${chart.series.every(item=>item.points.length===1)?'<p class="detail-note">Una sola rilevazione disponibile per ciascuna serie mostrata.</p>':""}`;
}

function renderComparison(model){
  const {comparison,readings}=model;
  if(!readings.length) return empty("Nessuna rilevazione da confrontare");
  const select=(label,attribute,selected)=>`<label><span>${label}</span><select ${attribute} aria-label="${label}">${readings.map(item=>`<option value="${escapeHtml(item.id)}" ${item.id===selected?"selected":""}>${escapeHtml(item.label)}</option>`).join("")}</select></label>`;
  return `<div class="progress-comparison-controls">${select("Prima rilevazione","data-progress-first",comparison.firstId)}<span aria-hidden="true">↔</span>${select("Seconda rilevazione","data-progress-last",comparison.lastId)}</div>
    <table class="progress-comparison"><caption class="progress-sr-only">Confronto dei dati effettivamente presenti nelle rilevazioni selezionate</caption><thead><tr><th scope="col">Parametro</th><th scope="col">${escapeHtml(comparison.firstLabel)}</th><th scope="col">${escapeHtml(comparison.lastLabel)}</th><th scope="col">Variazione</th></tr></thead><tbody>${comparison.rows.map(row=>`<tr data-progress-compare="${row.key}"><th scope="row">${icon(row.icon)}<span>${row.label}</span></th><td data-label="${escapeHtml(row.firstLabel)}">${escapeHtml(row.first)}</td><td data-label="${escapeHtml(row.lastLabel)}">${escapeHtml(row.last)}</td><td class="progress-comparison-delta" data-label="Variazione">${escapeHtml(row.delta)}</td></tr>`).join("")}</tbody></table>${readings.length===1?'<p class="detail-note">Una sola rilevazione disponibile. Nessun confronto nel tempo.</p>':""}`;
}

export function renderProgress(model){
  return `<section class="detail-progress" aria-labelledby="progress-title">
    <div class="progress-title"><h2 id="progress-title">Andamento</h2><p>Evoluzione delle principali misurazioni nel tempo e confronto tra rilevazioni.</p></div>
    <div class="progress-summary">${model.summary.map(item=>`<article class="detail-kpi progress-kpi ${item.bia?"progress-kpi-bia":""}"><span class="progress-kpi-symbol">${icon(item.icon)}</span><div><span class="detail-kpi-label">${item.label}</span><div class="progress-kpi-value"><strong>${item.bia?item.parts.map(part=>`<span>${part.label} ${escapeHtml(part.text)}</span>`).join(""):escapeHtml(item.value)}</strong>${item.delta?`<span class="progress-kpi-delta">${escapeHtml(item.delta)}</span>`:""}</div><small>${escapeHtml(item.note)}</small></div></article>`).join("")}</div>
    <div class="progress-grid">
      <section class="detail-panel progress-weight"><header class="progress-panel-heading">${heading("Andamento peso","Evoluzione del peso corporeo nel tempo.")}${controls(progressPeriods,model.period,"data-progress-period","Periodo dei grafici")}</header><p class="progress-period-note">${escapeHtml(model.periodNote)} · filtro comune ai tre grafici</p>${renderChart(model.charts.weight,"Peso","Nessun peso rilevato nel periodo selezionato")}</section>
      <section class="detail-panel progress-bia"><header class="progress-panel-heading">${heading("Andamento composizione corporea (BIA)","Evoluzione delle principali componenti corporee.")}${controls(biaOptions,model.biaSeries,"data-progress-bia","Serie BIA visualizzata")}</header>${renderChart(model.charts.bia,"Percentuale","Nessun dato BIA nel periodo selezionato")}<p class="detail-note">Sono collegate solo le rilevazioni in cui il valore selezionato è effettivamente disponibile.</p></section>
      <section class="detail-panel progress-circumference"><header class="progress-panel-heading">${heading("Circonferenze nel tempo","Evoluzione delle circonferenze corporee.")}${controls(circumferenceOptions,model.circumference,"data-progress-circumference","Circonferenza visualizzata")}</header>${renderChart(model.charts.circumference,model.circumferenceLabel,`${model.circumferenceLabel}: servono almeno due rilevazioni nel periodo selezionato`)}</section>
      <section class="detail-panel progress-compare-panel"><header class="progress-panel-heading">${heading("Confronta rilevazioni","Confronto tra due rilevazioni nel tempo.")}</header>${renderComparison(model)}</section>
    </div>
    <section class="detail-panel progress-reading"><header class="progress-panel-heading">${heading("Lettura dell’andamento","Sintesi descrittiva dai dati del percorso.")}<p class="progress-reading-note">Da interpretare nel contesto clinico.</p></header>${model.observations.length?`<div class="progress-observations">${model.observations.map(item=>`<article><span class="progress-kpi-symbol">${icon(item.icon)}</span><div><h4>${item.title}</h4><p>${escapeHtml(item.text)}</p></div></article>`).join("")}</div>`:empty("Non ci sono ancora dati sufficienti per descrivere variazioni")}</section>
  </section>`;
}

export function bindProgress(root,data,initialModel){
  let model=initialModel;
  const update=(changes,selector)=>{
    model=getProgressViewModel(data,{period:model.period,circumference:model.circumference,biaSeries:model.biaSeries,firstId:model.comparison.firstId,lastId:model.comparison.lastId,...changes});
    root.querySelector(".detail-progress").outerHTML=renderProgress(model);
    root.querySelector(selector)?.focus({preventScroll:true});
  };
  // Delegation stays on the tab content: replacing its view never duplicates listeners.
  const content=root.querySelector(".detail-content");
  content.addEventListener("click",event=>{
    const period=event.target.closest("[data-progress-period]"),circumference=event.target.closest("[data-progress-circumference]"),bia=event.target.closest("[data-progress-bia]");
    if(period) update({period:period.dataset.progressPeriod},`[data-progress-period="${period.dataset.progressPeriod}"]`);
    if(circumference) update({circumference:circumference.dataset.progressCircumference},`[data-progress-circumference="${circumference.dataset.progressCircumference}"]`);
    if(bia) update({biaSeries:bia.dataset.progressBia},`[data-progress-bia="${bia.dataset.progressBia}"]`);
  });
  content.addEventListener("change",event=>{
    if(event.target.matches("[data-progress-first]")) update({firstId:event.target.value},"[data-progress-first]");
    if(event.target.matches("[data-progress-last]")) update({lastId:event.target.value},"[data-progress-last]");
  });
}
