// NUBEMO recovery 3.98 — bootstrap Area Paziente
// Il frontend resta quello 3.98; Supabase gestisce autenticazione e contesto.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const app = document.getElementById('app');
  const logoutButton = document.getElementById('patientLogoutBtn');

  function backToLogin() {
    window.location.replace('index.html');
  }

  function showError(message) {
    if (!app) return;
    app.innerHTML = `
      <section class="card">
        <div class="eyebrow">NUBEMO PAZIENTE</div>
        <h1>Accesso non disponibile</h1>
        <p class="muted">${String(message || 'Impossibile aprire l’Area Paziente.')}</p>
        <button class="secondary" id="patientBackLogin" type="button">Torna all'accesso</button>
      </section>`;
    document.getElementById('patientBackLogin')?.addEventListener('click', backToLogin);
  }

  function loadPatientApp() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'app.js?v=nubemo398recovery2';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Impossibile caricare l’Area Paziente.'));
      document.body.appendChild(script);
    });
  }

  async function logout() {
    try {
      await client.auth.signOut();
    } finally {
      backToLogin();
    }
  }

  async function bootstrap() {
    try {
      if (!client || !window.nubemoPatientServices) {
        throw new Error('Servizi di accesso non disponibili.');
      }

      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) return backToLogin();

      const context = await window.nubemoPatientServices.loadContext();
      window.nubemoPatientContext = context;

      if (logoutButton) logoutButton.style.display = 'inline-flex';
      window.patientLogout = logout;

      // Frontend 3.98 originale: viene avviato solo dopo che Supabase ha
      // autenticato e autorizzato il paziente.
      await loadPatientApp();
    } catch (error) {
      console.error('NUBEMO Patient guard:', error);
      showError(error?.message);
    }
  }

  logoutButton?.addEventListener('click', logout);
  bootstrap();
})();
