// NUBEMO 4.0 — PDF privacy del professionista nel Profilo professionista.
(() => {
  'use strict';
  const client = window.nubemoSupabase;
  const app = document.getElementById('proApp');
  const context = window.nubemoProfessionalContext || {};
  const professionalId = context.professional?.id;
  if (!client || !app || !professionalId) return;

  let patching = false;
  let loading = false;

  const esc = (value='') => String(value)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');

  async function activeDocument() {
    const { data, error } = await client.from('professional_privacy_documents')
      .select('id,professional_id,version,original_filename,storage_bucket,storage_path,active,replaced_at,created_at')
      .eq('professional_id', professionalId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function openDocument(row) {
    const popup = window.open('about:blank','_blank');
    try {
      const { data, error } = await client.storage.from(row.storage_bucket).createSignedUrl(row.storage_path,300);
      if (error || !data?.signedUrl) throw error || new Error('PDF non disponibile.');
      if (popup) popup.location.replace(data.signedUrl);
      else window.location.href = data.signedUrl;
    } catch (error) {
      try { popup?.close(); } catch (_) {}
      alert('Non è stato possibile aprire il PDF privacy.');
    }
  }

  function setUploadBusy(label, busy, hasCurrent) {
    if (!label) return;
    label.style.pointerEvents = busy ? 'none' : '';
    label.style.opacity = busy ? '.55' : '';
    const textNode = [...label.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.nodeValue = busy ? 'Caricamento…' : (hasCurrent ? 'Sostituisci PDF' : 'Carica PDF');
  }

  async function replaceDocument(file, currentRow, label) {
    if (!file) return;
    if (file.type !== 'application/pdf') return alert('Carica un file PDF.');
    if (file.size > 10 * 1024 * 1024) return alert('Il PDF supera il limite di 10 MB.');

    const now = new Date();
    const version = now.toISOString();
    const path = `professionals/${professionalId}/templates/${crypto.randomUUID()}.pdf`;
    setUploadBusy(label,true,!!currentRow);
    let uploaded = false;
    try {
      const { error: uploadError } = await client.storage.from('privacy-documents')
        .upload(path,file,{contentType:'application/pdf',upsert:false});
      if (uploadError) throw uploadError;
      uploaded = true;

      const previousIds = [];
      const { data: previous, error: previousError } = await client.from('professional_privacy_documents')
        .select('id').eq('professional_id',professionalId).eq('active',true);
      if (previousError) throw previousError;
      (previous || []).forEach(row => previousIds.push(row.id));

      if (previousIds.length) {
        const { error: deactivateError } = await client.from('professional_privacy_documents')
          .update({active:false,replaced_at:now.toISOString()})
          .in('id',previousIds);
        if (deactivateError) throw deactivateError;
      }

      const { error: insertError } = await client.from('professional_privacy_documents').insert({
        professional_id:professionalId,
        version,
        original_filename:file.name || 'privacy.pdf',
        storage_bucket:'privacy-documents',
        storage_path:path,
        active:true
      });
      if (insertError) {
        if (previousIds.length) await client.from('professional_privacy_documents').update({active:true,replaced_at:null}).in('id',previousIds);
        throw insertError;
      }

      document.getElementById('professionalPrivacyCard')?.remove();
      queueMicrotask(patch);
      alert('PDF privacy aggiornato.');
    } catch (error) {
      console.error('NUBEMO professional privacy upload:',error);
      if (uploaded) await client.storage.from('privacy-documents').remove([path]).catch(()=>{});
      alert('Non è stato possibile salvare il PDF privacy.');
      setUploadBusy(label,false,!!currentRow);
    }
  }

  async function mountCard() {
    if (loading || document.body.dataset.proView !== 'settings' || document.getElementById('professionalPrivacyCard')) return;
    loading = true;
    try {
      const row = await activeDocument();
      if (document.body.dataset.proView !== 'settings' || document.getElementById('professionalPrivacyCard')) return;
      const cards = [...app.querySelectorAll('section.card')];
      const logoCard = cards.find(card => card.querySelector('h2')?.textContent?.trim() === 'Logo professionale');
      if (!logoCard) return;

      const card = document.createElement('section');
      card.className = 'card';
      card.id = 'professionalPrivacyCard';
      card.innerHTML = `
        <div class="section-head"><h2>Privacy pazienti</h2><span class="pill">${row?'PDF attivo':'Da configurare'}</span></div>
        <p class="muted">Carica il modulo privacy che utilizzi con i tuoi pazienti. Dalla scheda del paziente potrai aprirlo direttamente con “Stampa privacy”.</p>
        ${row ? `<div class="pro-read-grid" style="margin-top:18px"><div><span>File</span><b>${esc(row.original_filename)}</b></div><div><span>Caricato</span><b>${new Date(row.created_at).toLocaleDateString('it-IT')}</b></div></div>` : '<p class="muted" style="margin-top:16px">Nessun PDF privacy caricato.</p>'}
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
          ${row?'<button class="secondary" id="openProfessionalPrivacy" type="button">Apri PDF</button>':''}
          <label class="secondary file-button" id="professionalPrivacyUploadLabel">${row?'Sostituisci PDF':'Carica PDF'}<input id="professionalPrivacyFile" type="file" accept="application/pdf" hidden></label>
        </div>`;
      logoCard.insertAdjacentElement('afterend',card);

      card.querySelector('#openProfessionalPrivacy')?.addEventListener('click',()=>openDocument(row));
      const input = card.querySelector('#professionalPrivacyFile');
      input?.addEventListener('change',()=>{
        const file=input.files?.[0];
        const label=card.querySelector('#professionalPrivacyUploadLabel');
        if (file && label) void replaceDocument(file,row,label);
      });
    } catch (error) {
      console.error('NUBEMO professional privacy profile:',error);
    } finally {
      loading = false;
    }
  }

  function patch() {
    if (patching) return;
    patching = true;
    try { void mountCard(); } finally { patching = false; }
  }

  const observer = new MutationObserver(()=>queueMicrotask(patch));
  observer.observe(app,{childList:true,subtree:true});
  patch();
})();
