const SUPPORT_SECTIONS=[
  "Dashboard","Pazienti","Agenda","Scheda paziente","Esami","Piano alimentare",
  "Documenti","Diario","Andamento","Misure","Visite","Profilo professionista","Altro"
];

function escapeHtml(value=""){
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
}

export function deviceInfo(){
  const ua=navigator.userAgent||"";
  const device=/iPhone/i.test(ua)?"iPhone"
    :/iPad/i.test(ua)?"iPad"
    :/Android/i.test(ua)?"Android"
    :/Windows/i.test(ua)?"Windows PC"
    :/Macintosh/i.test(ua)?"Mac"
    :"Dispositivo non identificato";
  const browser=/Edg\//.test(ua)?"Edge"
    :/CriOS\//.test(ua)?"Chrome iOS"
    :/Chrome\//.test(ua)?"Chrome"
    :/FxiOS\//.test(ua)?"Firefox iOS"
    :/Firefox\//.test(ua)?"Firefox"
    :/Safari\//.test(ua)?"Safari"
    :"Browser non identificato";
  return `${device} · ${browser} · ${innerWidth}×${innerHeight}`;
}

export function renderSupportPage(root){
  root.innerHTML=`
    <div class="support-page">
      <header class="support-head">
        <h1>Assistenza</h1>
        <p>Segnala un problema tecnico a NUBEMO senza includere automaticamente dati dei pazienti.</p>
      </header>

      <section class="support-card">
        <div class="support-eyebrow">Supporto tecnico</div>
        <h2>Segnala un problema</h2>
        <p class="support-intro">Descrivi il problema riscontrato. La segnalazione verrà inviata direttamente all'assistenza NUBEMO, insieme alle informazioni tecniche essenziali.</p>

        <div class="support-tech">
          <span>Area</span><b>Professionista</b>
          <span>Versione</span><b>2.0</b>
          <span>Dispositivo</span><b>${escapeHtml(deviceInfo())}</b>
        </div>

        <div class="support-field">
          <label for="supportArea">Area dell'app</label>
          <select id="supportArea">
            ${SUPPORT_SECTIONS.map(section=>`<option value="${escapeHtml(section)}">${escapeHtml(section)}</option>`).join("")}
          </select>
        </div>

        <div class="support-field">
          <label for="supportMessage">Descrivi cosa è successo</label>
          <textarea id="supportMessage" rows="6" placeholder="Es. In Agenda, aprendo uno slot libero..."></textarea>
        </div>

        <div class="support-actions">
          <button class="support-send" id="sendSupport" type="button">Invia email all’assistenza</button>
        </div>

        <p class="support-feedback" id="supportFeedback" role="status" aria-live="polite"></p>

        <p class="support-privacy">Nella mail non vengono inseriti automaticamente nomi dei pazienti, dati clinici, diario o documenti.</p>
      </section>
    </div>
  `;
}

export async function sendSupport(root){
  const area=root.querySelector("#supportArea");
  const message=root.querySelector("#supportMessage");
  const button=root.querySelector("#sendSupport");
  const feedback=root.querySelector("#supportFeedback");
  const notify=(text,isError=false)=>{if(feedback){feedback.textContent=text;feedback.classList.toggle("is-error",isError);}};
  const text=(message?.value||"").trim();

  if(!text){
    notify("Descrivi brevemente il problema prima di continuare.",true);
    return;
  }

  const client=window.nubemoSupabase;
  if(!client?.functions?.invoke){
    notify("Servizio di assistenza momentaneamente non disponibile. Riprova più tardi.",true);
    return;
  }

  if(button?.dataset.nubemoSending==="1") return;
  if(text.length>5000){notify("La descrizione non può superare 5.000 caratteri.",true);return;}
  notify("Invio della segnalazione in corso…");
  if(button){
    button.dataset.nubemoSending="1";
    button.disabled=true;
    button.textContent="Invio in corso…";
  }

  try{
    const {data,error}=await client.functions.invoke("send-support-email",{
      body:{
        area:area?.value||"Altro",
        message:text,
        device:deviceInfo()
      }
    });
    if(error) throw error;
    if(!data?.ok) throw new Error(data?.error||"Invio non riuscito");
    notify(data.message||"Segnalazione inviata all’assistenza NUBEMO.");
    if(message) message.value="";
    if(area) area.selectedIndex=0;
  }catch(error){
    console.error("NUBEMO assistenza:",error);
    notify("Non è stato possibile inviare la segnalazione. Il testo è stato mantenuto: riprova più tardi.",true);
  }finally{
    if(button){
      delete button.dataset.nubemoSending;
      button.disabled=false;
      button.textContent="Invia email all’assistenza";
    }
  }
}
