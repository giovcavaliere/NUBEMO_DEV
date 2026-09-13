// NUBEMO 4.0 DEV — pubblicazione centralizzata Privacy NUBEMO.
(() => {
  'use strict';
  const client = window.nubemoSupabase;
  const content = document.getElementById('admin-content');
  if (!client || !content) return;

  let mounted = false;
  const esc = (value='') => String(value)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');

  async function verifyAdmin() {
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return null;
    const { data: profile, error } = await client.from('profiles')
      .select('id,role,status').eq('auth_user_id', user.id).single();
    if (error || !profile || profile.role !== 'admin' || profile.status !== 'active') return null;
    return { user, profile };
  }

  async function loadDocs() {
    const { data, error } = await client.from('privacy_documents')
      .select('id,document_type,version,title,storage_bucket,storage_path,published_at,active,created_at')
      .eq('document_type','nubemo')
      .order('created_at',{ascending:false});
    if (error) throw error;
    return data || [];
  }

  async function openDoc(row) {
    const popup = window.open('about:blank','_blank');
    try {
      const { data, error } = await client.storage.from(row.storage_bucket).createSignedUrl(row.storage_path,300);
      if (error || !data?.signedUrl) throw error || new Error('URL non disponibile');
      if (popup) popup.location.replace(data.signedUrl);
      else window.location.href = data.signedUrl;
    } catch (error) {
      try { popup?.close(); } catch (_) {}
      alert('Non è stato possibile aprire l’informativa.');
    }
  }

  async function render() {
    const host = document.getElementById('adminPrivacySection');
    if (!host) return;
    host.innerHTML = '<p class="nubemo-login-message">Caricamento privacy NUBEMO…</p>';
    try {
      const docs = await loadDocs();
      const active = docs.find(d => d.active) || null;
      host.innerHTML = `
        <div class="admin-section-head admin-privacy-head">
          <div>
            <div class="eyebrow">DOCUMENTO CENTRALE</div>
            <h1 class="admin-privacy-title">Privacy NUBEMO</h1>
            <p>Pubblica la versione dell'informativa richiesta a professionisti e pazienti al login.</p>
          </div>
          ${active ? `<span class="admin-privacy-state">Attiva · ${esc(active.version)}</span>` : '<span class="admin-privacy-state">Nessuna versione attiva</span>'}
        </div>
        ${active ? `<div class="admin-privacy-current"><div><strong>${esc(active.title)}</strong><span>Versione ${esc(active.version)} · Pubblicata ${active.published_at ? new Date(active.published_at).toLocaleString('it-IT') : '—'}</span></div><button id="adminPrivacyOpen" class="secondary" type="button">Apri PDF</button></div>` : ''}
        <div class="admin-privacy-form">
          <div><label for="adminPrivacyVersion">Versione</label><input id="adminPrivacyVersion" value="DEV-0.1" autocomplete="off"></div>
          <div><label for="adminPrivacyTitle">Titolo</label><input id="adminPrivacyTitle" value="Informativa privacy NUBEMO" autocomplete="off"></div>
          <div class="admin-privacy-file"><label for="adminPrivacyFile">PDF</label><input id="adminPrivacyFile" type="file" accept="application/pdf"></div>
          <button id="adminPrivacyPublish" type="button">Pubblica e rendi attiva</button>
        </div>
        <p id="adminPrivacyMessage" class="nubemo-login-message" aria-live="polite"></p>
        <p class="admin-privacy-note">La nuova versione sostituisce quella attiva. Chi non ha ancora accettato questa versione verra' fermato dal gate privacy al login.</p>`;
      host.querySelector('#adminPrivacyOpen')?.addEventListener('click',()=>openDoc(active));
      host.querySelector('#adminPrivacyPublish')?.addEventListener('click',publish);
    } catch (error) {
      console.error('NUBEMO admin privacy render:',error);
      host.innerHTML = '<p class="nubemo-login-message is-error">Non è stato possibile leggere la privacy NUBEMO.</p>';
    }
  }

  async function publish() {
    const version = document.getElementById('adminPrivacyVersion')?.value.trim();
    const title = document.getElementById('adminPrivacyTitle')?.value.trim();
    const file = document.getElementById('adminPrivacyFile')?.files?.[0];
    const button = document.getElementById('adminPrivacyPublish');
    const message = document.getElementById('adminPrivacyMessage');
    const setMessage = (text,error=false) => { if(message){message.textContent=text;message.classList.toggle('is-error',error);} };
    if (!version || !title || !file) return setMessage('Versione, titolo e PDF sono obbligatori.',true);
    if (file.type !== 'application/pdf') return setMessage('Il documento deve essere un PDF.',true);
    if (file.size > 10*1024*1024) return setMessage('Il PDF supera il limite di 10 MB.',true);

    button.disabled = true;
    setMessage('Pubblicazione in corso…');
    const path = `nubemo/${version.replace(/[^a-zA-Z0-9._-]+/g,'_')}/${crypto.randomUUID()}.pdf`;
    let uploaded = false;
    let previousIds = [];
    try {
      const { error: uploadError } = await client.storage.from('privacy-documents')
        .upload(path,file,{contentType:'application/pdf',upsert:false});
      if (uploadError) throw uploadError;
      uploaded = true;

      const { data: previous, error: previousError } = await client.from('privacy_documents')
        .select('id').eq('document_type','nubemo').eq('active',true);
      if (previousError) throw previousError;
      previousIds = (previous || []).map(row=>row.id);
      if (previousIds.length) {
        const { error: deactivateError } = await client.from('privacy_documents')
          .update({active:false}).in('id',previousIds);
        if (deactivateError) throw deactivateError;
      }

      const now = new Date().toISOString();
      const { error: insertError } = await client.from('privacy_documents').insert({
        document_type:'nubemo', version, title,
        storage_bucket:'privacy-documents', storage_path:path,
        published_at:now, active:true
      });
      if (insertError) throw insertError;

      setMessage('Informativa pubblicata. Il gate privacy usa ora questa versione.');
      await render();
    } catch (error) {
      console.error('NUBEMO admin privacy publish:',error);
      if (previousIds.length) await client.from('privacy_documents').update({active:true}).in('id',previousIds).catch(()=>{});
      if (uploaded) await client.storage.from('privacy-documents').remove([path]).catch(()=>{});
      setMessage(error?.message || 'Pubblicazione non completata.',true);
      button.disabled = false;
    }
  }

  async function mount() {
    if (mounted) return;
    const admin = await verifyAdmin();
    if (!admin) return;
    const professionalsSection = content.querySelector('.admin-professionals-section');
    if (!professionalsSection) return;
    mounted = true;
    const section = document.createElement('section');
    section.id = 'adminPrivacySection';
    section.className = 'admin-privacy-section';
    professionalsSection.insertAdjacentElement('afterend',section);
    await render();
  }

  const observer = new MutationObserver(()=>{ if(!content.hidden) void mount(); });
  observer.observe(content,{attributes:true,attributeFilter:['hidden']});
  if (!content.hidden) void mount();
})();
