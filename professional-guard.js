// NUBEMO 4.0 DEV — Micro-step 4A
// Protegge l'Area Professionista con Supabase Auth e avvia pro.js solo dopo l'autorizzazione.
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

  function loadProfessionalApp() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'pro.js?v=nubemo40pro4b';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Impossibile caricare l’Area Professionista.'));
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
        .select('id,profile_id,status,qualification,display_name,tax_code,vat_number,phone,address,zip,city,province')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (professionalError || !professional) {
        showGuardError('Profilo professionale NUBEMO non disponibile.');
        return;
      }

      window.nubemoProfessionalContext = { user, profile, professional };

      if (logoutButton) logoutButton.style.display = 'inline-flex';
      await loadProfessionalApp();
    } catch (error) {
      console.error('NUBEMO Professional guard:', error);
      showGuardError('Non è stato possibile verificare l’accesso. Torna al login e riprova.');
    }
  }

  authorize();
})();
