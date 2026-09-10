// NUBEMO — Area Paziente / accesso dati Supabase
(() => {
  'use strict';
  const client = window.nubemoSupabase;
  const BUCKET = 'patient-documents';

  function throwIf(error, fallback) { if (error) throw new Error(error.message || fallback); }

  async function loadContext() {
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) throw new Error('Sessione non valida.');
    const { data: profile, error: profileError } = await client.from('profiles')
      .select('id,auth_user_id,first_name,last_name,email,role,status')
      .eq('auth_user_id', user.id).single();
    throwIf(profileError, 'Profilo non disponibile.');
    if (!profile || profile.role !== 'patient' || profile.status !== 'active') throw new Error('Accesso paziente non autorizzato.');

    const { data: patient, error: patientError } = await client.from('patients')
      .select('id,profile_id,birth_date,sex,height_cm,pathway_start_date,status')
      .eq('profile_id', profile.id).single();
    throwIf(patientError, 'Scheda paziente non disponibile.');

    const [{ data: relations, error: relError }, { data: clinical, error: clinicalError }, { data: settings, error: settingsError }] = await Promise.all([
      client.from('professional_patients').select('id,professional_id,patient_id,status,started_at,ended_at').eq('patient_id', patient.id).order('created_at', { ascending: false }),
      client.from('patient_clinical_profiles').select('*').eq('patient_id', patient.id).maybeSingle(),
      client.from('patient_settings').select('patient_id,settings_json').eq('patient_id', patient.id).maybeSingle()
    ]);
    throwIf(relError, 'Percorso non disponibile.'); throwIf(clinicalError, 'Profilo clinico non disponibile.'); throwIf(settingsError, 'Impostazioni non disponibili.');
    const activePathway = (relations || []).some(r => r.status !== 'ended');
    return { user, profile, patient, relations: relations || [], clinical: clinical || null, settings: settings?.settings_json || {}, activePathway };
  }

  async function loadDiary(patientId) {
    const { data, error } = await client.from('diary_entries').select('*').eq('patient_id', patientId).is('deleted_at', null).order('entry_date');
    throwIf(error); return data || [];
  }
  async function saveDiaryEntry(patientId, userId, values, existingId = null) {
    const payload = { patient_id: patientId, entry_date: values.entry_date, weight_kg: values.weight_kg, water: values.water, coffee: values.coffee, sweetener: values.sweetener, breakfast: values.breakfast, morning_snack: values.morning_snack, lunch: values.lunch, afternoon_snack: values.afternoon_snack, dinner: values.dinner, sport: values.sport, notes: values.notes, created_by_user_id: userId, deleted_at: null };
    let q = existingId ? client.from('diary_entries').update(payload).eq('id', existingId) : client.from('diary_entries').insert(payload);
    const { data, error } = await q.select('*').single(); throwIf(error); return data;
  }
  async function deleteDiaryEntry(id) { const { error } = await client.from('diary_entries').update({ deleted_at: new Date().toISOString() }).eq('id', id); throwIf(error); }

  async function loadSelfMeasurements(patientId) {
    const { data, error } = await client.from('patient_self_measurements').select('*').eq('patient_id', patientId).is('deleted_at', null).order('measured_at'); throwIf(error); return data || [];
  }
  async function loadProfessionalMeasurements(patientId) {
    const { data, error } = await client.from('patient_measurements').select('id,patient_id,measured_at,weight_kg,waist_cm,hips_cm,notes,created_at').eq('patient_id', patientId).is('deleted_at', null).order('measured_at'); throwIf(error); return data || [];
  }
  async function saveSelfMeasurement(patientId, userId, values, existingId = null) {
    const payload = { patient_id: patientId, measured_at: values.measured_at, waist_cm: values.waist_cm, hips_cm: values.hips_cm, notes: values.notes, created_by_user_id: userId, deleted_at: null };
    let q = existingId ? client.from('patient_self_measurements').update(payload).eq('id', existingId) : client.from('patient_self_measurements').insert(payload);
    const { data, error } = await q.select('*').single(); throwIf(error); return data;
  }
  async function deleteSelfMeasurement(id) { const { error } = await client.from('patient_self_measurements').update({ deleted_at: new Date().toISOString() }).eq('id', id); throwIf(error); }

  async function loadDocuments(patientId) {
    const { data, error } = await client.from('documents').select('*').eq('patient_id', patientId).is('deleted_at', null).order('created_at', { ascending: false }); throwIf(error); return data || [];
  }
  async function uploadPatientDocument(patientId, userId, file, meta) {
    const safe = String(file.name || 'documento').replace(/[^a-zA-Z0-9._-]+/g, '_');
    const path = `${patientId}/${crypto.randomUUID()}-${safe}`;
    const { error: uploadError } = await client.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    throwIf(uploadError, 'Upload non riuscito.');
    const { data, error } = await client.from('documents').insert({ patient_id: patientId, category: meta.category || 'health', sub_category: meta.sub_category || null, title: meta.title, document_date: meta.document_date || null, original_filename: file.name, mime_type: file.type || null, size_bytes: file.size, storage_bucket: BUCKET, storage_path: path, uploaded_by_user_id: userId }).select('*').single();
    if (error) { await client.storage.from(BUCKET).remove([path]); throw error; }
    if (meta.sub_category === 'blood_test') {
      const { error: labError } = await client.from('laboratory_reports').insert({ patient_id: patientId, document_id: data.id, report_date: meta.document_date || null, title: meta.title, status: 'pending_review', created_by_user_id: userId });
      throwIf(labError, 'Referto salvato ma coda esami non creata.');
    }
    return data;
  }
  async function openDocument(doc) {
    const { data, error } = await client.storage.from(doc.storage_bucket || BUCKET).createSignedUrl(doc.storage_path, 120); throwIf(error, 'Documento non apribile.');
    return data?.signedUrl || '';
  }

  async function loadPlans(patientId) {
    const { data, error } = await client.from('nutrition_plans').select('id,patient_id,professional_id,title,status,valid_from,valid_to,professional_note,created_at').eq('patient_id', patientId).is('deleted_at', null).order('valid_from', { ascending: false }); throwIf(error); return data || [];
  }
  async function loadPlanDocuments(planIds) {
    if (!planIds.length) return [];
    const { data, error } = await client.from('nutrition_plan_documents').select('nutrition_plan_id,document_id,created_at').in('nutrition_plan_id', planIds); throwIf(error); return data || [];
  }

  async function loadAppointments(patientId) {
    const { data: links, error: linkError } = await client.from('appointment_patients').select('appointment_id').eq('patient_id', patientId); throwIf(linkError);
    const ids = (links || []).map(x => x.appointment_id); if (!ids.length) return [];
    const { data, error } = await client.from('appointments').select('id,starts_at,ends_at,appointment_type,status,notes').in('id', ids).is('deleted_at', null).order('starts_at'); throwIf(error); return data || [];
  }

  async function loadPrivacy(profileId) {
    const [{ data: docs, error: docsError }, { data: acc, error: accError }] = await Promise.all([
      client.from('privacy_documents').select('*').eq('active', true).order('published_at', { ascending: false }),
      client.from('privacy_acceptances').select('*').eq('profile_id', profileId)
    ]);
    throwIf(docsError); throwIf(accError); return { documents: docs || [], acceptances: acc || [] };
  }
  async function acceptPrivacy(profileId, privacyDocumentId) {
    const { data, error } = await client.from('privacy_acceptances').insert({ profile_id: profileId, privacy_document_id: privacyDocumentId, accepted_at: new Date().toISOString() }).select('*').single(); throwIf(error); return data;
  }

  async function saveSettings(patientId, settings) {
    const { data, error } = await client.from('patient_settings').upsert({ patient_id: patientId, settings_json: settings }, { onConflict: 'patient_id' }).select('*').single(); throwIf(error); return data;
  }

  window.nubemoPatientServices = { loadContext, loadDiary, saveDiaryEntry, deleteDiaryEntry, loadSelfMeasurements, loadProfessionalMeasurements, saveSelfMeasurement, deleteSelfMeasurement, loadDocuments, uploadPatientDocument, openDocument, loadPlans, loadPlanDocuments, loadAppointments, loadPrivacy, acceptPrivacy, saveSettings };
})();
