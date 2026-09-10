// NUBEMO recovery 3.98 — adattatore dati per il frontend PRO originale.
// Il frontend resta owner di DOM/flussi; Supabase resta source of truth.
// Le chiavi legacy cliniche vengono virtualizzate solo in memoria.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const services = () => window.nubemoProfessionalServices;

  const KEY = 'diario-pro-patient-main-v1';
  const PROFILE_KEY = 'diario-pro-profile-main-v1';
  const MEASURE_KEY = 'diario-pro-measures-main-v1';
  const APPT_KEY = 'diario-pro-appts-recovery-v1';
  const NOTES_KEY = 'diario-pro-notes-recovery-v1';
  const EXTRA_PATIENTS_KEY = 'diario-pro-extra-patients-v1';
  const DEMO_MEASURES_KEY = 'diario-pro-demo-measures-overrides-v1';
  const DELETED_PATIENTS_KEY = 'diario-pro-deleted-patients-v1';
  const ACCOUNT_KEY = 'diario-pro-accounts-v1';
  const PATIENT_START_DATE_KEY = 'diario-pro-patient-start-dates-v1';

  const MANAGED_KEYS = new Set([
    KEY, PROFILE_KEY, MEASURE_KEY, APPT_KEY, NOTES_KEY,
    EXTRA_PATIENTS_KEY, DEMO_MEASURES_KEY, DELETED_PATIENTS_KEY,
    ACCOUNT_KEY, PATIENT_START_DATE_KEY
  ]);

  const memory = new Map();
  const legacyAppointmentIds = new Map();
  let installed = false;
  let context = null;
  let remotePatients = new Map();
  let remoteMeasurements = new Map();
  let remoteAppointments = [];
  let patientQueue = Promise.resolve();
  let appointmentQueue = Promise.resolve();

  const storageProto = Object.getPrototypeOf(window.localStorage);
  const nativeGetItem = storageProto.getItem;
  const nativeSetItem = storageProto.setItem;
  const nativeRemoveItem = storageProto.removeItem;

  const json = value => JSON.stringify(value);
  const parse = (value, fallback) => { try { return JSON.parse(value); } catch (_) { return fallback; } };
  const numberOrNull = value => {
    if (value === '' || value === undefined || value === null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  function reportSyncError(domain, error) {
    console.error(`NUBEMO PRO Supabase sync (${domain}):`, error);
    window.dispatchEvent(new CustomEvent('nubemo:supabase-sync-error', {
      detail: { domain, message: error?.message || String(error) }
    }));
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

  function legacyMeasurement(row) {
    return {
      _remoteId: row.id,
      date: row.measured_at,
      professionalWeight: row.weight_kg ?? '',
      waist: row.waist_cm ?? '',
      hips: row.hips_cm ?? '',
      notes: row.notes || ''
    };
  }

  function legacyPatient(row, clinical, diary, measurements) {
    const profile = row.profile || {};
    const entries = (diary || []).slice().sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date))).map(legacyDiary);
    const weights = entries.filter(x => x.weight !== '' && x.weight != null).map(x => [x.date, Number(x.weight)]);
    return {
      id: row.id,
      profileId: row.profile_id,
      name: [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || profile.email || 'Paziente',
      firstName: profile.first_name || '',
      surname: profile.last_name || '',
      email: profile.email || '',
      birth: row.birth_date || '',
      sex: row.sex || '',
      height: row.height_cm ?? '',
      startDate: row.pathway_start_date || row.relationship?.started_at?.slice?.(0, 10) || '',
      status: row.status || '',
      relationshipStatus: row.relationship?.status || 'active',
      goal: clinical?.goal_weight_kg ?? '',
      minWeight: clinical?.min_weight_kg ?? '',
      maxWeight: clinical?.max_weight_kg ?? '',
      reasonableWeight: clinical?.reasonable_weight_kg ?? '',
      theoreticalWeight: clinical?.theoretical_weight_kg ?? '',
      work: clinical?.work || '',
      activity: clinical?.activity || '',
      activityFactor: clinical?.activity_factor ?? '',
      smoking: clinical?.smoking || '',
      alcohol: clinical?.alcohol || '',
      diagnosis: clinical?.diagnosis || '',
      bowel: clinical?.bowel || '',
      metabolism: clinical?.metabolism || '',
      feeg: clinical?.feeg || '',
      impedance: clinical?.impedance || '',
      famObesity: !!clinical?.family_obesity,
      famDiabetes: !!clinical?.family_diabetes,
      famHypertension: !!clinical?.family_hypertension,
      famCardiovascular: !!clinical?.family_cardiovascular,
      famDyslipidemia: !!clinical?.family_dyslipidemia,
      famThyroid: !!clinical?.family_thyroid,
      famGestational: false,
      previousDiets: clinical?.previous_diets || '',
      allergies: clinical?.allergies || '',
      medications: clinical?.medications || '',
      giIssues: clinical?.gi_issues || '',
      pastConditions: clinical?.past_conditions || '',
      observations: clinical?.observations || '',
      objectives: clinical?.objectives || '',
      showEnergyValues: false,
      readOnly: false,
      weights,
      diary: entries,
      entries,
      measures: (measurements || []).map(legacyMeasurement),
      real: true,
      remote: true
    };
  }

  function legacyAppointment(row, patientId) {
    const start = new Date(row.starts_at);
    const end = new Date(row.ends_at || row.starts_at);
    const local = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString();
    const duration = Math.max(1, Math.round((end - start) / 60000) || 30);
    const label = String(row.appointment_type || '').toLowerCase();
    const type = label.includes('prima') || label === 'first' ? 'first'
      : label.includes('personal') || label.includes('impegno') || label === 'personal' ? 'personal'
      : 'control';
    return {
      id: legacyAppointmentIds.get(row.id) || row.id,
      patientId: type === 'personal' ? null : (patientId || null),
      date: local.slice(0, 10),
      time: local.slice(11, 16),
      type,
      duration,
      title: type === 'personal' ? (row.notes || 'Impegno personale') : '',
      note: type === 'personal' ? '' : (row.notes || '')
    };
  }

  function clinicalValues(p) {
    return {
      goalWeight: numberOrNull(p.goal), minWeight: numberOrNull(p.minWeight), maxWeight: numberOrNull(p.maxWeight),
      reasonableWeight: numberOrNull(p.reasonableWeight), theoreticalWeight: numberOrNull(p.theoreticalWeight),
      work: p.work || null, activity: p.activity || null, activityFactor: numberOrNull(p.activityFactor),
      smoking: p.smoking || null, alcohol: p.alcohol || null, diagnosis: p.diagnosis || null,
      bowel: p.bowel || null, metabolism: p.metabolism || null, feeg: p.feeg || null, impedance: p.impedance || null,
      familyObesity: !!p.famObesity, familyDiabetes: !!p.famDiabetes, familyHypertension: !!p.famHypertension,
      familyCardiovascular: !!p.famCardiovascular, familyDyslipidemia: !!p.famDyslipidemia, familyThyroid: !!p.famThyroid,
      previousDiets: p.previousDiets || null, allergies: p.allergies || null, medications: p.medications || null,
      giIssues: p.giIssues || null, pastConditions: p.pastConditions || null, observations: p.observations || null,
      objectives: p.objectives || null
    };
  }

  async function syncPatientMeasurements(patientId, incoming) {
    const existingRows = remoteMeasurements.get(patientId) || [];
    const byDate = new Map(existingRows.map(x => [x.measured_at, x]));
    for (const m of Array.isArray(incoming) ? incoming : []) {
      if (!m?.date) continue;
      const old = byDate.get(m.date);
      const values = { measuredAt:m.date, weightKg:numberOrNull(m.professionalWeight), waistCm:numberOrNull(m.waist), hipsCm:numberOrNull(m.hips), notes:m.notes || null };
      if (old) await services().updatePatientMeasurement(old.id, values);
      else await services().createPatientMeasurement(patientId, values, context.user.id);
    }
    remoteMeasurements.set(patientId, await services().loadPatientMeasurements(patientId));
  }

  async function syncPatients(serialized) {
    const incoming = parse(serialized, []);
    if (!Array.isArray(incoming)) return;
    const known = new Set(remotePatients.keys());

    for (const p of incoming) {
      if (!p?.id || !known.has(p.id)) continue;
      const row = remotePatients.get(p.id);
      await services().updatePatientDemographics(row, {
        firstName:p.firstName || String(p.name || '').trim().split(/\s+/)[0] || '', lastName:p.surname || '',
        birthDate:p.birth || null, sex:p.sex || null, height:numberOrNull(p.height), pathwayStart:p.startDate || null
      });
      await services().savePatientAnamnesis(p.id, clinicalValues(p));
      await syncPatientMeasurements(p.id, p.measures);
    }

    const incomingIds = new Set(incoming.map(p => p?.id).filter(id => known.has(id)));
    for (const id of known) if (!incomingIds.has(id)) await services().setPatientPathwayStatus(context.professional.id, id, 'ended');
    if (typeof window.nubemoReloadProfessionalPatients === 'function') await window.nubemoReloadProfessionalPatients();
  }

  function appointmentPayload(a) {
    const start = new Date(`${a.date}T${a.time || '00:00'}:00`);
    if (Number.isNaN(start.getTime())) throw new Error('Data o ora appuntamento non valida.');
    const duration = Math.max(1, Number(a.duration) || 30);
    const end = new Date(start.getTime() + duration * 60000);
    return {
      starts_at:start.toISOString(), ends_at:end.toISOString(),
      appointment_type:a.type === 'first' ? 'Prima visita' : a.type === 'personal' ? 'Impegno personale' : 'Controllo',
      status:'scheduled', notes:a.type === 'personal' ? (a.title || a.note || null) : (a.note || null)
    };
  }

  async function createAppointment(a) {
    const { data, error } = await client.from('appointments').insert({
      professional_id:context.professional.id, created_by_user_id:context.user.id, ...appointmentPayload(a)
    }).select('*').single();
    if (error) throw error;
    legacyAppointmentIds.set(data.id, a.id);
    if (a.type !== 'personal' && a.patientId) {
      const { error: linkError } = await client.from('appointment_patients').insert({appointment_id:data.id, patient_id:a.patientId});
      if (linkError) { await client.rpc('soft_delete_own_professional_appointment',{p_appointment_id:data.id}); throw linkError; }
    }
    return data;
  }

  async function updateAppointment(remote, a) {
    const { error } = await client.from('appointments').update(appointmentPayload(a)).eq('id', remote.id);
    if (error) throw error;
    const { data:links, error:linkReadError } = await client.from('appointment_patients').select('patient_id').eq('appointment_id', remote.id);
    if (linkReadError) throw linkReadError;
    const oldPatientId = links?.[0]?.patient_id || null;
    const newPatientId = a.type === 'personal' ? null : (a.patientId || null);
    if (oldPatientId && oldPatientId !== newPatientId) {
      const { error:delError } = await client.from('appointment_patients').delete().eq('appointment_id',remote.id).eq('patient_id',oldPatientId);
      if (delError) throw delError;
    }
    if (newPatientId && oldPatientId !== newPatientId) {
      const { error:addError } = await client.from('appointment_patients').insert({appointment_id:remote.id,patient_id:newPatientId});
      if (addError) throw addError;
    }
  }

  async function syncAppointments(serialized) {
    const incoming = parse(serialized, []);
    if (!Array.isArray(incoming)) return;
    const remoteByLegacyId = new Map(remoteAppointments.map(x => [legacyAppointmentIds.get(x.id) || x.id, x]));
    const retainedRemoteIds = new Set();

    for (const a of incoming) {
      if (!a?.date) continue;
      const remote = remoteByLegacyId.get(a.id);
      if (remote) { retainedRemoteIds.add(remote.id); await updateAppointment(remote, a); }
      else { const created = await createAppointment(a); retainedRemoteIds.add(created.id); }
    }

    for (const remote of remoteAppointments) {
      if (!retainedRemoteIds.has(remote.id)) {
        const { error } = await client.rpc('soft_delete_own_professional_appointment',{p_appointment_id:remote.id});
        if (error) throw error;
      }
    }
    await hydrateAppointments();
  }

  async function hydrateAppointments() {
    const { data:rows, error } = await client.from('appointments')
      .select('id,professional_id,starts_at,ends_at,appointment_type,status,notes,created_by_user_id,created_at,updated_at')
      .eq('professional_id',context.professional.id).is('deleted_at',null).order('starts_at');
    if (error) throw error;
    remoteAppointments = rows || [];
    const ids = remoteAppointments.map(x => x.id);
    let links = [];
    if (ids.length) {
      const result = await client.from('appointment_patients').select('appointment_id,patient_id').in('appointment_id',ids);
      if (result.error) throw result.error;
      links = result.data || [];
    }
    const patientByAppointment = new Map(links.map(x => [x.appointment_id,x.patient_id]));
    memory.set(APPT_KEY,json(remoteAppointments.map(row => legacyAppointment(row,patientByAppointment.get(row.id)||null))));
  }

  async function hydratePatients() {
    const rows = Array.isArray(context.patients) ? context.patients : [];
    const resolved = await Promise.all(rows.map(async row => {
      const [clinical, diary, measurements] = await Promise.all([
        services().loadPatientClinicalProfile(row.id), services().loadPatientDiary(row.id), services().loadPatientMeasurements(row.id)
      ]);
      remotePatients.set(row.id,row); remoteMeasurements.set(row.id,measurements || []);
      return legacyPatient(row,clinical,diary,measurements);
    }));
    memory.set(DELETED_PATIENTS_KEY,json(['main','laura','marco']));
    memory.set(EXTRA_PATIENTS_KEY,json(resolved));
    memory.set(DEMO_MEASURES_KEY,'{}'); memory.set(KEY,'[]'); memory.set(PROFILE_KEY,'{}'); memory.set(MEASURE_KEY,'[]'); memory.set(ACCOUNT_KEY,'{}');
    memory.set(PATIENT_START_DATE_KEY,json(Object.fromEntries(resolved.map(p => [p.id,p.startDate || '']))));
  }

  function installVirtualStorage() {
    if (installed) return;
    installed = true;
    storageProto.getItem = function(key) {
      const k=String(key); if (this===window.localStorage && MANAGED_KEYS.has(k)) return memory.has(k)?memory.get(k):null;
      return nativeGetItem.call(this,key);
    };
    storageProto.setItem = function(key,value) {
      const k=String(key); if (this!==window.localStorage || !MANAGED_KEYS.has(k)) return nativeSetItem.call(this,key,value);
      const v=String(value); memory.set(k,v);
      if (k===EXTRA_PATIENTS_KEY) patientQueue=patientQueue.then(()=>syncPatients(v)).catch(error=>reportSyncError('pazienti',error));
      else if (k===APPT_KEY) appointmentQueue=appointmentQueue.then(()=>syncAppointments(v)).catch(error=>reportSyncError('agenda',error));
    };
    storageProto.removeItem = function(key) {
      const k=String(key); if (this===window.localStorage && MANAGED_KEYS.has(k)) {memory.delete(k);return;}
      return nativeRemoveItem.call(this,key);
    };
  }

  async function init(ctx) {
    if (!client || !services()) throw new Error('Servizi Supabase PRO non disponibili.');
    if (!ctx?.professional?.id || !ctx?.user?.id) throw new Error('Contesto professionista incompleto.');
    context=ctx;
    await Promise.all([hydratePatients(),hydrateAppointments()]);
    installVirtualStorage();
  }
  async function flush(){await Promise.all([patientQueue,appointmentQueue]);}
  window.nubemoProfessionalLegacyAdapter=Object.freeze({init,flush});
})();
