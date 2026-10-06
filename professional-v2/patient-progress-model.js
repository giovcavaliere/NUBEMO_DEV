import {sortMeasurements,calculateBMI,buildMeasurementSeries,buildMeasurementChart,getMeasurementDelta,formatMeasurementDelta} from "./patient-measurements-model.js";

const finite=value=>typeof value==="number"&&Number.isFinite(value);
const number=new Intl.NumberFormat("it-IT",{minimumFractionDigits:1,maximumFractionDigits:1});
const text=(value,unit="")=>finite(value)?`${number.format(value)}${unit?` ${unit}`:""}`:"—";
const dateText=date=>new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`));
const definitions=[
  {key:"weight",label:"Peso",unit:"kg",color:"#296a56"},
  {key:"bodyFat",label:"FM",unit:"%",color:"#df984c"},
  {key:"muscleMass",label:"MM",unit:"%",color:"#8582c5"},
  {key:"bcm",label:"BCM",unit:"%",color:"#418b70"},
  ...[["waist","Vita"],["hips","Fianchi"],["arm","Braccio"],["thigh","Coscia"]].map(([key,label])=>({key,label,unit:"cm",color:"#296a56"}))
];
export const progressPeriods=[{key:"1",label:"1 mese"},{key:"3",label:"3 mesi"},{key:"6",label:"6 mesi"},{key:"all",label:"Tutto"}];
export const circumferenceOptions=definitions.filter(item=>item.unit==="cm");

function metric(records,key,unit){
  const valid=records.filter(item=>finite(item[key])&&(unit==="%"?item[key]>=0:item[key]>0));
  const first=valid[0],last=valid.at(-1);
  return {first,last,current:last?.[key]??null,delta:valid.length>1?getMeasurementDelta(last,first,key):null,unit,count:valid.length};
}

export function filterProgressMeasurements(records,period){
  if(period==="all"||!records.length) return records;
  // Calendar months ending at the last recorded date, including both boundary days.
  const last=new Date(`${records.at(-1).date}T00:00:00Z`),month=last.getUTCMonth()-Number(period);
  const endOfMonth=new Date(Date.UTC(last.getUTCFullYear(),month+1,0)).getUTCDate();
  const from=new Date(Date.UTC(last.getUTCFullYear(),month,Math.min(last.getUTCDate(),endOfMonth))).toISOString().slice(0,10);
  return records.filter(item=>item.date>=from);
}

export function buildProgressComparison(records,firstId,lastId){
  const first=records.find(item=>item.id===firstId)||records[0],last=records.find(item=>item.id===lastId)||records.at(-1);
  const same=first?.id===last?.id;
  const value=(item,key)=>key==="bmi"?calculateBMI(item?.weight,item?.height):finite(item?.[key])&&(key==="bodyFat"||key==="muscleMass"?item[key]>=0:item[key]>0)?item[key]:null;
  return {firstId:first?.id||"",lastId:last?.id||"",firstLabel:first?dateText(first.date):"Prima rilevazione",lastLabel:last?dateText(last.date):"Seconda rilevazione",
    rows:[["weight","Peso","kg","kg","chart"],["bmi","BMI","","","chart"],["waist","Vita","cm","cm","leaf"],["bodyFat","FM (massa grassa)","%","pp","profile"],["muscleMass","MM (massa muscolare)","%","pp","patients"]].map(([key,label,unit,deltaUnit,icon])=>{
      const a=value(first,key),b=value(last,key),delta=same?null:getMeasurementDelta({value:b},{value:a},"value");
      return {key,label,icon,first:text(a,unit),last:text(b,unit),delta:formatMeasurementDelta(delta,deltaUnit).trim(),firstLabel:first?`${dateText(first.date)}${first.time?` · ${first.time}`:""}`:"Prima rilevazione",lastLabel:last?`${dateText(last.date)}${last.time?` · ${last.time}`:""}`:"Seconda rilevazione"};
    })};
}

function observations(weight,waist,fm,mm){
  const items=[];
  if(weight.delta!==null) items.push({icon:"chart",title:weight.delta<0?"Peso in diminuzione":weight.delta>0?"Peso in aumento":"Peso invariato",text:`Il peso ${weight.delta===0?"risulta invariato":`è variato di ${formatMeasurementDelta(weight.delta,"kg")}`} rispetto alla prima rilevazione (${dateText(weight.first.date)}). Ultimo valore: ${text(weight.current,"kg")}.`});
  if(waist.delta!==null) items.push({icon:"leaf",title:waist.delta<0?"Riduzione della circonferenza vita":waist.delta>0?"Aumento della circonferenza vita":"Circonferenza vita invariata",text:`La circonferenza vita è passata da ${text(waist.first.waist,"cm")} a ${text(waist.current,"cm")} (${formatMeasurementDelta(waist.delta,"cm")}), tra il ${dateText(waist.first.date)} e il ${dateText(waist.last.date)}.`});
  const changes=[{label:"FM",metric:fm},{label:"MM",metric:mm}].filter(item=>item.metric.delta!==null);
  if(changes.length) items.push({icon:"patients",title:"Evoluzione della composizione corporea",text:changes.map(({label,metric:item})=>`${label}: ${formatMeasurementDelta(item.delta,"pp")} tra il ${dateText(item.first.date)} e il ${dateText(item.last.date)}.`).join(" ")});
  return items;
}

export function getProgressViewModel(data,{period="3",circumference="waist",firstId,lastId}={}){
  period=progressPeriods.some(item=>item.key===period)?period:"3";
  circumference=circumferenceOptions.some(item=>item.key===circumference)?circumference:"waist";
  const records=sortMeasurements(data.measurements),filtered=filterProgressMeasurements(records,period);
  const series=buildMeasurementSeries(filtered,definitions,{breakOnMissing:true});
  const weight=metric(records,"weight","kg"),waist=metric(records,"waist","cm"),fm=metric(records,"bodyFat","%"),mm=metric(records,"muscleMass","%");
  const bmi=metric(records.map(item=>({...item,bmi:calculateBMI(item.weight,item.height)})),"bmi","");
  const goal=data.profile?.anamnesis?.goalWeight;
  const goalWeight=goal!==""&&goal!=null&&Number.isFinite(Number(goal))&&Number(goal)>0?Number(goal):null;
  const circumferenceSeries=series.filter(item=>item.key===circumference);
  const charts={weight:buildMeasurementChart(series.filter(item=>item.key==="weight"),{axisUnit:"kg",referenceValue:goalWeight}),bia:buildMeasurementChart(series.filter(item=>["bodyFat","muscleMass","bcm"].includes(item.key)),{axisUnit:"%",compactPercent:true}),circumference:circumferenceSeries[0].points.length>1?buildMeasurementChart(circumferenceSeries,{axisUnit:"cm"}):null};
  return {period,circumference,charts,periodNote:records.length?`Periodo fino al ${dateText(records.at(-1).date)}`:"Nessuna rilevazione disponibile",circumferenceLabel:circumferenceOptions.find(item=>item.key===circumference).label,
    summary:[
      ...[["Peso attuale",weight,"chart","kg"],["BMI attuale",bmi,"chart",""],["Vita",waist,"leaf","cm"]].map(([label,item,icon,unit])=>({label,icon,value:text(item.current,unit),delta:formatMeasurementDelta(item.delta,unit).trim(),note:item.last?item.count>1?`Dal ${dateText(item.first.date)} · ultimo ${dateText(item.last.date)}`:`Una rilevazione · ${dateText(item.last.date)}`:"Dato non ancora rilevato"})),
      {label:"Sintesi BIA",icon:"profile",value:`FM ${formatMeasurementDelta(fm.delta,"pp")} · MM ${formatMeasurementDelta(mm.delta,"pp")}`,parts:[{label:"FM",text:fm.delta===null?"—":formatMeasurementDelta(fm.delta,"pp")},{label:"MM",text:mm.delta===null?"—":formatMeasurementDelta(mm.delta,"pp")}],note:fm.delta===null&&mm.delta===null?"Nessun confronto BIA disponibile":"Dalla prima rilevazione valida di ogni serie",bia:true}
    ],
    readings:records.map(item=>({id:item.id,label:`${dateText(item.date)}${item.time?` · ${item.time}`:""}`})),comparison:buildProgressComparison(records,firstId,lastId),observations:observations(weight,waist,fm,mm),biaLegend:series.filter(item=>["bodyFat","muscleMass","bcm"].includes(item.key)).map(item=>({...item,available:item.points.length>0}))};
}
