// NUBEMO — Area Professionista / modulo Clinico
// Perimetri migrati: Anamnesi e Misure del paziente su Supabase.
(() => {
  'use strict';

  const services = window.nubemoProfessionalServices;
  const patientsModule = window.nubemoProfessionalPatients;
  if (!services || !patientsModule) return;

  const cache = new Map();
  const pending = new Map();
  const measurementsCache = new Map();
  const measurementsPending = new Map();

  const esc = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const display = value => {
    if (value === null || value === undefined || String(value).trim() === '') return '—';
    return esc(value);
  };

  const yesNo = value => value === true ? 'Sì' : 'No';

  function currentPatientId() {
    return patientsModule.getCurrentPatientId?.() || '';
  }

  function currentPatient() {
    const id = currentPatientId();
    return id ? patientsModule.getPatientById?.(id) || null : null;
  }

  function patientIsActive(row) {
    return !!row && row.relationship?.status !== 'ended';
  }

  function isDetailsView() {
    return document.body.dataset.proView === 'details';
  }

  function isAnamnesisTab() {
    if (!isDetailsView()) return false;
    return !!document.querySelector('[data-patient-tab="anamnesis"].active');
  }

  function isMeasuresTab() {
    if (!isDetailsView()) return false;
    return !!document.querySelector('[data-patient-tab="measures"].active');
  }

  async function loadProfile(patientId, force = false) {
    if (!force && cache.has(patientId)) return cache.get(patientId);
    if (!force && pending.has(patientId)) return pending.get(patientId);

    const request = services.loadPatientClinicalProfile(patientId)
      .then(profile => {
        cache.set(patientId, profile);
        return profile;
      })
      .finally(() => pending.delete(patientId));

    pending.set(patientId, request);
    return request;
  }

  async function loadMeasurements(patientId, force = false) {
    if (!force && measurementsCache.has(patientId)) return measurementsCache.get(patientId);
    if (!force && measurementsPending.has(patientId)) return measurementsPending.get(patientId);

    const request = services.loadPatientMeasurements(patientId)
      .then(rows => {
        measurementsCache.set(patientId, rows || []);
        return rows || [];
      })
      .finally(() => measurementsPending.delete(patientId));

    measurementsPending.set(patientId, request);
    return request;
  }

  function clinicalBodyHost() {
    return document.querySelector('.patient-content-card');
  }

  function bodySignature(value) {
    return JSON.stringify(value || null);
  }

  function replaceClinicalBody(bodyId, patientId, html, signature, afterRender) {
    const card = clinicalBodyHost();
    if (!card) return;

    const existing = document.getElementById(bodyId);
    if (
      existing &&
      existing.dataset.patientId === patientId &&
      existing._nubemoSignature === signature
    ) {
      if (afterRender) afterRender(existing);
      return;
    }

    const head = card.querySelector(':scope > .patient-section-head');
    Array.from(card.children).forEach(child => {
      if (child !== head) child.remove();
    });

    const body = document.createElement('div');
    body.id = bodyId;
    body.dataset.patientId = patientId;
    body._nubemoSignature = signature;
    body.innerHTML = html;
    card.appendChild(body);
    if (afterRender) afterRender(body);
  }

  function anamnesisHtml(profile) {
    const p = profile || {};
    return `
      <details class="pro-accordion" open>
        <summary>Dati e stile di vita</summary>
        <div class="pro-read-grid">
          <div><span>Diagnosi / motivo</span><b>${display(p.diagnosis)}</b></div>
          <div><span>Peso teorico</span><b>${p.theoretical_weight_kg != null ? `${display(p.theoretical_weight_kg)} kg` : '—'}</b></div>
          <div><span>Lavoro</span><b>${display(p.work)}</b></div>
          <div><span>Attività fisica</span><b>${display(p.activity)}</b></div>
          <div><span>Alvo</span><b>${display(p.bowel)}</b></div>
          <div><span>Fumo</span><b>${display(p.smoking)}</b></div>
          <div><span>Alcol</span><b>${display(p.alcohol)}</b></div>
          <div><span>Metabolismo basale</span><b>${display(p.metabolism)}</b></div>
          <div><span>FEEG</span><b>${display(p.feeg)}</b></div>
          <div><span>Impedenziometria</span><b>${display(p.impedance)}</b></div>
        </div>
      </details>
      <details class="pro-accordion">
        <summary>Familiarità</summary>
        <div class="pro-read-grid">
          <div><span>Obesità</span><b>${yesNo(p.family_obesity)}</b></div>
          <div><span>Diabete</span><b>${yesNo(p.family_diabetes)}</b></div>
          <div><span>Ipertensione</span><b>${yesNo(p.family_hypertension)}</b></div>
          <div><span>Cardiovascolare</span><b>${yesNo(p.family_cardiovascular)}</b></div>
          <div><span>Dislipidemie</span><b>${yesNo(p.family_dyslipidemia)}</b></div>
          <div><span>Tiroide</span><b>${yesNo(p.family_thyroid)}</b></div>
        </div>
      </details>
      <details class="pro-accordion">
        <summary>Anamnesi patologica</summary>
        <div class="pro-read-grid">
          <div><span>Diete pregresse</span><b>${display(p.previous_diets)}</b></div>
          <div><span>Allergie</span><b>${display(p.allergies)}</b></div>
          <div><span>Farmaci</span><b>${display(p.medications)}</b></div>
          <div><span>Disturbi GI</span><b>${display(p.gi_issues)}</b></div>
          <div><span>Patologie / interventi</span><b>${display(p.past_conditions)}</b></div>
          <div><span>Osservazioni</span><b>${display(p.observations)}</b></div>
          <div><span>Obiettivi</span><b>${display(p.objectives)}</b></div>
        </div>
      </details>`;
  }

  function renderLoading(patientId) {
    replaceClinicalBody(
      'nubemoProfessionalAnamnesis',
      patientId,
      '<p class="muted">Caricamento anamnesi...</p>',
      'loading'
    );
  }

  function renderError(patientId) {
    replaceClinicalBody(
      'nubemoProfessionalAnamnesis',
      patientId,
      '<p class="muted">Non è stato possibile caricare l’anamnesi.</p>',
      'error'
    );
  }

  function renderProfile(patientId, profile) {
    replaceClinicalBody(
      'nubemoProfessionalAnamnesis',
      patientId,
      anamnesisHtml(profile),
      bodySignature(profile)
    );
  }

  async function syncAnamnesis() {
    if (!isAnamnesisTab()) return;
    const patientId = currentPatientId();
    if (!patientId) return;

    if (cache.has(patientId)) {
      renderProfile(patientId, cache.get(patientId));
      return;
    }

    renderLoading(patientId);
    try {
      const profile = await loadProfile(patientId);
      if (isAnamnesisTab() && currentPatientId() === patientId) {
        renderProfile(patientId, profile);
      }
    } catch (error) {
      console.error('NUBEMO professional clinical load anamnesis:', error);
      if (isAnamnesisTab() && currentPatientId() === patientId) renderError(patientId);
    }
  }

  function closeEditor() {
    document.getElementById('patientAnamnesisOverlay')?.remove();
  }

  function value(id) {
    const raw = document.getElementById(id)?.value ?? '';
    const trimmed = String(raw).trim();
    return trimmed === '' ? null : trimmed;
  }

  function checked(id) {
    return !!document.getElementById(id)?.checked;
  }

  function openEditorWithProfile(patientId, profile) {
    const p = profile || {};
    closeEditor();

    const overlay = document.createElement('div');
    overlay.id = 'patientAnamnesisOverlay';
    overlay.className = 'clinical-overlay';
    overlay.innerHTML = `
      <section class="clinical-modal">
        <button class="monubi-x" id="closePatientAnamnesis" type="button">×</button>
        <div class="eyebrow">SCHEDA PAZIENTE</div>
        <h2>Modifica anamnesi</h2>

        <details class="pro-accordion" open>
          <summary>Dati e stile di vita</summary>
          <label>Diagnosi / motivo</label>
          <textarea id="caDiagnosis" rows="2">${esc(p.diagnosis || '')}</textarea>
          <label>Peso teorico (kg)</label>
          <input id="caTheoreticalWeight" type="number" min="0.1" step="0.1" value="${p.theoretical_weight_kg ?? ''}">
          <label>Attività lavorativa</label>
          <textarea id="caWork" rows="2">${esc(p.work || '')}</textarea>
          <label>Attività fisica abituale</label>
          <textarea id="caActivity" rows="2">${esc(p.activity || '')}</textarea>
          <label>Alvo</label>
          <input id="caBowel" value="${esc(p.bowel || '')}">
          <label>Fumo</label>
          <input id="caSmoking" value="${esc(p.smoking || '')}">
          <label>Alcol</label>
          <input id="caAlcohol" value="${esc(p.alcohol || '')}">
          <label>Metabolismo basale</label>
          <input id="caMetabolism" value="${esc(p.metabolism || '')}">
          <label>FEEG / fabbisogno</label>
          <input id="caFeeg" value="${esc(p.feeg || '')}">
          <label>Impedenziometria</label>
          <input id="caImpedance" value="${esc(p.impedance || '')}">
        </details>

        <details class="pro-accordion">
          <summary>Familiarità</summary>
          <div class="check-grid">
            <label><input id="caFamilyObesity" type="checkbox" ${p.family_obesity === true ? 'checked' : ''}> Obesità</label>
            <label><input id="caFamilyDiabetes" type="checkbox" ${p.family_diabetes === true ? 'checked' : ''}> Diabete</label>
            <label><input id="caFamilyHypertension" type="checkbox" ${p.family_hypertension === true ? 'checked' : ''}> Ipertensione</label>
            <label><input id="caFamilyCardiovascular" type="checkbox" ${p.family_cardiovascular === true ? 'checked' : ''}> Cardiovascolare</label>
            <label><input id="caFamilyDyslipidemia" type="checkbox" ${p.family_dyslipidemia === true ? 'checked' : ''}> Dislipidemie</label>
            <label><input id="caFamilyThyroid" type="checkbox" ${p.family_thyroid === true ? 'checked' : ''}> Tiroide</label>
          </div>
        </details>

        <details class="pro-accordion">
          <summary>Anamnesi patologica e obiettivi</summary>
          <label>Diete pregresse</label>
          <textarea id="caPreviousDiets" rows="2">${esc(p.previous_diets || '')}</textarea>
          <label>Allergie / intolleranze</label>
          <textarea id="caAllergies" rows="2">${esc(p.allergies || '')}</textarea>
          <label>Farmaci</label>
          <textarea id="caMedications" rows="2">${esc(p.medications || '')}</textarea>
          <label>Disturbi gastrointestinali</label>
          <textarea id="caGiIssues" rows="2">${esc(p.gi_issues || '')}</textarea>
          <label>Patologie / interventi pregressi</label>
          <textarea id="caPastConditions" rows="2">${esc(p.past_conditions || '')}</textarea>
          <label>Osservazioni</label>
          <textarea id="caObservations" rows="2">${esc(p.observations || '')}</textarea>
          <label>Obiettivi</label>
          <textarea id="caObjectives" rows="2">${esc(p.objectives || '')}</textarea>
        </details>

        <div class="pro3-actions">
          <button class="secondary" id="cancelPatientAnamnesis" type="button">Annulla</button>
          <button class="primary" id="savePatientAnamnesis" type="button">Salva modifiche</button>
        </div>
      </section>`;

    document.body.appendChild(overlay);

    document.getElementById('closePatientAnamnesis')?.addEventListener('click', closeEditor);
    document.getElementById('cancelPatientAnamnesis')?.addEventListener('click', closeEditor);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeEditor();
    });

    document.getElementById('savePatientAnamnesis')?.addEventListener('click', async () => {
      const button = document.getElementById('savePatientAnamnesis');
      const weightRaw = (document.getElementById('caTheoreticalWeight')?.value || '').trim();
      const theoreticalWeight = weightRaw === '' ? null : Number(weightRaw.replace(',', '.'));

      if (theoreticalWeight !== null && (!Number.isFinite(theoreticalWeight) || theoreticalWeight <= 0)) {
        return alert('Inserisci un peso teorico valido.');
      }

      const values = {
        theoreticalWeight,
        work: value('caWork'),
        activity: value('caActivity'),
        smoking: value('caSmoking'),
        alcohol: value('caAlcohol'),
        diagnosis: value('caDiagnosis'),
        bowel: value('caBowel'),
        metabolism: value('caMetabolism'),
        feeg: value('caFeeg'),
        impedance: value('caImpedance'),
        familyObesity: checked('caFamilyObesity'),
        familyDiabetes: checked('caFamilyDiabetes'),
        familyHypertension: checked('caFamilyHypertension'),
        familyCardiovascular: checked('caFamilyCardiovascular'),
        familyDyslipidemia: checked('caFamilyDyslipidemia'),
        familyThyroid: checked('caFamilyThyroid'),
        previousDiets: value('caPreviousDiets'),
        allergies: value('caAllergies'),
        medications: value('caMedications'),
        giIssues: value('caGiIssues'),
        pastConditions: value('caPastConditions'),
        observations: value('caObservations'),
        objectives: value('caObjectives')
      };

      if (button) {
        button.disabled = true;
        button.textContent = 'Salvataggio...';
      }

      try {
        const saved = await services.savePatientAnamnesis(patientId, values);
        cache.set(patientId, saved);
        closeEditor();
        if (isAnamnesisTab() && currentPatientId() === patientId) renderProfile(patientId, saved);
      } catch (error) {
        console.error('NUBEMO professional clinical save anamnesis:', error);
        alert('Non è stato possibile salvare l’anamnesi.');
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = 'Salva modifiche';
        }
      }
    });
  }

  async function openEditor(patientId) {
    const row = patientsModule.getPatientById?.(patientId);
    if (!patientIsActive(row)) return alert('Paziente attivo non disponibile.');

    try {
      const profile = await loadProfile(patientId);
      openEditorWithProfile(patientId, profile);
    } catch (error) {
      console.error('NUBEMO professional clinical open anamnesis:', error);
      alert('Non è stato possibile caricare l’anamnesi.');
    }
  }

  function formatDate(date) {
    const parts = String(date || '').split('-');
    if (parts.length !== 3) return display(date);
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function formatMeasurement(value, suffix = '') {
    if (value === null || value === undefined || value === '') return '—';
    const number = Number(value);
    if (!Number.isFinite(number)) return display(value);
    return `${number.toFixed(1).replace('.', ',')}${suffix}`;
  }

  function measurementsHtml(rows, canEdit) {
    const bodyRows = rows.length
      ? rows.map(row => `
        <tr>
          <td>${formatDate(row.measured_at)}</td>
          <td>${formatMeasurement(row.weight_kg, ' kg')}</td>
          <td>${formatMeasurement(row.waist_cm)}</td>
          <td>${formatMeasurement(row.hips_cm)}</td>
          <td>${display(row.notes)}</td>
          <td>${canEdit ? `<button class="mini" data-nubemo-edit-measure="${esc(row.id)}">Modifica</button>` : ''}</td>
        </tr>`).join('')
      : '<tr><td colspan="6">Nessuna misura.</td></tr>';

    return `
      <div class="section-head">
        <h2>Misure</h2>
        ${canEdit ? '<button class="mini" id="nubemoNewPatientMeasure">＋ Aggiungi misura</button>' : ''}
      </div>
      <div class="measure-table-wrap">
        <table class="measure-table">
          <thead><tr><th>Data</th><th>Peso rilevato</th><th>Vita</th><th>Fianchi</th><th>Note</th><th></th></tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;
  }

  function closeMeasurementEditor() {
    document.getElementById('patientMeasurementOverlay')?.remove();
  }

  function numberValue(id) {
    const raw = String(document.getElementById(id)?.value || '').trim().replace(',', '.');
    if (raw === '') return null;
    const number = Number(raw);
    return Number.isFinite(number) ? number : NaN;
  }

  function todayIso() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function measurementById(patientId, measurementId) {
    return (measurementsCache.get(patientId) || []).find(row => row.id === measurementId) || null;
  }

  function openMeasurementEditor(patientId, measurementId = null) {
    const row = patientsModule.getPatientById?.(patientId);
    if (!patientIsActive(row)) return alert('Paziente attivo non disponibile.');

    const existing = measurementId ? measurementById(patientId, measurementId) : null;
    if (measurementId && !existing) return alert('Misurazione non disponibile.');

    closeMeasurementEditor();
    const overlay = document.createElement('div');
    overlay.id = 'patientMeasurementOverlay';
    overlay.className = 'clinical-overlay';
    overlay.innerHTML = `
      <section class="clinical-modal">
        <button class="monubi-x" id="closePatientMeasurement" type="button">×</button>
        <div class="eyebrow">SCHEDA PAZIENTE</div>
        <h2>${existing ? 'Modifica misurazione' : 'Nuova misurazione'}</h2>
        <label>Data</label>
        <input id="pmRemoteDate" type="date" value="${esc(existing?.measured_at || todayIso())}">
        <label>Peso rilevato dal professionista (kg)</label>
        <input id="pmRemoteWeight" type="number" min="30" max="300" step="0.1" value="${existing?.weight_kg ?? ''}" placeholder="Facoltativo">
        <label>Circonferenza vita (cm)</label>
        <input id="pmRemoteWaist" type="number" min="20" max="300" step="0.1" value="${existing?.waist_cm ?? ''}">
        <label>Circonferenza fianchi (cm)</label>
        <input id="pmRemoteHips" type="number" min="20" max="300" step="0.1" value="${existing?.hips_cm ?? ''}">
        <label>Note</label>
        <textarea id="pmRemoteNotes" rows="3">${esc(existing?.notes || '')}</textarea>
        <div class="pro3-actions">
          <button class="secondary" id="cancelPatientMeasurement" type="button">Annulla</button>
          <button class="primary" id="savePatientMeasurement" type="button">${existing ? 'Salva modifiche' : 'Salva misura'}</button>
        </div>
      </section>`;

    document.body.appendChild(overlay);
    document.getElementById('closePatientMeasurement')?.addEventListener('click', closeMeasurementEditor);
    document.getElementById('cancelPatientMeasurement')?.addEventListener('click', closeMeasurementEditor);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeMeasurementEditor();
    });

    document.getElementById('savePatientMeasurement')?.addEventListener('click', async () => {
      const button = document.getElementById('savePatientMeasurement');
      const measuredAt = String(document.getElementById('pmRemoteDate')?.value || '').trim();
      const weightKg = numberValue('pmRemoteWeight');
      const waistCm = numberValue('pmRemoteWaist');
      const hipsCm = numberValue('pmRemoteHips');
      const notesRaw = String(document.getElementById('pmRemoteNotes')?.value || '').trim();

      if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredAt)) return alert('Inserisci una data valida.');
      if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300)) return alert('Controlla il peso rilevato.');
      for (const [label, value] of [['vita', waistCm], ['fianchi', hipsCm]]) {
        if (value !== null && (!Number.isFinite(value) || value < 20 || value > 300)) return alert(`Controlla il valore ${label}.`);
      }

      const values = {
        measuredAt,
        weightKg,
        waistCm,
        hipsCm,
        notes: notesRaw === '' ? null : notesRaw
      };

      if (button) {
        button.disabled = true;
        button.textContent = 'Salvataggio...';
      }

      try {
        if (existing) {
          await services.updatePatientMeasurement(existing.id, values);
        } else {
          const userId = window.nubemoProfessionalContext?.user?.id || '';
          if (!userId) throw new Error('Authenticated professional user unavailable');
          await services.createPatientMeasurement(patientId, values, userId);
        }

        const rows = await loadMeasurements(patientId, true);
        closeMeasurementEditor();
        if (isMeasuresTab() && currentPatientId() === patientId) renderMeasurements(patientId, rows);
      } catch (error) {
        console.error('NUBEMO professional clinical save measurement:', error);
        if (error?.code === '23505') alert('Esiste già una misurazione per questa data.');
        else alert('Non è stato possibile salvare la misurazione.');
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = existing ? 'Salva modifiche' : 'Salva misura';
        }
      }
    });
  }

  function bindMeasurementActions(host, patientId, canEdit) {
    if (!canEdit) return;
    host.querySelector('#nubemoNewPatientMeasure')?.addEventListener('click', () => openMeasurementEditor(patientId));
    host.querySelectorAll('[data-nubemo-edit-measure]').forEach(button => {
      button.addEventListener('click', () => openMeasurementEditor(patientId, button.dataset.nubemoEditMeasure));
    });
  }

  function renderMeasurements(patientId, rows) {
    const canEdit = patientIsActive(currentPatient());
    replaceClinicalBody(
      'nubemoProfessionalMeasurements',
      patientId,
      measurementsHtml(rows || [], canEdit),
      bodySignature(rows || []),
      host => bindMeasurementActions(host, patientId, canEdit)
    );
  }

  function renderMeasurementsLoading(patientId) {
    replaceClinicalBody(
      'nubemoProfessionalMeasurements',
      patientId,
      '<p class="muted">Caricamento misure...</p>',
      'loading'
    );
  }

  function renderMeasurementsError(patientId) {
    replaceClinicalBody(
      'nubemoProfessionalMeasurements',
      patientId,
      '<p class="muted">Non è stato possibile caricare le misure.</p>',
      'error'
    );
  }

  async function syncMeasurements() {
    if (!isMeasuresTab()) return;
    const patientId = currentPatientId();
    if (!patientId) return;

    if (measurementsCache.has(patientId)) {
      renderMeasurements(patientId, measurementsCache.get(patientId));
      return;
    }

    renderMeasurementsLoading(patientId);
    try {
      const rows = await loadMeasurements(patientId);
      if (isMeasuresTab() && currentPatientId() === patientId) renderMeasurements(patientId, rows);
    } catch (error) {
      console.error('NUBEMO professional clinical load measurements:', error);
      if (isMeasuresTab() && currentPatientId() === patientId) renderMeasurementsError(patientId);
    }
  }

  function bindEditButton() {
    if (!isDetailsView()) return;
    const patientId = currentPatientId();
    const row = currentPatient();
    if (!patientId || !patientIsActive(row)) return;

    const legacy = document.getElementById('editPatientProfileTop');
    if (!legacy || legacy.dataset.nubemoClinical === '1') return;

    const button = legacy.cloneNode(true);
    button.dataset.nubemoClinical = '1';
    button.addEventListener('click', () => openEditor(patientId));
    legacy.replaceWith(button);
  }

  function syncView() {
    bindEditButton();
    void syncAnamnesis();
    void syncMeasurements();
  }

  async function reload(patientId = currentPatientId()) {
    if (!patientId) return null;
    const profile = await loadProfile(patientId, true);
    if (isAnamnesisTab() && currentPatientId() === patientId) renderProfile(patientId, profile);
    return profile;
  }

  async function reloadMeasurements(patientId = currentPatientId()) {
    if (!patientId) return [];
    const rows = await loadMeasurements(patientId, true);
    if (isMeasuresTab() && currentPatientId() === patientId) renderMeasurements(patientId, rows);
    return rows;
  }

  window.nubemoProfessionalClinical = Object.freeze({
    syncView,
    reload,
    reloadMeasurements,
    openEditor,
    openMeasurementEditor
  });

  syncView();
})();
