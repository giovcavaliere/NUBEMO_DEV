// Admin 2.0 — avvio protetto, navigazione baseline e coordinamento delle sole letture.
(() => {
  'use strict';
  const root = document.querySelector('.admin2');
  const gate = document.querySelector('[data-admin-access]');
  if (!root || !gate) return;
  const message = gate.querySelector('[data-admin-access-message]');
  const retry = gate.querySelector('[data-admin-access-retry]');
  const logoutRetry = gate.querySelector('[data-admin-logout]');
  let services;
  let views;
  let generation = 0;
  let verifiedUserId = null;
  let state = null;
  let loadPromise = null;
  let accessPromise = null;
  let scheduledCheck = null;
  let signingOut = false;
  let logoutBlocked = false;
  let pageAway = false;
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
    clearTimeout(scheduledCheck);
    scheduledCheck = null;
    loadPromise = null;
    accessPromise = null;
    generation++;
    root.hidden = true;
    gate.hidden = false;
    gate.setAttribute('aria-busy', 'false');
    message.textContent = text;
    retry.hidden = !canRetry;
    logoutRetry.hidden = true;
    verifiedUserId = null;
    state = null;
    views?.clear();
  }

  function load() {
    if (logoutBlocked || pageAway) return;
    if (loadPromise) return loadPromise;
    if (accessPromise) return accessPromise;
    const task = loadData().finally(() => { if (loadPromise === task) loadPromise = null; });
    loadPromise = task;
    return task;
  }

  async function loadData() {
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

  // Al ritorno o al rinnovo Auth verifica l'accesso, senza rileggere l'elenco.
  function checkAccess() {
    if (logoutBlocked || pageAway) return;
    if (loadPromise) return loadPromise;
    if (accessPromise) return accessPromise;
    if (!state) return load();
    const current = generation;
    root.hidden = true;
    gate.hidden = false;
    gate.setAttribute('aria-busy', 'true');
    message.textContent = 'Verifica accesso Admin…';
    retry.hidden = true;
    const task = (async () => {
      try {
        const access = await services.verifyAccess();
        if (current !== generation) return;
        if (access.user.id !== verifiedUserId) {
          lock('La sessione è cambiata. Riprova la verifica accesso.', true);
          return;
        }
        views.identity(access.profile);
        gate.hidden = true;
        root.hidden = false;
      } catch (error) {
        if (current === generation) lock(error.message || 'Verifica accesso non disponibile.', error.name !== 'AdminAccessError');
      } finally {
        if (current === generation) gate.setAttribute('aria-busy', 'false');
      }
    })().finally(() => { if (accessPromise === task) accessPromise = null; });
    accessPromise = task;
    return task;
  }

  function scheduleAccessCheck() {
    if (logoutBlocked || pageAway || loadPromise || accessPromise || scheduledCheck !== null) return;
    // Fuori dal callback sincrono Auth; accorpa gli eventi della stessa ripresa.
    scheduledCheck = setTimeout(() => { scheduledCheck = null; void checkAccess(); }, 0);
  }

  async function logout() {
    if (signingOut) return;
    signingOut = true;
    logoutBlocked = true;
    lock('Disconnessione in corso…');
    gate.setAttribute('aria-busy', 'true');
    try {
      await services.signOut();
      window.location.replace('index.html');
    } catch (_) {
      message.textContent = 'Disconnessione non riuscita. I dati Admin restano nascosti. Riprova il logout.';
      gate.setAttribute('aria-busy', 'false');
      logoutRetry.hidden = false;
    } finally { signingOut = false; }
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
    if (event.target.closest('[data-admin-logout]')) { void logout(); return; }
    const go = event.target.closest('[data-admin-goto]');
    if (go) { location.hash = go.dataset.adminGoto; route(go.dataset.adminGoto); }
    if (event.target.closest('[data-admin-retry],[data-admin-data-retry]')) void load();
    if (event.target.closest('[data-admin-privacy-preview]')) void openPrivacy();
  });
  retry.addEventListener('click', () => void load());
  logoutRetry.addEventListener('click', () => void logout());
  window.addEventListener('hashchange', () => route(location.hash.slice(1)));
  window.addEventListener('pagehide', () => { pageAway = true; lock('Verifica accesso Admin…'); });
  window.addEventListener('pageshow', event => { pageAway = false; if (event.persisted) scheduleAccessCheck(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleAccessCheck();
  });

  try {
    services = window.NubemoAdminServices.create(window.nubemoSupabase);
    services.onAuthChange((event, session) => {
      if (logoutBlocked) return;
      if (event === 'SIGNED_OUT' || (verifiedUserId && session?.user?.id !== verifiedUserId)) {
        lock('La sessione non è più disponibile. Accedi nuovamente.');
        if (event === 'SIGNED_OUT') return;
      }
      // Il callback Auth resta sincrono: le letture sono eseguite fuori dal lock del client.
      if (event === 'SIGNED_IN' && (!verifiedUserId || session?.user?.id !== verifiedUserId)) scheduleAccessCheck();
      if (['TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) scheduleAccessCheck();
    });
  } catch (_) { /* load() presenta l’errore nel gate, senza mostrare dati. */ }
  void load();
})();
