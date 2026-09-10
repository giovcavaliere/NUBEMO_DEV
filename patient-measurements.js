// NUBEMO — Area Paziente / interazioni automisurazioni
(() => {
  'use strict';
  const app = document.getElementById('app');
  app.addEventListener('click', event => {
    const row = event.target.closest('[data-edit-self-measure]');
    if (!row || !window.nubemoPatientApp?.state?.context?.activePathway) return;
    const state = window.nubemoPatientApp.state;
    const measure = state.selfMeasures.find(x => x.id === row.dataset.editSelfMeasure);
    if (!measure) return;
    state.editSelfMeasureId = measure.id;
    const date = document.getElementById('selfMeasureDate');
    const waist = document.getElementById('selfMeasureWaist');
    const hips = document.getElementById('selfMeasureHips');
    const notes = document.getElementById('selfMeasureNotes');
    if (date) date.value = measure.measured_at || '';
    if (waist) waist.value = measure.waist_cm ?? '';
    if (hips) hips.value = measure.hips_cm ?? '';
    if (notes) notes.value = measure.notes || '';
    document.getElementById('selfMeasureDate')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
})();
