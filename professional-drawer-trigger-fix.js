// NUBEMO 4C.2b fix — il drawer professionista si apre solo cliccando il logo.
(() => {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    #openProDrawer { cursor: default !important; }
    #openProDrawer img { cursor: pointer !important; }
  `;
  document.head.appendChild(style);

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
