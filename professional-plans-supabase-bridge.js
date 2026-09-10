// NUBEMO recovery 3.98 — bridge Piani alimentari PRO -> Supabase.
// Preserva integralmente il rendering 3.98 e sostituisce solo persistenza/apertura file.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const services = window.nubemoProfessionalServices;
  const context = window.nubemoProfessionalContext || {};
  const documentsBridge = () => window.nubemoProfessionalDocumentsBridge;
  if (!client || !services || !Array.isArray(context.patients)) return;

  const plansByDocument = new Map();
  const docsById = new Map();
  let currentPatientId = '';
  let busy = false;

  function patientName(row) {
    const p = row?.profile || {};
    return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || 'Paziente';
  }

  function inferPatientId() {
    if (currentPatientId && context.patients.some(p => p.id === currentPatientId)) return currentPatientId;
    const title = document.querySelector('.patient-global-title')?.textContent || '';
    const match = context.patients.find(p => title.includes(patientName(p)));
    if (match) currentPatientId = match.id;
    return currentPatientId;
  }

  function parseDate(value) {
    const s = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    return m ? `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}` : '';
  }

  async function hydrate() {
    plansByDocument.clear();
    docsById.clear();
    await Promise.all(context.patients.map(async patient => {
      const plans = await services.loadNutritionPlans(patient.id);
      (plans || []).forEach(plan => {
        (plan.documents || []).forEach(doc => {
          plansByDocument.set(doc.id, plan);
          docsById.set(doc.id, doc);
        });
      });
    }));
  }

  async function openPlan(documentId) {
    const doc = docsById.get(documentId);
    if (!doc) {
      // Il bridge Documenti potrebbe aver già idratato il file prima del piano.
      const all = await services.loadPatientDocuments(inferPatientId());
      const found = (all || []).find(d => d.id === documentId);
      if (!found) return alert('Piano alimentare non disponibile.');
      try {
        const url = await services.openDocumentUrl(found, 300);
        if (!url) throw new Error('URL piano non disponibile');
        window.location.href = url;
      } catch (error) {
        console.error('NUBEMO PRO open plan:', error);
        alert('Non riesco ad aprire il piano alimentare.');
      }
      return;
    }
    try {
      const url = await services.openDocumentUrl(doc, 300);
      if (!url) throw new Error('URL piano non disponibile');
      window.location.href = url;
    } catch (error) {
      console.error('NUBEMO PRO open plan:', error);
      alert('Non riesco ad aprire il piano alimentare.');
    }
  }

  function rerenderPlan() {
    const tab = document.querySelector('[data-patient-tab="plan"]');
    if (tab) tab.click();
    else window.location.reload();
  }

  async function publishPlan() {
    if (busy) return;
    const patientId = inferPatientId();
    const input = document.getElementById('planFile');
    const file = input?.files?.[0];
    const title = String(document.getElementById('planUploadTitle')?.value || '').trim();
    const validFrom = parseDate(document.getElementById('planValidFrom')?.value);
    const professionalNote = String(document.getElementById('planProfessionalNote')?.value || '').trim();
    if (!patientId) return alert('Paziente non disponibile.');
    if (!file) return alert('Seleziona un PDF.');
    if (!file.name.toLowerCase().endsWith('.pdf')) return alert('Seleziona un PDF.');
    if (!title) return alert('Inserisci il titolo del piano.');
    if (!validFrom) return alert('Inserisci la data di inizio validità.');

    busy = true;
    const button = document.getElementById('saveNewPlan');
    if (button) button.disabled = true;
    let uploaded = null;
    let plan = null;
    try {
      uploaded = await services.uploadPatientDocument(patientId, file, {
        category: 'plan', subCategory: 'meal_plan', title,
        documentDate: validFrom, validFrom, professionalNote: professionalNote || null
      });
      plan = await services.createNutritionPlan(patientId, {
        title, status: 'active', validFrom, professionalNote: professionalNote || null
      });
      await services.linkNutritionPlanDocument(plan.id, uploaded.id);
      await documentsBridge()?.refresh?.();
      await hydrate();
      rerenderPlan();
    } catch (error) {
      console.error('NUBEMO PRO publish plan:', error);
      if (plan?.id) await client.rpc('soft_delete_associated_nutrition_plan', { p_plan_id: plan.id }).catch(() => {});
      if (uploaded?.id) await client.rpc('soft_delete_associated_patient_document', { p_document_id: uploaded.id }).catch(() => {});
      alert('Non riesco a pubblicare il piano alimentare.');
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  }

  async function saveNote(documentId) {
    if (busy) return;
    const editor = document.querySelector(`[data-plan-note-editor="${documentId}"]`);
    const note = String(editor?.querySelector('textarea')?.value || '');
    const plan = plansByDocument.get(documentId);
    if (!plan) return alert('Piano alimentare non disponibile.');
    busy = true;
    try {
      const docUpdate = await client.from('documents').update({ professional_note: note || null }).eq('id', documentId);
      if (docUpdate.error) throw docUpdate.error;
      await services.updateNutritionPlan(plan.id, { professionalNote: note || null });
      await documentsBridge()?.refresh?.();
      await hydrate();
      rerenderPlan();
    } catch (error) {
      console.error('NUBEMO PRO save plan note:', error);
      alert('Non riesco ad aggiornare la nota del piano.');
    } finally { busy = false; }
  }

  async function deletePlan(documentId) {
    if (busy) return;
    const plan = plansByDocument.get(documentId);
    const doc = docsById.get(documentId);
    if (!plan || !doc) return alert('Piano alimentare non disponibile.');
    if (!confirm('Eliminare questo piano alimentare?')) return;
    busy = true;
    try {
      let r = await client.rpc('soft_delete_associated_nutrition_plan', { p_plan_id: plan.id });
      if (r.error) throw r.error;
      r = await client.rpc('soft_delete_associated_patient_document', { p_document_id: documentId });
      if (r.error) throw r.error;
      if (doc.storage_bucket && doc.storage_path) {
        const removal = await client.storage.from(doc.storage_bucket).remove([doc.storage_path]);
        if (removal.error) console.error('NUBEMO PRO orphan plan cleanup:', removal.error);
      }
      await documentsBridge()?.refresh?.();
      await hydrate();
      rerenderPlan();
    } catch (error) {
      console.error('NUBEMO PRO delete plan:', error);
      alert('Non riesco a eliminare il piano alimentare.');
    } finally { busy = false; }
  }

  document.addEventListener('click', event => {
    const patientButton = event.target?.closest?.('[data-patient]');
    if (patientButton?.dataset?.patient) currentPatientId = patientButton.dataset.patient;
    const drawerPatient = event.target?.closest?.('[data-drawer-patient]');
    if (drawerPatient?.dataset?.drawerPatient) currentPatientId = drawerPatient.dataset.drawerPatient;

    const open = event.target?.closest?.('[data-open-pro-plan]');
    if (open) {
      event.preventDefault(); event.stopImmediatePropagation();
      void openPlan(open.dataset.openProPlan); return;
    }
    const save = event.target?.closest?.('[data-save-plan-note]');
    if (save) {
      event.preventDefault(); event.stopImmediatePropagation();
      void saveNote(save.dataset.savePlanNote); return;
    }
    const del = event.target?.closest?.('[data-delete-pro-plan]');
    if (del) {
      event.preventDefault(); event.stopImmediatePropagation();
      void deletePlan(del.dataset.deleteProPlan); return;
    }
    if (event.target?.closest?.('#saveNewPlan')) {
      event.preventDefault(); event.stopImmediatePropagation();
      void publishPlan();
    }
  }, true);

  const ready = hydrate();
  window.nubemoProfessionalPlansBridge = Object.freeze({ ready, refresh: hydrate });
})();
