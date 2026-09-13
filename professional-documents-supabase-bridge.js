// NUBEMO recovery 3.98 — bridge Documenti PRO -> Supabase.
// Step 3B: metadata leggero globale per badge + dettaglio lazy per paziente.
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
  const hydratedPatients = new Set();
  const hydrationPromises = new Map();
  const replayClicks = new WeakSet();
  let currentPatientId = '';
  let busy = false;

  const esc = value => String(value ?? '');
  const parse = (v,f)=>{try{return JSON.parse(v)}catch(_){return f}};
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
      remote: true,
      _light: !doc.storage_path
    };
  }

  function readMeta(){return parse(memory.get(DOCUMENT_META_KEY)||'[]',[])}
  function writeMeta(rows){memory.set(DOCUMENT_META_KEY,JSON.stringify(rows))}

  async function hydrateLightMetadata() {
    const ids=context.patients.map(p=>p.id);
    if(!ids.length){writeMeta([]);return;}
    const {data,error}=await client.from('documents')
      .select('id,patient_id,category,sub_category,uploaded_by_user_id')
      .in('patient_id',ids).is('deleted_at',null);
    if(error)throw error;
    writeMeta((data||[]).map(legacyMeta));
  }

  async function ensurePatient(patientId,force=false) {
    if(!patientId)return;
    currentPatientId=patientId;
    if(!force&&hydratedPatients.has(patientId))return;
    if(!force&&hydrationPromises.has(patientId))return hydrationPromises.get(patientId);
    const promise=(async()=>{
      const docs=await services.loadPatientDocuments(patientId);
      for(const [id,row] of [...remoteDocuments.entries()]) if(row.patient_id===patientId) remoteDocuments.delete(id);
      (docs||[]).forEach(doc=>remoteDocuments.set(doc.id,doc));
      const keep=readMeta().filter(x=>x.patientId!==patientId);
      writeMeta([...keep,...(docs||[]).map(legacyMeta)]);
      hydratedPatients.add(patientId);
    })().finally(()=>hydrationPromises.delete(patientId));
    hydrationPromises.set(patientId,promise);
    return promise;
  }

  storageProto.getItem = function(key) {
    if (this === window.localStorage && String(key) === DOCUMENT_META_KEY) {
      return memory.has(DOCUMENT_META_KEY) ? memory.get(DOCUMENT_META_KEY) : null;
    }
    return previousGetItem.call(this, key);
  };

  storageProto.setItem = function(key, value) {
    if (this === window.localStorage && String(key) === DOCUMENT_META_KEY) {
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
    let row = remoteDocuments.get(id);
    if (!row) {
      await ensurePatient(inferPatientId());
      row=remoteDocuments.get(id);
    }
    if (!row) return alert('Documento non disponibile.');
    try {
      const url = await services.openDocumentUrl(row, 300);
      if (!url) throw new Error('URL documento non disponibile');
      try { await window.nubemoProfessionalDocumentReadBridge?.markRead?.(id); }
      catch (readError) { console.error('NUBEMO PRO document read status:', readError); }
      window.location.href = url;
    } catch (error) {
      console.error('NUBEMO PRO open document:', error);
      alert('Non riesco ad aprire il documento.');
    }
  }

  function rerenderDocuments() {
    const tab = document.querySelector('[data-patient-tab="documents"]');
    if (tab) tab.click(); else window.location.reload();
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
      await services.uploadPatientDocument(patientId, file, {category:'health',subCategory:'health_other',title,documentDate});
      await ensurePatient(patientId,true);
      rerenderDocuments();
    } catch (error) {
      console.error('NUBEMO PRO save health document:', error);
      alert('Non riesco a salvare il documento.');
    } finally { busy=false;if(button)button.disabled=false; }
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
    busy=true;const button=document.getElementById('saveProAccounting');if(button)button.disabled=true;
    try{
      await services.uploadPatientDocument(patientId,file,{category:'accounting',subCategory:'accounting',title,documentDate,documentNumber:documentNumber||null});
      await ensurePatient(patientId,true);rerenderDocuments();
    }catch(error){console.error('NUBEMO PRO save accounting document:',error);alert('Non riesco a pubblicare il documento contabile.');}
    finally{busy=false;if(button)button.disabled=false;}
  }

  function askDeleteRecordedLabValues(row) {
    const dateLabel = row.document_date ? new Date(row.document_date+'T12:00:00').toLocaleDateString('it-IT') : 'del referto';
    return confirm(`È presente anche la registrazione dei valori delle analisi del ${dateLabel}.\n\nVuoi eliminare anche i dati registrati?\n\nOK = elimina PDF + dati analisi\nAnnulla = elimina solo il PDF e mantiene i dati`);
  }

  async function bloodReportDeletionDecision(row) {
    const isBlood = row.category === 'health' && row.sub_category === 'blood_test';
    if (!isBlood || !row.patient_id) return { deleteReportIds: [] };
    const result = await client.from('laboratory_reports').select('id,document_id,report_date,status').eq('patient_id',row.patient_id).is('deleted_at',null);
    if(result.error)throw result.error;
    const reports=result.data||[],linked=reports.filter(r=>r.document_id===row.id),linkedPending=linked.filter(r=>r.status==='pending_review'),linkedConfirmed=linked.filter(r=>r.status==='confirmed');
    const deleteReportIds=linkedPending.map(r=>r.id);
    if(linkedConfirmed.length===1){if(askDeleteRecordedLabValues(row))deleteReportIds.push(linkedConfirmed[0].id);return{deleteReportIds:[...new Set(deleteReportIds)]};}
    if(linkedConfirmed.length>1){alert('A questo PDF risultano collegate più registrazioni di valori. Il PDF verrà eliminato, ma i dati saranno mantenuti per evitare una cancellazione ambigua.');return{deleteReportIds:[...new Set(deleteReportIds)]};}
    if(!row.document_date)return{deleteReportIds:[...new Set(deleteReportIds)]};
    const same=reports.filter(r=>r.status==='confirmed'&&r.report_date===row.document_date);
    if(same.length===1){if(askDeleteRecordedLabValues(row))deleteReportIds.push(same[0].id);}else if(same.length>1){alert(`Per il ${new Date(row.document_date+'T12:00:00').toLocaleDateString('it-IT')} risultano presenti più registrazioni di valori non collegate in modo univoco al PDF. Il PDF verrà eliminato, ma i dati saranno mantenuti.`);}
    return{deleteReportIds:[...new Set(deleteReportIds)]};
  }

  async function deleteRemote(id) {
    if(busy)return;
    let row=remoteDocuments.get(id);if(!row){await ensurePatient(inferPatientId());row=remoteDocuments.get(id);}
    if(!row)return alert('Documento non disponibile.');
    const isBlood=row.category==='health'&&row.sub_category==='blood_test';
    const firstConfirm=isBlood?`Eliminare il PDF delle analisi “${esc(row.title||row.original_filename||'Referto analisi')}”?\n\nNel passaggio successivo potrai scegliere se eliminare anche i dati registrati.`:`Eliminare “${esc(row.title||row.original_filename||'Documento')}” dalla cartella del paziente?`;
    if(!confirm(firstConfirm))return;
    busy=true;
    try{
      const {deleteReportIds}=await bloodReportDeletionDecision(row);
      for(const reportId of deleteReportIds){const labDelete=await client.rpc('soft_delete_associated_laboratory_report',{p_report_id:reportId});if(labDelete.error)throw labDelete.error;}
      const {error}=await client.rpc('soft_delete_associated_patient_document',{p_document_id:id});if(error)throw error;
      if(row.storage_bucket&&row.storage_path){const removal=await client.storage.from(row.storage_bucket).remove([row.storage_path]);if(removal.error)console.error('NUBEMO PRO orphan document cleanup:',removal.error);}
      await ensurePatient(row.patient_id,true);
      await window.nubemoProfessionalLabsBridge?.refresh?.(row.patient_id);
      rerenderDocuments();
    }catch(error){console.error('NUBEMO PRO delete document:',error);alert('Non riesco a eliminare il documento.');}
    finally{busy=false;}
  }

  document.addEventListener('click', event => {
    const patientButton=event.target?.closest?.('[data-patient]');if(patientButton?.dataset?.patient)currentPatientId=patientButton.dataset.patient;
    const drawerPatient=event.target?.closest?.('[data-drawer-patient]');if(drawerPatient?.dataset?.drawerPatient)currentPatientId=drawerPatient.dataset.drawerPatient;

    const lazyTab=event.target?.closest?.('[data-patient-tab="documents"],[data-drawer-tab="documents"]');
    if(lazyTab&&!replayClicks.has(lazyTab)){
      const patientId=inferPatientId();
      if(patientId&&!hydratedPatients.has(patientId)){
        event.preventDefault();event.stopImmediatePropagation();
        void ensurePatient(patientId).then(()=>{replayClicks.add(lazyTab);lazyTab.click();}).catch(error=>{console.error('NUBEMO PRO documents lazy:',error);replayClicks.add(lazyTab);lazyTab.click();});
        return;
      }
    } else if(lazyTab) replayClicks.delete(lazyTab);

    const open=event.target?.closest?.('[data-open-pro-document]');if(open){event.preventDefault();event.stopImmediatePropagation();void openRemote(open.dataset.openProDocument);return;}
    const del=event.target?.closest?.('[data-delete-pro-document]');if(del){event.preventDefault();event.stopImmediatePropagation();void deleteRemote(del.dataset.deleteProDocument);return;}
    if(event.target?.closest?.('#saveProDocument')){event.preventDefault();event.stopImmediatePropagation();void saveHealth();return;}
    if(event.target?.closest?.('#saveProAccounting')){event.preventDefault();event.stopImmediatePropagation();void saveAccounting();}
  },true);

  const ready=hydrateLightMetadata();
  window.nubemoProfessionalDocumentsBridge=Object.freeze({ready,ensurePatient,refresh:patientId=>ensurePatient(patientId||inferPatientId(),true)});
})();
