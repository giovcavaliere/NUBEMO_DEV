// NUBEMO 4.0 — calorie Diario Professionista da valori persistiti.
// Il professionista non carica il catalogo alimenti e non ricalcola le calorie.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  const originalServices=window.nubemoProfessionalServices;
  const context=window.nubemoProfessionalContext||{};
  if(!client||!originalServices)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  const caloriesByPatient=new Map();
  let storageInstalled=false;
  let runtimeInstalled=false;

  // Compatibilità di caricamento di pro.js: il vecchio parser resta nel file,
  // ma a runtime viene sostituito dalle letture persistite qui sotto.
  if(!window.nubemoFoodCatalog){
    window.nubemoFoodCatalog=Object.freeze({
      nubemoFoods:Object.freeze([]),
      findCrea:()=>null,
      canUseCrea:()=>false
    });
  }

  const DIARY_COLUMNS=[
    'id','patient_id','entry_date','weight_kg','water','coffee','sweetener',
    'breakfast','morning_snack','lunch','afternoon_snack','dinner','sport','notes',
    'breakfast_kcal','morning_snack_kcal','lunch_kcal','afternoon_snack_kcal','dinner_kcal','total_kcal',
    'calorie_quality','calorie_calculated_at','created_by_user_id','created_at','updated_at'
  ].join(',');

  async function loadPatientDiary(patientId){
    const {data,error}=await client.from('diary_entries')
      .select(DIARY_COLUMNS)
      .eq('patient_id',patientId)
      .is('deleted_at',null)
      .order('entry_date',{ascending:false});
    if(error)throw error;
    const rows=data||[];
    caloriesByPatient.set(patientId,new Map(rows.map(row=>[row.entry_date,row])));
    return rows;
  }

  window.nubemoProfessionalServices=Object.freeze({...originalServices,loadPatientDiary});

  function calorieFields(patientId,date){
    return caloriesByPatient.get(patientId)?.get(date)||null;
  }

  function enrichEntry(patientId,entry){
    if(!entry?.date)return entry;
    const row=calorieFields(patientId,entry.date);
    if(!row)return entry;
    return {
      ...entry,
      breakfastKcal:row.breakfast_kcal??null,
      morningSnackKcal:row.morning_snack_kcal??null,
      lunchKcal:row.lunch_kcal??null,
      afternoonSnackKcal:row.afternoon_snack_kcal??null,
      dinnerKcal:row.dinner_kcal??null,
      totalKcal:row.total_kcal??null,
      calorieQuality:row.calorie_quality||'none',
      calorieCalculatedAt:row.calorie_calculated_at||null
    };
  }

  function installStorageOverlay(){
    if(storageInstalled)return;
    storageInstalled=true;
    const storageProto=Object.getPrototypeOf(window.localStorage);
    const previousGetItem=storageProto.getItem;
    storageProto.getItem=function(key){
      const value=previousGetItem.call(this,key);
      if(this!==window.localStorage||String(key)!==EXTRA_PATIENTS_KEY||!value)return value;
      try{
        const rows=JSON.parse(value);
        if(!Array.isArray(rows))return value;
        return JSON.stringify(rows.map(patient=>{
          if(!patient?.id||!Array.isArray(patient.diary))return patient;
          return {...patient,diary:patient.diary.map(entry=>enrichEntry(patient.id,entry))};
        }));
      }catch(_){return value;}
    };
  }

  function storedEstimate(entry){
    const raw=entry?.totalKcal;
    if(raw===null||raw===undefined||raw===''){
      return {calories:0,calculated:0,genericQuantity:0,genericQuantityNoEstimate:0,missingQuantity:0,unknown:0,total:0,items:[],quality:'none',qualityLabel:'Non disponibile'};
    }
    const calories=Number(raw);
    if(!Number.isFinite(calories)){
      return {calories:0,calculated:0,genericQuantity:0,genericQuantityNoEstimate:0,missingQuantity:0,unknown:0,total:0,items:[],quality:'none',qualityLabel:'Non disponibile'};
    }
    const quality=entry?.calorieQuality==='good'?'good':entry?.calorieQuality==='partial'?'partial':'none';
    const qualityLabel=quality==='good'?'Buona':quality==='partial'?'Parziale':'Non disponibile';
    return {calories,calculated:1,genericQuantity:0,genericQuantityNoEstimate:0,missingQuantity:0,unknown:0,total:1,items:[],quality,qualityLabel};
  }

  function installRuntimeHelpers(){
    if(runtimeInstalled)return;
    runtimeInstalled=true;
    window.calorieEstimateDay=storedEstimate;
    window.estimateDiaryCalories=entry=>{
      const r=storedEstimate(entry);
      return r.calculated?r.calories:null;
    };
    window.dayEstimatedCalories=entry=>{
      const r=storedEstimate(entry);
      return r.calculated?r.calories:null;
    };
    window.latestDiaryCalories=p=>{
      const rows=(p?.entries||p?.diary||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      for(let i=rows.length-1;i>=0;i--){
        const r=storedEstimate(rows[i]);
        if(r.calculated)return {date:rows[i].date,calories:r.calories,quality:r.quality,qualityLabel:r.qualityLabel};
      }
      return null;
    };
  }

  window.nubemoProfessionalDiaryCaloriesBridge=Object.freeze({
    installStorageOverlay,
    installRuntimeHelpers,
    caloriesByPatient
  });
})();
