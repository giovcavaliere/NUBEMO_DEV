// Shared Professional 2.0 weight snapshots from authorized measurements and diary entries.
const valid=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))&&Number(v)>0;
const format=v=>Number(v).toLocaleString("it-IT",{maximumFractionDigits:1,minimumFractionDigits:1});
export async function loadPatientWeightSnapshots(client,patientIds){
 const result=new Map();
 if(!patientIds?.length)return result;
 for(let start=0;start<patientIds.length;start+=100){
  const ids=patientIds.slice(start,start+100);
  const [measurements,diary]=await Promise.all([
   client.from("patient_measurements").select("id,patient_id,pathway_id,measured_at,measured_time,weight_kg").in("patient_id",ids).is("deleted_at",null).not("weight_kg","is",null),
   client.from("diary_entries").select("id,patient_id,pathway_id,entry_date,weight_kg").in("patient_id",ids).is("deleted_at",null).not("weight_kg","is",null)
  ]);
  if(measurements.error)throw Error("Impossibile leggere i pesi delle misurazioni: "+measurements.error.message);
  if(diary.error)throw Error("Impossibile leggere i pesi del diario: "+diary.error.message);
  const grouped=new Map();
  for(const item of measurements.data||[]){
   if(!valid(item.weight_kg))continue;
   const list=grouped.get(item.patient_id)||[];
   list.push({id:item.id,source:"measurement",pathwayId:item.pathway_id,date:item.measured_at,time:String(item.measured_time||"").slice(0,8),weight:Number(item.weight_kg)});
   grouped.set(item.patient_id,list);
  }
  for(const item of diary.data||[]){
   if(!valid(item.weight_kg))continue;
   const list=grouped.get(item.patient_id)||[];
   list.push({id:item.id,source:"diary",pathwayId:item.pathway_id,date:item.entry_date,time:"",weight:Number(item.weight_kg)});
   grouped.set(item.patient_id,list);
  }
  for(const id of ids){
   // Within the same date prefer the clinical measurement over the diary.
   const entries=(grouped.get(id)||[]).sort((a,b)=>a.date.localeCompare(b.date)||
    ((a.source==="measurement"?1:0)-(b.source==="measurement"?1:0))||
    a.time.localeCompare(b.time));
   const byDate=new Map(entries.map(item=>[item.date,item]));
   const series=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
   const first=series[0]||null,last=series.at(-1)||null;
   result.set(id,{first,last,series,change:first&&last&&first!==last?last.weight-first.weight:null,
    changePercent:first&&last&&first!==last?(last.weight-first.weight)/first.weight*100:null,
    label:last?format(last.weight)+" kg":null,
    delta:first&&last&&first!==last?(last.weight-first.weight>0?"+":"")+format(last.weight-first.weight)+" kg":null});
  }
 }
 return result;
}
