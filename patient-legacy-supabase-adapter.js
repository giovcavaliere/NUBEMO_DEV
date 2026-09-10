// NUBEMO recovery 3.98 — adattatore dati sincrono per il frontend legacy Paziente.
// Supabase resta la source of truth. I valori legacy esistono solo in memoria:
// nessun diario/profilo/misura/credenziale viene scritto nel localStorage del dispositivo.
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
  const MANAGED_KEYS = new Set([KEY, PROFILE_KEY, MEASURE_KEY, EXTRA_PATIENTS_KEY, ACCOUNT_KEY, ACTIVE_PATIENT_KEY, PATIENT_APPT_KEY]);

  const memory = new Map();
  let installed = false;
  let context = null;
  let diaryRows = [];
  let measurementRows = [];
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
      // La 3.98 possiede un unico campo "Sport / Note". Durante il recovery
      // viene conservato integralmente in notes per non perdere testo.
      sport: null,
      notes: entry.notes || null
    };
  }

  function legacyMeasurement(row) {
    return {
      date: row.measured_at,
      waist: row.waist_cm ?? '',
      hips: row.hips_cm ?? '',
      notes: row.notes || ''
    };
  }

  function legacyAppointment(row) {
    const start = new Date(row.starts_at);
    const localDate = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString();
    return {
      id: row.id,
      patientId: 'main',
      date: localDate.slice(0, 10),
      time: localDate.slice(11, 16),
      type: row.appointment_type || 'Visita',
      notes: row.notes || '',
      status: row.status || 'scheduled'
    };
  }

  function legacyProfile(ctx) {
    const p = ctx.profile || {};
    const patient = ctx.patient || {};
    const c = ctx.clinical || {};
    return {
      firstName: p.first_name || '',
      name: p.first_name || '',
      surname: p.last_name || '',
      birth: patient.birth_date || '',
      height: patient.height_cm ?? '',
      sex: patient.sex || '',
      goal: c.goal_weight_kg ?? '',
      minWeight: c.min_weight_kg ?? '',
      maxWeight: c.max_weight_kg ?? '',
      reasonableWeight: c.reasonable_weight_kg ?? '',
      theoreticalWeight: c.theoretical_weight_kg ?? '',
      work: c.work || '',
      activity: c.activity || '',
      activityFactor: c.activity_factor ?? '',
      smoking: c.smoking || '',
      alcohol: c.alcohol || '',
      diagnosis: c.diagnosis || '',
      bowel: c.bowel || '',
      metabolism: c.metabolism || '',
      feeg: c.feeg || '',
      impedance: c.impedance || '',
      famObesity: !!c.family_obesity,
      famDiabetes: !!c.family_diabetes,
      famHypertension: !!c.family_hypertension,
      famCardiovascular: !!c.family_cardiovascular,
      famDyslipidemia: !!c.family_dyslipidemia,
      famThyroid: !!c.family_thyroid,
      previousDiets: c.previous_diets || '',
      allergies: c.allergies || '',
      medications: c.medications || '',
      giIssues: c.gi_issues || '',
      pastConditions: c.past_conditions || '',
      observations: c.observations || '',
      objectives: c.objectives || '',
      // Il motore calorie legacy è intenzionalmente sospeso nel recovery.
      // Verrà riattivato solo dopo la revisione CREA / catalogo Supabase.
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

    for (const row of diaryRows) {
      if (!incomingDates.has(row.entry_date)) await services().deleteDiaryEntry(row.id);
    }
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

    for (const row of measurementRows) {
      if (!incomingDates.has(row.measured_at)) await services().deleteSelfMeasurement(row.id);
    }
    for (const entry of incoming) {
      if (!entry?.date) continue;
      const existing = byDate.get(entry.date);
      await services().saveSelfMeasurement(context.patient.id, context.user.id, {
        measured_at: entry.date,
        waist_cm: numberOrNull(entry.waist),
        hips_cm: numberOrNull(entry.hips),
        notes: entry.notes || null
      }, existing?.id || null);
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
      const v = String(value);
      memory.set(k, v);
      if (k === KEY) {
        diaryQueue = diaryQueue.then(() => syncDiary(v)).catch(error => reportSyncError('diario', error));
      } else if (k === MEASURE_KEY) {
        measurementQueue = measurementQueue.then(() => syncMeasurements(v)).catch(error => reportSyncError('misure', error));
      }
      // PROFILE/ACCOUNT/ACTIVE/EXTRA/APPOINTMENTS sono viste di compatibilità
      // esclusivamente in memoria e non vengono mai persistite localmente.
    };

    storageProto.removeItem = function(key) {
      const k = String(key);
      if (this === window.localStorage && MANAGED_KEYS.has(k)) { memory.delete(k); return; }
      return nativeRemoveItem.call(this, key);
    };
  }

  async function init(ctx) {
    if (!ctx?.patient?.id || !ctx?.user?.id) throw new Error('Contesto paziente incompleto.');
    context = ctx;
    const [diary, measures, appointments] = await Promise.all([
      services().loadDiary(ctx.patient.id),
      services().loadSelfMeasurements(ctx.patient.id),
      services().loadAppointments(ctx.patient.id)
    ]);
    diaryRows = diary;
    measurementRows = measures;

    memory.set(KEY, json(diary.map(legacyDiary)));
    memory.set(PROFILE_KEY, json(legacyProfile(ctx)));
    memory.set(MEASURE_KEY, json(measures.map(legacyMeasurement)));
    memory.set(EXTRA_PATIENTS_KEY, '[]');
    // La 3.98 usa ancora accountMap() per decidere se renderizzare l'app.
    // Il record virtuale non contiene password: l'autenticazione reale è Supabase.
    memory.set(ACCOUNT_KEY, json({ main: { active: true, username: ctx.profile?.email || 'supabase' } }));
    memory.set(ACTIVE_PATIENT_KEY, 'main');
    memory.set(PATIENT_APPT_KEY, json(appointments.map(legacyAppointment)));
    installVirtualStorage();
  }

  async function flush() {
    await Promise.all([diaryQueue, measurementQueue]);
  }

  window.nubemoPatientLegacyAdapter = Object.freeze({ init, flush });
})();
