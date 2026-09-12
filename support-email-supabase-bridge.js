// NUBEMO 3.98 — invio diretto segnalazioni assistenza tramite Supabase Edge Function + Resend.
(() => {
  'use strict';

  const SUPPORT_FUNCTION = 'send-support-email';

  function deviceInfo() {
    const ua = navigator.userAgent || '';
    const device = /iPhone/i.test(ua) ? 'iPhone'
      : /iPad/i.test(ua) ? 'iPad'
      : /Android/i.test(ua) ? 'Android'
      : /Windows/i.test(ua) ? 'Windows PC'
      : /Macintosh/i.test(ua) ? 'Mac'
      : 'Dispositivo non identificato';
    const browser = /Edg\//.test(ua) ? 'Edge'
      : /CriOS\//.test(ua) ? 'Chrome iOS'
      : /Chrome\//.test(ua) ? 'Chrome'
      : /FxiOS\//.test(ua) ? 'Firefox iOS'
      : /Firefox\//.test(ua) ? 'Firefox'
      : /Safari\//.test(ua) ? 'Safari'
      : 'Browser non identificato';
    return `${device} · ${browser} · ${innerWidth}×${innerHeight}`;
  }

  function supportContext(target) {
    if (target?.id === 'sendProSupport') {
      return {
        role: 'professional',
        area: document.getElementById('proSupportArea')?.value || 'Altro',
        message: (document.getElementById('proSupportMessage')?.value || '').trim()
      };
    }
    if (target?.matches?.('[onclick="sendPatientSupport()"]')) {
      return {
        role: 'patient',
        area: document.getElementById('patientSupportArea')?.value || 'Altro',
        message: (document.getElementById('patientSupportMessage')?.value || '').trim()
      };
    }
    return null;
  }

  async function send(target, context) {
    if (!context.message) {
      alert('Descrivi brevemente il problema prima di continuare.');
      return;
    }

    const client = window.nubemoSupabase;
    if (!client?.functions?.invoke) {
      alert('Servizio di assistenza momentaneamente non disponibile. Riprova più tardi.');
      return;
    }

    if (target.dataset.nubemoSending === '1') return;
    target.dataset.nubemoSending = '1';
    target.disabled = true;
    const previousText = target.textContent;
    target.textContent = 'Invio in corso…';

    try {
      const { data, error } = await client.functions.invoke(SUPPORT_FUNCTION, {
        body: {
          area: context.area,
          message: context.message,
          device: deviceInfo()
        }
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Invio non riuscito');
      alert(data.message || 'Segnalazione inviata all’assistenza NUBEMO.');
    } catch (error) {
      console.error('NUBEMO support email:', error);
      alert('Non è stato possibile inviare la segnalazione. Il testo inserito è stato mantenuto: riprova più tardi.');
    } finally {
      delete target.dataset.nubemoSending;
      target.disabled = false;
      target.textContent = previousText || 'Invia email all’assistenza';
      normalizeButtons();
    }
  }

  function normalizeButtons() {
    const patient = document.querySelector('[onclick="sendPatientSupport()"]');
    if (patient && patient.dataset.nubemoSending !== '1') patient.textContent = 'Invia email all’assistenza';
    const professional = document.getElementById('sendProSupport');
    if (professional && professional.dataset.nubemoSending !== '1') professional.textContent = 'Invia email all’assistenza';
  }

  document.addEventListener('click', event => {
    const target = event.target?.closest?.('button');
    const context = supportContext(target);
    if (!context) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void send(target, context);
  }, true);

  const observer = new MutationObserver(normalizeButtons);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  normalizeButtons();

  window.nubemoSupportEmailBridge = { send };
})();
