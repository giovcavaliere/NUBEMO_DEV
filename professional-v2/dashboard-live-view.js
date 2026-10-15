import {loadProfessionalDashboard} from "./dashboard-live-service.js";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
export async function renderLiveDashboard(root,patients){
 const cards=[...root.querySelectorAll(".kpi-grid .kpi-card")];
 const agendaList=root.querySelector(".home-grid .module.agenda .agenda-list");
 const agendaNote=root.querySelector(".home-grid .module.agenda .agenda-note");
 const agendaBottom=root.querySelector(".home-grid .module.agenda .agenda-bottom");
 const priorityRows=[...root.querySelectorAll(".home-grid .module.priorities .priority-row")];
 cards.forEach(card=>card.querySelector("strong").textContent="—");
 priorityRows.forEach(row=>{row.querySelector("b").textContent="—";row.disabled=true;});
 agendaList.textContent="Caricamento degli appuntamenti…";
 agendaNote.textContent="Caricamento agenda…";
 agendaBottom.textContent="";
 const dashboard=await loadProfessionalDashboard(patients);
 const values=[dashboard.kpis.active,dashboard.kpis.newMonth,dashboard.kpis.first,dashboard.kpis.control];
 cards.forEach((card,i)=>card.querySelector("strong").textContent=String(values[i]));
 const descriptions=["percorsi attivi","nuove anagrafiche questo mese","prime visite previste oggi","controlli previsti oggi"];
 cards.forEach((card,i)=>card.querySelector("small").textContent=descriptions[i]);
 agendaNote.textContent="Prossimi appuntamenti nelle "+dashboard.windowHours+" ore";
 agendaList.innerHTML=dashboard.next.length?dashboard.next.map(event=>{
 const personal=event.type==="personal",first=event.type==="first";
 const label=personal?"Personale":first?"Prima visita":"Controllo";
 return '<div class="agenda-row"><div class="agenda-time">'+esc(event.start)+'</div><div class="personal-avatar"><svg class="icon" aria-hidden="true"><use href="#icon-'+(personal?"cup":"patients")+'"/></svg></div><div class="agenda-info"><strong>'+esc(event.name)+'</strong><span>'+esc(event.meta)+'</span></div><span class="pill '+(first||personal?"peach":"green")+'">'+label+'</span></div>';
 }).join(""):'<p class="dashboard-agenda-empty">Nessun altro appuntamento nelle prossime '+dashboard.windowHours+' ore.</p>';
 agendaBottom.textContent=dashboard.remaining?dashboard.remaining+" altri impegni oggi":"Nessun altro appuntamento oggi";
 const priorities=[dashboard.priorities.documents,dashboard.priorities.noDiary,dashboard.priorities.invites,dashboard.priorities.drafts];
 priorityRows.forEach((row,i)=>{row.querySelector("b").textContent=String(priorities[i]);row.disabled=false;row.onclick=()=>{location.hash=i===0||i===1||i===2?"#patients":"#patients";};});
 const agendaButton=root.querySelector(".home-grid .module.agenda .link-button");
 if(agendaButton)agendaButton.onclick=()=>{location.hash="#agenda";};
}
