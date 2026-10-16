import {loadLiveClinicalPdfData} from "./patient-clinical-pdf-live-service.js?v=clinical-pdf-live-20261016";
import {buildClinicalPdfData} from "./patient-clinical-pdf-model.js?v=clinical-pdf-identity-20261016";
import {createClinicalPdf,openClinicalPdf} from "./patient-clinical-pdf.js?v=clinical-pdf-cover-20261016";
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
      const owner=window.NUBEMO_PRO2_PROFILE;
      const client=window.nubemoSupabase;
      if(!owner?.id||!client)throw new Error("Sessione professionista non disponibile.");
      const {data:professional,error:professionalError}=await client.from("professionals")
        .select("id,display_name,qualification,tax_code,vat_number,phone,address,zip,city,province,logo_storage_path,status")
        .eq("profile_id",owner.id).single();
      if(professionalError||!professional||professional.status!=="active")
        throw new Error("Dati professionista non disponibili per la cartella PDF.");
      const {data:settings,error:settingsError}=await client.from("professional_settings")
        .select("settings_json").eq("professional_id",professional.id).maybeSingle();
      if(settingsError)throw new Error("Sedi professionali non disponibili per la cartella PDF.");
      const studios=Array.isArray(settings?.settings_json?.studios)?settings.settings_json.studios:[];
      const studio=studios.find(item=>item.primary)||studios[0]||null;
      let logoData=null;
      if(professional.logo_storage_path){
        const path=professional.logo_storage_path;
        if(!path.startsWith(professional.id+"/"))throw new Error("Percorso logo professionale non valido.");
        const {data:asset,error:assetError}=await client.storage.from("professional-assets").download(path);
        if(assetError)throw new Error("Logo professionale non disponibile per la cartella PDF.");
        const image=await createImageBitmap(asset);
        try{
          const canvas=document.createElement("canvas");
          const ratio=Math.min(1,640/Math.max(image.width,image.height));
          canvas.width=Math.max(1,Math.round(image.width*ratio));
          canvas.height=Math.max(1,Math.round(image.height*ratio));
          const context=canvas.getContext("2d");
          context.fillStyle="#ffffff";
          context.fillRect(0,0,canvas.width,canvas.height);
          context.drawImage(image,0,0,canvas.width,canvas.height);
          logoData={jpeg:canvas.toDataURL("image/jpeg",0.88).split(",")[1],width:canvas.width,height:canvas.height};
        }finally{image.close();}
      }
      const identity={
        firstName:owner.first_name||"",
        surname:owner.last_name||"",
        displayName:professional.display_name||[owner.first_name,owner.last_name].filter(Boolean).join(" ")||"",
        qualification:professional.qualification||"",
        taxCode:professional.tax_code||"",
        vat:professional.vat_number||"",
        phone:professional.phone||"",
        email:owner.email||"",
        address:professional.address||"",
        zip:professional.zip||"",
        city:professional.city||"",
        province:professional.province||"",
        studio:studio?{
          name:studio.name||"",
          address:studio.address||"",
          zip:studio.zip||"",
          city:studio.city||"",
          province:studio.province||""
        }:null,
        logo:logoData
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
