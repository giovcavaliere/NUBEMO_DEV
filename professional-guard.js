// NUBEMO recovery 3.98 — bootstrap Area Professionista
// Il frontend resta quello 3.98; Supabase è il livello dati/infrastruttura.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const app = document.getElementById('proApp');
  const logoutButton = document.getElementById('proLogoutBtn');

  function showGuardError(message) {
    if (!app) return;
    app.innerHTML = `<section class="card"><div class="eyebrow">NUBEMO PROFESSIONAL</div><h1>Accesso non consentito</h1><p>${message}</p><a href="./index.html">Torna al login</a></section>`;
  }

  function redirectToLogin() {
    window.location.replace('index.html');
  }

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
    try {
      await client.auth.signOut();
    } finally {
      redirectToLogin();
    }
  }

  window.nubemoProfessionalLogout = logout;
  logoutButton?.addEventListener('click', logout);

  async function authorize() {
    try {
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError || !session) {
        redirectToLogin();
        return;
      }

      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) {
        redirectToLogin();
        return;
      }

      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('id,auth_user_id,role,status,first_name,last_name,email')
        .eq('auth_user_id', user.id)
        .single();

      if (profileError || !profile) {
        showGuardError('Profilo NUBEMO non disponibile per questo account.');
        setTimeout(redirectToLogin, 900);
        return;
      }

      if (profile.role !== 'professional' || profile.status !== 'active') {
        redirectToLogin();
        return;
      }

      const { data: professional, error: professionalError } = await client
        .from('professionals')
        .select('id,profile_id,status,qualification,display_name,tax_code,vat_number,phone,address,zip,city,province,logo_storage_path')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (professionalError || !professional) {
        showGuardError('Profilo professionale NUBEMO non disponibile.');
        return;
      }

      let logoData = '';
      if (professional.logo_storage_path) {
        try {
          const { data: logoBlob, error: logoError } = await client.storage
            .from('professional-assets')
            .download(professional.logo_storage_path);
          if (logoError) throw logoError;
          logoData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('Logo non leggibile'));
            reader.readAsDataURL(logoBlob);
          });
        } catch (logoError) {
          console.error('NUBEMO professional logo load:', logoError);
        }
      }

      // Carica soltanto il livello servizi. Nessun modulo nuovo deve sostituire
      // il DOM della 3.98: pro.js resta owner del frontend.
      await loadScript(
        'professional-services.js?v=nubemo398recovery1',
        'Impossibile caricare i servizi Supabase dell’Area Professionista.'
      );
      const services = window.nubemoProfessionalServices;
      if (!services) throw new Error('Servizi Supabase Area Professionista non inizializzati.');

      const loaded = await services.loadPatients(professional.id);
      window.nubemoProfessionalContext = {
        user,
        profile,
        professional,
        logoData,
        patients: loaded.activePatients,
        endedPatients: loaded.endedPatients
      };

      window.nubemoReloadProfessionalPatients = async () => {
        const loadedPatients = await services.loadPatients(professional.id);
        window.nubemoProfessionalContext.patients = loadedPatients.activePatients;
        window.nubemoProfessionalContext.endedPatients = loadedPatients.endedPatients;
        return loadedPatients.activePatients;
      };

      if (logoutButton) logoutButton.style.display = 'inline-flex';

      // Frontend 3.98 originale.
      await loadScript(
        'pro.js?v=nubemo40pro4c2a',
        'Impossibile caricare l’Area Professionista.'
      );

      // Estensione già presente nella baseline: gestione anagrafica/percorso.
      await loadScript(
        'professional-patient-management.js?v=nubemo40pro4c2b',
        'Impossibile caricare la gestione pazienti.'
      );
    } catch (error) {
      console.error('NUBEMO Professional guard:', error);
      showGuardError('Non è stato possibile verificare l’accesso. Torna al login e riprova.');
    }
  }

  authorize();
})();
