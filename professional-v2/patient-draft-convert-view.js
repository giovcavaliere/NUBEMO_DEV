const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
export function openDraftConversion(root,draft,{onConverted}){
 const d=document.createElement("dialog");d.className="new-patient-dialog";
 d.innerHTML=`<form class="new-patient-form">
  <header class="new-patient-dialog-head"><div><h2>Completa anagrafica draft</h2><p>Gli appuntamenti già collegati saranno conservati. L'account NUBEMO non verrà attivato.</p></div><button type="button" data-close aria-label="Chiudi">×</button></header>
  <div class="new-patient-fields">
   <div class="new-patient-row"><label><span>Nome</span><input value="${esc(draft.first_name)}" readonly></label><label><span>Cognome</span><input value="${esc(draft.last_name)}" readonly></label></div>
   <div class="new-patient-row"><label><span>Telefono</span><input value="${esc(draft.phone||"")}" readonly></label><label><span>Email (facoltativa)</span><input name="email" type="email" autocomplete="email"></label></div>
   <div class="new-patient-row"><label><span>Data di nascita</span><input name="birthDate" type="date"></label><label><span>Sesso</span><select name="sex"><option value="">Non indicato</option><option value="M">Maschio</option><option value="F">Femmina</option><option value="X">Altro / non specificato</option></select></label></div>
   <div class="new-patient-row"><label><span>Altezza (cm)</span><input name="height" type="number" min="80" max="250" step="0.1"></label></div>
   <p class="new-patient-error" data-error role="alert" hidden></p>
  </div>
  <footer class="new-patient-actions"><button type="button" data-close>Annulla</button><button type="submit">Converti in paziente</button></footer>
 </form>`;
 root.append(d);
 const form=d.querySelector("form"),message=d.querySelector("[data-error]"),submit=d.querySelector('[type="submit"]');
 d.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>d.close()));
 d.addEventListener("close",()=>d.remove(),{once:true});
 form.addEventListener("submit",async event=>{
  event.preventDefault();if(!form.reportValidity()||submit.disabled)return;
  submit.disabled=true;message.hidden=true;
  const values=new FormData(form),height=String(values.get("height")||"").trim();
  try{
   const {data,error}=await window.nubemoSupabase.rpc("pro2_convert_draft_patient",{
    p_draft_id:draft.id,p_email:String(values.get("email")||"").trim()||null,
    p_birth_date:String(values.get("birthDate")||"")||null,p_sex:String(values.get("sex")||"")||null,
    p_height_cm:height===""?null:Number(height)
   });
   if(error)throw error;
   d.close();await onConverted(data);
  }catch(error){message.textContent=error.message||"Conversione non riuscita";message.hidden=false;submit.disabled=false;}
 });
 d.showModal();
}
