// NUBEMO — Area Professionista / modulo Pazienti
(() => {
  'use strict';

  const app = document.getElementById('proApp');
  const services = window.nubemoProfessionalServices;
  if (!app || !services) return;

  let currentPatientId = '';
  let patching = false;

  const esc = (value = '') => String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const context = () => window.nubemoProfessionalContext || {};
  const activePatients = () => Array.isArray(context().patients) ? context().patients : [];
  const endedPatients = () => Array.isArray(context().endedPatients) ? context().endedPatients : [];
  const allPatients = () => [...activePatients(), ...endedPatients()];
  const patientById = id => allPatients().find(row => row.id === id) || null;
  const patientName = row => {
    const p = row?.profile || {};
    return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || 'Paziente';
  };

  function rememberPatientFromEvent(target) {
    const patientButton = target?.closest?.('[data-patient]');
    if (patientButton?.dataset?.patient) currentPatientId = patientButton.dataset.patient;
    const drawerPatient = target?.closest?.('[data-drawer-patient]');
    if (drawerPatient?.dataset?.drawerPatient) currentPatientId = drawerPatient.dataset.drawerPatient;
  }

  function inferCurrentPatient() {
    if (currentPatientId && patientById(currentPatientId)) return currentPatientId;
    if (document.body.dataset.proView !== 'details') return '';
    const titleText = document.querySelector('.patient-global-title')?.textContent?.trim() || '';
    const match = allPatients().find(row => titleText.includes(patientName(row)));
    if (match) currentPatientId = match.id;
    return currentPatientId;
  }

  async function reloadPatients() {
    if (typeof window.nubemoReloadProfessionalPatients === 'function') {
      return window.nubemoReloadProfessionalPatients();
    }
    return [];
  }

  const closeOverlay = id => document.getElementById(id)?.remove();

  function openEditDialog(patientId) {
    const row = activePatients().find(p => p.id === patientId);
    if (!row) return alert('Paziente attivo non disponibile.');
    const profile = row.profile || {};
    closeOverlay('patientDemographicOverlay');

    const overlay = document.createElement('div');
    overlay.id = 'patientDemographicOverlay';
    overlay.className = 'clinical-overlay';
    overlay.innerHTML = `
      <section class="clinical-modal">
        <button class="monubi-x" id="closePatientDemographic" type="button">×</button>
        <div class="eyebrow">DATI PAZIENTE</div>
        <h2>Modifica dati</h2>
        <label>Nome</label><input id="pdFirstName" value="${esc(profile.first_name || '')}">
        <label>Cognome</label><input id="pdLastName" value="${esc(profile.last_name || '')}">
        <label>Email</label><input id="pdEmail" value="${esc(profile.email || '')}" readonly>
        <label>Data di nascita</label><input id="pdBirthDate" type="date" value="${esc(row.birth_date || '')}">
        <label>Sesso</label>
        <select id="pdSex">
          <option value="" ${!row.sex ? 'selected' : ''}>Non specificato</option>
          <option value="M" ${row.sex === 'M' ? 'selected' : ''}>Maschile</option>
          <option value="F" ${row.sex === 'F' ? 'selected' : ''}>Femminile</option>
          <option value="X" ${row.sex === 'X' ? 'selected' : ''}>Altro / preferisco non specificare</option>
        </select>
        <label>Altezza (cm)</label><input id="pdHeight" type="number" min="80" max="250" step="1" value="${row.height_cm ?? ''}">
        <label>Data inizio percorso</label><input id="pdPathwayStart" type="date" value="${esc(row.pathway_start_date || '')}">
        <div class="pro3-actions">
          <button class="secondary" id="cancelPatientDemographic" type="button">Annulla</button>
          <button class="primary" id="savePatientDemographic" type="button">Salva modifiche</button>
        </div>
      </section>`;

    document.body.appendChild(overlay);
    const close = () => closeOverlay('patientDemographicOverlay');
    overlay.querySelector('#closePatientDemographic')?.addEventListener('click', close);
    overlay.querySelector('#cancelPatientDemographic')?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('#savePatientDemographic')?.addEventListener('click', async () => {
      const button = overlay.querySelector('#savePatientDemographic');
      const firstName = String(overlay.querySelector('#pdFirstName')?.value || '').trim();
      const lastName = String(overlay.querySelector('#pdLastName')?.value || '').trim();
      const birthDate = overlay.querySelector('#pdBirthDate')?.value || null;
      const sex = overlay.querySelector('#pdSex')?.value || null;
      const heightRaw = String(overlay.querySelector('#pdHeight')?.value || '').trim();
      const height = heightRaw === '' ? null : Number(heightRaw.replace(',', '.'));
      const pathwayStart = overlay.querySelector('#pdPathwayStart')?.value || null;

      if (!firstName || !lastName) return alert('Inserisci nome e cognome.');
      if (height !== null && (!Number.isFinite(height) || height < 80 || height > 250)) {
        return alert('Inserisci un’altezza valida.');
      }

      if (button) { button.disabled = true; button.textContent = 'Salvataggio...'; }
      try {
        await services.updatePatientDemographics(row, { firstName, lastName, birthDate, sex, height, pathwayStart });
        await reloadPatients();
        close();
        document.querySelector('[data-patient-tab="summary"]')?.click();
      } catch (error) {
        console.error('NUBEMO professional patients save demographics:', error);
        alert('Non è stato possibile salvare i dati del paziente.');
      } finally {
        if (button) { button.disabled = false; button.textContent = 'Salva modifiche'; }
      }
    });
  }

  async function endPathway(patientId) {
    const row = activePatients().find(p => p.id === patientId);
    if (!row) return alert('Paziente attivo non disponibile.');
    const ok = window.confirm(`Terminare il percorso di ${patientName(row)}?\n\nIl paziente non verrà cancellato e potrà essere riattivato in seguito.`);
    if (!ok) return;

    try {
      await services.setPatientPathwayStatus(context().professional?.id, row.id, 'ended');
      await reloadPatients();
      currentPatientId = '';
      const patientsNav = document.querySelector('[data-view="patients"]');
      if (patientsNav) patientsNav.click(); else window.location.reload();
    } catch (error) {
      console.error('NUBEMO professional patients end pathway:', error);
      alert('Non è stato possibile terminare il percorso.');
    }
  }

  async function reactivatePathway(patientId, button) {
    const row = endedPatients().find(p => p.id === patientId);
    if (!row) return alert('Percorso terminato non disponibile.');
    if (!window.confirm(`Riattivare il percorso di ${patientName(row)}?`)) return;

    if (button) { button.disabled = true; button.textContent = 'Riattivazione...'; }
    try {
      await services.setPatientPathwayStatus(context().professional?.id, row.id, 'active');
      await reloadPatients();
      const patientsNav = document.querySelector('[data-view="patients"]');
      if (patientsNav) patientsNav.click(); else window.location.reload();
    } catch (error) {
      console.error('NUBEMO professional patients reactivate pathway:', error);
      alert('Non è stato possibile riattivare il percorso.');
      if (button) { button.disabled = false; button.textContent = 'Riattiva percorso'; }
    }
  }

  function removeAccountTab() {
    document.querySelectorAll('[data-patient-tab="account"],[data-drawer-tab="account"]').forEach(el => el.remove());
  }

  function removeLegacyPatientActions() {
    document.getElementById('nubemoEditDemographics')?.remove();
    document.getElementById('nubemoEndPathway')?.remove();
    document.getElementById('patientMoreBtn')?.remove();
    document.getElementById('patientMoreMenu')?.remove();
    document.querySelectorAll('button,a').forEach(el => {
      if (/elimina\s+paziente/i.test(el.textContent || '')) el.remove();
    });
  }

  function closePatientMenu() {
    const menu = document.getElementById('nubemoPatientActionsMenu');
    const button = document.getElementById('nubemoPatientActionsBtn');
    if (menu) menu.hidden = true;
    button?.setAttribute('aria-expanded', 'false');
  }

  function ensurePatientMenu(patientId) {
    const row = patientById(patientId);
    if (!row) return;
    const isActive = row.relationship?.status !== 'ended';
    const existing = document.getElementById('nubemoPatientActions');
    if (existing?.dataset.patientId === patientId) return;
    existing?.remove();

    const titleHost = document.querySelector('.patient-global-title')?.parentElement
      || document.querySelector('.patient-global-head')
      || document.querySelector('.patient-section-head');
    if (!titleHost) return;

    const wrap = document.createElement('div');
    wrap.id = 'nubemoPatientActions';
    wrap.dataset.patientId = patientId;
    wrap.className = 'patient-more-wrap';
    wrap.innerHTML = `
      <button class="patient-more-btn" id="nubemoPatientActionsBtn" type="button" aria-label="Azioni paziente" aria-expanded="false">⋯</button>
      <div class="patient-more-menu" id="nubemoPatientActionsMenu" hidden>
        ${isActive ? '<button type="button" data-nubemo-patient-action="clinical">Modifica scheda</button>' : ''}
        ${isActive ? '<button type="button" data-nubemo-patient-action="demographics">Modifica anagrafica</button>' : ''}
        ${isActive ? '<button type="button" data-nubemo-patient-action="end">Termina percorso</button>' : '<span class="muted" style="display:block;padding:10px 12px">Percorso terminato</span>'}
      </div>`;
    titleHost.appendChild(wrap);

    const button = wrap.querySelector('#nubemoPatientActionsBtn');
    const menu = wrap.querySelector('#nubemoPatientActionsMenu');
    button?.addEventListener('click', e => {
      e.stopPropagation();
      const opening = menu?.hidden !== false;
      if (menu) menu.hidden = !opening;
      button.setAttribute('aria-expanded', String(opening));
    });
    menu?.querySelector('[data-nubemo-patient-action="clinical"]')?.addEventListener('click', () => {
      closePatientMenu();
      window.nubemoProfessionalClinical?.openEditor?.(patientId);
    });
    menu?.querySelector('[data-nubemo-patient-action="demographics"]')?.addEventListener('click', () => {
      closePatientMenu();
      openEditDialog(patientId);
    });
    menu?.querySelector('[data-nubemo-patient-action="end"]')?.addEventListener('click', () => {
      closePatientMenu();
      void endPathway(patientId);
    });
  }

  function enhanceDetails() {
    if (document.body.dataset.proView !== 'details') return;
    const patientId = inferCurrentPatient();
    if (!patientId) return;
    removeAccountTab();
    removeLegacyPatientActions();
    document.getElementById('editPatientProfileTop')?.setAttribute('hidden', '');
    ensurePatientMenu(patientId);
  }

  function enhancePatientList() {
    if (document.body.dataset.proView !== 'patients') return;
    const rows = endedPatients();
    const existing = document.getElementById('endedPatientsCard');
    if (!rows.length) { existing?.remove(); return; }

    const signature = rows.map(row => `${row.id}:${row.relationship?.ended_at || ''}:${patientName(row)}`).join('|');
    if (existing?.dataset?.signature === signature) return;
    existing?.remove();

    const activeCard = app.querySelector('section.card');
    if (!activeCard) return;
    const card = document.createElement('section');
    card.className = 'card';
    card.id = 'endedPatientsCard';
    card.dataset.signature = signature;
    card.innerHTML = `
      <div class="section-head"><h2>Percorsi terminati</h2></div>
      <div class="pro3-patients">
        ${rows.map(row => `
          <div class="pro3-patient" style="font-weight:400">
            <div class="patient-avatar">${esc(patientName(row).split(' ').map(x => x[0]).slice(0, 2).join(''))}</div>
            <div>
              <span style="display:block;font-size:15px;font-weight:700;color:#34484f">${esc(patientName(row))}</span>
              <span style="display:block;margin-top:3px;font-size:12px;color:#7b898f">Percorso terminato${row.relationship?.ended_at ? ` · ${new Date(row.relationship.ended_at).toLocaleDateString('it-IT')}` : ''}</span>
            </div>
            <button class="mini" type="button" data-reactivate-patient="${row.id}">Riattiva percorso</button>
          </div>`).join('')}
      </div>`;
    activeCard.insertAdjacentElement('afterend', card);
    card.querySelectorAll('[data-reactivate-patient]').forEach(button => {
      button.addEventListener('click', () => reactivatePathway(button.dataset.reactivatePatient, button));
    });
  }

  function syncView() {
    if (patching) return;
    patching = true;
    try {
      enhanceDetails();
      enhancePatientList();
      window.nubemoProfessionalClinical?.syncView?.();
      window.nubemoProfessionalAgenda?.syncView?.();
      window.nubemoProfessionalPdf?.syncView?.();
    } finally {
      patching = false;
    }
  }

  function isMigratedBodyNode(node) {
    return node?.nodeType === Node.ELEMENT_NODE && /^nubemoProfessional/.test(node.id || '');
  }

  function needsSyncFromMutations(mutations) {
    for (const mutation of mutations) {
      const nodes = [...mutation.addedNodes, ...mutation.removedNodes].filter(n => n.nodeType === Node.ELEMENT_NODE);
      if (!nodes.length) continue;
      if (nodes.some(node => !isMigratedBodyNode(node))) return true;
    }
    return false;
  }

  function init() {
    document.addEventListener('click', e => {
      rememberPatientFromEvent(e.target);
      if (!e.target.closest?.('#nubemoPatientActions')) closePatientMenu();
    }, true);

    // Compatibility bridge while the shell/detail host is still rendered by legacy pro.js.
    // Mutations caused only by migrated tab bodies are ignored to avoid render loops/flicker.
    const observer = new MutationObserver(mutations => {
      if (needsSyncFromMutations(mutations)) queueMicrotask(syncView);
    });
    observer.observe(app, { childList: true, subtree: true });
    syncView();
  }

  window.nubemoProfessionalPatients = Object.freeze({
    init,
    syncView,
    getActivePatients: activePatients,
    getEndedPatients: endedPatients,
    getCurrentPatientId: inferCurrentPatient,
    getPatientById: patientById,
    openEditDialog,
    endPathway
  });

  init();
})();
