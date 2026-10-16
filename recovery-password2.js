// NUBEMO 2.0 — recupero password indipendente dall'attivazione account.
(() => {
  'use strict';
  const client = window.nubemoSupabase;
  const $ = id => document.getElementById(id);
  const loading = $('recovery-password-loading');
  const invalid = $('recovery-password-invalid');
  const view = $('recovery-password-view');
  const success = $('recovery-password-success');
  const form = $('recovery-password-form');
  const password = $('new-password');
  const confirm = $('confirm-password');
  const submit = $('recovery-password-submit');
  const message = $('recovery-password-message');
  const entry = window.nubemoRecoveryPasswordEntry || { search: '', hash: '' };
  const raw = String(entry.search || '') + String(entry.hash || '');
  const isRecoveryLink = /(?:^|[?&#])type=recovery(?:&|$)/i.test(raw);
  const hasMarker = /(?:^|[?&#])(access_token|refresh_token|code|token_hash)=/i.test(raw);
  function show(element) {
    [loading, invalid, view, success].forEach(node => { node.hidden = node !== element; });
  }
  function fail(text) {
    $('recovery-password-invalid-message').textContent = text || 'Il link è scaduto o non è valido. Richiedine uno nuovo.';
    show(invalid);
  }
  const login = () => window.location.replace('index2.html');
  $('recovery-password-back-login').addEventListener('click', login);
  $('recovery-password-login').addEventListener('click', login);
  async function initialize() {
    if (!client || !hasMarker || !isRecoveryLink || /(?:^|[?&#])error(?:_code|_description)?=/i.test(raw)) {
      fail('Il link è scaduto o non è valido. Richiedine uno nuovo dal login.');
      return;
    }
    // Il client Supabase elabora automaticamente il link di recupero e crea la sessione.
    // Il token deve provenire dal redirect di recupero, mai da una sessione
    // preesistente del browser. Supabase consuma i token durante l'inizializzazione.
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) {
      fail('Non è stato possibile verificare il link. Richiedine uno nuovo.');
      return;
    }
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data?.user) {
      fail('Non è stato possibile verificare il link. Richiedine uno nuovo.');
      return;
    }
    window.history.replaceState(null, '', window.location.pathname);
    show(view);
  }
  form.addEventListener('click', event => {
    const button = event.target.closest('[data-password-toggle]');
    if (!button) return;
    const input = $(button.dataset.passwordToggle);
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(reveal));
    button.setAttribute('aria-label', (reveal ? 'Nascondi ' : 'Mostra ') + (input.id === 'new-password' ? 'nuova password' : 'conferma password'));
    button.querySelector('[data-password-eye="show"]').hidden = reveal;
    button.querySelector('[data-password-eye="hide"]').hidden = !reveal;
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    message.textContent = '';
    if (password.value.length < 8) { message.textContent = 'Usa almeno 8 caratteri.'; return; }
    if (password.value !== confirm.value) { message.textContent = 'Le password non coincidono.'; return; }
    submit.disabled = true;
    try {
      const { error } = await client.auth.updateUser({ password: password.value });
      if (error) throw error;
      password.value = '';
      confirm.value = '';
      await client.auth.signOut({ scope: 'local' });
      show(success);
    } catch (_) {
      message.textContent = 'Impossibile aggiornare la password. Richiedi un nuovo link o riprova.';
    } finally { submit.disabled = false; }
  });
  initialize().catch(() => fail('Non è stato possibile verificare il link.'));
})();
