// NUBEMO 4.0 — Nuovo paziente senza runtime completo.
(() => {
  'use strict';

  const bypass=new WeakSet();
  let preparing=null;

  function loadScript(src,errorMessage){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.onload=resolve;
      script.onerror=()=>reject(new Error(errorMessage));
      document.body.appendChild(script);
    });
  }

  function hasScript(fragment){
    return [...document.scripts].some(script=>String(script.src||'').includes(fragment));
  }

  async function ensureReady(){
    if(preparing)return preparing;
    preparing=(async()=>{
      const started=performance.now();

      if(!window.nubemoProfessionalServices){
        if(!hasScript('professional-services.js')){
          await loadScript('professional-services.js?v=nubemo40clean01','Impossibile caricare i servizi necessari al nuovo paziente.');
        }
        if(!window.nubemoProfessionalServices)throw new Error('Servizi paziente non disponibili.');
      }

      if(!window.nubemoPatientLifecycleBridge){
        if(!hasScript('professional-patient-lifecycle-bridge.js')){
          await loadScript('professional-patient-lifecycle-bridge.js?v=nubemo40clean01','Impossibile preparare la creazione del paziente.');
        }
        await window.nubemoPatientLifecycleBridge?.ready;
        if(!window.nubemoPatientLifecycleBridge)throw new Error('Gestione nuovo paziente non disponibile.');
      }

      console.log(`[NUBEMO PERF] Nuovo paziente lazy: ${Math.round(performance.now()-started)} ms`);
      return true;
    })().catch(error=>{preparing=null;throw error;});
    return preparing;
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#newPatient');
    if(!button)return;

    if(bypass.has(button)){
      bypass.delete(button);
      const originalId=button.id;
      button.removeAttribute('id');
      queueMicrotask(()=>{if(button.isConnected&&!button.id)button.id=originalId;});
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    const wasDisabled=button.disabled;
    button.disabled=true;

    void ensureReady().then(()=>{
      button.disabled=wasDisabled;
      bypass.add(button);
      button.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    }).catch(error=>{
      button.disabled=wasDisabled;
      console.error('NUBEMO Nuovo paziente lazy:',error);
      alert('Non riesco a preparare la creazione del paziente. Riprova.');
    });
  },true);

  window.nubemoProfessionalNewPatientLazy=Object.freeze({ready:ensureReady});
})();