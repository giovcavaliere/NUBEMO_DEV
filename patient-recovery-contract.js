// NUBEMO recovery 3.98 — contratto UI Paziente.
// Mantiene la 3.98 e rimuove soltanto funzioni esplicitamente dismesse
// nella nuova architettura: import storico e backup/ripristino JSON locali.
(() => {
  'use strict';
  const app=document.getElementById('app');
  if(!app)return;

  function enforce(){
    app.querySelectorAll('button[onclick]').forEach(button=>{
      const action=String(button.getAttribute('onclick')||'');
      if(action.includes('showImport()')||action.includes('exportBackup()')||action.includes('backupFile')) button.remove();
    });
    app.querySelectorAll('#backupFile').forEach(input=>input.remove());
  }

  const observer=new MutationObserver(()=>queueMicrotask(enforce));
  observer.observe(app,{childList:true,subtree:true});
  enforce();

  window.nubemoPatientRecoveryContract=Object.freeze({enforce});
})();
