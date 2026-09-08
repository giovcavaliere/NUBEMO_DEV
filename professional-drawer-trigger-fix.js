// NUBEMO 4C.2b fix — il drawer professionista si apre solo cliccando il logo.
(() => {
  'use strict';

  document.addEventListener('click', event => {
    const trigger = event.target?.closest?.('#openProDrawer');
    if (!trigger) return;

    const clickedLogo = event.target?.closest?.('#openProDrawer img');
    if (clickedLogo) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);
})();
