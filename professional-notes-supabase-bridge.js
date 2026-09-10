// NUBEMO recovery 3.98 — bridge Note professionista -> Supabase.
// Nessun DOM viene modificato: pro.js continua a possedere integralmente la UI 3.98.
(() => {
  'use strict';

  const NOTES_KEY = 'diario-pro-notes-recovery-v1';
  const services = window.nubemoProfessionalServices;
  const context = window.nubemoProfessionalContext || {};
  if (!services || !Array.isArray(context.patients)) return;

  const storageProto = Object.getPrototypeOf(window.localStorage);
  const previousSetItem = storageProto.setItem;
  const remoteByPatient = new Map();
  let hydrated = false;
  let queue = Promise.resolve();

  const parse = value => {
    try { const obj = JSON.parse(value || '{}'); return obj && typeof obj === 'object' ? obj : {}; }
    catch (_) { return {}; }
  };

  function report(error) {
    console.error('NUBEMO PRO Supabase sync (note professionista):', error);
    window.dispatchEvent(new CustomEvent('nubemo:supabase-sync-error', {
      detail: { domain: 'note professionista', message: error?.message || String(error) }
    }));
  }

  async function hydrate() {
    const map = {};
    await Promise.all(context.patients.map(async patient => {
      const rows = await services.loadProfessionalNotes(patient.id);
      const latest = Array.isArray(rows) && rows.length ? rows[0] : null;
      if (latest) {
        remoteByPatient.set(patient.id, latest);
        map[patient.id] = latest.content || '';
      }
    }));

    // Il base adapter intercetta questa chiave e la conserva solo nella memoria
    // della sessione. Nessun dato clinico viene scritto nello storage del device.
    previousSetItem.call(window.localStorage, NOTES_KEY, JSON.stringify(map));
    hydrated = true;
  }

  async function sync(serialized) {
    const incoming = parse(serialized);
    for (const patient of context.patients) {
      const patientId = patient.id;
      if (!Object.prototype.hasOwnProperty.call(incoming, patientId)) continue;
      const content = String(incoming[patientId] ?? '');
      const existing = remoteByPatient.get(patientId);
      if (existing) {
        if (String(existing.content || '') === content) continue;
        const updated = await services.updateProfessionalNote(existing.id, content);
        remoteByPatient.set(patientId, updated);
      } else if (content.trim()) {
        const created = await services.createProfessionalNote(patientId, content);
        remoteByPatient.set(patientId, created);
      }
    }
  }

  storageProto.setItem = function(key, value) {
    previousSetItem.call(this, key, value);
    if (this !== window.localStorage || String(key) !== NOTES_KEY || !hydrated) return;
    const serialized = String(value);
    queue = queue.then(() => sync(serialized)).catch(report);
  };

  window.nubemoProfessionalNotesBridge = Object.freeze({
    ready: hydrate(),
    flush: () => queue
  });
})();
