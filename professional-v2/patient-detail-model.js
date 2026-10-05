import {getMeasurementsViewModel} from "./patient-measurements-model.js";

const dayMs=86400000;
const validDate=value=>value && !Number.isNaN(new Date(value).getTime());
const dayKey=date=>new Date(date).toISOString().slice(0,10);
const dateNumber=value=>new Date(value).getTime();
const sorted=(items,key)=>items.filter(item=>validDate(item[key])).sort((a,b)=>dateNumber(a[key])-dateNumber(b[key]));
const validNumber=value=>typeof value==="number" && Number.isFinite(value);

export function getWeightSeries(data){
  return sorted(data.measurements.filter(item=>validNumber(item.weight)),"date")
    .map(item=>({date:item.date,value:item.weight}));
}

export function getLatestComposition(data){
  const measures=sorted(data.measurements,"date");
  const fields={weight:"kg",bodyFat:"%",muscleMass:"%",bcm:"%"};
  const values=Object.fromEntries(Object.entries(fields).map(([key,unit])=>{
    const valid=measures.filter(item=>validNumber(item[key]));
    const latest=valid.at(-1),previous=valid.at(-2);
    return [key,{value:latest?.[key]??null,unit,date:latest?.date??null,delta:previous?latest[key]-previous[key]:null}];
  }));
  return {values,lastBiaDate:measures.filter(item=>["bodyFat","muscleMass","bcm"].some(key=>validNumber(item[key]))).at(-1)?.date??null};
}

export function getDiaryAdherence(data,{days=7,now=new Date()}={}){
  days=Math.max(1,Math.floor(days));
  const today=dayKey(now);
  const start=new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate()-days+1);
  const from=dayKey(start);
  const completed=new Set(data.diary.days.filter(entry=>entry.valid && entry.date>=from && entry.date<=today).map(entry=>entry.date));
  return {completed:completed.size,considered:days,percentage:Math.round(completed.size/days*100)};
}

export function getPatientOverviewKPIs(data,{now=new Date(),diaryDays=7}={}){
  const weightSeries=getWeightSeries(data);
  const initialWeight=weightSeries[0]?.value??null,currentWeight=weightSeries.at(-1)?.value??null;
  const change=initialWeight!==null && currentWeight!==null?currentWeight-initialWeight:null;
  const completedVisits=data.visits.filter(item=>item.status==="completed");
  const upcoming=sorted(data.appointments.filter(item=>item.status==="scheduled" && dateNumber(item.startsAt)>now.getTime()),"startsAt")[0]??null;
  return {initialWeight,currentWeight,change,changePercent:change!==null && initialWeight!==0?change/initialWeight*100:null,
    adherence:getDiaryAdherence(data,{days:diaryDays,now}),completedVisits:completedVisits.length,nextAppointment:upcoming};
}

export function buildJourneyTimeline(data,{now=new Date(),limit=5}={}){
  const events=[];
  if(validDate(data.journey.startedAt)) events.push({type:"start",date:data.journey.startedAt,title:"Inizio percorso",description:"Percorso avviato",status:"completed"});
  sorted(data.visits.filter(item=>item.status==="completed"),"date").forEach(visit=>events.push({type:visit.type==="first"?"first-visit":"visit",date:visit.date,title:visit.title||"Visita completata",description:visit.description||"Visita registrata",status:"completed"}));
  data.journey.plans.filter(item=>validDate(item.sharedAt||item.createdAt)).forEach(plan=>events.push({type:"plan",date:plan.sharedAt||plan.createdAt,title:plan.title||"Piano creato",description:plan.sharedAt?"Condiviso con il paziente":"Piano preparato",status:"completed"}));
  const next=getPatientOverviewKPIs(data,{now}).nextAppointment;
  if(next) events.push({type:"appointment",date:next.startsAt,title:next.title||"Prossimo appuntamento",description:"In programma",status:"upcoming"});
  const completed=events.filter(event=>event.status==="completed").sort((a,b)=>dateNumber(a.date)-dateNumber(b.date));
  const first=completed[0];
  const recent=completed.slice(-(limit-(next?1:0)));
  if(first && !recent.includes(first) && recent.length) recent[0]=first;
  return [...recent.sort((a,b)=>dateNumber(a.date)-dateNumber(b.date)),...(next?[events.at(-1)]:[])];
}

export function getWeeklyFocus(data,{now=new Date(),diaryDays=7}={}){
  const items=[];
  const adherence=getDiaryAdherence(data,{days:diaryDays,now});
  const diaryDates=sorted(data.diary.days.filter(day=>day.valid),"date");
  const lastDiary=diaryDates.at(-1);
  const gap=lastDiary?Math.floor((new Date(`${dayKey(now)}T00:00:00Z`)-new Date(`${lastDiary.date}T00:00:00Z`))/dayMs):null;
  if(gap!==null && gap>=4) items.push({type:"diary",severity:"warning",title:`Nessun diario da ${gap} giorni`,description:"Controlla la continuità delle compilazioni.",targetRoute:"diario"});
  else if(adherence.completed>0) items.push({type:"diary",severity:adherence.percentage>=70?"success":"info",title:`Diario compilato ${adherence.completed} giorni su ${adherence.considered}`,description:"Andamento delle compilazioni recenti.",targetRoute:"diario"});
  const unread=data.documents.filter(doc=>doc.unread);
  if(unread.length) items.push({type:"document",severity:"warning",title:unread.length===1?"Nuovo referto da leggere":`${unread.length} documenti da leggere`,description:unread[0].title,targetRoute:"documenti"});
  const next=getPatientOverviewKPIs(data,{now}).nextAppointment;
  const daysUntil=next?Math.ceil((dateNumber(next.startsAt)-now.getTime())/dayMs):null;
  const bia=getLatestComposition(data).lastBiaDate;
  const biaAge=bia?Math.floor((now.getTime()-dateNumber(bia))/dayMs):null;
  if(next && daysUntil<=7) items.push({type:"appointment",severity:"info",title:"Controllo nei prossimi giorni",description:"Prepara la visita e verifica le misure disponibili.",targetRoute:"visite"});
  else if(biaAge!==null && biaAge>=14) items.push({type:"measure",severity:"info",title:`BIA non aggiornata da ${biaAge} giorni`,description:"Valuta una rilevazione al prossimo controllo.",targetRoute:"misure"});
  return items.slice(0,3);
}

export function getRecentActivity(data,{limit=4}={}){
  const documents=data.documents.map(({id,date,type,title,description,origin})=>({id,date,type,title,description,origin}));
  const visits=data.visits.filter(visit=>visit.status==="completed").map(visit=>({id:visit.id,date:visit.date,type:"visit",title:`${visit.title||"Visita"} aggiornata`,description:visit.description,origin:"Professionista"}));
  return [...documents,...visits,...data.activities,...data.diary.updates]
    .filter(item=>validDate(item.date)).sort((a,b)=>dateNumber(b.date)-dateNumber(a.date)).slice(0,limit);
}

export function getPatientViewModel(data,options={}){
  const kpis=getPatientOverviewKPIs(data,options);
  const visits=sorted(data.visits.filter(item=>item.status==="completed"),"date");
  const birth=data.identity.birthDate;
  const now=options.now||new Date();
  const birthday=birth?.slice(5,10);
  const today=`${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const age=validDate(birth)?now.getFullYear()-Number(birth.slice(0,4))-(today<birthday?1:0):data.identity.age;
  const journeyDays=validDate(data.journey.startedAt)?Math.max(1,Math.floor((now.getTime()-dateNumber(data.journey.startedAt))/dayMs)+1):null;
  return {data,age,journeyDays,firstVisit:visits.find(visit=>visit.type==="first")??null,
    lastControl:visits.filter(visit=>visit.type==="control").at(-1)??null,
    kpis,weightSeries:getWeightSeries(data),composition:getLatestComposition(data),measurements:getMeasurementsViewModel(data),timeline:buildJourneyTimeline(data,options),focus:getWeeklyFocus(data,options),activity:getRecentActivity(data)};
}
