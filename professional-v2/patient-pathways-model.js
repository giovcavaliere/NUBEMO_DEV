import {calculateBMI,sortMeasurements,getMeasurementsViewModel} from "./patient-measurements-model.js";
import {getDiaryViewModel} from "./patient-diary-model.js";

const finite=value=>typeof value==="number"&&Number.isFinite(value);
export const pathwayNumber=value=>finite(value)?new Intl.NumberFormat("it-IT",{maximumFractionDigits:1}).format(value):"—";
export function pathwayDuration(start,end){
  if(!start||!end) return null;
  const from=Date.parse(`${String(start).slice(0,10)}T12:00:00Z`);
  const to=Date.parse(`${String(end).slice(0,10)}T12:00:00Z`);
  return Number.isFinite(from)&&Number.isFinite(to)&&to>=from?Math.round((to-from)/86400000)+1:null;
}

// Freeze only records belonging to this interval (or explicitly linked to this pathway).
// Undated/unlinked records cannot safely be attributed to a historical pathway.
export function capturePathwaySnapshot(data,pathway){
  const scoped=(items,dateKey)=>Array.isArray(items)?items.filter(item=>{
    if(item.pathwayId!=null) return item.pathwayId===pathway.id;
    const date=String(item[dateKey]||"").slice(0,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date)&&!!pathway.startedAt&&date>=pathway.startedAt&&date<=pathway.endedAt;
  }):[];
  return structuredClone({
    anamnesis:data.profile?.anamnesis??null,
    visits:scoped(data.visits,"date").filter(item=>item.status==="completed"),
    measurements:scoped(data.measurements,"date"),
    diary:scoped(data.diary?.days,"date"),
    documents:scoped(data.documents,"date"),
    plans:scoped(data.nutritionPlans,"validFrom"),
    reports:scoped(data.laboratoryReports,"reportDate"),
    notes:scoped(data.notes,"createdAt")
  });
}

export function getPathwayHistoryModel(pathway){
  // Never fall back to the live patient record: historical archives stand alone.
  const snapshot=pathway.snapshot||{};
  const saved=pathway.snapshotSummary||{};
  const collection=key=>Array.isArray(snapshot[key])?snapshot[key]:null;
  const measurements=collection("measurements");
  const weights=sortMeasurements(measurements||[]).filter(item=>finite(item.weight)&&item.weight>0);
  const first=weights[0],last=weights.at(-1);
  const initialWeight=measurements?first?.weight:saved.initialWeight;
  const finalWeight=measurements?last?.weight:saved.finalWeight;
  const initialBmi=measurements?calculateBMI(first?.weight,first?.height):saved.initialBmi;
  const finalBmi=measurements?calculateBMI(last?.weight,last?.height):saved.finalBmi;
  const delta=finite(initialWeight)&&finite(finalWeight)?finalWeight-initialWeight:null;
  const count=(key,legacyKey=key)=>collection(key)?.length??(finite(saved[legacyKey])?saved[legacyKey]:null);
  const duration=pathwayDuration(pathway.startedAt,pathway.endedAt)??saved.durationDays;
  const unit=(value,suffix)=>finite(value)?`${pathwayNumber(value)} ${suffix}`:"—";
  return {
    snapshot,
    summary:[
      ["Stato","Concluso"],["Durata",unit(duration,"giorni")],
      ["Peso iniziale",unit(initialWeight,"kg")],["Peso finale",unit(finalWeight,"kg")],
      ["Variazione peso",finite(delta)?`${delta>0?"+":""}${unit(delta,"kg")}`:"—"],
      ["BMI iniziale",pathwayNumber(initialBmi)],["BMI finale",pathwayNumber(finalBmi)],
      ["Giornate diario",pathwayNumber(count("diary","diaryDays"))],
      ["Misurazioni professionista",pathwayNumber(count("measurements"))],
      ["Documenti",pathwayNumber(count("documents"))],["Piani alimentari",pathwayNumber(count("plans"))],
      ["Referti",pathwayNumber(count("reports"))],["Visite",pathwayNumber(count("visits"))],
      ["Note",pathwayNumber(count("notes"))]
    ],
    sections:[
      {key:"anamnesis",label:"Anamnesi",items:snapshot.anamnesis==null?null:[snapshot.anamnesis],count:null},
      ...[["visits","Visite"],["measurements","Misure"],["diary","Diario"],["documents","Documenti"],["plans","Piani alimentari"],["reports","Referti"],["notes","Note"]].map(([key,label])=>({key,label,items:collection(key),count:count(key,key==="diary"?"diaryDays":key)}))
    ],
    measurementRows:getMeasurementsViewModel({measurements:measurements||[]}).rows,
    diaryDays:getDiaryViewModel({diary:{days:collection("diary")||[]}}).days
  };
}
