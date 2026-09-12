// NUBEMO recovery 3.98 — unifica le azioni della scheda paziente nel menu ⋯.
// Mantiene il flusso Modifica scheda della 3.98 e Termina percorso del bridge Supabase.
(() => {
  'use strict';

  const app=document.getElementById('proApp');
  if(!app)return;

  let patching=false;

  function patch(){
    if(patching)return;
    patching=true;
    try{
      if(document.body.dataset.proView!=='details')return;

      const head=document.querySelector('.patient-global-head');
      const editTop=document.getElementById('editPatientProfileTop');
      const moreWrap=document.querySelector('.patient-more-wrap');
      const moreMenu=document.getElementById('patientMoreMenu');
      if(!head||!editTop||!moreWrap||!moreMenu)return;

      // Il pulsante 3.98 resta vivo come owner del flusso di modifica,
      // ma non viene più mostrato come azione separata.
      editTop.style.display='none';
      editTop.setAttribute('aria-hidden','true');

      if(!document.getElementById('patientMenuEditProfile')){
        const editMenu=document.createElement('button');
        editMenu.id='patientMenuEditProfile';
        editMenu.type='button';
        editMenu.textContent='Modifica scheda';
        moreMenu.insertBefore(editMenu,moreMenu.firstChild);
        editMenu.addEventListener('click',event=>{
          event.preventDefault();
          event.stopPropagation();
          const owner=document.getElementById('editPatientProfileTop');
          if(owner)owner.click();
        });
      }

      // Sposta l'unico menu ⋯ accanto al nome paziente, eliminando
      // visivamente il secondo punto azioni nel riepilogo.
      if(moreWrap.parentElement!==head)head.appendChild(moreWrap);
    }finally{patching=false;}
  }

  const observer=new MutationObserver(()=>queueMicrotask(patch));
  observer.observe(app,{childList:true,subtree:true});
  patch();
})();
