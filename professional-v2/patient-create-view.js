const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));

function formMarkup(){
  const sexOptions=[["","Seleziona..."],["M","Maschio"],["F","Femmina"],["X","Altro / non specificato"]];
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
        <label><span>Sesso</span><select name="sex">${sexOptions.map(([value,label])=>`<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}</select></label>
      </div>
      <div class="new-patient-row">
        <label><span>Altezza (cm)</span><input name="height" type="number" min="80" max="250" step="0.1" inputmode="decimal"></label>
      </div>
      <div class="new-patient-row">
        <label><span>Telefono</span><input name="phone" type="tel" autocomplete="tel"></label>
        <label><span>Email <b data-new-patient-email-required></b></span><input name="email" type="email" autocomplete="email" data-new-patient-email></label>
      </div>

      <div class="new-patient-account">
        <label class="new-patient-account-toggle">
          <input name="activateNubemo" type="checkbox" data-new-patient-activate disabled>
          <span>
            <strong>Attiva profilo NUBEMO</strong>
            <small>L'invio dell'invito sarà abilitato con la migrazione dell'Area Paziente 2.0.</small>
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

export function openNewPatientDialog(root,{onCreate}){
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

  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(form.dataset.saving==="1")return;
    const values=new FormData(form);
    const firstName=String(values.get("firstName")||"").trim();
    const lastName=String(values.get("lastName")||"").trim();
    const emailValue=String(values.get("email")||"").trim();
    const activateNubemo=values.get("activateNubemo")==="on";
    const fail=text=>{error.textContent=text;error.hidden=false;};
    error.hidden=true;
    if(!firstName||!lastName){fail("Nome e cognome sono obbligatori.");return;}
    if(activateNubemo&&!emailValue){fail("L'email è obbligatoria per attivare NUBEMO.");return;}
    if(emailValue&&!email.checkValidity()){fail("Indirizzo email non valido.");return;}
    const submit=form.querySelector('[type="submit"]');
    form.dataset.saving="1";submit.disabled=true;submit.textContent="Creazione in corso…";
    try{
      await onCreate({
        first_name:firstName,last_name:lastName,email:emailValue,
        phone:String(values.get("phone")||"").trim(),
        birth_date:String(values.get("birthDate")||"").trim(),
        sex:String(values.get("sex")||"").trim(),
        height_cm:String(values.get("height")||"").trim(),
        activate_patient_area:activateNubemo
      });
      dialog.close("save");
    }catch(e){fail(e.message||"Creazione paziente non riuscita.");}
    finally{delete form.dataset.saving;submit.disabled=false;submit.textContent="Crea paziente";}
  });

  dialog.addEventListener("close",()=>dialog.remove(),{once:true});
  dialog.showModal();
  form.elements.firstName.focus();
}
