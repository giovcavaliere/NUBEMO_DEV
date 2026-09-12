// NUBEMO recovery 3.98 — bridge Documenti PRO -> Supabase.
// Mantiene il DOM e i flussi della 3.98; sostituisce solo metadata/blob locali.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const services = window.nubemoProfessionalServices;
  const context = window.nubemoProfessionalContext || {};
  if (!client || !services || !Array.isArray(context.patients)) return;

  const DOCUMENT_META_KEY = 'nubemo-documents-meta-v1';
  const storageProto = Object.getPrototypeOf(window.localStorage);
  const previousGetItem = storageProto.getItem;
  const previousSetItem = storageProto.setItem;
  const previousRemoveItem = storageProto.removeItem;

  const memory = new Map();
  const remoteDocuments = new Map();
  let currentPatientId = '';
  let readyPromise = null;
  let busy = false;

  const esc = value => String(value ?? '');
  const dateValue = id => {
    const direct = document.getElementById(id)?.value || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
    const text = document.querySelector(`[data-date-text-for="${id}"]`)?.value || direct;
    const m = String(text).trim().match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    return m ? `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}` : '';
  };

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

  function legacyMeta(doc) {
    const healthSub = doc.sub_category === 'health_other' ? 'other' : (doc.sub_category || null);
    return {
      id: doc.id,
      patientId: doc.patient_id,
      category: doc.category || 'document',
      subCategory: healthSub,
      title: doc.title || doc.original_filename || 'Documento',
      documentDate: doc.document_date || '',
      documentNumber: doc.document_number || null,
      validFrom: doc.valid_from || null,
      professionalNote: doc.professional_note || '',
      fileName: doc.original_filename || 'Documento',
      mimeType: doc.mime_type || 'application/octet-stream',
      fileSize: doc.size_bytes || null,
      uploadedBy: doc.uploaded_by_user_id === context.user?.id ? 'professional' : 'patient',
      uploadedAt: doc.created_at || '',
      unreadForProfessional: false,
      unreadForPatient: false,
      remote: true
    };
  }

  async function hydrate() {
    const all = (await Promise.all(context.patients.map(p => services.loadPatientDocuments(p.id)))).flat();
    remoteDocuments.clear();
    all.forEach(doc => remoteDocuments.set(doc.id, doc));
    memory.set(DOCUMENT_META_KEY, JSON.stringify(all.map(legacyMeta)));
  }

  storageProto.getItem = function(key) {
    if (this === window.localStorage && String(key) === DOCUMENT_META_KEY) {
      return memory.has(DOCUMENT_META_KEY) ? memory.get(DOCUMENT_META_KEY) : null;
    }
    return previousGetItem.call(this, key);
  };

  storageProto.setItem = function(key, value) {
    if (this === window.localStorage && String(key) === DOCUMENT_META_KEY) {
      // Le variazioni di stato puramente UI della 3.98 restano nella sessione.
      // Upload/delete reali vengono gestiti esplicitamente sotto.
      memory.set(DOCUMENT_META_KEY, String(value));
      return;
    }
    return previousSetItem.call(this, key, value);
  };

  storageProto.removeItem = function(key) {
    if (this === window.localStorage && String(key) === DOCUMENT_META_KEY) {
      memory.delete(DOCUMENT_META_KEY);
      return;
    }
    return previousRemoveItem.call(this, key);
  };

  async function openRemote(id) {
    const row = remoteDocuments.get(id);
    if (!row) return alert('Documento non disponibile.');
    try {
      const url = await services.openDocumentUrl(row, 300);
      if (!url) throw new Error('URL documento non disponibile');
      try {
        await window.nubemoProfessionalDocumentReadBridge?.markRead?.(id);
      } catch (readError) {
        console.error('NUBEMO PRO document read status:', readError);
      }
      window.location.href = url;
    } catch (error) {
      console.error('NUBEMO PRO open document:', error);
      alert('Non riesco ad aprire il documento.');
    }
  }

  function rerenderDocuments() {
    const tab = document.querySelector('[data-patient-tab="documents"]');
    if (tab) tab.click();
    else window.location.reload();
  }

  async function saveHealth() {
    if (busy) return;
    const patientId = inferPatientId();
    const input = document.getElementById('proDocumentFile');
    const file = input?.files?.[0];
    const title = String(document.getElementById('proDocumentTitle')?.value || '').trim();
    const documentDate = dateValue('proDocumentDate');
    if (!patientId) return alert('Paziente non disponibile.');
    if (!file) return alert('Seleziona un file.');
    if (!title) return alert('Inserisci il titolo del documento.');
    if (!documentDate) return alert('Inserisci una data valida.');
    busy = true;
    const button = document.getElementById('saveProDocument');
    if (button) button.disabled = true;
    try {
      await services.uploadPatientDocument(patientId, file, {
        category: 'health', subCategory: 'health_other', title, documentDate
      });
      await hydrate();
      rerenderDocuments();
    } catch (error) {
      console.error('NUBEMO PRO save health document:', error);
      alert('Non riesco a salvare il documento.');
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  }

  async function saveAccounting() {
    if (busy) return;
    const patientId = inferPatientId();
    const input = document.getElementById('proAccountingFile');
    const file = input?.files?.[0];
    const title = String(document.getElementById('proAccountingTitle')?.value || '').trim();
    const documentNumber = String(document.getElementById('proAccountingNumber')?.value || '').trim();
    const documentDate = dateValue('proAccountingDate');
    if (!patientId) return alert('Paziente non disponibile.');
    if (!file) return alert('Seleziona un file.');
    if (!title) return alert('Inserisci il titolo del documento.');
    if (!documentDate) return alert('Inserisci una data valida.');
    busy = true;
    const button = document.getElementById('saveProAccounting');
    if (button) button.disabled = true;
    try {
      await services.uploadPatientDocument(patientId, file, {
        category: 'accounting', subCategory: 'accounting', title, documentDate,
        documentNumber: documentNumber || null
      });
      await hydrate();
      rerenderDocuments();
    } catch (error) {
      console.error('NUBEMO PRO save accounting document:', error);
      alert('Non riesco a pubblicare il documento contabile.');
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  }

  async function bloodReportDeletionDecision(row) {
    const isBlood = row.category === 'health' && row.sub_category === 'blood_test';
    if (!isBlood || !row.patient_id || !row.document_date) return { deleteReportIds: [] };

    const result = await client.from('laboratory_reports')
      .select('id,document_id,report_date,status')
      .eq('patient_id', row.patient_id)
      .eq('report_date', row.document_date)
      .is('deleted_at', null);
    if (result.error) throw result.error;

    const reports = result.data || [];
    const linkedPending = reports.filter(r => r.document_id === row.id && r.status === 'pending_review');
    const confirmed = reports.filter(r => r.status === 'confirmed');
    const deleteReportIds = linkedPending.map(r => r.id);

    if (confirmed.length === 1) {
      if (confirm(`Vuoi eliminare anche la registrazione dei valori del ${new Date(row.document_date+'T12:00:00').toLocaleDateString('it-IT')}?`)) {
        deleteReportIds.push(confirmed[0].id);
      }
    } else if (confirmed.length > 1) {
      alert(`Per il ${new Date(row.document_date+'T12:00:00').toLocaleDateString('it-IT')} risultano presenti più registrazioni di valori. Il PDF verrà eliminato, ma i valori saranno mantenuti per evitare una cancellazione ambigua.`);
    }
    return { deleteReportIds: [...new Set(deleteReportIds)] };
  }

  async function deleteRemote(id) {
    if (busy) return;
    const row = remoteDocuments.get(id);
    if (!row) return alert('Documento non disponibile.');
    if (!confirm(`Eliminare “${esc(row.title || row.original_filename || 'Documento')}” dalla cartella del paziente?`)) return;
    busy = true;
    try {
      const { deleteReportIds } = await bloodReportDeletionDecision(row);
      for (const reportId of deleteReportIds) {
        const labDelete = await client.rpc('soft_delete_associated_laboratory_report', { p_report_id: reportId });
        if (labDelete.error) throw labDelete.error;
      }

      const { error } = await client.rpc('soft_delete_associated_patient_document', { p_document_id: id });
      if (error) throw error;
      if (row.storage_bucket && row.storage_path) {
        const removal = await client.storage.from(row.storage_bucket).remove([row.storage_path]);
        if (removal.error) console.error('NUBEMO PRO orphan document cleanup:', removal.error);
      }
      await hydrate();
      await window.nubemoProfessionalLabsBridge?.refresh?.();
      rerenderDocuments();
    } catch (error) {
      console.error('NUBEMO PRO delete document:', error);
      alert('Non riesco a eliminare il documento.');
    } finally { busy = false; }
  }

  document.addEventListener('click', event => {
    const patientButton = event.target?.closest?.('[data-patient]');
    if (patientButton?.dataset?.patient) currentPatientId = patientButton.dataset.patient;
    const drawerPatient = event.target?.closest?.('[data-drawer-patient]');
    if (drawerPatient?.dataset?.drawerPatient) currentPatientId = drawerPatient.dataset.drawerPatient;

    const open = event.target?.closest?.('[data-open-pro-document]');
    if (open) {
      event.preventDefault(); event.stopImmediatePropagation();
      void openRemote(open.dataset.openProDocument); return;
    }
    const del = event.target?.closest?.('[data-delete-pro-document]');
    if (del) {
      event.preventDefault(); event.stopImmediatePropagation();
      void deleteRemote(del.dataset.deleteProDocument); return;
    }
    if (event.target?.closest?.('#saveProDocument')) {
      event.preventDefault(); event.stopImmediatePropagation();
      void saveHealth(); return;
    }
    if (event.target?.closest?.('#saveProAccounting')) {
      event.preventDefault(); event.stopImmediatePropagation();
      void saveAccounting();
    }
  }, true);

  readyPromise = hydrate();
  window.nubemoProfessionalDocumentsBridge = Object.freeze({ ready: readyPromise, refresh: hydrate });
})();
