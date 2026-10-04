import {patientRecords} from "./patients-data.js";

const esc=(value="")=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const fullName=p=>[p?.first_name,p?.last_name].filter(Boolean).join(" ");
const defaultDate=()=>new Date().toISOString().slice(0,10);

export const appointmentState={
  patientId:"",
  type:"first",
  date:"2026-10-06",
  time:"11:00",
  duration:60,
  modality:"studio",
  studioId:"",
  notes:"",
  couple:false,
  reminder:true
};

function studioLabel(studio){
  if(!studio) return "Nessuno studio configurato";
  return [studio.name,studio.address,studio.city].filter(Boolean).join(" · ");
}
function selectedPatient(state){return patientRecords.find(p=>p.id===state.patientId)||null}
function effectiveEmail(patient){return String(patient?.email||"").trim()}
function typeInfo(type){
  if(type==="control") return {title:"Controllo",sub:"Visita di follow-up",className:"control"};
  if(type==="personal") return {title:"Impegno personale",sub:"Blocco agenda (senza paziente)",className:"personal"};
  return {title:"Prima visita",sub:"Valutazione iniziale del paziente",className:"first"};
}
function formatDate(value){
  const [y,m,d]=String(value||"").split("-").map(Number);
  if(!y||!m||!d) return "—";
  return new Date(y,m-1,d,12).toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
}
function durationOptions(selected){
  const values=[15,30,45,60,90,120,180];
  if(!values.includes(Number(selected))) values.push(Number(selected));
  return values.sort((a,b)=>a-b).map(v=>`<option value="${v}" ${Number(selected)===v?"selected":""}>${v} minuti</option>`).join("");
}
function studiosOptions(profile,state){
  const studios=Array.isArray(profile.studios)?profile.studios:[];
  if(!state.studioId && studios.length){
    state.studioId=(studios.find(s=>s.primary)||studios[0]).id;
  }
  return studios.length
    ? studios.map(s=>`<option value="${esc(s.id)}" ${state.studioId===s.id?"selected":""}>${esc(s.name||"Studio")} — ${esc([s.address,s.city].filter(Boolean).join(", "))}</option>`).join("")
    : '<option value="">Nessuno studio configurato</option>';
}
function patientResultMarkup(patient){
  return `<button type="button" class="appointment-patient-result" data-appointment-patient="${esc(patient.id)}">
    <span class="appointment-avatar">${patient.avatar?`<img src="${esc(patient.avatar)}" alt="">`:`<b>${esc((patient.first_name?.[0]||"")+(patient.last_name?.[0]||""))}</b>`}</span>
    <span><strong>${esc(fullName(patient))}</strong><small>${esc(patient.code||"Draft")} ${patient.email?"· "+esc(patient.email):"· Nessuna email"}</small></span>
    <span class="appointment-result-arrow">›</span>
  </button>`;
}
function selectedPatientMarkup(patient){
  if(!patient) return "";
  return `<div class="appointment-selected-patient">
    <span class="appointment-avatar">${patient.avatar?`<img src="${esc(patient.avatar)}" alt="">`:`<b>${esc((patient.first_name?.[0]||"")+(patient.last_name?.[0]||""))}</b>`}</span>
    <span><strong>${esc(fullName(patient))}</strong><small>${esc(patient.code||"Draft")}${patient.email?" · "+esc(patient.email):" · Nessuna email"}</small></span>
    <button type="button" aria-label="Rimuovi paziente" data-appointment-patient-clear>×</button>
  </div>`;
}

export function renderAppointmentPage(root,{profile,state=appointmentState}={}){
  const patient=selectedPatient(state);
  const personal=state.type==="personal";
  const reminderAvailable=!personal && !!effectiveEmail(patient);
  if(!reminderAvailable) state.reminder=false;
  const info=typeInfo(state.type);
  const studios=Array.isArray(profile.studios)?profile.studios:[];
  const studio=studios.find(s=>s.id===state.studioId)||studios.find(s=>s.primary)||studios[0]||null;

  root.innerHTML=`
  <div class="appointment-page">
    <div class="appointment-breadcrumb"><button type="button" data-appointment-cancel>Agenda</button><span>›</span><strong>Nuovo appuntamento</strong></div>
    <header class="appointment-head"><h1>Nuovo appuntamento</h1><p>Crea una visita o un impegno personale.</p></header>

    <div class="appointment-layout">
      <form class="appointment-card appointment-form" data-appointment-form>
        <section class="appointment-section patient-section ${personal?"is-disabled":""}">
          <div class="appointment-label-row"><label>Paziente <em>*</em></label><button type="button" class="draft-link" data-draft-open ${personal?"disabled":""}>+ Crea Draft rapido</button></div>
          <div class="appointment-search-wrap">
            <svg class="icon" aria-hidden="true"><use href="#icon-search"/></svg>
            <input type="search" placeholder="Cerca paziente per nome, cognome o codice..." data-appointment-search ${personal?"disabled":""} autocomplete="off">
          </div>
          <div class="appointment-patient-results" data-appointment-results hidden></div>
          <div data-selected-patient>${selectedPatientMarkup(patient)}</div>
        </section>

        <section class="appointment-section">
          <label class="appointment-block-label">Tipo di appuntamento <em>*</em></label>
          <div class="appointment-types">
            <button type="button" class="appointment-type ${state.type==="first"?"active":""}" data-appointment-type="first">
              <span class="appointment-type-icon">○</span><span><strong>Prima visita</strong><small>Valutazione iniziale del paziente</small></span>
            </button>
            <button type="button" class="appointment-type ${state.type==="control"?"active":""}" data-appointment-type="control">
              <span class="appointment-type-icon">↻</span><span><strong>Controllo</strong><small>Visita di follow-up</small></span>
            </button>
            <button type="button" class="appointment-type ${state.type==="personal"?"active":""}" data-appointment-type="personal">
              <span class="appointment-type-icon">○</span><span><strong>Impegno personale</strong><small>Blocco agenda (senza paziente)</small></span>
            </button>
          </div>
        </section>

        <section class="appointment-fields three">
          <label><span>Data <em>*</em></span><input type="date" value="${esc(state.date||defaultDate())}" data-appointment-field="date" required></label>
          <label><span>Ora <em>*</em></span><input type="time" value="${esc(state.time)}" data-appointment-field="time" required></label>
          <label><span>Durata <em>*</em></span><select data-appointment-field="duration">${durationOptions(state.duration)}</select></label>
        </section>

        <section class="appointment-fields two">
          <label class="${personal?"is-disabled":""}"><span>Modalità</span>
            <select data-appointment-field="modality" ${personal?"disabled":""}>
              <option value="studio" ${state.modality==="studio"?"selected":""}>In studio</option>
              <option value="online" ${state.modality==="online"?"selected":""}>Online</option>
              <option value="home" ${state.modality==="home"?"selected":""}>A domicilio</option>
            </select>
          </label>
          <label class="${personal?"is-disabled":""}"><span>Luogo / Studio</span>
            <select data-appointment-field="studioId" ${personal||!studios.length?"disabled":""}>${studiosOptions(profile,state)}</select>
          </label>
        </section>

        <section class="appointment-note">
          <label>Note appuntamento</label>
          <textarea maxlength="500" placeholder="Aggiungi note, obiettivi o indicazioni per la visita..." data-appointment-field="notes">${esc(state.notes)}</textarea>
          <small><span data-notes-count>${String(state.notes||"").length}</span>/500</small>
        </section>

        <section class="appointment-toggles">
          <label class="appointment-toggle-row ${personal?"is-disabled":""}">
            <input type="checkbox" data-appointment-couple ${state.couple?"checked":""} ${personal?"disabled":""}>
            <span class="appointment-switch"></span>
            <span><strong>Appuntamento di coppia</strong><small>La durata viene raddoppiata automaticamente</small></span>
          </label>
          <label class="appointment-toggle-row ${!reminderAvailable?"is-disabled":""}" title="${!patient&&!personal?"Seleziona un paziente":(!reminderAvailable&&!personal?"Il paziente non ha un indirizzo email":"")}">
            <input type="checkbox" data-appointment-reminder ${state.reminder?"checked":""} ${reminderAvailable?"":"disabled"}>
            <span class="appointment-switch"></span>
            <span><strong>Invia promemoria via mail</strong><small>${personal?"Non disponibile per impegni personali":(!patient?"Seleziona un paziente":(reminderAvailable?"Invia un promemoria all'indirizzo email del paziente":"Email paziente non disponibile"))}</small></span>
          </label>
        </section>

        <footer class="appointment-actions">
          <button type="button" class="appointment-cancel" data-appointment-cancel>Annulla</button>
          <button type="submit" class="appointment-save"><svg class="icon" aria-hidden="true"><use href="#icon-calendar"/></svg>Salva appuntamento</button>
        </footer>
      </form>

      <aside class="appointment-card appointment-summary">
        <div class="appointment-summary-head"><h2>Riepilogo</h2><p>Controlla i dettagli dell'appuntamento.</p></div>
        <div class="appointment-summary-type ${info.className}">
          <span class="appointment-summary-icon">○</span><span><strong>${info.title}</strong><small>${info.sub}</small></span><b>Da confermare</b>
        </div>
        <dl>
          ${personal?"":`<div><dt>Paziente</dt><dd><strong>${patient?esc(fullName(patient)):"—"}</strong><span>${patient?esc(patient.code||"Draft"):"Seleziona un paziente"}</span></dd></div>`}
          <div><dt>Data</dt><dd><strong>${esc(formatDate(state.date))}</strong></dd></div>
          <div><dt>Ora</dt><dd><strong>${esc(state.time||"—")}</strong></dd></div>
          <div><dt>Durata</dt><dd><strong>${esc(state.duration)} minuti${state.couple&&!personal?" · coppia":""}</strong></dd></div>
          ${personal?"":`<div><dt>Modalità</dt><dd><strong>${state.modality==="studio"?"In studio":state.modality==="online"?"Online":"A domicilio"}</strong></dd></div>
          <div><dt>Studio</dt><dd><strong>${esc(studio?studio.name:"—")}</strong><span>${esc(studio?studioLabel(studio):"Nessuno studio configurato")}</span></dd></div>
          <div><dt>Promemoria</dt><dd><strong>${state.reminder?"Email attiva":"Non inviato"}</strong></dd></div>`}
        </dl>
        <div class="appointment-summary-note"><strong>Note</strong><p>${state.notes?esc(state.notes):"Nessuna nota aggiunta."}</p></div>
      </aside>
    </div>

    <div class="draft-overlay" data-draft-overlay hidden>
      <section class="draft-dialog" role="dialog" aria-modal="true" aria-labelledby="draftTitle">
        <div class="draft-dialog-head"><div><h2 id="draftTitle">Nuovo paziente Draft</h2><p>Crea rapidamente il contatto e associalo all'appuntamento.</p></div><button type="button" data-draft-close aria-label="Chiudi">×</button></div>
        <div class="draft-fields">
          <label><span>Nome <em>*</em></span><input data-draft-field="firstName" autocomplete="given-name"></label>
          <label><span>Cognome <em>*</em></span><input data-draft-field="lastName" autocomplete="family-name"></label>
          <label><span>Telefono</span><input data-draft-field="phone" type="tel" autocomplete="tel"></label>
          <label><span>Email</span><input data-draft-field="email" type="email" autocomplete="email"></label>
        </div>
        <p class="draft-hint">L'email è facoltativa. Senza email il promemoria dell'appuntamento non sarà disponibile.</p>
        <div class="draft-actions"><button type="button" class="appointment-cancel" data-draft-close>Annulla</button><button type="button" class="appointment-save" data-draft-save>Crea Draft</button></div>
      </section>
    </div>
  </div>`;
}

export function bindAppointmentPage(root,{profile,state=appointmentState,onCancel,onSave}={}){
  const rerender=()=>{renderAppointmentPage(root,{profile,state});bindAppointmentPage(root,{profile,state,onCancel,onSave})};
  root.querySelectorAll("[data-appointment-cancel]").forEach(b=>b.addEventListener("click",()=>onCancel?.()));
  root.querySelectorAll("[data-appointment-type]").forEach(button=>button.addEventListener("click",()=>{
    const next=button.dataset.appointmentType;
    state.type=next;
    if(next==="personal"){state.patientId="";state.couple=false;state.reminder=false;state.duration=30}
    else state.duration=next==="first"?Number(profile.firstVisit||60):Number(profile.controlVisit||30);
    rerender();
  }));
  root.querySelectorAll("[data-appointment-field]").forEach(field=>{
    field.addEventListener(field.tagName==="TEXTAREA"?"input":"change",()=>{
      const key=field.dataset.appointmentField;
      state[key]=key==="duration"?Number(field.value):field.value;
      if(key==="notes"){const c=root.querySelector("[data-notes-count]");if(c)c.textContent=field.value.length;}
      if(key!=="notes") rerender();
    });
  });
  const search=root.querySelector("[data-appointment-search]");
  const results=root.querySelector("[data-appointment-results]");
  search?.addEventListener("input",()=>{
    const q=search.value.trim().toLocaleLowerCase("it");
    if(!q){results.hidden=true;results.innerHTML="";return}
    const matches=patientRecords.filter(p=>["active","draft","pending"].includes(p.status)).filter(p=>`${fullName(p)} ${p.code||""}`.toLocaleLowerCase("it").includes(q)).slice(0,7);
    results.innerHTML=matches.length?matches.map(patientResultMarkup).join(""):'<div class="appointment-search-empty">Nessun paziente trovato.</div>';
    results.hidden=false;
    results.querySelectorAll("[data-appointment-patient]").forEach(b=>b.addEventListener("click",()=>{
      state.patientId=b.dataset.appointmentPatient;
      state.reminder=!!effectiveEmail(selectedPatient(state));
      rerender();
    }));
  });
  root.querySelector("[data-appointment-patient-clear]")?.addEventListener("click",()=>{state.patientId="";state.reminder=false;rerender()});
  root.querySelector("[data-appointment-couple]")?.addEventListener("change",event=>{
    const checked=event.target.checked;
    if(checked&&!state.couple) state.duration=Math.min(360,Number(state.duration||30)*2);
    if(!checked&&state.couple) state.duration=Math.max(15,Number(state.duration||30)/2);
    state.couple=checked;
    rerender();
  });
  root.querySelector("[data-appointment-reminder]")?.addEventListener("change",event=>{state.reminder=event.target.checked;rerender()});

  const overlay=root.querySelector("[data-draft-overlay]");
  root.querySelector("[data-draft-open]")?.addEventListener("click",()=>{overlay.hidden=false;overlay.querySelector("[data-draft-field='firstName']")?.focus()});
  root.querySelectorAll("[data-draft-close]").forEach(b=>b.addEventListener("click",()=>{overlay.hidden=true}));
  root.querySelector("[data-draft-save]")?.addEventListener("click",()=>{
    const val=k=>root.querySelector(`[data-draft-field="${k}"]`)?.value.trim()||"";
    const firstName=val("firstName"),lastName=val("lastName"),phone=val("phone"),email=val("email");
    if(!firstName||!lastName){alert("Nome e cognome sono obbligatori per creare il Draft.");return}
    if(email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){alert("Inserisci un indirizzo email valido oppure lascia il campo vuoto.");return}
    const draft={id:`draft-${Date.now()}`,first_name:firstName,last_name:lastName,status:"draft",created_at:new Date().toISOString(),code:`DRAFT-${String(patientRecords.filter(p=>p.status==="draft").length+1).padStart(2,"0")}`,phone,email,avatar:""};
    patientRecords.unshift(draft);
    state.patientId=draft.id;
    state.reminder=!!email;
    rerender();
  });

  root.querySelector("[data-appointment-form]")?.addEventListener("submit",event=>{
    event.preventDefault();
    const patient=selectedPatient(state);
    if(state.type!=="personal"&&!patient){alert("Seleziona un paziente oppure crea un Draft rapido.");return}
    if(!state.date||!state.time||!state.duration){alert("Compila data, ora e durata.");return}
    onSave?.({
      date:state.date,start:state.time,duration:Number(state.duration),
      type:state.type==="first"?"first":state.type==="control"?"control":"personal",
      name:state.type==="personal"?"Impegno personale":fullName(patient),
      meta:state.type==="personal"?`Impegno personale · ${state.duration} min`:`${typeInfo(state.type).title} · ${state.duration} min`,
      patientId:patient?.id||null,modality:state.type==="personal"?null:state.modality,
      studioId:state.type==="personal"?null:state.studioId,notes:state.notes,couple:!!state.couple,
      reminderEmail:!!state.reminder
    });
  });
}
