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
    const enabled = state.management?.version === 1 && state.management.enabled === true && !state.operation?.busy;
    const disabled = ' disabled title="Operazione non disponibile per lo stato attuale o backend non attivato"';
    const capacity = Number.isInteger(row.active_patient_count) ? esc(row.active_patient_count) + ' attivi / ' + (row.active_patient_limit === null ? 'non configurato' : esc(row.active_patient_limit)) + '<br><small>' + (row.available_patient_slots === null ? 'Posti non disponibili' : esc(row.available_patient_slots) + ' posti disponibili') + '</small>' : 'Non disponibile';
    return '<div class="admin-prof-row"><div class="admin-prof-person"><strong>' + esc(name(row)) + '</strong><small>' + esc(row.email) + '</small></div>' +
      '<div data-label="Account"><span class="admin-status ' + (row.account_status === 'active' ? 'positive' : 'warning') + '">' + esc(account(row.account_status)) + '</span></div>' +
      '<div data-label="Stato NUBEMO"><span class="admin-status ' + (row.nubemo_status === 'active' ? 'positive' : 'warning') + '">' + esc(status(row.nubemo_status)) + '</span></div>' +
      '<div data-label="Privacy"><span class="admin-status ' + (privacy === 'Accettata' ? 'positive' : 'neutral') + '">' + esc(privacy) + '</span></div>' +
      '<div data-label="Pazienti"><strong>' + capacity + '</strong></div>' +
      '<div class="admin-row-actions"><button type="button" data-admin-prof-detail="' + esc(row.professional_id) + '">Gestisci</button>' +
      (row.account_status === 'invited' ? '<button type="button" data-admin-prof-resend="' + esc(row.professional_id) + '"' + (enabled && row.can_resend ? '' : disabled) + '>Reinvia</button>' : '') +
      '<button type="button" data-admin-prof-toggle="' + esc(row.professional_id) + '"' + (enabled && (row.nubemo_status === 'suspended' ? row.can_activate : row.can_suspend) ? '' : disabled) + '>' +
      (row.nubemo_status === 'suspended' ? 'Riattiva' : 'Sospendi') + '</button></div></div>';
  }

  function create(root, onAction = () => {}) {
    const $ = selector => root.querySelector(selector);
    let state = null;
    let operation = { busy: false, message: '', error: false };
    let displayedDefault = null;
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
      host.innerHTML = selected.length ? selected.map(row => professionalMarkup(row, { ...state, operation })).join('') :
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
      root.querySelectorAll('[data-admin-connection]').forEach(element => { element.textContent = failures.length ? 'Dati parziali' : loading ? 'Caricamento…' : state.management?.enabled ? 'Gestione attiva' : 'Sola lettura'; });
      setText('[data-admin-platform-connection]', failures.length ? 'Lettura parziale' : loading ? 'Caricamento' : state.management?.enabled ? 'Supabase DEV · gestione attiva' : 'Supabase DEV · sola lettura');
      drawProfessionals();
      drawManagement();

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

    function available() { return state?.professionals.phase === 'ready' && state.management?.version === 1 && state.management.enabled === true; }
    function drawManagement() {
      const enabled = available() && !operation.busy;
      setText('[data-admin-mode]', available() ? 'Admin · gestione' : 'Admin · sola lettura');
      const invite = $('[data-admin-invite-open]');
      if (invite) { invite.disabled = !enabled; invite.title = enabled ? '' : 'Gestione non ancora disponibile o operazione in corso'; }
      const input = $('[data-admin-settings-form] input[name="defaultLimit"]');
      const save = $('[data-admin-settings-form] button[type="submit"]');
      if (input) {
        input.disabled = !enabled;
        const value = state?.management?.default_patient_limit ?? null;
        if (value !== displayedDefault) { input.value = value ?? ''; displayedDefault = value; }
      }
      if (save) save.disabled = !enabled;
      setText('[data-admin-settings-message]', available() ? 'Il valore viene assegnato ai nuovi professionisti. I limiti individuali già assegnati restano invariati.' : 'Gestione non ancora disponibile: è necessaria l’attivazione del backend.');
      setText('[data-admin-operation-message]', operation.message || (available() ? '' : 'Gestione professionisti non ancora disponibile. Elenco consultabile in sola lettura.'));
      root.querySelectorAll('[data-admin-modal-message]').forEach(element => {
        element.textContent = operation.message;
        element.classList.toggle('admin-modal-error', operation.error);
      });
      root.querySelectorAll('dialog [data-admin-modal-submit], dialog input').forEach(element => { element.disabled = !enabled; });
      root.querySelectorAll('dialog [data-admin-close]').forEach(element => { element.disabled = operation.busy; });
      root.querySelectorAll('dialog').forEach(dialog => dialog.setAttribute('aria-busy', String(operation.busy)));
      const feedback = $('[data-admin-operation-message]');
      if (feedback) feedback.setAttribute('role', operation.error ? 'alert' : 'status');
    }
    function setOperation(next) { operation = next; drawProfessionals(); drawManagement(); }
    function modal(title, content, submitLabel, submit) {
      closeDialogs();
      operation = { busy: false, message: '', error: false };
      const dialog = document.createElement('dialog');
      dialog.className = 'admin-modal';
      dialog.setAttribute('aria-label', title);
      dialog.innerHTML = '<h2>' + esc(title) + '</h2><form id="adminModalForm" class="admin-form">' + content +
        '<p data-admin-modal-message role="status" aria-live="polite"></p></form><footer><button class="admin-action-secondary" type="button" data-admin-close>Annulla</button>' +
        '<button class="admin-action-primary" type="submit" form="adminModalForm" data-admin-modal-submit>' + esc(submitLabel) + '</button></footer>';
      root.appendChild(dialog);
      dialog.querySelector('[data-admin-close]').addEventListener('click', () => { if (!operation.busy) dialog.close(); });
      dialog.addEventListener('cancel', event => { if (operation.busy) event.preventDefault(); });
      dialog.addEventListener('close', () => dialog.remove(), { once: true });
      dialog.querySelector('form').addEventListener('submit', event => {
        event.preventDefault();
        if (!available() || operation.busy || root.hidden) return;
        submit(new FormData(event.target));
      });
      drawManagement();
      dialog.showModal();
      return dialog;
    }
    function showDetail(row) {
      const known = Number.isInteger(row.active_patient_count);
      const dialog = modal('Gestisci professionista', '<p>' + esc(name(row)) + ' · ' + esc(row.email) +
        '</p><p>Account: ' + esc(account(row.account_status)) + '<br>Stato NUBEMO: ' + esc(status(row.nubemo_status)) +
        '<br>Stato professionista: ' + esc(status(row.professional_status)) + '</p><p>' +
        (known ? esc(row.associated_patient_count) + ' pazienti associati · ' + esc(row.active_patient_count) + ' attivi · ' + (row.available_patient_slots === null ? 'capacità non configurata' : esc(row.available_patient_slots) + ' posti disponibili') : 'Conteggio non disponibile nel backend attuale.') +
        '</p><label>Limite massimo di pazienti<input name="limit" type="number" min="1" max="100000" step="1" required value="' + esc(row.active_patient_limit ?? '') + '"></label>' +
        '<p data-admin-limit-note>Il limite riguarda i pazienti attivi. Nessun paziente viene eliminato quando il limite si riduce.</p>', 'Conferma',
        data => onAction('set-professional-limit', { professional_id: row.professional_id, limit: Number(data.get('limit')) }));
      const input = dialog.querySelector('input');
      const warning = () => { dialog.querySelector('[data-admin-limit-note]').textContent = known && input.value && Number(input.value) < row.active_patient_count ?
        'Il limite è inferiore ai pazienti attivi: nessun paziente verrà eliminato. Nuove aggiunte saranno bloccate finché non tornerà disponibile capacità.' :
        'Il limite riguarda i pazienti attivi. Nessun paziente viene eliminato quando il limite si riduce.'; };
      input.addEventListener('input', warning); warning();
    }
    function showInvite() {
      if (!available() || operation.busy) return;
      modal('Invita professionista', '<label>Nome<input name="first_name" autocomplete="given-name" maxlength="100" required></label>' +
        '<label>Cognome<input name="last_name" autocomplete="family-name" maxlength="100" required></label>' +
        '<label>Email<input name="email" type="email" autocomplete="email" maxlength="254" required></label>' +
        '<p>L’invito usa il flusso Auth NUBEMO esistente. Il limite generale viene assegnato alla creazione.</p>', 'Invia invito',
        data => onAction('invite-professional', Object.fromEntries(data.entries())));
    }
    function showSuspend(row) {
      modal('Sospendi professionista', '<p>Confermi la sospensione di ' + esc(name(row)) + '?</p><p>L’accesso operativo verrà bloccato. Pazienti, percorsi e documenti saranno conservati.</p>',
        'Conferma sospensione', () => onAction('suspend-professional', { professional_id: row.professional_id, confirmed: true }));
    }
    root.addEventListener('input', event => { if (event.target.matches('[data-admin-professional-search]')) drawProfessionals(); });
    root.addEventListener('change', event => { if (event.target.matches('[data-admin-professional-filter]')) drawProfessionals(); });
    root.addEventListener('click', event => {
      if (root.hidden || state?.professionals.phase !== 'ready' || operation.busy) return;
      const button = event.target.closest('[data-admin-prof-detail],[data-admin-prof-resend],[data-admin-prof-toggle],[data-admin-invite-open]');
      if (!button || button.disabled) return;
      if (button.hasAttribute('data-admin-invite-open')) { showInvite(); return; }
      const id = button.dataset.adminProfDetail || button.dataset.adminProfResend || button.dataset.adminProfToggle;
      const row = state.professionals.rows.find(item => item.professional_id === id);
      if (!row) return;
      if (button.dataset.adminProfDetail) { showDetail(row); return; }
      if (!available()) return;
      if (button.dataset.adminProfResend && row.can_resend) onAction('resend-professional-invite', { professional_id: id });
      if (button.dataset.adminProfToggle) {
        if (row.nubemo_status === 'suspended' && row.can_activate) onAction('activate-professional', { professional_id: id });
        else if (row.can_suspend) showSuspend(row);
      }
    });
    root.addEventListener('submit', event => {
      event.preventDefault();
      if (event.target.matches('[data-admin-settings-form]') && available() && !operation.busy && !root.hidden) {
        onAction('set-default-patient-limit', { limit: Number(new FormData(event.target).get('defaultLimit')) });
      }
    });

    function identity(profile) {
      setText('[data-admin-name]', [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email);
      setText('[data-admin-avatar]', [profile.first_name, profile.last_name].filter(Boolean).map(part => part[0]).join('').slice(0, 2).toLocaleUpperCase('it') || 'AD');
    }
    function clear() {
      closeDialogs();
      operation = { busy: false, message: '', error: false };
      displayedDefault = null;
      render({ professionals: { phase: 'loading', rows: [] }, privacy: { phase: 'loading', document: null }, consents: { phase: 'unavailable', rows: [] } });
      state = null;
      $('[data-admin-professional-list]').replaceChildren();
      setText('[data-admin-name]', 'Amministratore');
      setText('[data-admin-avatar]', 'AD');
    }
    return Object.freeze({ render, identity, clear, setOperation, closeDialogs });
  }

  window.NubemoAdminViews = Object.freeze({ create, summarize, filter, privacyLabel, professionalMarkup });
})();
