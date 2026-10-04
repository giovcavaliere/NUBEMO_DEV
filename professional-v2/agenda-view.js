const WORK_DAYS=[
  {name:"Lunedì",label:"5 ott",date:"2026-10-05"},
  {name:"Martedì",label:"6 ott",date:"2026-10-06"},
  {name:"Mercoledì",label:"7 ott",date:"2026-10-07"},
  {name:"Giovedì",label:"8 ott",date:"2026-10-08"},
  {name:"Venerdì",label:"9 ott",date:"2026-10-09"},
  {name:"Sabato",label:"10 ott",date:"2026-10-10"}
];
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

export const agendaState={
  mode:"week",
  dayIndex:0,
  periodStart:"2026-10-05",
  periodEnd:"2026-10-10"
};

function clampHour(value,fallback){
  const hour=Number.parseInt(String(value||"").split(":")[0],10);
  return Number.isFinite(hour)?hour:fallback;
}

function visibleWorkDays(profile){
  return WORK_DAYS.slice(0,Number(profile?.workDays)===6?6:5);
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
  const workDays=visibleWorkDays(profile);
  if(state.mode==="day"){
    const index=Math.min(Math.max(0,state.dayIndex),workDays.length-1);
    return [workDays[index]];
  }
  if(state.mode==="period"){
    return workDays.filter(day=>day.date>=state.periodStart&&day.date<=state.periodEnd);
  }
  return workDays;
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
    return {
      main:"Periodo selezionato",
      sub:days.length?days.length+" giorni lavorativi":"Nessun giorno lavorativo"
    };
  }
  const first=days[0],last=days.at(-1);
  return {
    main:first&&last?`${first.label.replace(" ott","")}–${last.label} 2026`:"Settimana",
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
    return `<div class="agenda-day-column">${events}</div>`;
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
      if(state.mode==="day"){
        const max=visibleWorkDays(profile).length-1;
        state.dayIndex=Math.min(Math.max(0,state.dayIndex),max);
      }
      rerender();
    });
  });

  root.querySelector("[data-agenda-prev]")?.addEventListener("click",()=>{
    if(state.mode==="day"){
      const count=visibleWorkDays(profile).length;
      state.dayIndex=(state.dayIndex-1+count)%count;
      rerender();
    }
  });

  root.querySelector("[data-agenda-next]")?.addEventListener("click",()=>{
    if(state.mode==="day"){
      const count=visibleWorkDays(profile).length;
      state.dayIndex=(state.dayIndex+1)%count;
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

  root.querySelector("[data-agenda-new]")?.addEventListener("click",()=>onNewAppointment?.());
}
