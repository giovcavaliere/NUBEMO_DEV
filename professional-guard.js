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
      script.src = 'pro.js?v=nubemo40pro4c1';
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

      const { data: relationships, error: relationshipsError } = await client
        .from('professional_patients')
        .select('patient_id,status,started_at,ended_at')
        .eq('professional_id', professional.id)
        .neq('status', 'ended');
      if (relationshipsError) throw relationshipsError;

      const patientIds = (relationships || []).map(row => row.patient_id);
      let remotePatients = [];
      if (patientIds.length) {
        const { data: patientRows, error: patientsError } = await client
          .from('patients')
          .select('id,profile_id,birth_date,sex,height_cm,pathway_start_date,status')
          .in('id', patientIds);
        if (patientsError) throw patientsError;

        const profileIds = (patientRows || []).map(row => row.profile_id);
        const { data: patientProfiles, error: patientProfilesError } = await client
          .from('profiles')
          .select('id,first_name,last_name,email,status')
          .in('id', profileIds);
        if (patientProfilesError) throw patientProfilesError;

        const profilesById = new Map((patientProfiles || []).map(row => [row.id, row]));
        const relationshipsByPatient = new Map((relationships || []).map(row => [row.patient_id, row]));
        remotePatients = (patientRows || []).map(row => ({
          ...row,
          profile: profilesById.get(row.profile_id) || null,
          relationship: relationshipsByPatient.get(row.id) || null
        }));
      }

      window.nubemoProfessionalContext = { user, profile, professional, logoData, patients: remotePatients };

      if (logoutButton) logoutButton.style.display = 'inline-flex';
      await loadProfessionalApp();
    } catch (error) {
      console.error('NUBEMO Professional guard:', error);
      showGuardError('Non è stato possibile verificare l’accesso. Torna al login e riprova.');
    }
  }

  authorize();
})();
