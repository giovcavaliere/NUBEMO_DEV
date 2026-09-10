// NUBEMO recovery 3.98 — impostazioni Area Paziente gestite dal professionista.
// Mantiene i campi e il flusso 3.98 (showEnergyValues/readOnly) e persiste su patient_settings.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const context = window.nubemoProfessionalContext || {};
  if (!client || !Array.isArray(context.patients)) return;

  const EXTRA_PATIENTS_KEY = 'diario-pro-extra-patients-v1';
  const storageProto = Object.getPrototypeOf(window.localStorage);
  const previousGetItem = storageProto.getItem;
  const previousSetItem = storageProto.setItem;
  const previousRemoveItem = storageProto.removeItem;

  const settingsByPatient = new Map();
  let hydrated = false;
  let queue = Promise.resolve();

  const parse = (value, fallback) => { try { return JSON.parse(value); } catch (_) { return fallback; } };

  function normalizedSettings(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    return {
      ...s,
      showEnergyValues: s.showEnergyValues !== false,
      readOnly: s.readOnly === true
    };
  }

  function overlay(serialized) {
    const patients = parse(serialized || '[]', []);
    if (!Array.isArray(patients)) return serialized;
    return JSON.stringify(patients.map(patient => {
      const settings = settingsByPatient.get(patient.id);
      if (!settings) return patient;
      return {
        ...patient,
        showEnergyValues: settings.showEnergyValues !== false,
        readOnly: settings.readOnly === true
      };
    }));
  }

  async function loadAll() {
    if (!context.patients.length) { hydrated = true; return; }
    const ids = context.patients.map(p => p.id);
    const result = await client.from('patient_settings').select('patient_id,settings_json').in('patient_id', ids);
    if (result.error) throw result.error;
    settingsByPatient.clear();
    for (const row of result.data || []) settingsByPatient.set(row.patient_id, normalizedSettings(row.settings_json));
    for (const patient of context.patients) if (!settingsByPatient.has(patient.id)) settingsByPatient.set(patient.id, normalizedSettings({}));
    hydrated = true;
  }

  async function persist(serialized) {
    if (!hydrated) return;
    const patients = parse(serialized, []);
    if (!Array.isArray(patients)) return;

    for (const patient of patients) {
      if (!patient?.id || !context.patients.some(p => p.id === patient.id)) continue;
      const current = settingsByPatient.get(patient.id) || normalizedSettings({});
      const next = {
        ...current,
        showEnergyValues: patient.showEnergyValues !== false,
        readOnly: patient.readOnly === true
      };
      if (current.showEnergyValues === next.showEnergyValues && current.readOnly === next.readOnly) continue;
      const result = await client.from('patient_settings').upsert({patient_id: patient.id, settings_json: next},{onConflict:'patient_id'}).select('patient_id,settings_json').single();
      if (result.error) throw result.error;
      settingsByPatient.set(patient.id, normalizedSettings(result.data.settings_json));
    }
  }

  storageProto.getItem = function(key) {
    const value = previousGetItem.call(this, key);
    if (this === window.localStorage && String(key) === EXTRA_PATIENTS_KEY && hydrated) return overlay(value);
    return value;
  };

  storageProto.setItem = function(key, value) {
    previousSetItem.call(this, key, value);
    if (this !== window.localStorage || String(key) !== EXTRA_PATIENTS_KEY || !hydrated) return;
    const serialized = String(value);
    queue = queue.then(() => persist(serialized)).catch(error => {
      console.error('NUBEMO PRO Supabase sync (impostazioni paziente):', error);
      window.dispatchEvent(new CustomEvent('nubemo:supabase-sync-error',{detail:{domain:'impostazioni paziente',message:error?.message||String(error)}}));
    });
  };

  storageProto.removeItem = function(key) {
    return previousRemoveItem.call(this, key);
  };

  const ready = loadAll();
  async function flush(){ await ready; await queue; }
  window.nubemoProfessionalPatientSettingsBridge = Object.freeze({ready,flush});
})();
