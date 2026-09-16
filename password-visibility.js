// NUBEMO improvement — toggle visibilità password su login e impostazione password.
(() => {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    .nubemo-password-wrap{position:relative;display:block}
    .nubemo-password-wrap input{width:100%;padding-right:46px!important;box-sizing:border-box}
    .nubemo-password-toggle{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:34px;height:34px;border:0!important;background:transparent!important;box-shadow:none!important;padding:0!important;margin:0!important;display:flex;align-items:center;justify-content:center;color:inherit;cursor:pointer;z-index:2}
    .nubemo-password-toggle svg{width:21px;height:21px;display:block;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .nubemo-password-toggle:focus-visible{outline:2px solid currentColor;outline-offset:2px;border-radius:6px}
  `;
  document.head.appendChild(style);

  const eyeOpen = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>';
  const eyeClosed = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16.6 16.6 0 0 1-3 3.7"/><path d="M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a10.4 10.4 0 0 0 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

  function enhance(input) {
    if (!input || input.dataset.nubemoPasswordEnhanced === '1') return;
    input.dataset.nubemoPasswordEnhanced = '1';

    const wrap = document.createElement('span');
    wrap.className = 'nubemo-password-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nubemo-password-toggle';
    button.setAttribute('aria-label', 'Mostra password');
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = eyeOpen;

    button.addEventListener('click', () => {
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.setAttribute('aria-label', reveal ? 'Nascondi password' : 'Mostra password');
      button.setAttribute('aria-pressed', reveal ? 'true' : 'false');
      button.innerHTML = reveal ? eyeClosed : eyeOpen;
      input.focus({ preventScroll: true });
    });

    wrap.appendChild(button);
  }

  function scan() {
    document.querySelectorAll('input[type="password"]').forEach(enhance);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();

  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
