await window.NUBEMO_PRO2_AUTH_READY;

import {loadOwnPatients} from "./patients-service.js";
import {loadPatientOverview} from "./patient-overview-live.js";
import {renderLivePatientOverview,renderLivePatientProfile} from "./patient-detail-view.js?v=profile-form-fix-20261014";
import {loadLivePatientProfile,saveLivePatientIdentity,saveLiveClinical} from "./patient-profile-live-service.js?v=profile-save-fix-20261014";
import {loadRealNotes,saveRealNote,deleteRealNote} from "./patient-notes-service.js?v=note-delete-fix-20261014";
import {openNewPatientDialog} from "./patient-create-view.js?v=real-create-20261013";
let patientRecords=[];
let patientsPhase="loading";
let patientsError="";
import {renderPatientsPage} from "./patients-view.js?v=live-overview-20261013";




import {renderSupportPage,sendSupport} from "./support-view.js?v=support-migration-20261013";
import {professionalProfile,initials,renderProfilePage,bindProfilePage} from "./profile-view.js?v=profile-clean-20261013";
import {loadProfessionalProfile,saveProfessionalProfile,updateProfessionalMedia} from "./profile-service.js?v=profile-clean-20261013";
import {agendaState,renderAgendaPage,bindAgendaPage,addAgendaEvent} from "./agenda-view.js";
import {appointmentState,renderAppointmentPage,bindAppointmentPage} from "./appointment-view.js";

const dashboardView=document.getElementById("dashboardView");
const patientsView=document.getElementById("patientsView");
const patientDetailView=document.getElementById("patientDetailView");
const supportView=document.getElementById("supportView");
const profileView=document.getElementById("profileView");
const agendaView=document.getElementById("agendaView");
const appointmentView=document.getElementById("appointmentView");
const homeBanner=document.getElementById("homeBanner");

const patientState={status:"active",query:"",documentsOnly:false,sortBy:"created"};
const patientsLoading=loadOwnPatients().then(rows=>{patientRecords=rows;patientsPhase="ready";if(!patientsView.hidden)renderPatients();renderDashboardSearch();}).catch(error=>{patientsPhase="error";patientsError=error.message||"Caricamento pazienti non riuscito.";console.error("Pazienti:",error);if(!patientsView.hidden)renderPatients();});
let profileReady=false;
const profileLoading=loadProfessionalProfile(professionalProfile).then(()=>{profileReady=true;updateProfessionalIdentity();if(!profileView.hidden){renderProfilePage(profileView,professionalProfile);bindProfilePage(profileView,{profile:professionalProfile,onSave:saveProfessionalProfile,onMedia:updateProfessionalMedia,onChange:updateProfessionalIdentity});}}).catch(error=>{console.error("Profilo professionista:",error);document.querySelectorAll("[data-professional-display-name],[data-dashboard-display-name]").forEach(node=>{node.textContent="";});if(!profileView.hidden)profileView.textContent="Impossibile caricare il profilo reale. Riprova ad aggiornare la pagina.";});

const dashboardSearch=document.querySelector("[data-dashboard-patient-search]");
const dashboardSearchResults=document.querySelector("[data-dashboard-search-results]");

function openNewAppointment(prefill={}){
  appointmentState.patientIds=[];
  appointmentState.type="first";
  appointmentState.date=prefill.date||appointmentState.date||"2026-10-06";
  appointmentState.time=prefill.time||"11:00";
  appointmentState.duration=Number(professionalProfile.firstVisit||60);
  appointmentState.modality="studio";
  appointmentState.studioId=(professionalProfile.studios?.find(studio=>studio.primary)||professionalProfile.studios?.[0])?.id||"";
  appointmentState.notes="";
  appointmentState.couple=false;
  appointmentState.reminder=false;
  location.hash="#appointment";
}

function updateProfessionalIdentity(profile=professionalProfile){
  // Identità esclusivamente da profiles (creazione Admin), mai da displayName o demo.
  const displayName=[profile.firstName,profile.surname].filter(Boolean).join(" ").trim();
  const qualification=(profile.qualification||"Nutrizionista").trim();

  document.querySelectorAll("[data-professional-display-name]").forEach(node=>{node.textContent=displayName});
  document.querySelectorAll("[data-dashboard-display-name]").forEach(node=>{node.textContent=displayName ? ", "+displayName : ""});
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
  if(hash==="agenda") return {name:"agenda"};
  if(hash==="appointment") return {name:"appointment"};
  if(hash==="support") return {name:"support"};
  if(hash==="profile") return {name:"profile"};
  if(hash.startsWith("patient/")){
    const [,id,tab="panoramica"]=hash.split("/");
    return {name:"patient-detail",id,tab};
  }
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
  agendaView.hidden=route.name!=="agenda";
  appointmentView.hidden=route.name!=="appointment";
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
      onNewAppointment:prefill=>{openNewAppointment(prefill||{})}
    });
  }else if(route.name==="appointment"){
    renderAppointmentPage(appointmentView,{profile:professionalProfile,state:appointmentState});
    bindAppointmentPage(appointmentView,{
      profile:professionalProfile,
      state:appointmentState,
      onCancel:()=>{location.hash="#agenda"},
      onSave:event=>{
        addAgendaEvent(event);
        alert("Appuntamento aggiunto alla demo NUBEMO 2.0.");
        location.hash="#agenda";
      }
    });
  }else if(route.name==="support"){
    renderSupportPage(supportView);
    supportView.querySelector("#sendSupport")?.addEventListener("click",()=>{void sendSupport(supportView)});
  }else if(route.name==="profile"){
    if(!profileReady){profileView.textContent="Caricamento profilo professionale…";return;}
    renderProfilePage(profileView,professionalProfile);
    bindProfilePage(profileView,{profile:professionalProfile,onSave:saveProfessionalProfile,onMedia:updateProfessionalMedia,onChange:profile=>{updateProfessionalIdentity(profile);}});
  }else if(route.name==="patient-detail"){
    if(!["panoramica","note","profilo"].includes(route.tab)){location.hash=`#patient/${encodeURIComponent(route.id)}/panoramica`;return;}
    patientDetailView.textContent="Caricamento scheda paziente…";
    void (async()=>{
      try{
        await patientsLoading;
        const data=await loadPatientOverview(route.id,patientRecords);
        const active=data.pathways.find(p=>p.status==="active");
        const notes=route.tab==="note"?await loadRealNotes(route.id,active?.id):[];
        const liveProfile=route.tab==="profilo"?await loadLivePatientProfile(route.id,data):null;
        const refresh=()=>{if(currentRoute().id===route.id)showView(currentRoute());};
        if(currentRoute().name==="patient-detail"&&currentRoute().id===route.id&&currentRoute().tab==="profilo"&&liveProfile){
          renderLivePatientProfile(patientDetailView,data,liveProfile,{
            saveIdentity:async values=>{await saveLivePatientIdentity(route.id,liveProfile.record.profile_id,values);patientRecords=await loadOwnPatients();refresh();},
            saveClinical:async values=>{if(!liveProfile.editable)throw Error("È necessario un percorso attivo.");await saveLiveClinical(route.id,liveProfile.pathwayId,values);refresh();}
          });
        }
        if(currentRoute().name==="patient-detail"&&currentRoute().id===route.id&&currentRoute().tab===route.tab&&route.tab!=="profilo")
          renderLivePatientOverview(patientDetailView,{...data,notes},route.tab,{
            save:async(id,content)=>{await saveRealNote(route.id,active?.id,id,content);refresh();},
            remove:async id=>{await deleteRealNote(route.id,active?.id,id);refresh();},
            pathwaySaved:refresh
          });
      }catch(error){patientDetailView.textContent=error.message||"Errore caricamento paziente.";}
    })();
  }
}

async function createRealPatient(values){
  const client=window.nubemoSupabase;
  const {data,error}=await client.functions.invoke("pro2-create-patient",{body:values});
  if(error)throw new Error("Creazione paziente non riuscita: "+error.message);
  if(!data?.ok)throw new Error(data?.error||"Creazione paziente non riuscita.");
  patientRecords=await loadOwnPatients();
  patientState.status=data.invited?"pending":"active";
  patientState.query="";
  patientState.documentsOnly=false;
  renderDashboardSearch();
  // Chiudi prima il dialogo: il nuovo render sostituisce la vista che lo contiene.
  setTimeout(()=>{if(!patientsView.hidden)renderPatients();},0);
}

function renderPatients(){
  if(patientsPhase!=="ready"){
    patientsView.textContent=patientsPhase==="error"?patientsError:"Caricamento pazienti…";
    return;
  }
  renderPatientsPage(patientsView,{
    records:patientRecords,
    status:patientState.status,
    query:patientState.query,
    documentsOnly:patientState.documentsOnly,
    sortBy:patientState.sortBy
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

  patientsView.querySelectorAll("[data-patient-id]").forEach(row=>row.addEventListener("click",()=>{location.hash=`#patient/${encodeURIComponent(row.dataset.patientId)}/panoramica`;}));
  patientsView.querySelector("[data-new-patient]")?.addEventListener("click",()=>{
    openNewPatientDialog(patientsView,{onCreate:createRealPatient});
  });
  patientsView.querySelector("[data-patient-sort]")?.addEventListener("change",event=>{
    patientState.sortBy=event.target.value==="name"?"name":"created";
    renderPatients();
  });


}

function escapeSearchHtml(value=""){
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
}

function dashboardPatientAvatar(patient){
  if(patient.avatar) return `<img src="${escapeSearchHtml(patient.avatar)}" alt="">`;
  const initials=[patient.first_name,patient.last_name]
    .map(value=>String(value||"").trim().charAt(0))
    .filter(Boolean)
    .join("")
    .toLocaleUpperCase("it");
  return `<span class="dashboard-search-avatar-fallback" aria-hidden="true">${escapeSearchHtml(initials||"—")}</span>`;
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
          ${dashboardPatientAvatar(patient)}
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
      location.hash=`#patient/${encodeURIComponent(button.dataset.dashboardPatientId)}/panoramica`;
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
showView(currentRoute());
