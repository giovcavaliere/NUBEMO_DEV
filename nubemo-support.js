// NUBEMO — Assistenza NUBEMO (Area Professionista + Area Paziente).
//
// Riscrittura completa della sezione Assistenza. Sostituisce:
//   - support-email-supabase-bridge.js  (invio + normalizzazione pulsanti)
//   - proSupportPage()/sendProSupport() in pro.js
//   - patientSupportPage()/sendPatientSupport() in app.js
//
// Un solo file per entrambe le aree: cambia solo la configurazione (titolo,
// elenco sezioni, testi). La logica di invio, il rilevamento dispositivo e la
// versione erano prima duplicati in tre punti; qui esistono una volta sola.
//
// Contratto verso il backend invariato: Edge Function `send-support-email`,
// body { area, message, device }. Il testo della mail lo compone il server.
(() => {
  'use strict';

  const VERSION = '4.0';
  const FUNCTION_NAME = 'send-support-email';
  const BUTTON_LABEL = 'Invia email all’assistenza';
  const BUTTON_SENDING = 'Invio in corso…';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

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

  // L'area mostrata deriva dal ruolo dell'utente autenticato, non dalla
  // pagina aperta: se il contesto di login non e' disponibile si ricade
  // sull'area del profilo corrente.
  function areaLabel(profile) {
    const ctx = profile.key === 'professional'
      ? window.nubemoProfessionalContext
      : window.nubemoPatientContext;
    const role = ctx?.role || ctx?.profile?.role || '';
    if (role === 'professional') return 'Professionista';
    if (role === 'patient') return 'Paziente';
    if (role === 'admin') return 'Amministratore';
    return profile.fallbackArea;
  }

  const PROFILES = {
    professional: {
      key: 'professional',
      fallbackArea: 'Professionista',
      areaSelectId: 'proSupportArea',
      messageId: 'proSupportMessage',
      buttonId: 'sendProSupport',
      placeholder: 'Es. In Agenda, aprendo uno slot libero...',
      intro: 'Descrivi il problema riscontrato. NUBEMO preparerà una mail all\'assistenza includendo automaticamente solo le informazioni tecniche utili.',
      privacy: 'Nella mail non vengono inseriti automaticamente nomi dei pazienti, dati clinici, diario o documenti.',
      sections: ['Dashboard', 'Pazienti', 'Agenda', 'Scheda paziente', 'Esami', 'Piano alimentare', 'Documenti', 'Diario', 'Andamento', 'Misure', 'Visite', 'Profilo professionista', 'Altro'],
      extraCard: ''
    },
    patient: {
      key: 'patient',
      fallbackArea: 'Paziente',
      areaSelectId: 'patientSupportArea',
      messageId: 'patientSupportMessage',
      buttonId: 'sendPatientSupport',
      placeholder: 'Es. Ho aperto la giornata del 21/08, ho premuto Duplica...',
      intro: 'Hai riscontrato un problema tecnico nell\'app? Descrivilo qui sotto: NUBEMO preparerà una mail per l\'assistenza con alcune informazioni tecniche utili.',
      privacy: 'Vengono inserite nella mail solo informazioni tecniche e il testo che scrivi. Peso, diario, dati clinici e documenti non vengono allegati automaticamente.',
      sections: ['Dashboard', 'Aggiungi giornata', 'Andamento', 'Misure', 'Documenti', 'Profilo', 'Altro'],
      extraCard: '<section class="card support-care-note"><b>Per questioni sul tuo percorso alimentare</b><p>Contatta direttamente il tuo professionista. Questa sezione è dedicata esclusivamente ai problemi tecnici di NUBEMO.</p></section>'
    }
  };

  // Corpo della pagina, senza intestazione: ogni area conserva la propria
  // (barra + nav per il professionista, page-title con back per il paziente).
  function body(profile) {
    const options = profile.sections
      .map(s => `<option value="${esc(s)}">${esc(s)}</option>`)
      .join('');
    return `<section class="card support-card">
   <div class="eyebrow">SUPPORTO TECNICO</div><h2>Segnala un problema</h2>
   <p>${esc(profile.intro)}</p>
   <div class="support-tech-info"><span>Area</span><b>${esc(areaLabel(profile))}</b><span>Versione</span><b>${esc(VERSION)}</b><span>Dispositivo</span><b>${esc(deviceInfo())}</b></div>
   <label>Area dell'app</label>
   <select id="${profile.areaSelectId}">${options}</select>
   <label>Descrivi cosa è successo</label>
   <textarea id="${profile.messageId}" rows="6" placeholder="${esc(profile.placeholder)}"></textarea>
   <button class="primary support-send" id="${profile.buttonId}" type="button">${esc(BUTTON_LABEL)}</button>
   <p class="muted support-privacy">${esc(profile.privacy)}</p>
 </section>${profile.extraCard}`;
  }

  async function send(profile, button) {
    const area = document.getElementById(profile.areaSelectId);
    const message = document.getElementById(profile.messageId);
    const text = (message?.value || '').trim();

    if (!text) {
      alert('Descrivi brevemente il problema prima di continuare.');
      return;
    }

    const client = window.nubemoSupabase;
    if (!client?.functions?.invoke) {
      alert('Servizio di assistenza momentaneamente non disponibile. Riprova più tardi.');
      return;
    }

    if (button.dataset.nubemoSending === '1') return;
    button.dataset.nubemoSending = '1';
    button.disabled = true;
    button.textContent = BUTTON_SENDING;

    try {
      const { data, error } = await client.functions.invoke(FUNCTION_NAME, {
        body: {
          area: area?.value || 'Altro',
          message: text,
          device: deviceInfo()
        }
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Invio non riuscito');
      alert(data.message || 'Segnalazione inviata all’assistenza NUBEMO.');
      // Svuota solo dopo conferma: se l'invio fallisce il testo resta.
      if (message) message.value = '';
      if (area) area.selectedIndex = 0;
    } catch (error) {
      console.error('NUBEMO assistenza:', error);
      alert('Non è stato possibile inviare la segnalazione. Il testo inserito è stato mantenuto: riprova più tardi.');
    } finally {
      delete button.dataset.nubemoSending;
      button.disabled = false;
      button.textContent = BUTTON_LABEL;
    }
  }

  // Un solo listener delegato per entrambe le aree: nessun handler inline,
  // nessun MutationObserver sull'intero documento.
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('button');
    if (!button) return;
    const profile = button.id === PROFILES.professional.buttonId ? PROFILES.professional
      : button.id === PROFILES.patient.buttonId ? PROFILES.patient
      : null;
    if (!profile) return;
    event.preventDefault();
    void send(profile, button);
  });

  window.NubemoSupport = Object.freeze({
    version: VERSION,
    deviceInfo,
    professionalBody: () => body(PROFILES.professional),
    patientBody: () => body(PROFILES.patient)
  });
})();
