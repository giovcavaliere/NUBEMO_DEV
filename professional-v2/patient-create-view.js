const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));

function ageFromBirthDate(value){
  if(!value) return null;
  const birth=new Date(`${value}T12:00:00`);
  if(Number.isNaN(birth.getTime())) return null;
  const today=new Date();
  let age=today.getFullYear()-birth.getFullYear();
  const month=today.getMonth()-birth.getMonth();
  if(month<0 || (month===0 && today.getDate()<birth.getDate())) age-=1;
  return age>=0?age:null;
}

function nextPatientId(records){
  const max=records.reduce((value,item)=>{
    const match=String(item.id||"").match(/^p(\d+)$/);
    return match?Math.max(value,Number(match[1])):value;
  },0);
  return `p${max+1}`;
}

function nextPatientCode(records){
  const max=records.reduce((value,item)=>{
    const match=String(item.code||"").match(/^PAZ-(\d+)$/);
    return match?Math.max(value,Number(match[1])):value;
  },0);
  return `PAZ-${String(max+1).padStart(4,"0")}`;
}

function formMarkup(){
  const sexOptions=["","Maschio","Femmina","Altro","Preferisco non indicarlo"];
  return `<form method="dialog" class="new-patient-form" data-new-patient-form novalidate>
    <header class="new-patient-dialog-head">
      <div>
        <h2>Nuovo paziente</h2>
        <p>Crea l'anagrafica. Gli altri dati del percorso potranno essere aggiunti nelle sezioni dedicate.</p>
      </div>
      <button type="button" class="new-patient-close" data-new-patient-close aria-label="Chiudi">×</button>
    </header>

    <div class="new-patient-fields">
      <div class="new-patient-row">
        <label><span>Nome *</span><input name="firstName" autocomplete="given-name" required></label>
        <label><span>Cognome *</span><input name="lastName" autocomplete="family-name" required></label>
      </div>
      <div class="new-patient-row">
        <label><span>Data di nascita</span><input name="birthDate" type="date"></label>
        <label><span>Sesso</span><select name="sex">${sexOptions.map(option=>`<option value="${escapeHtml(option)}">${escapeHtml(option||"Seleziona...")}</option>`).join("")}</select></label>
      </div>
      <div class="new-patient-row">
        <label><span>Altezza (cm)</span><input name="height" type="number" min="50" max="250" step="0.1" inputmode="decimal"></label>
        <label><span>Codice fiscale</span><input name="fiscalCode" autocomplete="off"></label>
      </div>
      <div class="new-patient-row">
        <label><span>Indirizzo</span><input name="address" autocomplete="street-address"></label>
        <label><span>CAP</span><input name="postalCode" inputmode="numeric" autocomplete="postal-code"></label>
      </div>
      <div class="new-patient-row">
        <label><span>Città</span><input name="city" autocomplete="address-level2"></label>
        <label><span>Provincia</span><input name="province" autocomplete="address-level1"></label>
      </div>
      <div class="new-patient-row">
        <label><span>Telefono</span><input name="phone" type="tel" autocomplete="tel"></label>
        <label><span>Email <b data-new-patient-email-required></b></span><input name="email" type="email" autocomplete="email" data-new-patient-email></label>
      </div>

      <div class="new-patient-account">
        <label class="new-patient-account-toggle">
          <input name="activateNubemo" type="checkbox" data-new-patient-activate>
          <span>
            <strong>Attiva profilo NUBEMO</strong>
            <small>Invia l'invito al paziente. In questo caso l'email è obbligatoria.</small>
          </span>
        </label>
      </div>
      <p class="new-patient-error" data-new-patient-error role="alert" hidden></p>
    </div>

    <footer class="new-patient-actions">
      <button type="button" data-new-patient-close>Annulla</button>
      <button type="submit" value="save">Crea paziente</button>
    </footer>
  </form>`;
}

export function openNewPatientDialog(root,{records,onCreate}){
  const dialog=document.createElement("dialog");
  dialog.className="new-patient-dialog";
  dialog.innerHTML=formMarkup();
  root.append(dialog);

  const form=dialog.querySelector("[data-new-patient-form]");
  const activate=form.querySelector("[data-new-patient-activate]");
  const email=form.querySelector("[data-new-patient-email]");
  const emailRequired=form.querySelector("[data-new-patient-email-required]");
  const error=form.querySelector("[data-new-patient-error]");

  const syncEmailRequirement=()=>{
    const required=activate.checked;
    email.required=required;
    emailRequired.textContent=required?"*":"";
    email.setAttribute("aria-required",String(required));
  };

  const close=()=>dialog.close();
  dialog.querySelectorAll("[data-new-patient-close]").forEach(button=>button.addEventListener("click",close));
  activate.addEventListener("change",syncEmailRequirement);
  syncEmailRequirement();

  form.addEventListener("submit",event=>{
    event.preventDefault();
    const values=new FormData(form);
    const firstName=String(values.get("firstName")||"").trim();
    const lastName=String(values.get("lastName")||"").trim();
    const emailValue=String(values.get("email")||"").trim();
    const activateNubemo=values.get("activateNubemo")==="on";

    error.hidden=true;
    error.textContent="";

    if(!firstName || !lastName){
      error.textContent="Nome e cognome sono obbligatori.";
      error.hidden=false;
      (!firstName?form.elements.firstName:form.elements.lastName).focus();
      return;
    }
    if(activateNubemo && !emailValue){
      error.textContent="Inserisci l'email per attivare il profilo NUBEMO.";
      error.hidden=false;
      email.focus();
      return;
    }
    if(emailValue && !email.checkValidity()){
      error.textContent="Inserisci un indirizzo email valido.";
      error.hidden=false;
      email.focus();
      return;
    }

    const heightRaw=String(values.get("height")||"").trim();
    const birthDate=String(values.get("birthDate")||"").trim();
    const patient={
      id:nextPatientId(records),
      first_name:firstName,
      last_name:lastName,
      status:activateNubemo?"pending":"active",
      created_at:new Date().toISOString(),
      age:ageFromBirthDate(birthDate),
      code:nextPatientCode(records),
      email:emailValue,
      phone:String(values.get("phone")||"").trim(),
      weight:"—",
      weightDelta:"—",
      unreadDocuments:0,
      lastVisit:"—",
      nextVisit:"—",
      avatar:"assets/nubemo-n-icon-192.png",
      birthDate,
      sex:String(values.get("sex")||"").trim(),
      height:heightRaw===""?"":Number(heightRaw),
      fiscalCode:String(values.get("fiscalCode")||"").trim(),
      address:String(values.get("address")||"").trim(),
      postalCode:String(values.get("postalCode")||"").trim(),
      city:String(values.get("city")||"").trim(),
      province:String(values.get("province")||"").trim(),
      nubemoAccountStatus:activateNubemo?"pending":"inactive",
      showCaloriesToPatient:false
    };

    onCreate(patient);
    dialog.close("save");
  });

  dialog.addEventListener("close",()=>dialog.remove(),{once:true});
  dialog.showModal();
  form.elements.firstName.focus();
}
