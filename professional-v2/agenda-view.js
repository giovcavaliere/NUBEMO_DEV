const WEEK_START="2026-10-05";
const PIXELS_PER_HALF_HOUR=35;
const PIXELS_PER_MINUTE=PIXELS_PER_HALF_HOUR/30;

const DEMO_EVENTS=[
  {date:"2026-10-05",start:"09:00",duration:30,type:"control",name:"Giovanni Cavaliere",meta:"Controllo · 30 min"},
  {date:"2026-10-05",start:"11:00",duration:60,type:"first",name:"Elisa Manco",meta:"Prima visita · 60 min"},
  {date:"2026-10-06",start:"10:00",duration:30,type:"personal",name:"Impegno personale",meta:"Fuori studio · 30 min"},
  {date:"2026-10-06",start:"15:00",duration:30,type:"control",name:"Marco Bianchi",meta:"Controllo · 30 min"},
  {date:"2026-10-07",start:"09:00",duration:60,type:"first",name:"Francesca Cavaliere",meta:"Prima visita · 60 min"},
  {date:"2026-10-07",start:"14:00",duration:30,type:"control",name:"Luca Ferrari",meta:"Controllo · 30 min"},
  {date:"2026-10-08",start:"12:00",duration:60,type:"personal",name:"Impegno personale",meta:"Pausa studio · 60 min"},
  {date:"2026-10-08",start:"16:00",duration:30,type:"control",name:"Sara Conti",meta:"Controllo · 30 min"},
  {date:"2026-10-09",start:"10:00",duration:30,type:"control",name:"Elisa Manco",meta:"Controllo · 30 min"},
  {date:"2026-10-10",start:"09:00",duration:60,type:"first",name:"Nuovo paziente",meta:"Prima visita · 60 min"}
];

export function addAgendaEvent(event){
  if(!event||!event.date||!event.start) return;
  DEMO_EVENTS.push({...event});
}

export const agendaState={
  mode:"week",
  weekStart:WEEK_START,
  dayDate:WEEK_START,
  periodStart:WEEK_START,
  periodEnd:"2026-10-10"
};

function parseIso(value){
  const match=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match) return null;
  const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),12,0,0,0);
  return Number.isNaN(date.getTime())?null:date;
}

function iso(date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

function addDays(date,amount){
  const next=new Date(date);
  next.setDate(next.getDate()+amount);
  return next;
}

function isWorkingDay(date,workDays){
  const day=date.getDay();
  if(day===0) return false;
  if(Number(workDays)===6) return day>=1&&day<=6;
  return day>=1&&day<=5;
}

function formatDay(date){
  return {
    date:iso(date),
    name:date.toLocaleDateString("it-IT",{weekday:"long"}),
    label:date.toLocaleDateString("it-IT",{day:"numeric",month:"short"})
  };
}

function workDaysBetween(startIso,endIso,workDays){
  const start=parseIso(startIso);
  const end=parseIso(endIso);
  if(!start||!end||start>end) return [];
  const result=[];
  for(let cursor=new Date(start);cursor<=end;cursor=addDays(cursor,1)){
    if(isWorkingDay(cursor,workDays)) result.push(formatDay(cursor));
  }
  return result;
}

function weekDays(profile,state){
  const start=parseIso(state.weekStart)||parseIso(WEEK_START);
  const length=Number(profile?.workDays)===6?6:5;
  return Array.from({length},(_,index)=>formatDay(addDays(start,index)));
}

function clampHour(value,fallback){
  const hour=Number.parseInt(String(value||"").split(":")[0],10);
  return Number.isFinite(hour)?hour:fallback;
}

function minutesFromMidnight(value){
  const [hour,minute]=String(value||"00:00").split(":").map(Number);
  return (Number.isFinite(hour)?hour:0)*60+(Number.isFinite(minute)?minute:0);
}

function eventMarkup(event,startMinutes){
  const eventStart=minutesFromMidnight(event.start);
  const top=(eventStart-startMinutes)*PIXELS_PER_MINUTE;
  const height=Math.max(30,Number(event.duration)||30)*PIXELS_PER_MINUTE;
  const short=Number(event.duration)<=30?" short":"";
  return `<button type="button" class="agenda-event ${event.type}${short}" tabindex="-1"
    style="--event-top:${top};--event-height:${height}">
    <strong>${event.name}</strong>
    <span>${event.meta}</span>
  </button>`;
}

function daysForMode(profile,state){
  if(state.mode==="day"){
    const day=parseIso(state.dayDate)||parseIso(WEEK_START);
    return [formatDay(day)];
  }
  if(state.mode==="period"){
    return workDaysBetween(state.periodStart,state.periodEnd,profile?.workDays);
  }
  return weekDays(profile,state);
}

function periodLabel(days,state){
  if(state.mode==="day"){
    const day=days[0];
    return {
      main:day?day.name+" · "+day.label:"Nessun giorno",
      sub:"Vista giornaliera"
    };
  }
  if(state.mode==="period"){
    const start=parseIso(state.periodStart);
    const end=parseIso(state.periodEnd);
    const main=start&&end
      ? `${start.toLocaleDateString("it-IT",{day:"numeric",month:"short"})} – ${end.toLocaleDateString("it-IT",{day:"numeric",month:"short",year:"numeric"})}`
      : "Periodo selezionato";
    return {
      main,
      sub:days.length?`${days.length} giorni lavorativi`:"Nessun giorno lavorativo"
    };
  }
  const first=days[0],last=days.at(-1);
  return {
    main:first&&last?`${first.label} – ${last.label} 2026`:"Settimana",
    sub:`${days.length} giorni lavorativi`
  };
}

export function renderAgendaPage(root,{profile,state=agendaState}={}){
  const days=daysForMode(profile,state);
  const start=Math.max(6,clampHour(profile?.dayStart,8));
  const end=Math.min(22,clampHour(profile?.dayEnd,19));
  const startMinutes=start*60;
  const totalMinutes=Math.max(60,(end-start)*60);
  const agendaHeight=totalMinutes*PIXELS_PER_MINUTE;
  const label=periodLabel(days,state);

  const heads=days.map(day=>`
    <div class="agenda-day-head">
      <strong>${day.name}</strong><span>${day.label}</span>
    </div>`).join("");

  const timeLabels=[];
  for(let hour=start;hour<=end;hour+=1){
    const top=(hour-start)*60*PIXELS_PER_MINUTE;
    timeLabels.push(`<span class="agenda-time-label" style="top:${top}px">${String(hour).padStart(2,"0")}:00</span>`);
  }

  const dayColumns=days.map(day=>{
    const events=DEMO_EVENTS
      .filter(event=>event.date===day.date)
      .map(event=>eventMarkup(event,startMinutes))
      .join("");
    const slots=[];
    for(let minute=0;minute<totalMinutes;minute+=30){
      const absolute=startMinutes+minute;
      const hour=Math.floor(absolute/60);
      const mins=absolute%60;
      const time=`${String(hour).padStart(2,"0")}:${String(mins).padStart(2,"0")}`;
      slots.push(`<button type="button" class="agenda-slot" style="--slot-top:${minute*PIXELS_PER_MINUTE}px" data-agenda-slot data-date="${day.date}" data-time="${time}" aria-label="Nuovo appuntamento ${day.name} ${day.label} alle ${time}"><span>+</span></button>`);
    }
    return `<div class="agenda-day-column">${slots.join("")}${events}</div>`;
  }).join("");

  const periodControls=state.mode==="period"?`
    <div class="agenda-period-filter">
      <label>Dal <input type="date" value="${state.periodStart}" data-agenda-period-start></label>
      <label>Al <input type="date" value="${state.periodEnd}" data-agenda-period-end></label>
      <button type="button" data-agenda-period-apply>Applica</button>
    </div>`:"";

  const empty=days.length===0
    ? '<div class="agenda-empty">Nessun giorno lavorativo nel periodo selezionato.</div>'
    : `<div class="agenda-scroll">
        <div class="agenda-grid" style="--agenda-days:${days.length};--agenda-height:${agendaHeight}px">
          <div class="agenda-corner"></div>
          ${heads}
          <div class="agenda-time-axis">${timeLabels.join("")}</div>
          ${dayColumns}
        </div>
      </div>`;

  root.innerHTML=`
    <div class="agenda-page">
      <header class="agenda-page-head">
        <div>
          <h1>Agenda</h1>
          <p>Organizza appuntamenti e impegni mantenendo una visione chiara della settimana.</p>
        </div>
        <button class="agenda-new" type="button" data-agenda-new>
          <svg class="icon" aria-hidden="true"><use href="#icon-plus"/></svg>
          Nuovo appuntamento
        </button>
      </header>

      <section class="agenda-kpis" aria-label="Riepilogo agenda">
        <article class="agenda-kpi"><span>Oggi</span><strong>8</strong><small>appuntamenti totali</small></article>
        <article class="agenda-kpi"><span>Prime visite</span><strong>2</strong><small>previste oggi</small></article>
        <article class="agenda-kpi"><span>Controlli</span><strong>5</strong><small>previsti oggi</small></article>
        <article class="agenda-kpi"><span>Personali</span><strong>1</strong><small>impegno personale</small></article>
      </section>

      <section class="agenda-calendar-card">
        <div class="agenda-toolbar">
          <div class="agenda-period-nav">
            <button class="agenda-arrow" type="button" aria-label="Periodo precedente" data-agenda-prev>‹</button>
            <div class="agenda-period-label">
              <strong>${label.main}</strong>
              <span>${label.sub}</span>
            </div>
            <button class="agenda-arrow" type="button" aria-label="Periodo successivo" data-agenda-next>›</button>
          </div>
          <div class="agenda-view-switch" aria-label="Vista agenda">
            <button type="button" class="${state.mode==="week"?"active":""}" data-agenda-mode="week">Settimana</button>
            <button type="button" class="${state.mode==="day"?"active":""}" data-agenda-mode="day">Giorno</button>
            <button type="button" class="${state.mode==="period"?"active":""}" data-agenda-mode="period">Periodo</button>
          </div>
          ${periodControls}
        </div>

        ${empty}

        <div class="agenda-legend">
          <span><i class="agenda-dot first"></i>Prima visita</span>
          <span><i class="agenda-dot control"></i>Controllo</span>
          <span><i class="agenda-dot personal"></i>Impegno personale</span>
        </div>
      </section>
    </div>
  `;
}

export function bindAgendaPage(root,{profile,state=agendaState,onNewAppointment}={}){
  const rerender=()=>{
    renderAgendaPage(root,{profile,state});
    bindAgendaPage(root,{profile,state,onNewAppointment});
  };

  root.querySelectorAll("[data-agenda-mode]").forEach(button=>{
    button.addEventListener("click",()=>{
      state.mode=button.dataset.agendaMode;
      rerender();
    });
  });

  root.querySelector("[data-agenda-prev]")?.addEventListener("click",()=>{
    if(state.mode==="week"){
      const current=parseIso(state.weekStart)||parseIso(WEEK_START);
      state.weekStart=iso(addDays(current,-7));
      rerender();
    }else if(state.mode==="day"){
      const current=parseIso(state.dayDate)||parseIso(WEEK_START);
      let previous=addDays(current,-1);
      while(!isWorkingDay(previous,profile?.workDays)) previous=addDays(previous,-1);
      state.dayDate=iso(previous);
      rerender();
    }
  });

  root.querySelector("[data-agenda-next]")?.addEventListener("click",()=>{
    if(state.mode==="week"){
      const current=parseIso(state.weekStart)||parseIso(WEEK_START);
      state.weekStart=iso(addDays(current,7));
      rerender();
    }else if(state.mode==="day"){
      const current=parseIso(state.dayDate)||parseIso(WEEK_START);
      let next=addDays(current,1);
      while(!isWorkingDay(next,profile?.workDays)) next=addDays(next,1);
      state.dayDate=iso(next);
      rerender();
    }
  });

  root.querySelector("[data-agenda-period-apply]")?.addEventListener("click",()=>{
    const start=root.querySelector("[data-agenda-period-start]")?.value||state.periodStart;
    const end=root.querySelector("[data-agenda-period-end]")?.value||state.periodEnd;
    if(start>end){
      alert("La data iniziale deve essere precedente o uguale alla data finale.");
      return;
    }
    state.periodStart=start;
    state.periodEnd=end;
    rerender();
  });

  root.querySelectorAll("[data-agenda-slot]").forEach(slot=>{
    slot.addEventListener("click",()=>{
      onNewAppointment?.({date:slot.dataset.date,time:slot.dataset.time});
    });
  });

  root.querySelector("[data-agenda-new]")?.addEventListener("click",()=>onNewAppointment?.());
}
