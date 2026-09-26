// NUBEMO — kit condiviso per l'intercettazione di runtime store prototype.
//
// Due responsabilità, entrambe infrastrutturali:
//
// 1. Centralizza il meccanismo che prima ogni bridge duplicava per conto
//    proprio (cattura dei metodi correnti del prototipo e applicazione della
//    propria patch). Il chaining tra bridge resta identico, ma diventa
//    visibile e ispezionabile da un solo posto.
//
// 2. Registra le scritture che arrivano su una chiave PRIMA che il bridge
//    che la possiede sia stato installato. I bridge vengono caricati lazy
//    (solo quando l'utente apre la relativa sezione), mentre il motore UI
//    puo' scrivere su quelle chiavi in qualsiasi momento: senza questo
//    recorder quelle scritture finivano sul vero runtime store e non
//    raggiungevano mai Supabase, sparendo al refresh successivo.
//
// Deve essere caricato PRIMA di qualsiasi bridge o adapter.
(() => {
  'use strict';

  const runtime = window.nubemoProfessionalRuntimeStore?.storage;
  if(!runtime) throw new Error('Runtime store professionista non disponibile.');
  const proto = Object.getPrototypeOf(runtime);
  const patchLog = [];

  // Metodo realmente nativo, catturato prima di qualsiasi patch.
  const nativeSetItem = proto.setItem;

  // chiave -> array di valori scritti prima che qualcuno la reclamasse.
  const buffered = new Map();
  // chiave -> nome del bridge che la possiede.
  const claimedBy = new Map();

  // Recorder di base, installato subito: non altera il comportamento
  // (la scrittura prosegue normalmente), annota soltanto le scritture su
  // chiavi non ancora reclamate, cosi' possono essere riproposte al bridge
  // corretto quando arriva.
  proto.setItem = function(key, value) {
    nativeSetItem.call(this, key, value);
    if (this !== window.nubemoProfessionalRuntimeStore.storage) return;
    const k = String(key);
    if (claimedBy.has(k)) return;
    if (!buffered.has(k)) buffered.set(k, []);
    buffered.get(k).push(String(value));
  };

  function capture() {
    return {
      getItem: proto.getItem,
      setItem: proto.setItem,
      removeItem: proto.removeItem
    };
  }

  // name    : nome del bridge, per la diagnostica.
  // methods : {getItem, setItem, removeItem} - solo quelli che il bridge patcha.
  // claims  : elenco delle chiavi possedute dal bridge. Opzionale ma
  //           consigliato: senza, le scritture anticipate su quelle chiavi
  //           non possono essere recuperate.
  function patch(name, methods, claims) {
    if (methods && methods.getItem) proto.getItem = methods.getItem;
    if (methods && methods.setItem) proto.setItem = methods.setItem;
    if (methods && methods.removeItem) proto.removeItem = methods.removeItem;

    const label = String(name || '');
    const keys = Array.isArray(claims) ? claims.map(String) : [];
    const replayed = [];

    for (const k of keys) {
      if (!claimedBy.has(k)) claimedBy.set(k, label);
      const pending = buffered.get(k);
      if (!pending || !pending.length) continue;
      buffered.delete(k);
      // Ripropone le scritture perse passando dal setItem appena installato:
      // e' esattamente il percorso che avrebbero seguito se il bridge fosse
      // gia' stato caricato al momento della scrittura originale.
      for (const value of pending) {
        try {
          proto.setItem.call(window.nubemoProfessionalRuntimeStore.storage, k, value);
          replayed.push(k);
        } catch (error) {
          console.error('NUBEMO runtime kit - replay fallito per', k, error);
        }
      }
    }

    patchLog.push({ name: label, claims: keys, replayed, at: new Date().toISOString() });
  }

  // Diagnostica, sola lettura.
  const getPatchLog = () => patchLog.slice();
  // Scritture ancora orfane: nessun bridge ha mai reclamato queste chiavi.
  // Se qui compare una chiave che dovrebbe finire su Supabase, manca un
  // `claims` nel bridge corrispondente.
  const getUnclaimedWrites = () =>
    [...buffered.entries()].map(([key, values]) => ({ key, writes: values.length }));

  window.NubemoRuntimeKit = Object.freeze({
    capture, patch, getPatchLog, getUnclaimedWrites
  });
})();
