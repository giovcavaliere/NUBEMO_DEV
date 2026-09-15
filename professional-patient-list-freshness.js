// NUBEMO 4.0 — elenco Pazienti sempre riallineato dopo creazioni/modifiche.
(() => {
  'use strict';

  const bypass=new WeakSet();
  let refreshing=null;

  async function refreshPatientList(){
    const bridge=window.nubemoProfessionalDashboardBootstrap;
    if(!bridge?.loadPatientsList)return;
    if(refreshing)return refreshing;
    refreshing=bridge.loadPatientsList(true).finally(()=>{refreshing=null;});
    return refreshing;
  }

  document.addEventListener('click',event=>{
    const action=event.target?.closest?.('[data-view="patients"],[data-drawer-view="patients"],#openUnreadLabPatients,#openUnreadPatients');
    if(!action)return;

    if(bypass.has(action)){
      bypass.delete(action);
      return;
    }

    const bridge=window.nubemoProfessionalDashboardBootstrap;
    if(!bridge?.loadPatientsList)return;

    event.preventDefault();
    event.stopImmediatePropagation();

    void refreshPatientList().then(()=>{
      bypass.add(action);
      action.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    }).catch(error=>{
      console.error('NUBEMO refresh elenco pazienti:',error);
      alert('Non riesco ad aggiornare l’elenco pazienti. Riprova.');
    });
  },true);

  window.nubemoProfessionalPatientListFreshness=Object.freeze({refresh:refreshPatientList});
})();