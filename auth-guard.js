// NUBEMO 4.0 DEV — auth guard Area Admin + gestione essenziale professionisti.
// Il contenuto resta nascosto finché sessione e ruolo Admin non sono verificati via RLS.
(() => {
  const client = window.nubemoSupabase;
  const loading = document.getElementById('admin-loading');
  const content = document.getElementById('admin-content');
  const identity = document.getElementById('admin-identity');
  const logout = document.getElementById('admin-logout');

  const professionalsList = document.getElementById('admin-professionals-list');
  const professionalsMessage = document.getElementById('admin-professionals-message');
  const inviteToggle = document.getElementById('admin-invite-toggle');
  const invitePanel = document.getElementById('admin-invite-panel');
  const inviteForm = document.getElementById('admin-invite-form');
  const inviteFirstName = document.getElementById('admin-invite-first-name');
  const inviteLastName = document.getElementById('admin-invite-last-name');
  const inviteEmail = document.getElementById('admin-invite-email');
  const inviteSubmit = document.getElementById('admin-invite-submit');
  const inviteCancel = document.getElementById('admin-invite-cancel');
  const inviteMessage = document.getElementById('admin-invite-message');

  function returnToLogin() {
    window.location.replace('index.html');
  }

  async function loadOwnProfile(userId) {
    const { data, error } = await client
      .from('profiles')
      .select('id,auth_user_id,first_name,last_name,email,role,status')
      .eq('auth_user_id', userId)
      .single();

    if (error || !data) throw new Error('Profilo NUBEMO non disponibile.');
    return data;
  }

  function showAdmin(profile) {
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
    identity.innerHTML = '';

    const name = document.createElement('strong');
    name.textContent = fullName || profile.email;
    const role = document.createElement('span');
    role.textContent = 'Ruolo: Admin';
    const status = document.createElement('span');
    status.textContent = 'Stato: Attivo';

    identity.append(name, role, status);
    loading.hidden = true;
    content.hidden = false;
  }

  function setProfessionalsMessage(text, isError = false) {
    professionalsMessage.textContent = text || '';
    professionalsMessage.classList.toggle('is-error', isError);
  }

  function accountStatusLabel(value) {
    return value === 'active' ? 'Attivo' : 'Invito inviato';
  }

  function nubemoStatusLabel(value) {
    if (value === 'suspended') return 'Sospeso';
    if (value === 'disabled') return 'Disabilitato';
    return 'Attivo';
  }

  function renderProfessionals(rows) {
    professionalsList.innerHTML = '';

    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-professional-empty';
      empty.textContent = 'Nessun professionista presente.';
      professionalsList.append(empty);
      return;
    }

    rows.forEach((row) => {
      const card = document.createElement('article');
      card.className = 'admin-professional-row';

      const copy = document.createElement('div');
      copy.className = 'admin-professional-copy';

      const name = document.createElement('strong');
      name.textContent = [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email;

      const email = document.createElement('span');
      email.textContent = row.email;

      const accountStatus = document.createElement('span');
      accountStatus.className = 'admin-professional-status-line';
      accountStatus.textContent = `Account: ${accountStatusLabel(row.account_status)}`;

      const nubemoStatus = document.createElement('span');
      nubemoStatus.className = 'admin-professional-status-line';
      nubemoStatus.textContent = `NUBEMO: ${nubemoStatusLabel(row.nubemo_status)}`;

      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'secondary admin-professional-action';
      action.dataset.professionalId = row.professional_id;
      action.dataset.action = row.nubemo_status === 'suspended' ? 'activate-professional' : 'suspend-professional';
      action.textContent = row.nubemo_status === 'suspended' ? 'Riattiva' : 'Sospendi';
      if (row.nubemo_status === 'disabled') action.hidden = true;

      copy.append(name, email, accountStatus, nubemoStatus);
      card.append(copy, action);
      professionalsList.append(card);
    });
  }

  async function invokeAdminAction(body) {
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError || !session?.access_token) throw new Error('Sessione Admin non disponibile.');

    const { data, error } = await client.functions.invoke('swift-endpoint', {
      body,
      headers: { Authorization: `Bearer ${session.access_token}` }
    });

    if (error || !data?.ok) throw new Error(data?.error || 'Operazione non completata.');
    return data;
  }

  async function loadProfessionals() {
    setProfessionalsMessage('Caricamento professionisti…');

    try {
      const data = await invokeAdminAction({ action: 'list-professionals' });
      renderProfessionals(Array.isArray(data.professionals) ? data.professionals : []);
      setProfessionalsMessage('');
    } catch (error) {
      setProfessionalsMessage(error?.message || 'Impossibile caricare i professionisti.', true);
    }
  }

  async function changeProfessionalStatus(button) {
    const professionalId = button.dataset.professionalId;
    const action = button.dataset.action;
    if (!professionalId || !action) return;

    button.disabled = true;
    setProfessionalsMessage(action === 'suspend-professional' ? 'Sospensione in corso…' : 'Riattivazione in corso…');

    try {
      await invokeAdminAction({ action, professional_id: professionalId });
      await loadProfessionals();
    } catch (error) {
      setProfessionalsMessage(error?.message || 'Operazione non completata.', true);
      button.disabled = false;
    }
  }

  function setInviteOpen(open) {
    invitePanel.hidden = !open;
    inviteToggle.setAttribute('aria-expanded', String(open));
    if (open) inviteFirstName.focus();
  }

  function setInviteMessage(text, isError = false) {
    inviteMessage.textContent = text || '';
    inviteMessage.classList.toggle('is-error', isError);
  }

  async function inviteProfessional(event) {
    event.preventDefault();

    const firstName = inviteFirstName.value.trim();
    const lastName = inviteLastName.value.trim();
    const email = inviteEmail.value.trim().toLowerCase();

    if (!firstName || !lastName || !email) {
      setInviteMessage('Nome, cognome ed email sono obbligatori.', true);
      return;
    }

    inviteSubmit.disabled = true;
    setInviteMessage('Invio dell\'invito in corso…');

    try {
      await invokeAdminAction({
        action: 'invite-professional',
        first_name: firstName,
        last_name: lastName,
        email
      });

      inviteForm.reset();
      setInviteMessage('Invito inviato. Professionista creato correttamente.');
      await loadProfessionals();
    } catch (error) {
      setInviteMessage(error?.message || 'Invito non completato.', true);
    } finally {
      inviteSubmit.disabled = false;
    }
  }

  async function verifyAdminAccess() {
    try {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) {
        returnToLogin();
        return;
      }

      const profile = await loadOwnProfile(user.id);
      if (profile.status !== 'active' || profile.role !== 'admin') {
        returnToLogin();
        return;
      }

      showAdmin(profile);
      await loadProfessionals();
    } catch (_) {
      returnToLogin();
    }
  }

  inviteToggle.addEventListener('click', () => setInviteOpen(invitePanel.hidden));
  inviteCancel.addEventListener('click', () => {
    inviteForm.reset();
    setInviteMessage('');
    setInviteOpen(false);
  });
  inviteForm.addEventListener('submit', inviteProfessional);
  professionalsList.addEventListener('click', (event) => {
    const button = event.target.closest('.admin-professional-action');
    if (button) changeProfessionalStatus(button);
  });

  logout.addEventListener('click', async () => {
    await client.auth.signOut();
    returnToLogin();
  });

  verifyAdminAccess();
})();
