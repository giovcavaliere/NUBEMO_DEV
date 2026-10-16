// NUBEMO 2.0 — gate dedicato Warm Human per informativa corrente.
(() => {
  'use strict';
  const client = window.nubemoSupabase;
  const loading = document.getElementById('privacy-loading');
  const view = document.getElementById('privacy-view');
  const refusedView = document.getElementById('privacy-refused');
  const title = document.getElementById('privacy-title');
  const version = document.getElementById('privacy-version');
  const statusNote = document.getElementById('privacy-status-note');
  const openButton = document.getElementById('privacy-open');
  const readCheck = document.getElementById('privacy-read');
  const acceptButton = document.getElementById('privacy-accept');
  const refuseButton = document.getElementById('privacy-refuse');
  const message = document.getElementById('privacy-message');
  const backLogin = document.getElementById('privacy-back-login');

  let profile = null;
  let documentRow = null;
  let acceptance = null;
  let documentOpened = false;

  function showOnly(target) {
    loading.hidden = target !== loading;
    view.hidden = target !== view;
    refusedView.hidden = target !== refusedView;
  }

  function setMessage(text, isError = false) {
    message.textContent = text || '';
    message.classList.toggle('is-error', isError);
  }

  function routeArea(role) {
    if (role === 'professional') return window.location.replace('pro2.html');
    if (role === 'patient') return window.location.replace('patient2-live.html');
    if (role === 'admin') return window.location.replace('admin2.html');
    return window.location.replace('index2.html');
  }

  async function loadProfile() {
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return null;
    const { data, error } = await client.from('profiles')
      .select('id,auth_user_id,first_name,last_name,email,role,status,activation_completed_at')
      .eq('auth_user_id', user.id).single();
    if (error || !data) throw error || new Error('Profilo NUBEMO non disponibile.');
    return data;
  }

  async function loadPrivacyDocument() {
    const { data, error } = await client.from('privacy_documents')
      .select('id,document_type,version,title,storage_bucket,storage_path,published_at,active')
      .eq('document_type','nubemo')
      .eq('active', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function loadAcceptance(profileId, documentId) {
    const { data, error } = await client.from('privacy_acceptances')
      .select('id,profile_id,privacy_document_id,status,accepted_at,refused_at,created_at')
      .eq('profile_id', profileId)
      .eq('privacy_document_id', documentId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function saveStatus(status) {
    const { data, error } = await client.rpc('nubemo_submit_privacy_choice',{
      p_document: documentRow.id,
      p_accept: status === 'accepted'
    });
    if(error || data !== status) throw error || new Error('Registrazione della presa visione non confermata.');
    acceptance = { status };
    return data;
  }

  async function openPrivacy() {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      if (!popup) throw new Error('Consenti le finestre per NUBEMO e riprova ad aprire il PDF.');
      const { data, error } = await client.storage
        .from(documentRow.storage_bucket)
        .createSignedUrl(documentRow.storage_path, 300);
      if (error || !data?.signedUrl) throw error || new Error('Informativa non disponibile.');
      const opened = await client.rpc('nubemo_record_privacy_open',{p_document:documentRow.id});
      if(opened.error || !opened.data) throw opened.error || new Error('Apertura informativa non registrata.');
      popup.location.replace(data.signedUrl);
      documentOpened = true;
      readCheck.disabled = false;
      setMessage('Informativa aperta. Dopo averla letta, conferma la presa visione.');
    } catch (error) {
      try { popup?.close(); } catch (_) {}
      setMessage(error?.message || 'Non è stato possibile aprire l’informativa.', true);
    }
  }

  async function bootstrap() {
    try {
      if (!client) throw new Error('Servizio di accesso non disponibile.');
      profile = await loadProfile();
      if (!profile || profile.status !== 'active') return window.location.replace('index2.html');
      if (profile.role === 'patient' && !profile.activation_completed_at) { await client.auth.signOut({scope:'local'}); return window.location.replace('index2.html'); }
      if (profile.role === 'admin') return routeArea('admin');
      if (!['professional','patient'].includes(profile.role)) return window.location.replace('index2.html');

      documentRow = await loadPrivacyDocument();
      if (!documentRow) return routeArea(profile.role);

      acceptance = await loadAcceptance(profile.id, documentRow.id);
      if (acceptance?.status === 'accepted') return routeArea(profile.role);

      title.textContent = documentRow.title || 'Informativa privacy NUBEMO';
      version.textContent = documentRow.version ? `Versione ${documentRow.version}` : 'Versione attiva';
      statusNote.textContent = acceptance?.status === 'refused'
        ? 'Questa informativa era stata rifiutata in precedenza. Per accedere a NUBEMO deve essere letta e accettata.'
        : 'Apri l’informativa completa prima di proseguire.';
      readCheck.checked = false;
      readCheck.disabled = true;
      documentOpened = false;
      showOnly(view);
    } catch (error) {
      console.error('NUBEMO privacy gate:', error);
      await client?.auth?.signOut?.().catch(()=>{});
      window.location.replace('index2.html');
    }
  }

  openButton?.addEventListener('click', openPrivacy);
  acceptButton?.addEventListener('click', async () => {
    if (!documentOpened || !readCheck.checked) return setMessage('Apri prima il PDF e dichiara di aver letto l’informativa.', true);
    setMessage('Registrazione in corso…');
    acceptButton.disabled = true;
    refuseButton.disabled = true;
    try {
      await saveStatus('accepted');
      routeArea(profile.role);
    } catch (error) {
      setMessage(error?.message || 'Non è stato possibile registrare l’accettazione.', true);
      acceptButton.disabled = false;
      refuseButton.disabled = false;
    }
  });

  refuseButton?.addEventListener('click', async () => {
    acceptButton.disabled = true;
    refuseButton.disabled = true;
    setMessage('Registrazione in corso…');
    try {
      await saveStatus('refused');
      await client.auth.signOut();
      showOnly(refusedView);
    } catch (error) {
      setMessage(error?.message || 'Non è stato possibile registrare la scelta.', true);
      acceptButton.disabled = false;
      refuseButton.disabled = false;
    }
  });

  backLogin?.addEventListener('click', () => window.location.replace('index2.html'));
  bootstrap();
})();
