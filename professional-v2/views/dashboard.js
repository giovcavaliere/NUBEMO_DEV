function agendaItems(items){
  if(!items.length)return '<div class="empty-state">Nessun appuntamento nelle prossime ore.</div>';
  return items.map(item=>`
    <div class="agenda-item">
      <div class="agenda-time">${item.time}</div>
      <div class="agenda-main"><strong>${item.title}</strong><span>${item.subtitle||''}</span></div>
      <span class="agenda-type ${item.personal?'personal':''}">${item.type}</span>
    </div>`).join('');
}

function priority(label,count,key){
  return `<button class="priority-item" type="button" data-priority="${key}">
    <span class="priority-label"><span class="priority-dot"></span>${label}</span>
    <span class="priority-count">${count}</span>
  </button>`;
}

export function renderDashboard(state){
  const {kpis,agenda,priorities}=state.dashboard;
  return `
    <header class="pro2-topbar">
      <div class="pro2-title">
        <h1>Buongiorno, ${state.professional.name}</h1>
        <p>Una vista semplice su ciò che conta oggi.</p>
      </div>
      <label class="pro2-search">
        <input type="search" placeholder="Cerca paziente..." aria-label="Cerca paziente">
      </label>
    </header>

    <section class="kpi-grid" aria-label="Riepilogo di oggi">
      <article class="kpi-card"><span>Pazienti attivi</span><strong>${kpis.activePatients}</strong><small>percorsi in corso</small></article>
      <article class="kpi-card"><span>Nuovi pazienti del mese</span><strong>${kpis.newPatientsMonth}</strong><small>nuove anagrafiche</small></article>
      <article class="kpi-card"><span>Prime visite oggi</span><strong>${kpis.firstVisitsToday}</strong><small>agenda di oggi</small></article>
      <article class="kpi-card"><span>Controlli oggi</span><strong>${kpis.controlsToday}</strong><small>agenda di oggi</small></article>
    </section>

    <section class="dashboard-grid">
      <article class="panel agenda-panel">
        <div class="panel-head">
          <div><h2>Agenda</h2><p>Appuntamenti nelle prossime 2 ore.</p></div>
          <button class="panel-link" type="button" data-route="agenda">Apri agenda</button>
        </div>
        <div class="agenda-list">${agendaItems(agenda)}</div>
      </article>

      <article class="panel priority-panel">
        <div class="panel-head"><div><h2>Priorità</h2><p>Elementi che richiedono attenzione.</p></div></div>
        <div class="priority-list">
          ${priority('Referti da leggere',priorities.unreadLabs,'unreadLabs')}
          ${priority('Pazienti senza diario da 7 gg',priorities.noDiary7Days,'noDiary7Days')}
          ${priority('Inviti in attesa',priorities.pendingInvites,'pendingInvites')}
          ${priority('Bozze da completare',priorities.drafts,'drafts')}
        </div>
      </article>
    </section>

    <section class="pro2-banner" aria-label="NUBEMO">
      <div>
        <h3>Ogni percorso è fatto di giorni.</h3>
        <p>NUBEMO tiene insieme il lavoro tra una visita e l'altra, lasciando al professionista più spazio per le persone.</p>
      </div>
    </section>
  `;
}