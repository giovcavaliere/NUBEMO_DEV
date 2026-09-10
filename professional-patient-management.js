// NUBEMO 4C.2b — gestione dati demografici + chiusura/riattivazione percorso
(() => {
  'use strict';

  const app = document.getElementById('proApp');
  const services = window.nubemoProfessionalServices;
  if (!services || !app) return;

  let currentPatientId = '';
  let patching = false;

  const esc = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function context() {
    return window.nubemoProfessionalContext || {};
  }

  function activePatients() {
    return Array.isArray(context().patients) ? context().patients : [];
  }

  function endedPatients() {
    return Array.isArray(context().endedPatients) ? context().endedPatients : [];
  }

  function allPatients() {
    return [...activePatients(), ...endedPatients()];
  }

  function patientById(id) {
    return allPatients().find(row => row.id === id) || null;
  }

  function patientName(row) {
    const p = row?.profile || {};
    return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || 'Paziente';
  }

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
    const match = activePatients().find(row => titleText.includes(patientName(row)));
    if (match) currentPatientId = match.id;
    return currentPatientId;
  }

  function closeOverlay(id) {
    document.getElementById(id)?.remove();
  }

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
        <label>Nome</label>
        <input id="pdFirstName" value="${esc(profile.first_name || '')}">
        <label>Cognome</label>
        <input id="pdLastName" value="${esc(profile.last_name || '')}">
        <label>Email</label>
        <input id="pdEmail" value="${esc(profile.email || '')}" readonly>
        <label>Data di nascita</label>
        <input id="pdBirthDate" type="date" value="${esc(row.birth_date || '')}">
        <label>Sesso</label>
        <select id="pdSex">
          <option value="" ${!row.sex ? 'selected' : ''}>Non specificato</option>
          <option value="M" ${row.sex === 'M' ? 'selected' : ''}>Maschile</option>
          <option value="F" ${row.sex === 'F' ? 'selected' : ''}>Femminile</option>
          <option value="X" ${row.sex === 'X' ? 'selected' : ''}>Altro / preferisco non specificare</option>
        </select>
        <label>Altezza (cm)</label>
        <input id="pdHeight" type="number" min="80" max="250" step="1" value="${row.height_cm ?? ''}">
        <label>Data inizio percorso</label>
        <input id="pdPathwayStart" type="date" value="${esc(row.pathway_start_date || '')}">
        <div class="pro3-actions">
          <button class="secondary" id="cancelPatientDemographic" type="button">Annulla</button>
          <button class="primary" id="savePatientDemographic" type="button">Salva modifiche</button>
        </div>
      </section>`;

    document.body.appendChild(overlay);

    const close = () => closeOverlay('patientDemographicOverlay');
    document.getElementById('closePatientDemographic')?.addEventListener('click', close);
    document.getElementById('cancelPatientDemographic')?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    document.getElementById('savePatientDemographic')?.addEventListener('click', async () => {
      const button = document.getElementById('savePatientDemographic');
      const firstName = (document.getElementById('pdFirstName')?.value || '').trim();
      const lastName = (document.getElementById('pdLastName')?.value || '').trim();
      const birthDate = document.getElementById('pdBirthDate')?.value || null;
      const sex = document.getElementById('pdSex')?.value || null;
      const heightRaw = (document.getElementById('pdHeight')?.value || '').trim();
      const height = heightRaw === '' ? null : Number(heightRaw.replace(',', '.'));
      const pathwayStart = document.getElementById('pdPathwayStart')?.value || null;

      if (!firstName || !lastName) return alert('Inserisci nome e cognome.');
      if (height !== null && (!Number.isFinite(height) || height <= 0)) return alert('Inserisci un’altezza valida.');

      if (button) { button.disabled = true; button.textContent = 'Salvataggio...'; }
      try {
        await services.updatePatientDemographics(row, {
          firstName,
          lastName,
          birthDate,
          sex,
          height,
          pathwayStart
        });

        if (typeof window.nubemoReloadProfessionalPatients === 'function') {
          await window.nubemoReloadProfessionalPatients();
        }
        close();
        const summaryTab = document.querySelector('[data-patient-tab="summary"]');
        if (summaryTab) summaryTab.click();
      } catch (error) {
        console.error('NUBEMO 4C.2b save demographics:', error);
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
      const professionalId = context().professional?.id;
      await services.setPatientPathwayStatus(professionalId, row.id, 'ended');

      if (typeof window.nubemoReloadProfessionalPatients === 'function') {
        await window.nubemoReloadProfessionalPatients();
      }
      currentPatientId = '';
      const patientsNav = document.querySelector('[data-view="patients"]');
      if (patientsNav) patientsNav.click();
      else window.location.reload();
    } catch (error) {
      console.error('NUBEMO 4C.2b end pathway:', error);
      alert('Non è stato possibile terminare il percorso.');
    }
  }

  async function reactivatePathway(patientId, button) {
    const row = endedPatients().find(p => p.id === patientId);
    if (!row) return alert('Percorso terminato non disponibile.');

    const ok = window.confirm(`Riattivare il percorso di ${patientName(row)}?`);
    if (!ok) return;

    if (button) { button.disabled = true; button.textContent = 'Riattivazione...'; }
    try {
      const professionalId = context().professional?.id;
      await services.setPatientPathwayStatus(professionalId, row.id, 'active');

      if (typeof window.nubemoReloadProfessionalPatients === 'function') {
        await window.nubemoReloadProfessionalPatients();
      }
      const patientsNav = document.querySelector('[data-view="patients"]');
      if (patientsNav) patientsNav.click();
      else window.location.reload();
    } catch (error) {
      console.error('NUBEMO 4C.2b reactivate pathway:', error);
      alert('Non è stato possibile riattivare il percorso.');
      if (button) { button.disabled = false; button.textContent = 'Riattiva percorso'; }
    }
  }

  function patchDetails() {
    if (document.body.dataset.proView !== 'details') return;
    const patientId = inferCurrentPatient();
    if (!patientId) return;

    const existingEdit = document.getElementById('editPatientProfileTop');
    if (existingEdit && !document.getElementById('nubemoEditDemographics')) {
      const edit = existingEdit.cloneNode(true);
      edit.id = 'nubemoEditDemographics';
      edit.textContent = 'Modifica anagrafica';
      edit.addEventListener('click', () => openEditDialog(patientId));
      existingEdit.insertAdjacentElement('afterend', edit);

      const end = document.createElement('button');
      end.id = 'nubemoEndPathway';
      end.className = 'danger patient-global-edit';
      end.type = 'button';
      end.textContent = 'Termina percorso';
      edit.insertAdjacentElement('afterend', end);
      end.addEventListener('click', () => endPathway(patientId));
    }
  }

  function patchEndedPatients() {
    if (document.body.dataset.proView !== 'patients') return;

    const rows = endedPatients();
    const existing = document.getElementById('endedPatientsCard');
    if (!rows.length) {
      existing?.remove();
      return;
    }

    const signature = rows
      .map(row => `${row.id}:${row.relationship?.ended_at || ''}:${patientName(row)}`)
      .join('|');
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
            <div class="patient-avatar">${esc(patientName(row).split(' ').map(x => x[0]).slice(0,2).join(''))}</div>
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

  function patch() {
    if (patching) return;
    patching = true;
    try {
      patchDetails();
      patchEndedPatients();
    } finally {
      patching = false;
    }
  }

  document.addEventListener('click', e => {
    rememberPatientFromEvent(e.target);
    if (
      document.body.dataset.proView === 'details' &&
      e.target?.closest?.('.patient-global-title h1')
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  const observer = new MutationObserver(() => queueMicrotask(patch));
  observer.observe(app, { childList: true, subtree: true });
  patch();
})();
