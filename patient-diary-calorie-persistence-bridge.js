// NUBEMO — persistenza calorie Diario Paziente.
// Nessuna modifica UI/calcolo: ogni salvataggio persiste il risultato
// calcolato dal frontend direttamente sul record Supabase del percorso attivo.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  const base=window.nubemoPatientServices;
  if(!client||!base)return;

  function calculateFromValues(values){
    if(typeof window.calorieEstimateText!=='function'||typeof window.calorieEstimateDay!=='function')return null;

    const entry={
      breakfast:values?.breakfast||'',
      snack1:values?.morning_snack||'',
      lunch:values?.lunch||'',
      snack2:values?.afternoon_snack||'',
      dinner:values?.dinner||''
    };

    const meal=text=>{
      const r=window.calorieEstimateText(text||'');
      const usable=Number(r?.calculated||0)+Number(r?.genericQuantity||0);
      return usable>0?Number(r.calories||0):null;
    };

    const day=window.calorieEstimateDay(entry);
    const usable=Number(day?.calculated||0)+Number(day?.genericQuantity||0);

    return {
      breakfast_kcal:meal(entry.breakfast),
      morning_snack_kcal:meal(entry.snack1),
      lunch_kcal:meal(entry.lunch),
      afternoon_snack_kcal:meal(entry.snack2),
      dinner_kcal:meal(entry.dinner),
      total_kcal:usable>0?Number(day.calories||0):null,
      calorie_quality:usable>0?(day.quality||'partial'):'none',
      calorie_calculated_at:new Date().toISOString()
    };
  }

  async function saveDiaryEntry(patientId,userId,values,existingId=null){
    const pathwayId=window.nubemoPatientContext?.activePathway?.id;
    if(!pathwayId)throw new Error('Nessun percorso attivo.');

    const calories=calculateFromValues(values);
    const payload={
      pathway_id:pathwayId,
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
    return data;
  }

  window.nubemoPatientServices=Object.freeze({...base,saveDiaryEntry});
  window.nubemoPatientDiaryCaloriePersistence=Object.freeze({calculateFromValues});
})();
