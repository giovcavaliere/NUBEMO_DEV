// NUBEMO recovery 3.98 — adattatore dati sincrono per il frontend legacy Paziente.
// Supabase resta la source of truth. I valori legacy esistono solo in memoria.
(() => {
  'use strict';

  const services = () => window.nubemoPatientServices;
  const KEY = 'diario-pro-patient-main-v1';
  const PROFILE_KEY = 'diario-pro-profile-main-v1';
  const MEASURE_KEY = 'diario-pro-measures-main-v1';
  const EXTRA_PATIENTS_KEY = 'diario-pro-extra-patients-v1';
  const ACCOUNT_KEY = 'diario-pro-accounts-v1';
  const ACTIVE_PATIENT_KEY = 'diario-pro-active-patient-v1';
  const PATIENT_APPT_KEY = 'diario-pro-appts-recovery-v1';
  const DOCUMENT_META_KEY = 'nubemo-documents-meta-v1';
  const PLAN_META_KEY = 'diario-pro-plan-meta-v1';
  const MANAGED_KEYS = new Set([KEY, PROFILE_KEY, MEASURE_KEY, EXTRA_PATIENTS_KEY, ACCOUNT_KEY, ACTIVE_PATIENT_KEY, PATIENT_APPT_KEY, DOCUMENT_META_KEY, PLAN_META_KEY]);

  const memory = new Map();
  const remoteDocuments = new Map();
  const openedPrivacyIds = new Set();
  let installed = false;
  let appBound = false;
  let context = null;
  let diaryRows = [];
  let measurementRows = [];
  let privacyState = { documents: [], acceptances: [] };
  let diaryQueue = Promise.resolve();
  let measurementQueue = Promise.resolve();

  const storageProto = Object.getPrototypeOf(window.localStorage);
  const nativeGetItem = storageProto.getItem;
  const nativeSetItem = storageProto.setItem;
  const nativeRemoveItem = storageProto.removeItem;

  function json(value) { return JSON.stringify(value); }
  function parse(value, fallback) { try { return JSON.parse(value); } catch (_) { return fallback; } }
  function numberOrNull(value) {
    if (value === '' || value === undefined || value === null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function esc(value='') { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
  function fmtShort(iso) { if (!iso) return 'Data non indicata'; const d=new Date(`${iso}T12:00:00`); return Number.isNaN(d.getTime())?iso:d.toLocaleDateString('it-IT'); }
  function italianDateToIso(value) {
    const m=String(value||'').trim().match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if(!m)return '';
    const iso=`${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    const d=new Date(`${iso}T12:00:00`);
    return !Number.isNaN(d.getTime())&&d.getFullYear()===Number(m[3])&&d.getMonth()+1===Number(m[2])&&d.getDate()===Number(m[1])?iso:'';
  }

  function legacyDiary(row) {
    return {
      date: row.entry_date,
      weight: row.weight_kg ?? '',
      water: row.water ?? '',
      coffee: Number(row.coffee || 0),
      sweetener: row.sweetener || '',
      breakfast: row.breakfast || '',
      snack1: row.morning_snack || '',
      lunch: row.lunch || '',
      snack2: row.afternoon_snack || '',
      dinner: row.dinner || '',
      notes: [row.sport, row.notes].filter(Boolean).join(row.sport && row.notes ? '\n' : '')
    };
  }

  function remoteDiary(entry) {
    return {
      entry_date: entry.date,
      weight_kg: numberOrNull(entry.weight),
      water: numberOrNull(entry.water),
      coffee: Number(entry.coffee || 0),
      sweetener: entry.sweetener || null,
      breakfast: entry.breakfast || null,
      morning_snack: entry.snack1 || null,
      lunch: entry.lunch || null,
      afternoon_snack: entry.snack2 || null,
      dinner: entry.dinner || null,
      sport: null,
      notes: entry.notes || null
    };
  }

  function legacyMeasurement(row) {
    return { date: row.measured_at, waist: row.waist_cm ?? '', hips: row.hips_cm ?? '', notes: row.notes || '' };
  }

  function legacyAppointment(row) {
    const start = new Date(row.starts_at);
    const localDate = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString();
    return { id: row.id, patientId: 'main', date: localDate.slice(0,10), time: localDate.slice(11,16), type: row.appointment_type || 'Visita', notes: row.notes || '', status: row.status || 'scheduled' };
  }

  function legacyProfile(ctx) {
    const p = ctx.profile || {}, patient = ctx.patient || {}, c = ctx.clinical || {};
    return {
      firstName: p.first_name || '', name: p.first_name || '', surname: p.last_name || '', birth: patient.birth_date || '', height: patient.height_cm ?? '', sex: patient.sex || '',
      goal: c.goal_weight_kg ?? '', minWeight: c.min_weight_kg ?? '', maxWeight: c.max_weight_kg ?? '', reasonableWeight: c.reasonable_weight_kg ?? '', theoreticalWeight: c.theoretical_weight_kg ?? '',
      work: c.work || '', activity: c.activity || '', activityFactor: c.activity_factor ?? '', smoking: c.smoking || '', alcohol: c.alcohol || '', diagnosis: c.diagnosis || '', bowel: c.bowel || '', metabolism: c.metabolism || '', feeg: c.feeg || '', impedance: c.impedance || '',
      famObesity: !!c.family_obesity, famDiabetes: !!c.family_diabetes, famHypertension: !!c.family_hypertension, famCardiovascular: !!c.family_cardiovascular, famDyslipidemia: !!c.family_dyslipidemia, famThyroid: !!c.family_thyroid,
      previousDiets: c.previous_diets || '', allergies: c.allergies || '', medications: c.medications || '', giIssues: c.gi_issues || '', pastConditions: c.past_conditions || '', observations: c.observations || '', objectives: c.objectives || '',
      showEnergyValues: false,
      readOnly: !ctx.activePathway
    };
  }

  function reportSyncError(domain, error) {
    console.error(`NUBEMO Patient Supabase sync (${domain}):`, error);
    window.dispatchEvent(new CustomEvent('nubemo:supabase-sync-error', { detail: { domain, message: error?.message || String(error) } }));
  }

  async function syncDiary(serialized) {
    const incoming = parse(serialized, []);
    if (!Array.isArray(incoming)) return;
    const byDate = new Map(diaryRows.map(row => [row.entry_date, row]));
    const incomingDates = new Set(incoming.map(x => x?.date).filter(Boolean));
    for (const row of diaryRows) if (!incomingDates.has(row.entry_date)) await services().deleteDiaryEntry(row.id);
    for (const entry of incoming) {
      if (!entry?.date) continue;
      const existing = byDate.get(entry.date);
      await services().saveDiaryEntry(context.patient.id, context.user.id, remoteDiary(entry), existing?.id || null);
    }
    diaryRows = await services().loadDiary(context.patient.id);
    memory.set(KEY, json(diaryRows.map(legacyDiary)));
  }

  async function syncMeasurements(serialized) {
    const incoming = parse(serialized, []);
    if (!Array.isArray(incoming)) return;
    const byDate = new Map(measurementRows.map(row => [row.measured_at, row]));
    const incomingDates = new Set(incoming.map(x => x?.date).filter(Boolean));
    for (const row of measurementRows) if (!incomingDates.has(row.measured_at)) await services().deleteSelfMeasurement(row.id);
    for (const entry of incoming) {
      if (!entry?.date) continue;
      const existing = byDate.get(entry.date);
      await services().saveSelfMeasurement(context.patient.id, context.user.id, { measured_at: entry.date, waist_cm: numberOrNull(entry.waist), hips_cm: numberOrNull(entry.hips), notes: entry.notes || null }, existing?.id || null);
    }
    measurementRows = await services().loadSelfMeasurements(context.patient.id);
    memory.set(MEASURE_KEY, json(measurementRows.map(legacyMeasurement)));
  }

  function installVirtualStorage() {
    if (installed) return;
    installed = true;
    storageProto.getItem = function(key) {
      if (this === window.localStorage && MANAGED_KEYS.has(String(key))) return memory.has(String(key)) ? memory.get(String(key)) : null;
      return nativeGetItem.call(this, key);
    };
    storageProto.setItem = function(key, value) {
      const k = String(key);
      if (this !== window.localStorage || !MANAGED_KEYS.has(k)) return nativeSetItem.call(this, key, value);
      const v = String(value); memory.set(k, v);
      if (k === KEY) diaryQueue = diaryQueue.then(() => syncDiary(v)).catch(error => reportSyncError('diario', error));
      else if (k === MEASURE_KEY) measurementQueue = measurementQueue.then(() => syncMeasurements(v)).catch(error => reportSyncError('misure', error));
    };
    storageProto.removeItem = function(key) {
      const k = String(key);
      if (this === window.localStorage && MANAGED_KEYS.has(k)) { memory.delete(k); return; }
      return nativeRemoveItem.call(this, key);
    };
  }

  async function hydrateDocuments() {
    const [docs, plans, privacy] = await Promise.all([
      services().loadDocuments(context.patient.id),
      services().loadPlans(context.patient.id),
      services().loadPrivacy(context.profile.id)
    ]);
    privacyState = privacy || {documents:[],acceptances:[]};
    remoteDocuments.clear();
    (docs || []).forEach(doc => remoteDocuments.set(doc.id, doc));

    const planLinks = await services().loadPlanDocuments((plans || []).map(p => p.id));
    const planByDoc = new Map();
    for (const link of planLinks || []) {
      const plan = (plans || []).find(p => p.id === link.nutrition_plan_id);
      if (plan) planByDoc.set(link.document_id, plan);
    }

    const meta = (docs || []).map(doc => {
      const plan = planByDoc.get(doc.id);
      return {
        id: doc.id,
        patientId: 'main',
        category: plan ? 'plan' : (doc.category || 'document'),
        subCategory: doc.sub_category || null,
        title: doc.title || doc.original_filename || 'Documento',
        documentDate: doc.document_date || '',
        documentNumber: doc.document_number || null,
        validFrom: plan?.valid_from || doc.valid_from || null,
        fileName: doc.original_filename || 'Documento',
        mimeType: doc.mime_type || 'application/octet-stream',
        fileSize: doc.size_bytes || null,
        uploadedAt: doc.created_at || '',
        unreadForPatient: false,
        remote: true
      };
    });
    memory.set(DOCUMENT_META_KEY, json(meta));
    memory.set(PLAN_META_KEY, '{}');
  }

  async function openRemoteDocument(id) {
    const doc = remoteDocuments.get(id);
    if (!doc) return alert('Documento non disponibile.');
    try {
      const url = await services().openDocument(doc);
      if (!url) throw new Error('URL documento non disponibile.');
      window.location.href = url;
    } catch (error) {
      console.error('NUBEMO patient open document:', error);
      alert('Non riesco ad aprire il documento.');
    }
  }

  function bindRemoteDocumentsPage() {
    const input = document.getElementById('patientDocumentFile');
    const form = document.getElementById('patientDocumentForm');
    let selectedFile = null;
    let selectedSubCategory = 'other';
    const startUpload = subCategory => {
      if (!context.activePathway) return alert('NUBEMO è in modalità di sola consultazione.');
      selectedSubCategory = subCategory;
      if (input) { input.value=''; input.click(); }
    };

    document.getElementById('chooseBloodTestDocument')?.addEventListener('click', () => startUpload('blood_test'));
    document.getElementById('chooseOtherHealthDocument')?.addEventListener('click', () => startUpload('other'));
    if (input) input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      if (file.size > 10*1024*1024) { input.value=''; return alert('Il documento supera il limite di 10 MB.'); }
      selectedFile = file;
      const name = document.getElementById('patientDocumentFileName'); if (name) name.textContent=file.name;
      const title = document.getElementById('patientDocumentTitle'); if (title) title.value=String(file.name).replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ');
      const heading = document.getElementById('patientDocumentFormHeading'); if (heading) heading.textContent=selectedSubCategory==='blood_test'?'Nuove analisi del sangue':'Nuovo documento sanitario';
      if (form) { form.hidden=false; form.scrollIntoView({behavior:'smooth',block:'start'}); }
    };
    const picker=document.getElementById('patientDocumentDatePicker');
    if(picker)picker.onchange=()=>{const field=document.getElementById('patientDocumentDate');if(field&&picker.value){const [y,m,d]=picker.value.split('-');field.value=`${d}-${m}-${y}`;}};
    document.getElementById('cancelPatientDocument')?.addEventListener('click',()=>{if(input)input.value='';selectedFile=null;if(form)form.hidden=true;});
    document.getElementById('savePatientDocument')?.addEventListener('click',async()=>{
      if(!selectedFile)return alert('Seleziona un file.');
      const title=String(document.getElementById('patientDocumentTitle')?.value||'').trim();
      const date=italianDateToIso(document.getElementById('patientDocumentDate')?.value||'');
      if(!title)return alert('Inserisci il titolo del documento.');
      if(!date)return alert('Inserisci la data nel formato GG-MM-AAAA.');
      const button=document.getElementById('savePatientDocument');if(button){button.disabled=true;button.textContent='Salvataggio...';}
      try{
        await services().uploadPatientDocument(context.patient.id,context.user.id,selectedFile,{category:'health',sub_category:selectedSubCategory,title,document_date:date});
        await hydrateDocuments();
        window.render?.();
      }catch(error){console.error('NUBEMO patient upload document:',error);alert('Non riesco a salvare il documento.');if(button){button.disabled=false;button.textContent='Salva documento';}}
    });
    document.querySelectorAll('[data-open-patient-document]').forEach(button=>button.addEventListener('click',()=>openRemoteDocument(button.dataset.openPatientDocument)));
    document.querySelectorAll('[data-open-patient-plan]').forEach(button=>button.addEventListener('click',()=>openRemoteDocument(button.dataset.openPatientPlan)));
  }

  function patchGenericDocuments() {
    if (document.body.dataset.page !== 'documents') return;
    document.getElementById('nubemoGenericDocuments')?.remove();
    const generic = [...remoteDocuments.values()].filter(d => d.category === 'document');
    const host = document.querySelector('#app .card');
    if (!host) return;
    const card=document.createElement('section');card.className='card';card.id='nubemoGenericDocuments';
    card.innerHTML=`<div class="section-head"><h2>Documenti</h2><span class="pill">${generic.length}</span></div><p class="muted">Documenti pubblicati dal professionista.</p>${generic.length?`<div class="document-list">${generic.map(d=>`<div class="document-row"><div><b>${esc(d.title||d.original_filename||'Documento')}</b><span>${fmtShort(d.document_date)} · ${esc(d.original_filename||'Documento')}</span></div><button class="secondary compact" type="button" data-open-generic-document="${d.id}">Apri</button></div>`).join('')}</div>`:'<p class="muted">Nessun documento pubblicato.</p>'}`;
    host.insertAdjacentElement('afterend',card);
    card.querySelectorAll('[data-open-generic-document]').forEach(button=>button.addEventListener('click',()=>openRemoteDocument(button.dataset.openGenericDocument)));
  }

  function patchPrivacy() {
    if (document.body.dataset.page !== 'documents') return;
    document.getElementById('nubemoPrivacyDocuments')?.remove();
    const genericCard=document.getElementById('nubemoGenericDocuments') || document.querySelector('#app .card');
    if(!genericCard)return;
    const docs=privacyState.documents||[], accepted=new Set((privacyState.acceptances||[]).map(a=>a.privacy_document_id));
    const card=document.createElement('section');card.className='card';card.id='nubemoPrivacyDocuments';
    card.innerHTML=`<div class="section-head"><h2>Privacy</h2><span class="pill">${docs.length}</span></div>${docs.length?`<div class="document-list">${docs.map(d=>`<div class="document-row"><div><b>${esc(d.title||'Informativa privacy')}</b><span>Versione ${esc(d.version||'—')}${accepted.has(d.id)?' · Accettata':''}</span></div><div class="head-actions"><button class="secondary compact" type="button" data-open-privacy="${d.id}">Apri</button>${accepted.has(d.id)?'':`<button class="primary compact" type="button" data-accept-privacy="${d.id}" ${openedPrivacyIds.has(d.id)?'':'disabled'}>Accetta</button>`}</div></div>`).join('')}</div>`:'<p class="muted">Nessuna informativa attiva.</p>'}`;
    genericCard.insertAdjacentElement('afterend',card);
    card.querySelectorAll('[data-open-privacy]').forEach(button=>button.addEventListener('click',async()=>{
      const doc=docs.find(d=>d.id===button.dataset.openPrivacy);if(!doc)return;
      try{const url=await services().openDocument(doc);openedPrivacyIds.add(doc.id);const accept=card.querySelector(`[data-accept-privacy="${doc.id}"]`);if(accept)accept.disabled=false;window.open(url,'_blank','noopener');}catch(error){console.error('NUBEMO privacy open:',error);alert('Non riesco ad aprire l’informativa.');}
    }));
    card.querySelectorAll('[data-accept-privacy]').forEach(button=>button.addEventListener('click',async()=>{
      if(!openedPrivacyIds.has(button.dataset.acceptPrivacy))return alert('Apri prima l’informativa privacy.');
      button.disabled=true;
      try{await services().acceptPrivacy(context.profile.id,button.dataset.acceptPrivacy);privacyState=await services().loadPrivacy(context.profile.id);patchPrivacy();}catch(error){console.error('NUBEMO privacy accept:',error);alert('Non è stato possibile registrare l’accettazione.');button.disabled=false;}
    }));
  }

  function stripLegacyDataTransferControls() {
    if(document.body.dataset.page!=='trend')return;
    document.querySelectorAll('#app button').forEach(button=>{
      const text=String(button.textContent||'').trim();
      const onclick=String(button.getAttribute('onclick')||'');
      if(/Importa storico|Backup|Ripristina/i.test(text)||/showImport|exportBackup|restoreBackup/i.test(onclick))button.remove();
    });
    document.getElementById('backupFile')?.remove();
  }

  function patchLegacyUi() {
    stripLegacyDataTransferControls();
    patchGenericDocuments();
    patchPrivacy();
  }

  function bindLegacyApp() {
    if(appBound)return;appBound=true;
    window.openStoredDocument=openRemoteDocument;
    window.openPatientPlan=openRemoteDocument;
    window.bindDocumentsPage=bindRemoteDocumentsPage;
    const root=document.getElementById('app');
    if(root){
      let scheduled=false;
      const observer=new MutationObserver(()=>{
        if(scheduled)return;
        scheduled=true;
        queueMicrotask(()=>{
          scheduled=false;
          observer.disconnect();
          try{patchLegacyUi();}
          finally{observer.observe(root,{childList:true,subtree:true});}
        });
      });
      observer.observe(root,{childList:true,subtree:true});
    }
    patchLegacyUi();
  }

  async function init(ctx) {
    if (!ctx?.patient?.id || !ctx?.user?.id) throw new Error('Contesto paziente incompleto.');
    context = ctx;
    const [diary, measures, appointments] = await Promise.all([
      services().loadDiary(ctx.patient.id), services().loadSelfMeasurements(ctx.patient.id), services().loadAppointments(ctx.patient.id)
    ]);
    diaryRows = diary; measurementRows = measures;
    memory.set(KEY, json(diary.map(legacyDiary)));
    memory.set(PROFILE_KEY, json(legacyProfile(ctx)));
    memory.set(MEASURE_KEY, json(measures.map(legacyMeasurement)));
    memory.set(EXTRA_PATIENTS_KEY, '[]');
    memory.set(ACCOUNT_KEY, json({ main: { active: true, username: ctx.profile?.email || 'supabase' } }));
    memory.set(ACTIVE_PATIENT_KEY, 'main');
    memory.set(PATIENT_APPT_KEY, json(appointments.map(legacyAppointment)));
    memory.set(DOCUMENT_META_KEY,'[]');memory.set(PLAN_META_KEY,'{}');
    installVirtualStorage();
    await hydrateDocuments();
  }

  async function flush() { await Promise.all([diaryQueue, measurementQueue]); }

  window.nubemoPatientLegacyAdapter = Object.freeze({ init, flush, bindLegacyApp, refreshDocuments:hydrateDocuments });
})();
