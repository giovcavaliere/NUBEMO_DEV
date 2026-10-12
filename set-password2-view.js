// Soltanto presentazione: controlli statici password, nessuna chiamata Auth o CSS dinamico.
(() => {
  'use strict';
  const form = document.getElementById('set-password-form');
  if (!form) return;
  form.addEventListener('click', event => {
    const button = event.target.closest('[data-password-toggle]');
    if (!button || !form.contains(button)) return;
    const input = document.getElementById(button.dataset.passwordToggle);
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    const label = input.id === 'new-password' ? 'nuova password' : 'conferma password';
    button.setAttribute('aria-label', (reveal ? 'Nascondi ' : 'Mostra ') + label);
    button.setAttribute('aria-pressed', String(reveal));
    button.querySelector('[data-password-eye="show"]').hidden = reveal;
    button.querySelector('[data-password-eye="hide"]').hidden = !reveal;
    input.focus({ preventScroll: true });
  });
})();
