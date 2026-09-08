// NUBEMO 4C.2b fix — il drawer professionista è apribile dalla testata solo su smartphone verticale.
(() => {
  'use strict';

  const phonePortrait = () => window.matchMedia('(max-width: 600px) and (orientation: portrait)').matches;

  const style = document.createElement('style');
  style.textContent = `
    #openProDrawer { cursor: default !important; }
    #openProDrawer img { cursor: default !important; }
    @media (max-width: 600px) and (orientation: portrait) {
      #openProDrawer img { cursor: pointer !important; }
    }
  `;
  document.head.appendChild(style);

  document.addEventListener('click', event => {
    const trigger = event.target?.closest?.('#openProDrawer');
    if (!trigger) return;

    const clickedLogo = event.target?.closest?.('#openProDrawer img');
    const allowDrawerOpen = phonePortrait() && !!clickedLogo;
    if (allowDrawerOpen) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);
})();
