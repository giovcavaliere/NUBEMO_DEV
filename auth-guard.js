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
    return value === 'active' ? 'Attivo' : 'Invito da completare';
  }

  function nubemoStatusLabel(value) {
    if (value === 'suspended') return 'Sospeso';
    if (value === 'disabled') return 'Disabilitato';
    return 'Attivo';
  }

  function privacyStatusLabel(value) {
    if (value === 'accepted') return 'Accettata';
    if (value === 'refused') return 'Rifiutata';
    if (value === 'not_published') return 'Nessuna informativa';
    return 'Da accettare';
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

      const privacyStatus = document.createElement('span');
      privacyStatus.className = 'admin-professional-status-line';
      privacyStatus.textContent = `Privacy: ${privacyStatusLabel(row.privacy_status)}`;
      if (row.privacy_status === 'accepted' && row.privacy_accepted_at) {
        privacyStatus.title = `Accettata il ${new Date(row.privacy_accepted_at).toLocaleDateString('it-IT')}${row.privacy_version ? ` · versione ${row.privacy_version}` : ''}`;
      }

      const actions = document.createElement('div');
      actions.className = 'admin-professional-actions';

      if (row.account_status === 'invited') {
        const resend = document.createElement('button');
        resend.type = 'button';
        resend.className = 'secondary admin-professional-resend';
        resend.dataset.professionalId = row.professional_id;
        resend.textContent = 'Reinvia invito';
        actions.append(resend);
      }

      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'secondary admin-professional-action';
      action.dataset.professionalId = row.professional_id;
      action.dataset.action = row.nubemo_status === 'suspended' ? 'activate-professional' : 'suspend-professional';
      action.textContent = row.nubemo_status === 'suspended' ? 'Riattiva' : 'Sospendi';
      if (row.nubemo_status !== 'disabled') actions.append(action);

      copy.append(name, email, accountStatus, nubemoStatus, privacyStatus);
      card.append(copy, actions);
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

  async function enrichPrivacy(rows) {
    if (!rows.length) return rows;
    const { data: documentRow, error: documentError } = await client.from('privacy_documents')
      .select('id,version')
      .eq('document_type','nubemo')
      .eq('active',true)
      .order('published_at',{ascending:false,nullsFirst:false})
      .order('created_at',{ascending:false})
      .limit(1)
      .maybeSingle();
    if (documentError) throw documentError;
    if (!documentRow?.id) return rows.map(row => ({...row,privacy_status:'not_published',privacy_version:null,privacy_accepted_at:null}));

    const profileIds = rows.map(row => row.profile_id).filter(Boolean);
    if (!profileIds.length) return rows;
    const { data: acceptances, error: acceptanceError } = await client.from('privacy_acceptances')
      .select('profile_id,status,accepted_at,refused_at')
      .eq('privacy_document_id',documentRow.id)
      .in('profile_id',profileIds);
    if (acceptanceError) throw acceptanceError;
    const map = new Map((acceptances || []).map(row => [row.profile_id,row]));
    return rows.map(row => {
      const acceptance = map.get(row.profile_id);
      return {
        ...row,
        privacy_status: acceptance?.status || 'pending',
        privacy_version: documentRow.version || null,
        privacy_accepted_at: acceptance?.accepted_at || null
      };
    });
  }

  async function loadProfessionals() {
    setProfessionalsMessage('Caricamento professionisti…');

    try {
      const data = await invokeAdminAction({ action: 'list-professionals' });
      const baseRows = Array.isArray(data.professionals) ? data.professionals : [];
      renderProfessionals(await enrichPrivacy(baseRows));
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

  async function resendProfessionalInvite(button) {
    const professionalId = button.dataset.professionalId;
    if (!professionalId) return;

    button.disabled = true;
    setProfessionalsMessage('Reinvio invito in corso…');
    try {
      await invokeAdminAction({ action:'resend-professional-invite', professional_id:professionalId });
      setProfessionalsMessage('Invito reinviato.');
      await loadProfessionals();
    } catch (error) {
      setProfessionalsMessage(error?.message || 'Impossibile reinviare l’invito.', true);
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
    const resendButton = event.target.closest('.admin-professional-resend');
    if (resendButton) {
      resendProfessionalInvite(resendButton);
      return;
    }
    const button = event.target.closest('.admin-professional-action');
    if (button) changeProfessionalStatus(button);
  });

  logout.addEventListener('click', async () => {
    await client.auth.signOut();
    returnToLogin();
  });

  verifyAdminAccess();
})();
