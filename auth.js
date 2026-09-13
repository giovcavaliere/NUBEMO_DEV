// NUBEMO recovery 3.98 — Auth Supabase e instradamento alle aree
(() => {
  const client = window.nubemoSupabase;
  const form = document.getElementById('nubemo-login-form');
  const email = document.getElementById('login-email');
  const password = document.getElementById('login-password');
  const submit = document.getElementById('login-submit');
  const resetPassword = document.getElementById('login-reset-password');
  const message = document.getElementById('login-message');

  const statusLabel = { active: 'Attivo', suspended: 'Sospeso', disabled: 'Disabilitato' };

  function setMessage(text, isError = false) {
    if (!message) return;
    message.textContent = text || '';
    message.classList.toggle('is-error', isError);
  }

  function setBusy(busy) {
    if (!submit) return;
    submit.disabled = busy;
    submit.textContent = busy ? 'Accesso…' : 'Accedi';
  }

  function setResetBusy(busy) {
    if (!resetPassword) return;
    resetPassword.disabled = busy;
    resetPassword.textContent = busy ? 'Invio…' : 'Reimposta password';
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

  async function requiresPrivacyGate(profile) {
    if (!['professional','patient'].includes(profile.role)) return false;
    const { data: documentRow, error: documentError } = await client
      .from('privacy_documents')
      .select('id')
      .eq('document_type','nubemo')
      .eq('active', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (documentError) throw documentError;
    if (!documentRow?.id) return false;

    const { data: acceptance, error: acceptanceError } = await client
      .from('privacy_acceptances')
      .select('status')
      .eq('profile_id', profile.id)
      .eq('privacy_document_id', documentRow.id)
      .maybeSingle();
    if (acceptanceError) throw acceptanceError;
    return acceptance?.status !== 'accepted';
  }

  async function routeProfile(profile) {
    if (profile.status !== 'active') {
      setMessage(`Account ${statusLabel[profile.status] || profile.status}. Accesso a NUBEMO non consentito.`, true);
      return false;
    }

    if (profile.role === 'admin') {
      window.location.replace('admin.html');
      return true;
    }
    if (profile.role === 'professional' || profile.role === 'patient') {
      if (await requiresPrivacyGate(profile)) {
        window.location.replace('privacy.html');
        return true;
      }
      window.location.replace(profile.role === 'professional' ? 'pro.html' : 'patient.html');
      return true;
    }

    setMessage('Ruolo NUBEMO non riconosciuto.', true);
    return false;
  }

  async function restoreSession() {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) {
      setMessage(error.message, true);
      return;
    }
    if (!session) return;
    try {
      await routeProfile(await loadOwnProfile());
    } catch (error) {
      await client.auth.signOut();
      setMessage(error.message, true);
    }
  }

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    try {
      const { error } = await client.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value
      });
      if (error) throw error;
      const routed = await routeProfile(await loadOwnProfile());
      if (routed && password) password.value = '';
    } catch (error) {
      setMessage(error.message === 'Invalid login credentials' ? 'Email o password non corretti.' : error.message, true);
    } finally {
      setBusy(false);
    }
  });

  resetPassword?.addEventListener('click', async () => {
    const emailValue = email?.value.trim().toLowerCase() || '';
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setMessage('Inserisci un indirizzo email valido.', true);
      email?.focus();
      return;
    }

    setMessage('');
    setResetBusy(true);
    try {
      const redirectTo = new URL('set-password.html', window.location.href).href;
      const { error } = await client.auth.resetPasswordForEmail(emailValue, { redirectTo });
      if (error) throw error;
      setMessage('Se l’indirizzo è associato a un account utilizzabile, riceverai le istruzioni via email.');
    } catch (_) {
      setMessage('Non è stato possibile inviare le istruzioni. Riprova più tardi.', true);
    } finally {
      setResetBusy(false);
    }
  });

  restoreSession();
})();
