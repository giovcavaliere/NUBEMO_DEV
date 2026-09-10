// NUBEMO recovery 3.98 — impostazioni professionista su Supabase.
// Mantiene invariata la pagina Impostazioni 3.98 e virtualizza soltanto
// la chiave usata dal runtime recovery per durata visite/orari/parametri report.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const context = window.nubemoProfessionalContext || {};
  const professionalId = context.professional?.id;
  if (!client || !professionalId) return;

  const SETTINGS_KEY = 'diario-pro-settings-recovery-v1';
  const storageProto = Object.getPrototypeOf(window.localStorage);
  const previousGetItem = storageProto.getItem;
  const previousSetItem = storageProto.setItem;
  const previousRemoveItem = storageProto.removeItem;
  let serialized = null;
  let queue = Promise.resolve();
  let installed = false;

  const parse = (value, fallback={}) => { try { return JSON.parse(value); } catch (_) { return fallback; } };
  const hhmm = value => value ? String(value).slice(0,5) : '';
  const intOr = (value, fallback) => { const n=Number(value); return Number.isFinite(n)&&n>0?Math.round(n):fallback; };

  function legacySettings(row) {
    const extra = row?.settings_json && typeof row.settings_json === 'object' ? row.settings_json : {};
    return {
      ...extra,
      first: intOr(row?.first_visit_duration_min, 60),
      control: intOr(row?.control_visit_duration_min, 30),
      dayStart: hhmm(row?.day_start) || '08:00',
      dayEnd: hhmm(row?.day_end) || '19:00',
      workDays: intOr(extra.workDays, 5),
      reportWeightInterval: intOr(row?.report_weight_interval, 30)
    };
  }

  async function persist(value) {
    const legacy = parse(value, {});
    const current = await client.from('professional_settings')
      .select('settings_json').eq('professional_id', professionalId).maybeSingle();
    if (current.error) throw current.error;
    const existingJson = current.data?.settings_json && typeof current.data.settings_json === 'object' ? current.data.settings_json : {};
    const settingsJson = {
      ...existingJson,
      workDays: intOr(legacy.workDays, 5)
    };
    const payload = {
      professional_id: professionalId,
      first_visit_duration_min: intOr(legacy.first, 60),
      control_visit_duration_min: intOr(legacy.control, 30),
      day_start: legacy.dayStart || '08:00',
      day_end: legacy.dayEnd || '19:00',
      report_weight_interval: intOr(legacy.reportWeightInterval, 30),
      settings_json: settingsJson
    };
    const result = await client.from('professional_settings').upsert(payload,{onConflict:'professional_id'}).select('*').single();
    if (result.error) throw result.error;
    serialized = JSON.stringify(legacySettings(result.data));
  }

  function install() {
    if (installed) return;
    installed = true;
    storageProto.getItem = function(key) {
      if (this === window.localStorage && String(key) === SETTINGS_KEY) return serialized;
      return previousGetItem.call(this,key);
    };
    storageProto.setItem = function(key,value) {
      if (this !== window.localStorage || String(key) !== SETTINGS_KEY) return previousSetItem.call(this,key,value);
      serialized = String(value);
      queue = queue.then(() => persist(serialized)).catch(error => {
        console.error('NUBEMO PRO Supabase sync (impostazioni):',error);
        window.dispatchEvent(new CustomEvent('nubemo:supabase-sync-error',{detail:{domain:'impostazioni',message:error?.message||String(error)}}));
      });
    };
    storageProto.removeItem = function(key) {
      if (this === window.localStorage && String(key) === SETTINGS_KEY) { serialized=null; return; }
      return previousRemoveItem.call(this,key);
    };
  }

  const ready = (async() => {
    const result = await client.from('professional_settings').select('*').eq('professional_id',professionalId).maybeSingle();
    if (result.error) throw result.error;
    serialized = JSON.stringify(legacySettings(result.data));
    install();
  })().catch(error => {
    console.error('NUBEMO PRO settings init:',error);
    throw error;
  });

  async function flush(){ await ready; await queue; }
  window.nubemoProfessionalSettingsBridge = Object.freeze({ready,flush});
})();