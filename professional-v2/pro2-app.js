import {patientRecords} from "./patients-data.js";
import {renderPatientsPage,renderPatientPlaceholder} from "./patients-view.js";
import {renderSupportPage,sendSupport} from "./support-view.js";
import {professionalProfile,initials,renderProfilePage,bindProfilePage} from "./profile-view.js";
import {agendaState,renderAgendaPage,bindAgendaPage,addAgendaEvent} from "./agenda-view.js";\nimport {appointmentState,renderAppointmentPage,bindAppointmentPage} from "./appointment-view.js";

const dashboardView=document.getElementById("dashboardView");
const patientsView=document.getElementById("patientsView");
const patientDetailView=document.getElementById("patientDetailView");
const supportView=document.getElementById("supportView");
const profileView=document.getElementById("profileView");
const agendaView=document.getElementById("agendaView");\nconst appointmentView=document.getElementById("appointmentView");
const homeBanner=document.getElementById("homeBanner");

const patientState={status:"active",query:"",documentsOnly:false};

const dashboardSearch=document.querySelector("[data-dashboard-patient-search]");
const dashboardSearchResults=document.querySelector("[data-dashboard-search-results]");

function updateProfessionalIdentity(profile=professionalProfile){
  const displayName=(profile.displayName||[profile.firstName,profile.surname].filter(Boolean).join(" ")||"Professionista").trim();
  const qualification=(profile.qualification||"Nutrizionista").trim();

  document.querySelectorAll("[data-professional-display-name]").forEach(node=>{node.textContent=displayName});
  document.querySelectorAll("[data-dashboard-display-name]").forEach(node=>{node.textContent=displayName});
  document.querySelectorAll("[data-professional-qualification]").forEach(node=>{node.textContent=qualification});

  document.querySelectorAll("[data-professional-avatar]").forEach(node=>{
    node.innerHTML=profile.photoData
      ? `<img src="${profile.photoData}" alt="">`
      : `<span>${initials(profile)}</span>`;
  });
}


function currentRoute(){
  const hash=(location.hash||"#dashboard").slice(1);
  if(hash==="patients") return {name:"patients"};
  if(hash==="agenda") return {name:"agenda"};\n  if(hash==="appointment") return {name:"appointment"};
  if(hash==="support") return {name:"support"};
  if(hash==="profile") return {name:"profile"};
  if(hash.startsWith("patient/")) return {name:"patient-detail",id:hash.split("/")[1]};
  return {name:"dashboard"};
}

function setNavActive(routeName){
  const navRoute=routeName==="patient-detail"?"patients":routeName==="appointment"?"agenda":routeName;
  document.querySelectorAll("[data-route-link]").forEach(link=>{
    const active=link.dataset.routeLink===navRoute;
    link.classList.toggle("active",active);
    if(active) link.setAttribute("aria-current","page");
    else link.removeAttribute("aria-current");
  });
}

function showView(route){
  dashboardView.hidden=route.name!=="dashboard";
  patientsView.hidden=route.name!=="patients";
  agendaView.hidden=route.name!=="agenda";\n  appointmentView.hidden=route.name!=="appointment";
  patientDetailView.hidden=route.name!=="patient-detail";
  supportView.hidden=route.name!=="support";
  profileView.hidden=route.name!=="profile";
  homeBanner.hidden=route.name!=="dashboard";
  setNavActive(route.name);
  if(route.name!=="dashboard"){
    if(dashboardSearch) dashboardSearch.value="";
    closeDashboardSearch();
  }

  if(route.name==="patients"){
    renderPatients();
  }else if(route.name==="agenda"){
    renderAgendaPage(agendaView,{profile:professionalProfile,state:agendaState});
    bindAgendaPage(agendaView,{
      profile:professionalProfile,
      state:agendaState,
      onNewAppointment:()=>{location.hash="#appointment"}
    });
  }else if(route.name==="appointment"){\n    renderAppointmentPage(appointmentView,{profile:professionalProfile,state:appointmentState});\n    bindAppointmentPage(appointmentView,{\n      profile:professionalProfile,\n      state:appointmentState,\n      onCancel:()=>{location.hash="#agenda"},\n      onSave:event=>{\n        addAgendaEvent(event);\n        alert("Appuntamento aggiunto alla demo NUBEMO 2.0.");\n        location.hash="#agenda";\n      }\n    });\n  }else if(route.name==="support"){
    renderSupportPage(supportView);
    supportView.querySelector("#sendSupport")?.addEventListener("click",()=>{void sendSupport(supportView)});
  }else if(route.name==="profile"){
    renderProfilePage(profileView,professionalProfile);
    bindProfilePage(profileView,{profile:professionalProfile,onChange:profile=>{updateProfessionalIdentity(profile);}});
  }else if(route.name==="patient-detail"){
    const patient=patientRecords.find(item=>item.id===route.id);
    if(!patient){
      location.hash="#patients";
      return;
    }
    renderPatientPlaceholder(patientDetailView,patient);
    patientDetailView.querySelector("[data-patient-back]")?.addEventListener("click",()=>{location.hash="#patients"});
  }
}

function renderPatients(){
  renderPatientsPage(patientsView,{
    records:patientRecords,
    status:patientState.status,
    query:patientState.query,
    documentsOnly:patientState.documentsOnly
  });

  patientsView.querySelectorAll("[data-patient-status]").forEach(button=>{
    button.addEventListener("click",()=>{
      patientState.status=button.dataset.patientStatus;
      patientState.query="";
      patientState.documentsOnly=false;
      renderPatients();
    });
  });

  const search=patientsView.querySelector("[data-patient-search]");
  search?.addEventListener("input",event=>{
    patientState.query=event.target.value;
    renderPatients();
    const next=patientsView.querySelector("[data-patient-search]");
    next?.focus();
    if(next) next.setSelectionRange(next.value.length,next.value.length);
  });

  patientsView.querySelector("[data-documents-filter]")?.addEventListener("click",()=>{
    patientState.documentsOnly=!patientState.documentsOnly;
    renderPatients();
  });

  patientsView.querySelectorAll("[data-patient-id]").forEach(row=>{
    row.addEventListener("click",()=>{location.hash=`#patient/${row.dataset.patientId}`});
  });

  patientsView.querySelector("[data-new-patient]")?.addEventListener("click",()=>{
    alert("Nuovo paziente: funzione da collegare nel prossimo step.");
  });
}

function escapeSearchHtml(value=""){
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
}

function closeDashboardSearch(){
  if(!dashboardSearchResults) return;
  dashboardSearchResults.hidden=true;
  dashboardSearchResults.innerHTML="";
}

function renderDashboardSearch(){
  if(!dashboardSearch || !dashboardSearchResults) return;
  const query=dashboardSearch.value.trim().toLocaleLowerCase("it");
  if(!query){
    closeDashboardSearch();
    return;
  }

  const matches=patientRecords
    .filter(patient=>`${patient.first_name} ${patient.last_name}`.toLocaleLowerCase("it").includes(query))
    .slice(0,6);

  dashboardSearchResults.innerHTML=matches.length
    ? matches.map(patient=>`
        <button type="button" class="dashboard-search-item" data-dashboard-patient-id="${patient.id}">
          <img src="${escapeSearchHtml(patient.avatar)}" alt="">
          <span>
            <strong>${escapeSearchHtml(patient.first_name)} ${escapeSearchHtml(patient.last_name)}</strong>
            <small>${patient.status==="active"?"Paziente attivo":"Percorso "+escapeSearchHtml(patient.status)}</small>
          </span>
          <b>›</b>
        </button>
      `).join("")
    : '<div class="dashboard-search-empty">Nessun paziente trovato.</div>';

  dashboardSearchResults.hidden=false;
  dashboardSearchResults.querySelectorAll("[data-dashboard-patient-id]").forEach(button=>{
    button.addEventListener("click",()=>{
      dashboardSearch.value="";
      closeDashboardSearch();
      location.hash=`#patient/${button.dataset.dashboardPatientId}`;
    });
  });
}

dashboardSearch?.addEventListener("input",renderDashboardSearch);
dashboardSearch?.addEventListener("keydown",event=>{
  if(event.key==="Escape"){
    closeDashboardSearch();
    dashboardSearch.blur();
  }
  if(event.key==="Enter"){
    const first=dashboardSearchResults?.querySelector("[data-dashboard-patient-id]");
    if(first){
      event.preventDefault();
      first.click();
    }
  }
});
document.addEventListener("click",event=>{
  if(!event.target.closest(".search-row")) closeDashboardSearch();
});

window.addEventListener("hashchange",()=>showView(currentRoute()));
updateProfessionalIdentity();
showView(currentRoute());
