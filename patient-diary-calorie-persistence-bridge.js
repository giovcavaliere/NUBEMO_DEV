// NUBEMO 4.0 — persistenza calorie Diario Paziente.
// Nessuna modifica UI/calcolo: intercetta il salvataggio legacy e persiste il risultato già calcolabile dal frontend.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  const originalServices=window.nubemoPatientServices;
  if(!client||!originalServices)return;

  const KEY='diario-pro-patient-main-v1';
  const storageProto=Object.getPrototypeOf(window.localStorage);
  const previousGetItem=storageProto.getItem;
  const previousSetItem=storageProto.setItem;
  const pendingByDate=new Map();

  const parse=(value,fallback)=>{try{return JSON.parse(value)}catch(_){return fallback}};
  const signature=entry=>JSON.stringify({
    date:entry?.date||'',weight:entry?.weight??'',water:entry?.water??'',coffee:entry?.coffee??0,
    sweetener:entry?.sweetener||'',breakfast:entry?.breakfast||'',snack1:entry?.snack1||'',
    lunch:entry?.lunch||'',snack2:entry?.snack2||'',dinner:entry?.dinner||'',notes:entry?.notes||''
  });

  function calculate(entry){
    if(typeof window.calorieEstimateText!=='function'||typeof window.calorieEstimateDay!=='function')return null;
    const meal=text=>{
      const r=window.calorieEstimateText(text||'');
      const usable=Number(r?.calculated||0)+Number(r?.genericQuantity||0);
      return usable>0?Number(r.calories||0):null;
    };
    const day=window.calorieEstimateDay(entry||{});
    const usable=Number(day?.calculated||0)+Number(day?.genericQuantity||0);
    return {
      breakfast_kcal:meal(entry?.breakfast),
      morning_snack_kcal:meal(entry?.snack1),
      lunch_kcal:meal(entry?.lunch),
      afternoon_snack_kcal:meal(entry?.snack2),
      dinner_kcal:meal(entry?.dinner),
      total_kcal:usable>0?Number(day.calories||0):null,
      calorie_quality:usable>0?(day.quality||'partial'):'none',
      calorie_calculated_at:new Date().toISOString()
    };
  }

  storageProto.setItem=function(key,value){
    if(this===window.localStorage&&String(key)===KEY){
      const previous=parse(previousGetItem.call(this,key)||'[]',[]);
      const next=parse(String(value),[]);
      if(Array.isArray(next)){
        const oldByDate=new Map((Array.isArray(previous)?previous:[]).filter(x=>x?.date).map(x=>[x.date,x]));
        for(const entry of next){
          if(!entry?.date)continue;
          const old=oldByDate.get(entry.date);
          if(!old||signature(old)!==signature(entry)){
            const values=calculate(entry);
            if(values)pendingByDate.set(entry.date,values);
          }
        }
      }
    }
    return previousSetItem.call(this,key,value);
  };

  async function saveDiaryEntry(patientId,userId,values,existingId=null){
    const calories=pendingByDate.get(values.entry_date)||null;
    const payload={
      patient_id:patientId,
      entry_date:values.entry_date,
      weight_kg:values.weight_kg,
      water:values.water,
      coffee:values.coffee,
      sweetener:values.sweetener,
      breakfast:values.breakfast,
      morning_snack:values.morning_snack,
      lunch:values.lunch,
      afternoon_snack:values.afternoon_snack,
      dinner:values.dinner,
      sport:values.sport,
      notes:values.notes,
      created_by_user_id:userId,
      deleted_at:null,
      ...(calories||{})
    };
    const q=existingId
      ? client.from('diary_entries').update(payload).eq('id',existingId)
      : client.from('diary_entries').insert(payload);
    const {data,error}=await q.select('*').single();
    if(error)throw new Error(error.message||'Salvataggio diario non riuscito.');
    if(calories)pendingByDate.delete(values.entry_date);
    return data;
  }

  window.nubemoPatientServices=Object.freeze({...originalServices,saveDiaryEntry});
  window.nubemoPatientDiaryCaloriePersistence=Object.freeze({pendingByDate});
})();
