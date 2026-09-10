// NUBEMO 4.0 DEV — Area Professionista bootstrap
// Protegge l'Area Professionista con Supabase Auth e avvia i moduli solo dopo l'autorizzazione.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const app = document.getElementById('proApp');
  const logoutButton = document.getElementById('proLogoutBtn');

  function showGuardError(message) {
    if (!app) return;
    app.innerHTML = `<section class="card"><div class="eyebrow">NUBEMO PROFESSIONAL</div><h1>Accesso non consentito</h1><p>${message}</p><a href="./index.html">Torna al login</a></section>`;
  }
  function redirectToLogin() { window.location.replace('index.html'); }
  function loadScript(src, errorMessage) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(errorMessage));
      document.body.appendChild(script);
    });
  }
  async function logout() {
    if (logoutButton) logoutButton.disabled = true;
    try { await client.auth.signOut(); } finally { redirectToLogin(); }
  }
  window.nubemoProfessionalLogout = logout;
  logoutButton?.addEventListener('click', logout);

  async function authorize() {
    try {
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError || !session) return redirectToLogin();
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) return redirectToLogin();

      const { data: profile, error: profileError } = await client.from('profiles')
        .select('id,auth_user_id,role,status,first_name,last_name,email').eq('auth_user_id', user.id).single();
      if (profileError || !profile) {
        showGuardError('Profilo NUBEMO non disponibile per questo account.');
        setTimeout(redirectToLogin, 900); return;
      }
      if (profile.role !== 'professional' || profile.status !== 'active') return redirectToLogin();

      const { data: professional, error: professionalError } = await client.from('professionals')
        .select('id,profile_id,status,qualification,display_name,tax_code,vat_number,phone,address,zip,city,province,logo_storage_path')
        .eq('profile_id', profile.id).maybeSingle();
      if (professionalError || !professional) return showGuardError('Profilo professionale NUBEMO non disponibile.');

      let logoData = '';
      if (professional.logo_storage_path) {
        try {
          const { data: logoBlob, error: logoError } = await client.storage.from('professional-assets').download(professional.logo_storage_path);
          if (logoError) throw logoError;
          logoData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('Logo non leggibile'));
            reader.readAsDataURL(logoBlob);
          });
        } catch (logoError) { console.error('NUBEMO professional logo load:', logoError); }
      }

      await loadScript('professional-services.js?v=nubemo-profull1', 'Impossibile caricare i servizi dell’Area Professionista.');
      const services = window.nubemoProfessionalServices;
      if (!services) throw new Error('Servizi Area Professionista non inizializzati.');

      async function reloadProfessionalPatients() {
        const loaded = await services.loadPatients(professional.id);
        window.nubemoProfessionalContext.patients = loaded.activePatients;
        window.nubemoProfessionalContext.endedPatients = loaded.endedPatients;
        return loaded.activePatients;
      }
      const loadedPatients = await services.loadPatients(professional.id);
      window.nubemoProfessionalContext = { user, profile, professional, logoData, patients: loadedPatients.activePatients, endedPatients: loadedPatients.endedPatients };
      window.nubemoReloadProfessionalPatients = reloadProfessionalPatients;
      if (logoutButton) logoutButton.style.display = 'inline-flex';

      await loadScript('pro.js?v=nubemo40pro4c2a', 'Impossibile caricare l’Area Professionista.');
      await loadScript('professional-patients.js?v=nubemo-profull1', 'Impossibile caricare il modulo Pazienti.');
      await loadScript('professional-clinical.js?v=nubemo-profull1', 'Impossibile caricare il modulo Clinico.');
      await loadScript('professional-agenda.js?v=nubemo-profull1', 'Impossibile caricare il modulo Visite.');
      await loadScript('professional-pdf.js?v=nubemo-profull1', 'Impossibile caricare il modulo PDF.');
      window.nubemoProfessionalPatients?.syncView?.();
    } catch (error) {
      console.error('NUBEMO Professional guard:', error);
      showGuardError('Non è stato possibile verificare l’accesso. Torna al login e riprova.');
    }
  }
  authorize();
})();
