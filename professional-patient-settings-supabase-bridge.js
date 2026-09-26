// NUBEMO — impostazioni Area Paziente gestite dal professionista.
// Mantiene i campi e il flusso (showEnergyValues/readOnly) e persiste sul percorso corrente.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const context = window.nubemoProfessionalContext || {};
  if (!client || !Array.isArray(context.patients)) return;

  const EXTRA_PATIENTS_KEY = 'diario-pro-extra-patients-v1';
  const { getItem: previousGetItem, setItem: previousSetItem, removeItem: previousRemoveItem } = window.NubemoRuntimeKit.capture();

  const settingsByPatient = new Map();
  const pathwayByPatient = new Map();
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
    const result = await client.from('patient_settings').select('patient_id,pathway_id,settings_json').in('patient_id', ids);
    if (result.error) throw result.error;
    settingsByPatient.clear();pathwayByPatient.clear();
    for (const row of result.data || []) {
      settingsByPatient.set(row.patient_id, normalizedSettings(row.settings_json));
      if(row.pathway_id)pathwayByPatient.set(row.patient_id,row.pathway_id);
    }
    for (const patient of context.patients) {
      if (!settingsByPatient.has(patient.id)) settingsByPatient.set(patient.id, normalizedSettings({}));
      if (patient.pathwayId && !pathwayByPatient.has(patient.id)) pathwayByPatient.set(patient.id, patient.pathwayId);
    }
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
      let pathwayId=pathwayByPatient.get(patient.id)||context.patients.find(p=>p.id===patient.id)?.pathwayId||null;
      if(!pathwayId){
        const {data,error}=await client.rpc('get_professional_patient_pathways',{p_patient_id:patient.id});
        if(error)throw error;
        pathwayId=(Array.isArray(data)?data:[]).find(p=>p.status==='active'||p.status==='pending')?.id||null;
      }
      if(!pathwayId)throw new Error('Percorso corrente non disponibile per le impostazioni paziente.');
      const result = await client.from('patient_settings').upsert({patient_id: patient.id, pathway_id:pathwayId, settings_json: next},{onConflict:'pathway_id'}).select('patient_id,pathway_id,settings_json').single();
      if (result.error) throw result.error;
      pathwayByPatient.set(patient.id,result.data.pathway_id);
      settingsByPatient.set(patient.id, normalizedSettings(result.data.settings_json));
    }
  }

  window.NubemoRuntimeKit.patch('professional-patient-settings-supabase-bridge', {
    getItem: function(key) {
      const value = previousGetItem.call(this, key);
      if (this === window.nubemoProfessionalRuntimeStore.storage && String(key) === EXTRA_PATIENTS_KEY && hydrated) return overlay(value);
      return value;
    },
    setItem: function(key, value) {
      previousSetItem.call(this, key, value);
      if (this !== window.nubemoProfessionalRuntimeStore.storage || String(key) !== EXTRA_PATIENTS_KEY || !hydrated) return;
      const serialized = String(value);
      queue = queue.then(() => persist(serialized)).catch(error => {
        console.error('NUBEMO PRO Supabase sync (impostazioni paziente):', error);
        window.dispatchEvent(new CustomEvent('nubemo:supabase-sync-error',{detail:{domain:'impostazioni paziente',message:error?.message||String(error)}}));
      });
    },
    removeItem: function(key) {
      return previousRemoveItem.call(this, key);
    }
  }, [EXTRA_PATIENTS_KEY]);

  const ready = loadAll();
  async function flush(){ await ready; await queue; }
  window.nubemoProfessionalPatientSettingsBridge = Object.freeze({ready,flush});
})();