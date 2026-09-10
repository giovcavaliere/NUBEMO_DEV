// NUBEMO 4.0 DEV — login centrale Supabase -> area per ruolo.
(() => {
  const client = window.nubemoSupabase;
  const form = document.getElementById('nubemo-login-form');
  const email = document.getElementById('login-email');
  const password = document.getElementById('login-password');
  const submit = document.getElementById('login-submit');
  const message = document.getElementById('login-message');

  const statusLabel = { active: 'Attivo', suspended: 'Sospeso', disabled: 'Disabilitato' };

  function setMessage(text, isError = false) {
    message.textContent = text || '';
    message.classList.toggle('is-error', isError);
  }

  function setBusy(busy) {
    submit.disabled = busy;
    submit.textContent = busy ? 'Accesso…' : 'Accedi';
  }

  async function loadOwnProfile() {
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) throw new Error('Sessione non valida.');
    const { data, error } = await client.from('profiles')
      .select('id,auth_user_id,first_name,last_name,email,role,status')
      .eq('auth_user_id', user.id).single();
    if (error || !data) throw new Error('Profilo NUBEMO non disponibile per questo account.');
    return data;
  }

  function routeProfile(profile) {
    if (profile.status !== 'active') {
      setMessage(`Account ${statusLabel[profile.status] || profile.status}. Accesso a NUBEMO non consentito.`, true);
      return;
    }
    if (profile.role === 'admin') return window.location.replace('admin.html');
    if (profile.role === 'professional') return window.location.replace('pro.html');
    if (profile.role === 'patient') return window.location.replace('patient.html');
    setMessage('Ruolo NUBEMO non riconosciuto.', true);
  }

  async function restoreSession() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    try { routeProfile(await loadOwnProfile()); }
    catch (error) { await client.auth.signOut(); setMessage(error.message, true); }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault(); setMessage(''); setBusy(true);
    try {
      const { error } = await client.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
      if (error) throw error;
      routeProfile(await loadOwnProfile());
      password.value = '';
    } catch (error) {
      setMessage(error.message === 'Invalid login credentials' ? 'Email o password non corretti.' : error.message, true);
    } finally { setBusy(false); }
  });

  restoreSession();
})();
