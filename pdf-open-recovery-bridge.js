// NUBEMO recovery 3.98 — apertura diretta dei PDF approvati senza alterare la generazione.
(() => {
  'use strict';

  const nativeClick = HTMLAnchorElement.prototype.click;
  if (nativeClick.__nubemoPdfOpenPatched) return;

  function shouldOpenDirectly(anchor) {
    const href = String(anchor.href || '');
    const filename = String(anchor.getAttribute('download') || anchor.download || '');
    if (!href.startsWith('blob:') || !/\.pdf$/i.test(filename)) return false;

    const isProfessional = document.body.classList.contains('pro-body');
    if (isProfessional) {
      return /^(Diario_|Cartella_NUBEMO_)/.test(filename);
    }
    return /^Misurazioni_/.test(filename);
  }

  function patchedClick() {
    if (!shouldOpenDirectly(this)) return nativeClick.call(this);
    window.location.href = this.href;
  }

  patchedClick.__nubemoPdfOpenPatched = true;
  HTMLAnchorElement.prototype.click = patchedClick;
})();
