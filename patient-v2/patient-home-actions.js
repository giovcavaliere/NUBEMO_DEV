// Azioni Home Patient 2.0 — solo dati reali e percorso autorizzato.
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=v=>new Intl.DateTimeFormat("it-IT",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v));
function modal(title,body){
 document.querySelector(".patient-demo-modal")?.remove();
 const layer=document.createElement("div");layer.className="patient-demo-modal";
 layer.innerHTML='<div class="patient-demo-modal-card" role="dialog" aria-modal="true"><div class="patient-demo-modal-head"><div><span class="patient-view-eyebrow">NUBEMO Patient 2.0</span><h2>'+safe(title)+'</h2></div><button type="button" class="patient-demo-modal-close" aria-label="Chiudi">×</button></div>'+body+'</div>';
 document.body.append(layer);
 layer.querySelector(".patient-demo-modal-close").onclick=()=>layer.remove();
 layer.onclick=e=>{if(e.target===layer)layer.remove()};
 return layer;
}
export function bindHomeActions({home,activePathway,nextAppointment,currentWeight,refresh}){
 const measure=home.querySelector("[data-patient-home-measures]"),details=home.querySelector("[data-patient-home-appointment]");
 if(measure){measure.disabled=!activePathway;measure.title=activePathway?"Registra peso e circonferenze":"È necessario un percorso attivo";}
 if(details){details.disabled=!nextAppointment;details.title=nextAppointment?"Visualizza la prossima visita":"Nessuna visita programmata";}
 if(home.dataset.homeActionsBound==="true")return;
 home.dataset.homeActionsBound="true";
 home.addEventListener("click",e=>{
  if(e.target.closest("[data-patient-home-appointment]")&&!details.disabled){
   const item=home.__homeAppointment;if(!item)return;
   const kind=item.appointment_type==="first"?"Prima visita":item.appointment_type==="control"?"Controllo":"Appuntamento";
   modal("Prossima visita",'<div class="patient-demo-detail"><div><span>Data e ora</span><strong>'+safe(fmt(item.starts_at))+'</strong></div><div><span>Tipo</span><strong>'+safe(kind)+'</strong></div></div>');
  }
  if(e.target.closest("[data-patient-home-measures]")&&!measure.disabled){
   const today=new Date().toLocaleDateString("sv-SE");
   const last=home.__homeWeight;
   const layer=modal("Aggiungi misure",'<form class="patient-demo-form" data-home-measure-form>'+
    '<label>Data della misurazione<input name="day" type="date" max="'+today+'" value="'+today+'" required></label>'+
    '<label>Peso (kg)<input name="weight" type="text" inputmode="decimal" placeholder="es. 107,2" value="'+(last==null?"":String(last).replace(".",","))+'"></label>'+
    '<label>Circonferenza vita (cm)<input name="waist" type="text" inputmode="decimal" placeholder="Facoltativa"></label>'+
    '<label>Circonferenza fianchi (cm)<input name="hips" type="text" inputmode="decimal" placeholder="Facoltativa"></label>'+
    '<label>Note<textarea name="notes" maxlength="2000" placeholder="Facoltative"></textarea></label>'+
    '<button type="submit" class="patient-primary">Salva misure</button><p role="alert" data-measure-error></p></form>');
   const form=layer.querySelector("form");
   form.onsubmit=async event=>{
    event.preventDefault();
    const val=name=>{const raw=form.elements[name].value.trim().replace(",",".");if(!raw)return null;const n=Number(raw);if(!Number.isFinite(n))throw Error("Valore numerico non valido: "+name);return n;};
    const submit=form.querySelector('[type="submit"]'),error=form.querySelector("[data-measure-error]");
    submit.disabled=true;
    try{
     const args={p_day:form.elements.day.value,p_weight:val("weight"),p_waist:val("waist"),p_hips:val("hips"),p_notes:form.elements.notes.value.trim()};
     const result=await window.nubemoSupabase.rpc("patient2_add_own_measurement",args);
     if(result.error)throw result.error;
     layer.remove();
     await home.__homeRefresh();
    }catch(err){error.textContent=err.message||"Salvataggio non riuscito";}
    finally{submit.disabled=false;}
   };
  }
 });
 home.__homeRefresh=refresh;
 home.__homeAppointment=nextAppointment;
 home.__homeWeight=currentWeight;
}
export function updateHomeActions(home,{nextAppointment,currentWeight,refresh}){
 home.__homeAppointment=nextAppointment;home.__homeWeight=currentWeight;home.__homeRefresh=refresh;
}
