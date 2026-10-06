const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const icon=name=>`<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${name}"/></svg>`;
const dateLong=value=>value?new Intl.DateTimeFormat("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(`${value}T12:00:00`)):"—";
const dateShort=value=>value?new Intl.DateTimeFormat("it-IT",{weekday:"short",day:"numeric",month:"short"}).format(new Date(`${value}T12:00:00`)):"—";
const rangeDate=value=>value?new Intl.DateTimeFormat("it-IT",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`)):"—";
const confidenceLabels={high:"Buona",medium:"Media",low:"Bassa",none:"Non disponibile"};

function confidenceBadge(value){
  const key=["high","medium","low"].includes(value)?value:"low";
  return `<span class="diary-confidence diary-confidence-${key}">${confidenceLabels[value]||"Bassa"}</span>`;
}

function renderDayRow(day,selected){
  return `<button type="button" class="diary-day-row ${selected?"is-selected":""}" data-diary-date="${escapeHtml(day.date)}">
    <span class="diary-day-chevron" aria-hidden="true">⌄</span>
    <span class="diary-day-date"><strong>${escapeHtml(dateShort(day.date))}</strong><small>${day.valid?"Diario compilato":"Diario parziale"}</small></span>
    <strong class="diary-day-kcal">${escapeHtml(day.kcalText)}</strong>
    ${confidenceBadge(day.confidence)}
    <span class="diary-day-note">${escapeHtml(day.note)}</span>
  </button>`;
}

function mealIcon(key){
  return {breakfast:"cup",snack1:"leaf",lunch:"patients",snack2:"leaf",dinner:"document"}[key]||"document";
}

function renderComponent(component){
  const confidence=component.confidence||"low";
  const unresolved=component.status==="unresolved"||component.resolved===false;
  return `<div class="diary-component ${unresolved?"is-unresolved":""}">
    <span class="diary-component-text">${escapeHtml(component.text||component.label||"Voce non disponibile")}</span>
    <span class="diary-component-kcal">${Number.isFinite(component.kcal)?`${Math.round(component.kcal)} kcal`:"—"}</span>
    ${unresolved?'<span class="diary-component-status diary-component-status-low">Non interpretato</span>':confidenceBadge(confidence)}
  </div>`;
}

function renderMeal(meal){
  return `<article class="diary-meal">
    <header>
      <span class="diary-meal-icon">${icon(mealIcon(meal.key))}</span>
      <div><strong>${escapeHtml(meal.label)}</strong>${meal.time?`<small>${escapeHtml(meal.time)}</small>`:""}</div>
      <strong class="diary-meal-total">${Number.isFinite(meal.kcal)?`${Math.round(meal.kcal)} kcal`:"—"}</strong>
    </header>
    ${meal.originalText?`<p class="diary-original"><span>Testo del paziente</span>“${escapeHtml(meal.originalText)}”</p>`:""}
    <div class="diary-components">
      ${meal.components.length?meal.components.map(renderComponent).join(""):'<p class="diary-no-analysis">Nessun dettaglio interpretabile disponibile.</p>'}
    </div>
  </article>`;
}

function renderSelected(day){
  if(!day) return '<section class="diary-detail diary-empty"><strong>Nessun diario disponibile</strong><p>Quando il paziente compila il Diario, i dati appariranno qui in sola lettura.</p></section>';
  const message=day.unresolvedCount
    ?"La stima utilizza le componenti riconosciute. Le voci non interpretabili non vengono incluse nel totale."
    :day.estimatedCount
      ?"Le calorie sono stimate in base alle quantità indicate o a porzioni standard configurate."
      :"Tutti gli alimenti utilizzati nel calcolo sono stati riconosciuti.";
  return `<section class="diary-detail">
    <header class="diary-detail-head">
      <div>
        <span class="diary-detail-date">${escapeHtml(dateLong(day.date))}</span>
        <div class="diary-detail-value"><strong>${escapeHtml(day.kcalText)}</strong>${confidenceBadge(day.confidence)}</div>
        <p>${escapeHtml(message)}</p>
      </div>
      <span class="diary-readonly">${icon("eye")} Sola lettura</span>
    </header>
    <div class="diary-meals">${day.meals.length?day.meals.map(renderMeal).join(""):'<p class="diary-no-analysis">Nessun pasto registrato per questa giornata.</p>'}</div>
  </section>`;
}

export function renderDiary(model){
  const {summary,range,days,selected}=model;
  return `<div class="patient-diary">
    <header class="diary-titlebar">
      <div><h2>Diario alimentare</h2><p>Consulta il diario compilato dal paziente e la stima calorica NUBEMO. I dati sono in sola lettura.</p></div>
      ${range?`<span class="diary-range">${icon("calendar")} ${escapeHtml(rangeDate(range.from))} – ${escapeHtml(rangeDate(range.to))}</span>`:""}
    </header>

    <section class="diary-summary-card">
      <div class="diary-summary-value">
        <span class="diary-summary-icon">${icon("cup")}</span>
        <div><span>Media giornaliera <small>(stima)</small></span><strong>${escapeHtml(summary.averageText)}</strong><small>su ${summary.daysCount} ${summary.daysCount===1?"giorno":"giorni"} · attendibilità ${confidenceLabels[summary.confidence]||"non disponibile"}</small></div>
      </div>
      <div class="diary-info">
        <span aria-hidden="true">i</span>
        <p>Le calorie sono stimate automaticamente da NUBEMO. Il livello di attendibilità dipende dalla precisione delle quantità e dalla chiarezza degli alimenti inseriti dal paziente.</p>
      </div>
    </section>

    <div class="diary-layout">
      <section class="diary-days" aria-label="Giornate del diario">
        <div class="diary-days-head"><span>Data</span><span>Totale kcal <small>(stima)</small></span><span>Attendibilità</span><span>Note</span></div>
        <div class="diary-day-list">${days.length?days.map(day=>renderDayRow(day,day.date===selected?.date)).join(""):'<p class="diary-no-analysis">Nessuna giornata registrata.</p>'}</div>
      </section>
      ${renderSelected(selected)}
    </div>
  </div>`;
}

export function bindDiary(root,model,onSelect){
  root.querySelectorAll("[data-diary-date]").forEach(button=>button.addEventListener("click",()=>{
    onSelect?.(button.dataset.diaryDate);
  }));
}
