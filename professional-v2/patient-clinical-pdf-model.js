import {calculateFFM} from "./patient-measurements-model.js";

const finite=value=>value!==""&&value!==null&&value!==undefined&&Number.isFinite(Number(value));
const sortByDate=items=>[...(items||[])].filter(item=>item?.date||item?.reportDate).sort((a,b)=>String(a.date||a.reportDate).localeCompare(String(b.date||b.reportDate)));
const bmi=(weight,height)=>finite(weight)&&finite(height)&&Number(height)>0?Number(weight)/((Number(height)/100)**2):null;
const ageAt=(birth,now=new Date())=>{
  if(!birth) return null;
  const d=new Date(`${birth}T12:00:00`);
  if(Number.isNaN(d.getTime())) return null;
  let age=now.getFullYear()-d.getFullYear();
  if(now.getMonth()<d.getMonth()||(now.getMonth()===d.getMonth()&&now.getDate()<d.getDate())) age--;
  return age;
};
const objective=item=>item?.objectiveLabel||item?.customObjective||"Percorso nutrizionale";
const normalizedFFM=row=>calculateFFM({bcm:finite(row.bcm)?Number(row.bcm):null,ecm:finite(row.ecm)?Number(row.ecm):null,ffm:finite(row.ffm)?Number(row.ffm):null});
const bmiCategory=value=>value==null?null:value<18.5?"Sottopeso":value<25?"Normopeso":value<30?"Sovrappeso":value<35?"Obesità I":value<40?"Obesità II":"Obesità III";

function diarySelection(data,mode){
  if(mode==="none") return [];
  const days=sortByDate(data.diary?.days||[]);
  if(mode==="full") return days;
  const count=mode==="7"?7:30;
  const end=days.at(-1)?.date;
  if(!end) return [];
  const endDate=new Date(`${end}T12:00:00`);
  const start=new Date(endDate);
  start.setDate(start.getDate()-(count-1));
  return days.filter(day=>new Date(`${day.date}T12:00:00`)>=start);
}

export function buildClinicalPdfData(data,professional,options={}){
  const measurements=sortByDate(data.measurements||[]);
  const weightRows=measurements.filter(row=>finite(row.weight));
  const firstWeight=weightRows[0]?.weight??null;
  const currentWeight=weightRows.at(-1)?.weight??null;
  const activePathway=(data.pathways?.items||[]).find(item=>item.status==="active")||null;
  const pathways=[...(data.pathways?.items||[])].sort((a,b)=>String(a.startedAt||a.proposedAt||"").localeCompare(String(b.startedAt||b.proposedAt||"")));
  const labs=[...(data.laboratoryReports||[])].filter(row=>row?.reportDate).sort((a,b)=>String(a.reportDate).localeCompare(String(b.reportDate))).slice(-5);
  const latestBia=[...measurements].reverse().find(row=>["bodyFat","muscleMass","ffm","ecm","bcm"].some(key=>finite(row[key])))||null;
  const height=finite(data.identity.height)?Number(data.identity.height):null;
  const family=data.profile?.anamnesis?.family||{};
  const familyLabels=[
    ["obesity","Obesita"],["diabetes","Diabete"],["hypertension","Ipertensione"],
    ["cardiovascular","Patologie cardiovascolari"],["dyslipidemia","Dislipidemie"],["thyroid","Patologie tiroidee"]
  ].filter(([key])=>family[key]).map(([,label])=>label);

  return {
    generatedAt:new Date().toISOString(),
    patient:{
      id:data.identity.id,
      name:[data.identity.firstName,data.identity.lastName].filter(Boolean).join(" "),
      firstName:data.identity.firstName||"",
      lastName:data.identity.lastName||"",
      birthDate:data.identity.birthDate||"",
      age:ageAt(data.identity.birthDate),
      sex:data.identity.sex||"",
      height,
      phone:data.identity.phone||"",
      email:data.identity.email||""
    },
    professional:{
      displayName:professional?.displayName||[professional?.firstName,professional?.surname].filter(Boolean).join(" ")||"Professionista",
      qualification:professional?.qualification||"",
      taxCode:professional?.taxCode||"",
      vat:professional?.vat||"",
      phone:professional?.phone||"",
      email:professional?.email||"",
      address:[professional?.address,[professional?.zip,professional?.city].filter(Boolean).join(" "),professional?.province].filter(Boolean).join(" - ")
    },
    summary:{
      firstWeight:finite(firstWeight)?Number(firstWeight):null,
      currentWeight:finite(currentWeight)?Number(currentWeight):null,
      delta:finite(firstWeight)&&finite(currentWeight)?Number(currentWeight)-Number(firstWeight):null,
      initialBmi:bmi(firstWeight,height),
      currentBmi:bmi(currentWeight,height),
      currentBmiCategory:bmiCategory(bmi(currentWeight,height))
    },
    activePathway:activePathway?{
      status:"active",
      startedAt:activePathway.startedAt||"",
      objective:objective(activePathway),
      objectiveNote:activePathway.objectiveNote||""
    }:null,
    pathways:pathways.map(item=>({
      status:item.status||"",
      startedAt:item.startedAt||item.proposedAt||"",
      endedAt:item.endedAt||"",
      objective:objective(item)
    })),
    anamnesis:{...(data.profile?.anamnesis||{}),familyText:familyLabels.join(", ")},
    measurements:measurements.map(row=>({
      date:row.date||"",weight:finite(row.weight)?Number(row.weight):null,
      waist:finite(row.waist)?Number(row.waist):null,hips:finite(row.hips)?Number(row.hips):null,
      ffm:normalizedFFM(row),bodyFat:finite(row.bodyFat)?Number(row.bodyFat):null,
      muscleMass:finite(row.muscleMass)?Number(row.muscleMass):null,
      ecm:finite(row.ecm)?Number(row.ecm):null,bcm:finite(row.bcm)?Number(row.bcm):null,
      notes:row.notes||""
    })),
    labs:labs.map(row=>({date:row.reportDate,values:{...(row.values||{})},notes:row.notes||""})),
    latestBia:latestBia?{
      date:latestBia.date||"",
      ffm:normalizedFFM(latestBia),
      bodyFat:finite(latestBia.bodyFat)?Number(latestBia.bodyFat):null,
      muscleMass:finite(latestBia.muscleMass)?Number(latestBia.muscleMass):null,
      ecm:finite(latestBia.ecm)?Number(latestBia.ecm):null,
      bcm:finite(latestBia.bcm)?Number(latestBia.bcm):null
    }:null,
    diary:diarySelection(data,options.diaryMode||"none").map(day=>({
      date:day.date,
      weight:finite(day.weight)?Number(day.weight):null,
      water:day.water??null,
      meals:(day.meals||[]).map(meal=>({key:meal.key,time:meal.time||"",text:meal.originalText||""})),
      valid:day.valid!==false
    })),
    diaryMode:options.diaryMode||"none"
  };
}
