// NUBEMO — applicazione impostazioni Area Paziente da Supabase.
// Nessun DOM viene ridisegnato: si espongono al motore UI i valori già previsti dal profilo legacy.
(() => {
  'use strict';

  const context = window.nubemoPatientContext;
  if (!context) return;

  const PROFILE_KEY = 'diario-pro-profile-main-v1';
  const { getItem: previousGetItem, setItem: previousSetItem, removeItem: previousRemoveItem } = window.NubemoStorageKit.capture();

  const settings = context.settings && typeof context.settings === 'object' ? context.settings : {};
  const showEnergyValues = settings.showEnergyValues !== false;
  const readOnly = !context.activePathway || settings.readOnly === true;

  window.NubemoStorageKit.patch('patient-settings-supabase-bridge', {
    getItem: function(key) {
      const value = previousGetItem.call(this,key);
      if (this !== window.localStorage || String(key) !== PROFILE_KEY || !value) return value;
      try {
        const profile = JSON.parse(value) || {};
        return JSON.stringify({...profile,showEnergyValues,readOnly});
      } catch (_) { return value; }
    },
    setItem: function(key,value) {
      return previousSetItem.call(this,key,value);
    },
    removeItem: function(key) {
      return previousRemoveItem.call(this,key);
    }
  }, [PROFILE_KEY]);

  window.nubemoPatientSettingsBridge = Object.freeze({showEnergyValues,readOnly});
})();
