// NUBEMO 4.0 — Diario professionista puntuale.
// Carica solo il periodo richiesto (default 30 giorni) e pubblica i dati nel contratto legacy di pro.js.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  if(!client)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  const cache=new Map();

  const parse=(value,fallback)=>{try{return JSON.parse(value)}catch(_){return fallback}};

  function legacyDiary(row){
    return {
      date:row.entry_date,
      weight:row.weight_kg??'',
      water:row.water??'',
      coffee:Number(row.coffee||0),
      sweetener:row.sweetener||'',
      breakfast:row.breakfast||'',
      snack1:row.morning_snack||'',
      lunch:row.lunch||'',
      snack2:row.afternoon_snack||'',
      dinner:row.dinner||'',
      notes:[row.sport,row.notes].filter(Boolean).join(row.sport&&row.notes?'\n':''),
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

  function publish(patientId,rows){
    const patients=parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]',[]);
    if(!Array.isArray(patients))throw new Error('Elenco pazienti non disponibile.');
    const index=patients.findIndex(row=>String(row?.id||'')===String(patientId));
    if(index<0)throw new Error('Paziente non disponibile nel contesto corrente.');
    const entries=(rows||[]).map(legacyDiary).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const periodWeights=entries.filter(x=>x.weight!==''&&x.weight!=null&&Number.isFinite(Number(x.weight))).map(x=>[x.date,Number(x.weight)]);
    const existingWeights=Array.isArray(patients[index].weights)?patients[index].weights:[];
    const weightMap=new Map(existingWeights.filter(x=>Array.isArray(x)&&x[0]).map(x=>[String(x[0]),Number(x[1])]));
    for(const [date,weight] of periodWeights)weightMap.set(String(date),Number(weight));
    patients[index]={...patients[index],diary:entries,entries,weights:[...weightMap.entries()].filter(([,w])=>Number.isFinite(w)).sort((a,b)=>a[0].localeCompare(b[0])),_diaryLazyDays:30};
    localStorage.setItem(EXTRA_PATIENTS_KEY,JSON.stringify(patients));
  }

  async function load(patientId,days=30){
    const id=String(patientId||'');
    const range=Math.max(1,Math.min(Number(days)||30,3650));
    if(!id)throw new Error('Paziente non valido.');
    const key=`${id}:${range}`;
    if(cache.has(key)){
      const rows=cache.get(key);
      publish(id,rows);
      window.nubemoProfessionalDiaryCaloriesBridge?.primePatientDiary?.(id,rows);
      return rows;
    }
    const {data,error}=await client.rpc('get_professional_patient_diary',{p_patient_id:id,p_days:range});
    if(error)throw error;
    const rows=Array.isArray(data)?data:[];
    cache.set(key,rows);
    publish(id,rows);
    window.nubemoProfessionalDiaryCaloriesBridge?.primePatientDiary?.(id,rows);
    return rows;
  }

  function clear(patientId){
    const id=String(patientId||'');
    for(const key of [...cache.keys()])if(key.startsWith(`${id}:`))cache.delete(key);
  }

  window.nubemoProfessionalPatientDiaryLazy=Object.freeze({load,clear,cache});
})();
