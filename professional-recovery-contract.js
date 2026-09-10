// NUBEMO recovery 3.98 — contratto runtime Area Professionista.
// Mantiene la UI 3.98 e impedisce che vecchi store demo locali tornino a essere
// una fonte dati durante la migrazione Supabase.
(() => {
  'use strict';

  const PLAN_META_KEY = 'diario-pro-plan-meta-v1';
  const PRIVACY_META_KEY = 'diario-pro-privacy-meta-v1';
  const RETIRED_LOCAL_KEYS = new Set([PLAN_META_KEY, PRIVACY_META_KEY]);
  const memory = new Map([
    [PLAN_META_KEY, '{}'],
    [PRIVACY_META_KEY, '{}']
  ]);

  const storageProto = Object.getPrototypeOf(window.localStorage);
  const previousGetItem = storageProto.getItem;
  const previousSetItem = storageProto.setItem;
  const previousRemoveItem = storageProto.removeItem;

  storageProto.getItem = function(key) {
    const k = String(key);
    if (this === window.localStorage && RETIRED_LOCAL_KEYS.has(k)) return memory.get(k) ?? null;
    return previousGetItem.call(this, key);
  };

  storageProto.setItem = function(key, value) {
    const k = String(key);
    if (this === window.localStorage && RETIRED_LOCAL_KEYS.has(k)) {
      memory.set(k, String(value));
      return;
    }
    return previousSetItem.call(this, key, value);
  };

  storageProto.removeItem = function(key) {
    const k = String(key);
    if (this === window.localStorage && RETIRED_LOCAL_KEYS.has(k)) {
      memory.delete(k);
      return;
    }
    return previousRemoveItem.call(this, key);
  };

  // La 3.98 richiede il numero per un documento contabile. Il bridge Supabase
  // intercetta il salvataggio subito dopo questo controllo e persiste il file remoto.
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#saveProAccounting');
    if (!button) return;
    const number = String(document.getElementById('proAccountingNumber')?.value || '').trim();
    if (number) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    alert('Inserisci il numero del documento.');
  }, true);

  window.nubemoProfessionalRecoveryContract = Object.freeze({
    retiredLocalKeys: [...RETIRED_LOCAL_KEYS]
  });
})();
