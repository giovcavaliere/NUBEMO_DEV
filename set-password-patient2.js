// NUBEMO 2.0 DEV — impostazione password dedicata agli inviti pazienti.
(() => {
  const client = window.nubemoSupabase;
  const loading = document.getElementById('set-password-loading');
  const invalidView = document.getElementById('set-password-invalid');
  const invalidMessage = document.getElementById('set-password-invalid-message');
  const passwordView = document.getElementById('set-password-view');
  const successView = document.getElementById('set-password-success');
  const form = document.getElementById('set-password-form');
  const password = document.getElementById('new-password');
  const confirmPassword = document.getElementById('confirm-password');
  const submit = document.getElementById('set-password-submit');
  const message = document.getElementById('set-password-message');
  const backLogin = document.getElementById('set-password-back-login');
  const successLogin = document.getElementById('set-password-login');

  const entry = window.nubemoSetPasswordEntry || { search: '', hash: '' };
  const entryRaw = `${entry.search || ''}${entry.hash || ''}`;

  function hasAuthRedirectMarker() {
    return /(?:^|[?&#])(access_token|refresh_token|code|token_hash|type|error|error_code|error_description)=/i.test(entryRaw);
  }

  function redirectErrorMessage() {
    const raw = `${entry.search || ''}&${(entry.hash || '').replace(/^#/, '')}`;
    const params = new URLSearchParams(raw.replace(/^\?/, ''));
    const description = params.get('error_description');
    return description ? decodeURIComponent(description.replace(/\+/g, ' ')) : '';
  }

  function showOnly(view) {
    loading.hidden = true;
    invalidView.hidden = view !== invalidView;
    passwordView.hidden = view !== passwordView;
    successView.hidden = view !== successView;
  }

  function showInvalid(text) {
    invalidMessage.textContent = text || 'Il link non è valido o è scaduto.';
    showOnly(invalidView);
  }

  function setMessage(text, isError = false) {
    message.textContent = text || '';
    message.classList.toggle('is-error', isError);
  }

  function setBusy(busy) {
    submit.disabled = busy;
    submit.textContent = busy ? 'Attivazione…' : 'Attiva account';
  }

  async function resolveAccessSession() {
    if (!hasAuthRedirectMarker()) {
      showInvalid('Apri questa pagina dal link ricevuto nell’email NUBEMO.');
      return;
    }

    const redirectError = redirectErrorMessage();
    if (redirectError) {
      showInvalid('Il link non è valido o è scaduto. Chiedi al tuo professionista un nuovo invito.');
      return;
    }

    const params = new URLSearchParams((entry.search || '').replace(/^\?/, ''));
    const tokenHash = params.get('token_hash');
    if (tokenHash) {
      if (params.get('type') !== 'recovery') {
        showInvalid('Tipo di collegamento non valido.');
        return;
      }
      const verified = await client.auth.verifyOtp({ token_hash:tokenHash, type:'recovery' });
      if (verified.error || !verified.data?.session) {
        showInvalid('Il collegamento è scaduto o già utilizzato. Richiedi un nuovo invito.');
        return;
      }
      window.history.replaceState(null, '', window.location.pathname);
    }
    const session = await waitForSession();
    if (!session) {
      showInvalid('Il link non è valido o è scaduto. Chiedi al tuo professionista un nuovo invito.');
      return;
    }

    showOnly(passwordView);
    password.focus();
  }

  async function waitForSession() {
    const first = await client.auth.getSession();
    if (first.data?.session) return first.data.session;

    return new Promise(resolve => {
      let settled = false;
      const timer = window.setTimeout(() => finish(null), 2500);
      const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
        if (session) finish(session);
      });

      function finish(session) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        listener.subscription.unsubscribe();
        resolve(session);
      }
    });
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('');

    if (password.value.length < 8) {
      setMessage('La password deve contenere almeno 8 caratteri.', true);
      password.focus();
      return;
    }

    if (password.value !== confirmPassword.value) {
      setMessage('Le due password non coincidono.', true);
      confirmPassword.focus();
      return;
    }

    setBusy(true);
    try {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) throw new Error('Sessione NUBEMO non valida.');

      const {data:profile,error:profileError}=await client.from("profiles").select("role,status").eq("auth_user_id",user.id).single();
      if(profileError||profile?.role!=="patient"||profile.status!=="active")throw new Error("Invito non valido per un account paziente.");
      const { error } = await client.auth.updateUser({ password: password.value });
      if (error) throw error;

      // Solo l'avvenuto aggiornamento password conclude l'attivazione NUBEMO.
      const completion = await client.rpc('nubemo_complete_own_activation');
      if (completion.error || !completion.data) throw new Error('Password aggiornata, ma attivazione NUBEMO non confermata. Non ripetere la procedura: richiedi assistenza.');

      password.value = '';
      confirmPassword.value = '';
      await client.auth.signOut();
      showOnly(successView);
    } catch (error) {
      setMessage(error?.message || 'Impossibile impostare la password. Riprova.', true);
    } finally {
      setBusy(false);
    }
  });

  backLogin.addEventListener('click', () => window.location.replace('index2.html'));
  successLogin.addEventListener('click', () => window.location.replace('index2.html'));

  resolveAccessSession().catch(() => {
    showInvalid('Il link non è valido o è scaduto. Chiedi al tuo professionista un nuovo invito.');
  });
})();
