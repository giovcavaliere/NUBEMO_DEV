// NUBEMO improvement — conferma esplicita eliminazione congiunta referto + dati analisi.
(() => {
  'use strict';

  const nativeConfirm = window.confirm.bind(window);
  let bypassLegacyLabConfirm = false;

  window.confirm = function(message) {
    if (bypassLegacyLabConfirm && /^Eliminare le analisi /.test(String(message || ''))) {
      bypassLegacyLabConfirm = false;
      return true;
    }
    return nativeConfirm(message);
  };

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#deleteLabReview');
    if (!button) return;

    const ok = nativeConfirm(
      'Eliminare definitivamente queste analisi?\n\n' +
      'Verranno eliminati insieme:\n' +
      '• il PDF del referto\n' +
      '• il record delle analisi e i valori registrati\n\n' +
      'L’operazione non può essere annullata.'
    );

    if (!ok) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    bypassLegacyLabConfirm = true;
    setTimeout(() => { bypassLegacyLabConfirm = false; }, 0);
  }, true);
})();
