const DAY_NAMES=["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
const DAY_DATES=["5 ott","6 ott","7 ott","8 ott","9 ott","10 ott"];
const PIXELS_PER_HALF_HOUR=35;
const PIXELS_PER_MINUTE=PIXELS_PER_HALF_HOUR/30;

const DEMO_EVENTS=[
  {day:0,start:"09:00",duration:30,type:"control",name:"Giovanni Cavaliere",meta:"Controllo · 30 min"},
  {day:0,start:"11:00",duration:60,type:"first",name:"Elisa Manco",meta:"Prima visita · 60 min"},
  {day:1,start:"10:00",duration:30,type:"personal",name:"Impegno personale",meta:"Fuori studio · 30 min"},
  {day:1,start:"15:00",duration:30,type:"control",name:"Marco Bianchi",meta:"Controllo · 30 min"},
  {day:2,start:"09:00",duration:60,type:"first",name:"Francesca Cavaliere",meta:"Prima visita · 60 min"},
  {day:2,start:"14:00",duration:30,type:"control",name:"Luca Ferrari",meta:"Controllo · 30 min"},
  {day:3,start:"12:00",duration:60,type:"personal",name:"Impegno personale",meta:"Pausa studio · 60 min"},
  {day:3,start:"16:00",duration:30,type:"control",name:"Sara Conti",meta:"Controllo · 30 min"},
  {day:4,start:"10:00",duration:30,type:"control",name:"Elisa Manco",meta:"Controllo · 30 min"},
  {day:5,start:"09:00",duration:60,type:"first",name:"Nuovo paziente",meta:"Prima visita · 60 min"}
];

function clampHour(value,fallback){
  const hour=Number.parseInt(String(value||"").split(":")[0],10);
  return Number.isFinite(hour)?hour:fallback;
}

function visibleDays(profile){
  return Number(profile?.workDays)===6?6:5;
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

export function renderAgendaPage(root,{profile}={}){
  const days=visibleDays(profile);
  const start=Math.max(6,clampHour(profile?.dayStart,8));
  const end=Math.min(22,clampHour(profile?.dayEnd,19));
  const startMinutes=start*60;
  const totalMinutes=Math.max(60,(end-start)*60);
  const agendaHeight=totalMinutes*PIXELS_PER_MINUTE;

  const todayIndex=days>5?5:-1;
  const heads=DAY_NAMES.slice(0,days).map((name,index)=>`
    <div class="agenda-day-head ${index===todayIndex?"today":""}">
      <strong>${name}</strong><span>${DAY_DATES[index]}</span>
    </div>`).join("");

  const timeLabels=[];
  for(let hour=start;hour<=end;hour+=1){
    const top=(hour-start)*60*PIXELS_PER_MINUTE;
    timeLabels.push(`<span class="agenda-time-label" style="top:${top}px">${String(hour).padStart(2,"0")}:00</span>`);
  }

  const dayColumns=Array.from({length:days},(_,day)=>{
    const events=DEMO_EVENTS
      .filter(event=>event.day===day)
      .map(event=>eventMarkup(event,startMinutes))
      .join("");
    return `<div class="agenda-day-column">${events}</div>`;
  }).join("");

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
            <button class="agenda-arrow" type="button" aria-label="Periodo precedente">‹</button>
            <div class="agenda-period-label">
              <strong>5–${days===6?"10":"9"} ottobre 2026</strong>
              <span>${days} giorni lavorativi</span>
            </div>
            <button class="agenda-arrow" type="button" aria-label="Periodo successivo">›</button>
          </div>
          <div class="agenda-view-switch" aria-label="Vista agenda">
            <button type="button" class="active">Settimana</button>
            <button type="button">Giorno</button>
            <button type="button">Periodo</button>
          </div>
        </div>

        <div class="agenda-scroll">
          <div class="agenda-grid" style="--agenda-days:${days};--agenda-height:${agendaHeight}px">
            <div class="agenda-corner"></div>
            ${heads}
            <div class="agenda-time-axis">${timeLabels.join("")}</div>
            ${dayColumns}
          </div>
        </div>

        <div class="agenda-legend">
          <span><i class="agenda-dot first"></i>Prima visita</span>
          <span><i class="agenda-dot control"></i>Controllo</span>
          <span><i class="agenda-dot personal"></i>Impegno personale</span>
        </div>
      </section>
    </div>
  `;
}
