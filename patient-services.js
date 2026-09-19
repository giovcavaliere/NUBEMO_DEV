// NUBEMO — Area Paziente / accesso dati Supabase
(() => {
  'use strict';
  const client = window.nubemoSupabase;
  const BUCKET = 'patient-documents';
  let activePathwayId = null;

  function throwIf(error, fallback) { if (error) throw new Error(error.message || fallback); }
  function requireActivePathway() {
    if (!activePathwayId) throw new Error('Nessun percorso attivo.');
    return activePathwayId;
  }

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

    const [{ data: pathwayId, error: pathwayError }, { data: pending, error: pendingError }] = await Promise.all([
      client.rpc('current_active_pathway_id'),
      client.rpc('get_current_patient_pending_pathways')
    ]);
    throwIf(pathwayError, 'Percorso attivo non disponibile.');
    throwIf(pendingError, 'Proposte di percorso non disponibili.');
    activePathwayId = pathwayId || null;

    let clinical = null;
    let settings = {};
    let latestHeight = null;
    if (activePathwayId) {
      const [clinicalResult, settingsResult, heightResult] = await Promise.all([
        client.from('patient_clinical_profiles').select('*').eq('pathway_id', activePathwayId).maybeSingle(),
        client.from('patient_settings').select('pathway_id,settings_json').eq('pathway_id', activePathwayId).maybeSingle(),
        client.from('patient_measurements').select('height_cm,measured_at,created_at')
          .eq('pathway_id', activePathwayId).is('deleted_at', null).not('height_cm', 'is', null)
          .order('measured_at', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle()
      ]);
      throwIf(clinicalResult.error, 'Profilo clinico non disponibile.');
      throwIf(settingsResult.error, 'Impostazioni non disponibili.');
      throwIf(heightResult.error, 'Altezza non disponibile.');
      clinical = clinicalResult.data || null;
      settings = settingsResult.data?.settings_json || {};
      latestHeight = heightResult.data?.height_cm ?? null;
    }

    return {
      user,
      profile,
      patient: { ...patient, height_cm: latestHeight ?? patient.height_cm ?? null },
      clinical,
      settings,
      activePathway: activePathwayId ? { id: activePathwayId } : null,
      pendingPathways: Array.isArray(pending) ? pending : []
    };
  }

  async function acceptPendingPathway(pathwayId) {
    const { data, error } = await client.rpc('accept_current_patient_pathway', { p_pathway_id: pathwayId });
    throwIf(error, 'Non è stato possibile attivare il percorso.');
    activePathwayId = data || pathwayId;
    return activePathwayId;
  }

  async function loadDiary() {
    const pathwayId = requireActivePathway();
    const { data, error } = await client.from('diary_entries').select('*')
      .eq('pathway_id', pathwayId).is('deleted_at', null).order('entry_date');
    throwIf(error); return data || [];
  }

  async function saveDiaryEntry(patientId, userId, values, existingId = null) {
    const pathwayId = requireActivePathway();
    const payload = {
      pathway_id:pathwayId, patient_id:patientId, entry_date:values.entry_date, weight_kg:values.weight_kg,
      water:values.water, coffee:values.coffee, sweetener:values.sweetener, breakfast:values.breakfast,
      morning_snack:values.morning_snack, lunch:values.lunch, afternoon_snack:values.afternoon_snack,
      dinner:values.dinner, sport:values.sport, notes:values.notes, created_by_user_id:userId, deleted_at:null
    };
    const q = existingId ? client.from('diary_entries').update(payload).eq('id', existingId) : client.from('diary_entries').insert(payload);
    const { data, error } = await q.select('*').single(); throwIf(error); return data;
  }

  async function deleteDiaryEntry(id) {
    const { error } = await client.rpc('soft_delete_own_diary_entry', { p_entry_id:id });
    throwIf(error, 'Non è stato possibile eliminare la giornata.');
  }

  async function loadSelfMeasurements() {
    const pathwayId = requireActivePathway();
    const { data, error } = await client.from('patient_self_measurements').select('*')
      .eq('pathway_id', pathwayId).is('deleted_at', null).order('measured_at');
    throwIf(error); return data || [];
  }

  async function loadProfessionalMeasurements() {
    const pathwayId = requireActivePathway();
    const { data, error } = await client.from('patient_measurements')
      .select('id,patient_id,pathway_id,measured_at,height_cm,weight_kg,waist_cm,hips_cm,notes,created_at')
      .eq('pathway_id', pathwayId).is('deleted_at', null).order('measured_at');
    throwIf(error); return data || [];
  }

  async function saveSelfMeasurement(patientId,userId,values,existingId=null) {
    const pathwayId = requireActivePathway();
    const payload = { pathway_id:pathwayId, patient_id:patientId, measured_at:values.measured_at, waist_cm:values.waist_cm, hips_cm:values.hips_cm, notes:values.notes, created_by_user_id:userId, deleted_at:null };
    const q = existingId ? client.from('patient_self_measurements').update(payload).eq('id',existingId) : client.from('patient_self_measurements').insert(payload);
    const { data, error } = await q.select('*').single(); throwIf(error); return data;
  }

  async function deleteSelfMeasurement(id) {
    const { data, error } = await client.rpc('soft_delete_own_patient_self_measurement',{p_measurement_id:id});
    throwIf(error,'Non è stato possibile eliminare la misurazione.');
    if (data !== true) throw new Error('Misurazione non eliminata.');
  }

  async function loadDocuments() {
    const pathwayId = requireActivePathway();
    const { data, error } = await client.from('documents').select('*')
      .eq('pathway_id', pathwayId).is('deleted_at',null).order('created_at',{ascending:false});
    throwIf(error);
    return (data||[]).map(row=>row.sub_category==='health_other'?{...row,sub_category:'other'}:row);
  }

  async function uploadPatientDocument(patientId,userId,file,meta) {
    const pathwayId = requireActivePathway();
    const dbSubCategory = meta.sub_category==='other'?'health_other':(meta.sub_category||null);
    const safe = String(file.name||'documento').replace(/[^a-zA-Z0-9._-]+/g,'_');
    const path = `${patientId}/${crypto.randomUUID()}-${safe}`;
    const { error:uploadError } = await client.storage.from(BUCKET).upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
    throwIf(uploadError,'Upload non riuscito.');
    const { data, error } = await client.from('documents').insert({
      pathway_id:pathwayId, patient_id:patientId, category:meta.category||'health', sub_category:dbSubCategory,
      title:meta.title, document_date:meta.document_date||null, original_filename:file.name, mime_type:file.type||null,
      size_bytes:file.size, storage_bucket:BUCKET, storage_path:path, uploaded_by_user_id:userId
    }).select('*').single();
    if(error){await client.storage.from(BUCKET).remove([path]);throw error;}
    if(dbSubCategory==='blood_test'){
      const {error:labError}=await client.from('laboratory_reports').insert({
        pathway_id:pathwayId, patient_id:patientId, document_id:data.id, report_date:meta.document_date||null,
        title:meta.title, status:'pending_review', created_by_user_id:userId
      });
      throwIf(labError,'Referto salvato ma coda esami non creata.');
    }
    return data;
  }

  async function openDocument(doc){
    const {data,error}=await client.storage.from(doc.storage_bucket||BUCKET).createSignedUrl(doc.storage_path,120);
    throwIf(error,'Documento non apribile.'); return data?.signedUrl||'';
  }

  async function loadPlans(){
    const pathwayId = requireActivePathway();
    const {data,error}=await client.from('nutrition_plans')
      .select('id,patient_id,pathway_id,professional_id,title,status,valid_from,valid_to,professional_note,created_at')
      .eq('pathway_id',pathwayId).is('deleted_at',null).order('valid_from',{ascending:false});
    throwIf(error);return data||[];
  }

  async function loadPlanDocuments(planIds){
    if(!planIds.length)return[];
    const {data,error}=await client.from('nutrition_plan_documents').select('nutrition_plan_id,document_id,created_at').in('nutrition_plan_id',planIds);
    throwIf(error);return data||[];
  }

  async function loadAppointments(){
    const pathwayId = requireActivePathway();
    const {data:links,error:linkError}=await client.from('appointment_patients').select('appointment_id').eq('pathway_id',pathwayId);
    throwIf(linkError);
    const ids=(links||[]).map(x=>x.appointment_id);if(!ids.length)return[];
    const {data,error}=await client.from('appointments').select('id,starts_at,ends_at,appointment_type,status,notes').in('id',ids).is('deleted_at',null).order('starts_at');
    throwIf(error);return data||[];
  }

  async function loadPrivacy(profileId){
    const [{data:docs,error:docsError},{data:acc,error:accError}]=await Promise.all([
      client.from('privacy_documents').select('*').eq('active',true).order('published_at',{ascending:false}),
      client.from('privacy_acceptances').select('*').eq('profile_id',profileId)
    ]);
    throwIf(docsError);throwIf(accError);return{documents:docs||[],acceptances:acc||[]};
  }

  async function acceptPrivacy(profileId,privacyDocumentId){
    const {data,error}=await client.from('privacy_acceptances').insert({profile_id:profileId,privacy_document_id:privacyDocumentId,accepted_at:new Date().toISOString()}).select('*').single();
    throwIf(error);return data;
  }

  async function saveSettings(patientId,settings){
    const pathwayId = requireActivePathway();
    const {data,error}=await client.from('patient_settings')
      .upsert({pathway_id:pathwayId,patient_id:patientId,settings_json:settings},{onConflict:'pathway_id'})
      .select('*').single();
    throwIf(error);return data;
  }

  window.nubemoPatientServices=Object.freeze({
    loadContext,acceptPendingPathway,loadDiary,saveDiaryEntry,deleteDiaryEntry,loadSelfMeasurements,
    loadProfessionalMeasurements,saveSelfMeasurement,deleteSelfMeasurement,loadDocuments,uploadPatientDocument,
    openDocument,loadPlans,loadPlanDocuments,loadAppointments,loadPrivacy,acceptPrivacy,saveSettings
  });
})();
