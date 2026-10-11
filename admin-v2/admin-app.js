// Admin 2.0 — avvio protetto, navigazione baseline e coordinamento delle sole letture.
(() => {
  'use strict';
  const root = document.querySelector('.admin2');
  const gate = document.querySelector('[data-admin-access]');
  if (!root || !gate) return;
  const message = gate.querySelector('[data-admin-access-message]');
  const retry = gate.querySelector('[data-admin-access-retry]');
  let services;
  let views;
  let generation = 0;
  let verifiedUserId = null;
  let state = null;
  const valid = ['dashboard', 'professionisti', 'privacy', 'impostazioni'];

  function route(name) {
    const selected = valid.includes(name) ? name : 'dashboard';
    root.querySelectorAll('[data-admin-view]').forEach(element => { element.hidden = element.dataset.adminView !== selected; });
    root.querySelectorAll('[data-admin-route]').forEach(link => {
      const active = link.dataset.adminRoute === selected;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
  }

  function lock(text, canRetry = false) {
    generation++;
    root.hidden = true;
    gate.hidden = false;
    gate.setAttribute('aria-busy', 'false');
    message.textContent = text;
    retry.hidden = !canRetry;
    verifiedUserId = null;
    state = null;
    views?.clear();
  }

  async function load() {
    lock('Verifica accesso Admin…');
    gate.setAttribute('aria-busy', 'true');
    const current = generation;
    try {
      if (!window.NubemoAdminServices || !window.NubemoAdminViews) throw new Error('Servizio Admin non disponibile. Riprova o ricarica la pagina.');
      if (!services) services = window.NubemoAdminServices.create(window.nubemoSupabase);
      if (!views) views = window.NubemoAdminViews.create(root);
      const access = await services.verifyAccess();
      if (current !== generation) return;
      verifiedUserId = access.user.id;
      state = {
        professionals: { phase: 'loading', rows: [] },
        privacy: { phase: 'loading', document: null },
        consents: { phase: 'loading', rows: [] }
      };
      views.identity(access.profile);
      views.render(state);
      route(location.hash.slice(1));
      gate.hidden = true;
      root.hidden = false;
      root.setAttribute('aria-busy', 'true');
      const reads = [
        ['professionals', () => services.listProfessionals(), 'rows'],
        ['privacy', () => services.loadCurrentPrivacy(), 'document']
      ];
      await Promise.all(reads.map(async ([key, read, field]) => {
        try {
          const result = await read();
          if (current !== generation) return;
          state[key] = { phase: 'ready', [field]: result };
        } catch (error) {
          if (current !== generation) return;
          if (error.name === 'AdminAccessError') { lock(error.message); return; }
          state[key] = { phase: 'error', message: error.message, [field]: field === 'rows' ? [] : null };
        }
        if (current === generation) views.render(state);
      }));
      if (current !== generation) return;
      if (state.professionals.phase === 'ready' && state.privacy.phase === 'ready') {
        try {
          const rows = await services.loadAcceptances(state.privacy.document?.id, state.professionals.rows.map(row => row.profile_id));
          if (current !== generation) return;
          state.consents = { phase: 'ready', rows };
        } catch (error) {
          if (current !== generation) return;
          state.consents = { phase: 'error', rows: [], message: error.message };
        }
      } else { state.consents = { phase: 'unavailable', rows: [] }; }
      if (current !== generation) return;
      root.setAttribute('aria-busy', 'false');
      views.render(state);
    } catch (error) {
      if (current !== generation) return;
      lock(error.message || 'Servizio di accesso non disponibile.', error.name !== 'AdminAccessError');
    }
  }

  async function openPrivacy() {
    const doc = state?.privacy.document;
    if (root.hidden || state?.privacy.phase !== 'ready' || !doc) return;
    const current = generation;
    const button = root.querySelector('[data-admin-privacy-preview]');
    const note = root.querySelector('[data-admin-privacy-message]');
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    button.disabled = true;
    try {
      // Ricontrolla il ruolo prima di generare il link del documento.
      const access = await services.verifyAccess();
      if (current === generation && access.user.id !== verifiedUserId) {
        popup?.close();
        lock('La sessione è cambiata. Riprova la verifica accesso.', true);
        return;
      }
      if (current !== generation) { popup?.close(); return; }
      const url = await services.createPrivacyUrl(doc);
      if (current !== generation) { popup?.close(); return; }
      if (popup) popup.location.replace(url); else window.location.assign(url);
    } catch (error) {
      popup?.close();
      if (current !== generation) return;
      if (error.name === 'AdminAccessError') lock(error.message);
      else note.textContent = error.message;
    } finally { if (current === generation) button.disabled = false; }
  }

  root.addEventListener('click', event => {
    if (root.hidden) return;
    const go = event.target.closest('[data-admin-goto]');
    if (go) { location.hash = go.dataset.adminGoto; route(go.dataset.adminGoto); }
    if (event.target.closest('[data-admin-retry],[data-admin-data-retry]')) void load();
    if (event.target.closest('[data-admin-privacy-preview]')) void openPrivacy();
  });
  retry.addEventListener('click', () => void load());
  window.addEventListener('hashchange', () => route(location.hash.slice(1)));
  window.addEventListener('pagehide', () => lock('Verifica accesso Admin…'));
  window.addEventListener('pageshow', event => { if (event.persisted) void load(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void load(); });

  try {
    services = window.NubemoAdminServices.create(window.nubemoSupabase);
    services.onAuthChange((event, session) => {
      if (event === 'SIGNED_OUT' || (verifiedUserId && session?.user?.id !== verifiedUserId)) {
        lock('La sessione non è più disponibile. Accedi nuovamente.');
      }
      // Il callback Auth resta sincrono: le letture sono eseguite fuori dal lock del client.
      if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
        lock('Verifica accesso Admin…');
        setTimeout(() => void load(), 0);
      }
    });
  } catch (_) { /* load() presenta l’errore nel gate, senza mostrare dati. */ }
  void load();
})();
