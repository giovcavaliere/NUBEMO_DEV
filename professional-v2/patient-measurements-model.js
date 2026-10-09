// Measurements are independent snapshots. Missing values are never carried into a snapshot.
const numeric=value=>typeof value==="number" && Number.isFinite(value);
const nonnegative=value=>numeric(value) && value>=0;
const positive=value=>numeric(value) && value>0;
export const measurementFields=["weight","height","waist","hips","arm","thigh","bodyFat","muscleMass","ecm","bcm"];
const biaFields=["bodyFat","muscleMass","ecm","bcm","ffm"];
const numberFormatter=new Intl.NumberFormat("it-IT",{minimumFractionDigits:1,maximumFractionDigits:1});
const numberText=value=>numeric(value)?numberFormatter.format(value):"—";
const valueText=(value,unit="")=>numeric(value)?`${numberText(value)}${unit?` ${unit}`:""}`:"—";
const dateText=date=>new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${date}T12:00:00`));

export function isMeasurementDate(date){
  return typeof date==="string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date;
}

export function sortMeasurements(measurements=[]){
  return measurements.filter(item=>isMeasurementDate(item.date)).slice().sort((a,b)=>`${a.date}T${a.time||"00:00"}`.localeCompare(`${b.date}T${b.time||"00:00"}`));
}

export function getLatestMeasurement(measurements){return sortMeasurements(measurements).at(-1)??null}
export function getPreviousMeasurement(measurements){return sortMeasurements(measurements).at(-2)??null}

export function calculateBMI(weight,height){
  return positive(weight) && positive(height)?weight/(height/100)**2:null;
}

export function calculateFFM(measurement){
  if(!measurement) return null;
  if(nonnegative(measurement.bcm) && nonnegative(measurement.ecm)) return measurement.bcm+measurement.ecm;
  return nonnegative(measurement.ffm)?measurement.ffm:null;
}

export function getMeasurementDelta(current,previous,key){
  const a=current?.[key],b=previous?.[key];
  return numeric(a) && numeric(b)?a-b:null;
}

export function formatMeasurementDelta(delta,unit){
  if(!numeric(delta)) return "Nessun confronto";
  const rounded=Math.round(delta*10)/10;
  return `${rounded>0?"+":""}${numberText(Object.is(rounded,-0)?0:rounded)} ${unit}`;
}

export function buildMeasurementSeries(measurements,definitions=null,{breakOnMissing=false}={}){
  const sorted=sortMeasurements(measurements);
  return (definitions||[
    {key:"weight",label:"Peso",unit:"kg",color:"#296a56"},
    {key:"bodyFat",label:"FM",unit:"%",color:"#df984c"},
    {key:"muscleMass",label:"MM",unit:"%",color:"#8582c5"}
  ]).map(definition=>{
    const valid=item=>definition.unit==="%"?nonnegative(item[definition.key]):positive(item[definition.key]);
    return {...definition,points:sorted.flatMap((item,index)=>valid(item)?[{date:item.date,time:item.time||"",value:item[definition.key],timestamp:Date.parse(`${item.date}T${item.time||"00:00"}:00Z`),...(breakOnMissing?{breakBefore:index>0&&!valid(sorted[index-1])}:{})}]:[])};
  });
}

// Geometry is part of the view-model: the renderer only prints prepared coordinates.
export function buildMeasurementChart(series,{axisUnit=null,compactPercent=false,referenceValue=null}={}){
  const available=series.filter(item=>item.points.length);
  if(!available.length) return null;
  const points=available.flatMap(item=>item.points);
  const start=Math.min(...points.map(p=>p.timestamp)),end=Math.max(...points.map(p=>p.timestamp));
  const left=46,right=454,top=34,bottom=225;
  const weight=axisUnit&&axisUnit!=="%"?available.filter(item=>item.unit===axisUnit).flatMap(item=>item.points):available.find(item=>item.key==="weight")?.points||[];
  const weightValues=[...weight.map(p=>p.value),...(positive(referenceValue)?[referenceValue]:[])],lo=Math.min(...weightValues),hi=Math.max(...weightValues);
  const pad=Math.max(2,(hi-lo)*.2);
  let weightMin=weight.length?Math.max(0,Math.floor(lo-pad)):0,weightMax=weight.length?Math.ceil(hi+pad):100;
  if(axisUnit&&axisUnit!=="%"&&weight.length){
    const roughStep=(weightMax-weightMin)/4,power=10**Math.floor(Math.log10(roughStep));
    const step=[1,2,2.5,5,10].find(item=>item*power>=roughStep)*power;
    weightMin=Math.max(0,Math.floor(weightMin/step)*step);
    weightMax=weightMin+Math.ceil((weightMax-weightMin)/step)*step;
  }
  const pctValues=available.filter(item=>item.unit==="%").flatMap(item=>item.points.map(p=>p.value));
  const pctMax=compactPercent?Math.max(10,Math.ceil(Math.max(0,...pctValues)/10)*10+10):Math.max(100,...pctValues);
  const x=timestamp=>start===end?(left+right)/2:left+(timestamp-start)/(end-start)*(right-left);
  const y=(value,unit)=>bottom-(value-(unit!=="%"?weightMin:0))/(unit!=="%"?weightMax-weightMin:pctMax)*(bottom-top);
  const dates=[...new Set(points.map(p=>p.timestamp))].sort((a,b)=>a-b);
  const labelIndexes=[...new Set([0,Math.round((dates.length-1)/3),Math.round((dates.length-1)*2/3),dates.length-1])];
  const labelFormatter=new Intl.DateTimeFormat("it-IT",{day:"numeric",month:"short",timeZone:"UTC"});
  return {hasWeight:weight.length>0,hasPercent:pctValues.length>0,axisUnit,reference:positive(referenceValue)&&weight.length?{y:y(referenceValue,axisUnit||"kg"),text:`Obiettivo ${valueText(referenceValue,"kg")}`} :null,
    ticks:Array.from({length:5},(_,i)=>({y:bottom-i*(bottom-top)/4,weight:numberText(weightMin+(weightMax-weightMin)*i/4),percent:numberText(pctMax*i/4)})),
    labels:labelIndexes.map((index,i)=>({x:x(dates[index]),label:labelFormatter.format(new Date(dates[index])),edge:i===0?"start":i===labelIndexes.length-1?"end":"middle",interior:i>0&&i<labelIndexes.length-1})),
    series:available.map(item=>{
      const plotted=item.points.map(p=>({...p,x:x(p.timestamp),y:y(p.value,item.unit),title:`${dateText(p.date)}${p.time?` · ${p.time}`:""}: ${valueText(p.value,item.unit)}`}));
      const groups=[];
      plotted.forEach((point,index)=>{if(index===0||point.breakBefore) groups.push([]);groups.at(-1).push(point)});
      const area=item.unit!=="%"?groups.filter(group=>group.length>1).map(group=>`${group.map((point,index)=>`${index?"L":"M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ")} L${group.at(-1).x} ${bottom} L${group[0].x} ${bottom} Z`).join(" "):null;
      return {...item,area,path:plotted.map((p,i)=>`${i&&!p.breakBefore?"L":"M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" "),dots:plotted.filter((point,i)=>Object.hasOwn(point,"breakBefore")||plotted.length<=30||i===0||i===plotted.length-1),latestText:valueText(item.points.at(-1).value,item.unit),summary:`${item.label}: ${item.points.length} rilevazioni, da ${valueText(item.points[0].value,item.unit)} a ${valueText(item.points.at(-1).value,item.unit)}`};
    })};
}

function measurementType(measurement){
  if(!measurement) return "Nessuna misurazione";
  const bia=biaFields.some(key=>nonnegative(measurement[key]));
  if(bia) return ["bodyFat","ecm","bcm"].every(key=>nonnegative(measurement[key]))?"BIA completa":"BIA parziale";
  if(["waist","hips","arm","thigh"].some(key=>positive(measurement[key]))) return "Antropometria";
  return positive(measurement.weight)?"Peso rilevato":"Rilevazione parziale";
}

function measurementRow(measurement){
  const bmi=calculateBMI(measurement.weight,measurement.height),ffm=calculateFFM(measurement);
  return {id:measurement.id,date:measurement.date,dateText:dateText(measurement.date),timeText:measurement.time||"—",type:measurementType(measurement),
    values:[
      ["Peso",positive(measurement.weight)?measurement.weight:null,"kg","weight"],["BMI",bmi,"","bmi"],
      ["FM%",nonnegative(measurement.bodyFat)?measurement.bodyFat:null,"%","fm"],["MM%",nonnegative(measurement.muscleMass)?measurement.muscleMass:null,"%","mm"],
      ["FFM%",ffm,"%","ffm"],["ECM%",nonnegative(measurement.ecm)?measurement.ecm:null,"%","ecm"],["BCM%",nonnegative(measurement.bcm)?measurement.bcm:null,"%","bcm"]
    ].map(([label,value,unit,key])=>({label,key,text:valueText(value,unit)})),
    details:[["Altezza",measurement.height],["Circonferenza vita",measurement.waist],["Circonferenza fianchi",measurement.hips],["Circonferenza braccio",measurement.arm],["Circonferenza coscia",measurement.thigh]].map(([label,value])=>({label,text:valueText(positive(value)?value:null,"cm")})),
    notes:measurement.notes||"Nessuna nota",ffmNote:nonnegative(measurement.ffm)&&nonnegative(measurement.bcm)&&nonnegative(measurement.ecm)&&Math.abs(measurement.ffm-ffm)>.1?`FFM registrata: ${valueText(measurement.ffm,"%")} · calcolata: ${valueText(ffm,"%")}. Il valore registrato è conservato.`:""};
}

export function buildComposition(measurement){
  if(!measurement) return null;
  const definitions=[["bodyFat","FM","Massa grassa","fm"],["ecm","ECM","Massa extracellulare","ecm"],["bcm","BCM","Massa cellulare","bcm"]];
  const complete=definitions.every(([key])=>nonnegative(measurement[key]));
  const total=definitions.reduce((sum,[key])=>sum+(nonnegative(measurement[key])?measurement[key]:0),0);
  // Partial snapshots keep an unmeasured region. Complete silhouettes reflect actual ratios,
  // including sums over 100; absolute values remain unchanged in the reference bars.
  const denominator=complete&&total>0?total:Math.max(100,total);
  let bodyY=300;
  const components=definitions.map(([key,label,description,tone])=>({key,label,description,tone,value:nonnegative(measurement[key])?measurement[key]:null,text:valueText(nonnegative(measurement[key])?measurement[key]:null,"%"),barHeight:nonnegative(measurement[key])?measurement[key]:0}));
  const bands=[...components].reverse().map(component=>{const height=(component.value??0)/denominator*280;bodyY-=height;return {tone:component.tone,y:bodyY,height}});
  const row=measurementRow(measurement);
  const ffm=calculateFFM(measurement);
  // Absolute stacked geometry: 100% always occupies the reference frame. Excess continues
  // above it, in a reserved area, without clipping or rescaling any segment.
  const stacks=[
    {label:"FFM / FM",segments:[{label:"FFM",tone:"ffm",value:ffm,text:valueText(ffm,"%"),description:"Massa magra"},components[0]]},
    {label:"BCM / ECM",segments:[components[2],components[1]]}
  ].map(stack=>{
    let offset=0;
    const segments=stack.segments.map(segment=>{const bottom=offset;offset+=segment.value??0;return {...segment,bottom,height:segment.value??0,showLabel:segment.value>=15}});
    return {...stack,segments,total:offset,totalText:valueText(offset,"%")};
  });
  const stackExcess=Math.max(0,...stacks.map(stack=>stack.total-100));
  return {dateText:row.dateText,type:row.type,components,bands,stacks,stackExcess,ffmText:valueText(ffm,"%"),ffmLabel:nonnegative(measurement.bcm)&&nonnegative(measurement.ecm)?"FFM (BCM + ECM)":"FFM registrata",ffmNote:row.ffmNote,hasSegments:components.some(component=>component.value!==null),
    note:complete?total>100?`Totale FM + ECM + BCM: ${valueText(total,"%")} · figura proporzionale ai valori rilevati.`:"Figura proporzionale ai valori rilevati.":"BIA parziale · la zona neutra indica la parte non rilevata. Nessun valore assente è stimato."};
}

export function getMeasurementsViewModel(data){
  const measurements=sortMeasurements(data.measurements);
  const latest=getLatestMeasurement(measurements),previous=getPreviousMeasurement(measurements);
  const bia=measurements.filter(item=>biaFields.some(key=>nonnegative(item[key]))).at(-1);
  const latestRow=latest?measurementRow(latest):null;
  const series=buildMeasurementSeries(measurements);
  const height=measurements.filter(item=>positive(item.height)).at(-1);
  return {latest,previous,series,chart:buildMeasurementChart(series),composition:buildComposition(bia),rows:[...measurements].reverse().map(measurementRow),
    lastHeight:height?{value:height.height,dateText:dateText(height.date)}:null,
    summary:[
      {label:"Peso attuale",text:latestRow?.values[0].text||"—",note:formatMeasurementDelta(getMeasurementDelta(latest,previous,"weight"),"kg")},
      {label:"BMI attuale",text:latestRow?.values[1].text||"—",note:latestRow?.values[1].text!=="—"&&latestRow?"Peso / altezza²":"Peso e altezza necessari"},
      {label:"Ultima misura",text:latestRow?.dateText||"—",note:latest?.time||"Ora non indicata"},
      {label:"Tipo di rilevazione",text:measurementType(latest),note:bia?`Ultima BIA ${dateText(bia.date)}`:"BIA non ancora disponibile"}
    ],
    deltas:[{key:"weight",label:"Peso",unit:"kg"},{key:"bodyFat",label:"FM",unit:"pp"},{key:"muscleMass",label:"MM",unit:"pp"},{key:"bcm",label:"BCM",unit:"pp"}].map(item=>({...item,text:formatMeasurementDelta(getMeasurementDelta(latest,previous,item.key),item.unit)}))};
}

export function measurementFromForm(values,existing=null){
  const result={...(existing||{}),id:existing?.id||`measurement-${crypto.randomUUID()}`,date:String(values.get("date")||""),time:String(values.get("time")||""),notes:String(values.get("notes")||"").trim()};
  measurementFields.forEach(key=>{const value=values.get(key);result[key]=value===null||String(value).trim()===""?null:Number(value)});
  return result;
}

export function getMeasurementFormPreview(values,existing=null){
  const measurement={...existing};
  measurementFields.forEach(key=>{const value=values.get(key);measurement[key]=value===null||String(value).trim()===""?null:Number(value)});
  return {bmiText:valueText(calculateBMI(measurement.weight,measurement.height)),ffmText:valueText(calculateFFM({bcm:measurement.bcm,ecm:measurement.ecm}),"%")};
}
