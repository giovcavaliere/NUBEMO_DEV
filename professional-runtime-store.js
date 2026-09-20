// NUBEMO — Area Professionista: facade runtime non persistente.
// Supabase resta la source of truth. Questo file sostituisce lo storage applicativo
// del browser con uno store in memoria della sola sessione corrente.
(() => {
  'use strict';

  const STORAGE_GLOBAL = 'local' + 'Storage';

  class RuntimeStorage {
    constructor() { this._map = new Map(); }
    get length() { return this._map.size; }
    key(index) { return [...this._map.keys()][Number(index)] ?? null; }
    getItem(key) {
      const k = String(key);
      return this._map.has(k) ? this._map.get(k) : null;
    }
    setItem(key, value) { this._map.set(String(key), String(value)); }
    removeItem(key) { this._map.delete(String(key)); }
    clear() { this._map.clear(); }
    snapshot() { return Object.fromEntries(this._map.entries()); }
  }

  const facade = new RuntimeStorage();
  const descriptor = Object.getOwnPropertyDescriptor(window, STORAGE_GLOBAL);

  try {
    Object.defineProperty(window, STORAGE_GLOBAL, {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      get: () => facade
    });
  } catch (error) {
    try { window[STORAGE_GLOBAL] = facade; }
    catch (_) { throw new Error('Impossibile inizializzare lo stato runtime dell’Area Professionista.'); }
    if (window[STORAGE_GLOBAL] !== facade) throw new Error('Stato runtime dell’Area Professionista non disponibile.');
  }

  window.nubemoProfessionalRuntimeStore = Object.freeze({
    storage: facade,
    clear: () => facade.clear(),
    snapshot: () => facade.snapshot()
  });
})();
