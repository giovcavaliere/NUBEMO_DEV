// NUBEMO — PENDING / ENDED: apri la scheda paziente reale, bypassando il lazy guard ACTIVE-only.
(() => {
  'use strict';
  const app=document.getElementById('proApp');
  if(!app)return;

  document.addEventListener('click',event=>{
    const grouped=event.target?.closest?.('.nubemo-patient-state-group [data-patient]');
    if(!grouped)return;
    if(event.target?.closest?.('button'))return;

    const group=grouped.closest('.nubemo-patient-state-group');
    if(!group||(!group.matches('#nubemoPendingPatientsGroup')&&!group.matches('#nubemoEndedPatientsGroup')))return;

    const patientId=String(grouped.dataset.patient||'');
    if(!patientId)return;
    const original=[...app.querySelectorAll(`button[data-patient="${CSS.escape(patientId)}"]`)]
      .find(node=>!node.closest('.nubemo-patient-state-group'));
    if(!original)return;

    event.preventDefault();
    event.stopImmediatePropagation();

    // Non ridispatchare un click DOM: professional-guard lo intercetterebbe e
    // tenterebbe get_professional_patient_summary(), valido solo per ACTIVE.
    // Chiamiamo direttamente l'handler installato da pro.js.
    if(typeof original.onclick==='function'){
      original.onclick.call(original,new MouseEvent('click',{bubbles:false,cancelable:true,view:window}));
    }
  },true);
})();
