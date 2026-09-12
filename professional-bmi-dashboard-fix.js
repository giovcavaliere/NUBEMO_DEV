// NUBEMO recovery 3.98 — fix grafico BMI dashboard con una sola categoria.
// Un arco SVG da 0° a 360° ha inizio/fine coincidenti e non viene disegnato;
// manteniamo lo stesso path e lo trasformiamo in due semicerchi, preservando i listener 3.98.
(() => {
  'use strict';

  const app = document.getElementById('proApp');
  if (!app) return;

  const FULL_CIRCLE_D = 'M 50 8 A 42 42 0 1 0 50 92 A 42 42 0 1 0 50 8 Z';
  let scheduled = false;

  function patch() {
    const cards = [...app.querySelectorAll('section.card')];
    const card = cards.find(node => node.querySelector('.section-head h2')?.textContent?.trim() === 'Distribuzione pazienti per BMI');
    if (!card) return;

    const svg = card.querySelector('svg[viewBox="0 0 100 100"]');
    if (!svg) return;

    const slices = [...svg.querySelectorAll('path[data-bmi-category]')];
    if (slices.length !== 1) return;

    const slice = slices[0];
    if (slice.getAttribute('d') !== FULL_CIRCLE_D) slice.setAttribute('d', FULL_CIRCLE_D);
  }

  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      observer.disconnect();
      try { patch(); }
      finally { observer.observe(app, { childList: true, subtree: true }); }
    });
  });

  observer.observe(app, { childList: true, subtree: true });
  patch();
})();
