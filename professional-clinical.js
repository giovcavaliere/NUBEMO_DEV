// NUBEMO — Area Professionista / modulo Clinico
// Primo perimetro migrato: Anamnesi del paziente su Supabase.
(() => {
  'use strict';

  const services = window.nubemoProfessionalServices;
  const patientsModule = window.nubemoProfessionalPatients;
  if (!services || !patientsModule) return;

  const cache = new Map();
  const pending = new Map();

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

  function clinicalBodyHost() {
    return document.querySelector('.patient-content-card');
  }

  function bodySignature(profile) {
    return JSON.stringify(profile || null);
  }

  function replaceClinicalBody(patientId, html, signature) {
    const card = clinicalBodyHost();
    if (!card) return;

    const existing = document.getElementById('nubemoProfessionalAnamnesis');
    if (
      existing &&
      existing.dataset.patientId === patientId &&
      existing._nubemoSignature === signature
    ) return;

    const head = card.querySelector(':scope > .patient-section-head');
    Array.from(card.children).forEach(child => {
      if (child !== head) child.remove();
    });

    const body = document.createElement('div');
    body.id = 'nubemoProfessionalAnamnesis';
    body.dataset.patientId = patientId;
    body._nubemoSignature = signature;
    body.innerHTML = html;
    card.appendChild(body);
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
      patientId,
      '<p class="muted">Caricamento anamnesi...</p>',
      'loading'
    );
  }

  function renderError(patientId) {
    replaceClinicalBody(
      patientId,
      '<p class="muted">Non è stato possibile caricare l’anamnesi.</p>',
      'error'
    );
  }

  function renderProfile(patientId, profile) {
    replaceClinicalBody(patientId, anamnesisHtml(profile), bodySignature(profile));
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
  }

  async function reload(patientId = currentPatientId()) {
    if (!patientId) return null;
    const profile = await loadProfile(patientId, true);
    if (isAnamnesisTab() && currentPatientId() === patientId) renderProfile(patientId, profile);
    return profile;
  }

  window.nubemoProfessionalClinical = Object.freeze({
    syncView,
    reload,
    openEditor
  });

  syncView();
})();
