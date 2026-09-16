
(function(){
'use strict';

const NUBEMO_PDF_BRAND='assets/nubemo-brand-clean-v2.png';
const NUBEMO_PDF_ICON='assets/nubemo-n-icon-192.png';
const KEY='diario-pro-patient-main-v1';
const PROFILE_KEY='diario-pro-profile-main-v1';
const MEASURE_KEY='diario-pro-measures-main-v1';
const SETTINGS_KEY='diario-pro-settings-recovery-v1';
const APPT_KEY='diario-pro-appts-recovery-v1';
const NOTES_KEY='diario-pro-notes-recovery-v1';
const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
const DEMO_MEASURES_KEY='diario-pro-demo-measures-overrides-v1';
const DELETED_PATIENTS_KEY='diario-pro-deleted-patients-v1';
const LABS_KEY='diario-pro-labs-v1',PLAN_META_KEY='diario-pro-plan-meta-v1',PLAN_DB='diario-pro-documents-v1',PLAN_STORE='plans',ACCOUNT_KEY='diario-pro-accounts-v1',PRIVACY_META_KEY='diario-pro-privacy-meta-v1',PENDING_LABS_KEY='diario-pro-pending-labs-v1';

const DOCUMENT_META_KEY='nubemo-documents-meta-v1',DOCUMENT_STORE='documents',DOCUMENT_MAX_BYTES=10*1024*1024;
function documentMetaList(){try{return JSON.parse(localStorage.getItem(DOCUMENT_META_KEY)||'[]')||[]}catch(e){return []}}
function saveDocumentMetaList(items){localStorage.setItem(DOCUMENT_META_KEY,JSON.stringify(items))}
function documentTitleFromFile(name=''){return String(name).replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim()}
function documentId(prefix='doc'){return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}
async function writeDocumentBlob(fileId,file){const db=await openPlanDb();return new Promise((res,rej)=>{const tx=db.transaction(DOCUMENT_STORE,'readwrite');tx.objectStore(DOCUMENT_STORE).put(file,fileId);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
async function readDocumentBlob(fileId){const db=await openPlanDb();return new Promise((res,rej)=>{const r=db.transaction(DOCUMENT_STORE,'readonly').objectStore(DOCUMENT_STORE).get(fileId);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
async function deleteDocumentBlob(fileId){const db=await openPlanDb();return new Promise((res,rej)=>{const tx=db.transaction(DOCUMENT_STORE,'readwrite');tx.objectStore(DOCUMENT_STORE).delete(fileId);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
async function openProfessionalDocument(id){
 const items=documentMetaList();
 const d=items.find(x=>x.id===id&&x.patientId===selected);
 if(!d)return alert('Documento non trovato.');
 const blob=await readDocumentBlob(d.fileId);
 if(!blob)return alert('File non disponibile.');

 if(d.unreadForProfessional===true){
   d.unreadForProfessional=false;
   saveDocumentMetaList(items);
 }

 const url=URL.createObjectURL(blob);
 window.location.href=url;
 setTimeout(()=>URL.revokeObjectURL(url),120000);
}

function professionalDocuments(patientId,subCategory='other'){
 return documentMetaList().filter(d=>d.patientId===patientId&&d.category==='health'&&d.subCategory===subCategory).sort((a,b)=>String(b.documentDate||b.uploadedAt).localeCompare(String(a.documentDate||a.uploadedAt)));
}
function professionalBloodTestDocuments(patientId){return professionalDocuments(patientId,'blood_test')}
function labRecordsOnDate(patientId,date){
 return labsFor(patientId).filter(x=>x.date===date);
}
function bloodTestDocumentsOnDate(patientId,date){
 return professionalBloodTestDocuments(patientId).filter(d=>d.documentDate===date);
}
function professionalOtherHealthDocuments(patientId){return professionalDocuments(patientId,'other')}
function professionalAccountingDocuments(patientId){
 return documentMetaList().filter(d=>d.patientId===patientId&&d.category==='accounting').sort((a,b)=>String(b.documentDate||b.uploadedAt).localeCompare(String(a.documentDate||a.uploadedAt)));
}
function hasUnreadProfessionalDocuments(patientId){
 return professionalOtherHealthDocuments(patientId).some(d=>d.unreadForProfessional===true);
}
function hasUnreadProfessionalBloodTests(patientId){
 return professionalBloodTestDocuments(patientId).some(d=>d.unreadForProfessional===true);
}
function hasUnreadProfessionalActivity(patientId){
 return hasUnreadProfessionalDocuments(patientId)||hasUnreadProfessionalBloodTests(patientId);
}
function patientsWithUnreadDocuments(){
 return patients().filter(p=>hasUnreadProfessionalDocuments(p.id));
}
function hasAnyUnreadProfessionalDocuments(){
 return patientsWithUnreadDocuments().length>0;
}
function markProfessionalDocumentsRead(patientId){
 const items=documentMetaList();let changed=false;
 items.forEach(d=>{if(d.patientId===patientId&&d.unreadForProfessional===true){d.unreadForProfessional=false;changed=true}});
 if(changed)saveDocumentMetaList(items);
}
function proDocuments(p){
 const docs=professionalOtherHealthDocuments(p.id),accounting=professionalAccountingDocuments(p.id);
 const healthRows=docs.length?`<div class="document-list">${docs.map(d=>`<div class="document-row ${d.unreadForProfessional===true?'document-row-unread':''}"><div><b>${esc(d.title)}${d.unreadForProfessional===true?'<span class="document-new-badge">NUOVO</span>':''}</b><span>${d.documentDate?fmt(d.documentDate):'Data non indicata'} · ${esc(d.fileName||'Documento')} · ${d.uploadedBy==='patient'?'Caricato dal paziente':'Caricato dal professionista'}</span></div><div class="document-row-actions"><button class="secondary compact" data-open-pro-document="${d.id}">Apri</button><button class="mini danger-text" data-delete-pro-document="${d.id}">Elimina</button></div></div>`).join('')}</div>`:'<p class="muted">Nessun documento sanitario caricato.</p>';
 const accountingRows=accounting.length?`<div class="document-list">${accounting.map(d=>`<div class="document-row"><div><b>${esc(d.title)}</b><span>${d.documentNumber?'N. '+esc(d.documentNumber)+' · ':''}${d.documentDate?fmt(d.documentDate):'Data non indicata'} · ${esc(d.fileName||'Documento')}</span></div><div class="document-row-actions"><button class="secondary compact" data-open-pro-document="${d.id}">Apri</button><button class="mini danger-text" data-delete-pro-document="${d.id}">Elimina</button></div></div>`).join('')}</div>`:'<p class="muted">Nessun documento contabile caricato.</p>';
 return `<section class="document-pro-section">
   <div class="section-head"><h2>Documenti sanitari</h2><span class="pill">${docs.length}</span></div>
   <p class="muted">I documenti caricati dal paziente sono consultabili qui; l’eliminazione è riservata al professionista.</p>
   <input id="proDocumentFile" type="file" accept=".pdf,application/pdf,image/*" hidden>
   <button class="primary document-pro-upload" id="chooseProDocument">＋ Carica documento sanitario</button>
   <div id="proDocumentForm" class="document-form" hidden>
     <label>File</label><div class="document-file-name" id="proDocumentFileName"></div>
     <label>Titolo documento</label><input id="proDocumentTitle">
     <label>Data documento</label>${proDateControl('proDocumentDate',today())}
     <div class="pro3-actions"><button class="primary" id="saveProDocument">Salva documento</button><button class="secondary" id="cancelProDocument">Annulla</button></div>
   </div>
   ${healthRows}
 </section>
 <section class="document-pro-section accounting-documents-section">
   <div class="section-head"><h2>Documenti contabili</h2><span class="pill">${accounting.length}</span></div>
   <p class="muted">Fatture e documenti contabili del paziente. La pubblicazione e l’eliminazione sono gestite dal professionista.</p>
   <input id="proAccountingFile" type="file" accept=".pdf,application/pdf,image/*" hidden>
   <button class="primary document-pro-upload" id="chooseProAccounting">＋ Carica documento contabile</button>
   <div id="proAccountingForm" class="document-form" hidden>
     <label>File</label><div class="document-file-name" id="proAccountingFileName"></div>
     <label>Titolo documento</label><input id="proAccountingTitle">
     <label>Numero documento</label><input id="proAccountingNumber" placeholder="Es. 125/2026">
     <label>Data documento</label>${proDateControl('proAccountingDate',today())}
     <div class="pro3-actions"><button class="primary" id="saveProAccounting">Pubblica documento</button><button class="secondary" id="cancelProAccounting">Annulla</button></div>
   </div>
   ${accountingRows}
 </section>`;
}
function bindProDocuments(){
 let selectedFile=null;
 const choose=el('chooseProDocument'),input=el('proDocumentFile'),form=el('proDocumentForm');
 if(choose&&input)choose.onclick=()=>input.click();
 if(input)input.onchange=()=>{
   const f=input.files?.[0];if(!f)return;
   if(f.size>DOCUMENT_MAX_BYTES){input.value='';return alert('Il documento supera il limite di 10 MB previsto per la demo.')}
   selectedFile=f;el('proDocumentFileName').textContent=f.name;el('proDocumentTitle').value=documentTitleFromFile(f.name);form.hidden=false;choose.hidden=true;
 };
 el('cancelProDocument')?.addEventListener('click',()=>{input.value='';selectedFile=null;form.hidden=true;choose.hidden=false});
 el('saveProDocument')?.addEventListener('click',async()=>{
   if(!selectedFile)return alert('Seleziona un file.');
   const title=(el('proDocumentTitle').value||'').trim(),date=readProDate('proDocumentDate');
   if(!title)return alert('Inserisci il titolo del documento.');
   if(!date)return alert('Inserisci una data valida.');
   const id=documentId(),fileId=documentId('file');
   try{
     await writeDocumentBlob(fileId,selectedFile);
     const items=documentMetaList();items.push({id,patientId:selected,category:'health',subCategory:'other',title,documentDate:date,fileId,fileName:selectedFile.name,mimeType:selectedFile.type||'application/octet-stream',fileSize:selectedFile.size,uploadedBy:'professional',uploadedAt:new Date().toISOString(),unreadForProfessional:false,unreadForPatient:true,documentNumber:null,validFrom:null});
     saveDocumentMetaList(items);render();
   }catch(e){console.error(e);alert('Non riesco a salvare il documento.')}
 });
 let accountingFile=null;
 const accountingChoose=el('chooseProAccounting'),accountingInput=el('proAccountingFile'),accountingForm=el('proAccountingForm');
 if(accountingChoose&&accountingInput)accountingChoose.onclick=()=>accountingInput.click();
 if(accountingInput)accountingInput.onchange=()=>{
   const f=accountingInput.files?.[0];if(!f)return;
   if(f.size>DOCUMENT_MAX_BYTES){accountingInput.value='';return alert('Il documento supera il limite di 10 MB previsto per la demo.')}
   accountingFile=f;
   el('proAccountingFileName').textContent=f.name;
   el('proAccountingTitle').value=documentTitleFromFile(f.name);
   accountingForm.hidden=false;accountingChoose.hidden=true;
 };
 el('cancelProAccounting')?.addEventListener('click',()=>{
   if(accountingInput)accountingInput.value='';
   accountingFile=null;
   if(accountingForm)accountingForm.hidden=true;
   if(accountingChoose)accountingChoose.hidden=false;
 });
 el('saveProAccounting')?.addEventListener('click',async()=>{
   if(!accountingFile)return alert('Seleziona un file.');
   const title=(el('proAccountingTitle')?.value||'').trim();
   const number=(el('proAccountingNumber')?.value||'').trim();
   const date=readProDate('proAccountingDate');
   if(!title)return alert('Inserisci il titolo del documento.');
   if(!number)return alert('Inserisci il numero del documento.');
   if(!date)return alert('Inserisci una data valida.');
   const id=documentId('accounting'),fileId=documentId('file');
   try{
     await writeDocumentBlob(fileId,accountingFile);
     const items=documentMetaList();
     items.push({id,patientId:selected,category:'accounting',subCategory:'accounting',title,documentNumber:number,documentDate:date,fileId,fileName:accountingFile.name,mimeType:accountingFile.type||'application/octet-stream',fileSize:accountingFile.size,uploadedBy:'professional',uploadedAt:new Date().toISOString(),unreadForProfessional:false,unreadForPatient:true,validFrom:null});
     saveDocumentMetaList(items);render();
   }catch(err){console.error(err);alert('Non riesco a pubblicare il documento contabile.')}
 });

}

const PATIENT_START_DATE_KEY='nubemo-patient-start-date-v1';
function patientStartDateMap(){return load(PATIENT_START_DATE_KEY,{})}
function patientStartDateFor(patientId,fallback=''){
 const map=patientStartDateMap();
 return map[patientId]||fallback||'';
}
function savePatientStartDate(patientId,date){
 const map=patientStartDateMap();
 if(date)map[patientId]=date;else delete map[patientId];
 save(PATIENT_START_DATE_KEY,map);
}
function setPatientStartDateIfEmpty(patientId,date){
 if(!patientId||!date)return;
 const p=patient(patientId);
 const current=patientStartDateFor(patientId,p?.startDate||'');
 if(current)return;
 savePatientStartDate(patientId,date);
}

const el=id=>document.getElementById(id);
const load=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const fmt=d=>{
  if(!d)return '—';
  const m=String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?`${m[3]}-${m[2]}-${m[1]}`:String(d);
};
const parseIt=s=>{
  const m=String(s||'').trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if(!m)return '';
  const iso=`${m[3]}-${m[2]}-${m[1]}`;
  const d=new Date(iso+'T12:00:00');
  if(Number.isNaN(d.getTime()))return '';
  if(d.getFullYear()!=+m[3] || d.getMonth()+1!=+m[2] || d.getDate()!=+m[1])return '';
  return iso;
};
const bmi=(w,h)=>w&&h?Number(w)/Math.pow(Number(h)/100,2):null;


const SETTINGS_DEFAULT={
 name:'',
 firstName:'',surname:'',qualification:'',
 address:'',zip:'',city:'',province:'',
 vat:'',cf:'',email:'',phone:'',
 logoData:'',
 reportWeightInterval:30,
 first:60,control:30,dayStart:'08:00',dayEnd:'19:00',workDays:5
};
const DEMOS=[];

const APPT_DEFAULT=[];

let proDiarySearch='';
let proDiaryDate='';
let view='dashboard';
let selected='main';
let selectedBmiCategory='';
let tab='summary';
let editing=null;
let eventReturnToPatient=false;
let weekDate=new Date(today()+'T12:00:00');
let proDrawerOpen=false;
let drawerPatientExpanded=false;
function isPhoneLayout(){
 const sw=Math.min(window.screen?.width||window.innerWidth,window.screen?.height||window.innerHeight);
 return sw<=600;
}
function isIPadLayout(){
 const sw=window.screen?.width||window.innerWidth;
 const sh=window.screen?.height||window.innerHeight;
 const shortSide=Math.min(sw,sh);
 const longSide=Math.max(sw,sh);
 return shortSide>600 && shortSide<=1024 && longSide<=1400;
}
function syncIPadLayoutClass(){
 document.body.classList.toggle('ipad-layout',isIPadLayout());
}
function syncIPadDrawerForOrientation(){
 if(!isIPadLayout())return;
 const landscape=window.innerWidth>window.innerHeight;

 if(landscape){
   // In landscape l'iPad usa il menu fisso: il drawer overlay deve sparire.
   proDrawerOpen=false;
   document.getElementById('proDrawer')?.classList.remove('open');
   document.getElementById('proDrawerBackdrop')?.classList.remove('open');
 }
}
function isPhoneLandscape(){
 const shortSide=Math.min(
   window.screen?.width||window.innerWidth,
   window.screen?.height||window.innerHeight
 );
 return shortSide<=600 && window.innerWidth>window.innerHeight;
}
function syncPhoneLandscapeClass(){
 document.body.classList.toggle('iphone-landscape',isPhoneLandscape());
 if(isPhoneLandscape())proDrawerOpen=true;
}



function proDateControl(id,isoValue=''){return `<div class="date-entry"><input id="${id}" inputmode="numeric" placeholder="GG-MM-AAAA" value="${isoValue?fmt(isoValue):''}"><label class="date-picker-btn">📅<input type="date" data-date-target="${id}" value="${isoValue||''}"></label></div>`}
function readProDate(id,required=false){const v=parseIt(el(id)?.value||'');if(required&&!v)alert('Inserisci una data valida nel formato GG-MM-AAAA.');return v}
function accountMapPro(){return load(ACCOUNT_KEY,{})}function accountFor(id){return accountMapPro()[id]||null}function saveAccountFor(id,v){const m=accountMapPro();if(v)m[id]=v;else delete m[id];save(ACCOUNT_KEY,m)}
function privacyMetaMap(){return load(PRIVACY_META_KEY,{})}function privacyMetaFor(id){return privacyMetaMap()[id]||null}function savePrivacyMeta(id,v){const m=privacyMetaMap();if(v)m[id]=v;else delete m[id];save(PRIVACY_META_KEY,m)}
function pendingLabs(){return load(PENDING_LABS_KEY,{})}function savePendingLabs(v){save(PENDING_LABS_KEY,v)}
function ageYears(birth){if(!birth)return null;const b=new Date(birth+'T12:00:00'),n=new Date();if(Number.isNaN(b.getTime()))return null;let a=n.getFullYear()-b.getFullYear();if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))a--;return a}
function currentPatientWeight(p){
 const items=(p.entries||p.diary||[]).filter(x=>x&&x.weight!==''&&x.weight!=null&&Number.isFinite(Number(x.weight))).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 if(items.length)return Number(items.at(-1).weight);
 if(Array.isArray(p.weights)&&p.weights.length)return Number(p.weights.at(-1)?.[1]);
 return p.last!=null?Number(p.last):null;
}
function bmrMifflin(p){const w=currentPatientWeight(p),h=Number(p.height),a=ageYears(p.birth);if(!w||!h||a==null||!['M','F'].includes(p.sex))return null;return 10*w+6.25*h-5*a+(p.sex==='M'?5:-161)}
function energyEstimate(p){const b=bmrMifflin(p),f=Number(p.activityFactor);return b&&f?b*f:null}

function professionalSettingsFromContext(){
 const ctx=window.nubemoProfessionalContext||{};
 const p=ctx.profile||{};
 const pr=ctx.professional||{};
 return {
   name:pr.display_name||'',
   firstName:p.first_name||'',
   surname:p.last_name||'',
   qualification:pr.qualification||'',
   address:pr.address||'',
   zip:pr.zip||'',
   city:pr.city||'',
   province:pr.province||'',
   vat:pr.vat_number||'',
   cf:pr.tax_code||'',
   email:p.email||'',
   phone:pr.phone||''
 };
}
function settings(){
 const local=load(SETTINGS_KEY,{});
 const remote=professionalSettingsFromContext();
 const ctx=window.nubemoProfessionalContext||{};
 const hasRemoteLogo=!!ctx.professional?.logo_storage_path;
 return {
   ...SETTINGS_DEFAULT,
   ...local,
   ...remote,
   logoData:hasRemoteLogo?(ctx.logoData||''):(local.logoData||'')
 };
}
function appointments(){
  let a=load(APPT_KEY,null);
  if(!Array.isArray(a)){a=JSON.parse(JSON.stringify(APPT_DEFAULT));save(APPT_KEY,a)}
  return a;
}

function labsFor(id){const m=load(LABS_KEY,{});return Array.isArray(m[id])?m[id]:[]}function saveLabsFor(id,r){const m=load(LABS_KEY,{});m[id]=r;save(LABS_KEY,m)}function planMetaFor(id){return load(PLAN_META_KEY,{})[id]||null}
function savePlanMeta(id,v){const m=load(PLAN_META_KEY,{});if(v)m[id]=v;else delete m[id];save(PLAN_META_KEY,m)}
function professionalPlanDocuments(patientId){
 return documentMetaList().filter(d=>d.patientId===patientId&&d.category==='plan').sort((a,b)=>String(b.validFrom||b.documentDate||b.uploadedAt).localeCompare(String(a.validFrom||a.documentDate||a.uploadedAt)));
}
function professionalPlanNote(plan){
 if(!plan)return '';
 return String(plan.professionalNote||'');
}
function saveProfessionalPlanNote(patientId,planId,note){
 const clean=String(note||'').trim();
 if(planId==='legacy-plan'){
   const meta=planMetaFor(patientId);
   if(!meta)return false;
   savePlanMeta(patientId,{...meta,professionalNote:clean});
   return true;
 }
 const items=documentMetaList();
 const plan=items.find(d=>d.id===planId&&d.patientId===patientId&&d.category==='plan');
 if(!plan)return false;
 plan.professionalNote=clean;
 saveDocumentMetaList(items);
 return true;
}
function currentProfessionalPlan(patientId,date=today()){
 const valid=professionalPlanDocuments(patientId).filter(d=>d.validFrom&&d.validFrom<=date).sort((a,b)=>String(b.validFrom).localeCompare(String(a.validFrom)));
 if(valid.length)return valid[0];
 const legacy=planMetaFor(patientId);
 return legacy?{...legacy,id:'legacy-plan',patientId,category:'plan',title:documentTitleFromFile(legacy.filename||'Piano alimentare'),validFrom:legacy.planDate||'',legacy:true}:null;
}
async function archiveLegacyPlanIfNeeded(patientId){
 const legacy=planMetaFor(patientId);if(!legacy)return false;
 const existing=professionalPlanDocuments(patientId);
 if(!existing.some(d=>d.fileName===legacy.filename&&d.validFrom===(legacy.planDate||''))){
   const data=await readPlanPdf(patientId);
   if(data){
     const fileId=documentId('file'),id=documentId('plan');
     await writeDocumentBlob(fileId,new Blob([data],{type:'application/pdf'}));
     const items=documentMetaList();
     items.push({id,patientId,category:'plan',subCategory:'meal_plan',title:documentTitleFromFile(legacy.filename||'Piano alimentare'),validFrom:legacy.planDate||today(),documentDate:legacy.planDate||today(),fileId,fileName:legacy.filename||'Piano alimentare.pdf',mimeType:'application/pdf',fileSize:data.byteLength||0,uploadedBy:'professional',uploadedAt:new Date().toISOString(),unreadForProfessional:false,unreadForPatient:false,documentNumber:null,professionalNote:String(legacy.professionalNote||'')});
     saveDocumentMetaList(items);
   }
 }
 await deletePlanPdf(patientId);savePlanMeta(patientId,null);return true;
}function openPlanDb(){return new Promise((res,rej)=>{const r=indexedDB.open(PLAN_DB,3);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(PLAN_STORE))r.result.createObjectStore(PLAN_STORE);if(!r.result.objectStoreNames.contains('privacy'))r.result.createObjectStore('privacy');if(!r.result.objectStoreNames.contains('documents'))r.result.createObjectStore('documents');if(!r.result.objectStoreNames.contains('labUploads'))r.result.createObjectStore('labUploads')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}async function writePlanPdf(id,b){const db=await openPlanDb();return new Promise((res,rej)=>{const tx=db.transaction(PLAN_STORE,'readwrite');tx.objectStore(PLAN_STORE).put(b,id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}async function readPlanPdf(id){const db=await openPlanDb();return new Promise((res,rej)=>{const r=db.transaction(PLAN_STORE,'readonly').objectStore(PLAN_STORE).get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}async function deletePlanPdf(id){const db=await openPlanDb();return new Promise((res,rej)=>{const tx=db.transaction(PLAN_STORE,'readwrite');tx.objectStore(PLAN_STORE).delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
function extraPatients(){
 return load(EXTRA_PATIENTS_KEY,[]);
}
function saveExtraPatients(v){
 save(EXTRA_PATIENTS_KEY,v);
}

function mainPatient(){
  const profile=load(PROFILE_KEY,{});
  const entries=load(KEY,[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const measures=load(MEASURE_KEY,[]);
  const weights=entries.filter(x=>x.weight!==''&&x.weight!=null).map(x=>[x.date,Number(x.weight)]);
  const first=weights[0]?.[1]??null,last=weights.at(-1)?.[1]??null;
  return {
   id:'main',
   name:[profile.name||'Paziente',profile.surname||''].filter(Boolean).join(' '),
   firstName:profile.name||'Paziente',
   surname:profile.surname||'',
   birth:profile.birth||'',
   sex:profile.sex||'',
   height:profile.height||'',
   goal:profile.goal||'',
   minWeight:profile.minWeight||'',
   maxWeight:profile.maxWeight||'',
   reasonableWeight:profile.reasonableWeight||'',
   work:profile.work||'',
   activity:profile.activity||'',
   activityFactor:profile.activityFactor||'',
   smoking:profile.smoking||'',
   alcohol:profile.alcohol||'', showEnergyValues:profile.showEnergyValues!==false, readOnly:!!profile.readOnly, diagnosis:profile.diagnosis||'', theoreticalWeight:profile.theoreticalWeight||'', bowel:profile.bowel||'', metabolism:profile.metabolism||'', feeg:profile.feeg||'', impedance:profile.impedance||'', famObesity:!!profile.famObesity, famDiabetes:!!profile.famDiabetes, famHypertension:!!profile.famHypertension, famCardiovascular:!!profile.famCardiovascular, famDyslipidemia:!!profile.famDyslipidemia, famThyroid:!!profile.famThyroid, famGestational:!!profile.famGestational, previousDiets:profile.previousDiets||'', allergies:profile.allergies||'', medications:profile.medications||'', giIssues:profile.giIssues||'', pastConditions:profile.pastConditions||'', observations:profile.observations||'', objectives:profile.objectives||'',
   entries,measures,weights,first,last,
   delta:first!=null&&last!=null?last-first:null,
   real:true
 };
}
function demoPatient(p){
  const first=p.weights[0]?.[1]??null,last=p.weights.at(-1)?.[1]??null;
  const overrides=load(DEMO_MEASURES_KEY,{});
  const measures=Array.isArray(overrides[p.id])?overrides[p.id]:(p.measures||[]);
  return {...p,measures,entries:p.diary||[],first,last,delta:first!=null&&last!=null?last-first:null,real:p.real===true};
}
function patients(){
 const deleted=new Set(load(DELETED_PATIENTS_KEY,[]));
 return [
   ...(!deleted.has('main')?[mainPatient()]:[]),
   ...DEMOS.filter(p=>!deleted.has(p.id)).map(demoPatient),
   ...extraPatients().filter(p=>!deleted.has(p.id)).map(p=>demoPatient({
     ...p,
     weights:Array.isArray(p.weights)?p.weights:[],
     diary:Array.isArray(p.diary)?p.diary:[],
     measures:Array.isArray(p.measures)?p.measures:[]
   }))
 ];
}
function patient(id){const p=patients().find(p=>p.id===id);return p?{...p,startDate:patientStartDateFor(id,p.startDate||'')}:p}
function typeLabel(t){return t==='first'?'Prima visita':t==='control'?'Controllo':'Impegno personale'}
function typeClass(t){return t==='first'?'pro-first':t==='control'?'pro-control':'pro-personal'}
function timeMin(t){const [h,m]=String(t).split(':').map(Number);return h*60+m}
function minTime(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function getMonday(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);x.setHours(12,0,0,0);return x}
function addDays(d,n){
 const x=new Date(d);
 x.setDate(x.getDate()+n);
 x.setHours(12,0,0,0);
 return x;
}
function iso(d){
 if(!(d instanceof Date) || Number.isNaN(d.getTime()))return '';
 return d.toISOString().slice(0,10);
}

function proDrawer(){
 const p=(view==='details'||view==='editProfile'||view==='patientMeasure'||view==='labForm'||view==='labReview'||view==='diaryDay')?patient(selected):null;
 const patientBranch=p?`
   <div class="drawer-group open ${drawerPatientExpanded?'expanded':''}">
     <button class="drawer-node drawer-patient-name" data-drawer-patient="${p.id}" aria-expanded="${drawerPatientExpanded?'true':'false'}">
       <span class="drawer-chevron">${drawerPatientExpanded?'⌃':'⌄'}</span><strong>${esc(p.name)}${hasUnreadProfessionalActivity(p.id)?'<span class="document-alert-inline">!</span>':''}</strong>
     </button>
     <div class="drawer-sub">
       ${[
         ['summary','Riepilogo'],
         ['anamnesis','Anamnesi'],
         ['labs',`Esami${hasUnreadProfessionalBloodTests(p.id)?'<span class="document-alert-inline">!</span>':''}`],
         ['plan','Piano'],
         ['documents',`Documenti${hasUnreadProfessionalDocuments(p.id)?'<span class="document-alert-inline">!</span>':''}`],
         ['privacy','Privacy'],
         ['account','Account'],
         ['diary','Diario'],
         ['trend','Andamento'],
         ['measures','Misure'],
         ['visits','Visite'],
         ['notes','Note']
       ].map(([k,l])=>`<button data-drawer-tab="${k}" class="${tab===k?'active':''}">${l}</button>`).join('')}
       <button data-drawer-clinical="1">Cartella PDF</button>
     </div>
   </div>`:'';

 return `<div class="pro-drawer-backdrop ${proDrawerOpen?'open':''}" id="proDrawerBackdrop"></div>
 <aside class="pro-drawer ${proDrawerOpen?'open':''}" id="proDrawer">
   <div class="drawer-head">
     <div class="drawer-brand"><img src="assets/nubemo-brand-clean-v2.png" alt=""><div><b>NUBEMO</b><span>Professional · Demo</span></div></div>
     <button class="drawer-close" id="closeProDrawer" aria-label="Chiudi"><span>×</span></button>
   </div>

   <nav class="drawer-nav">
     <button class="drawer-root ${view==='dashboard'?'active':''}" data-drawer-view="dashboard"><strong>Dashboard</strong></button>
     <button class="drawer-root ${view==='patients'||view==='details'?'active':''}" data-drawer-view="patients"><strong>Pazienti</strong></button>
     ${patientBranch}
     <button class="drawer-root ${view==='agenda'?'active':''}" data-drawer-view="agenda"><strong>Agenda</strong></button>
     <button class="drawer-root ${view==='settings'?'active':''}" data-drawer-view="settings"><strong>Profilo professionista</strong></button>
     <button class="drawer-root ${view==='support'?'active':''}" data-drawer-view="support"><span class="support-menu-icon">?</span><strong>Assistenza NUBEMO</strong></button>
     <div class="drawer-separator"></div>
     <button class="drawer-root drawer-logout" id="drawerProLogout"><strong>Esci</strong></button>
   </nav>
 </aside>`;
}
function top(title){
 return `<div class="pro3-top">
   <button class="pro-top-brand" id="openProDrawer" aria-label="Apri menu NUBEMO">
     <img src="assets/nubemo-brand-clean-v2.png" alt="">
     <div><div class="eyebrow">NUBEMO PROFESSIONAL · DEMO</div><h1>${title}</h1></div>
   </button>
 </div>${proDrawer()}`;
}
function nav(){
 return `<div class="pro3-nav desktop-pro-nav" aria-label="Navigazione professionista">
  <button data-view="dashboard" class="${view==='dashboard'?'active':''}"><i>⌂</i><span>Dashboard</span></button>
  <button data-view="patients" class="${view==='patients'?'active':''}"><i>●</i><span>Pazienti</span></button>
  <button data-view="agenda" class="${view==='agenda'?'active':''}"><i>□</i><span>Agenda</span></button>
  <button data-view="settings" class="${view==='settings'?'active':''}"><i>◉</i><span>Profilo professionista</span></button>
  <button data-view="support" class="${view==='support'?'active':''}"><i>?</i><span>Assistenza NUBEMO</span></button>
 </div>`;
}


function bmiCategoryFromValue(v){
 if(!Number.isFinite(v))return null;
 if(v<18.5)return 'Sottopeso';
 if(v<25)return 'Normopeso';
 if(v<30)return 'Sovrappeso';
 if(v<35)return 'Obesità I';
 if(v<40)return 'Obesità II';
 return 'Obesità III';
}

function bmiDashboardData(){
 const ps=patients();
 const categories=['Sottopeso','Normopeso','Sovrappeso','Obesità I','Obesità II','Obesità III'];
 const groups=Object.fromEntries(categories.map(c=>[c,[]]));
 const unavailable=[];

 ps.forEach(p=>{
   const w=p.last!=null?Number(p.last):null;
   const h=p.height?Number(p.height):null;
   const current=w&&h?bmi(w,h):null;
   const cat=bmiCategoryFromValue(current);
   if(cat)groups[cat].push({...p,currentBmi:current});
   else unavailable.push(p);
 });

 return {
   categories,
   groups,
   unavailable,
   total:categories.reduce((n,c)=>n+groups[c].length,0)
 };
}

function polarPoint(cx,cy,r,angle){
 const rad=(angle-90)*Math.PI/180;
 return {x:cx+r*Math.cos(rad),y:cy+r*Math.sin(rad)};
}
function pieSlicePath(cx,cy,r,startAngle,endAngle){
 const start=polarPoint(cx,cy,r,endAngle);
 const end=polarPoint(cx,cy,r,startAngle);
 const large=endAngle-startAngle<=180?0:1;
 return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

function bmiPieCard(){
 const data=bmiDashboardData();
 const palette=['#6aa8d8','#69b58a','#d9c85c','#e1a85b','#d98262','#b86a6a'];

 let angle=0;
 const slices=data.categories.filter(c=>data.groups[c].length>0).map(cat=>{
   const count=data.groups[cat].length;
   const pct=count/data.total;
   const start=angle;
   const end=angle+pct*360;
   angle=end;
   const color=palette[data.categories.indexOf(cat)];
   return `<path d="${pieSlicePath(50,50,42,start,end)}" fill="${color}" data-bmi-category="${cat}" style="cursor:pointer;stroke:#fff;stroke-width:1.2"></path>`;
 }).join('');

 const legend=data.categories.map((cat,i)=>{
   const count=data.groups[cat].length;
   const pct=data.total?Math.round(count/data.total*100):0;
   return `<button data-bmi-category="${cat}" style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;border:0;background:transparent;padding:6px 0;text-align:left;cursor:pointer">
     <span style="display:flex;align-items:center;gap:8px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${palette[i]}"></i>${cat}</span>
     <span style="font-size:12px;color:#6f7f86">${count} · ${pct}%</span>
   </button>`;
 }).join('');

 const patientList=selectedBmiCategory
 ? `<div style="margin-top:14px;border-top:1px solid #e6ecee;padding-top:12px">
      <div class="section-head"><h3 style="margin:0">${esc(selectedBmiCategory)}</h3><button class="mini" id="clearBmiFilter">Chiudi</button></div>
      ${(data.groups[selectedBmiCategory]||[]).map(p=>`
        <button class="pro3-patient" data-patient="${p.id}" style="width:100%;font-weight:400;margin-top:7px">
          <div class="patient-avatar">${p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
          <div>
            <span style="display:block;font-size:14px;font-weight:700;color:#34484f">${esc(p.name)}</span>
            <span style="display:block;font-size:12px;color:#7b898f;margin-top:2px">BMI ${p.currentBmi.toFixed(1).replace('.',',')}</span>
          </div>
          <span style="font-size:12px;color:#7b898f">${p.last!=null?p.last.toFixed(1).replace('.',',')+' kg':'—'}</span>
        </button>`).join('') || '<p class="muted">Nessun paziente in questa categoria.</p>'}
    </div>`
 : '';

 return `<section class="card" style="margin-top:12px">
   <div class="section-head"><h2>Distribuzione pazienti per BMI</h2><span class="pill">${data.total} con BMI</span></div>
   ${data.total?`
   <div style="display:grid;grid-template-columns:minmax(180px,240px) 1fr;gap:18px;align-items:center">
     <div style="position:relative;max-width:240px;margin:auto;width:100%">
       <svg viewBox="0 0 100 100" style="width:100%;height:auto;display:block">${slices}<circle cx="50" cy="50" r="21" fill="#fff"></circle></svg>
       <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;text-align:center">
         <div><b style="font-size:22px">${data.total}</b><small style="display:block;color:#74848b">pazienti</small></div>
       </div>
     </div>
     <div>${legend}</div>
   </div>`:'<p class="muted">Nessun BMI disponibile.</p>'}
   ${data.unavailable.length?`<p class="muted" style="margin-top:12px">${data.unavailable.length} pazient${data.unavailable.length===1?'e':'i'} senza BMI calcolabile.</p>`:''}
   ${patientList}
 </section>`;
}

function dashboard(){
 const ps=patients();
 const todays=appointments().filter(a=>a.date===today());
 const first=todays.filter(a=>a.type==='first').length;
 const controls=todays.filter(a=>a.type==='control').length;
 return `${top('Dashboard')}${nav()}${patients().some(p=>hasUnreadProfessionalBloodTests(p.id))?`<button class="document-dashboard-alert analysis-dashboard-alert" id="openUnreadLabPatients"><span class="document-alert-dot">!</span><span>Alcuni tuoi pazienti hanno pubblicato nuove analisi del sangue</span><b>Apri pazienti ›</b></button>`:''}${hasAnyUnreadProfessionalDocuments()?`<button class="document-dashboard-alert" id="openUnreadPatients"><span class="document-alert-dot">!</span><span>Alcuni tuoi pazienti hanno pubblicato nuovi documenti</span><b>Apri pazienti ›</b></button>`:''}
 <div class="pro3-kpis">
   <div><span>Pazienti attivi</span><b>${ps.length}</b></div>
   <div><span>Appuntamenti oggi</span><b>${todays.filter(a=>a.type!=='personal').length}</b></div>
   <div class="kpi-first"><span>Prime visite oggi</span><b>${first}</b></div>
   <div class="kpi-control"><span>Controlli oggi</span><b>${controls}</b></div>
 </div>
 <div class="pro3-two">
  <section class="card"><div class="section-head"><h2>Agenda di oggi</h2><button class="mini" id="goAgenda">Vedi agenda</button></div>
   ${todays.length?todays.map(eventRow).join(''):'<p class="muted">Nessun evento oggi.</p>'}
  </section>
  <section class="card"><div class="section-head"><h2>Riepilogo studio</h2><span class="pill">Settimana corrente</span></div>
   ${studioSummaryChart()}
  </section>
 </div>
 ${bmiPieCard()}`;
}
function eventRow(a){
 const p=a.patientId?patient(a.patientId):null;
 return `<button class="pro3-event ${typeClass(a.type)}" data-event="${a.id}">
  <b>${a.time}</b><span>${a.type==='personal'?esc(a.title||'Impegno personale'):esc(p?.name||'Paziente')} · ${typeLabel(a.type)} · ${a.duration} min</span>
 </button>`;
}


function studioSummaryChart(){
 const s=settings();
 const monday=getMonday(new Date(today()+'T12:00:00'));
 const count=Number(s.workDays)===6?6:5;
 const days=Array.from({length:count},(_,i)=>addDays(monday,i));
 const data=days.map(d=>{
   const date=iso(d);
   return {
     date,
     label:d.toLocaleDateString('it-IT',{weekday:'long'}),
     first:appointments().filter(a=>a.date===date&&a.type==='first').length,
     control:appointments().filter(a=>a.date===date&&a.type==='control').length
   };
 });
 const max=Math.max(1,...data.map(x=>x.first+x.control));
 const totalFirst=data.reduce((n,x)=>n+x.first,0);
 const totalControl=data.reduce((n,x)=>n+x.control,0);
 const cols=data.map(x=>{
   const fh=(x.first/max)*110, ch=(x.control/max)*110;
   return `<div style="flex:1;min-width:38px;text-align:center">
     <div style="height:120px;display:flex;align-items:flex-end;justify-content:center;gap:3px">
       <i title="Prime visite: ${x.first}" style="display:block;width:14px;height:${fh}px;min-height:${x.first?5:0}px;background:#e4b93f;border-radius:5px 5px 2px 2px"></i>
       <i title="Controlli: ${x.control}" style="display:block;width:14px;height:${ch}px;min-height:${x.control?5:0}px;background:#65a96a;border-radius:5px 5px 2px 2px"></i>
     </div>
     <b style="display:block;text-transform:capitalize;font-size:12px">${x.label}</b>
     <small style="color:#71818a">${x.first+x.control} visite</small>
   </div>`;
 }).join('');
 return `<div style="display:flex;gap:8px;align-items:flex-end;overflow-x:auto;padding:8px 0">${cols}</div>
 <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:#657780">
   <span><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#e4b93f;margin-right:5px"></i>Prime visite: <b>${totalFirst}</b></span>
   <span><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#65a96a;margin-right:5px"></i>Controlli: <b>${totalControl}</b></span>
 </div>
 <p class="muted">Si aggiorna automaticamente dagli appuntamenti dell'Agenda della settimana corrente.</p>`;
}

function patientsPage(){
 const all=patients();
 const visible=all.filter(p=>{
   const searchOk=!patientSearchText||p.name.toLowerCase().includes(patientSearchText.toLowerCase());
   const unreadOk=!patientsUnreadOnly||hasUnreadProfessionalActivity(p.id);
   return searchOk&&unreadOk;
 });
 return `${top('Pazienti')}${nav()}
 <section class="card"><div class="section-head"><h2>Anagrafiche</h2><button class="mini" id="newPatient">＋ Nuovo paziente</button></div>
 <div class="patient-list-tools">
   <input id="searchPatient" type="search" placeholder="Cerca paziente..." value="${esc(patientSearchText)}">
   <label class="patient-unread-filter"><input id="filterUnreadPatients" type="checkbox" ${patientsUnreadOnly?'checked':''}><span>Solo con documenti da leggere</span>${patientsUnreadOnly?`<b>${visible.length}</b>`:''}</label>
 </div>
 <div class="pro3-patients">${visible.map(p=>{
   const delta=p.delta!=null?(p.delta>0?'+':'')+p.delta.toFixed(1).replace('.',',')+' kg':'—';
   const isDraft=p._draft===true||p.relationshipStatus==='draft';
   return `<button data-patient="${p.id}" class="pro3-patient" style="font-weight:400">
     <div class="patient-avatar">${p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
     <div>
       <span style="display:block;font-size:15px;font-weight:700;color:#34484f">${esc(p.name)}${hasUnreadProfessionalActivity(p.id)?'<span class="document-alert-inline">!</span>':''}</span>
       <span style="display:block;margin-top:3px;font-size:12px;color:#7b898f">${isDraft?'Paziente non ancora attivo':p.last!=null?'Ultimo peso '+p.last.toFixed(1).replace('.',',')+' kg':'Dati non disponibili'}</span>
       ${isDraft?'<span class="pro3-draft-badge">Anagrafica parziale</span>':''}
     </div>
     <span style="font-size:12px;font-weight:600;color:${p.delta<0?'#3d8b69':p.delta>0?'#a66a45':'#7b898f'}">${delta}</span>
   </button>`;
 }).join('')||`<div class="patient-filter-empty"><b>Nessun paziente trovato</b><span>${patientsUnreadOnly?'Non ci sono pazienti con documenti da leggere.':'Modifica i criteri di ricerca.'}</span></div>`}</div></section>`;
}



let patientsUnreadOnly=false;
let patientSearchText='';

let proTrendDays=30;
let proBmiDays=30;
let proShowMovingAverage=true;

function proBmiLabel(v){
  if(!Number.isFinite(v))return '';
  if(v<18.5)return 'Sottopeso';
  if(v<25)return 'Normopeso';
  if(v<30)return 'Sovrappeso';
  if(v<35)return 'Obesità I';
  if(v<40)return 'Obesità II';
  return 'Obesità III';
}

function proFilteredByDays(items,days){
  let a=[...items];
  if(days&&a.length){
    const end=new Date(a.at(-1).date+'T12:00:00');
    const start=new Date(end); start.setDate(end.getDate()-(days-1));
    a=a.filter(x=>new Date(x.date+'T12:00:00')>=start);
  }
  return a;
}

function proMovingAverageSeries(items,windowSize=7){
  const w=items.filter(x=>x.weight!=='');
  return w.map((x,i)=>{
    const slice=w.slice(Math.max(0,i-windowSize+1),i+1);
    const avg=slice.reduce((s,r)=>s+Number(r.weight),0)/slice.length;
    return {...x,avg};
  });
}

function proWeightChart(items,days){
  let w=proFilteredByDays(items.filter(x=>x.weight!==''),days);
  if(!w.length)return '<p class="muted">Nessun peso registrato.</p>';

  const avgSeries=proMovingAverageSeries(items).filter(x=>w.some(y=>y.date===x.date));
  let vals=w.map(x=>+x.weight);
  if(proShowMovingAverage) vals.push(...avgSeries.map(x=>x.avg));
  const rawMin=Math.min(...vals),rawMax=Math.max(...vals);
  const pad=Math.max(.5,(rawMax-rawMin)*.12);
  let min=Math.floor((rawMin-pad)*2)/2;
  let max=Math.ceil((rawMax+pad)*2)/2;
  if(max===min)max=min+1;
  const range=max-min,left=31,right=156,top=7,bottom=60,dateY=75;
  const xFor=(date)=>{
    const idx=w.findIndex(x=>x.date===date);
    return w.length===1?(left+right)/2:left+idx/(w.length-1)*(right-left);
  };
  const yFor=v=>bottom-((v-min)/range)*(bottom-top);
  const pts=w.map(x=>`${xFor(x.date).toFixed(2)},${yFor(+x.weight).toFixed(2)}`).join(' ');
  const avgPts=avgSeries.map(x=>`${xFor(x.date).toFixed(2)},${yFor(x.avg).toFixed(2)}`).join(' ');
  const ticks=Array.from({length:5},(_,i)=>max-(range/4)*i);
  const grid=ticks.map(v=>{
    const y=yFor(v);
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid"/><text x="${left-4}" y="${y}" text-anchor="end" dominant-baseline="middle" class="chart-y-label">${v.toFixed(1).replace('.',',')}</text>`;
  }).join('');
  const startLabel=fmt(w[0].date).replace(/^[^ ]+ /,'');
  const endLabel=fmt(w.at(-1).date).replace(/^[^ ]+ /,'');
  return `<div class="chart-wrap"><svg class="chart responsive-chart" viewBox="0 0 160 80" preserveAspectRatio="none">${grid}<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" class="chart-axis"/><line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="chart-axis"/><polyline points="${pts}" class="chart-line" fill="none" vector-effect="non-scaling-stroke"/>${w.map(x=>`<circle cx="${xFor(x.date)}" cy="${yFor(+x.weight)}" r="0.8" class="chart-point" vector-effect="non-scaling-stroke"/>`).join('')}${proShowMovingAverage&&avgPts?`<polyline points="${avgPts}" class="chart-average" fill="none" vector-effect="non-scaling-stroke"/>`:''}<text x="${left}" y="${dateY}" text-anchor="start" class="chart-x-label">${startLabel}</text><text x="${right}" y="${dateY}" text-anchor="end" class="chart-x-label">${endLabel}</text></svg><span class="chart-unit-fixed">kg</span></div>`;
}

function proBmiChart(items,days,height){
  if(!height)return '<p class="muted">Inserisci l’altezza nel Profilo per calcolare il BMI.</p>';
  let data=items.filter(x=>x.weight!=='').map(x=>({...x,bmi:bmi(x.weight,height)})).filter(x=>Number.isFinite(x.bmi));
  data=proFilteredByDays(data,days);
  if(!data.length)return '<p class="muted">Nessun dato BMI disponibile.</p>';

  const vals=data.map(x=>x.bmi);
  const rawMin=Math.min(...vals),rawMax=Math.max(...vals);
  const pad=Math.max(.4,(rawMax-rawMin)*.12);
  let min=Math.floor((rawMin-pad)*2)/2;
  let max=Math.ceil((rawMax+pad)*2)/2;
  if(max===min)max=min+1;
  const range=max-min,left=31,right=156,top=7,bottom=60,dateY=75;
  const xFor=i=>data.length===1?(left+right)/2:left+i/(data.length-1)*(right-left);
  const yFor=v=>bottom-((v-min)/range)*(bottom-top);
  const pts=data.map((x,i)=>`${xFor(i).toFixed(2)},${yFor(x.bmi).toFixed(2)}`).join(' ');
  const ticks=Array.from({length:5},(_,i)=>max-(range/4)*i);
  const grid=ticks.map(v=>{
    const y=yFor(v);
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid"/><text x="${left-4}" y="${y}" text-anchor="end" dominant-baseline="middle" class="chart-y-label">${v.toFixed(1).replace('.',',')}</text>`;
  }).join('');
  const startLabel=fmt(data[0].date).replace(/^[^ ]+ /,'');
  const endLabel=fmt(data.at(-1).date).replace(/^[^ ]+ /,'');
  return `<div class="chart-wrap"><svg class="chart responsive-chart" viewBox="0 0 160 80" preserveAspectRatio="none">${grid}<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" class="chart-axis"/><line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="chart-axis"/><polyline points="${pts}" class="chart-bmi-line" fill="none" vector-effect="non-scaling-stroke"/>${data.map((x,i)=>`<circle cx="${xFor(i)}" cy="${yFor(x.bmi)}" r="0.8" class="chart-bmi-point" vector-effect="non-scaling-stroke"/>`).join('')}<text x="${left}" y="${dateY}" text-anchor="start" class="chart-x-label">${startLabel}</text><text x="${right}" y="${dateY}" text-anchor="end" class="chart-x-label">${endLabel}</text></svg><span class="chart-unit-fixed">BMI</span></div>`;
}

function proTrendContent(p){
  const all=clinicalWeightSeries(p).map(x=>({date:x.date,weight:Number(x.weight)})).filter(x=>Number.isFinite(x.weight)).sort((a,b)=>a.date.localeCompare(b.date));
  const first=all[0],last=all.at(-1),delta=first&&last?last.weight-first.weight:null;
  const currentBmi=last&&p.height?bmi(last.weight,p.height):null;

  return `<section class="card chart-card"><div class="section-head"><h2>Peso</h2><label class="toggle"><input id="proMovingAverage" type="checkbox" ${proShowMovingAverage?'checked':''}><span>Media 7 gg</span></label></div><div class="tabs">${[[7,'7 giorni'],[30,'30 giorni'],[90,'3 mesi'],[0,'Tutto']].map(([n,l])=>`<button data-pro-trend="${n}" class="${proTrendDays===n?'active':''}">${l}</button>`).join('')}</div>${proWeightChart(all,proTrendDays)}</section>
  <section class="card summary"><div class="section-head"><h2>Riepilogo peso</h2><span class="pill">Totale</span></div>${first?`<div class="stats"><div><span>Peso iniziale</span><b>${first.weight.toFixed(1).replace('.',',')} kg</b></div><div><span>Ultimo peso</span><b>${last.weight.toFixed(1).replace('.',',')} kg</b></div><div><span>Variazione</span><b class="${delta<0?'good':delta>0?'up':''}">${delta>0?'+':''}${delta.toFixed(1).replace('.',',')} kg</b></div></div>`:'<p class="muted">Nessun dato.</p>'}</section>
  <section class="card chart-card"><div class="section-head"><h2>BMI</h2>${currentBmi?`<span class="pill">${currentBmi.toFixed(1).replace('.',',')} · ${proBmiLabel(currentBmi)}</span>`:'<span class="pill">Profilo</span>'}</div><div class="tabs">${[[7,'7 giorni'],[30,'30 giorni'],[90,'3 mesi'],[0,'Tutto']].map(([n,l])=>`<button data-pro-bmi="${n}" class="${proBmiDays===n?'active':''}">${l}</button>`).join('')}</div>${proBmiChart(all,proBmiDays,p.height)}</section>`;
}



function proAscii(s){
 return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x20-\x7E]/g,' ');
}
function proPdfEscape(s){
 return proAscii(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
}
function proWrapCell(text,maxChars){
 let t=proAscii(text).replace(/\s+/g,' ').trim();
 if(!t)return [''];
 let words=t.split(' '),lines=[],line='';
 words.forEach(w=>{
   let next=line?line+' '+w:w;
   if(next.length>maxChars&&line){lines.push(line);line=w}else line=next;
 });
 if(line)lines.push(line);
 return lines;
}
function proDiaryEntriesForPeriod(p,period='all'){
 const entries=(p.entries||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 if(period==='all')return entries;
 const days=period==='7'?7:period==='30'?30:period==='90'?90:null;
 if(!days)return entries;
 const end=today();
 const startDate=new Date(end+'T12:00:00');
 startDate.setDate(startDate.getDate()-(days-1));
 const start=startDate.toISOString().slice(0,10);
 return entries.filter(x=>x.date>=start&&x.date<=end);
}
function proDiaryPdfRows(p,period='all'){
 return proDiaryEntriesForPeriod(p,period).map(x=>[
   fmt(x.date),
   x.weight===''||x.weight==null?'':Number(x.weight).toFixed(1).replace('.',','),
   x.water===''||x.water==null?'':Number(x.water).toFixed(1).replace('.',','),
   x.coffee===''||x.coffee==null?'':String(x.coffee),
   x.sweetener||'',
   x.breakfast||'',
   x.snack1||'',
   x.lunch||'',
   x.snack2||'',
   x.dinner||'',
   x.notes||''
 ]);
}
function proDiaryPdfBlob(p,period='all'){
 const rows=proDiaryPdfRows(p,period);
 return window.NubemoDiaryPdf.create({rows,origin:'professional'});
}
function exportProDiaryPdf(period='all'){
 const p=patient(selected);
 if(!p || !(p.entries||[]).length)return alert('Non ci sono giornate da esportare.');
 const rows=proDiaryPdfRows(p,period);
 if(!rows.length)return alert('Non ci sono giornate registrate nel periodo selezionato.');
 try{
  const blob=proDiaryPdfBlob(p,period),url=URL.createObjectURL(blob),a=document.createElement('a');
  const safeName=String(p.name||'Paziente').replace(/[^A-Za-z0-9_-]+/g,'_');
  a.href=url;
  a.download=`Diario_${safeName}_${rows[0][0].replace(/-/g,'')}_${rows.at(-1)[0].replace(/-/g,'')}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
 }catch(err){console.error('PDF diario professionista',err);alert('Non riesco a generare il PDF del diario.');}
}
function openProDiaryExportDialog(){
 const p=patient(selected);if(!p)return;
 document.getElementById('diaryExportOverlay')?.remove();
 const o=document.createElement('div');
 o.id='diaryExportOverlay';o.className='clinical-overlay';
 o.innerHTML=`<section class="clinical-modal diary-export-modal">
   <button class="monubi-x" id="closeDiaryExport" type="button">×</button>
   <div class="eyebrow">DIARIO PAZIENTE</div>
   <h2>Esporta PDF</h2>
   <p class="muted">Scegli il periodo del diario di ${esc(p.name)} da includere nel PDF.</p>
   <div class="diary-period-options">
     <button type="button" data-diary-export-period="7"><b>Ultimi 7 giorni</b><span>Da oggi ai 6 giorni precedenti</span></button>
     <button type="button" data-diary-export-period="30"><b>Ultimo mese</b><span>Ultimi 30 giorni</span></button>
     <button type="button" data-diary-export-period="90"><b>Ultimi 3 mesi</b><span>Ultimi 90 giorni</span></button>
     <button type="button" data-diary-export-period="all"><b>Tutto</b><span>Intero storico disponibile</span></button>
   </div>
 </section>`;
 document.body.appendChild(o);
 el('closeDiaryExport').onclick=()=>o.remove();
 o.addEventListener('click',e=>{if(e.target===o)o.remove()});
 o.querySelectorAll('[data-diary-export-period]').forEach(b=>b.addEventListener('click',()=>{
   const period=b.dataset.diaryExportPeriod;o.remove();exportProDiaryPdf(period);
 }));
}
function proDiaryHistory(p){
 const q=proDiarySearch.trim().toLowerCase();
 const history=(p.entries||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).filter(x=>
   !q || [x.date,x.breakfast,x.snack1,x.lunch,x.snack2,x.dinner,x.notes,x.sweetener,String(x.weight),String(x.water),String(x.coffee)].join(' ').toLowerCase().includes(q)
 );

 return `<div class="section-head"><h2>Storico</h2><div class="head-actions"><button class="mini" id="exportProDiaryPdf">↓ Esporta PDF</button></div></div>
 <div class="search-wrap"><input id="proDiarySearch" type="search" placeholder="Cerca nello storico…" value="${esc(proDiarySearch)}"></div>
 ${history.map(x=>{
   const w=x.weight!==''&&x.weight!=null?Number(x.weight):null;
   const b=w!=null&&p.height?bmi(w,p.height):null;
   return `<div class="listitem" data-pro-diary-day="${x.date}" style="cursor:pointer">
     <span>
       <b>${fmt(x.date)}</b>
       <small>${new Date(x.date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long'})}</small>
     </span>
     <div class="history-right">
       <b>${w!=null?w.toFixed(1).replace('.',',')+' kg':'—'}</b>
       ${x.water!==''&&x.water!=null?`<small>💧 ${Number(x.water).toFixed(1).replace('.',',')} L acqua</small>`:''}
       ${b!=null?`<small>BMI ${b.toFixed(1).replace('.',',')}</small>`:''}
       ${(()=>{const ce=calorieEstimateDay(x);return ce.calculated?`<small>${ce.calories} kcal · stima ${ce.qualityLabel.toLowerCase()}</small>`:''})()}
     </div>
   </div>`;
 }).join('')||'<p class="muted">Nessuna giornata trovata.</p>'}`;
}


function proDiaryDayView(){
 const p=patient(selected);
 if(!p)return `${top('Paziente non trovato')}`;

 const d=(p.entries||[]).find(x=>x.date===proDiaryDate);
 if(!d)return `${top('Giornata non trovata')}<button class="pro3-back" id="backDiary">‹ Torna al diario</button>`;

 const weight=d.weight!==''&&d.weight!=null?Number(d.weight):null;
 const currentBmi=weight!=null&&p.height?bmi(weight,p.height):null;

 return `${top('Dettaglio diario')}
 <button class="pro3-back" id="backDiary">‹ Torna al diario</button>

 <section class="card">
   <div class="section-head">
     <div><div class="eyebrow">GIORNATA</div><h2>${fmt(d.date)}</h2></div>
     <span class="pill">Sola lettura</span>
   </div>
   <p class="muted">Il diario è compilato dal paziente. Il professionista può consultarlo ma non modificarlo.</p>

   <div class="pro3-detail">
     <div><span>Peso</span><b>${weight!=null?weight.toFixed(1).replace('.',',')+' kg':'—'}</b></div>
     <div><span>BMI</span><b>${currentBmi!=null?currentBmi.toFixed(1).replace('.',','):'—'}</b></div>
     <div class="water-detail"><span>Acqua bevuta</span><b>${d.water!==''&&d.water!=null?Number(d.water).toFixed(1).replace('.',',')+' L':'—'}</b></div>
     <div><span>Caffè</span><b>${d.coffee!==''&&d.coffee!=null?esc(d.coffee):'—'}</b></div>
     <div><span>Zucchero / dolcificante</span><b>${esc(d.sweetener||'—')}</b></div>
     <div><span>Calorie stimate</span><b>${dayEstimatedCalories(d)?dayEstimatedCalories(d)+' kcal':'—'}</b><small>${calorieEstimateDay(d).calculated?'Stima '+calorieEstimateDay(d).qualityLabel.toLowerCase():''}</small></div>
   </div>
 </section>

 <section class="card">
   <h2>Alimentazione</h2>
   <div class="pro3-day">
     <p><strong>Colazione:</strong> ${esc(d.breakfast||'—')}</p>
     <p><strong>Spuntino mattina:</strong> ${esc(d.snack1||'—')}</p>
     <p><strong>Pranzo:</strong> ${esc(d.lunch||'—')}</p>
     <p><strong>Spuntino pomeriggio:</strong> ${esc(d.snack2||'—')}</p>
     <p><strong>Cena:</strong> ${esc(d.dinner||'—')}</p>
     <p><strong>Sport / Note:</strong> ${esc(d.notes||'—')}</p>
   </div>
 </section>`;
}


function clinicalWeightSeries(p){
 const byDate=new Map();
 (p.entries||p.diary||[]).forEach(x=>{
   if(x&&x.date&&x.weight!==''&&x.weight!=null&&Number.isFinite(Number(x.weight)))byDate.set(x.date,Number(x.weight));
 });
 (p.weights||[]).forEach(x=>{
   if(Array.isArray(x)&&x[0]&&Number.isFinite(Number(x[1]))&&!byDate.has(x[0]))byDate.set(x[0],Number(x[1]));
 });
 return [...byDate.entries()].map(([date,weight])=>({date,weight})).sort((a,b)=>a.date.localeCompare(b.date));
}
function clinicalFilterDays(items,days){
 if(!days||!items.length)return [...items];
 const end=new Date(items.at(-1).date+'T12:00:00');
 const start=new Date(end);start.setDate(end.getDate()-(days-1));
 return items.filter(x=>new Date(x.date+'T12:00:00')>=start);
}
function dateDiffDays(a,b){return Math.round(Math.abs(new Date(a+'T12:00:00')-new Date(b+'T12:00:00'))/86400000)}
function clinicalIntervalWeights(p,interval){
 const a=clinicalWeightSeries(p);if(a.length<=2)return a;
 interval=Math.max(1,Number(interval)||30);
 const first=a[0],last=a.at(-1),out=[first];
 let target=new Date(first.date+'T12:00:00');
 const lastD=new Date(last.date+'T12:00:00');
 while(true){
   target=new Date(target);target.setDate(target.getDate()+interval);
   if(target>=lastD)break;
   const targetIso=target.toISOString().slice(0,10);
   let best=a[0],bestDiff=Infinity;
   a.forEach(x=>{const d=dateDiffDays(x.date,targetIso);if(d<bestDiff){best=x;bestDiff=d}});
   if(!out.some(x=>x.date===best.date))out.push(best);
 }
 if(!out.some(x=>x.date===last.date))out.push(last);
 return out.sort((a,b)=>a.date.localeCompare(b.date));
}
function clinicalDialog(){
 const p=patient(selected);if(!p)return;
 const interval=30;
 const old=document.getElementById('clinicalPdfOverlay');if(old)old.remove();
 const o=document.createElement('div');o.id='clinicalPdfOverlay';o.className='clinical-overlay';
 o.innerHTML=`<section class="clinical-modal">
   <button class="monubi-x" id="closeClinicalPdf" type="button">×</button>
   <div class="eyebrow">CARTELLA PAZIENTE</div>
   <h2>Genera PDF di ${esc(p.name)}</h2>
   <p class="muted">La cartella raccoglie i dati clinico-nutrizionali realmente presenti nella scheda. Le sezioni vuote non vengono stampate.</p>

   <label>Diario / storico peso da allegare</label>
   <select id="clinicalDiaryMode">
     <option value="none">Non includere</option>
     <option value="weight">Diario sintetico – solo peso rilevato</option>
     <option value="7">Diario – ultimi 7 giorni</option>
     <option value="30">Diario – ultimi 30 giorni</option>
     <option value="full">Diario completo</option>
   </select>

   <div id="clinicalWeightIntervalWrap" class="clinical-option-box">
     <label>Intervallo storico peso sintetico (giorni)</label>
     <input id="clinicalWeightInterval" type="number" min="1" max="365" step="1" value="${interval}">
     <small>Usato solo per “Diario sintetico – solo peso rilevato”.</small>
   </div>

   <div class="clinical-actions"><button class="secondary" id="cancelClinicalPdf">Annulla</button><button class="primary" id="createClinicalPdf">Genera cartella PDF</button></div>
 </section>`;
 document.body.appendChild(o);
 const syncMode=()=>{el('clinicalWeightIntervalWrap').style.display=el('clinicalDiaryMode').value==='weight'?'block':'none'};
 el('clinicalDiaryMode').onchange=syncMode;syncMode();
 el('closeClinicalPdf').onclick=el('cancelClinicalPdf').onclick=()=>o.remove();
 el('createClinicalPdf').onclick=async()=>{
   const b=el('createClinicalPdf');
   const interval=Math.max(1,Math.min(365,+el('clinicalWeightInterval').value||30));
   const diaryMode=el('clinicalDiaryMode').value||'none';
   b.disabled=true;b.textContent='Generazione…';
   try{await exportClinicalPdf(p,{interval,diaryMode});o.remove()}
   catch(e){console.error(e);alert('Non riesco a generare la cartella PDF.');b.disabled=false;b.textContent='Genera cartella PDF'}
 };
}
function clinicalAscii(s){return proAscii(String(s??'')).replace(/\s+/g,' ').trim()}
function clinicalWrap(s,maxChars){
 const txt=clinicalAscii(s);if(!txt)return ['-'];
 const words=txt.split(' '),lines=[];let line='';
 words.forEach(w=>{
   const n=line?line+' '+w:w;
   if(n.length>maxChars&&line){lines.push(line);line=w}else line=n;
 });
 if(line)lines.push(line);
 return lines.length?lines:['-'];
}
function pdfTextCmd(x,y,text,size=9,font='F1'){
 return `BT /${font} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${proPdfEscape(text)}) Tj ET\n`;
}
function pdfLineCmd(x1,y1,x2,y2,width=.5,gray=.78){
 return `${gray} G ${width} w ${x1} ${y1} m ${x2} ${y2} l S 0 G\n`;
}
function clinicalCircleCmd(cx,cy,r,fill='.38 .75 .03'){
 const k=.5522847498*r;
 return `${fill} rg ${(cx+r).toFixed(2)} ${cy.toFixed(2)} m ${(cx+r).toFixed(2)} ${(cy+k).toFixed(2)} ${(cx+k).toFixed(2)} ${(cy+r).toFixed(2)} ${cx.toFixed(2)} ${(cy+r).toFixed(2)} c ${(cx-k).toFixed(2)} ${(cy+r).toFixed(2)} ${(cx-r).toFixed(2)} ${(cy+k).toFixed(2)} ${(cx-r).toFixed(2)} ${cy.toFixed(2)} c ${(cx-r).toFixed(2)} ${(cy-k).toFixed(2)} ${(cx-k).toFixed(2)} ${(cy-r).toFixed(2)} ${cx.toFixed(2)} ${(cy-r).toFixed(2)} c ${(cx+k).toFixed(2)} ${(cy-r).toFixed(2)} ${(cx+r).toFixed(2)} ${(cy-k).toFixed(2)} ${(cx+r).toFixed(2)} ${cy.toFixed(2)} c f 0 0 0 rg\n`;
}
function clinicalPdfChart(series,valueFn,title,unit,x,y,w,h){
 if(!series.length)return `0.97 0.98 0.97 rg ${x} ${y} ${w} ${h} re f 0 0 0 rg\n`+pdfTextCmd(x+18,y+h/2,'Nessun dato disponibile',9,'F1');

 const values=series.map(valueFn).filter(Number.isFinite);
 if(!values.length)return pdfTextCmd(x,y+h/2,'Nessun dato disponibile',9,'F1');

 let rawMin=Math.min(...values),rawMax=Math.max(...values);
 let pad=Math.max(unit==='kg'?.5:.25,(rawMax-rawMin)*.12);
 let min=rawMin-pad,max=rawMax+pad;if(max===min)max=min+1;

 const left=x+48,right=x+w-18,bottom=y+30,top=y+h-42,range=max-min;
 const xf=i=>series.length===1?(left+right)/2:left+i/(series.length-1)*(right-left);
 const yf=v=>bottom+((v-min)/range)*(top-bottom);

 let c='';
 c+=`0.985 0.992 0.982 rg ${x} ${y} ${w} ${h} re f 0 0 0 rg\n`;
 c+=`0.88 0.92 0.87 RG .5 w ${x} ${y} ${w} ${h} re S 0 G\n`;

 // Titolo e unità su due livelli: niente più effetto "incollato".
 c+=pdfTextCmd(x+16,y+h-22,title,10.8,'F2');
 c+=pdfTextCmd(x+16,y+h-35,unit,6.7,'F1');

 const first=values[0],last=values.at(-1),delta=last-first;
 const firstTxt=first.toFixed(1).replace('.',',');
 const lastTxt=last.toFixed(1).replace('.',',');
 const deltaTxt=(delta>0?'+':'')+delta.toFixed(1).replace('.',',');

 // Mini-riepilogo contestualizzato a destra.
 const statX=x+w-220;
 c+=pdfTextCmd(statX,y+h-21,'Inizio',6.2,'F1');
 c+=pdfTextCmd(statX+42,y+h-21,firstTxt+' '+unit,7.1,'F2');
 c+=pdfTextCmd(statX+95,y+h-21,'Attuale',6.2,'F1');
 c+=pdfTextCmd(statX+142,y+h-21,lastTxt+' '+unit,7.1,'F2');
 c+=pdfTextCmd(statX,y+h-34,'Variazione',6.2,'F1');
 c+=pdfTextCmd(statX+55,y+h-34,deltaTxt+' '+unit,7.1,'F2');

 const ticks=Array.from({length:5},(_,i)=>min+(range/4)*i);
 ticks.forEach(v=>{
   const yy=yf(v);
   c+=`0.91 G .35 w ${left} ${yy.toFixed(1)} m ${right} ${yy.toFixed(1)} l S 0 G\n`;
   c+=pdfTextCmd(left-39,yy-2.3,v.toFixed(1).replace('.',','),6.7,'F1');
 });
 c+=`0.63 G .5 w ${left} ${bottom} m ${left} ${top} l S ${left} ${bottom} m ${right} ${bottom} l S 0 G\n`;

 if(series.length>1){
   c+=`0.02 0.36 0.29 RG 1.25 w `;
   series.forEach((r,i)=>{const xx=xf(i),yy=yf(valueFn(r));c+=`${xx.toFixed(1)} ${yy.toFixed(1)} ${i?'l':'m'} `});
   c+='S 0 G\n';
 }
 series.forEach((r,i)=>{c+=clinicalCircleCmd(xf(i),yf(valueFn(r)),2.05)});

 const startLabel=fmt(series[0].date).replace(/^[^ ]+ /,'');
 const endLabel=fmt(series.at(-1).date).replace(/^[^ ]+ /,'');
 c+=pdfTextCmd(left,bottom-17,startLabel,6.5,'F1');
 c+=pdfTextCmd(right-Math.min(62,endLabel.length*3.6),bottom-17,endLabel,6.5,'F1');

 return c;
}

async function clinicalJpegAsset(src,maxSide=900){
 if(!src)return null;
 return new Promise((resolve,reject)=>{
   const img=new Image();
   img.onload=()=>{
     try{
       const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
       const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
       const cv=document.createElement('canvas');cv.width=w;cv.height=h;
       const ctx=cv.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
       cv.toBlob(async blob=>{
         if(!blob)return reject(new Error('Logo non convertibile'));
         resolve({width:w,height:h,bytes:new Uint8Array(await blob.arrayBuffer())});
       },'image/jpeg',.9);
     }catch(e){reject(e)}
   };
   img.onerror=reject;img.src=src;
 });
}
function clinicalConcat(parts){
 const total=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(total);let o=0;
 parts.forEach(p=>{out.set(p,o);o+=p.length});return out;
}
function clinicalPdfBuild(pageStreams,images,meta={}){
 const enc=new TextEncoder(),objects=[];
 const addString=s=>{objects.push({kind:'bytes',bytes:enc.encode(String(s))});return objects.length};
 const addStream=(dict,bytes)=>{objects.push({kind:'stream',dict,bytes});return objects.length};
 const f1=addString('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 const f2=addString('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
 const imageIds={};
 Object.entries(images||{}).forEach(([name,img])=>{
   if(img)imageIds[name]=addStream(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>`,img.bytes);
 });
 const pagesId=addString('PAGES_PLACEHOLDER'),pageIds=[];
 const total=pageStreams.length;

 pageStreams.forEach((baseStream,index)=>{
   let stream=baseStream;
   if(index>0){
     stream+=`0.88 G .45 w 42 40 m 553 40 l S 0 G\n`;
     stream+=pdfTextCmd(42,24,clinicalAscii(meta.patientName||'Paziente'),6.7,'F1');
     stream+=pdfTextCmd(250,24,'NUBEMO · Cartella clinico-nutrizionale',6.7,'F1');
     stream+=pdfTextCmd(520,24,`${index+1}/${total}`,6.7,'F1');
   }
   const b=enc.encode(stream),content=addStream(`<< /Length ${b.length} >>`,b);
   const xo=Object.entries(imageIds).map(([n,id])=>`/${n} ${id} 0 R`).join(' ');
   const page=addString(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> ${xo?`/XObject << ${xo} >>`:''} >> /Contents ${content} 0 R >>`);
   pageIds.push(page);
 });
 objects[pagesId-1]={kind:'bytes',bytes:enc.encode(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] >>`)};
 const catalog=addString(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
 const parts=[enc.encode('%PDF-1.4\n%NUBEMO\n')],offsets=[0];let cursor=parts[0].length;
 objects.forEach((obj,i)=>{
   offsets[i+1]=cursor;
   const head=enc.encode(`${i+1} 0 obj\n`),tail=enc.encode('\nendobj\n');
   let body=obj.kind==='stream'?clinicalConcat([enc.encode(obj.dict+'\nstream\n'),obj.bytes,enc.encode('\nendstream')]):obj.bytes;
   const all=clinicalConcat([head,body,tail]);parts.push(all);cursor+=all.length;
 });
 const xref=cursor;
 let x=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(let i=1;i<=objects.length;i++)x+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 x+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
 parts.push(enc.encode(x));
 return new Blob([clinicalConcat(parts)],{type:'application/pdf'});
}

function clinicalImageCmd(name,img,x,y,maxW,maxH){
 if(!img)return '';
 const scale=Math.min(maxW/img.width,maxH/img.height),w=img.width*scale,h=img.height*scale;
 const dx=x+(maxW-w)/2,dy=y+(maxH-h)/2;
 return `q ${w.toFixed(1)} 0 0 ${h.toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)} cm /${name} Do Q\n`;
}
function clinicalInnerHeader(title,subtitle=''){
 let c='';
 c+=`0.985 0.99 0.982 rg 0 0 595 842 re f 0 0 0 rg\n`;
 c+=`0.02 0.34 0.29 rg 42 800 6 24 re f 0 0 0 rg\n`;
 c+=pdfTextCmd(60,808,title,16,'F2');
 if(subtitle)c+=pdfTextCmd(60,790,subtitle,7.5,'F1');
 c+=`q 34 0 0 34 507 792 cm /NubemoIcon Do Q\n`;
 c+=pdfLineCmd(42,778,553,778,.6,.85);
 return c;
}
function clinicalFlowPage(title){
 return {title,cmd:clinicalInnerHeader(title),y:750};
}
function clinicalFlowEnsure(flow,pages,need=40){
 if(flow.y-need<60){
   pages.push(flow.cmd);
   const baseTitle=String(flow.title||'').replace(/(?:\s*·\s*continua)+\s*$/i,'');
   flow=clinicalFlowPage(baseTitle);
 }
 return flow;
}
function clinicalFlowSection(flow,pages,title){
 flow=clinicalFlowEnsure(flow,pages,42);
 flow.cmd+=`0.94 0.97 0.93 rg 42 ${flow.y-8} 511 26 re f 0 0 0 rg\n`;
 flow.cmd+=pdfTextCmd(54,flow.y,title,10,'F2');flow.y-=36;return flow;
}
function clinicalFlowField(flow,pages,label,value){
 const lines=clinicalWrap(value||'-',64);
 flow=clinicalFlowEnsure(flow,pages,18+lines.length*11);
 flow.cmd+=pdfTextCmd(54,flow.y,label,7,'F2');
 flow.cmd+=pdfTextCmd(190,flow.y,lines[0],8.7,'F1');flow.y-=11;
 for(let i=1;i<lines.length;i++){flow.cmd+=pdfTextCmd(190,flow.y,lines[i],8.7,'F1');flow.y-=11}
 flow.y-=6;return flow;
}

function clinicalFlowTableSection(flow,pages,title,rows,opts={}){
 const keepEmpty=!!opts.keepEmpty;
 const clean=(rows||[]).filter(r=>r&&(keepEmpty||clinicalHasValue(r[1])));
 if(!clean.length)return flow;
 const labelW=150,totalW=511,valueW=totalW-labelW,lineH=10;
 // Distacco fisso tra una sezione clinica e la precedente.
 if(flow.y<735)flow.y-=14;
 const firstValue=clinicalHasValue(clean[0][1])?String(clean[0][1]):'—';
 const firstLines=clinicalWrap(firstValue,Math.max(12,Math.floor((valueW-14)/4.4))).length;
 flow=clinicalFlowEnsure(flow,pages,50+Math.max(24,firstLines*lineH+12));
 flow.cmd+=`0.94 0.97 0.93 rg 42 ${flow.y-8} 511 26 re f 0 0 0 rg\n`;
 flow.cmd+=pdfTextCmd(54,flow.y,title,10,'F2');flow.y-=36;
 clean.forEach((r,idx)=>{
   const label=String(r[0]||''),value=clinicalHasValue(r[1])?String(r[1]):'—';
   const lines=clinicalWrap(value,Math.max(12,Math.floor((valueW-14)/4.4)));
   const h=Math.max(24,lines.length*lineH+12);
   flow=clinicalFlowEnsure(flow,pages,h+2);
   const y0=flow.y-h+6;
   if(idx%2===0)flow.cmd+=`0.975 0.987 0.97 rg 42 ${y0} ${totalW} ${h} re f 0 0 0 rg\n`;
   flow.cmd+=`0.86 0.90 0.85 RG .3 w 42 ${y0} ${labelW} ${h} re S 0 G\n`;
   flow.cmd+=`0.86 0.90 0.85 RG .3 w ${42+labelW} ${y0} ${valueW} ${h} re S 0 G\n`;
   flow.cmd+=pdfTextCmd(50,flow.y-9,label,7.1,'F2');
   lines.forEach((line,li)=>flow.cmd+=pdfTextCmd(42+labelW+8,flow.y-9-li*lineH,line,7.7,'F1'));
   flow.y-=h;
 });
 flow.y-=10;
 return flow;
}

function clinicalFlowGridTable(flow,pages,title,headers,rows,widths){
 const totalW=widths.reduce((a,b)=>a+b,0),x0=42;
 if(flow.y<735)flow.y-=14;
 flow=clinicalFlowEnsure(flow,pages,82);
 flow.cmd+=`0.94 0.97 0.93 rg 42 ${flow.y-8} 511 26 re f 0 0 0 rg\n`;
 flow.cmd+=pdfTextCmd(54,flow.y,title,10,'F2');flow.y-=38;
 const drawHeader=()=>{
   let x=x0;
   headers.forEach((h,i)=>{
     flow.cmd+=`0.88 0.95 0.86 rg ${x} ${flow.y-24} ${widths[i]} 24 re f 0 0 0 rg\n`;
     flow.cmd+=`0.78 0.87 0.76 RG .35 w ${x} ${flow.y-24} ${widths[i]} 24 re S 0 G\n`;
     flow.cmd+=pdfTextCmd(x+7,flow.y-16,h,7,'F2');x+=widths[i];
   });
   flow.y-=24;
 };
 drawHeader();
 (rows||[]).forEach((r,rowIndex)=>{
   const wraps=r.map((c,i)=>clinicalWrap(clinicalHasValue(c)?String(c):'—',Math.max(5,Math.floor((widths[i]-12)/4.4))));
   const lines=Math.max(1,...wraps.map(a=>a.length)),h=Math.max(23,lines*10+10);
   if(flow.y-h<60){
     pages.push(flow.cmd);flow=clinicalFlowPage(flow.title);flow.y=742;
     flow.cmd+=`0.94 0.97 0.93 rg 42 ${flow.y-8} 511 26 re f 0 0 0 rg\n`;
     flow.cmd+=pdfTextCmd(54,flow.y,title+' · continua',10,'F2');flow.y-=38;drawHeader();
   }
   let x=x0;
   if(rowIndex%2===0)flow.cmd+=`0.975 0.987 0.97 rg ${x0} ${flow.y-h} ${totalW} ${h} re f 0 0 0 rg\n`;
   wraps.forEach((ls,i)=>{
     flow.cmd+=`0.86 0.90 0.85 RG .3 w ${x} ${flow.y-h} ${widths[i]} ${h} re S 0 G\n`;
     ls.forEach((line,li)=>flow.cmd+=pdfTextCmd(x+7,flow.y-15-li*10,line,7.2,i===0?'F2':'F1'));
     x+=widths[i];
   });
   flow.y-=h;
 });
 flow.y-=10;return flow;
}
function clinicalWeeklyWeightRows(weights){
 const src=(weights||[]).filter(x=>x&&x.date&&Number.isFinite(Number(x.weight))).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 if(!src.length)return [];
 const groups=new Map();
 src.forEach(x=>{
   const d=new Date(String(x.date)+'T12:00:00');
   const start=new Date(d);start.setDate(d.getDate()-d.getDay());
   const end=new Date(start);end.setDate(start.getDate()+6);
   const key=start.toISOString().slice(0,10);
   if(!groups.has(key))groups.set(key,{start,end,items:[]});
   groups.get(key).items.push(x);
 });
 const now=new Date(),todayDate=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const monthNames=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
 const labelRange=(a,b)=>{
   const sameMonth=a.getMonth()===b.getMonth();
   return sameMonth?`${a.getDate()}–${b.getDate()} ${monthNames[b.getMonth()]}`:`${a.getDate()} ${monthNames[a.getMonth()]}–${b.getDate()} ${monthNames[b.getMonth()]}`;
 };
 return [...groups.values()].map(g=>{
   const first=g.items[0],last=g.items[g.items.length-1],delta=Number(last.weight)-Number(first.weight);
   const inCourse=todayDate>=new Date(g.start.getFullYear(),g.start.getMonth(),g.start.getDate())&&todayDate<=new Date(g.end.getFullYear(),g.end.getMonth(),g.end.getDate());
   const trend=delta<0?'[[DOWN]]':delta>0?'[[UP]]':'[[EQ]]';
   return [labelRange(g.start,g.end)+(inCourse?' (in corso)':''),clinicalNumberText(first.weight,'kg'),clinicalNumberText(last.weight,'kg'),trend+' '+(delta>0?'+':'')+delta.toFixed(1).replace('.',',')+' kg'];
 });
}
function clinicalMetricCard(x,y,w,h,label,value,accent='.02 .34 .29'){
 let c=`1 1 1 rg ${x} ${y} ${w} ${h} re f 0 0 0 rg\n`;
 c+=`0.87 0.91 0.86 RG .55 w ${x} ${y} ${w} ${h} re S 0 G\n`;
 c+=`${accent} rg ${x} ${y+h-5} ${w} 5 re f 0 0 0 rg\n`;
 c+=pdfTextCmd(x+13,y+h-24,label,7,'F1');
 c+=pdfTextCmd(x+13,y+19,value,17,'F2');
 return c;
}
function clinicalTrendMarkerCmd(x,y,kind){
 let c='0.39 0.78 0.03 RG 1.15 w\n';
 if(kind==='DOWN'){
   c+=`${x} ${y+4} m ${x} ${y-3} l S\n`;
   c+=`${x-3} ${y} m ${x} ${y-3} l ${x+3} ${y} l S\n`;
 }else if(kind==='UP'){
   c+=`${x} ${y-3} m ${x} ${y+4} l S\n`;
   c+=`${x-3} ${y+1} m ${x} ${y+4} l ${x+3} ${y+1} l S\n`;
 }else{
   c+=`${x-3} ${y+1} m ${x+3} ${y+1} l S\n`;
   c+=`${x-3} ${y-2} m ${x+3} ${y-2} l S\n`;
 }
 return c+'0 G\n';
}
function clinicalTablePage(title,headers,rows,widths){
 const pages=[];let cmd='',y=750,rowH=23,x0=42,rowIndex=0;
 const newPage=()=>{
   if(cmd)pages.push(cmd);
   cmd=clinicalInnerHeader(title);
   y=742;
   let x=x0;
   headers.forEach((h,i)=>{
     cmd+=`0.88 0.95 0.86 rg ${x} ${y} ${widths[i]} 25 re f 0 0 0 rg\n`;
     cmd+=`0.78 0.87 0.76 RG .35 w ${x} ${y} ${widths[i]} 25 re S 0 G\n`;
     cmd+=pdfTextCmd(x+7,y+8,h,7.2,'F2');
     x+=widths[i];
   });
   y-=25;rowIndex=0;
 };
 newPage();
 rows.forEach(r=>{
   const markers=r.map(c=>{const m=String(c||'').match(/^\[\[(DOWN|UP|EQ)\]\]\s*/);return m?m[1]:null;});
   const clean=r.map(c=>String(c||'').replace(/^\[\[(DOWN|UP|EQ)\]\]\s*/,''));
   const wraps=clean.map((c,i)=>clinicalWrap(c,Math.max(5,Math.floor((widths[i]-12-(markers[i]?22:0))/4.4))));
   const lines=Math.max(...wraps.map(a=>a.length)),h=Math.max(rowH,lines*10+10);
   if(y-h<60)newPage();
   let x=x0;
   if(rowIndex%2===0)cmd+=`0.97 0.985 0.965 rg ${x0} ${y-h} ${widths.reduce((a,b)=>a+b,0)} ${h} re f 0 0 0 rg\n`;
   wraps.forEach((ls,i)=>{
     cmd+=`0.88 G .3 w ${x} ${y-h} ${widths[i]} ${h} re S 0 G\n`;
     const textX=x+7+(markers[i]?22:0);
     if(markers[i])cmd+=clinicalTrendMarkerCmd(x+12,y-12,markers[i]);
     ls.forEach((line,li)=>cmd+=pdfTextCmd(textX,y-15-li*10,line,7.3,'F1'));
     x+=widths[i];
   });
   y-=h;rowIndex++;
 });
 if(cmd)pages.push(cmd);return pages;
}


function clinicalHasValue(v){
 return v!==undefined&&v!==null&&String(v).trim()!=='';
}
function clinicalNumberText(v,unit=''){
 if(!clinicalHasValue(v)||!Number.isFinite(Number(v)))return '';
 return Number(v).toFixed(1).replace('.',',')+(unit?' '+unit:'');
}
function clinicalFlowMultiline(flow,pages,label,text){
 const raw=String(text??'').replace(/\r/g,'');
 if(!raw.trim())return flow;
 const paragraphs=raw.split('\n');
 flow=clinicalFlowEnsure(flow,pages,28);
 flow.cmd+=pdfTextCmd(54,flow.y,label,7,'F2');flow.y-=14;
 paragraphs.forEach((p,i)=>{
   if(!p.trim()){flow.y-=7;return}
   const lines=clinicalWrap(p,78);
   lines.forEach(line=>{
     flow=clinicalFlowEnsure(flow,pages,15);
     flow.cmd+=pdfTextCmd(68,flow.y,line,8.3,'F1');
     flow.y-=11;
   });
   if(i<paragraphs.length-1)flow.y-=4;
 });
 flow.y-=7;
 return flow;
}
function clinicalActivityFactorLabel(v){
 const map={'1.2':'Sedentario','1.375':'Leggermente attivo','1.55':'Moderatamente attivo','1.725':'Molto attivo','1.9':'Estremamente attivo'};
 return map[String(v||'')]||'';
}
function clinicalDiaryEntries(p,mode){
 const entries=(p.entries||[]).slice().filter(x=>x&&x.date).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 if(mode==='full')return entries;
 if(mode==='7'||mode==='30')return clinicalFilterDays(entries,Number(mode));
 return [];
}

async function ensureProfessionalLogoData(){
 const loader=window.nubemoEnsureProfessionalLogoLoaded;
 if(typeof loader==='function')await loader();
}
async function exportClinicalPdf(p,opts={}){
 await ensureProfessionalLogoData();
 const s=settings(),weights=clinicalWeightSeries(p),interval=opts.interval||30;
 const diaryMode=opts.diaryMode||'none';
 const nubemo=await clinicalJpegAsset(NUBEMO_PDF_BRAND,1200).catch(()=>null);
 const nubemoIcon=await clinicalJpegAsset(NUBEMO_PDF_ICON,400).catch(()=>null);
 const professional=s.logoData?await clinicalJpegAsset(s.logoData,800).catch(()=>null):null;
 const pages=[],images={Nubemo:nubemo,NubemoIcon:nubemoIcon,ProLogo:professional};

 const age=ageFromBirth(p.birth);
 const current=weights.at(-1),first=weights[0];
 const currentBmi=current&&p.height?bmi(current.weight,p.height):null;
 const firstBmi=first&&p.height?bmi(first.weight,p.height):null;
 const delta=first&&current?current.weight-first.weight:null;
 const goal=clinicalHasValue(p.goal)?Number(p.goal):null;
 const generated=new Date().toLocaleDateString('it-IT');

 // -----------------------------------------------------------
 // 1. COPERTINA
 // -----------------------------------------------------------
 let cover='';
 cover+=`1 1 1 rg 0 0 595 842 re f 0 0 0 rg\n`;
 cover+=`0.02 0.34 0.29 rg 0 0 12 842 re f 0 0 0 rg\n`;
 cover+=`0.39 0.78 0.03 rg 12 0 5 842 re f 0 0 0 rg\n`;

 if(nubemo)cover+=clinicalImageCmd('Nubemo',nubemo,42,728,112,84);
 else cover+=pdfTextCmd(42,772,'NUBEMO',22,'F2');
 cover+=pdfTextCmd(176,773,'NUBEMO - Il tuo percorso, ogni giorno',11,'F2');
 cover+=pdfLineCmd(176,757,553,757,.6,.86);

 cover+=pdfTextCmd(42,665,'CARTELLA',10,'F2');
 cover+=pdfTextCmd(42,637,'CLINICO-NUTRIZIONALE',22,'F2');
 cover+=`0.39 0.78 0.03 rg 42 617 76 4 re f 0 0 0 rg\n`;

 cover+=pdfTextCmd(42,565,clinicalAscii(p.name).toUpperCase(),25,'F2');
 const patientSub=[
   p.birth?`Nato/a il ${fmt(p.birth)}`:'',
   age!=='—'?`${age} anni`:'',
   p.height?`${p.height} cm`:''
 ].filter(Boolean).join(' · ');
 if(patientSub)cover+=pdfTextCmd(42,541,patientSub,8.8,'F1');
 cover+=pdfTextCmd(42,518,'Documento generato il '+generated,8.2,'F1');

 cover+=`0.97 0.985 0.965 rg 42 235 511 165 re f 0 0 0 rg\n`;
 cover+=`0.86 0.91 0.84 RG .6 w 42 235 511 165 re S 0 G\n`;
 cover+=pdfTextCmd(62,375,'A CURA DI',7.2,'F2');
 cover+=pdfTextCmd(62,347,professionalDisplayName(s),14.5,'F2');
 if(s.qualification)cover+=pdfTextCmd(62,327,clinicalAscii(s.qualification),8.7,'F1');
 if(professional)cover+=clinicalImageCmd('ProLogo',professional,430,300,95,82);

 let py=300;
 const professionalLines=[
   [s.address,[s.zip,s.city,s.province].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
   [s.email,s.phone].filter(Boolean).join(' · '),
   [s.vat?'P.IVA '+s.vat:'',s.cf?'CF '+s.cf:''].filter(Boolean).join(' · ')
 ].filter(Boolean);
 professionalLines.forEach(line=>{cover+=pdfTextCmd(62,py,clinicalAscii(line),7.8,'F1');py-=17});

 cover+=pdfLineCmd(42,88,553,88,.45,.86);
 cover+=pdfTextCmd(42,68,'NUBEMO · Il tuo percorso, ogni giorno.',7,'F1');
 cover+=pdfTextCmd(455,68,'Documento riservato',7,'F1');
 pages.push(cover);

 // -----------------------------------------------------------
 // 2. PAGINA 2 — SINTESI DEL PERCORSO + DATI DEL PAZIENTE
 // Pagina volutamente stabile: niente sezioni cliniche aggiunte in coda.
 // -----------------------------------------------------------
 let sf=clinicalFlowPage('Profilo e sintesi del percorso');

 const metrics=[
   first?['Peso iniziale',clinicalNumberText(first.weight,'kg')]:null,
   current?['Peso attuale',clinicalNumberText(current.weight,'kg')]:null,
   delta!=null?['Variazione',(delta>0?'+':'')+delta.toFixed(1).replace('.',',')+' kg']:null,
   currentBmi?['BMI attuale',currentBmi.toFixed(1).replace('.',',')]:null
 ].filter(Boolean);
 if(metrics.length){
   const gap=9,w=(511-gap*(metrics.length-1))/metrics.length;
   metrics.forEach((m,i)=>sf.cmd+=clinicalMetricCard(42+i*(w+gap),650,w,70,m[0],m[1],i===2?'.39 .78 .03':'.02 .34 .29'));
   sf.y=606;
 }

 const profileFields=[
   ['Data di nascita',p.birth?fmt(p.birth):''],
   ['Età',age==='—'?'':age+' anni'],
   ['Sesso',p.sex||''],
   ['Altezza',p.height?p.height+' cm':''],
   ['Peso obiettivo',goal?clinicalNumberText(goal,'kg'):''],
   ['Peso minimo storico',clinicalNumberText(p.minWeight,'kg')],
   ['Peso massimo storico',clinicalNumberText(p.maxWeight,'kg')],
   ['Peso ragionevole / concordato',clinicalNumberText(p.reasonableWeight,'kg')],
   ['BMI iniziale',firstBmi?firstBmi.toFixed(1).replace('.',','):''],
   ['Categoria BMI attuale',currentBmi?proBmiLabel(currentBmi):'']
 ];
 sf=clinicalFlowTableSection(sf,pages,'Dati del paziente',profileFields,{keepEmpty:true});
 pages.push(sf.cmd);

 // -----------------------------------------------------------
 // 3. PAGINA 3 — ANAMNESI + NOTE DEL PROFESSIONISTA
 // Struttura autonoma e prevedibile.
 // -----------------------------------------------------------
 let af=clinicalFlowPage('Anamnesi e note del professionista');

 const fam=[
   p.famObesity?'Obesità':'',p.famDiabetes?'Diabete':'',p.famHypertension?'Ipertensione':'',
   p.famCardiovascular?'Patologie cardiovascolari':'',p.famDyslipidemia?'Dislipidemie':'',
   p.famThyroid?'Patologie tiroidee':'',p.famGestational?'Diabete gestazionale':''
 ].filter(Boolean).join(', ');

 const lifestyle=[
   ['Diagnosi / motivo',p.diagnosis],
   ['Peso teorico',clinicalNumberText(p.theoreticalWeight,'kg')],
   ['Attività lavorativa',p.work],
   ['Attività fisica abituale',p.activity],
   ['Livello attività',clinicalActivityFactorLabel(p.activityFactor)],
   ['Alvo',p.bowel],
   ['Fumo',p.smoking],
   ['Alcol',p.alcohol],
   ['Metabolismo basale',p.metabolism],
   ['FEEG / fabbisogno',p.feeg],
   ['Impedenziometria',p.impedance]
 ];

 const pathological=[
   ['Diete pregresse',p.previousDiets],
   ['Allergie / intolleranze',p.allergies],
   ['Farmaci / integrazione',p.medications],
   ['Disturbi gastrointestinali',p.giIssues],
   ['Patologie / interventi pregressi',p.pastConditions],
   ['Osservazioni',p.observations],
   ['Obiettivi',p.objectives]
 ];

 const anamnesisRows=[...lifestyle,['Familiarità',fam],...pathological];
 af=clinicalFlowTableSection(af,pages,'Anamnesi',anamnesisRows,{keepEmpty:true});

 const notesMap=load(NOTES_KEY,{});
 const professionalNotes=String(notesMap[p.id]||'').trim();
 af=clinicalFlowTableSection(af,pages,'Note del professionista',[['Note',professionalNotes]],{keepEmpty:true});
 pages.push(af.cmd);

 // -----------------------------------------------------------
 // 4. PAGINA 4 — ANTROPOMETRIA/MISURE + ESAMI EMATICI
 // Entrambe le sezioni sono tabellari e convivono nella stessa pagina.
 // Esami: parametri sulle righe, ultime 5 date sulle colonne,
 // ordinate dalla più vecchia alla più recente.
 // -----------------------------------------------------------
 let mf=clinicalFlowPage('Antropometria, misure ed esami');

 const measures=(p.measures||[]).slice().filter(m=>m&&m.date).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const measureRows=measures.length?measures.map(m=>[
   fmt(m.date),clinicalNumberText(m.professionalWeight,'kg'),
   clinicalHasValue(m.waist)?String(m.waist)+' cm':'',
   clinicalHasValue(m.hips)?String(m.hips)+' cm':'',
   clinicalHasValue(m.notes)?String(m.notes):''
 ]):[['—','—','—','—','—']];
 mf=clinicalFlowGridTable(mf,pages,'Antropometria e misure',['Data','Peso rilevato','Vita','Fianchi','Note'],measureRows,[76,96,70,70,199]);

 const allLabs=labsFor(p.id).slice().filter(x=>x&&x.date).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const labFields=[
   ['glucose','Glicemia'],['cholesterol','Colesterolo'],['hdl','HDL'],['ldl','LDL'],['triglycerides','Trigliceridi'],
   ['got','GOT'],['gpt','GPT'],['uricAcid','Acido urico'],['creatinine','Creatinina'],['ggt','γGT']
 ];
 const labs=allLabs.filter(r=>labFields.some(([k])=>clinicalHasValue(r[k]))).slice(-5);

 const labHeaders=['Parametro',...(labs.length?labs.map(r=>fmt(r.date)):['—'])];
 const paramW=116,dateW=(511-paramW)/(labs.length||1);
 const labWidths=[paramW,...Array(labs.length||1).fill(dateW)];
 const labRows=labFields.map(([key,label])=>[
   label,
   ...(labs.length?labs.map(r=>clinicalHasValue(r[key])?String(r[key]):'—'):['—'])
 ]);
 mf=clinicalFlowGridTable(mf,pages,'Esami ematici',labHeaders,labRows,labWidths);
 pages.push(mf.cmd);

 // -----------------------------------------------------------
 // 4. DETTAGLIO SETTIMANALE DEL PESO — domenica/sabato
 // -----------------------------------------------------------
 const weeklyRows=clinicalWeeklyWeightRows(weights);
 if(weeklyRows.length){
   pages.push(...clinicalTablePage('Andamento settimanale del peso',['Settimana','Peso iniziale','Peso finale','Variazione'],weeklyRows,[205,102,102,102]));
 }

 // -----------------------------------------------------------
 // 5. ANDAMENTO — 3 Peso + 3 BMI
 // -----------------------------------------------------------
 const chartRanges=[['Dall’inizio',0],['Ultimi 30 giorni',30],['Ultimi 7 giorni',7]];
 if(weights.length){
   let pc=clinicalInnerHeader('Andamento peso','Evoluzione del peso corporeo');
   if(first&&current){
     pc+=clinicalMetricCard(42,680,150,68,'Inizio',clinicalNumberText(first.weight,'kg'));
     pc+=clinicalMetricCard(205,680,150,68,'Attuale',clinicalNumberText(current.weight,'kg'));
     pc+=clinicalMetricCard(368,680,150,68,'Variazione',(delta>0?'+':'')+delta.toFixed(1).replace('.',',')+' kg','.39 .78 .03');
   }
   chartRanges.forEach((r,i)=>pc+=clinicalPdfChart(clinicalFilterDays(weights,r[1]),x=>x.weight,r[0],'kg',42,470-i*185,511,155));
   pages.push(pc);
 }


 // Grafico BMI rimosso: il BMI resta disponibile come valore di sintesi,
 // ma il suo andamento replica matematicamente quello del peso a parità di altezza.

 // -----------------------------------------------------------
 // 8. ALLEGATO OPZIONALE
 // -----------------------------------------------------------
 if(diaryMode==='weight'){
   const periodic=clinicalIntervalWeights(p,interval);
   if(periodic.length){
     const rows=periodic.map(x=>[fmt(x.date),clinicalNumberText(x.weight,'kg')]);
     pages.push(...clinicalTablePage('Storico rilevazioni peso',['Data','Peso registrato'],rows,[190,320]));
   }
 }else if(['7','30','full'].includes(diaryMode)){
   const entries=clinicalDiaryEntries(p,diaryMode);
   if(entries.length){
     const title=diaryMode==='7'?'Diario alimentare · Ultimi 7 giorni':diaryMode==='30'?'Diario alimentare · Ultimi 30 giorni':'Diario alimentare';
     let dflow=clinicalFlowPage(title);
     entries.forEach(d=>{
       const rows=[];
       const meta=[
         clinicalHasValue(d.weight)?'Peso '+clinicalNumberText(d.weight,'kg'):'',
         clinicalHasValue(d.water)?'Acqua '+clinicalNumberText(d.water,'L'):'',
         clinicalHasValue(d.coffee)?'Caffè '+d.coffee:''
       ].filter(Boolean).join(' · ');
       if(meta)rows.push(['Rilevazioni',meta]);
       [
         ['Colazione',d.breakfast],['Spuntino mattina',d.snack1],['Pranzo',d.lunch],
         ['Spuntino pomeriggio',d.snack2],['Cena',d.dinner],['Sport / Note',d.notes]
       ].forEach(([label,val])=>{if(clinicalHasValue(val))rows.push([label,String(val)]);});

       // Ogni giorno è un blocco tabellare autonomo. Se non entra, parte dalla pagina successiva.
       const labelW=108,valueW=403,lineH=9;
       const estimated=34+rows.reduce((sum,r)=>{
         const lines=clinicalWrap(String(r[1]),Math.max(12,Math.floor((valueW-14)/4.4))).length;
         return sum+Math.max(22,lines*lineH+11);
       },0)+10;
       if(estimated<680)dflow=clinicalFlowEnsure(dflow,pages,estimated);
       else dflow=clinicalFlowEnsure(dflow,pages,45);

       // Più respiro tra due giornate, ma data e relativa tabella restano compatte.
       if(dflow.y<735)dflow.y-=14;
       dflow=clinicalFlowEnsure(dflow,pages,estimated+14);
       dflow.cmd+=`0.88 0.95 0.86 rg 42 ${dflow.y-9} 511 30 re f 0 0 0 rg\n`;
       dflow.cmd+=`0.02 0.34 0.29 rg 42 ${dflow.y-9} 5 30 re f 0 0 0 rg\n`;
       dflow.cmd+=`0.78 0.87 0.76 RG .45 w 42 ${dflow.y-9} 511 30 re S 0 G\n`;
       dflow.cmd+=pdfTextCmd(55,dflow.y,fmt(d.date),9.4,'F2');
       dflow.y-=31;

       rows.forEach((r,idx)=>{
         const lines=clinicalWrap(String(r[1]),Math.max(12,Math.floor((valueW-14)/4.4)));
         const h=Math.max(22,lines.length*lineH+11);
         dflow=clinicalFlowEnsure(dflow,pages,h+2);
         const y0=dflow.y-h+5;
         if(idx%2===0)dflow.cmd+=`0.975 0.987 0.97 rg 42 ${y0} 511 ${h} re f 0 0 0 rg\n`;
         dflow.cmd+=`0.86 0.90 0.85 RG .3 w 42 ${y0} ${labelW} ${h} re S 0 G\n`;
         dflow.cmd+=`0.86 0.90 0.85 RG .3 w ${42+labelW} ${y0} ${valueW} ${h} re S 0 G\n`;
         dflow.cmd+=pdfTextCmd(50,dflow.y-8,r[0],6.8,'F2');
         lines.forEach((line,li)=>dflow.cmd+=pdfTextCmd(42+labelW+8,dflow.y-8-li*lineH,line,7.2,'F1'));
         dflow.y-=h;
       });
       dflow.y-=6;
     });
     pages.push(dflow.cmd);
   }
 }

 const blob=clinicalPdfBuild(pages,images,{patientName:p.name}),url=URL.createObjectURL(blob),a=document.createElement('a');
 const safe=String(p.name||'Paziente').replace(/[^A-Za-z0-9_-]+/g,'_');
 a.href=url;a.download=`Cartella_NUBEMO_${safe}_${today().replace(/-/g,'')}.pdf`;
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);
}
function details(){
 const p=patient(selected)||mainPatient();
 const b=p.last&&p.height?bmi(p.last,p.height):null;
 return `<div class="patient-global-head">
   <div class="patient-global-title">${top(esc(p.name))}</div>
   <div class="patient-more-wrap">
     <button class="patient-more-btn" id="patientMoreBtn" aria-label="Altre azioni">⋯</button>
     <div class="patient-more-menu" id="patientMoreMenu">
       <button id="patientMenuEditProfile">Modifica scheda</button>
       <button id="deletePatient" class="danger-link">Termina percorso</button>
     </div>
   </div>
 </div>${nav()}
 <div class="pro3-kpis">
  <div><span>Peso iniziale</span><b>${p.first!=null?p.first.toFixed(1).replace('.',',')+' kg':'—'}</b></div>
  <div><span>Ultimo peso</span><b>${p.last!=null?p.last.toFixed(1).replace('.',',')+' kg':'—'}</b></div>
  <div><span>Variazione</span><b>${p.delta!=null?(p.delta>0?'+':'')+p.delta.toFixed(1).replace('.',',')+' kg':'—'}</b></div>
  <div><span>BMI</span><b>${b?b.toFixed(1).replace('.',','):'—'}</b></div>
 </div>
 <div class="patient-desktop-tabs">
   ${[
     ['summary','Riepilogo'],['anamnesis','Anamnesi'],['labs',`Esami${hasUnreadProfessionalBloodTests(p.id)?'<span class="document-alert-inline">!</span>':''}`],['plan','Piano'],['documents',`Documenti${hasUnreadProfessionalDocuments(p.id)?'<span class="document-alert-inline">!</span>':''}`],
     ['privacy','Privacy'],['account','Account'],['diary','Diario'],['trend','Andamento'],
     ['measures','Misure'],['visits','Visite'],['notes','Note']
   ].map(([k,l])=>`<button data-patient-tab="${k}" class="${tab===k?'active':''}">${l}</button>`).join('')}
 </div>
 <section class="card patient-content-card">
   <div class="patient-section-head patient-section-head-clean">
     <div><h2>${[['summary','Riepilogo'],['anamnesis','Anamnesi'],['labs',`Esami${hasUnreadProfessionalBloodTests(p.id)?'<span class="document-alert-inline">!</span>':''}`],['plan','Piano'],['documents',`Documenti${hasUnreadProfessionalDocuments(p.id)?'<span class="document-alert-inline">!</span>':''}`],['privacy','Privacy'],['account','Account'],['diary','Diario'],['trend','Andamento'],['measures','Misure'],['visits','Visite'],['notes','Note']].find(x=>x[0]===tab)?.[1]||'Riepilogo'}</h2></div>
     ${tab==='summary'?`<div class="patient-summary-actions">
       <button class="primary desktop-clinical-pdf" id="desktopClinicalPdf">↓ Cartella PDF</button>
     </div>`:''}
   </div>
   ${tabContent(p)}
 </section>`;
}
function ageFromBirth(b){if(!b)return '—';const d=new Date(b+'T12:00:00'),n=new Date();let a=n.getFullYear()-d.getFullYear();if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))a--;return a}function latestMeasure(p){return (p.measures||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1)||null}
const CALORIE_FOODS=window.nubemoFoodCatalog.nubemoFoods;

function calorieNormalize(s){
 return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
}
function calorieSegments(text){
 return String(text||'').replace(/\r/g,'').split(/\n|[;]+|\s+\+\s+/).map(x=>x.trim()).filter(Boolean);
}
function findCalorieFood(segment){
 const crea=window.nubemoFoodCatalog.findCrea(segment);
 const s=calorieNormalize(segment);
 let matches=[];
 for(const food of CALORIE_FOODS){
   for(const name of food.names){
     const idx=s.indexOf(name);
     if(idx>=0)matches.push({...food,matchedName:name,matchIndex:idx});
   }
 }
 matches.sort((a,b)=>a.matchIndex-b.matchIndex || b.matchedName.length-a.matchedName.length);
 const nubemo=matches[0]||null;
 return crea && window.nubemoFoodCatalog.canUseCrea(segment,crea,nubemo) ? crea : nubemo;
}
function parseSegmentCalories(segment){
 const raw=calorieNormalize(segment),food=findCalorieFood(raw);
 if(!food)return {segment,status:'unknown',calories:0,label:segment};

 // Precise units: grams / ml
 let m=raw.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|grammi|ml)\b/i);
 if(m){
   const qty=Number(m[1].replace(',','.'));
   if(Number.isFinite(qty)&&qty>0&&food.k100)
     return {segment,status:'calculated',calories:Math.round(qty*food.k100/100),label:food.matchedName,quantity:`${qty} ${m[2]}`};
 }

 // Household/generic units: slices, spoons, jars...
 m=raw.match(/(\d+(?:[.,]\d+)?)\s*(fetta|fette|cucchiaino|cucchiaini|cucchiaio|cucchiai|vasetto|vasetti|porzione|porzioni|pezzo|pezzi|bicchiere|bicchieri|bottiglia|bottiglie|lattina|lattine|biscotto|biscotti|tazzina|tazzine|tazza|tazze)\b/i);
 if(m){
   const qty=Number(m[1].replace(',','.'));
   const unit=m[2].toLowerCase();
   if(Number.isFinite(qty)&&qty>0){
     if(food.generic && food.generic[unit] && food.k100){
       const grams=qty*food.generic[unit];
       return {
         segment,
         status:'genericQuantity',
         calories:Math.round(grams*food.k100/100),
         label:food.matchedName,
         quantity:`${qty} ${unit}`,
         assumedGrams:Math.round(grams)
       };
     }
     // Quantity exists but we do not know a safe conversion for this food.
     return {segment,status:'genericQuantityNoEstimate',calories:0,label:food.matchedName,quantity:`${qty} ${unit}`};
   }
 }

 // Countable foods such as 1 banana, 2 uova, 1 yogurt.
 m=raw.match(/^(\d+(?:[.,]\d+)?)\s+(?:di\s+)?/i);
 if(m&&!/\b(g|gr|grammi|ml)\b/i.test(raw)){
   const qty=Number(m[1].replace(',','.'));
   if(Number.isInteger(qty)&&qty>0&&qty<=10&&food.portionKcal)
     return {segment,status:'genericQuantity',calories:Math.round(qty*food.portionKcal),label:food.matchedName,quantity:`${qty} porz.`};
   if(qty>=10&&food.k100)
     return {segment,status:'calculated',calories:Math.round(qty*food.k100/100),label:food.matchedName,quantity:`${qty} g*`};
 }

 return {segment,status:'missingQuantity',calories:0,label:food.matchedName};
}
function calorieEstimateText(text){
 const items=calorieSegments(text).map(parseSegmentCalories);
 return {
   calories:items.reduce((s,x)=>s+x.calories,0),
   calculated:items.filter(x=>x.status==='calculated').length,
   genericQuantity:items.filter(x=>x.status==='genericQuantity').length,
   genericQuantityNoEstimate:items.filter(x=>x.status==='genericQuantityNoEstimate').length,
   missingQuantity:items.filter(x=>x.status==='missingQuantity').length,
   unknown:items.filter(x=>x.status==='unknown').length,
   total:items.length,
   items
 };
}
function calorieEstimateDay(entry){
 const results=['breakfast','snack1','lunch','snack2','dinner'].map(k=>calorieEstimateText(entry?.[k]||''));
 const r={
   calories:results.reduce((s,x)=>s+x.calories,0),
   calculated:results.reduce((s,x)=>s+x.calculated,0),
   genericQuantity:results.reduce((s,x)=>s+x.genericQuantity,0),
   genericQuantityNoEstimate:results.reduce((s,x)=>s+x.genericQuantityNoEstimate,0),
   missingQuantity:results.reduce((s,x)=>s+x.missingQuantity,0),
   unknown:results.reduce((s,x)=>s+x.unknown,0),
   total:results.reduce((s,x)=>s+x.total,0),
   items:results.flatMap(x=>x.items)
 };
 const usable=r.calculated+r.genericQuantity;
 if(!r.total||!usable){r.quality='none';r.qualityLabel='Non disponibile'}
 else if(r.unknown===0&&r.missingQuantity===0&&r.genericQuantity===0&&r.genericQuantityNoEstimate===0){r.quality='good';r.qualityLabel='Buona'}
 else{r.quality='partial';r.qualityLabel='Parziale'}
 return r;
}
function estimateDiaryCalories(entry){const r=calorieEstimateDay(entry);return (r.calculated+r.genericQuantity)?r.calories:null}
function dayEstimatedCalories(entry){return estimateDiaryCalories(entry)}
function latestDiaryCalories(p){
 const a=(p.entries||p.diary||[]).slice().sort((x,y)=>String(x.date).localeCompare(String(y.date)));
 for(let i=a.length-1;i>=0;i--){const r=calorieEstimateDay(a[i]);if(r.calculated)return {date:a[i].date,calories:r.calories,quality:r.quality,qualityLabel:r.qualityLabel}}
 return null;
}
function proSummary2(p){
 const m=latestMeasure(p),wh=m&&+m.waist&&+m.hips?+m.waist/+m.hips:null,bmrVal=bmrMifflin(p),daily=energyEstimate(p);
 const lazyMeta=window.nubemoProfessionalPatientSummaryLazy?.summaryMeta?.get?.(p.id)||null;
 const persistedCalories=lazyMeta?.latest_calorie||null;
 const food=persistedCalories?.total_kcal!=null?{
   date:persistedCalories.date,
   calories:Number(persistedCalories.total_kcal),
   qualityLabel:persistedCalories.quality==='good'?'Buona':persistedCalories.quality==='partial'?'Parziale':'Non disponibile'
 }:latestDiaryCalories(p);
 const hasPlan=lazyMeta?!!lazyMeta.has_plan:!!currentProfessionalPlan(p.id);
 return `<div class="section-head"><h2>Riepilogo clinico-nutrizionale</h2>${(p.id==='main'||p.id.startsWith('patient-'))?'<button class="mini" id="editPatientProfileLegacy">Modifica scheda</button>':''}</div>
 <div class="patient-summary-grid">
  <div class="summary-hero"><span>Paziente</span><b>${esc(p.name||'—')}</b><small>${p.birth?fmt(p.birth)+' · '+ageFromBirth(p.birth)+' anni':'Età non disponibile'}</small></div>
  <div><span>Telefono</span><b>${esc(p.phone||'—')}</b></div>
  <div><span>Diagnosi / motivo</span><b>${esc(p.diagnosis||'—')}</b></div>
  <div><span>Data inizio percorso</span><b>${p.startDate?fmt(p.startDate):'—'}</b><small>${p.startDate?'Inizio reale del percorso con il professionista':'Non ancora indicata'}</small></div>
  <div><span>Calorie e valori energetici</span><b>${p.showEnergyValues===false?'Nascosti al paziente':'Visibili al paziente'}</b><small>${p.showEnergyValues===false?'Il professionista mantiene le stime':'Visualizzazione paziente attiva'}</small></div><div><span>Accesso NUBEMO</span><b>${p.readOnly?'Sola consultazione':'Completo'}</b><small>${p.readOnly?'Inserimento e modifica dati disabilitati':'Tutte le funzionalità paziente attive'}</small></div>
  <div><span>Ultimo peso</span><b>${currentPatientWeight(p)!=null?currentPatientWeight(p).toFixed(1).replace('.',',')+' kg':'—'}</b></div>
  <div><span>BMI</span><b>${currentPatientWeight(p)&&p.height?bmi(currentPatientWeight(p),p.height).toFixed(1).replace('.',','):'—'}</b></div>
  <div><span>Obiettivo</span><b>${p.goal?p.goal+' kg':'—'}</b></div>
  <div><span>Vita / Fianchi</span><b>${m?`${m.waist||'—'} / ${m.hips||'—'} cm`:'—'}</b><small>${wh?'W/H '+wh.toFixed(2).replace('.',','):''}</small></div>
  <div><span>BMR stimato</span><b>${bmrVal?Math.round(bmrVal)+' kcal/giorno':'—'}</b><small>${bmrVal?'Metabolismo basale, senza attività':'Servono peso, altezza, nascita e sesso'}</small></div>
  <div><span>Dispendio giornaliero indicativo</span><b>${daily?Math.round(daily)+' kcal/giorno':'—'}</b><small>${daily?'BMR × livello di attività':p.activityFactor?'Completa i dati necessari al BMR':'Imposta il livello di attività'}</small></div>
  <div><span>Calorie stimate dal diario</span><b>${food?food.calories+' kcal':'—'}</b><small>${food?fmt(food.date)+' · stima '+food.qualityLabel.toLowerCase():'Nessun pasto interpretabile'}</small></div>
  <div><span>Piano alimentare</span><b>${hasPlan?'Disponibile':'Non caricato'}</b></div>
 </div>`;
}
function proAnamnesis(p){return `<div class="section-head"><h2>Anamnesi</h2></div><details class="pro-accordion" open><summary>Dati e stile di vita</summary><div class="pro-read-grid"><div><span>Diagnosi / motivo</span><b>${esc(p.diagnosis||'—')}</b></div><div><span>Peso teorico</span><b>${p.theoreticalWeight?p.theoreticalWeight+' kg':'—'}</b></div><div><span>Lavoro</span><b>${esc(p.work||'—')}</b></div><div><span>Attività fisica</span><b>${esc(p.activity||'—')}</b></div><div><span>Alvo</span><b>${esc(p.bowel||'—')}</b></div><div><span>Fumo</span><b>${esc(p.smoking||'—')}</b></div><div><span>Alcol</span><b>${esc(p.alcohol||'—')}</b></div><div><span>Metabolismo basale</span><b>${esc(p.metabolism||'—')}</b></div><div><span>FEEG</span><b>${esc(p.feeg||'—')}</b></div><div><span>Impedenziometria</span><b>${esc(p.impedance||'—')}</b></div></div></details><details class="pro-accordion"><summary>Familiarità</summary><div class="pro-read-grid"><div><span>Obesità</span><b>${p.famObesity?'Sì':'No'}</b></div><div><span>Diabete</span><b>${p.famDiabetes?'Sì':'No'}</b></div><div><span>Ipertensione</span><b>${p.famHypertension?'Sì':'No'}</b></div><div><span>Cardiovascolare</span><b>${p.famCardiovascular?'Sì':'No'}</b></div><div><span>Dislipidemie</span><b>${p.famDyslipidemia?'Sì':'No'}</b></div><div><span>Tiroide</span><b>${p.famThyroid?'Sì':'No'}</b></div></div></details><details class="pro-accordion"><summary>Anamnesi patologica</summary><div class="pro-read-grid"><div><span>Diete pregresse</span><b>${esc(p.previousDiets||'—')}</b></div><div><span>Allergie</span><b>${esc(p.allergies||'—')}</b></div><div><span>Farmaci</span><b>${esc(p.medications||'—')}</b></div><div><span>Disturbi GI</span><b>${esc(p.giIssues||'—')}</b></div><div><span>Patologie / interventi</span><b>${esc(p.pastConditions||'—')}</b></div><div><span>Osservazioni</span><b>${esc(p.observations||'—')}</b></div><div><span>Obiettivi</span><b>${esc(p.objectives||'—')}</b></div></div></details>`}function proLabs(p){const r=labsFor(p.id),f=[['glucose','Glicemia'],['cholesterol','Colesterolo'],['hdl','HDL'],['ldl','LDL'],['triglycerides','Trigliceridi'],['got','GOT'],['gpt','GPT'],['uricAcid','Acido urico'],['creatinine','Creatinina'],['ggt','γGT']]; const bloodDocs=professionalBloodTestDocuments(p.id);
 const bloodDocsHtml=bloodDocs.length?`<div class="document-list">${bloodDocs.map(d=>`<div class="document-row ${d.unreadForProfessional===true?'document-row-unread':''}"><div><b>${esc(d.title)}${d.unreadForProfessional===true?'<span class="document-new-badge">NUOVO</span>':''}</b><span>${d.documentDate?fmt(d.documentDate):'Data non indicata'} · ${esc(d.fileName||'Documento')} · ${d.uploadedBy==='patient'?'Caricato dal paziente':'Caricato dal professionista'}</span></div><div class="document-row-actions">${pendingLabForDocument(d.id)?`<button class="primary compact" data-review-document-lab="${d.id}">Verifica valori</button>`:''}<button class="secondary compact" data-open-pro-document="${d.id}">Apri PDF</button><button class="mini danger-text" data-delete-pro-document="${d.id}">Elimina</button></div></div>`).join('')}</div>`:'<p class="muted">Nessun referto analisi caricato.</p>';
return `<div class="section-head"><h2>Esami ematici</h2><button class="mini" id="newLab">＋ Aggiungi esami</button></div><section class="labs-document-panel"><div class="subsection-title">Referti allegati</div>${bloodDocsHtml}</section>${r.length?`<div class="labs-table-desktop"><table class="labs-table"><thead><tr><th>Data</th>${f.map(x=>`<th>${x[1]}</th>`).join('')}<th></th></tr></thead><tbody>${r.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<tr><td>${fmt(x.date)}</td>${f.map(y=>`<td>${esc(x[y[0]]||'—')}</td>`).join('')}<td><button class="mini" data-edit-lab="${x.id}">Modifica</button></td></tr>`).join('')}</tbody></table></div><div class="labs-cards-mobile">${r.map(x=>`<div class="lab-card"><div class="section-head"><b>${fmt(x.date)}</b><button class="mini" data-edit-lab="${x.id}">Modifica</button></div><div class="lab-values">${f.map(y=>`<div><span>${y[1]}</span><b>${esc(x[y[0]]||'—')}</b></div>`).join('')}</div></div>`).join('')}</div>`:'<p class="muted">Nessun esame registrato.</p>'}`}function proPlan(p){
 const plans=professionalPlanDocuments(p.id),current=currentProfessionalPlan(p.id),legacy=planMetaFor(p.id),rows=[...plans];
 if(legacy&&!plans.some(x=>x.fileName===legacy.filename&&x.validFrom===(legacy.planDate||'')))rows.push({...legacy,id:'legacy-plan',title:documentTitleFromFile(legacy.filename||'Piano alimentare'),validFrom:legacy.planDate||'',legacy:true});
 rows.sort((a,b)=>String(b.validFrom||'').localeCompare(String(a.validFrom||'')));
 return `<div class="section-head"><h2>Piano alimentare</h2><span class="pill">${current?'Attivo':'Non caricato'}</span></div>
 ${current?`<section class="plan-current-summary"><div><span>PIANO IN VIGORE</span><b>${esc(current.title||documentTitleFromFile(current.filename||'Piano alimentare'))}</b><small>${current.validFrom?'Valido dal '+fmt(current.validFrom):'Decorrenza non indicata'}</small>${professionalPlanNote(current)?`<div class="plan-professional-note"><strong>Nota interna</strong><p>${esc(professionalPlanNote(current))}</p></div>`:''}</div><button class="secondary" data-open-pro-plan="${current.id}">Apri PDF</button></section>`:'<p class="muted">Nessun piano attualmente in vigore.</p>'}
 <button class="primary document-pro-upload" id="uploadPlan">＋ Carica nuovo piano</button>
 <input id="planFile" type="file" accept=".pdf,application/pdf" hidden>
 <section class="plan-upload-form" id="planUploadForm" hidden><label>File</label><div class="document-file-name" id="planUploadFileName"></div><label>Titolo piano</label><input id="planUploadTitle"><label>Valido dal</label>${proDateControl('planValidFrom',today())}<label>Nota professionista <span class="muted">(facoltativa)</span></label><textarea id="planProfessionalNote" rows="3" placeholder="Es. Piano chetogenico per accelerazione del processo"></textarea><p class="muted plan-private-note-help">Nota interna: non sarà visibile al paziente.</p><div class="pro3-actions"><button class="primary" id="saveNewPlan">Pubblica piano</button><button class="secondary" id="cancelNewPlan">Annulla</button></div></section>
 <div class="section-head plan-history-head"><h3>Storico piani</h3><span class="pill">${rows.length}</span></div>
 ${rows.length?`<div class="document-list">${rows.map(d=>{const future=d.validFrom&&d.validFrom>today(),isCurrent=current&&d.id===current.id;return `<div class="document-row plan-history-row"><div class="plan-history-copy"><b>${esc(d.title||documentTitleFromFile(d.filename||'Piano alimentare'))}${isCurrent?'<span class="plan-status-badge">IN VIGORE</span>':future?'<span class="plan-future-badge">PROGRAMMATO</span>':''}</b><span>${d.validFrom?'Valido dal '+fmt(d.validFrom):'Decorrenza non indicata'} · ${esc(d.fileName||d.filename||'Piano alimentare')}</span>${professionalPlanNote(d)?`<div class="plan-professional-note"><strong>Nota interna</strong><p>${esc(professionalPlanNote(d))}</p></div>`:'<div class="plan-professional-note empty"><strong>Nota interna</strong><p>Nessuna nota.</p></div>'}<div class="plan-note-editor" data-plan-note-editor="${d.id}" hidden><textarea rows="3">${esc(professionalPlanNote(d))}</textarea><div class="pro3-actions"><button class="secondary compact" type="button" data-cancel-plan-note="${d.id}">Annulla</button><button class="primary compact" type="button" data-save-plan-note="${d.id}">Salva nota</button></div></div></div><div class="document-row-actions"><button class="secondary compact" data-open-pro-plan="${d.id}">Apri</button><button class="mini" data-edit-plan-note="${d.id}">Modifica nota</button><button class="mini danger-text" data-delete-pro-plan="${d.id}">Elimina</button></div></div>`}).join('')}</div>`:'<p class="muted">Nessun piano nello storico.</p>'}`;
}
function proAccount(p){const a=accountFor(p.id);return `<div class="section-head"><h2>Account paziente</h2><span class="pill">${a?'Attivo':'Non attivo'}</span></div><p class="muted">Credenziali demo locali. Dopo averle salvate, vai in Area Paziente e premi <b>Esci</b>: comparirà la schermata login dove puoi provare username e password.</p><label>Username</label><input id="accUser" value="${esc(a?.username||'')}"><label>Password demo</label><input id="accPass" value="${esc(a?.password||'')}"><div class="pro3-actions"><button class="primary" id="savePatientAccount">${a?'Aggiorna account':'Crea account'}</button>${a?'<button class="secondary" id="deletePatientAccount">Disattiva account</button>':''}</div>`}
function privacyPdfBlob(p){const lines=['INFORMATIVA E CONSENSO - DEMO','',`Paziente: ${p.name||''}`,`Data di nascita: ${p.birth?fmt(p.birth):''}`,`Diagnosi/motivo: ${p.diagnosis||''}`,'','Modulo dimostrativo precompilato con i dati della scheda.','Il testo privacy definitivo dovra essere validato per il prodotto reale.','','Firma paziente: ______________________________','Data: __________________'];const ep=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,' ').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');let st='BT /F1 11 Tf 50 800 Td '+lines.map((l,i)=>`${i?'0 -24 Td ':''}(${ep(l)}) Tj`).join('\n')+' ET\n',o=['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];const add=x=>(o.push(x),o.length),pages=add('P'),content=add(`<< /Length ${st.length} >>\nstream\n${st}endstream`),page=add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 1 0 R >> >> /Contents ${content} 0 R >>`);o[pages-1]=`<< /Type /Pages /Count 1 /Kids [${page} 0 R] >>`;const cat=add(`<< /Type /Catalog /Pages ${pages} 0 R >>`);let pdf='%PDF-1.4\n',off=[0];o.forEach((x,i)=>{off[i+1]=pdf.length;pdf+=`${i+1} 0 obj\n${x}\nendobj\n`});const xr=pdf.length;pdf+=`xref\n0 ${o.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=o.length;i++)pdf+=String(off[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${o.length+1} /Root ${cat} 0 R >>\nstartxref\n${xr}\n%%EOF`;return new Blob([pdf],{type:'application/pdf'})}
async function storePrivacyPdf(id,b){const db=await openPlanDb();return new Promise((res,rej)=>{const tx=db.transaction('privacy','readwrite');tx.objectStore('privacy').put(b,id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function readPrivacyPdf(id){const db=await openPlanDb();return new Promise((res,rej)=>{const r=db.transaction('privacy','readonly').objectStore('privacy').get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
function proPrivacy(p){const m=privacyMetaFor(p.id);return `<div class="section-head"><h2>Privacy</h2><span class="pill">${m?'PDF firmato presente':'Da completare'}</span></div><div class="pro-read-grid"><div><span>Paziente</span><b>${esc(p.name||'—')}</b></div><div><span>Data di nascita</span><b>${p.birth?fmt(p.birth):'—'}</b></div><div><span>Diagnosi / motivo</span><b>${esc(p.diagnosis||'—')}</b></div></div><p class="muted">Modulo demo precompilato. Il testo legale definitivo dovrà essere validato.</p><div class="pro3-actions"><button class="secondary" id="downloadPrivacyForm">↓ Scarica modulo PDF</button><button class="secondary" id="uploadSignedPrivacy">↑ Carica PDF firmato</button>${m?'<button class="secondary" id="openSignedPrivacy">Apri firmato</button>':''}</div><input id="signedPrivacyFile" type="file" accept="application/pdf,.pdf" style="display:none">`}

function pendingLabForDocument(documentId){
 return Object.values(pendingLabs()).find(x=>x.documentId===documentId&&x.status==='Da verificare')||null;
}
async function readPendingLabPdf(item){
 if(item?.documentId){
   const meta=documentMetaList().find(d=>d.id===item.documentId);
   if(!meta)return null;
   const blob=await readDocumentBlob(meta.fileId);
   return blob?await blob.arrayBuffer():null;
 }
 return item?.key?readLabUploadPdf(item.key):null;
}
async function deletePendingLabSource(item){
 if(item?.documentId){
   const items=documentMetaList(),meta=items.find(d=>d.id===item.documentId);
   if(meta){
     await deleteDocumentBlob(meta.fileId);
     saveDocumentMetaList(items.filter(d=>d.id!==meta.id));
   }
   return;
 }
 if(item?.key)await deleteLabUploadPdf(item.key);
}
function markBloodTestDocumentRead(documentId){
 if(!documentId)return;
 const items=documentMetaList(),d=items.find(x=>x.id===documentId);
 if(d&&d.unreadForProfessional===true){
   d.unreadForProfessional=false;
   saveDocumentMetaList(items);
 }
}
async function readLabUploadPdf(key){const db=await openPlanDb();return new Promise((res,rej)=>{const r=db.transaction('labUploads','readonly').objectStore('labUploads').get(key);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
async function deleteLabUploadPdf(key){const db=await openPlanDb();return new Promise((res,rej)=>{const tx=db.transaction('labUploads','readwrite');tx.objectStore('labUploads').delete(key);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
function labReview(){const item=pendingLabs()[window.reviewLabKey];if(!item)return `${top('Referto non trovato')}`;const p=patient(item.patientId);selected=item.patientId;const f=(id,l)=>`<label>${l}<input id="rev${id}" value="${esc(item.values?.[id]||'')}"></label>`;return `${top('Verifica analisi')}<section class="card"><div class="section-head"><h2>${esc(p?.name||'Paziente')}</h2><span class="pill">Da verificare</span></div><p class="muted">${esc(item.filename||'')} · ${esc(item.note||'Controlla i valori estratti.')}</p><div class="form-grid"><label>Data${proDateControl('revDate',item.values?.date||today())}</label>${f('glucose','Glicemia')}${f('cholesterol','Colesterolo')}${f('hdl','HDL')}${f('ldl','LDL')}${f('triglycerides','Trigliceridi')}${f('got','GOT')}${f('gpt','GPT')}${f('uricAcid','Acido urico')}${f('creatinine','Creatinina')}${f('ggt','γGT')}</div><div class="pro3-actions lab-review-actions"><button class="secondary" id="openLabReviewPdf">Apri PDF</button><button class="danger-soft" id="deleteLabReview">Elimina</button><button class="secondary" id="cancelLabReview">Annulla</button><button class="primary" id="confirmLabReview">Conferma e inserisci</button></div></section>`}

function tabContent(p){
 if(tab==='summary')return proSummary2(p);
 if(tab==='anamnesis')return proAnamnesis(p);
 if(tab==='labs')return proLabs(p);
 if(tab==='plan')return proPlan(p);
 if(tab==='documents')return proDocuments(p);
 if(tab==='privacy')return proPrivacy(p);
 if(tab==='account')return proAccount(p);
 if(tab==='diary')return proDiaryHistory(p);
 if(tab==='trend')return proTrendContent(p);
 if(tab==='measures')return `<div class="section-head"><h2>Misure</h2><button class="mini" id="newPatientMeasure">＋ Aggiungi misura</button></div>
 <div class="measure-table-wrap"><table class="measure-table"><thead><tr><th>Data</th><th>Peso rilevato</th><th>Vita</th><th>Fianchi</th><th>Note</th><th></th></tr></thead><tbody>
 ${(p.measures||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(m=>`<tr>
   <td>${fmt(m.date)}</td><td>${m.professionalWeight!==''&&m.professionalWeight!=null?Number(m.professionalWeight).toFixed(1).replace('.',',')+' kg':'—'}</td><td>${m.waist!==''&&m.waist!=null?m.waist:'—'}</td><td>${m.hips!==''&&m.hips!=null?m.hips:'—'}</td><td>${esc(m.notes||'')}</td>
   <td><button class="mini" data-edit-measure="${m.date}">Modifica</button></td>
 </tr>`).join('')||'<tr><td colspan="6">Nessuna misura.</td></tr>'}
 </tbody></table></div>`;
 if(tab==='visits')return appointments().filter(a=>a.patientId===p.id&&a.type!=='personal').sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).map(a=>`<button class="pro3-event ${typeClass(a.type)} pro3-event-clickable" data-edit-visit="${a.id}"><b>${fmt(a.date)} · ${a.time}</b><span>${typeLabel(a.type)} · ${a.duration} min</span></button>`).join('')||'<p class="muted">Nessuna visita.</p>';
 const notes=load(NOTES_KEY,{});
 return `<textarea id="noteText" rows="7" placeholder="Note professionista">${esc(notes[p.id]||'')}</textarea><button class="primary" id="saveNote">Salva nota</button>`;
}



function newPatientForm(){
 return `${top('Nuovo paziente')}
 <section class="card">
   <h2>Dati personali</h2>
   <label>Nome</label>
   <input id="npName" type="text" placeholder="es. Mario">

   <label>Cognome</label>
   <input id="npSurname" type="text" placeholder="es. Rossi">

   <label>Data di nascita</label>
   ${proDateControl('npBirth','')}

   <label>Sesso</label>
   <select id="npSex">
     <option value="">Non specificato</option>
     <option value="M">Maschile</option>
     <option value="F">Femminile</option>
     <option value="X">Altro / preferisco non specificare</option>
   </select>

   <label>Altezza (cm)</label>
   <input id="npHeight" type="number" min="80" max="250" step="1" placeholder="es. 175">

   <label>Peso obiettivo (kg)</label>
   <input id="npGoal" type="number" min="30" max="300" step="0.1" placeholder="Facoltativo">

   <label>Data prossima visita</label>

   <h2 style="margin-top:22px">Storia del peso</h2>
   <label>Peso minimo storico (kg)</label>
   <input id="npMinWeight" type="number" min="30" max="300" step="0.1" placeholder="Facoltativo">

   <label>Peso massimo storico (kg)</label>
   <input id="npMaxWeight" type="number" min="30" max="300" step="0.1" placeholder="Facoltativo">

   <label>Peso ragionevole / concordato (kg)</label>
   <input id="npReasonableWeight" type="number" min="30" max="300" step="0.1" placeholder="Facoltativo">

   <h2 style="margin-top:22px">Stile di vita</h2>
   <label>Attività lavorativa</label>
   <textarea id="npWork" rows="2" placeholder="Campo libero"></textarea>

   <label>Attività fisica abituale</label>
   <textarea id="npActivity" rows="2" placeholder="es. camminate, palestra, sport"></textarea>
   <label>Livello attività per stima energetica</label><select id="npActivityFactor"><option value="">Non impostato</option><option value="1.2">Sedentario</option><option value="1.375">Leggermente attivo</option><option value="1.55">Moderatamente attivo</option><option value="1.725">Molto attivo</option><option value="1.9">Estremamente attivo</option></select>

   <label>Fumo</label>
   <input id="npSmoking" type="text" placeholder="Campo libero">

   <label>Alcol</label>
   <input id="npAlcohol" type="text" placeholder="Campo libero">

<details class="pro-accordion"><summary>Dati clinici aggiuntivi</summary><label>Diagnosi / motivo</label><textarea id="npDiagnosis"></textarea><label>Peso teorico (kg)</label><input id="npTheoreticalWeight" type="number" step="0.1"><label>Alvo</label><input id="npBowel"><label>Metabolismo basale</label><input id="npMetabolism"><label>FEEG / fabbisogno</label><input id="npFeeg"><label>Impedenziometria</label><input id="npImpedance"></details><details class="pro-accordion"><summary>Familiarità</summary><div class="check-grid"><label><input id="npFamObesity" type="checkbox"> Obesità</label><label><input id="npFamDiabetes" type="checkbox"> Diabete</label><label><input id="npFamHypertension" type="checkbox"> Ipertensione</label><label><input id="npFamCardiovascular" type="checkbox"> Cardiovascolare</label><label><input id="npFamDyslipidemia" type="checkbox"> Dislipidemie</label><label><input id="npFamThyroid" type="checkbox"> Tiroide</label></div></details><details class="pro-accordion"><summary>Anamnesi patologica e obiettivi</summary><label>Diete pregresse</label><textarea id="npPreviousDiets"></textarea><label>Allergie / intolleranze</label><textarea id="npAllergies"></textarea><label>Farmaci</label><textarea id="npMedications"></textarea><label>Disturbi gastrointestinali</label><textarea id="npGiIssues"></textarea><label>Patologie / interventi pregressi</label><textarea id="npPastConditions"></textarea><label>Osservazioni</label><textarea id="npObservations"></textarea><label>Obiettivi</label><textarea id="npObjectives"></textarea></details>   <div class="pro3-actions">
     <button class="secondary" id="cancelNewPatient">Annulla</button>
     <button class="primary" id="saveNewPatient">Salva paziente</button>
   </div>
 </section>`;
}

function editPatientProfileForm(){
 const p=patient(selected);
 if(!p)return `${top('Paziente non trovato')}`;

 let first=p.firstName||'', surname=p.surname||'';
 if(!first && p.name){
   const parts=String(p.name).trim().split(/\s+/);
   first=parts.shift()||'';
   if(!surname)surname=parts.join(' ');
 }

 return `${top('Modifica profilo paziente')}
 <section class="card">
   <h2>Dati personali</h2>
   <label>Nome</label><input id="epName" value="${esc(first)}">
   <label>Cognome</label><input id="epSurname" value="${esc(surname)}">
   <label>Data di nascita</label>${proDateControl('epBirth',p.birth||'')}
   <label>Sesso</label>
   <select id="epSex">
     <option value="" ${!p.sex?'selected':''}>Non specificato</option>
     <option value="M" ${p.sex==='M'?'selected':''}>Maschile</option>
     <option value="F" ${p.sex==='F'?'selected':''}>Femminile</option>
     <option value="X" ${p.sex==='X'?'selected':''}>Altro / preferisco non specificare</option>
   </select>
   <label>Altezza (cm)</label><input id="epHeight" type="number" min="80" max="250" step="1" value="${p.height||''}">
   <label>Peso obiettivo (kg)</label><input id="epGoal" type="number" min="30" max="300" step="0.1" value="${p.goal||''}">
   <label>Data inizio percorso</label>${proDateControl('epStartDate',p.startDate||'')}
   <p class="muted patient-start-date-help">Se il paziente era già seguito prima di NUBEMO, inserisci la data reale di inizio. Se resta vuota, la prima visita registrata può valorizzarla automaticamente.</p>

   <div class="patient-energy-setting">
     <h2>Impostazioni area paziente</h2>
     <label>Mostra calorie e valori energetici</label>
     <select id="epShowEnergyValues">
       <option value="yes" ${p.showEnergyValues!==false?'selected':''}>Sì</option>
       <option value="no" ${p.showEnergyValues===false?'selected':''}>No</option>
     </select>
     <p class="muted">Se impostato su No, il paziente non vedrà calorie stimate, BMR, informazioni energetiche né il controllo degli alimenti riconosciuti durante il salvataggio del diario. Il professionista continuerà a disporre delle stime.</p><label>NUBEMO in sola consultazione</label><select id="epReadOnly"><option value="no" ${!p.readOnly?'selected':''}>No</option><option value="yes" ${p.readOnly?'selected':''}>Sì</option></select><p class="muted">Se impostato su Sì, il paziente può consultare ed esportare lo storico, ma non può inserire, modificare, eliminare, importare o ripristinare dati.</p>
   </div>

   <h2 style="margin-top:22px">Storia del peso</h2>
   <label>Peso minimo storico (kg)</label><input id="epMinWeight" type="number" min="30" max="300" step="0.1" value="${p.minWeight||''}">
   <label>Peso massimo storico (kg)</label><input id="epMaxWeight" type="number" min="30" max="300" step="0.1" value="${p.maxWeight||''}">
   <label>Peso ragionevole / concordato (kg)</label><input id="epReasonableWeight" type="number" min="30" max="300" step="0.1" value="${p.reasonableWeight||''}">

   <h2 style="margin-top:22px">Stile di vita</h2>
   <label>Attività lavorativa</label><textarea id="epWork" rows="2">${esc(p.work||'')}</textarea>
   <label>Attività fisica abituale</label><textarea id="epActivity" rows="2">${esc(p.activity||'')}</textarea><label>Livello attività per stima energetica</label><select id="epActivityFactor"><option value="">Non impostato</option><option value="1.2" ${String(p.activityFactor)==='1.2'?'selected':''}>Sedentario</option><option value="1.375" ${String(p.activityFactor)==='1.375'?'selected':''}>Leggermente attivo</option><option value="1.55" ${String(p.activityFactor)==='1.55'?'selected':''}>Moderatamente attivo</option><option value="1.725" ${String(p.activityFactor)==='1.725'?'selected':''}>Molto attivo</option><option value="1.9" ${String(p.activityFactor)==='1.9'?'selected':''}>Estremamente attivo</option></select>
   <label>Fumo</label><input id="epSmoking" value="${esc(p.smoking||'')}">
   <label>Alcol</label><input id="epAlcohol" value="${esc(p.alcohol||'')}">

<details class="pro-accordion"><summary>Dati clinici aggiuntivi</summary><label>Diagnosi / motivo</label><textarea id="epDiagnosis"></textarea><label>Peso teorico (kg)</label><input id="epTheoreticalWeight" type="number" step="0.1"><label>Alvo</label><input id="epBowel"><label>Metabolismo basale</label><input id="epMetabolism"><label>FEEG / fabbisogno</label><input id="epFeeg"><label>Impedenziometria</label><input id="epImpedance"></details><details class="pro-accordion"><summary>Familiarità</summary><div class="check-grid"><label><input id="epFamObesity" type="checkbox"> Obesità</label><label><input id="epFamDiabetes" type="checkbox"> Diabete</label><label><input id="epFamHypertension" type="checkbox"> Ipertensione</label><label><input id="epFamCardiovascular" type="checkbox"> Cardiovascolare</label><label><input id="epFamDyslipidemia" type="checkbox"> Dislipidemie</label><label><input id="epFamThyroid" type="checkbox"> Tiroide</label></div></details><details class="pro-accordion"><summary>Anamnesi patologica e obiettivi</summary><label>Diete pregresse</label><textarea id="epPreviousDiets"></textarea><label>Allergie / intolleranze</label><textarea id="epAllergies"></textarea><label>Farmaci</label><textarea id="epMedications"></textarea><label>Disturbi gastrointestinali</label><textarea id="epGiIssues"></textarea><label>Patologie / interventi pregressi</label><textarea id="epPastConditions"></textarea><label>Osservazioni</label><textarea id="epObservations"></textarea><label>Obiettivi</label><textarea id="epObjectives"></textarea></details>   <div class="pro3-actions">
     <button class="secondary" id="cancelEditProfile">Annulla</button>
     <button class="primary" id="saveEditProfile">Salva modifiche</button>
   </div>
 </section>`;
}

function saveEditedPatientProfile(){
 const p=patient(selected);
 if(!p)return;

 const first=(el('epName')?.value||'').trim();
 const surname=(el('epSurname')?.value||'').trim();
 if(!first || !surname)return alert('Inserisci nome e cognome.');

 const num=id=>{
   const v=(el(id)?.value||'').trim().replace(',','.');
   return v===''?'':Number(v);
 };

 const height=num('epHeight');
 const goal=num('epGoal');
 const minWeight=num('epMinWeight');
 const maxWeight=num('epMaxWeight');
 const reasonableWeight=num('epReasonableWeight');

 if(height!=='' && (!Number.isFinite(height) || height<80 || height>250))return alert('Controlla l’altezza inserita.');
 for(const v of [goal,minWeight,maxWeight,reasonableWeight]){
   if(v!=='' && (!Number.isFinite(v) || v<30 || v>300))return alert('Controlla i valori di peso inseriti.');
 }

 const patch={
   name:first,
   surname,
   birth:readProDate('epBirth')||'',
   sex:el('epSex')?.value||'',
   height,
   goal,
   startDate:readProDate('epStartDate')||'',
   showEnergyValues:(el('epShowEnergyValues')?.value||'yes')!=='no',
   readOnly:(el('epReadOnly')?.value||'no')==='yes',
   minWeight,
   maxWeight,
   reasonableWeight,
   work:(el('epWork')?.value||'').trim(),
   activity:(el('epActivity')?.value||'').trim(),activityFactor:el('epActivityFactor')?.value||'',
   smoking:(el('epSmoking')?.value||'').trim(),
   alcohol:(el('epAlcohol')?.value||'').trim(), diagnosis:(el('epDiagnosis')?.value||'').trim(), theoreticalWeight:num('epTheoreticalWeight'), bowel:(el('epBowel')?.value||'').trim(), metabolism:(el('epMetabolism')?.value||'').trim(), feeg:(el('epFeeg')?.value||'').trim(), impedance:(el('epImpedance')?.value||'').trim(), famObesity:!!el('epFamObesity')?.checked, famDiabetes:!!el('epFamDiabetes')?.checked, famHypertension:!!el('epFamHypertension')?.checked, famCardiovascular:!!el('epFamCardiovascular')?.checked, famDyslipidemia:!!el('epFamDyslipidemia')?.checked, famThyroid:!!el('epFamThyroid')?.checked, previousDiets:(el('epPreviousDiets')?.value||'').trim(), allergies:(el('epAllergies')?.value||'').trim(), medications:(el('epMedications')?.value||'').trim(), giIssues:(el('epGiIssues')?.value||'').trim(), pastConditions:(el('epPastConditions')?.value||'').trim(), observations:(el('epObservations')?.value||'').trim(), objectives:(el('epObjectives')?.value||'').trim()
 };

 if(selected==='main'){
   const current=load(PROFILE_KEY,{});
   save(PROFILE_KEY,{...current,...patch});
 }else{
   const arr=extraPatients();
   const i=arr.findIndex(x=>x.id===selected);
   if(i<0)return alert('Questo paziente demo non è modificabile.');
   arr[i]={...arr[i],...patch,firstName:first,name:`${first} ${surname}`};
   saveExtraPatients(arr);
 }
 savePatientStartDate(selected,patch.startDate||'');

 tab='summary';
 view='details';
 render();
}


function labForm(){const p=patient(selected),r=labsFor(p.id),x=window.editLabId?r.find(y=>y.id===window.editLabId):null,f=(id,l)=>`<label>${l}<input id="lab${id}" value="${esc(x?.[id]||'')}"></label>`;return `${top(x?'Modifica esami':'Nuovi esami')}<section class="card"><div class="form-grid"><label>Data${proDateControl('labDate',x?.date||today())}</label>${f('glucose','Glicemia')}${f('cholesterol','Colesterolo')}${f('hdl','HDL')}${f('ldl','LDL')}${f('triglycerides','Trigliceridi')}${f('got','GOT')}${f('gpt','GPT')}${f('uricAcid','Acido urico')}${f('creatinine','Creatinina')}${f('ggt','γGT')}</div><div class="pro3-actions">${x?'<button class="mini danger-text" id="deleteLab">Elimina</button>':''}<button class="secondary" id="cancelLab">Annulla</button><button class="primary" id="saveLab">Salva</button></div></section>`}function saveLab(){const p=patient(selected),o={id:window.editLabId||'lab-'+Date.now(),date:readProDate('labDate')||today()};['glucose','cholesterol','hdl','ldl','triglycerides','got','gpt','uricAcid','creatinine','ggt'].forEach(k=>o[k]=(el('lab'+k)?.value||'').trim());let r=labsFor(p.id),i=r.findIndex(x=>x.id===o.id);if(i>=0)r[i]=o;else r.push(o);saveLabsFor(p.id,r);window.editLabId='';tab='labs';view='details';render()}async function deleteLab(){
 const p=patient(selected);
 const lab=labsFor(p.id).find(x=>x.id===window.editLabId);
 if(!lab)return;
 if(!confirm(`Eliminare la registrazione dei valori del ${fmt(lab.date)}?`))return;

 const docs=bloodTestDocumentsOnDate(p.id,lab.date);
 let deletePdf=false;
 if(docs.length===1){
   deletePdf=confirm(`Vuoi eliminare anche il PDF del referto del ${fmt(lab.date)}?`);
 }else if(docs.length>1){
   alert(`Per il ${fmt(lab.date)} risultano presenti più referti PDF. I valori verranno eliminati, ma i PDF saranno mantenuti per evitare una cancellazione ambigua.`);
 }

 saveLabsFor(p.id,labsFor(p.id).filter(x=>x.id!==window.editLabId));

 if(deletePdf){
   const d=docs[0];
   try{
     await deleteDocumentBlob(d.fileId);
     saveDocumentMetaList(documentMetaList().filter(x=>x.id!==d.id));
     const pending=pendingLabs();
     Object.keys(pending).forEach(k=>{if(pending[k]?.documentId===d.id)delete pending[k]});
     savePendingLabs(pending);
   }catch(err){
     console.error(err);
     alert('I valori sono stati eliminati, ma non sono riuscito a eliminare il PDF.');
   }
 }

 window.editLabId='';
 tab='labs';
 view='details';
 render();
}
function patientMeasureForm(){
 const p=patient(selected);
 if(!p)return `${top('Paziente non trovato')}`;
 const existing=window.editMeasureDate?(p.measures||[]).find(x=>x.date===window.editMeasureDate):null;
 return `${top(existing?'Modifica misurazione':'Nuova misurazione')}
 <section class="card">
   <label>Data</label>${proDateControl('pmDate',existing?.date||today())}
   <label>Peso rilevato dal professionista (kg)</label><input id="pmProfessionalWeight" type="number" min="30" max="300" step="0.1" value="${existing?.professionalWeight??''}" placeholder="Facoltativo">
   <label>Circonferenza vita (cm)</label><input id="pmWaist" type="number" min="20" max="300" step="0.1" value="${existing?.waist??''}">
   <label>Circonferenza fianchi (cm)</label><input id="pmHips" type="number" min="20" max="300" step="0.1" value="${existing?.hips??''}">
   <label>Note</label><textarea id="pmNotes" rows="3">${esc(existing?.notes||'')}</textarea>
   <div class="pro3-actions"><button class="secondary" id="cancelPatientMeasure">Annulla</button><button class="primary" id="savePatientMeasure">${existing?'Salva modifiche':'Salva misura'}</button></div>
 </section>`;
}
function savePatientMeasure(){
 const p=patient(selected); if(!p)return;
 const date=readProDate('pmDate',true); if(!date)return;
 const num=id=>{const v=(el(id)?.value||'').trim().replace(',','.');return v===''?'':Number(v)};
 const professionalWeight=num('pmProfessionalWeight'),waist=num('pmWaist'),hips=num('pmHips');
 if(professionalWeight!==''&&(!Number.isFinite(professionalWeight)||professionalWeight<30||professionalWeight>300))return alert('Controlla il peso rilevato.');
 for(const [label,v] of [['vita',waist],['fianchi',hips]])if(v!==''&&(!Number.isFinite(v)||v<20||v>300))return alert(`Controlla il valore ${label}.`);
 const obj={date,professionalWeight,waist,hips,notes:(el('pmNotes')?.value||'').trim()};
 const oldDate=window.editMeasureDate;

 if(selected==='main'){
   let arr=load(MEASURE_KEY,[]);
   if(oldDate&&oldDate!==date)arr=arr.filter(x=>x.date!==oldDate);
   const i=arr.findIndex(x=>x.date===date); if(i>=0)arr[i]=obj; else arr.push(obj);
   save(MEASURE_KEY,arr);
 }else{
   const extra=extraPatients(),ei=extra.findIndex(x=>x.id===selected);
   if(ei>=0){
     let ms=Array.isArray(extra[ei].measures)?extra[ei].measures:[];
     if(oldDate&&oldDate!==date)ms=ms.filter(x=>x.date!==oldDate);
     const i=ms.findIndex(x=>x.date===date); if(i>=0)ms[i]=obj; else ms.push(obj);
     extra[ei]={...extra[ei],measures:ms}; saveExtraPatients(extra);
   }else{
     const ov=load(DEMO_MEASURES_KEY,{});
     let ms=Array.isArray(ov[selected])?ov[selected]:((p.measures||[]).map(x=>({...x})));
     if(oldDate&&oldDate!==date)ms=ms.filter(x=>x.date!==oldDate);
     const i=ms.findIndex(x=>x.date===date); if(i>=0)ms[i]=obj; else ms.push(obj);
     ov[selected]=ms; save(DEMO_MEASURES_KEY,ov);
   }
 }
 window.editMeasureDate=null; tab='measures'; view='details'; render();
}


function deleteSelectedPatient(){
 const p=patient(selected);
 if(!p)return;
 if(!confirm(`Vuoi eliminare il paziente ${p.name} dall'Area Professionista?`))return;

 if(p.id!=='main'){
   const extras=extraPatients();
   const remaining=extras.filter(x=>x.id!==p.id);
   if(remaining.length!==extras.length)saveExtraPatients(remaining);
 }

 const deleted=new Set(load(DELETED_PATIENTS_KEY,[]));
 deleted.add(p.id);
 save(DELETED_PATIENTS_KEY,[...deleted]);

 save(APPT_KEY,appointments().filter(a=>a.patientId!==p.id));

 const notes=load(NOTES_KEY,{});
 if(Object.prototype.hasOwnProperty.call(notes,p.id)){delete notes[p.id];save(NOTES_KEY,notes)}

 const demoMeasures=load(DEMO_MEASURES_KEY,{});
 if(Object.prototype.hasOwnProperty.call(demoMeasures,p.id)){delete demoMeasures[p.id];save(DEMO_MEASURES_KEY,demoMeasures)}

 const accounts=load(ACCOUNT_KEY,{});
 if(Object.prototype.hasOwnProperty.call(accounts,p.id)){delete accounts[p.id];save(ACCOUNT_KEY,accounts)}

 const remainingPatients=patients();
 selected=remainingPatients[0]?.id||'';
 tab='summary';
 view='patients';
 render();
}

function agenda(){
 if(!(weekDate instanceof Date) || Number.isNaN(weekDate.getTime())){
   weekDate=new Date(today()+'T12:00:00');
 }
 const monday=getMonday(weekDate),s=settings(),dayCount=Number(s.workDays)===6?6:5,days=Array.from({length:dayCount},(_,i)=>addDays(monday,i));
 // Griglia a 15 minuti: consente di rappresentare correttamente durate
 // non multiple di mezz'ora (es. 45'). L'altezza per ora resta invariata
 // (4 righe da 23px = 92px, come prima 2 righe da 46px).
 const start=timeMin(s.dayStart),end=timeMin(s.dayEnd),step=15,slots=[];
 for(let m=start;m<end;m+=step)slots.push(m);

 const evs=appointments().filter(a=>days.some(d=>iso(d)===a.date));
 let grid=`<div class="pro3-calendar" style="grid-template-columns:55px repeat(${days.length},minmax(135px,1fr));grid-template-rows:48px repeat(${slots.length},23px)">`;
 grid+=`<div></div>`;
 days.forEach((d,i)=>grid+=`<div class="pro3-dayhead" style="grid-column:${i+2};grid-row:1"><b>${d.toLocaleDateString('it-IT',{weekday:'short'})}</b><span>${d.getDate()}</span></div>`);
 slots.forEach((m,i)=>grid+=`<div class="pro3-time" style="grid-column:1;grid-row:${i+2}">${m%30===0?minTime(m):''}</div>`);
 days.forEach((d,di)=>slots.forEach((m,si)=>grid+=`<button class="pro3-slot" data-date="${iso(d)}" data-time="${minTime(m)}" style="grid-column:${di+2};grid-row:${si+2}"></button>`));
 evs.forEach(a=>{
   const di=days.findIndex(d=>iso(d)===a.date),si=Math.max(0,Math.round((timeMin(a.time)-start)/step)),span=Math.max(1,Math.ceil(a.duration/step));
   const p=a.patientId?patient(a.patientId):null;
   grid+=`<button class="pro3-cal-event ${typeClass(a.type)}" data-event="${a.id}" style="grid-column:${di+2};grid-row:${si+2}/span ${span}"><b>${a.time}</b><span>${a.type==='personal'?esc(a.title||'Impegno personale'):esc(p?.name||'Paziente')}</span></button>`;
 });
 grid+='</div>';
 return `${top('Agenda')}${nav()}
 <section class="card pro3-agenda-tools"><button class="mini" id="prevWeek">‹</button><button class="mini" id="todayWeek">Oggi</button><button class="mini" id="nextWeek">›</button><span>${fmt(iso(days[0]))} — ${fmt(iso(days[days.length-1]))}</span><button class="primary" id="newEvent">＋ Nuovo evento</button></section>
 <section class="card"><div class="pro3-legend"><span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#fff4bf;border-left:4px solid #e4b93f;margin-right:5px;vertical-align:-2px"></i>Prima visita</span><span>🟩 Controllo</span><span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#eceff1;border-left:4px solid #8b969c;margin-right:5px;vertical-align:-2px"></i>Impegno personale</span></div></section>
 <section class="card pro3-calendar-wrap">${grid}</section>`;
}


function professionalDisplayName(s=settings()){
 const n=[s.firstName,s.surname].filter(Boolean).join(' ').trim();
 return n||s.name||'Professionista';
}
function proSupportPage(){
 // Corpo della pagina delegato a nubemo-support.js (riscrittura Assistenza).
 // Intestazione e nav restano qui perche' appartengono alla shell PRO.
 return `${top('Assistenza NUBEMO')}${nav()}
 ${window.NubemoSupport.professionalBody()}`;
}

function settingsPage(){
 // Corpo della pagina delegato a pro-profile.js (riscrittura Profilo professionista).
 // Intestazione e nav restano qui perche' appartengono alla shell PRO.
 return `${top('Profilo professionista')}${nav()}
 ${window.NubemoProfessionalProfile.body(settings())}`;
}

function eventForm(prefill){
 const s=settings();
 const a=editing||{type:'control',patientId:prefill?.patientId||'',date:prefill?.date||today(),time:prefill?.time||'09:00',duration:s.control,title:'Impegno personale',note:''};
 return `${top(editing?'Modifica evento':'Nuovo evento')}<section class="card">
 <label>Tipo evento</label><select id="eType"><option value="first" ${a.type==='first'?'selected':''}>Prima visita</option><option value="control" ${a.type==='control'?'selected':''}>Controllo</option><option value="personal" ${a.type==='personal'?'selected':''}>Impegno personale</option></select>
 <div id="patientBox" style="${a.type==='personal'?'display:none':''}">
   <label>Paziente</label>
   <div class="agenda-patient-picker">
     <input id="ePatientSearch" type="search" placeholder="Cerca paziente per nome o cognome..." autocomplete="off">
     <input id="ePatient" type="hidden" value="${esc(a.patientId||'')}">
     <div id="ePatientResults" class="agenda-patient-results">
       ${patients().map(p=>`<button type="button" class="agenda-patient-option ${p.id===a.patientId?'selected':''}" data-agenda-patient="${p.id}"><span>${esc(p.name)}</span>${p.phone?`<small>${esc(p.phone)}</small>`:''}</button>`).join('')}
     </div>
     <button type="button" class="secondary agenda-new-patient-toggle" id="agendaNewPatientToggle">＋ Nuovo paziente</button>
     <div id="agendaQuickPatient" class="agenda-quick-patient" hidden>
       <div class="section-head"><h3>Nuovo paziente rapido</h3><span class="pill">Agenda</span></div>
       <p class="muted">Inserisci i dati essenziali. La scheda completa potrà essere compilata successivamente.</p>
       <div class="agenda-quick-grid">
         <label>Nome<input id="agendaNpName" type="text" autocomplete="given-name"></label>
         <label>Cognome<input id="agendaNpSurname" type="text" autocomplete="family-name"></label>
       </div>
       <label>Telefono<input id="agendaNpPhone" type="tel" inputmode="tel" autocomplete="tel"></label>
       <div class="pro3-actions">
         <button type="button" class="secondary" id="agendaCancelQuickPatient">Annulla</button>
         <button type="button" class="primary" id="agendaCreateQuickPatient">Crea e seleziona</button>
       </div>
     </div>
   </div>
 </div>
 <div id="titleBox" style="${a.type==='personal'?'':'display:none'}"><label>Titolo</label><input id="eTitle" value="${esc(a.title||'Impegno personale')}"></div>
 <label>Data</label>${proDateControl('eDate',a.date)}
 <label>Ora</label><input id="eTime" type="time" value="${a.time}">
 <label>Durata</label><input id="eDuration" type="number" step="5" value="${a.duration}">
 <label>Note</label><textarea id="eNote" rows="3">${esc(a.note||'')}</textarea>
 <div class="pro3-actions">${editing?'<button class="secondary" id="deleteEvent">Elimina appuntamento</button>':''}<button class="secondary" id="cancelEvent">Annulla</button><button class="primary" id="saveEvent">${editing?'Salva modifiche':'Salva'}</button></div>
 </section>`;
}


function selectAgendaPatient(id){
 const hidden=el('ePatient');
 if(hidden)hidden.value=id||'';
 document.querySelectorAll('[data-agenda-patient]').forEach(b=>b.classList.toggle('selected',b.dataset.agendaPatient===id));
}

function conflict(obj){
 const s=timeMin(obj.time),e=s+Number(obj.duration);
 return appointments().find(a=>{
  if(a.id===obj.id||a.date!==obj.date)return false;
  const as=timeMin(a.time),ae=as+Number(a.duration);
  return s<ae&&e>as;
 });
}


async function ensureProPatientHydrated(patientId){
 const adapter=window.nubemoProfessionalLegacyAdapter;
 if(!patientId||!adapter?.ensurePatientHydrated)return;
 await adapter.ensurePatientHydrated(patientId);
}
async function openPatientDetails(patientId,targetTab='summary'){
 if(!patientId)return;
 try{
   await ensureProPatientHydrated(patientId);
   selected=patientId;
   tab=targetTab||'summary';
   view='details';
   render();
   scrollTo(0,0);
 }catch(error){
   console.error('NUBEMO patient lazy load:',error);
   alert('Non riesco a caricare i dati del paziente. Riprova.');
 }
}

function closeProDrawer(){
 if(isPhoneLandscape()){
   proDrawerOpen=true;
   document.getElementById('proDrawer')?.classList.add('open');
   document.getElementById('proDrawerBackdrop')?.classList.remove('open');
   return;
 }
 proDrawerOpen=false;
 document.getElementById('proDrawer')?.classList.remove('open');
 document.getElementById('proDrawerBackdrop')?.classList.remove('open');
}
function bindProDrawer(){
 el('openProDrawer')?.addEventListener('click',()=>{
   proDrawerOpen=true;
   if(isPhoneLandscape()){
     syncPhoneLandscapeClass();
     el('proDrawer')?.classList.add('open');
     el('proDrawerBackdrop')?.classList.remove('open');
     return;
   }

   if(isPhoneLayout()){
     // Se il professionista è dentro la scheda di un paziente,
     // il ramo paziente si apre già espanso, come su iPad.
     drawerPatientExpanded=(view==='details');
   }

   el('proDrawer')?.classList.add('open');
   el('proDrawerBackdrop')?.classList.add('open');

   if(isPhoneLayout()){
     const group=el('proDrawer')?.querySelector('.drawer-group');
     const b=el('proDrawer')?.querySelector('[data-drawer-patient]');

     group?.classList.toggle('expanded',drawerPatientExpanded);

     if(b){
       b.setAttribute('aria-expanded',drawerPatientExpanded?'true':'false');
       const ch=b.querySelector('.drawer-chevron');
       if(ch)ch.textContent=drawerPatientExpanded?'⌃':'⌄';
     }
   }
 });
 el('closeProDrawer')?.addEventListener('click',closeProDrawer);
 el('proDrawerBackdrop')?.addEventListener('click',closeProDrawer);
 el('drawerProLogout')?.addEventListener('click',()=>{
   closeProDrawer();
   if(typeof window.nubemoProfessionalLogout==='function')window.nubemoProfessionalLogout();
 });

 document.querySelectorAll('[data-drawer-view]').forEach(b=>b.addEventListener('click',async()=>{
   const targetView=b.dataset.drawerView;
   if(targetView==='settings')await ensureProfessionalLogoData();
   view=targetView;
   if(view!=='details')selected=selected;
   if(!isPhoneLandscape())closeProDrawer();
   else proDrawerOpen=true;
   render();
   scrollTo(0,0);
 }));

 document.querySelectorAll('[data-drawer-tab]').forEach(b=>b.addEventListener('click',()=>{
   const targetTab=b.dataset.drawerTab;
   if(!isPhoneLandscape())closeProDrawer();
   else proDrawerOpen=true;
   void openPatientDetails(selected,targetTab);
 }));

 document.querySelector('[data-drawer-clinical]')?.addEventListener('click',async()=>{
   if(!isPhoneLandscape())closeProDrawer();
   else proDrawerOpen=true;
   try{await ensureProPatientHydrated(selected);setTimeout(clinicalDialog,0)}
   catch(error){console.error('NUBEMO patient lazy load:',error);alert('Non riesco a caricare i dati del paziente. Riprova.')}
 });

 document.querySelector('[data-drawer-patient]')?.addEventListener('click',e=>{
   if(isPhoneLayout()){
     e.preventDefault();
     drawerPatientExpanded=!drawerPatientExpanded;
     const group=e.currentTarget.closest('.drawer-group');
     group?.classList.toggle('expanded',drawerPatientExpanded);
     e.currentTarget.setAttribute('aria-expanded',drawerPatientExpanded?'true':'false');
     const ch=e.currentTarget.querySelector('.drawer-chevron');
     if(ch)ch.textContent=drawerPatientExpanded?'⌃':'⌄';
     if(isPhoneLandscape())proDrawerOpen=true;
     return;
   }
   closeProDrawer();
   void openPatientDetails(selected,tab||'summary');
 });
}

function render(){
 syncPhoneLandscapeClass();
 syncIPadLayoutClass();
 document.body.dataset.proView=view;
 try{
  let html=view==='dashboard'?dashboard():view==='patients'?patientsPage():view==='agenda'?agenda():view==='settings'?settingsPage():view==='support'?proSupportPage():view==='details'?details():view==='newPatient'?newPatientForm():view==='editProfile'?editPatientProfileForm():view==='patientMeasure'?patientMeasureForm():view==='labForm'?labForm():view==='labReview'?labReview():view==='diaryDay'?proDiaryDayView():eventForm(window.prefill||null);
  el('proApp').innerHTML=html;
  syncPhoneLandscapeClass();
  if(isPhoneLandscape()){
    proDrawerOpen=true;
    el('proDrawer')?.classList.add('open');
    el('proDrawerBackdrop')?.classList.remove('open');
  }
 bindProDrawer(); bind();
 }catch(err){
  console.error(err);
  el('proApp').innerHTML=`<section class="card"><h1>Errore Area Professionista</h1><p>${esc(err.message||err)}</p><a href="./index.html">Torna al login</a></section>`;
 }
}

function bind(){
 document.querySelectorAll('[data-review-document-lab]').forEach(b=>b.onclick=()=>{
   const item=pendingLabForDocument(b.dataset.reviewDocumentLab);
   if(!item)return alert('Valori già verificati o referto non disponibile.');
   markBloodTestDocumentRead(item.documentId);
   window.reviewLabKey=item.key;
   view='labReview';
   render();
 });
 document.querySelectorAll('[data-open-pro-document]').forEach(b=>b.onclick=()=>openProfessionalDocument(b.dataset.openProDocument));
 document.querySelectorAll('[data-delete-pro-document]').forEach(b=>b.onclick=async()=>{
 const id=b.dataset.deleteProDocument,items=documentMetaList(),d=items.find(x=>x.id===id&&x.patientId===selected);
 if(!d)return;
 if(!confirm(`Eliminare "${d.title}" dalla cartella del paziente?`))return;

 let deleteValues=false;
 if(d.subCategory==='blood_test'&&d.documentDate){
   const values=labRecordsOnDate(selected,d.documentDate);
   if(values.length===1){
     deleteValues=confirm(`Vuoi eliminare anche la registrazione dei valori del ${fmt(d.documentDate)}?`);
   }else if(values.length>1){
     alert(`Per il ${fmt(d.documentDate)} risultano presenti più registrazioni di valori. Il PDF verrà eliminato, ma i valori saranno mantenuti per evitare una cancellazione ambigua.`);
   }
 }

 try{
   await deleteDocumentBlob(d.fileId);
   saveDocumentMetaList(items.filter(x=>x.id!==id));

   if(d.subCategory==='blood_test'){
     const m=pendingLabs();
     Object.keys(m).forEach(k=>{if(m[k]?.documentId===id)delete m[k]});
     savePendingLabs(m);

     if(deleteValues){
       saveLabsFor(selected,labsFor(selected).filter(x=>x.date!==d.documentDate));
     }
   }
   render();
 }catch(e){
   console.error(e);
   alert('Non riesco a eliminare il documento.');
 }
});

 el('openUnreadLabPatients')?.addEventListener('click',()=>{
   view='patients';
   render();
   scrollTo(0,0);
 });
 el('openUnreadPatients')?.addEventListener('click',()=>{
   view='patients';
   render();
   scrollTo(0,0);
 });
 if(view==='details'&&tab==='documents')bindProDocuments();
 el('patientMenuEditProfile')?.addEventListener('click',()=>{
   view='editProfile';render();scrollTo(0,0);
 });
 el('patientMoreBtn')?.addEventListener('click',e=>{
   e.stopPropagation();
   el('patientMoreMenu')?.classList.toggle('open');
 });
 document.addEventListener('click',e=>{
   const wrap=e.target.closest?.('.patient-more-wrap');
   if(!wrap)el('patientMoreMenu')?.classList.remove('open');
 },{once:true});

 document.querySelectorAll('[data-patient-tab]').forEach(b=>b.addEventListener('click',()=>{
   tab=b.dataset.patientTab; view='details'; render(); scrollTo(0,0);
 }));

 el('desktopClinicalPdf')?.addEventListener('click',clinicalDialog);
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=async()=>{
   const targetView=b.dataset.view;
   if(targetView==='settings')await ensureProfessionalLogoData();
   view=targetView;
   render();
 });
 document.querySelectorAll('[data-patient]').forEach(b=>b.onclick=()=>{void openPatientDetails(b.dataset.patient,'summary')});
 document.querySelectorAll('[data-bmi-category]').forEach(b=>b.addEventListener('click',()=>{
   selectedBmiCategory=b.dataset.bmiCategory;
   render();
 }));
 el('clearBmiFilter')?.addEventListener('click',()=>{
   selectedBmiCategory='';
   render();
 });
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});
 document.querySelectorAll('[data-pro-trend]').forEach(b=>b.addEventListener('click',()=>{proTrendDays=Number(b.dataset.proTrend);render()}));
 document.querySelectorAll('[data-pro-bmi]').forEach(b=>b.addEventListener('click',()=>{proBmiDays=Number(b.dataset.proBmi);render()}));
 el('proMovingAverage')?.addEventListener('change',e=>{proShowMovingAverage=e.target.checked;render()});
 document.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>{editing=appointments().find(a=>a.id===b.dataset.event)||null;window.prefill=null;view='event';render()});
 document.querySelectorAll('.pro3-slot').forEach(b=>b.onclick=()=>{editing=null;window.prefill={date:b.dataset.date,time:b.dataset.time};view='event';render()});
 el('goAgenda')?.addEventListener('click',()=>{view='agenda';render()});
 el('newPatient')?.addEventListener('click',()=>{view='newPatient';render()});
 el('editPatientProfileLegacy')?.addEventListener('click',()=>{view='editProfile';render()});
 el('cancelEditProfile')?.addEventListener('click',()=>{view='details';tab='summary';render()});
 el('saveEditProfile')?.addEventListener('click',saveEditedPatientProfile);if(view==='editProfile'){const p=patient(selected),m={Diagnosis:p.diagnosis,TheoreticalWeight:p.theoreticalWeight,Bowel:p.bowel,Metabolism:p.metabolism,Feeg:p.feeg,Impedance:p.impedance,PreviousDiets:p.previousDiets,Allergies:p.allergies,Medications:p.medications,GiIssues:p.giIssues,PastConditions:p.pastConditions,Observations:p.observations,Objectives:p.objectives};Object.entries(m).forEach(([k,v])=>{const x=el('ep'+k);if(x)x.value=v||''});[['FamObesity','famObesity'],['FamDiabetes','famDiabetes'],['FamHypertension','famHypertension'],['FamCardiovascular','famCardiovascular'],['FamDyslipidemia','famDyslipidemia'],['FamThyroid','famThyroid']].forEach(([id,k])=>{const x=el('ep'+id);if(x)x.checked=!!p[k]})}
 el('newPatientMeasure')?.addEventListener('click',()=>{window.editMeasureDate=null;view='patientMeasure';render()});
 document.querySelectorAll('[data-edit-measure]').forEach(b=>b.addEventListener('click',()=>{window.editMeasureDate=b.dataset.editMeasure;view='patientMeasure';render()}));
 el('cancelPatientMeasure')?.addEventListener('click',()=>{window.editMeasureDate=null;view='details';tab='measures';render()});
 el('savePatientMeasure')?.addEventListener('click',savePatientMeasure);
 document.querySelectorAll('[data-date-target]').forEach(p=>{
   const syncDatePicker=()=>{
     const t=el(p.dataset.dateTarget);
     if(t&&p.value)t.value=fmt(p.value);
   };
   p.addEventListener('input',syncDatePicker);
   p.addEventListener('change',syncDatePicker);
 });
 el('savePatientAccount')?.addEventListener('click',()=>{const u=(el('accUser')?.value||'').trim(),pw=el('accPass')?.value||'';if(!u||!pw)return alert('Inserisci username e password.');saveAccountFor(selected,{username:u,password:pw,active:true});alert('Account demo salvato.');render()});
 el('deletePatientAccount')?.addEventListener('click',()=>{saveAccountFor(selected,null);alert('Account demo disattivato.');render()});
 el('downloadPrivacyForm')?.addEventListener('click',()=>{const p=patient(selected),blob=privacyPdfBlob(p),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`Privacy_${String(p.name||'Paziente').replace(/\s+/g,'_')}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)});
 el('uploadSignedPrivacy')?.addEventListener('click',()=>el('signedPrivacyFile')?.click());
 el('signedPrivacyFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;if(f.type!=='application/pdf'&&!f.name.toLowerCase().endsWith('.pdf'))return alert('Seleziona un PDF.');await storePrivacyPdf(selected,await f.arrayBuffer());savePrivacyMeta(selected,{filename:f.name,uploadedAt:new Date().toISOString()});render()});
 el('openSignedPrivacy')?.addEventListener('click',async()=>{const d=await readPrivacyPdf(selected);if(!d)return alert('PDF firmato non disponibile.');const w=window.open('about:blank','_blank'),u=URL.createObjectURL(new Blob([d],{type:'application/pdf'}));if(w)w.location.href=u;else location.href=u;setTimeout(()=>URL.revokeObjectURL(u),60000)});
 document.querySelectorAll('[data-review-lab]').forEach(b=>b.addEventListener('click',()=>{window.reviewLabKey=b.dataset.reviewLab;view='labReview';render()}));
 el('openLabReviewPdf')?.addEventListener('click',async()=>{const item=pendingLabs()[window.reviewLabKey];if(!item)return;try{const d=await readPendingLabPdf(item);if(!d)return alert('PDF non disponibile.');markBloodTestDocumentRead(item.documentId);const u=URL.createObjectURL(new Blob([d],{type:'application/pdf'}));location.href=u;setTimeout(()=>URL.revokeObjectURL(u),120000)}catch(e){alert('Non riesco ad aprire il PDF.')}});
 el('cancelLabReview')?.addEventListener('click',()=>{view='dashboard';render()});
 el('deleteLabReview')?.addEventListener('click',async()=>{
 const item=pendingLabs()[window.reviewLabKey];
 if(!item)return;
 if(!confirm(`Eliminare le analisi "${item.filename}"?\n\nIl file verrà rimosso anche dall'attesa del paziente.`))return;
 try{await deletePendingLabSource(item)}catch(e){console.warn('PDF cleanup',e)}
 const m=pendingLabs();
 delete m[window.reviewLabKey];
 savePendingLabs(m);
 window.reviewLabKey='';
 view='dashboard';
 render();
});
 el('confirmLabReview')?.addEventListener('click',()=>{const item=pendingLabs()[window.reviewLabKey];if(!item)return;markBloodTestDocumentRead(item.documentId);const ids=['glucose','cholesterol','hdl','ldl','triglycerides','got','gpt','uricAcid','creatinine','ggt'],obj={id:'lab-'+Date.now(),date:readProDate('revDate')||today()};ids.forEach(k=>obj[k]=(el('rev'+k)?.value||'').trim());const rows=labsFor(item.patientId);rows.push(obj);saveLabsFor(item.patientId,rows);const m=pendingLabs();m[window.reviewLabKey]={...item,status:'Confermato'};savePendingLabs(m);void openPatientDetails(item.patientId,'labs')});
el('newLab')?.addEventListener('click',()=>{window.editLabId='';view='labForm';render()});document.querySelectorAll('[data-edit-lab]').forEach(b=>b.addEventListener('click',()=>{window.editLabId=b.dataset.editLab;view='labForm';render()}));el('cancelLab')?.addEventListener('click',()=>{view='details';tab='labs';render()});el('saveLab')?.addEventListener('click',saveLab);el('deleteLab')?.addEventListener('click',deleteLab);let pendingPlanFile=null;
el('uploadPlan')?.addEventListener('click',()=>el('planFile')?.click());
el('planFile')?.addEventListener('change',e=>{
 const f=e.target.files?.[0];if(!f)return;
 if(!f.name.toLowerCase().endsWith('.pdf')){e.target.value='';return alert('Seleziona un PDF.')}
 if(f.size>10*1024*1024){e.target.value='';return alert('Il documento supera il limite di 10 MB previsto per la demo.')}
 pendingPlanFile=f;
 el('planUploadFileName').textContent=f.name;
 el('planUploadTitle').value=documentTitleFromFile(f.name);
 el('planUploadForm').hidden=false;
 el('planUploadForm').scrollIntoView({behavior:'smooth',block:'start'});
});
el('cancelNewPlan')?.addEventListener('click',()=>{
 pendingPlanFile=null;
 if(el('planFile'))el('planFile').value='';
 if(el('planUploadForm'))el('planUploadForm').hidden=true;
});
el('saveNewPlan')?.addEventListener('click',async()=>{
 if(!pendingPlanFile)return alert('Seleziona un PDF.');
 const title=(el('planUploadTitle')?.value||'').trim(),validFrom=readProDate('planValidFrom'),professionalNote=(el('planProfessionalNote')?.value||'').trim();
 if(!title)return alert('Inserisci il titolo del piano.');
 if(!validFrom)return alert('Inserisci la data di inizio validità.');
 try{
   await archiveLegacyPlanIfNeeded(selected);
   const id=documentId('plan'),fileId=documentId('file');
   await writeDocumentBlob(fileId,pendingPlanFile);
   const items=documentMetaList();
   items.push({id,patientId:selected,category:'plan',subCategory:'meal_plan',title,validFrom,documentDate:validFrom,fileId,fileName:pendingPlanFile.name,mimeType:pendingPlanFile.type||'application/pdf',fileSize:pendingPlanFile.size,uploadedBy:'professional',uploadedAt:new Date().toISOString(),unreadForProfessional:false,unreadForPatient:true,documentNumber:null,professionalNote});
   saveDocumentMetaList(items);
   pendingPlanFile=null;
   render();
 }catch(err){console.error(err);alert('Non riesco a pubblicare il piano alimentare.')}
});
document.querySelectorAll('[data-edit-plan-note]').forEach(b=>b.addEventListener('click',()=>{
 const id=b.dataset.editPlanNote;
 const editor=document.querySelector(`[data-plan-note-editor="${id}"]`);
 if(!editor)return;
 editor.hidden=false;
 editor.querySelector('textarea')?.focus();
}));
document.querySelectorAll('[data-cancel-plan-note]').forEach(b=>b.addEventListener('click',()=>{
 const editor=document.querySelector(`[data-plan-note-editor="${b.dataset.cancelPlanNote}"]`);
 if(editor)editor.hidden=true;
}));
document.querySelectorAll('[data-save-plan-note]').forEach(b=>b.addEventListener('click',()=>{
 const id=b.dataset.savePlanNote;
 const editor=document.querySelector(`[data-plan-note-editor="${id}"]`);
 const note=editor?.querySelector('textarea')?.value||'';
 if(!saveProfessionalPlanNote(selected,id,note))return alert('Non riesco ad aggiornare la nota del piano.');
 render();
}));
document.querySelectorAll('[data-open-pro-plan]').forEach(b=>b.addEventListener('click',async()=>{
 const id=b.dataset.openProPlan;
 if(id==='legacy-plan'){
   const d=await readPlanPdf(selected);if(!d)return alert('PDF non disponibile.');
   const u=URL.createObjectURL(new Blob([d],{type:'application/pdf'}));location.href=u;setTimeout(()=>URL.revokeObjectURL(u),120000);return;
 }
 openProfessionalDocument(id);
}));
document.querySelectorAll('[data-delete-pro-plan]').forEach(b=>b.addEventListener('click',async()=>{
 const id=b.dataset.deleteProPlan;
 if(!confirm('Eliminare questo piano alimentare dallo storico?'))return;
 try{
   if(id==='legacy-plan'){
     await deletePlanPdf(selected);savePlanMeta(selected,null);render();return;
   }
   const items=documentMetaList(),d=items.find(x=>x.id===id&&x.patientId===selected&&x.category==='plan');
   if(!d)return;
   await deleteDocumentBlob(d.fileId);
   saveDocumentMetaList(items.filter(x=>x.id!==id));
   render();
 }catch(err){console.error(err);alert('Non riesco a eliminare il piano alimentare.')}
}));
 el('exportProDiaryPdf')?.addEventListener('click',openProDiaryExportDialog);
 document.querySelectorAll('[data-pro-diary-day]').forEach(b=>b.addEventListener('click',()=>{
   proDiaryDate=b.dataset.proDiaryDay;
   view='diaryDay';
   render();
   window.scrollTo(0,0);
 }));
 el('backDiary')?.addEventListener('click',()=>{
   view='details';
   tab='diary';
   render();
 });
 el('proDiarySearch')?.addEventListener('input',e=>{
   proDiarySearch=e.target.value;
   const pos=document.scrollingElement?.scrollTop||0;
   render();
   requestAnimationFrame(()=>{
     window.scrollTo(0,pos);
     const s=el('proDiarySearch');
     if(s){s.focus();s.setSelectionRange(s.value.length,s.value.length)}
   });
 });
 el('cancelNewPatient')?.addEventListener('click',()=>{view='patients';render()});
 // #saveNewPatient e' gestito da professional-patient-lifecycle-bridge.js.
 el('newEvent')?.addEventListener('click',()=>{editing=null;window.prefill=null;view='event';render()});
 el('prevWeek')?.addEventListener('click',()=>{weekDate=addDays(weekDate,-7);render()});
 el('nextWeek')?.addEventListener('click',()=>{weekDate=addDays(weekDate,7);render()});
 el('todayWeek')?.addEventListener('click',()=>{weekDate=new Date(today()+'T12:00:00');render()});
 document.querySelectorAll('[data-edit-visit]').forEach(b=>b.addEventListener('click',()=>{
   const appt=appointments().find(a=>a.id===b.dataset.editVisit);
   if(!appt)return;
   editing={...appt};
   eventReturnToPatient=true;
   view='event';
   render();
 }));

 el('deletePatient')?.addEventListener('click',deleteSelectedPatient);
 el('searchPatient')?.addEventListener('input',e=>{
 patientSearchText=e.target.value||'';
 const pos=document.scrollingElement?.scrollTop||0;
 render();
 requestAnimationFrame(()=>{window.scrollTo(0,pos);const s=el('searchPatient');if(s){s.focus();s.setSelectionRange(s.value.length,s.value.length)}});
});
el('filterUnreadPatients')?.addEventListener('change',e=>{
 patientsUnreadOnly=!!e.target.checked;
 render();
});
 // Profilo professionista: handler nel modulo dedicato.
 window.NubemoProfessionalProfile.bind({
   render,
   saveAgendaSettings(patch){
     const local=load(SETTINGS_KEY,{});
     const next={...local,...patch};
     if(patch.logoData===undefined)next.logoData=local.logoData||'';
     save(SETTINGS_KEY,next);
   }
 });

 el('saveNote')?.addEventListener('click',()=>{const n=load(NOTES_KEY,{});n[selected]=el('noteText').value;save(NOTES_KEY,n);alert('Nota salvata')});

 document.querySelectorAll('[data-agenda-patient]').forEach(b=>b.addEventListener('click',()=>selectAgendaPatient(b.dataset.agendaPatient)));
 el('ePatientSearch')?.addEventListener('input',e=>{
   const q=(e.target.value||'').trim().toLocaleLowerCase('it-IT');
   document.querySelectorAll('[data-agenda-patient]').forEach(b=>{
     b.hidden=q!==''&&!b.innerText.toLocaleLowerCase('it-IT').includes(q);
   });
 });
 el('agendaNewPatientToggle')?.addEventListener('click',()=>{
   const box=el('agendaQuickPatient');
   if(!box)return;
   box.hidden=!box.hidden;
   if(!box.hidden)el('agendaNpName')?.focus();
 });
 el('agendaCancelQuickPatient')?.addEventListener('click',()=>{const box=el('agendaQuickPatient');if(box)box.hidden=true;});
 // La creazione del contatto provvisorio dall'Agenda e' gestita da
 // professional-patient-lifecycle-bridge.js, che crea una riga reale in
 // professional_patient_drafts. Il vecchio percorso locale creava un id
 // finto mai sincronizzato con Supabase ed e' stato rimosso.

 el('eType')?.addEventListener('change',()=>{const t=el('eType').value,s=settings();el('patientBox').style.display=t==='personal'?'none':'block';el('titleBox').style.display=t==='personal'?'block':'none';if(t==='first')el('eDuration').value=s.first;if(t==='control')el('eDuration').value=s.control});
 el('cancelEvent')?.addEventListener('click',()=>{
   editing=null;window.prefill=null;
   if(eventReturnToPatient){eventReturnToPatient=false;view='details';tab='visits';}
   else view='agenda';
   render();
 });
 el('deleteEvent')?.addEventListener('click',()=>{
   if(!editing)return;
   if(!confirm('Vuoi eliminare questo appuntamento?'))return;
   save(APPT_KEY,appointments().filter(a=>a.id!==editing.id));
   editing=null;
   window.prefill=null;
   if(eventReturnToPatient){eventReturnToPatient=false;view='details';tab='visits';}
   else view='agenda';
   render();
 });
 el('saveEvent')?.addEventListener('click',()=>{
   const date=parseIt(el('eDate').value);if(!date)return alert('Inserisci la data nel formato gg-mm-aaaa');
   const type=el('eType').value;
   const chosenPatient=type==='personal'?null:(el('ePatient')?.value||'');
   if(type!=='personal'&&!chosenPatient)return alert('Seleziona un paziente.');
   const obj={id:editing?.id||'e'+Date.now(),type,patientId:chosenPatient,date,time:el('eTime').value,duration:+el('eDuration').value||30,title:type==='personal'?(el('eTitle').value||'Impegno personale'):'',note:el('eNote').value};
   const c=conflict(obj);if(c)return alert(`Orario già occupato: ${fmt(c.date)} alle ${c.time}. Appuntamento già fissato.`);
   let arr=appointments();const i=arr.findIndex(a=>a.id===obj.id);if(i>=0)arr[i]=obj;else arr.push(obj);save(APPT_KEY,arr);
   if(type==='first'&&chosenPatient)setPatientStartDateIfEmpty(chosenPatient,date);
   editing=null;window.prefill=null;
   if(eventReturnToPatient){eventReturnToPatient=false;view='details';tab='visits';}
   else view='agenda';
   render();
 });
}


function syncResponsiveLayout(){
 syncPhoneLandscapeClass();
 syncIPadLayoutClass();
 syncIPadDrawerForOrientation();
}

window.addEventListener('orientationchange',()=>setTimeout(syncResponsiveLayout,160));
window.addEventListener('resize',syncResponsiveLayout);

syncResponsiveLayout();
window.addEventListener('pageshow',e=>{
 if(e.persisted){
   render();
 }
});
render();
})();
