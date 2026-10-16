import {loadLiveClinicalPdfData} from "./patient-clinical-pdf-live-service.js?v=clinical-pdf-live-20261016";
import {buildClinicalPdfData} from "./patient-clinical-pdf-model.js?v=clinical-pdf-objectives-20261016";
import {createClinicalPdf,openClinicalPdf} from "./patient-clinical-pdf.js?v=clinical-pdf-editorial-20261009";
import {professionalProfile} from "./profile-view.js";

const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
const activePathway=model=>(model.data.pathways?.items||[]).find(item=>item.status==="active")||null;

export function renderClinicalPdfAction({disabled=false}={}){
  return `<button type="button" class="detail-pdf-action" data-clinical-pdf${disabled?' disabled title="La Cartella PDF 2.0 non è ancora collegata ai dati reali."':""}>
    <svg class="icon" aria-hidden="true"><use href="#icon-document"/></svg>
    <span><strong>Cartella PDF</strong><small>Genera la cartella clinico-nutrizionale</small></span>
    <span aria-hidden="true">›</span>
  </button>`;
}

export function bindClinicalPdf(root,model,overview=null){
  root.querySelector("[data-clinical-pdf]")?.addEventListener("click",()=>openClinicalPdfDialog(root,model,overview));
}

function openClinicalPdfDialog(root,model,overview=null){
  const identity=model.data.identity;
  const hasActive=overview?overview.pathways?.some(item=>item.status==="active"):!!activePathway(model);
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
  dialog.addEventListener("close",async()=>{
    if(dialog.returnValue!=="save"){dialog.remove();return;}
    const values=new FormData(dialog.querySelector("form"));
    const diaryMode=hasActive?String(values.get("diaryMode")||"none"):"none";
    const submit=dialog.querySelector('button[type="submit"]');
    if(submit)submit.disabled=true;
    try{
      // Never use the demo model when the patient is loaded from Supabase DEV.
      const source=overview?await loadLiveClinicalPdfData(overview,{diaryMode}):model.data;
      const context=window.nubemoProfessionalContext||{};
      const profile=context.profile||{};
      const pro=context.professional||{};
      // Caricamento on demand: il PDF deve usare i dati aggiornati anche
      // quando il profilo professionista non è stato ancora aperto.
      if(profile.id && pro.id && window.nubemoSupabase){
        const client=window.nubemoSupabase;
        const [profileResult,professionalResult]=await Promise.all([
          client.from("profiles").select("first_name,last_name,email").eq("id",profile.id).single(),
          client.from("professionals").select("display_name,qualification,tax_code,vat_number,phone,address,zip,city,province").eq("id",pro.id).single()
        ]);
        if(profileResult.error||professionalResult.error)
          throw new Error("Dati professionista non disponibili per la cartella PDF.");
        Object.assign(profile,profileResult.data);
        Object.assign(pro,professionalResult.data);
      }
      const identity={
        firstName:profile.first_name||professionalProfile.firstName,
        surname:profile.last_name||professionalProfile.surname,
        displayName:pro.display_name||professionalProfile.displayName,
        qualification:pro.qualification||professionalProfile.qualification,
        taxCode:pro.tax_code||professionalProfile.taxCode,
        vat:pro.vat_number||professionalProfile.vat,
        phone:pro.phone||professionalProfile.phone,
        email:profile.email||professionalProfile.email,
        address:pro.address||professionalProfile.address,
        zip:pro.zip||professionalProfile.zip,
        city:pro.city||professionalProfile.city,
        province:pro.province||professionalProfile.province
      };
      const normalized=buildClinicalPdfData(source,identity,{diaryMode});
      const blob=createClinicalPdf(normalized);
      const safe=normalized.patient.name.replace(/[^A-Za-z0-9_-]+/g,"_")||"Paziente";
      const stamp=new Date().toISOString().slice(0,10).replace(/-/g,"");
      openClinicalPdf(blob,`Cartella_NUBEMO_${safe}_${stamp}.pdf`);
      dialog.remove();
    }catch(error){
      dialog.remove();
      const message=document.createElement("p");
      message.setAttribute("role","alert");
      message.className="detail-empty";
      message.textContent="Generazione cartella PDF non riuscita: "+(error.message||"Errore");
      root.querySelector(".detail-pdf-action")?.after(message);
      console.error("Cartella PDF Professional 2.0:",error);
    }
  },{once:true});
  dialog.showModal();
}
