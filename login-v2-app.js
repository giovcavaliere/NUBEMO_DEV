// NUBEMO 2.0 — presentazione login e navigazione, senza nuova infrastruttura Auth.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('nubemo-login-form');
  if (!form) return;
  const email = $('login-email'), password = $('login-password'), submit = $('login-submit');
  const loginView = $('login-view'), unavailable = $('login-success'), logoutButton = $('login-logout');
  const toggle = $('login-password-toggle');
  let services;
  let generation = 0;
  let busy = false;
  let leaving = false;
  let loggingOut = false;
  function message(text = '', error = false) {
    for (const id of ['login-message', 'login-state-message']) {
      $(id).textContent = text;
      $(id).classList.toggle('is-error', error);
    }
  }
  function setBusy(value) {
    busy = value;
    form.setAttribute('aria-busy', String(value));
    email.disabled = password.disabled = submit.disabled = toggle.disabled = logoutButton.disabled = value;
    submit.textContent = value ? 'Accesso…' : 'Accedi';
  }
  function concealPassword() {
    password.type = 'password';
    toggle.setAttribute('aria-label', 'Mostra password');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.querySelector('[data-password-eye="show"]').hidden = false;
    toggle.querySelector('[data-password-eye="hide"]').hidden = true;
  }
  function showLogin() {
    loginView.hidden = false;
    unavailable.hidden = true;
    $('login-area-role').textContent = '';
    password.value = '';
    concealPassword();
  }
  function present(profile) {
    password.value = '';
    concealPassword();
    if (!profile) { showLogin(); return; }
    if (profile.role === 'admin') {
      leaving = true;
      window.location.replace('admin2.html');
      return;
    }
    if (profile.role === 'professional') {\n      leaving = true;\n      window.location.replace('pro2.html');\n      return;\n    }\n    // Il percorso paziente 2.0 viene attivato separatamente.
    loginView.hidden = true;
    unavailable.hidden = false;
    $('login-area-role').textContent = profile.role === 'professional' ? 'Professionista' : 'Paziente';
    message('La tua identità è verificata. L’area del tuo ruolo non è ancora disponibile in questo punto di accesso 2.0.');
  }
  async function access(read) {
    if (busy || leaving) return;
    const current = ++generation;
    setBusy(true);
    message();
    try {
      const profile = await read();
      if (current === generation) present(profile);
    } catch (error) {
      if (current !== generation) return;
      showLogin();
      message(error.message || 'Accesso non disponibile. Riprova.', true);
    } finally { if (current === generation && !leaving) setBusy(false); }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!services) return;
    void access(() => services.login(email.value, password.value));
  });
  toggle.addEventListener('click', () => {
    const reveal = password.type === 'password';
    password.type = reveal ? 'text' : 'password';
    toggle.setAttribute('aria-label', reveal ? 'Nascondi password' : 'Mostra password');
    toggle.setAttribute('aria-pressed', String(reveal));
    toggle.querySelector('[data-password-eye="show"]').hidden = reveal;
    toggle.querySelector('[data-password-eye="hide"]').hidden = !reveal;
    password.focus({ preventScroll: true });
  });
  logoutButton.addEventListener('click', async () => {
    if (busy || !services) return;
    const current = ++generation;
    loggingOut = true;
    setBusy(true);
    message('Disconnessione in corso…');
    try {
      await services.signOut();
      if (current === generation) { showLogin(); message('Sessione terminata.'); }
    } catch (error) {
      if (current === generation) message(error.message || 'Disconnessione non riuscita. Riprova.', true);
    } finally { loggingOut = false; if (current === generation) setBusy(false); }
  });
  window.addEventListener('pagehide', () => {
    generation++;
    leaving = true;
    showLogin();
    message();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { leaving = false; setBusy(false); if (services) void access(() => services.restore()); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && services && !loggingOut) void access(() => services.restore());
  });
  try {
    services = window.NubemoAuthV2.create(window.nubemoSupabase);
    services.onAuthChange(event => {
      if (event === 'SIGNED_OUT' && !loggingOut) {
        // Durante la verifica di accesso, il servizio può chiudere la sessione
        // di un account sospeso. Lascia al catch il messaggio specifico.
        if (busy) return;
        generation++;
        showLogin();
        message('Sessione terminata.');
        setBusy(false);
      }
    });
    void access(() => services.restore());
  } catch (_) {
    setBusy(true);
    submit.textContent = 'Accesso non disponibile';
    message('Servizio di accesso non disponibile. Ricarica la pagina.', true);
  }
})();
