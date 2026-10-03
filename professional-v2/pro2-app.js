import {patientRecords} from "./patients-data.js";
import {renderPatientsPage,renderPatientPlaceholder} from "./patients-view.js";

const dashboardView=document.getElementById("dashboardView");
const patientsView=document.getElementById("patientsView");
const patientDetailView=document.getElementById("patientDetailView");
const homeBanner=document.getElementById("homeBanner");

const patientState={status:"active",query:""};

function currentRoute(){
  const hash=(location.hash||"#dashboard").slice(1);
  if(hash==="patients") return {name:"patients"};
  if(hash.startsWith("patient/")) return {name:"patient-detail",id:hash.split("/")[1]};
  return {name:"dashboard"};
}

function setNavActive(routeName){
  const navRoute=routeName==="patient-detail"?"patients":routeName;
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
  patientDetailView.hidden=route.name!=="patient-detail";
  homeBanner.hidden=route.name!=="dashboard";
  setNavActive(route.name);

  if(route.name==="patients"){
    renderPatients();
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
    query:patientState.query
  });

  patientsView.querySelectorAll("[data-patient-status]").forEach(button=>{
    button.addEventListener("click",()=>{
      patientState.status=button.dataset.patientStatus;
      patientState.query="";
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

  patientsView.querySelectorAll("[data-patient-id]").forEach(row=>{
    row.addEventListener("click",()=>{location.hash=`#patient/${row.dataset.patientId}`});
  });

  patientsView.querySelector("[data-new-patient]")?.addEventListener("click",()=>{
    alert("Nuovo paziente: funzione da collegare nel prossimo step.");
  });
}

window.addEventListener("hashchange",()=>showView(currentRoute()));
showView(currentRoute());
