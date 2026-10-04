const DAY_NAMES=["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
const DAY_DATES=["5 ott","6 ott","7 ott","8 ott","9 ott","10 ott"];

const DEMO_EVENTS=[
  {day:0,hour:9,type:"control",name:"Giovanni Cavaliere",meta:"Controllo · 30 min"},
  {day:0,hour:11,type:"first",name:"Elisa Manco",meta:"Prima visita · 60 min"},
  {day:1,hour:10,type:"personal",name:"Impegno personale",meta:"Fuori studio · 30 min"},
  {day:1,hour:15,type:"control",name:"Marco Bianchi",meta:"Controllo · 30 min"},
  {day:2,hour:9,type:"first",name:"Francesca Cavaliere",meta:"Prima visita · 60 min"},
  {day:2,hour:14,type:"control",name:"Luca Ferrari",meta:"Controllo · 30 min"},
  {day:3,hour:12,type:"personal",name:"Impegno personale",meta:"Pausa studio · 60 min"},
  {day:3,hour:16,type:"control",name:"Sara Conti",meta:"Controllo · 30 min"},
  {day:4,hour:10,type:"control",name:"Elisa Manco",meta:"Controllo · 30 min"},
  {day:5,hour:9,type:"first",name:"Nuovo paziente",meta:"Prima visita · 60 min"}
];

function clampHour(value,fallback){
  const hour=Number.parseInt(String(value||"").split(":")[0],10);
  return Number.isFinite(hour)?hour:fallback;
}

function visibleDays(profile){
  return Number(profile?.workDays)===6?6:5;
}

function eventFor(day,hour){
  return DEMO_EVENTS.find(event=>event.day===day&&event.hour===hour);
}

function eventMarkup(event){
  if(!event) return "";
  return `<button type="button" class="agenda-event ${event.type}" tabindex="-1">
    <strong>${event.name}</strong>
    <span>${event.meta}</span>
  </button>`;
}

export function renderAgendaPage(root,{profile}={}){
  const days=visibleDays(profile);
  const start=Math.max(6,clampHour(profile?.dayStart,8));
  const end=Math.min(22,clampHour(profile?.dayEnd,19));
  const hours=[];
  for(let hour=start;hour<end;hour+=1) hours.push(hour);

  const todayIndex=days>5?5:-1;
  const heads=DAY_NAMES.slice(0,days).map((name,index)=>`
    <div class="agenda-day-head ${index===todayIndex?"today":""}">
      <strong>${name}</strong><span>${DAY_DATES[index]}</span>
    </div>`).join("");

  const rows=hours.map(hour=>{
    const slots=Array.from({length:days},(_,day)=>`
      <div class="agenda-slot">${eventMarkup(eventFor(day,hour))}</div>
    `).join("");
    return `<div class="agenda-hour">${String(hour).padStart(2,"0")}:00</div>${slots}`;
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
          <div class="agenda-grid" style="--agenda-days:${days}">
            <div class="agenda-corner"></div>
            ${heads}
            ${rows}
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
