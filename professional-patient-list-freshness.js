// NUBEMO 4.0 — stato canonico elenco Pazienti/Draft tra viste.
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

  function republishCanonicalList(){
    const bridge=window.nubemoProfessionalDashboardBootstrap;
    if(!bridge?.loadPatientsList)return;
    // Se il payload reale e' gia' stato caricato, loadPatientsList() lo ripubblica
    // sincronicamente prima del render della Dashboard, senza nuova query.
    void bridge.loadPatientsList().catch(error=>{
      console.error('NUBEMO stato canonico pazienti:',error);
    });
  }

  // Pazienti deve sempre riflettere il DB dopo creazioni/modifiche.
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

  // Il guard ripristina il payload minimo Dashboard in capture. Prima che pro.js
  // esegua il render (bubble), rimettiamo la lista reale gia' caricata: in questo
  // modo nomi e ID di pazienti/draft restano coerenti senza duplicare query o stato.
  document.addEventListener('click',event=>{
    const action=event.target?.closest?.('[data-view="dashboard"],[data-drawer-view="dashboard"]');
    if(!action)return;
    republishCanonicalList();
  },false);

  window.nubemoProfessionalPatientListFreshness=Object.freeze({
    refresh:refreshPatientList,
    republish:republishCanonicalList
  });
})();