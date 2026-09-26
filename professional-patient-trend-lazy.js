// NUBEMO 4.0 — Andamento professionista puntuale.
// Carica solo la serie peso (data + peso) del paziente selezionato.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  if(!client)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  const cache=new Map();

  const parse=(value,fallback)=>{try{return JSON.parse(value)}catch(_){return fallback}};

  function publish(patientId,rows){
    const patients=parse(window.nubemoProfessionalRuntimeStore.storage.getItem(EXTRA_PATIENTS_KEY)||'[]',[]);
    if(!Array.isArray(patients))throw new Error('Elenco pazienti non disponibile.');
    const index=patients.findIndex(row=>String(row?.id||'')===String(patientId));
    if(index<0)throw new Error('Paziente non disponibile nel contesto corrente.');

    const weights=(rows||[])
      .filter(row=>row?.date&&row.weight!==null&&row.weight!==undefined&&Number.isFinite(Number(row.weight)))
      .map(row=>[String(row.date),Number(row.weight)])
      .sort((a,b)=>a[0].localeCompare(b[0]));

    patients[index]={...patients[index],weights,_trendLazyLoaded:true};
    window.nubemoProfessionalRuntimeStore.storage.setItem(EXTRA_PATIENTS_KEY,JSON.stringify(patients));
    return weights;
  }

  async function load(patientId){
    const id=String(patientId||'');
    if(!id)throw new Error('Paziente non valido.');

    if(cache.has(id)){
      publish(id,cache.get(id));
      return cache.get(id);
    }

    const {data,error}=await client.rpc('get_professional_patient_weight_trend',{
      p_patient_id:id,
      p_days:0
    });
    if(error)throw error;

    const rows=Array.isArray(data)?data:[];
    cache.set(id,rows);
    publish(id,rows);
    return rows;
  }

  function clear(patientId){
    const id=String(patientId||'');
    if(id)cache.delete(id);else cache.clear();
  }

  window.nubemoProfessionalPatientTrendLazy=Object.freeze({load,clear,cache});
})();
