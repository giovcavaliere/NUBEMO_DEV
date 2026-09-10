// NUBEMO — Area Professionista shared Supabase services
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  if (!client) return;

  const ANAMNESIS_COLUMNS = [
    'patient_id','goal_weight_kg','min_weight_kg','max_weight_kg','reasonable_weight_kg',
    'theoretical_weight_kg','work','activity','activity_factor','smoking','alcohol','diagnosis',
    'bowel','metabolism','feeg','impedance','family_obesity','family_diabetes',
    'family_hypertension','family_cardiovascular','family_dyslipidemia','family_thyroid',
    'previous_diets','allergies','medications','gi_issues','past_conditions','observations','objectives'
  ].join(',');

  const MEASUREMENT_COLUMNS = 'id,patient_id,measured_at,weight_kg,waist_cm,hips_cm,notes,created_by_user_id,created_at,updated_at';
  const DOCUMENT_COLUMNS = 'id,patient_id,category,sub_category,title,document_date,document_number,valid_from,professional_note,original_filename,mime_type,size_bytes,storage_bucket,storage_path,uploaded_by_user_id,created_at,updated_at';
  const DIARY_COLUMNS = 'id,patient_id,entry_date,weight_kg,water,coffee,sweetener,breakfast,morning_snack,lunch,afternoon_snack,dinner,sport,notes,created_by_user_id,created_at,updated_at';
  const NOTE_COLUMNS = 'id,patient_id,professional_id,content,created_at,updated_at';
  const PLAN_COLUMNS = 'id,patient_id,professional_id,title,status,valid_from,valid_to,professional_note,created_at,updated_at';
  const LAB_REPORT_COLUMNS = 'id,patient_id,document_id,report_date,title,status,created_by_user_id,reviewed_by_professional_id,reviewed_at,created_at,updated_at';

  async function loadPatients(professionalId) {
    const { data: relationships, error: relationshipsError } = await client
      .from('professional_patients').select('patient_id,status,started_at,ended_at').eq('professional_id', professionalId);
    if (relationshipsError) throw relationshipsError;
    const patientIds = (relationships || []).map(row => row.patient_id);
    if (!patientIds.length) return { activePatients: [], endedPatients: [] };

    const { data: patientRows, error: patientsError } = await client
      .from('patients').select('id,profile_id,birth_date,sex,height_cm,pathway_start_date,status').in('id', patientIds);
    if (patientsError) throw patientsError;
    const profileIds = (patientRows || []).map(row => row.profile_id);
    const { data: patientProfiles, error: patientProfilesError } = await client
      .from('profiles').select('id,first_name,last_name,email,status').in('id', profileIds);
    if (patientProfilesError) throw patientProfilesError;

    const profilesById = new Map((patientProfiles || []).map(row => [row.id, row]));
    const relationshipsByPatient = new Map((relationships || []).map(row => [row.patient_id, row]));
    const combined = (patientRows || []).map(row => ({
      ...row,
      profile: profilesById.get(row.profile_id) || null,
      relationship: relationshipsByPatient.get(row.id) || null
    }));
    return {
      activePatients: combined.filter(row => row.relationship?.status !== 'ended'),
      endedPatients: combined.filter(row => row.relationship?.status === 'ended')
    };
  }

  async function updatePatientDemographics(row, values) {
    const { error: profileError } = await client.from('profiles')
      .update({ first_name: values.firstName, last_name: values.lastName }).eq('id', row.profile_id);
    if (profileError) throw profileError;
    const { error: patientError } = await client.from('patients').update({
      birth_date: values.birthDate, sex: values.sex, height_cm: values.height, pathway_start_date: values.pathwayStart
    }).eq('id', row.id);
    if (patientError) throw patientError;
  }

  async function setPatientPathwayStatus(professionalId, patientId, status) {
    const payload = status === 'ended' ? { status: 'ended', ended_at: new Date().toISOString() } : { status: 'active', ended_at: null };
    const { error } = await client.from('professional_patients').update(payload)
      .eq('professional_id', professionalId).eq('patient_id', patientId);
    if (error) throw error;
  }

  async function loadPatientClinicalProfile(patientId) {
    const { data, error } = await client.from('patient_clinical_profiles')
      .select(ANAMNESIS_COLUMNS).eq('patient_id', patientId).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  function anamnesisPayload(values) {
    return {
      theoretical_weight_kg: values.theoreticalWeight, work: values.work, activity: values.activity,
      smoking: values.smoking, alcohol: values.alcohol, diagnosis: values.diagnosis, bowel: values.bowel,
      metabolism: values.metabolism, feeg: values.feeg, impedance: values.impedance,
      family_obesity: values.familyObesity, family_diabetes: values.familyDiabetes,
      family_hypertension: values.familyHypertension, family_cardiovascular: values.familyCardiovascular,
      family_dyslipidemia: values.familyDyslipidemia, family_thyroid: values.familyThyroid,
      previous_diets: values.previousDiets, allergies: values.allergies, medications: values.medications,
      gi_issues: values.giIssues, past_conditions: values.pastConditions, observations: values.observations,
      objectives: values.objectives
    };
  }

  async function savePatientAnamnesis(patientId, values) {
    const existing = await loadPatientClinicalProfile(patientId);
    const payload = anamnesisPayload(values);
    if (existing) {
      const { data, error } = await client.from('patient_clinical_profiles').update(payload)
        .eq('patient_id', patientId).select(ANAMNESIS_COLUMNS).single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await client.from('patient_clinical_profiles')
      .insert({ patient_id: patientId, ...payload }).select(ANAMNESIS_COLUMNS).single();
    if (error) throw error;
    return data;
  }

  async function loadPatientMeasurements(patientId) {
    const { data, error } = await client.from('patient_measurements').select(MEASUREMENT_COLUMNS)
      .eq('patient_id', patientId).is('deleted_at', null).order('measured_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
  const measurementPayload = values => ({ measured_at: values.measuredAt, weight_kg: values.weightKg, waist_cm: values.waistCm, hips_cm: values.hipsCm, notes: values.notes });
  async function createPatientMeasurement(patientId, values, createdByUserId) {
    const { data, error } = await client.from('patient_measurements')
      .insert({ patient_id: patientId, created_by_user_id: createdByUserId, ...measurementPayload(values) })
      .select(MEASUREMENT_COLUMNS).single();
    if (error) throw error;
    return data;
  }
  async function updatePatientMeasurement(measurementId, values) {
    const { data, error } = await client.from('patient_measurements').update(measurementPayload(values))
      .eq('id', measurementId).select(MEASUREMENT_COLUMNS).single();
    if (error) throw error;
    return data;
  }

  async function loadPatientDiary(patientId) {
    const { data, error } = await client.from('diary_entries').select(DIARY_COLUMNS)
      .eq('patient_id', patientId).is('deleted_at', null).order('entry_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function loadPatientDocuments(patientId, category = null) {
    let query = client.from('documents').select(DOCUMENT_COLUMNS).eq('patient_id', patientId).is('deleted_at', null).order('created_at', { ascending: false });
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  function safeFileName(name) {
    return String(name || 'documento').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'documento';
  }

  async function uploadPatientDocument(patientId, file, meta = {}) {
    const userId = window.nubemoProfessionalContext?.user?.id;
    if (!userId) throw new Error('Authenticated user unavailable');
    const path = `${patientId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await client.storage.from('patient-documents').upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (uploadError) throw uploadError;
    const row = {
      patient_id: patientId,
      category: meta.category || 'document',
      sub_category: meta.subCategory || null,
      title: meta.title || file.name,
      document_date: meta.documentDate || null,
      document_number: meta.documentNumber || null,
      valid_from: meta.validFrom || null,
      professional_note: meta.professionalNote || null,
      original_filename: file.name,
      mime_type: file.type || null,
      size_bytes: Number.isFinite(file.size) ? file.size : null,
      storage_bucket: 'patient-documents',
      storage_path: path,
      uploaded_by_user_id: userId
    };
    const { data, error } = await client.from('documents').insert(row).select(DOCUMENT_COLUMNS).single();
    if (error) {
      await client.storage.from('patient-documents').remove([path]).catch(() => {});
      throw error;
    }
    return data;
  }

  async function openDocumentUrl(documentRow, expiresIn = 300) {
    const { data, error } = await client.storage.from(documentRow.storage_bucket).createSignedUrl(documentRow.storage_path, expiresIn);
    if (error) throw error;
    return data?.signedUrl || '';
  }

  async function loadLaboratoryReports(patientId) {
    const { data: reports, error } = await client.from('laboratory_reports').select(LAB_REPORT_COLUMNS)
      .eq('patient_id', patientId).is('deleted_at', null).order('report_date', { ascending: false, nullsFirst: false });
    if (error) throw error;
    if (!reports?.length) return [];
    const ids = reports.map(r => r.id);
    const { data: values, error: valuesError } = await client.from('laboratory_values')
      .select('id,report_id,test_code,test_name,value_text,value_numeric,unit,reference_min,reference_max,reference_text,notes,created_at,updated_at')
      .in('report_id', ids).order('test_name');
    if (valuesError) throw valuesError;
    const grouped = new Map();
    (values || []).forEach(v => { const arr = grouped.get(v.report_id) || []; arr.push(v); grouped.set(v.report_id, arr); });
    return reports.map(r => ({ ...r, values: grouped.get(r.id) || [] }));
  }

  async function createLaboratoryReport(patientId, values = {}) {
    const userId = window.nubemoProfessionalContext?.user?.id;
    const { data, error } = await client.from('laboratory_reports').insert({
      patient_id: patientId, document_id: values.documentId || null, report_date: values.reportDate || null,
      title: values.title || null, status: values.status || 'pending_review', created_by_user_id: userId
    }).select(LAB_REPORT_COLUMNS).single();
    if (error) throw error;
    return data;
  }

  async function saveLaboratoryValues(reportId, rows) {
    if (!rows?.length) return [];
    const payload = rows.map(r => ({ report_id: reportId, test_name: r.testName, test_code: r.testCode || null, value_text: r.valueText || null, value_numeric: r.valueNumeric ?? null, unit: r.unit || null, reference_min: r.referenceMin ?? null, reference_max: r.referenceMax ?? null, reference_text: r.referenceText || null, notes: r.notes || null }));
    const { data, error } = await client.from('laboratory_values').insert(payload).select();
    if (error) throw error;
    return data || [];
  }

  async function confirmLaboratoryReport(reportId) {
    const professionalId = window.nubemoProfessionalContext?.professional?.id;
    const { data, error } = await client.from('laboratory_reports').update({ status: 'confirmed', reviewed_by_professional_id: professionalId, reviewed_at: new Date().toISOString() })
      .eq('id', reportId).select(LAB_REPORT_COLUMNS).single();
    if (error) throw error;
    return data;
  }

  async function loadNutritionPlans(patientId) {
    const { data: plans, error } = await client.from('nutrition_plans').select(PLAN_COLUMNS)
      .eq('patient_id', patientId).is('deleted_at', null).order('created_at', { ascending: false });
    if (error) throw error;
    if (!plans?.length) return [];
    const planIds = plans.map(p => p.id);
    const { data: links, error: linkError } = await client.from('nutrition_plan_documents').select('nutrition_plan_id,document_id').in('nutrition_plan_id', planIds);
    if (linkError) throw linkError;
    const documentIds = [...new Set((links || []).map(x => x.document_id))];
    let docs = [];
    if (documentIds.length) {
      const { data, error: docsError } = await client.from('documents').select(DOCUMENT_COLUMNS).in('id', documentIds).is('deleted_at', null);
      if (docsError) throw docsError;
      docs = data || [];
    }
    const docsById = new Map(docs.map(d => [d.id, d]));
    return plans.map(p => ({ ...p, documents: (links || []).filter(l => l.nutrition_plan_id === p.id).map(l => docsById.get(l.document_id)).filter(Boolean) }));
  }

  async function createNutritionPlan(patientId, values = {}) {
    const professionalId = window.nubemoProfessionalContext?.professional?.id;
    const { data, error } = await client.from('nutrition_plans').insert({
      patient_id: patientId, professional_id: professionalId, title: values.title,
      status: values.status || 'draft', valid_from: values.validFrom || null, valid_to: values.validTo || null,
      professional_note: values.professionalNote || null
    }).select(PLAN_COLUMNS).single();
    if (error) throw error;
    return data;
  }

  async function updateNutritionPlan(planId, values = {}) {
    const payload = {};
    ['title','status'].forEach(k => { if (values[k] !== undefined) payload[k] = values[k]; });
    if (values.validFrom !== undefined) payload.valid_from = values.validFrom;
    if (values.validTo !== undefined) payload.valid_to = values.validTo;
    if (values.professionalNote !== undefined) payload.professional_note = values.professionalNote;
    const { data, error } = await client.from('nutrition_plans').update(payload).eq('id', planId).select(PLAN_COLUMNS).single();
    if (error) throw error;
    return data;
  }

  async function linkNutritionPlanDocument(planId, documentId) {
    const { error } = await client.from('nutrition_plan_documents').insert({ nutrition_plan_id: planId, document_id: documentId });
    if (error) throw error;
  }

  async function loadPrivacyStatus(profileId) {
    const { data: documents, error: docsError } = await client.from('privacy_documents')
      .select('id,document_type,version,title,storage_bucket,storage_path,published_at,active,created_at').eq('active', true).order('published_at', { ascending: false });
    if (docsError) throw docsError;
    const { data: acceptances, error: accError } = await client.from('privacy_acceptances')
      .select('id,profile_id,privacy_document_id,signed_document_id,accepted_at,created_at').eq('profile_id', profileId);
    if (accError) throw accError;
    const byDoc = new Map((acceptances || []).map(a => [a.privacy_document_id, a]));
    return (documents || []).map(d => ({ ...d, acceptance: byDoc.get(d.id) || null }));
  }

  async function loadProfessionalNotes(patientId) {
    const { data, error } = await client.from('professional_notes').select(NOTE_COLUMNS)
      .eq('patient_id', patientId).is('deleted_at', null).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
  async function createProfessionalNote(patientId, content) {
    const professionalId = window.nubemoProfessionalContext?.professional?.id;
    const { data, error } = await client.from('professional_notes').insert({ patient_id: patientId, professional_id: professionalId, content }).select(NOTE_COLUMNS).single();
    if (error) throw error;
    return data;
  }
  async function updateProfessionalNote(noteId, content) {
    const { data, error } = await client.from('professional_notes').update({ content }).eq('id', noteId).select(NOTE_COLUMNS).single();
    if (error) throw error;
    return data;
  }

  async function loadPatientAppointments(patientId) {
    const { data: links, error: linkError } = await client.from('appointment_patients').select('appointment_id,patient_id,created_at').eq('patient_id', patientId);
    if (linkError) throw linkError;
    const ids = (links || []).map(l => l.appointment_id);
    if (!ids.length) return [];
    const { data, error } = await client.from('appointments').select('id,professional_id,starts_at,ends_at,appointment_type,status,notes,created_by_user_id,created_at,updated_at')
      .in('id', ids).is('deleted_at', null).order('starts_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function createPatientAppointment(patientId, values) {
    const professionalId = window.nubemoProfessionalContext?.professional?.id;
    const userId = window.nubemoProfessionalContext?.user?.id;
    const { data, error } = await client.from('appointments').insert({
      professional_id: professionalId, starts_at: values.startsAt, ends_at: values.endsAt,
      appointment_type: values.appointmentType || null, status: values.status || 'scheduled', notes: values.notes || null,
      created_by_user_id: userId
    }).select().single();
    if (error) throw error;
    const { error: linkError } = await client.from('appointment_patients').insert({ appointment_id: data.id, patient_id: patientId });
    if (linkError) throw linkError;
    return data;
  }

  async function updatePatientAppointment(appointmentId, values) {
    const payload = { starts_at: values.startsAt, ends_at: values.endsAt, appointment_type: values.appointmentType || null, status: values.status || 'scheduled', notes: values.notes || null };
    const { data, error } = await client.from('appointments').update(payload).eq('id', appointmentId).select().single();
    if (error) throw error;
    return data;
  }

  window.nubemoProfessionalServices = Object.freeze({
    loadPatients, updatePatientDemographics, setPatientPathwayStatus,
    loadPatientClinicalProfile, savePatientAnamnesis,
    loadPatientMeasurements, createPatientMeasurement, updatePatientMeasurement,
    loadPatientDiary, loadPatientDocuments, uploadPatientDocument, openDocumentUrl,
    loadLaboratoryReports, createLaboratoryReport, saveLaboratoryValues, confirmLaboratoryReport,
    loadNutritionPlans, createNutritionPlan, updateNutritionPlan, linkNutritionPlanDocument,
    loadPrivacyStatus, loadProfessionalNotes, createProfessionalNote, updateProfessionalNote,
    loadPatientAppointments, createPatientAppointment, updatePatientAppointment
  });
})();
