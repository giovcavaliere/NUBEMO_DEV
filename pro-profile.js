// NUBEMO — Profilo professionista (Area Professionista).
//
// Riscrittura della sezione "Profilo professionista". Sostituisce
// settingsPage() e i tre handler (logo, rimozione logo, salvataggio) che
// vivevano sparsi in pro.js.
//
// Layout invariato rispetto alla versione precedente. La scheda "Backup
// pazienti" e' stata rimossa insieme a tutta la sua meccanica.
//
// Contratti verso il backend invariati:
//   - Storage  : bucket `professional-assets`, percorso `<professionalId>/logo`
//   - Tabella  : `professionals` (update dei campi anagrafici + logo_storage_path)
//   - Locale   : SETTINGS_KEY, dove restano le sole impostazioni Agenda
// Il logo caricato qui alimenta la cartella PDF del paziente: percorso non
// toccato.
(() => {
  'use strict';

  const SETTINGS_KEY = 'diario-pro-settings-recovery-v1';
  const LOGO_BUCKET = 'professional-assets';
  const LOGO_MAX_BYTES = 2.5 * 1024 * 1024;
  const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

  const SECTIONS = [
    'Dashboard', 'Pazienti', 'Agenda', 'Scheda paziente', 'Esami',
    'Piano alimentare', 'Documenti', 'Diario', 'Andamento', 'Misure',
    'Visite', 'Profilo professionista', 'Altro'
  ];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const el = id => document.getElementById(id);
  const toMinutes = value => {
    const [h, m] = String(value || '').split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  };

  // Stato del logo in attesa di salvataggio. Vive qui e non piu' come
  // variabile globale di pro.js.
  let pendingLogoData;
  let pendingLogoFile;
  let pendingLogoRemove = false;

  function resetPendingLogo() {
    pendingLogoData = undefined;
    pendingLogoFile = undefined;
    pendingLogoRemove = false;
  }

  function displayName(s) {
    const n = [s.firstName, s.surname].filter(Boolean).join(' ').trim();
    return n || s.name || 'Professionista';
  }

  // ---------------------------------------------------------------- markup

  function body(s) {
    const shown = esc(s.name || displayName(s));
    return `<section class="card">
   <div class="section-head"><h2>Dati professionali</h2><span class="pill">Report NUBEMO</span></div>
   <div class="pro-profile-grid">
     <div><label>Nome</label><input id="sFirstName" value="${esc(s.firstName || '')}" readonly></div>
     <div><label>Cognome</label><input id="sSurname" value="${esc(s.surname || '')}" readonly></div>
   </div>
   <label>Qualifica / titolo professionale</label><input id="sQualification" value="${esc(s.qualification || '')}" placeholder="es. Biologa Nutrizionista">
   <label>Nome visualizzato</label><input id="sName" value="${shown}" placeholder="es. Dott.ssa Maria Rossi">
   <div class="pro-profile-grid">
     <div><label>Codice fiscale</label><input id="sCf" value="${esc(s.cf || '')}"></div>
     <div><label>Partita IVA</label><input id="sVat" value="${esc(s.vat || '')}"></div>
   </div>
 </section>

 <section class="card">
   <div class="section-head"><h2>Studio e recapiti</h2></div>
   <label>Indirizzo</label><input id="sAddress" value="${esc(s.address || '')}">
   <div class="pro-profile-grid three">
     <div><label>CAP</label><input id="sZip" value="${esc(s.zip || '')}"></div>
     <div><label>Comune</label><input id="sCity" value="${esc(s.city || '')}"></div>
     <div><label>Provincia</label><input id="sProvince" value="${esc(s.province || '')}"></div>
   </div>
   <div class="pro-profile-grid">
     <div><label>E-mail</label><input id="sEmail" type="email" value="${esc(s.email || '')}" readonly></div>
     <div><label>Telefono</label><input id="sPhone" value="${esc(s.phone || '')}"></div>
   </div>
 </section>

 <section class="card">
   <div class="section-head"><h2>Logo professionale</h2><span class="pill">Opzionale</span></div>
   <p class="muted">Se presente, viene riportato nella cartella PDF del paziente insieme al logo NUBEMO.</p>
   <div class="pro-logo-editor">
     <div class="pro-logo-preview">${s.logoData ? `<img id="professionalLogoPreview" src="${s.logoData}" alt="Logo professionale">` : '<span id="professionalLogoEmpty">Nessun logo</span>'}</div>
     <div class="pro-logo-actions">
       <label class="secondary file-button">Carica logo<input id="sLogoFile" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>
       <button class="mini" id="removeProfessionalLogo" type="button">Rimuovi logo</button>
     </div>
   </div>
 </section>

 <section class="card">
   <div class="section-head"><h2>Agenda</h2></div>
   <label>Durata predefinita prima visita</label><input id="sFirst" type="number" step="15" min="15" value="${esc(s.first)}">
   <label>Durata predefinita controllo</label><input id="sControl" type="number" step="15" min="15" value="${esc(s.control)}">
   <label>Inizio agenda</label><input id="sStart" type="time" value="${esc(s.dayStart)}">
   <label>Fine agenda</label><input id="sEnd" type="time" value="${esc(s.dayEnd)}">
   <label>Settimana lavorativa</label>
   <select id="sWorkDays">
     <option value="5" ${Number(s.workDays) === 5 ? 'selected' : ''}>Da lunedì a venerdì</option>
     <option value="6" ${Number(s.workDays) === 6 ? 'selected' : ''}>Da lunedì a sabato</option>
   </select>
   <p class="muted">L'Agenda mostrerà solo i giorni lavorativi selezionati.</p>
   <button class="primary" id="saveSettings">Salva profilo professionista</button>
 </section>`;
  }

  // --------------------------------------------------------------- handler

  function onLogoSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > LOGO_MAX_BYTES) {
      alert('Il logo è troppo grande. Usa un file sotto 2,5 MB.');
      return;
    }
    if (!LOGO_TYPES.includes(file.type)) {
      alert('Formato logo non supportato. Usa PNG, JPEG o WebP.');
      return;
    }
    pendingLogoFile = file;
    pendingLogoRemove = false;
    const reader = new FileReader();
    reader.onload = () => {
      pendingLogoData = String(reader.result || '');
      const box = document.querySelector('.pro-logo-preview');
      if (box) box.innerHTML = `<img id="professionalLogoPreview" src="${pendingLogoData}" alt="Logo professionale">`;
    };
    reader.readAsDataURL(file);
  }

  function onLogoRemoved() {
    pendingLogoData = '';
    pendingLogoFile = undefined;
    pendingLogoRemove = true;
    const box = document.querySelector('.pro-logo-preview');
    if (box) box.innerHTML = '<span id="professionalLogoEmpty">Nessun logo</span>';
  }

  async function onSave(button, host) {
    const ctx = window.nubemoProfessionalContext || {};
    const professionalId = ctx.professional?.id;
    if (!professionalId) {
      alert('Profilo professionale NUBEMO non disponibile.');
      return;
    }

    // Controllo orari Agenda: un intervallo non valido produrrebbe
    // un'agenda vuota senza alcun avviso.
    const dayStart = el('sStart')?.value || '08:00';
    const dayEnd = el('sEnd')?.value || '19:00';
    if (toMinutes(dayEnd) <= toMinutes(dayStart)) {
      alert('L\'orario di fine agenda deve essere successivo a quello di inizio.');
      return;
    }

    const logoPath = `${professionalId}/logo`;
    const logoFile = el('sLogoFile')?.files?.[0] || pendingLogoFile;
    const patch = {
      qualification: (el('sQualification')?.value || '').trim() || null,
      display_name: (el('sName')?.value || '').trim() || null,
      tax_code: (el('sCf')?.value || '').trim() || null,
      vat_number: (el('sVat')?.value || '').trim() || null,
      phone: (el('sPhone')?.value || '').trim() || null,
      address: (el('sAddress')?.value || '').trim() || null,
      zip: (el('sZip')?.value || '').trim() || null,
      city: (el('sCity')?.value || '').trim() || null,
      province: (el('sProvince')?.value || '').trim() || null
    };

    button.disabled = true;
    try {
      let nextLogoData = ctx.logoData || '';
      let nextLogoPath = ctx.professional?.logo_storage_path || null;
      let uploadedNewLogo = false;

      if (logoFile) {
        const { error: uploadError } = await window.nubemoSupabase.storage
          .from(LOGO_BUCKET)
          .upload(logoPath, logoFile, { upsert: true, contentType: logoFile.type, cacheControl: '3600' });
        if (uploadError) throw uploadError;
        uploadedNewLogo = true;
        nextLogoPath = logoPath;
        nextLogoData = pendingLogoData || '';
        patch.logo_storage_path = logoPath;
      } else if (pendingLogoRemove) {
        patch.logo_storage_path = null;
        nextLogoPath = null;
        nextLogoData = '';
      }

      const { data: updated, error } = await window.nubemoSupabase
        .from('professionals')
        .update(patch)
        .eq('id', professionalId)
        .select('id,profile_id,qualification,display_name,tax_code,vat_number,phone,address,zip,city,province,status,logo_storage_path')
        .single();

      if (error) {
        // Il logo appena caricato non ha ancora un riferimento salvato:
        // va rimosso, altrimenti resta orfano nello Storage.
        if (uploadedNewLogo && !ctx.professional?.logo_storage_path) {
          await window.nubemoSupabase.storage.from(LOGO_BUCKET).remove([logoPath]);
        }
        throw error;
      }

      if (pendingLogoRemove && ctx.professional?.logo_storage_path) {
        const { error: removeError } = await window.nubemoSupabase.storage
          .from(LOGO_BUCKET)
          .remove([ctx.professional.logo_storage_path]);
        if (removeError) console.error('NUBEMO logo professionale, rimozione:', removeError);
      }

      window.nubemoProfessionalContext = {
        ...ctx,
        professional: { ...ctx.professional, ...updated, logo_storage_path: nextLogoPath },
        logoData: nextLogoData
      };

      // Solo le impostazioni Agenda restano locali; il logo remoto e' la
      // fonte principale.
      host.saveAgendaSettings({
        logoData: nextLogoPath ? '' : undefined,
        first: +el('sFirst').value || 60,
        control: +el('sControl').value || 30,
        dayStart,
        dayEnd,
        workDays: +el('sWorkDays').value || 5
      });

      resetPendingLogo();
      alert('Profilo professionista salvato');
      host.render();
    } catch (error) {
      console.error('NUBEMO salvataggio profilo professionista:', error);
      alert('Impossibile salvare il profilo professionista. Riprova.');
    } finally {
      button.disabled = false;
    }
  }

  // Agganciato dopo ogni render della pagina. `host` fornisce i pochi punti
  // di contatto con la shell PRO (settings correnti, salvataggio locale,
  // re-render), cosi' il modulo non dipende dagli interni di pro.js.
  function bind(host) {
    el('sLogoFile')?.addEventListener('change', onLogoSelected);
    el('removeProfessionalLogo')?.addEventListener('click', onLogoRemoved);
    const save = el('saveSettings');
    save?.addEventListener('click', () => void onSave(save, host));
  }

  window.NubemoProfessionalProfile = Object.freeze({
    sections: SECTIONS,
    settingsKey: SETTINGS_KEY,
    body,
    bind,
    resetPendingLogo
  });
})();
