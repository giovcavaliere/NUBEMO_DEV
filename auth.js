// NUBEMO 4.0 DEV — micro-step Auth: login -> profilo proprio (RLS) -> ruolo/stato.
(() => {
  const client = window.nubemoSupabase;
  const form = document.getElementById('nubemo-login-form');
  const email = document.getElementById('login-email');
  const password = document.getElementById('login-password');
  const submit = document.getElementById('login-submit');
  const message = document.getElementById('login-message');
  const loginView = document.getElementById('login-view');
  const successView = document.getElementById('login-success');
  const identity = document.getElementById('login-identity');
  const logout = document.getElementById('login-logout');

  const roleLabel = { admin: 'Admin', professional: 'Professionista', patient: 'Paziente' };
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

    const { data, error } = await client
      .from('profiles')
      .select('id,auth_user_id,first_name,last_name,email,role,status')
      .eq('auth_user_id', user.id)
      .single();

    if (error || !data) throw new Error('Profilo NUBEMO non disponibile per questo account.');
    return data;
  }

  function showProfile(profile) {
    if (profile.status !== 'active') {
      setMessage(`Account ${statusLabel[profile.status] || profile.status}. Accesso a NUBEMO non consentito.`, true);
      return;
    }

    if (profile.role === 'admin') {
      window.location.replace('admin.html');
      return;
    }

    if (profile.role === 'professional') {
      window.location.replace('pro.html');
      return;
    }

    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
    identity.innerHTML = '';
    const name = document.createElement('strong');
    name.textContent = fullName || profile.email;
    const role = document.createElement('span');
    role.textContent = `Ruolo: ${roleLabel[profile.role] || profile.role}`;
    const status = document.createElement('span');
    status.textContent = `Stato: ${statusLabel[profile.status] || profile.status}`;
    identity.append(name, role, status);
    loginView.hidden = true;
    successView.hidden = false;
    setMessage('');
  }

  async function restoreSession() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    try {
      showProfile(await loadOwnProfile());
    } catch (error) {
      await client.auth.signOut();
      setMessage(error.message, true);
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    try {
      const { error } = await client.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value
      });
      if (error) throw error;
      showProfile(await loadOwnProfile());
      password.value = '';
    } catch (error) {
      setMessage(error.message === 'Invalid login credentials' ? 'Email o password non corretti.' : error.message, true);
    } finally {
      setBusy(false);
    }
  });

  logout.addEventListener('click', async () => {
    await client.auth.signOut();
    successView.hidden = true;
    loginView.hidden = false;
    form.reset();
    setMessage('');
    email.focus();
  });

  restoreSession();
})();
