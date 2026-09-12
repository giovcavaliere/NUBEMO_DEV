// NUBEMO improvement — verifica account paziente esistente prima della creazione.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  if (!client) return;

  let bypassOnce = false;
  let busy = false;

  function closeCreation() {
    const patientsNav = document.querySelector('[data-view="patients"]');
    if (patientsNav) patientsNav.click();
    else window.location.reload();
  }

  function restoreButton(button) {
    if (!button?.isConnected) return;
    button.disabled = false;
    button.textContent = 'Salva paziente';
  }

  function continueNormalCreation(button) {
    busy = false;
    restoreButton(button);
    bypassOnce = true;
    button.click();
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#saveNewPatient');
    if (!button || document.body.dataset.proView !== 'newPatient') return;

    if (bypassOnce) {
      bypassOnce = false;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy) return;

    const email = String(document.getElementById('npEmail')?.value || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      continueNormalCreation(button);
      return;
    }

    busy = true;
    button.disabled = true;
    button.textContent = 'Verifica...';

    void (async () => {
      try {
        const { data, error } = await client.functions.invoke('patient-invite-status', {
          body: { action: 'check', email }
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || 'Verifica account non riuscita.');

        if (!data.exists) {
          continueNormalCreation(button);
          return;
        }

        if (data.account_status === 'active') {
          alert('Il paziente è già presente in NUBEMO e l’account risulta attivo.');
          closeCreation();
          return;
        }

        if (data.account_status === 'invited' && data.associated) {
          const resend = window.confirm(
            'Esiste già un paziente NUBEMO con questo indirizzo email.\n\nVuoi reinviare l’invito?'
          );
          if (!resend) {
            closeCreation();
            return;
          }

          button.textContent = 'Invio invito...';
          const { data: resendData, error: resendError } = await client.functions.invoke('patient-invite-status', {
            body: { action: 'resend', email }
          });
          if (resendError) throw resendError;
          if (!resendData?.ok) throw new Error(resendData?.error || 'Reinvio invito non riuscito.');

          alert('Invito NUBEMO reinviato correttamente.');
          closeCreation();
          return;
        }

        alert('Esiste già un account NUBEMO con questo indirizzo email.');
        closeCreation();
      } catch (error) {
        console.error('NUBEMO patient invite precheck:', error);
        alert('Non è stato possibile verificare lo stato dell’invito. Riprova.');
        busy = false;
        restoreButton(button);
      }
    })();
  }, true);
})();
