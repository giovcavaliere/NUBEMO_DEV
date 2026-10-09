import {buildClinicalPdfData} from "./patient-clinical-pdf-model.js";
import {createClinicalPdf,openClinicalPdf} from "./patient-clinical-pdf.js";
import {professionalProfile} from "./profile-view.js";

const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const activePathway=model=>(model.data.pathways?.items||[]).find(item=>item.status==="active")||null;

export function renderClinicalPdfAction(){
  return `<button type="button" class="detail-pdf-action" data-clinical-pdf>
    <svg class="icon" aria-hidden="true"><use href="#icon-document"/></svg>
    <span><strong>Cartella PDF</strong><small>Genera la cartella clinico-nutrizionale</small></span>
    <span aria-hidden="true">›</span>
  </button>`;
}

export function bindClinicalPdf(root,model){
  root.querySelector("[data-clinical-pdf]")?.addEventListener("click",()=>openClinicalPdfDialog(root,model));
}

function openClinicalPdfDialog(root,model){
  const identity=model.data.identity;
  const hasActive=!!activePathway(model);
  const dialog=document.createElement("dialog");
  dialog.className="detail-dialog clinical-pdf-dialog";
  dialog.innerHTML=`<form method="dialog">
    <header><div><span class="clinical-pdf-eyebrow">CARTELLA PAZIENTE</span><h2>Genera Cartella PDF</h2></div><button type="button" data-close aria-label="Chiudi">×</button></header>
    <p>La cartella raccoglie i dati clinico-nutrizionali disponibili di <strong>${esc(identity.firstName)} ${esc(identity.lastName)}</strong>. Le sezioni senza dati vengono omesse o indicate come non disponibili.</p>
    <div class="clinical-pdf-summary">
      <span class="clinical-pdf-icon"><svg class="icon" aria-hidden="true"><use href="#icon-document"/></svg></span>
      <div><strong>Cartella complessiva del paziente</strong><small>${hasActive?"Comprende la situazione attuale e lo storico disponibile.":"Generabile anche senza un percorso attivo."}</small></div>
    </div>
    <label class="clinical-pdf-field">
      <span>Allega diario alimentare</span>
      <select name="diaryMode" ${hasActive?"":"disabled"}>
        <option value="none">Non includere</option>
        <option value="7">Ultimi 7 giorni</option>
        <option value="30">Ultimi 30 giorni</option>
        <option value="full">Diario completo</option>
      </select>
      <small>${hasActive?"Il diario allegato si riferisce ai dati disponibili del percorso corrente.":"Diario non disponibile: nessun percorso attivo."}</small>
    </label>
    <div class="clinical-pdf-includes">
      <span>Il PDF include automaticamente</span>
      <div><i>✓</i> Profilo paziente e percorso attuale</div>
      <div><i>✓</i> Anamnesi</div>
      <div><i>✓</i> Misure ed esami</div>
      <div><i>✓</i> Andamento peso e BIA</div>
    </div>
    <footer><button type="button" data-close>Annulla</button><button type="submit" value="save">Genera PDF</button></footer>
  </form>`;
  root.append(dialog);
  dialog.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>dialog.close()));
  dialog.addEventListener("close",()=>{
    if(dialog.returnValue==="save"){
      const values=new FormData(dialog.querySelector("form"));
      const diaryMode=hasActive?String(values.get("diaryMode")||"none"):"none";
      const normalized=buildClinicalPdfData(model.data,professionalProfile,{diaryMode});
      const blob=createClinicalPdf(normalized);
      const safe=normalized.patient.name.replace(/[^A-Za-z0-9_-]+/g,"_")||"Paziente";
      openClinicalPdf(blob,`Cartella_NUBEMO_${safe}.pdf`);
    }
    dialog.remove();
  },{once:true});
  dialog.showModal();
}
