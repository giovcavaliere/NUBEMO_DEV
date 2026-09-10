// NUBEMO — Area Paziente / Auth + bootstrap
(() => {
  'use strict';
  const client = window.nubemoSupabase;
  const app = document.getElementById('app');
  const logout = document.getElementById('patientLogoutBtn');

  function backToLogin() { window.location.replace('index.html'); }
  function showError(message) {
    app.innerHTML = `<section class="card"><div class="eyebrow">NUBEMO PAZIENTE</div><h1>Accesso non disponibile</h1><p class="muted">${String(message || 'Impossibile aprire l’area paziente.')}</p><button class="secondary" id="patientBackLogin">Torna all'accesso</button></section>`;
    document.getElementById('patientBackLogin')?.addEventListener('click', backToLogin);
  }

  async function bootstrap() {
    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session) return backToLogin();
      const context = await window.nubemoPatientServices.loadContext();
      window.nubemoPatientContext = context;
      if (logout) logout.style.display = 'inline-flex';
      await window.nubemoPatientApp.init(context);
    } catch (error) {
      console.error(error);
      showError(error?.message);
    }
  }

  if (logout) logout.addEventListener('click', async () => { await client.auth.signOut(); backToLogin(); });
  bootstrap();
})();
