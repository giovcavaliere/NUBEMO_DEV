import {calorieReviewMessage} from "./diary-calorie-review.js?v=review-20261015";
import {calorieEstimateDay,calorieEstimateText} from "./diary-calorie-engine.js?v=calorie-20261015";
// Diario Patient 2.0: DOM identico alla demo, contenuti da Supabase DEV.
const db=()=>window.nubemoSupabase;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const keys=[["breakfast","breakfast"],["snack1","morning_snack"],["lunch","lunch"],["snack2","afternoon_snack"],["dinner","dinner"]];
const labels=["Colazione","Spuntino mattina","Pranzo","Spuntino pomeriggio","Cena"];
const root=()=>document.querySelector('[data-patient-view="diary"]');
const localDate=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
const pretty=d=>new Intl.DateTimeFormat("it-IT",{day:"numeric",month:"short",year:"numeric"}).format(new Date(d+"T12:00:00"));
const quality=v=>v==="good"?"Buona":v==="partial"?"Parziale":v==="none"?"Non stimata":v||"Non stimata";
const number=s=>{const v=String(s??"").trim().replace(",",".");if(!v)return null;const n=Number(v);return Number.isFinite(n)?n:null;};
let context=null,days=[],favorites=[],active=null,editable=false,filter="",latestRequest=0;
let calorieReady=false;
const query=async q=>{const {data,error}=await q;if(error)throw error;return data;};
function toast(message){const el=document.createElement("p");el.className="patient-diary-toast";el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),2600);}
function live(panel){root().querySelectorAll("[data-diary-panel]").forEach(el=>el.hidden=el.dataset.diaryPanel!==panel);}
function setField(k,v){const el=root().querySelector('[data-diary-edit-field="'+k+'"]');if(el)el.value=v??"";}
function dayByDate(d){return days.find(x=>x.entry_date===d)||null;}
function hasMeal(d){return keys.filter(([,key])=>String(d?.[key]||"").trim()).length;}
function calorieText(d){return d?.total_kcal==null?"—":Math.round(Number(d.total_kcal)).toLocaleString("it-IT")+" kcal";}
function updateSummary(){
 const today=dayByDate(localDate());
 const head=root().querySelector(".patient-diary-date");
 if(head)head.textContent=pretty(localDate());
 const metrics=root().querySelectorAll(".patient-diary-summary-grid article strong");
 if(metrics[0])metrics[0].textContent=calorieText(today);
 if(metrics[1])metrics[1].textContent=hasMeal(today)+" / 5";
 if(metrics[2])metrics[2].textContent=today?.calorie_quality?quality(today.calorie_quality):"—";
 const status=root().querySelector(".patient-diary-progress");
 if(status)status.textContent=today?"Registrata":"Da compilare";
}
function renderHistory(){
 const list=root().querySelector(".patient-diary-history-list");
 if(!list)return;
 let visible=0;
 const html=days.filter(day=>{
  const hay=[day.entry_date,day.weight_kg,day.water,day.sweetener,day.notes,...keys.map(([,key])=>day[key])].join(" ").toLowerCase();
  return !filter||hay.includes(filter);
 }).map(day=>{
  visible++;
  const qualityValue=String(day.calorie_quality||"");
  const isGood=qualityValue==="good";
  return '<button type="button" class="patient-diary-history-row" data-diary-history-date="'+esc(day.entry_date)+'">'+
  '<span class="patient-diary-history-date"><strong>'+esc(pretty(day.entry_date))+'</strong><small>'+(day.weight_kg==null?"Peso non indicato":esc(day.weight_kg)+" kg")+'</small></span>'+
  '<span class="patient-diary-history-main"><strong>'+calorieText(day)+'</strong><small>'+hasMeal(day)+' pasti su 5</small></span>'+
  '<span class="patient-diary-confidence '+(isGood?"is-good":"is-medium")+'">'+esc(quality(qualityValue))+'</span><span class="patient-diary-chevron">›</span></button>';
 }).join("");
 list.innerHTML=html;
 const empty=root().querySelector("[data-diary-history-empty]");
 if(empty)empty.hidden=visible!==0;
}
function calorieValues(){
 const meals=Object.fromEntries(keys.map(([form])=>[form,root().querySelector('[data-diary-meal-text="'+form+'"]')?.value.trim()||""]));
 if(!calorieReady)return null;
 const total=calorieEstimateDay(meals);
 const estimate=type=>{
  const value=calorieEstimateText(meals[type]);
  return value.calculated+value.genericQuantity>0?Math.round(value.calories):null;
 };
 return {
  breakfast_kcal:estimate("breakfast"),morning_snack_kcal:estimate("snack1"),
  lunch_kcal:estimate("lunch"),afternoon_snack_kcal:estimate("snack2"),dinner_kcal:estimate("dinner"),
  total_kcal:total.calculated+total.genericQuantity>0?Math.round(total.calories):null,
  calorie_quality:total.quality,
  calorie_calculated_at:new Date().toISOString()
 };
}
function updateEnergy(){
 const calories=root().querySelector("#patientDiaryCalories");
 const label=root().querySelector("#patientDiaryQuality");
 const estimate=calorieValues();
 if(calories)calories.textContent=estimate?.total_kcal==null?"—":estimate.total_kcal.toLocaleString("it-IT")+" kcal";
 if(label)label.textContent=estimate?quality(estimate.calorie_quality):"Stima non disponibile";
}

function openEditor(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>localDate())throw Error("Seleziona una data valida, non futura.");
 const existing=dayByDate(date);
 if(existing&&existing.pathway_id!==context.activePathway)throw Error("Questa giornata appartiene a un percorso concluso ed è in sola lettura.");
 active=date;editable=true;
 const day=dayByDate(date);
 live("edit");
 const dateInput=root().querySelector("[data-diary-entry-date]");
 dateInput.max=localDate();dateInput.value=date;
 root().querySelector("[data-diary-date-display]").textContent=pretty(date);
 const header=root().querySelector('[data-diary-panel="edit"] .patient-diary-header');
 header.querySelector("h1").textContent=day?"Modifica giornata":"Aggiungi giornata";
 header.querySelector("p").textContent=pretty(date)+" · Prima le abitudini, poi i pasti.";
 header.querySelector(".patient-view-eyebrow").textContent=pretty(date);
 setField("weight",day?.weight_kg);
 setField("water",day?.water);
 setField("sweetener",day?.sweetener);
 setField("notes",day?.notes);
 root().querySelector("#patientDiaryCoffee").textContent=String(day?.coffee||0);
 keys.forEach(([field,key])=>{root().querySelector('[data-diary-meal-text="'+field+'"]').value=day?.[key]||"";});
 // Values shown only when already calculated and saved; no demo estimates.
 const bmr=root().querySelector(".patient-diary-energy-row > div:nth-child(2) strong");
 if(bmr)bmr.textContent="—";
 syncFavoriteButtons();
 updateEnergy();
}
function dialog(title,subtitle,body){
 document.querySelector(".patient-diary-overlay")?.remove();
 const el=document.createElement("div");el.className="patient-diary-overlay";
 el.innerHTML='<div class="patient-diary-dialog"><div class="patient-diary-dialog-head"><div><h3>'+esc(title)+'</h3><p>'+esc(subtitle)+'</p></div><button type="button" class="patient-diary-dialog-close">×</button></div>'+body+'</div>';
 document.body.append(el);el.querySelector(".patient-diary-dialog-close").onclick=()=>el.remove();
 el.addEventListener("click",e=>{if(e.target===el)el.remove();});return el;
}

function syncFavoriteButtons(){
 keys.forEach(([type])=>{
  const input=root().querySelector('[data-diary-meal-text="'+type+'"]');
  const button=root().querySelector('[data-diary-favorite-toggle="'+type+'"]');
  if(!button)return;
  const on=!!input?.value.trim()&&favorites.some(f=>f.meal_type===type&&f.meal_text===input.value.trim());
  button.classList.toggle("active",on);
  button.setAttribute("aria-pressed",String(on));
  button.textContent=on?"★":"☆";
 });
}
async function toggleFavorite(type){
 const input=root().querySelector('[data-diary-meal-text="'+type+'"]');
 const mealText=input?.value.trim();
 if(!mealText){toast("Scrivi prima il pasto.");return;}
 if(!context.activePathway){toast("Serve un percorso attivo.");return;}
 const existing=favorites.find(f=>f.meal_type===type&&f.meal_text===mealText);
 if(existing)await query(db().from("patient_meal_favorites").delete().eq("id",existing.id));
 else await query(db().from("patient_meal_favorites").insert({patient_id:context.patient.id,meal_type:type,meal_text:mealText}));
 await refreshFavorites();
 toast(existing?"Preferito rimosso.":"Pasto salvato nei preferiti.");
}
async function refreshFavorites(){
 favorites=await query(db().from("patient_meal_favorites").select("id,meal_type,meal_text").eq("patient_id",context.patient.id))||[];
 syncFavoriteButtons();
}
function recallFavorites(type){
 const rows=favorites.filter(f=>f.meal_type===type);
 let matched=rows;
 const result=dialog("Richiama preferito","Scegli un pasto salvato per questa tipologia.",'<input class="patient-diary-dialog-search" type="search" placeholder="Cerca…"><div class="patient-diary-dialog-list"></div>');
 const list=result.querySelector(".patient-diary-dialog-list");
 function render(){
  list.innerHTML=matched.length?matched.map(f=>'<button class="patient-diary-dialog-option" type="button" data-favorite-id="'+esc(f.id)+'"><span>★</span><strong>'+esc(f.meal_text)+'</strong><b>Usa</b></button>').join(""):'<p>Nessun preferito.</p>';
 }
 result.querySelector("input").addEventListener("input",e=>{matched=rows.filter(f=>f.meal_text.toLowerCase().includes(e.target.value.toLowerCase()));render();});
 result.addEventListener("click",e=>{
  const button=e.target.closest("[data-favorite-id]");if(!button)return;
  const chosen=rows.find(f=>f.id===button.dataset.favoriteId);
  const input=root().querySelector('[data-diary-meal-text="'+type+'"]');
  if(chosen&&input){input.value=chosen.meal_text;updateEnergy();syncFavoriteButtons();}
  result.remove();
 });
 render();
}

function openHistory(date){
 const d=dayByDate(date);if(!d)return;
 const detail=keys.map(([form,key],i)=>{
  const meal=String(d[key]||"").trim();
  if(!meal)return '<article><strong>'+labels[i]+'</strong><small>Non compilato</small></article>';
  const estimate=calorieReady?calorieEstimateText(meal):null;
  const items=estimate?.items||[];
  const details=items.map(item=>{
    const resolved=item.status==="calculated"||item.status==="genericQuantity";
    return '<div class="patient-diary-food-detail"><span>'+esc(item.label||item.segment)+'</span><span>'+esc(item.quantity||"")+'</span><strong>'+(resolved?Math.round(item.calories)+" kcal":"Non stimabile")+'</strong></div>';
  }).join("");
  return '<article><strong>'+labels[i]+'</strong><small>'+esc(meal)+'</small>'+details+'</article>';
 }).join("");
 const el=dialog(pretty(date),(d.weight_kg??"—")+" kg · "+calorieText(d),'<div class="patient-diary-history-detail">'+detail+'</div><div class="patient-diary-history-actions">'+
 (d.pathway_id===context.activePathway?'<button class="patient-secondary" type="button" data-history-edit>Modifica</button><button class="patient-secondary patient-diary-danger" type="button" data-history-delete>Elimina</button>':'<span>Giornata storica in sola lettura</span>')+'</div>');
 el.querySelector("[data-history-edit]")?.addEventListener("click",()=>{el.remove();openEditor(date);});
 el.querySelector("[data-history-delete]")?.addEventListener("click",async()=>{
  if(!confirm("Eliminare la giornata del "+pretty(date)+"?"))return;
  try{await query(db().rpc("patient2_soft_delete_own_diary_entry",{p_entry_id:d.id}));el.remove();await refresh();toast("Giornata eliminata.");}
  catch(error){alert("Eliminazione non riuscita: "+error.message);}
 });
}
async function refresh(){
 const req=++latestRequest;
 const rows=await query(db().from("diary_entries")
 .select("id,entry_date,pathway_id,weight_kg,water,coffee,sweetener,breakfast,morning_snack,lunch,afternoon_snack,dinner,notes,sport,total_kcal,calorie_quality")
 .eq("patient_id",context.patient.id).is("deleted_at",null).order("entry_date",{ascending:false}).limit(1000));
 if(req!==latestRequest)return;
 days=rows||[];updateSummary();renderHistory();
}
function showSaveReview(onConfirm){
 const meals=Object.fromEntries(keys.map(([form])=>[form,root().querySelector('[data-diary-meal-text="'+form+'"]')?.value.trim()||""]));
 const hasMeals=Object.values(meals).some(Boolean);
 if(!hasMeals){onConfirm();return;}
 const estimate=calorieReady?calorieEstimateDay(meals):null;
 const overlay=dialog("Controllo calorie","Verifica il riconoscimento dei pasti prima di registrare la giornata.",
  '<div class="patient-diary-review-message" role="status"></div><div class="patient-diary-history-actions">'+
  '<button type="button" class="patient-secondary" data-diary-review-correct>Correggi</button>'+
  '<button type="button" class="patient-primary" data-diary-review-save>Salva comunque</button></div>');
 const message=overlay.querySelector(".patient-diary-review-message");
 message.textContent=estimate?calorieReviewMessage(estimate):"Stima calorie temporaneamente non disponibile. I pasti verranno registrati senza un calcolo attendibile.";
 overlay.querySelector("[data-diary-review-correct]").addEventListener("click",()=>overlay.remove());
 overlay.querySelector("[data-diary-review-save]").addEventListener("click",()=>{
  overlay.remove();onConfirm();
 });
}

async function save(){
 if(!active||!context.activePathway)throw Error("Nessun percorso attivo disponibile.");
 if(active>localDate())throw Error("Non è possibile salvare una giornata futura.");
 const day=dayByDate(active);
 if(day&&day.pathway_id!==context.activePathway)throw Error("Le giornate di un percorso concluso non sono modificabili.");
 const field=k=>root().querySelector('[data-diary-edit-field="'+k+'"]')?.value.trim()||"";
 const weight=number(field("weight")),water=number(field("water"));
 if((weight!==null&&(weight<20||weight>400))||(water!==null&&(water<0||water>20)))throw Error("Controlla i valori di peso e acqua.");
 const data={patient_id:context.patient.id,pathway_id:context.activePathway,entry_date:active,weight_kg:weight,water,coffee:Number(root().querySelector("#patientDiaryCoffee").textContent),sweetener:field("sweetener"),notes:field("notes"),...Object.fromEntries(keys.map(([from,to])=>[to,root().querySelector('[data-diary-meal-text="'+from+'"]').value.trim()]))};
 const estimates=calorieValues();
 if(estimates)Object.assign(data,estimates);
 if(day){
  const changed=keys.some(([,key])=>data[key]!==day[key]);
  const payload={...data,...(!estimates&&changed?{total_kcal:null,calorie_quality:null,breakfast_kcal:null,morning_snack_kcal:null,lunch_kcal:null,afternoon_snack_kcal:null,dinner_kcal:null,calorie_calculated_at:null}:{})};
  const updated=await query(db().from("diary_entries").update(payload).eq("id",day.id).eq("patient_id",context.patient.id).select("id"));
  if(!updated?.length)throw Error("Modifica non autorizzata: nessuna giornata aggiornata.");
 }else{
  const inserted=await query(db().from("diary_entries").insert({...data,created_by_user_id:context.user.id}).select("id"));
  if(!inserted?.length)throw Error("La giornata non risulta salvata.");
 }
 await refresh();
 active=null;
 live("overview");
 root().scrollIntoView({behavior:"instant",block:"start"});
 toast("Giornata salvata.");
}
export async function mountPatientDiary(ctx){
 context=ctx;root().querySelectorAll("[data-diary-panel]").forEach(el=>el.hidden=true);
 const {data,error}=await db().rpc("current_active_pathway_id");
 if(error)throw error;
 context.activePathway=data||null;
 const wrapper=root();if(wrapper.dataset.liveDiaryBound!=="true"){
 wrapper.dataset.liveDiaryBound="true";
 wrapper.addEventListener("change",e=>{
  if(!e.target.matches("[data-diary-entry-date]"))return;
  const selected=e.target.value;
  if(!selected){e.target.value=active;return;}
  try{openEditor(selected);}catch(error){e.target.value=active;alert(error.message);}
 });
 wrapper.addEventListener("input",e=>{
  if(e.target.matches("[data-diary-history-search]")){filter=e.target.value.toLowerCase().trim();renderHistory();}
  if(e.target.matches("[data-diary-meal-text]")){updateEnergy();syncFavoriteButtons();}
 });
 wrapper.addEventListener("click",async e=>{
  const mode=e.target.closest("[data-patient-diary-mode]");
  if(mode){if(mode.dataset.patientDiaryMode==="overview")live("overview");else if(context.activePathway)openEditor(localDate());else alert("Non è presente un percorso attivo.");return;}
  const row=e.target.closest("[data-diary-history-date]");
  if(row){openHistory(row.dataset.diaryHistoryDate);return;}
  const fav=e.target.closest("[data-diary-favorite-toggle]");
  if(fav){try{await toggleFavorite(fav.dataset.diaryFavoriteToggle)}catch(err){alert(err.message)}return;}
  const recall=e.target.closest("[data-diary-favorite-open]");
  if(recall){recallFavorites(recall.dataset.diaryFavoriteOpen);return;}
  const coffee=e.target.closest("[data-diary-coffee]");
  if(coffee){const el=wrapper.querySelector("#patientDiaryCoffee");el.textContent=String(Math.max(0,Number(el.textContent)+Number(coffee.dataset.diaryCoffee)));return;}
  if(e.target.closest("[data-diary-save]")){
    const btn=e.target.closest("button");
    if(btn.disabled)return;
    const persist=async()=>{
      btn.disabled=true;
      const initialLabel=btn.textContent;
      btn.textContent="Salvataggio…";
      let feedback=wrapper.querySelector("[data-diary-save-feedback]");
      if(!feedback){feedback=document.createElement("p");feedback.dataset.diarySaveFeedback="";feedback.setAttribute("role","status");wrapper.querySelector(".patient-diary-save-actions").append(feedback);}
      feedback.textContent="Invio e verifica della giornata…";
      try{await save();feedback.textContent="";}
      catch(err){feedback.textContent="Salvataggio non completato: "+(err.message||"Errore sconosciuto");}
      finally{btn.disabled=false;btn.textContent=initialLabel;}
    };
    showSaveReview(persist);
  }
 });
 }
 await Promise.all([refresh(),refreshFavorites()]);
 try{
  if(!window.nubemoFoodCatalog)throw Error("Catalogo alimenti non caricato");
  await window.nubemoFoodCatalog.load(db());
  calorieReady=true;
 }catch(error){
  calorieReady=false;
  console.error("Calcolo calorie Diario Patient 2.0:",error);
 }
 live("overview");
}
