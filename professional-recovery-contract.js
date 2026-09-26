// NUBEMO — contratto runtime Area Professionista.
// Impedisce che vecchi store demo locali tornino a essere
// una fonte dati durante la migrazione Supabase.
(() => {
  'use strict';

  const PLAN_META_KEY = 'diario-pro-plan-meta-v1';
  const PRIVACY_META_KEY = 'diario-pro-privacy-meta-v1';
  const EXTRA_PATIENTS_KEY = 'diario-pro-extra-patients-v1';
  const PATIENT_START_DATE_KEY = 'nubemo-patient-start-date-v1';
  const RETIRED_LOCAL_KEYS = new Set([PLAN_META_KEY, PRIVACY_META_KEY, PATIENT_START_DATE_KEY]);

  const startDateMap = () => Object.fromEntries(
    (window.nubemoProfessionalContext?.patients || []).map(row => [
      row.id,
      row.pathway_start_date || row.relationship?.started_at?.slice?.(0, 10) || ''
    ])
  );

  const memory = new Map([
    [PLAN_META_KEY, '{}'],
    [PRIVACY_META_KEY, '{}'],
    [PATIENT_START_DATE_KEY, JSON.stringify(startDateMap())]
  ]);

  const { getItem: previousGetItem, setItem: previousSetItem, removeItem: previousRemoveItem } = window.NubemoRuntimeKit.capture();

  // Un contatto provvisorio (draft) e' noto a due componenti diverse a
  // seconda di come si e' arrivati alla pagina: l'adapter legacy lo espone
  // come `remoteDrafts`, il lifecycle bridge come `drafts`. Nel percorso
  // Agenda viene caricato solo il secondo, quindi vanno consultati
  // entrambi - come fa gia' professional-agenda-supabase-bridge.js.
  // Consultandone uno solo, i draft sparivano dalla lista dopo il
  // salvataggio dell'appuntamento.
  function isKnownDraft(id) {
    if (window.nubemoProfessionalLegacyAdapter?.isDraft?.(id)) return true;
    if (window.nubemoPatientLifecycleBridge?.isDraft?.(id)) return true;
    return false;
  }

  function filterSupabasePatients(value) {
    let rows = [];
    try { rows = JSON.parse(value || '[]'); } catch (_) { rows = []; }
    if (!Array.isArray(rows)) rows = [];
    const allowedPatients = new Set((window.nubemoProfessionalContext?.patients || []).map(row => row.id));
    return JSON.stringify(rows.filter(row => row?.id && (allowedPatients.has(row.id) || isKnownDraft(row.id))));
  }

  window.NubemoRuntimeKit.patch('professional-recovery-contract', {
    getItem: function(key) {
      const k = String(key);
      if (this === window.nubemoProfessionalRuntimeStore.storage && k === EXTRA_PATIENTS_KEY) {
        return filterSupabasePatients(previousGetItem.call(this, key));
      }
      if (this === window.nubemoProfessionalRuntimeStore.storage && RETIRED_LOCAL_KEYS.has(k)) return memory.get(k) ?? null;
      return previousGetItem.call(this,key);
    },
    setItem: function(key, value) {
      const k = String(key);
      if (this === window.nubemoProfessionalRuntimeStore.storage && k === EXTRA_PATIENTS_KEY) {
        return previousSetItem.call(this, key, filterSupabasePatients(String(value)));
      }
      if (this === window.nubemoProfessionalRuntimeStore.storage && RETIRED_LOCAL_KEYS.has(k)) {
        memory.set(k, String(value));
        return;
      }
      return previousSetItem.call(this,key,value);
    },
    removeItem: function(key) {
      const k = String(key);
      if (this === window.nubemoProfessionalRuntimeStore.storage && k === EXTRA_PATIENTS_KEY) {
        return previousRemoveItem.call(this, key);
      }
      if (this === window.nubemoProfessionalRuntimeStore.storage && RETIRED_LOCAL_KEYS.has(k)) {
        memory.delete(k);
        return;
      }
      return previousRemoveItem.call(this,key);
    }
  }, [EXTRA_PATIENTS_KEY,...RETIRED_LOCAL_KEYS]);

  // La UI richiede il numero per un documento contabile. Il bridge Supabase
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
