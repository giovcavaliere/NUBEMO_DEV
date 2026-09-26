// NUBEMO 4.0 — caricamento puntuale del Riepilogo paziente.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  const bootstrap=window.nubemoProfessionalDashboardBootstrap;
  if(!client||!bootstrap)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  const summaryMeta=new Map();

  const parse=(value,fallback)=>{try{return JSON.parse(value)}catch(_){return fallback}};

  function summaryPatient(payload){
    const row=payload?.patient||{};
    const lw=payload?.latest_weight||null;
    const lm=payload?.latest_measurement||null;
    const weights=[];
    if(lw?.date&&lw?.weight!==null&&lw?.weight!==undefined&&Number.isFinite(Number(lw.weight)))weights.push([String(lw.date),Number(lw.weight)]);
    const measures=[];
    if(lm?.date)measures.push({
      _remoteId:lm.id||null,
      date:String(lm.date),
      professionalWeight:lm.weight??'',
      waist:lm.waist??'',
      hips:lm.hips??'',
      notes:lm.notes||''
    });
    return {
      id:String(row.id),profileId:row.profile_id||null,
      name:String(row.name||'Paziente'),firstName:String(row.first_name||''),surname:String(row.last_name||''),
      phone:String(row.phone||''),email:String(row.email||''),birth:row.birth_date||'',sex:row.sex||'',height:row.height_cm??'',
      startDate:row.pathway_start_date||String(row.started_at||'').slice(0,10),status:row.patient_status||'active',relationshipStatus:'active',
      goal:row.goal_weight_kg??'',minWeight:row.min_weight_kg??'',maxWeight:row.max_weight_kg??'',reasonableWeight:row.reasonable_weight_kg??'',theoreticalWeight:row.theoretical_weight_kg??'',
      work:row.work||'',activity:row.activity||'',activityFactor:row.activity_factor??'',smoking:row.smoking||'',alcohol:row.alcohol||'',diagnosis:row.diagnosis||'',bowel:row.bowel||'',metabolism:row.metabolism||'',feeg:row.feeg||'',impedance:row.impedance||'',
      famObesity:!!row.family_obesity,famDiabetes:!!row.family_diabetes,famHypertension:!!row.family_hypertension,famCardiovascular:!!row.family_cardiovascular,famDyslipidemia:!!row.family_dyslipidemia,famThyroid:!!row.family_thyroid,famGestational:false,
      previousDiets:row.previous_diets||'',allergies:row.allergies||'',medications:row.medications||'',giIssues:row.gi_issues||'',pastConditions:row.past_conditions||'',observations:row.observations||'',objectives:row.objectives||'',
      showEnergyValues:row.show_energy_values!==false,
      readOnly:row.read_only===true,
      weights,diary:[],entries:[],measures,
      real:true,remote:true,_patientListShell:false,_summaryHydrated:true,_hydrated:false
    };
  }

  function publishPatient(patient){
    const rows=parse(window.nubemoProfessionalRuntimeStore.storage.getItem(EXTRA_PATIENTS_KEY)||'[]',[]);
    if(!Array.isArray(rows))return;
    const index=rows.findIndex(row=>String(row?.id||'')===patient.id);
    if(index>=0)rows[index]={...rows[index],...patient};
    else rows.push(patient);
    window.nubemoProfessionalRuntimeStore.storage.setItem(EXTRA_PATIENTS_KEY,JSON.stringify(rows));
  }


  async function load(patientId){
    const id=String(patientId||'');
    if(!id)throw new Error('Paziente non valido.');
    const {data,error}=await client.rpc('get_professional_patient_summary',{p_patient_id:id});
    if(error)throw error;
    if(!data?.patient)throw new Error('Riepilogo paziente non disponibile.');
    summaryMeta.set(id,data);
    publishPatient(summaryPatient(data));
    return data;
  }

  window.nubemoProfessionalPatientSummaryLazy=Object.freeze({load,summaryMeta});
})();
