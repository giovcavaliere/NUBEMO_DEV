// NUBEMO 4.0 — gate informativa privacy per Professionista e Paziente.
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
    if (role === 'professional') return window.location.replace('pro.html');
    if (role === 'patient') return window.location.replace('patient.html');
    if (role === 'admin') return window.location.replace('admin.html');
    return window.location.replace('index.html');
  }

  async function loadProfile() {
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return null;
    const { data, error } = await client.from('profiles')
      .select('id,auth_user_id,first_name,last_name,email,role,status')
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
    const now = new Date().toISOString();
    const payload = {
      profile_id: profile.id,
      privacy_document_id: documentRow.id,
      status,
      accepted_at: status === 'accepted' ? now : null,
      refused_at: status === 'refused' ? (acceptance?.refused_at || now) : (acceptance?.refused_at || null)
    };
    const { data, error } = await client.from('privacy_acceptances')
      .upsert(payload, { onConflict: 'profile_id,privacy_document_id' })
      .select('id,profile_id,privacy_document_id,status,accepted_at,refused_at,created_at')
      .single();
    if (error) throw error;
    acceptance = data;
    return data;
  }

  async function openPrivacy() {
    const popup = window.open('about:blank', '_blank');
    try {
      const { data, error } = await client.storage
        .from(documentRow.storage_bucket)
        .createSignedUrl(documentRow.storage_path, 300);
      if (error || !data?.signedUrl) throw error || new Error('Informativa non disponibile.');
      if (popup) popup.location.replace(data.signedUrl);
      else window.location.href = data.signedUrl;
    } catch (error) {
      try { popup?.close(); } catch (_) {}
      setMessage(error?.message || 'Non è stato possibile aprire l’informativa.', true);
    }
  }

  async function bootstrap() {
    try {
      if (!client) throw new Error('Servizio di accesso non disponibile.');
      profile = await loadProfile();
      if (!profile || profile.status !== 'active') return window.location.replace('index.html');
      if (profile.role === 'admin') return routeArea('admin');
      if (!['professional','patient'].includes(profile.role)) return window.location.replace('index.html');

      documentRow = await loadPrivacyDocument();
      if (!documentRow) return routeArea(profile.role);

      acceptance = await loadAcceptance(profile.id, documentRow.id);
      if (acceptance?.status === 'accepted') return routeArea(profile.role);

      title.textContent = documentRow.title || 'Informativa privacy NUBEMO';
      version.textContent = documentRow.version ? `Versione ${documentRow.version}` : 'Versione attiva';
      statusNote.textContent = acceptance?.status === 'refused'
        ? 'Questa informativa era stata rifiutata in precedenza. Per accedere a NUBEMO deve essere letta e accettata.'
        : 'Apri l’informativa completa prima di proseguire.';
      showOnly(view);
    } catch (error) {
      console.error('NUBEMO privacy gate:', error);
      await client?.auth?.signOut?.().catch(()=>{});
      window.location.replace('index.html');
    }
  }

  openButton?.addEventListener('click', openPrivacy);
  acceptButton?.addEventListener('click', async () => {
    if (!readCheck.checked) return setMessage('Apri e leggi l’informativa, poi conferma la presa visione.', true);
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

  backLogin?.addEventListener('click', () => window.location.replace('index.html'));
  bootstrap();
})();
