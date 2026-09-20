// NUBEMO — Area Professionista: facade runtime non persistente.
// Supabase resta la source of truth. Questo file sostituisce lo storage applicativo
// del browser con uno store in memoria della sola sessione corrente.
// Step 20D-1A: aggiunge API esplicite senza cambiare il comportamento legacy esistente.
(() => {
  'use strict';

  const STORAGE_GLOBAL = 'local' + 'Storage';
  const writeListeners = new Map();
  const removeListeners = new Map();

  function handlers(map,key){return map.get(String(key))||[];}
  function register(map,key,fn){
    const k=String(key),list=map.get(k)||[];
    list.push(fn);map.set(k,list);
    return ()=>{
      const next=(map.get(k)||[]).filter(item=>item!==fn);
      if(next.length)map.set(k,next);else map.delete(k);
    };
  }

  class RuntimeStorage {
    constructor() { this._map = new Map(); }
    get length() { return this._map.size; }
    key(index) { return [...this._map.keys()][Number(index)] ?? null; }
    getItem(key) {
      const k = String(key);
      return this._map.has(k) ? this._map.get(k) : null;
    }
    setItem(key, value) {
      const k=String(key),v=String(value),previous=this._map.has(k)?this._map.get(k):null;
      this._map.set(k,v);
      for(const listener of handlers(writeListeners,k)){
        try{listener(v,previous,k);}catch(error){console.error(`NUBEMO runtime write hook (${k}):`,error);}
      }
    }
    removeItem(key) {
      const k=String(key),previous=this._map.has(k)?this._map.get(k):null;
      this._map.delete(k);
      for(const listener of handlers(removeListeners,k)){
        try{listener(previous,k);}catch(error){console.error(`NUBEMO runtime remove hook (${k}):`,error);}
      }
    }
    clear() { this._map.clear(); }
    snapshot() { return Object.fromEntries(this._map.entries()); }
    peek(key){const k=String(key);return this._map.has(k)?this._map.get(k):null;}
    put(key,value){this._map.set(String(key),String(value));}
    drop(key){this._map.delete(String(key));}
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
    get: key=>facade.getItem(key),
    set: (key,value)=>facade.setItem(key,value),
    remove: key=>facade.removeItem(key),
    peek: key=>facade.peek(key),
    put: (key,value)=>facade.put(key,value),
    drop: key=>facade.drop(key),
    clear: () => facade.clear(),
    snapshot: () => facade.snapshot(),
    onWrite: (key,fn)=>register(writeListeners,key,fn),
    onRemove: (key,fn)=>register(removeListeners,key,fn)
  });
})();
