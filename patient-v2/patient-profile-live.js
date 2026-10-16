import {mountPatientHome} from "./patient-home-live.js?v=home-full-name-20261016";
import {mountPatientDiary} from "./patient-diary-live.js?v=diary-date-rebuild-20261015";
import {mountPatientDocuments} from "./patient-documents-live.js?v=documents-pathway-20261015";
// NUBEMO Patient 2.0 — Profilo live. Nessun dato demo, solo sessione paziente e Supabase DEV.
import {mountPatientPlan} from "./patient-plan-live.js?v=patient-note-20261015";
const client=window.nubemoSupabase;
const $=(q,root=document)=>root.querySelector(q);
const $$=(q,root=document)=>[...root.querySelectorAll(q)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let context=null;
let openDiaryFromHome=false;
const showError=msg=>{const p=$("[data-profile-feedback]")||document.createElement("p");p.dataset.profileFeedback="";p.textContent=msg;p.setAttribute("role","alert");p.style.color="#983c37";if(!p.isConnected)$(".patient-profile-page .patient-view-head")?.append(p);};
const field=(key,value)=>{const el=$('[data-profile-field="'+key+'"]');if(el)el.textContent=value==null||value===""?"—":String(value);};
const fmtDate=d=>d?new Date(d+"T12:00:00").toLocaleDateString("it-IT"):"—";
const fmtTime=d=>d?new Date(d).toLocaleDateString("it-IT"):"—";
function dialog(title,html){
 $(".patient-demo-modal")?.remove();
 const layer=document.createElement("div");layer.className="patient-demo-modal";
 layer.innerHTML='<div class="patient-demo-modal-card" role="dialog" aria-modal="true" aria-labelledby="patient-dialog-title"><div class="patient-demo-modal-head"><div><span class="patient-view-eyebrow">NUBEMO Patient 2.0</span><h2 id="patient-dialog-title">'+esc(title)+'</h2></div><button type="button" class="patient-demo-modal-close" aria-label="Chiudi">×</button></div>'+html+'</div>';
 document.body.append(layer);
 const close=()=>layer.remove();
 $(".patient-demo-modal-close",layer).onclick=close;
 layer.addEventListener("click",e=>{if(e.target===layer)close()});
 const key=e=>{if(e.key==="Escape"){close();document.removeEventListener("keydown",key)}};
 document.addEventListener("keydown",key);
 return layer;
}
async function load(){
 if(!client)throw Error("Connessione NUBEMO non disponibile");
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user){location.replace("index2.html");return;}
 const {data:profile,error:profileError}=await client.from("profiles").select("id,auth_user_id,role,status,first_name,last_name,email,phone,patient_avatar_path").eq("auth_user_id",user.id).single();
 if(profileError||!profile||profile.role!=="patient"||profile.status!=="active")throw Error("Account paziente non autorizzato.");
 const {data:patient,error:patientError}=await client.from("patients").select("id,profile_id,birth_date,sex,height_cm").eq("profile_id",profile.id).single();
 if(patientError||!patient)throw Error("Anagrafica paziente non disponibile.");
 const {data:docs,error:docsError}=await client.from("privacy_documents").select("id,title,version,storage_bucket,storage_path").eq("document_type","nubemo").eq("active",true).order("published_at",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).limit(1);
 if(docsError)throw docsError;
 const document=docs?.[0]||null;
 let acceptance=null;
 if(document){
  const r=await client.from("privacy_acceptances").select("status,accepted_at").eq("profile_id",profile.id).eq("privacy_document_id",document.id).maybeSingle();
  if(r.error)throw r.error;
  acceptance=r.data;
  if(acceptance?.status!=="accepted"){location.replace("privacy2.html");return;}
 }
 const r=await client.from("patient_contact_preferences").select("communications_email,reminders_email,updated_at").eq("profile_id",profile.id).maybeSingle();
 if(r.error)throw r.error;
 context={user,profile,patient,document,acceptance,prefs:r.data};
 render();
 await navigate();
}
async function renderAvatar(){
 const {profile,user}=context;
 const target=$("[data-patient-profile-avatar]");
 const initials=[profile.first_name,profile.last_name].filter(Boolean).map(x=>x.charAt(0).toUpperCase()).join("")||"PA";
 $('[data-live-patient-initials]').textContent=initials;
 const small=$("[data-live-avatar-initials]");
 if(small)small.textContent=initials;
 if(!profile.patient_avatar_path){target.innerHTML='<span data-live-avatar-initials>'+esc(initials)+'</span>';const side=$("[data-live-patient-initials]");if(side)side.textContent=initials;return;}
 const r=await client.storage.from("patient-avatars").createSignedUrl(profile.patient_avatar_path,600);
 if(r.error||!r.data?.signedUrl){showError("Foto profilo non disponibile: riprova più tardi.");return;}
 target.innerHTML='<img alt="Foto profilo">';
 target.querySelector("img").src=r.data.signedUrl;
 const sidebar=$("[data-live-patient-initials]");
 if(sidebar){sidebar.innerHTML='<img alt="">';sidebar.querySelector("img").src=r.data.signedUrl;}
}
function render(){
 const {profile,patient,document,acceptance,prefs}=context;
 $('[data-live-patient-name]').textContent=[profile.first_name,profile.last_name].filter(Boolean).join(" ")||"Paziente";
 field("first_name",profile.first_name);field("last_name",profile.last_name);
 field("birth_date",fmtDate(patient.birth_date));field("sex",patient.sex);
 field("height_cm",patient.height_cm==null?"—":String(Number(patient.height_cm).toLocaleString("it-IT"))+" cm");
 field("phone",profile.phone);field("email",profile.email);
 $('[data-patient-privacy-consent]').textContent=acceptance?.status==="accepted"?"Accettato":"Non registrato";
 $('[data-patient-privacy-updated]').textContent="Accettato il "+fmtTime(acceptance?.accepted_at)+(document?.version?" · Versione "+document.version:"");
 $('[data-patient-privacy-communications]').textContent=prefs?.communications_email?"Email":"Non attive";
 $('[data-patient-privacy-reminders]').textContent=prefs?.reminders_email?"Email":"Non attivi";
 renderAvatar().catch(e=>showError(e.message));
}
async function uploadAvatar(file){
 if(!file)return;
 if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>3*1024*1024){showError("Foto non valida. Usa JPG, PNG o WebP fino a 3 MB.");return;}
 const {profile,user}=context;
 const ext=({"image/png":"png","image/jpeg":"jpg","image/webp":"webp"})[file.type];
 const path=user.id+"/avatar."+ext;
 const result=await client.storage.from("patient-avatars").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"0"});
 if(result.error)throw result.error;
 const updated=await client.rpc("nubemo_set_own_patient_avatar",{p_path:path});
 if(updated.error)throw updated.error;
 const old=profile.patient_avatar_path;profile.patient_avatar_path=path;
 if(old&&old!==path)await client.storage.from("patient-avatars").remove([old]);
 await renderAvatar();
}
async function deleteAvatar(){
 const {profile}=context;if(!profile.patient_avatar_path)return;
 const old=profile.patient_avatar_path;
 const r=await client.rpc("nubemo_set_own_patient_avatar",{p_path:null});if(r.error)throw r.error;
 profile.patient_avatar_path=null;
 await client.storage.from("patient-avatars").remove([old]);
 await renderAvatar();
}
async function openDocument(){
 if(!context.document){showError("Non è presente un'informativa attiva.");return;}
 const popup=window.open("about:blank","_blank");if(popup)popup.opener=null;
 if(!popup){showError("Consenti l'apertura di finestre e riprova.");return;}
 const {document}=context;
 const r=await client.storage.from(document.storage_bucket).createSignedUrl(document.storage_path,300);
 if(r.error||!r.data?.signedUrl){popup.close();showError("Informativa non disponibile.");return;}
 popup.location.replace(r.data.signedUrl);
}
function editPreferences(){
 const prefs=context.prefs||{};
 const layer=dialog("Gestisci consensi",'<form class="patient-profile-consent-form" data-prefs-form><div class="patient-profile-consent-row"><div><strong>Privacy NUBEMO</strong><small>Informativa corrente già accettata; la presa visione viene registrata separatamente.</small></div><span class="patient-profile-consent-fixed">Accettata</span></div><label class="patient-profile-consent-row"><div><strong>Comunicazioni via email</strong><small>Preferenza per comunicazioni legate al percorso.</small></div><input type="checkbox" name="communications" '+(prefs.communications_email?"checked":"")+'></label><label class="patient-profile-consent-row"><div><strong>Promemoria appuntamenti</strong><small>Preferenza per i promemoria via email.</small></div><input type="checkbox" name="reminders" '+(prefs.reminders_email?"checked":"")+'></label><p class="patient-profile-privacy-copy">Le preferenze sono registrate nel tuo profilo. L\'effettivo invio dipende dalla disponibilità del servizio email.</p><button class="patient-primary" type="submit">Salva preferenze</button><p data-form-message role="status"></p></form>');
 $('form',layer).onsubmit=async e=>{
  e.preventDefault();const button=$('[type="submit"]',layer);button.disabled=true;
  const payload={profile_id:context.profile.id,communications_email:$('[name="communications"]',layer).checked,reminders_email:$('[name="reminders"]',layer).checked,updated_at:new Date().toISOString()};
  const r=await client.from("patient_contact_preferences").upsert(payload,{onConflict:"profile_id"}).select().single();
  if(r.error){$("[data-form-message]",layer).textContent=r.error.message;button.disabled=false;return;}
  context.prefs=r.data;render();layer.remove();
 };
}
function openSupport(){
 const layer=dialog("Richiedi assistenza",'<form class="patient-profile-dialog-form" data-support-form><div class="patient-profile-support-meta"><div><span>Area</span><strong>Paziente</strong></div><div><span>Versione</span><strong>NUBEMO Patient 2.0 DEV</strong></div></div><label>Tipo di richiesta<select name="type" required><option value="">Seleziona tipo</option><option>Problema tecnico</option><option>Funzione che non risponde</option><option>Dato non corretto</option><option>Problema di accesso</option><option>Problema con un documento</option><option>Problema con notifiche o email</option><option>Richiesta privacy / consensi</option><option>Chiarimento sull’app</option><option>Suggerimento o nuova funzione</option><option>Altro</option></select></label><label>Descrivi cosa è successo<textarea name="message" required placeholder="Spiega cosa stavi facendo e cosa è successo…"></textarea></label><button class="patient-primary" type="submit">Invia richiesta</button><p data-form-message role="status"></p></form>');
 $("form",layer).onsubmit=async e=>{
 e.preventDefault();const btn=$('[type="submit"]',layer);btn.disabled=true;
 const type=$('[name="type"]',layer).value;
 const description=$('[name="message"]',layer).value.trim();
 if(!type||!description){btn.disabled=false;return;}
 const r=await client.functions.invoke("send-support-email",{body:{area:"Paziente · "+type,message:description,device:navigator.userAgent.slice(0,250)}});
 if(r.error||!r.data?.ok){$("[data-form-message]",layer).textContent=r.data?.error||r.error?.message||"Invio non riuscito";btn.disabled=false;return;}
 layer.remove();dialog("Richiesta inviata",'<p class="patient-demo-message">La richiesta è stata inviata all’assistenza NUBEMO.</p>');
 };
}
async function navigate(){
 if(!context)return;
 const tab=location.hash==="#piano"?"plan":location.hash==="#documenti"?"documents":location.hash==="#diario"?"diary":location.hash==="#profilo"?"profile":"home";
 document.querySelectorAll("[data-patient-view]").forEach(view=>{view.hidden=view.dataset.patientView!==tab||tab==="home";});
 document.querySelectorAll("[data-patient-route]").forEach(link=>{
  const selected=link.dataset.patientRoute===tab;
  link.classList.toggle("active",selected);
  if(selected)link.setAttribute("aria-current","page");
  else link.removeAttribute("aria-current");
 });
 if(tab==="plan")await mountPatientPlan(context.patient.id);
 if(tab==="documents")await mountPatientDocuments(context);
 if(tab==="diary"){
  const openToday=openDiaryFromHome;openDiaryFromHome=false;
  await mountPatientDiary(context,{openToday});
 }
 if(tab==="home"){
  try{await mountPatientHome(context);document.querySelector("#patientHomeView").hidden=false;}
  catch(error){const home=document.querySelector("#patientHomeView");if(home){home.innerHTML='<div class="module" role="alert">Impossibile caricare la Home: '+esc(error.message||"Errore di lettura dati")+'. Riapri la Home per riprovare.</div>';home.hidden=false;}throw error;}
 }
}
window.addEventListener("hashchange",()=>navigate().catch(error=>showError(error.message)));
document.addEventListener("click",async e=>{
 const action=e.target.closest("[data-patient-profile-action]");
 if(action){
  if(action.dataset.patientProfileAction==="privacy-info")await openDocument();
  if(action.dataset.patientProfileAction==="privacy-consents")editPreferences();
  if(action.dataset.patientProfileAction==="support")openSupport();
 }
 if(e.target.closest("[data-patient-profile-photo-remove]")){
  if(!confirm("Rimuovere la foto profilo?"))return;
  try{await deleteAvatar()}catch(err){showError(err.message);}
 }
 if(e.target.closest(".side-user .exit,.compact-exit")){
  await client.auth.signOut({scope:"local"});location.replace("index2.html");
 }
 const route=e.target.closest("[data-patient-route]");
 if(route){
  e.preventDefault();
  const tab=route.dataset.patientRoute;
  if(tab==="diary"&&route.hasAttribute("data-patient-diary-mode"))openDiaryFromHome=true;
  if(tab==="plan"||tab==="profile"||tab==="documents"||tab==="diary"||tab==="home"){
   const hash=tab==="plan"?"#piano":tab==="documents"?"#documenti":tab==="diary"?"#diario":tab==="home"?"#home":"#profilo";
   if(location.hash!==hash)location.hash=hash;
   else await navigate();
  }else dialog("Sezione in migrazione",'<p class="patient-demo-message">Questa sezione sarà collegata ai dati reali durante i prossimi passaggi della migrazione Patient 2.0.</p>');
 }
});
document.addEventListener("change",async e=>{
 const input=e.target.closest("[data-patient-profile-photo]");
 if(!input)return;
 try{await uploadAvatar(input.files?.[0]);}catch(err){showError(err.message)}finally{input.value="";}
});
load().catch(err=>showError(err?.message||"Impossibile caricare il profilo."));
