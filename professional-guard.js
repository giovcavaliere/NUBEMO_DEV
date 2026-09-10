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
      await window.nubemoProfessionalLegacyAdapter?.flush?.();
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

      await loadScript(
        'professional-services.js?v=nubemo398recovery7',
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

      // Il bridge prepara la stessa struttura dati sincrona che la 3.98 si aspetta,
      // ma la mantiene solo in memoria e la sincronizza con Supabase.
      await loadScript(
        'professional-legacy-supabase-adapter.js?v=nubemo398recovery7',
        'Impossibile preparare i dati dell’Area Professionista.'
      );
      if (!window.nubemoProfessionalLegacyAdapter) throw new Error('Adattatore dati PRO non inizializzato.');
      await window.nubemoProfessionalLegacyAdapter.init(window.nubemoProfessionalContext);

      if (logoutButton) logoutButton.style.display = 'inline-flex';

      // Unico owner del frontend: motore NUBEMO 3.98 verificato.
      // Nessun modulo successivo modifica il DOM dopo il render.
      await loadScript(
        'pro.js?v=nubemo398recovery7',
        'Impossibile caricare l’Area Professionista.'
      );
    } catch (error) {
      console.error('NUBEMO Professional guard:', error);
      showGuardError('Non è stato possibile verificare l’accesso. Torna al login e riprova.');
    }
  }

  authorize();
})();
