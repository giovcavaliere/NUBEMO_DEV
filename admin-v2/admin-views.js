// Admin 2.0 — presentazione sulla baseline approvata; nessuna chiamata Supabase.
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const name = row => [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || 'Professionista';
  const status = value => ({ active: 'Attivo', suspended: 'Sospeso', disabled: 'Disabilitato' }[value] || 'Non disponibile');
  const account = value => ({ active: 'Attivo', invited: 'Invitato' }[value] || 'Non disponibile');

  function summarize(rows) {
    return {
      total: rows.length,
      active: rows.filter(p => p.account_status === 'active' && p.nubemo_status === 'active' && p.professional_status === 'active').length,
      invited: rows.filter(p => p.account_status === 'invited').length,
      suspended: rows.filter(p => p.nubemo_status === 'suspended' || p.professional_status === 'suspended').length
    };
  }

  function filter(rows, query = '', state = 'all') {
    const text = query.trim().toLocaleLowerCase('it');
    return rows.filter(p => (state === 'all' || p.nubemo_status === state) &&
      (name(p) + ' ' + (p.email || '')).toLocaleLowerCase('it').includes(text));
  }

  function privacyLabel(row, state) {
    if (state.privacy.phase !== 'ready') return 'Non disponibile';
    if (!state.privacy.document) return 'Nessuna informativa';
    if (state.consents.phase !== 'ready') return 'Non disponibile';
    const acceptance = state.consents.rows.find(item => item.profile_id === row.profile_id);
    return acceptance ? ({ accepted: 'Accettata', refused: 'Rifiutata' }[acceptance.status] || 'Non disponibile') : 'In attesa';
  }

  function professionalMarkup(row, state) {
    const privacy = privacyLabel(row, state);
    const disabled = ' disabled title="Operazione non ancora attivata: area in sola lettura"';
    return '<div class="admin-prof-row"><div class="admin-prof-person"><strong>' + esc(name(row)) + '</strong><small>' + esc(row.email) + '</small></div>' +
      '<div data-label="Account"><span class="admin-status ' + (row.account_status === 'active' ? 'positive' : 'warning') + '">' + esc(account(row.account_status)) + '</span></div>' +
      '<div data-label="Stato NUBEMO"><span class="admin-status ' + (row.nubemo_status === 'active' ? 'positive' : 'warning') + '">' + esc(status(row.nubemo_status)) + '</span></div>' +
      '<div data-label="Privacy"><span class="admin-status ' + (privacy === 'Accettata' ? 'positive' : 'neutral') + '">' + esc(privacy) + '</span></div>' +
      '<div data-label="Pazienti"><strong>Non disponibile</strong></div>' +
      '<div class="admin-row-actions"><button type="button" data-admin-prof-detail="' + esc(row.professional_id) + '">Gestisci</button>' +
      (row.account_status === 'invited' ? '<button type="button" data-admin-prof-resend="' + esc(row.professional_id) + '"' + disabled + '>Reinvia</button>' : '') +
      '<button type="button" data-admin-prof-toggle="' + esc(row.professional_id) + '"' + disabled + '>' +
      (row.nubemo_status === 'suspended' ? 'Riattiva' : 'Sospendi') + '</button></div></div>';
  }

  function create(root) {
    const $ = selector => root.querySelector(selector);
    let state = null;
    const setText = (selector, text) => { const element = $(selector); if (element) element.textContent = text; };

    function drawProfessionals() {
      if (!state) return;
      const source = state.professionals;
      const host = $('[data-admin-professional-list]');
      host.setAttribute('aria-busy', String(source.phase === 'loading'));
      if (source.phase !== 'ready') {
        host.innerHTML = '<div class="admin-prof-empty">' + esc(source.phase === 'loading' ? 'Caricamento professionisti…' : source.message) +
          (source.phase === 'error' ? '<p><button type="button" class="admin-action-secondary" data-admin-retry>Riprova</button></p>' : '') + '</div>';
        return;
      }
      const selected = filter(source.rows, $('[data-admin-professional-search]').value, $('[data-admin-professional-filter]').value);
      host.innerHTML = selected.length ? selected.map(row => professionalMarkup(row, state)).join('') :
        '<div class="admin-prof-empty">' + (source.rows.length ? 'Nessun professionista corrisponde ai filtri.' : 'Nessun professionista presente.') + '</div>';
    }

    function render(next) {
      state = next;
      const ready = state.professionals.phase === 'ready';
      const kpi = ready ? summarize(state.professionals.rows) : null;
      ['total', 'active', 'invited', 'suspended'].forEach(key => setText('[data-admin-kpi="' + key + '"]', kpi ? String(kpi[key]) : '—'));
      setText('[data-admin-invites-priority]', kpi ? (kpi.invited === 1 ? '1 invito in attesa' : kpi.invited + ' inviti in attesa') : 'Inviti: dati non disponibili');
      const failures = [state.professionals, state.privacy, state.consents].filter(item => item.phase === 'error');
      const loading = [state.professionals, state.privacy, state.consents].some(item => item.phase === 'loading');
      setText('[data-admin-data-message]', failures.map(item => item.message).join(' '));
      $('[data-admin-data-message]').hidden = !failures.length;
      $('[data-admin-data-retry]').hidden = !failures.length;
      root.querySelectorAll('[data-admin-connection]').forEach(element => { element.textContent = failures.length ? 'Dati parziali' : loading ? 'Caricamento…' : 'Sola lettura'; });
      setText('[data-admin-platform-connection]', failures.length ? 'Lettura parziale' : loading ? 'Caricamento' : 'Supabase DEV · sola lettura');
      drawProfessionals();

      const privacy = state.privacy;
      const doc = privacy.document;
      const active = privacy.phase === 'ready' && !!doc;
      setText('[data-admin-privacy-title]', active ? doc.title : privacy.phase === 'loading' ? 'Caricamento informativa…' : privacy.phase === 'error' ? 'Informativa non disponibile' : 'Nessuna informativa pubblicata');
      const date = doc?.published_at ? new Date(doc.published_at) : null;
      const published = date && !Number.isNaN(date.getTime()) ? ' · ' + date.toLocaleDateString('it-IT') : '';
      setText('[data-admin-privacy-version]', active ? 'Versione ' + (doc.version || '—') + published : '—');
      const badge = $('[data-admin-privacy-state]');
      badge.textContent = active ? 'Attiva' : privacy.phase === 'loading' ? 'Caricamento' : privacy.phase === 'error' ? 'Non disponibile' : 'Non pubblicata';
      badge.className = 'admin-status ' + (active ? 'positive' : 'neutral');
      $('[data-admin-privacy-preview]').disabled = !active;
      setText('[data-admin-privacy-message]', privacy.phase === 'error' ? privacy.message : 'Consultazione in sola lettura dell’informativa NUBEMO.');
    }

    function closeDialogs() { root.querySelectorAll('dialog').forEach(dialog => { if (dialog.open) dialog.close(); dialog.remove(); }); }

    function showDetail(row) {
      closeDialogs();
      const dialog = document.createElement('dialog');
      dialog.className = 'admin-modal';
      dialog.setAttribute('aria-label', 'Gestisci professionista');
      dialog.innerHTML = '<h2>Gestisci professionista</h2><form id="adminModalForm" class="admin-form"><p>' + esc(name(row)) + ' · ' + esc(row.email) +
        '</p><p>Account: ' + esc(account(row.account_status)) + '<br>Stato NUBEMO: ' + esc(status(row.nubemo_status)) +
        '<br>Stato professionista: ' + esc(status(row.professional_status)) + '</p><label>Limite massimo di pazienti<input name="limit" type="number" disabled placeholder="Non disponibile"></label>' +
        '<p>Conteggio e limite pazienti non sono disponibili nel servizio attuale. Le modifiche non sono ancora attivate.</p></form>' +
        '<footer><button class="admin-action-secondary" type="button" data-admin-close>Annulla</button><button class="admin-action-primary" type="submit" form="adminModalForm" disabled>Conferma</button></footer>';
      root.appendChild(dialog);
      dialog.querySelector('[data-admin-close]').addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => dialog.remove(), { once: true });
      dialog.showModal();
    }

    root.addEventListener('input', event => { if (event.target.matches('[data-admin-professional-search]')) drawProfessionals(); });
    root.addEventListener('change', event => { if (event.target.matches('[data-admin-professional-filter]')) drawProfessionals(); });
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-admin-prof-detail]');
      if (!button || root.hidden || state?.professionals.phase !== 'ready') return;
      const row = state.professionals.rows.find(item => item.professional_id === button.dataset.adminProfDetail);
      if (row) showDetail(row);
    });
    // Protegge anche gli invii programmatici: nessun modulo produce scritture o simulazioni.
    root.addEventListener('submit', event => event.preventDefault());

    function identity(profile) {
      setText('[data-admin-name]', [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email);
      setText('[data-admin-avatar]', [profile.first_name, profile.last_name].filter(Boolean).map(part => part[0]).join('').slice(0, 2).toLocaleUpperCase('it') || 'AD');
    }
    function clear() {
      closeDialogs();
      render({ professionals: { phase: 'loading', rows: [] }, privacy: { phase: 'loading', document: null }, consents: { phase: 'unavailable', rows: [] } });
      state = null;
      $('[data-admin-professional-list]').replaceChildren();
      setText('[data-admin-name]', 'Amministratore');
      setText('[data-admin-avatar]', 'AD');
    }
    return Object.freeze({ render, identity, clear });
  }

  window.NubemoAdminViews = Object.freeze({ create, summarize, filter, privacyLabel, professionalMarkup });
})();
