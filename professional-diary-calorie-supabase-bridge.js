// NUBEMO 4.0 — calorie Diario Professionista da valori persistiti.
// Il professionista non carica il catalogo alimenti: i valori visualizzati arrivano da diary_entries.
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
  let currentPatientId='';
  let currentDiaryDate='';
  let patchQueued=false;

  if(!window.nubemoFoodCatalog){
    window.nubemoFoodCatalog=Object.freeze({nubemoFoods:Object.freeze([]),findCrea:()=>null,canUseCrea:()=>false});
  }

  const DIARY_COLUMNS=[
    'id','patient_id','entry_date','weight_kg','water','coffee','sweetener',
    'breakfast','morning_snack','lunch','afternoon_snack','dinner','sport','notes',
    'breakfast_kcal','morning_snack_kcal','lunch_kcal','afternoon_snack_kcal','dinner_kcal','total_kcal',
    'calorie_quality','calorie_calculated_at','created_by_user_id','created_at','updated_at'
  ].join(',');

  async function loadPatientDiary(patientId){
    const {data,error}=await client.from('diary_entries').select(DIARY_COLUMNS).eq('patient_id',patientId).is('deleted_at',null).order('entry_date',{ascending:false});
    if(error)throw error;
    const rows=data||[];
    primePatientDiary(patientId,rows);
    return rows;
  }

  window.nubemoProfessionalServices=Object.freeze({...originalServices,loadPatientDiary});

  function primePatientDiary(patientId,rows){
    const id=String(patientId||'');
    if(!id)return;
    currentPatientId=id;
    caloriesByPatient.set(id,new Map((Array.isArray(rows)?rows:[]).filter(row=>row?.entry_date).map(row=>[row.entry_date,row])));
    queuePatch();
  }

  function calorieFields(patientId,date){return caloriesByPatient.get(patientId)?.get(date)||null;}

  function enrichEntry(patientId,entry){
    if(!entry?.date)return entry;
    const row=calorieFields(patientId,entry.date);
    if(!row)return entry;
    return {...entry,breakfastKcal:row.breakfast_kcal??null,morningSnackKcal:row.morning_snack_kcal??null,lunchKcal:row.lunch_kcal??null,afternoonSnackKcal:row.afternoon_snack_kcal??null,dinnerKcal:row.dinner_kcal??null,totalKcal:row.total_kcal??null,calorieQuality:row.calorie_quality||'none',calorieCalculatedAt:row.calorie_calculated_at||null};
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

  function patientName(row){const p=row?.profile||{};return [p.first_name,p.last_name].filter(Boolean).join(' ').trim()||p.email||'Paziente';}

  function inferPatientId(){
    if(currentPatientId)return currentPatientId;
    const rows=window.nubemoProfessionalContext?.patients||context.patients||[];
    const title=document.querySelector('.patient-global-title')?.textContent||'';
    const row=rows.find(p=>title.includes(patientName(p)));
    if(row)currentPatientId=row.id;
    return currentPatientId;
  }

  function formatDate(iso){const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:String(iso||'');}
  function qualityLabel(row){return row?.calorie_quality==='good'?'buona':row?.calorie_quality==='partial'?'parziale':'non disponibile';}

  function latestStored(patientId){
    const map=caloriesByPatient.get(patientId);if(!map)return null;
    const rows=[...map.values()].filter(row=>row.total_kcal!==null&&row.total_kcal!==undefined&&Number.isFinite(Number(row.total_kcal)));
    rows.sort((a,b)=>String(a.entry_date).localeCompare(String(b.entry_date)));
    return rows.at(-1)||null;
  }

  function setText(node,value){if(node&&node.textContent!==value)node.textContent=value;}

  function patchSummary(patientId){
    const box=[...document.querySelectorAll('.patient-summary-grid > div')].find(node=>node.querySelector(':scope > span')?.textContent?.trim()==='Calorie stimate dal diario');
    if(!box)return;
    const row=latestStored(patientId);
    setText(box.querySelector('b'),row?`${Number(row.total_kcal)} kcal`:'—');
    setText(box.querySelector('small'),row?`${formatDate(row.entry_date)} · stima ${qualityLabel(row)}`:'Nessun pasto interpretabile');
  }

  function patchHistory(patientId){
    document.querySelectorAll('[data-pro-diary-day]').forEach(button=>{
      const row=calorieFields(patientId,button.dataset.proDiaryDay);
      const right=button.querySelector('.history-right');if(!right)return;
      let line=right.querySelector('.nubemo-stored-kcal');
      const available=row&&row.total_kcal!==null&&row.total_kcal!==undefined&&Number.isFinite(Number(row.total_kcal));
      if(!available){line?.remove();return;}
      if(!line){line=document.createElement('small');line.className='nubemo-stored-kcal';right.appendChild(line);}
      setText(line,`${Number(row.total_kcal)} kcal · stima ${qualityLabel(row)}`);
    });
  }

  function detailDate(){
    if(currentDiaryDate)return currentDiaryDate;
    for(const h2 of document.querySelectorAll('section.card h2')){
      const m=String(h2.textContent||'').trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if(m)return `${m[3]}-${m[2]}-${m[1]}`;
    }
    return '';
  }

  function patchDay(patientId){
    const date=detailDate();if(!date)return;
    const row=calorieFields(patientId,date);
    const box=[...document.querySelectorAll('.pro3-detail > div')].find(node=>node.querySelector(':scope > span')?.textContent?.trim()==='Calorie stimate');
    if(!box)return;
    const available=row&&row.total_kcal!==null&&row.total_kcal!==undefined&&Number.isFinite(Number(row.total_kcal));
    setText(box.querySelector('b'),available?`${Number(row.total_kcal)} kcal`:'—');
    setText(box.querySelector('small'),available?`Stima ${qualityLabel(row)}`:'');
  }

  function patchPersistedCalories(){patchQueued=false;const patientId=inferPatientId();if(!patientId)return;patchSummary(patientId);patchHistory(patientId);patchDay(patientId);}
  function queuePatch(){if(patchQueued)return;patchQueued=true;queueMicrotask(patchPersistedCalories);}

  document.addEventListener('click',event=>{
    const patient=event.target?.closest?.('[data-patient]');if(patient?.dataset?.patient)currentPatientId=patient.dataset.patient;
    const drawer=event.target?.closest?.('[data-drawer-patient]');if(drawer?.dataset?.drawerPatient)currentPatientId=drawer.dataset.drawerPatient;
    const day=event.target?.closest?.('[data-pro-diary-day]');if(day?.dataset?.proDiaryDay)currentDiaryDate=day.dataset.proDiaryDay;
    const back=event.target?.closest?.('#backDiary');if(back)currentDiaryDate='';
  },true);

  function installRuntimeHelpers(){
    if(runtimeInstalled)return;
    runtimeInstalled=true;
    const app=document.getElementById('proApp');if(app)new MutationObserver(queuePatch).observe(app,{childList:true,subtree:true});
    queuePatch();
  }

  window.nubemoProfessionalDiaryCaloriesBridge=Object.freeze({installStorageOverlay,installRuntimeHelpers,primePatientDiary,caloriesByPatient});
})();
