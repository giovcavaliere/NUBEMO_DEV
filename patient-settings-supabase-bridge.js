// NUBEMO recovery 3.98 — applicazione impostazioni Area Paziente da Supabase.
// Nessun DOM viene ridisegnato: si espongono al motore 3.98 i valori già previsti dal profilo legacy.
(() => {
  'use strict';

  const context = window.nubemoPatientContext;
  if (!context) return;

  const PROFILE_KEY = 'diario-pro-profile-main-v1';
  const storageProto = Object.getPrototypeOf(window.localStorage);
  const previousGetItem = storageProto.getItem;
  const previousSetItem = storageProto.setItem;
  const previousRemoveItem = storageProto.removeItem;

  const settings = context.settings && typeof context.settings === 'object' ? context.settings : {};
  const showEnergyValues = settings.showEnergyValues !== false;
  const readOnly = !context.activePathway || settings.readOnly === true;

  storageProto.getItem = function(key) {
    const value = previousGetItem.call(this,key);
    if (this !== window.localStorage || String(key) !== PROFILE_KEY || !value) return value;
    try {
      const profile = JSON.parse(value) || {};
      return JSON.stringify({...profile,showEnergyValues,readOnly});
    } catch (_) { return value; }
  };

  storageProto.setItem = function(key,value) {
    return previousSetItem.call(this,key,value);
  };

  storageProto.removeItem = function(key) {
    return previousRemoveItem.call(this,key);
  };

  window.nubemoPatientSettingsBridge = Object.freeze({showEnergyValues,readOnly});
})();
