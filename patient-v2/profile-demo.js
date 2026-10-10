(() => {
  'use strict';

  const $=(selector,root=document)=>root.querySelector(selector);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));

  const privacyState={
    consent:true,
    communicationsEmail:true,
    remindersEmail:true,
    updatedAt:'1 ottobre 2026'
  };

  function modal(title,body){
    document.querySelector('.patient-demo-modal')?.remove();
    const wrap=document.createElement('div');
    wrap.className='patient-demo-modal';
    wrap.innerHTML=
      '<div class="patient-demo-modal-card">'+
        '<div class="patient-demo-modal-head">'+
          '<div><span class="patient-view-eyebrow">Patient 2.0</span><h2>'+esc(title)+'</h2></div>'+
          '<button type="button" class="patient-demo-modal-close" aria-label="Chiudi">×</button>'+
        '</div>'+
        body+
      '</div>';
    document.body.appendChild(wrap);
    const close=()=>wrap.remove();
    $('.patient-demo-modal-close',wrap)?.addEventListener('click',close);
    wrap.addEventListener('click',event=>{if(event.target===wrap)close();});
    return wrap;
  }

  function toast(title,message){
    const wrap=modal(title,'<p class="patient-demo-message">'+esc(message)+'</p>');
    setTimeout(()=>wrap.remove(),2200);
  }

  function renderPrivacyState(){
    const consent=$('[data-patient-privacy-consent]');
    const communications=$('[data-patient-privacy-communications]');
    const reminders=$('[data-patient-privacy-reminders]');
    const updated=$('[data-patient-privacy-updated]');

    if(consent)consent.textContent=privacyState.consent?'Firmato':'Non registrato';
    if(communications)communications.textContent=privacyState.communicationsEmail?'Email':'Non attive';
    if(reminders)reminders.textContent=privacyState.remindersEmail?'Email':'Non attivi';
    if(updated)updated.textContent='Ultimo aggiornamento · '+privacyState.updatedAt;
  }

  function openPrivacyInfo(){
    modal('Informativa privacy',
      '<div class="patient-profile-privacy-copy">'+
        '<p>Questa è una schermata demo della futura informativa privacy NUBEMO.</p>'+
        '<p>Nella versione collegata ai dati reali saranno disponibili versione dell’informativa, data di accettazione e documento associato.</p>'+
      '</div>');
  }

  function openConsents(){
    const wrap=modal('Gestisci consensi',
      '<form class="patient-profile-consent-form">'+
        '<div class="patient-profile-consent-row">'+
          '<div><strong>Consenso privacy</strong><small>Consenso necessario per l’utilizzo del servizio.</small></div>'+
          '<span class="patient-profile-consent-fixed">Firmato</span>'+
        '</div>'+
        '<label class="patient-profile-consent-row">'+
          '<div><strong>Comunicazioni via email</strong><small>Comunicazioni legate al percorso.</small></div>'+
          '<input type="checkbox" data-consent-communications '+(privacyState.communicationsEmail?'checked':'')+'>'+
        '</label>'+
        '<label class="patient-profile-consent-row">'+
          '<div><strong>Promemoria appuntamenti</strong><small>Invio dei promemoria via email.</small></div>'+
          '<input type="checkbox" data-consent-reminders '+(privacyState.remindersEmail?'checked':'')+'>'+
        '</label>'+
        '<button class="patient-primary" type="submit">Salva consensi</button>'+
      '</form>');

    $('.patient-profile-consent-form',wrap)?.addEventListener('submit',event=>{
      event.preventDefault();
      privacyState.communicationsEmail=!!$('[data-consent-communications]',wrap)?.checked;
      privacyState.remindersEmail=!!$('[data-consent-reminders]',wrap)?.checked;
      privacyState.updatedAt='10 ottobre 2026';
      renderPrivacyState();
      wrap.remove();
      toast('Consensi aggiornati','Nella versione reale lo stesso stato sarà visibile anche al professionista.');
    });
  }

  function openSupport(){
    const wrap=modal('Richiedi assistenza',
      '<form class="patient-profile-dialog-form" data-patient-support-form>'+
        '<label>Area dell’app<select name="area" required>'+
          '<option value="">Seleziona area</option>'+
          '<option>Home</option>'+
          '<option>Diario</option>'+
          '<option>Piano alimentare</option>'+
          '<option>Documenti</option>'+
          '<option>Profilo</option>'+
          '<option>Privacy e consensi</option>'+
          '<option>Accesso / account</option>'+
          '<option>Altro</option>'+
        '</select></label>'+
        '<label>Tipo di richiesta<select name="type" required>'+
          '<option value="">Seleziona tipo</option>'+
          '<option>Problema tecnico</option>'+
          '<option>Funzione che non risponde</option>'+
          '<option>Dato non corretto</option>'+
          '<option>Problema di accesso</option>'+
          '<option>Problema con un documento</option>'+
          '<option>Problema con notifiche o email</option>'+
          '<option>Richiesta privacy / consensi</option>'+
          '<option>Richiesta di chiarimento sull’app</option>'+
          '<option>Suggerimento o nuova funzione</option>'+
          '<option>Altro</option>'+
        '</select></label>'+
        '<label>Descrivi cosa è successo<textarea name="message" required placeholder="Spiega cosa stavi facendo e cosa è successo…"></textarea></label>'+
        '<button class="patient-primary" type="submit">Invia richiesta</button>'+
      '</form>');

    $('[data-patient-support-form]',wrap)?.addEventListener('submit',event=>{
      event.preventDefault();
      wrap.remove();
      toast('Richiesta preparata','Invio demo completato. Nessuna richiesta reale è stata trasmessa.');
    });
  }

  function handlePhoto(file){
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){
      toast('Formato non supportato','Usa JPG, PNG o WebP.');
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>{
      const preview=$('[data-patient-profile-avatar]');
      if(preview)preview.innerHTML='<img src="'+esc(reader.result)+'" alt="Foto profilo">';
    };
    reader.readAsDataURL(file);
  }

  document.addEventListener('change',event=>{
    const input=event.target.closest('[data-patient-profile-photo]');
    if(input)handlePhoto(input.files?.[0]);
  });

  document.addEventListener('click',event=>{
    const remove=event.target.closest('[data-patient-profile-photo-remove]');
    if(remove){
      const preview=$('[data-patient-profile-avatar]');
      if(preview)preview.innerHTML='<span>GC</span>';
      return;
    }

    const action=event.target.closest('[data-patient-profile-action]');
    if(!action)return;

    if(action.dataset.patientProfileAction==='privacy-info')openPrivacyInfo();
    if(action.dataset.patientProfileAction==='privacy-consents')openConsents();
    if(action.dataset.patientProfileAction==='support')openSupport();
  });

  renderPrivacyState();
})();