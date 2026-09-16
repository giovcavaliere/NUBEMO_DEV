// NUBEMO improvement — verifica account paziente gia' associato prima della creazione.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  if (!client) return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
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

  function existingPatientByEmail(email){
    let rows=[];
    try{rows=JSON.parse(window.localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]');}catch(_){rows=[];}
    return (Array.isArray(rows)?rows:[]).find(row=>
      row?._draft!==true && row?.relationshipStatus!=='draft' &&
      String(row?.email||'').trim().toLowerCase()===email
    )||null;
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#saveNewPatient');
    if (!button || document.body.dataset.proView !== 'newPatient') return;

    if (bypassOnce) {
      bypassOnce = false;
      return;
    }

    const activate=!!document.getElementById('npActivatePatientArea')?.checked;
    const email = String(document.getElementById('npEmail')?.value || '').trim().toLowerCase();
    if (!activate || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      continueNormalCreation(button);
      return;
    }

    const existing=existingPatientByEmail(email);
    if(!existing?.id){
      continueNormalCreation(button);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy) return;

    busy = true;
    button.disabled = true;
    button.textContent = 'Verifica...';

    void (async () => {
      try {
        const { data, error } = await client.functions.invoke('patient-invite-status', {
          body: { action: 'check', patient_id: existing.id }
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || 'Verifica account non riuscita.');

        if (data.account_status === 'active') {
          alert('Il paziente e gia presente in NUBEMO e l’account risulta attivo.');
          closeCreation();
          return;
        }

        if (data.account_status === 'invited') {
          const resend = window.confirm(
            'Esiste gia un paziente NUBEMO con questo indirizzo email.\n\nVuoi reinviare l’invito?'
          );
          if (!resend) {
            closeCreation();
            return;
          }

          button.textContent = 'Invio invito...';
          const { data: resendData, error: resendError } = await client.functions.invoke('patient-invite-status', {
            body: { action: 'resend', patient_id: existing.id }
          });
          if (resendError) throw resendError;
          if (!resendData?.ok) throw new Error(resendData?.error || 'Reinvio invito non riuscito.');

          alert('Invito NUBEMO reinviato correttamente.');
          closeCreation();
          return;
        }

        alert('Il paziente e gia presente in NUBEMO. Puoi attivare l’Area Paziente dalla sua scheda.');
        closeCreation();
      } catch (error) {
        console.error('NUBEMO patient invite precheck:', error);
        alert('Non e stato possibile verificare lo stato dell’invito. Riprova.');
        busy = false;
        restoreButton(button);
      }
    })();
  }, true);
})();
