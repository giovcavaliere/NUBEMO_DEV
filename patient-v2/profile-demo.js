(() => {
  'use strict';

  const $=(selector,root=document)=>root.querySelector(selector);
  const PHOTO_TYPES=new Set(['image/png','image/jpeg','image/webp']);
  const PHOTO_MAX_BYTES=2.5*1024*1024;

  function modal(title,body){
    document.querySelector('.patient-demo-modal')?.remove();
    const wrap=document.createElement('div');
    wrap.className='patient-demo-modal';
    wrap.innerHTML=
      '<div class="patient-demo-modal-card">'+
        '<div class="patient-demo-modal-head">'+
          '<div><span class="patient-view-eyebrow">Patient 2.0</span><h2>'+title+'</h2></div>'+
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

  function resetPhoto(){
    const preview=$('[data-patient-profile-avatar]');
    if(preview)preview.innerHTML='<span>GC</span>';
    const input=$('[data-patient-profile-photo]');
    if(input)input.value='';
  }

  function previewPhoto(file){
    if(!file)return;
    if(!PHOTO_TYPES.has(file.type)){
      modal('Foto profilo','<p class="patient-demo-message">Formato non supportato. Usa JPG, PNG o WebP.</p>');
      return;
    }
    if(file.size>PHOTO_MAX_BYTES){
      modal('Foto profilo','<p class="patient-demo-message">La foto demo può avere una dimensione massima di 2,5 MB.</p>');
      return;
    }

    const reader=new FileReader();
    reader.onload=()=>{
      const preview=$('[data-patient-profile-avatar]');
      if(preview)preview.innerHTML='<img src="'+String(reader.result)+'" alt="Anteprima foto profilo">';
    };
    reader.readAsDataURL(file);
  }

  function openPrivacyInfo(){
    modal('Informativa privacy',
      '<div class="patient-profile-privacy-copy">'+
        '<p>Qui il paziente potrà consultare l’informativa privacy NUBEMO collegata al proprio account.</p>'+
        '<p>Nella versione statica non viene ancora caricato alcun documento reale.</p>'+
      '</div>');
  }

  function openPrivacyConsents(){
    const wrap=modal('Gestisci consensi',
      '<form class="patient-profile-dialog-form">'+
        '<label><span>Comunicazioni via email</span><select><option selected>Attive</option><option>Non attive</option></select></label>'+
        '<label><span>Promemoria appuntamenti via email</span><select><option selected>Attivi</option><option>Non attivi</option></select></label>'+
        '<button class="patient-primary" type="button" data-profile-consents-save>Salva impostazioni</button>'+
      '</form>');
    $('[data-profile-consents-save]',wrap)?.addEventListener('click',()=>{
      wrap.remove();
      modal('Consensi','<p class="patient-demo-message">Impostazioni salvate nella demo. Nessun dato reale è stato modificato.</p>');
    });
  }

  function openSupport(){
    const wrap=modal('Richiedi assistenza',
      '<form class="patient-profile-dialog-form">'+
        '<label><span>Tipo di richiesta</span><select><option>Problema tecnico</option><option>Accesso all’account</option><option>Documenti</option><option>Altro</option></select></label>'+
        '<label><span>Descrivi il problema</span><textarea placeholder="Scrivi qui la tua richiesta…"></textarea></label>'+
        '<button class="patient-primary" type="button" data-profile-support-send>Invia richiesta</button>'+
      '</form>');
    $('[data-profile-support-send]',wrap)?.addEventListener('click',()=>{
      wrap.remove();
      modal('Richiesta inviata','<p class="patient-demo-message">Invio simulato nella versione statica Patient 2.0.</p>');
    });
  }

  document.addEventListener('change',event=>{
    if(event.target.matches('[data-patient-profile-photo]')){
      previewPhoto(event.target.files?.[0]);
    }
  });

  document.addEventListener('click',event=>{
    if(event.target.closest('[data-patient-profile-photo-remove]')){
      resetPhoto();
      return;
    }

    const action=event.target.closest('[data-patient-profile-action]');
    if(action){
      const kind=action.dataset.patientProfileAction;
      if(kind==='privacy-info')openPrivacyInfo();
      if(kind==='privacy-consents')openPrivacyConsents();
      if(kind==='support')openSupport();
      return;
    }

    const homeSupport=event.target.closest('[data-patient-modal="support"]');
    if(homeSupport){
      openSupport();
    }
  });
})();