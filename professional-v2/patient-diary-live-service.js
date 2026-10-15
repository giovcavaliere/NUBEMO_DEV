const client=()=>window.nubemoSupabase;
const mealFields=[
 ["breakfast","breakfast_kcal","breakfast"],
 ["morning_snack","morning_snack_kcal","snack1"],
 ["lunch","lunch_kcal","lunch"],
 ["afternoon_snack","afternoon_snack_kcal","snack2"],
 ["dinner","dinner_kcal","dinner"]
];
const numberOrNull=value=>value===null||value===""||value===undefined?null:(Number.isFinite(Number(value))?Number(value):null);
export async function loadLivePatientDiary(patientId,pathways){
 const ids=pathways.map(p=>p.id);
 if(!ids.length)return [];
 const columns=["id","patient_id","pathway_id","entry_date","total_kcal","calorie_quality",...mealFields.flatMap(([text,kcal])=>[text,kcal])].join(",");
 const {data,error}=await client().from("diary_entries").select(columns).eq("patient_id",patientId).in("pathway_id",ids).is("deleted_at",null).order("entry_date",{ascending:false}).limit(365);
 if(error)throw Error("Impossibile leggere il diario: "+error.message);
 return (data||[]).map(entry=>{
  const meals=mealFields.map(([textKey,kcalKey,key])=>({
   key,originalText:String(entry[textKey]||"").trim(),kcal:numberOrNull(entry[kcalKey]),components:[],confidence:"none"
  })).filter(meal=>meal.originalText||meal.kcal!==null);
  return {date:entry.entry_date,pathwayId:entry.pathway_id,kcal:numberOrNull(entry.total_kcal),confidence:"none",meals,valid:meals.some(meal=>meal.originalText)};
 });
}
