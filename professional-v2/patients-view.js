const STATUS_LABELS = {
  active:"Attivi",
  pending:"In attesa",
  draft:"Draft",
  terminated:"Terminati"
};

const STATUS_NOTE = {
  active:"percorsi in corso",
  pending:"inviti non ancora accettati",
  draft:"anagrafiche da completare",
  terminated:"percorsi conclusi"
};

function escapeHtml(value=""){
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
}

export function getCounts(records){
  return Object.keys(STATUS_LABELS).reduce((acc,status)=>{
    acc[status]=records.filter(patient=>patient.status===status).length;
    return acc;
  },{});
}

export function getPatientsForStatus(records,status){
  const result=records.filter(patient=>patient.status===status);
  // Regola funzionale approvata: SOLO gli attivi sono ordinati per created_at,
  // dal più recente al più vecchio. Gli altri stati conservano l'ordine sorgente.
  if(status==="active"){
    return [...result].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  }
  return result;
}

export function renderPatientsPage(root,{records,status="active",query="",documentsOnly=false}){
  const counts=getCounts(records);
  const normalized=query.trim().toLocaleLowerCase("it");
  const rows=getPatientsForStatus(records,status).filter(patient=>{
    const matchesName=!normalized || `${patient.first_name} ${patient.last_name}`.toLocaleLowerCase("it").includes(normalized);
    const matchesDocuments=!documentsOnly || Number(patient.unreadDocuments||0)>0;
    return matchesName && matchesDocuments;
  });

  root.innerHTML=`
    <div class="patients-page">
      <header class="patients-head">
        <div>
          <h1>Pazienti</h1>
          <p>Gestisci i percorsi e trova rapidamente il paziente che cerchi.</p>
        </div>
        <button class="patient-new" type="button" data-new-patient>
          <svg class="icon" aria-hidden="true"><use href="#icon-plus"/></svg>
          Nuovo paziente
        </button>
      </header>

      <section class="patient-counts" aria-label="Riepilogo pazienti">
        ${Object.entries(STATUS_LABELS).map(([key,label])=>`
          <article class="patient-count-card">
            <span>${label}</span>
            <strong>${counts[key] ?? 0}</strong>
            <small>${STATUS_NOTE[key]}</small>
          </article>
        `).join("")}
      </section>

      <section class="patient-list-card">
        <nav class="patient-tabs" aria-label="Stato pazienti">
          ${Object.entries(STATUS_LABELS).map(([key,label])=>`
            <button type="button" class="patient-tab ${status===key?"active":""}" data-patient-status="${key}">
              ${label}<span class="patient-tab-count">${counts[key] ?? 0}</span>
            </button>
          `).join("")}
        </nav>

        <div class="patient-tools">
          <label class="patient-search-list">
            <svg class="icon" aria-hidden="true"><use href="#icon-search"/></svg>
            <input type="search" value="${escapeHtml(query)}" placeholder="Cerca per nome e cognome..." aria-label="Cerca paziente per nome e cognome" data-patient-search>
          </label>
          <button type="button" class="patient-doc-filter ${documentsOnly?"active":""}" data-documents-filter aria-pressed="${documentsOnly}">
            <span class="patient-doc-toggle" aria-hidden="true"><span></span></span>
            <span>Solo con documenti da leggere</span>
          </button>
        </div>

        <div class="patient-list">
          ${rows.length ? rows.map(patient=>`
            <button type="button" class="patient-row" data-patient-id="${patient.id}">
              <img class="patient-avatar" src="${escapeHtml(patient.avatar)}" alt="">
              <span class="patient-main">
                <strong>${escapeHtml(patient.first_name)} ${escapeHtml(patient.last_name)}</strong>
                <span class="patient-age">${escapeHtml(String(patient.age))} anni</span>
                <span class="patient-mobile-meta">
                  <b>${escapeHtml(patient.weight)}</b>
                  ${patient.weightDelta && patient.weightDelta!=="—" ? `<em class="${String(patient.weightDelta).startsWith("+")?"up":"down"}">${escapeHtml(patient.weightDelta)}</em>` : ""}
                  ${status==="active" ? `<i>Prossima visita: ${escapeHtml(patient.nextVisit || "—")}</i>` : ""}
                </span>
              </span>
              <span class="patient-meta patient-weight">
                <small>Peso attuale</small>
                <strong>${escapeHtml(patient.weight)}</strong>
                <em class="${String(patient.weightDelta).startsWith("+")?"up":"down"}">${escapeHtml(patient.weightDelta || "—")}</em>
              </span>
              <span class="patient-meta">
                <small>${status==="active"?"Prossima visita":"Stato percorso"}</small>
                <strong>${status==="active"?escapeHtml(patient.nextVisit || "—"):escapeHtml(STATUS_LABELS[patient.status])}</strong>
              </span>
              <span class="patient-arrow">›</span>
            </button>
          `).join("") : '<div class="patient-empty">Nessun paziente trovato.</div>'}
        </div>
      </section>
    </div>
  `;
}
