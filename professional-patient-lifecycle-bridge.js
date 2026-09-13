// NUBEMO — contatti provvisori, conversione paziente e Area Paziente opzionale.
(() => {
  'use strict';

  const client = window.nubemoSupabase;
  const context = window.nubemoProfessionalContext || {};
  const services = window.nubemoProfessionalServices;
  const app = document.getElementById('proApp');
  const adapter = () => window.nubemoProfessionalLegacyAdapter;
  if (!client || !context.professional?.id || !context.user?.id || !app) return;

  const drafts = new Map();
  let currentPatientId = '';
  let patching = false;

  const esc = (value='') => String(value)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const phonePortrait = () => window.matchMedia('(max-width: 600px) and (orientation: portrait)').matches;
  const normaliseDate = value => {
    const raw=String(value||'').trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
    const m=raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    return m ? `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}` : '';
  };
  const optionalNumber = id => {
    const raw=String(document.getElementById(id)?.value||'').trim().replace(',','.');
    if(raw==='')return null;
    const n=Number(raw);return Number.isFinite(n)?n:NaN;
  };
  const text = id => String(document.getElementById(id)?.value||'').trim();

  async function refreshDraftState(){
    const {data,error}=await client.from('professional_patient_drafts')
      .select('id,professional_id,first_name,last_name,phone,status,converted_patient_id,created_at')
      .eq('professional_id',context.professional.id).eq('status','draft').order('created_at');
    if(error)throw error;
    drafts.clear();(data||[]).forEach(row=>drafts.set(row.id,row));
  }

  async function invokeLifecycle(body){
    const {data,error}=await client.functions.invoke('patient-lifecycle',{body});
    if(error||!data?.ok)throw new Error(data?.error||'Operazione non completata.');
    return data;
  }

  function selectDraftInAgenda(row){
    const hidden=document.getElementById('ePatient');if(hidden)hidden.value=row.id;
    document.querySelectorAll('[data-agenda-patient]').forEach(b=>b.classList.toggle('selected',b.dataset.agendaPatient===row.id));
    const search=document.getElementById('ePatientSearch');if(search)search.value=[row.first_name,row.last_name].join(' ').trim();
    const results=document.getElementById('ePatientResults');
    if(results&&!results.querySelector(`[data-agenda-patient="${CSS.escape(row.id)}"]`)){
      const button=document.createElement('button');button.type='button';button.className='agenda-patient-option selected';button.dataset.agendaPatient=row.id;
      button.innerHTML=`<span>${esc([row.first_name,row.last_name].join(' ').trim())}</span>${row.phone?`<small>${esc(row.phone)}</small>`:''}`;
      button.addEventListener('click',()=>selectDraftInAgenda(row));results.appendChild(button);
    }
    const type=document.getElementById('eType');if(type){type.value='first';type.dispatchEvent(new Event('change'));}
    const box=document.getElementById('agendaQuickPatient');if(box)box.hidden=true;
  }

  async function createDraftFromAgenda(button){
    const firstName=text('agendaNpName'),lastName=text('agendaNpSurname'),phone=text('agendaNpPhone');
    if(!firstName||!lastName)return alert('Inserisci nome e cognome.');
    if(!phone)return alert('Inserisci un recapito telefonico.');
    button.disabled=true;const old=button.textContent;button.textContent='Creazione...';
    try{
      const {data,error}=await client.from('professional_patient_drafts').insert({professional_id:context.professional.id,first_name:firstName,last_name:lastName,phone,created_by_user_id:context.user.id}).select().single();
      if(error||!data)throw error||new Error('Contatto non creato.');
      drafts.set(data.id,data);
      await adapter()?.refreshDrafts?.();
      selectDraftInAgenda(data);
    }catch(error){console.error('NUBEMO draft create:',error);alert('Non è stato possibile creare il contatto provvisorio.');}
    finally{button.disabled=false;button.textContent=old;}
  }

  function clinicalFromForm(){
    const nullableText=id=>text(id)||null;const checked=id=>!!document.getElementById(id)?.checked;
    return {goalWeight:optionalNumber('npGoal'),minWeight:optionalNumber('npMinWeight'),maxWeight:optionalNumber('npMaxWeight'),reasonableWeight:optionalNumber('npReasonableWeight'),theoreticalWeight:optionalNumber('npTheoreticalWeight'),work:nullableText('npWork'),activity:nullableText('npActivity'),activityFactor:optionalNumber('npActivityFactor'),smoking:nullableText('npSmoking'),alcohol:nullableText('npAlcohol'),diagnosis:nullableText('npDiagnosis'),bowel:nullableText('npBowel'),metabolism:nullableText('npMetabolism'),feeg:nullableText('npFeeg'),impedance:nullableText('npImpedance'),familyObesity:checked('npFamObesity'),familyDiabetes:checked('npFamDiabetes'),familyHypertension:checked('npFamHypertension'),familyCardiovascular:checked('npFamCardiovascular'),familyDyslipidemia:checked('npFamDyslipidemia'),familyThyroid:checked('npFamThyroid'),previousDiets:nullableText('npPreviousDiets'),allergies:nullableText('npAllergies'),medications:nullableText('npMedications'),giIssues:nullableText('npGiIssues'),pastConditions:nullableText('npPastConditions'),observations:nullableText('npObservations'),objectives:nullableText('npObjectives')};
  }

  async function createRealPatient(button){
    const firstName=text('npName'),lastName=text('npSurname'),activate=!!document.getElementById('npActivatePatientArea')?.checked,email=activate?text('npEmail').toLowerCase():'';
    if(!firstName||!lastName)return alert('Inserisci nome e cognome.');
    if(activate&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return alert('Inserisci un indirizzo email valido.');
    const birthDate=normaliseDate(text('npBirth'))||null,sex=text('npSex')||null,height=optionalNumber('npHeight');
    if(height!==null&&(!Number.isFinite(height)||height<80||height>250))return alert('Controlla l’altezza inserita.');
    button.disabled=true;const old=button.textContent;button.textContent='Creazione...';
    try{
      const data=await invokeLifecycle({action:'create-patient',first_name:firstName,last_name:lastName,email:activate?email:null,activate_patient_area:activate,birth_date:birthDate,sex,height_cm:height,pathway_start_date:null});
      try{await services?.savePatientAnamnesis?.(data.patient_id,clinicalFromForm());}catch(error){console.error('NUBEMO anamnesis after create:',error);}
      window.location.reload();
    }catch(error){console.error('NUBEMO lifecycle patient create:',error);alert(error.message||'Non è stato possibile creare il paziente.');button.disabled=false;button.textContent=old;}
  }

  function patchNewPatientAccessChoice(){
    if(document.body.dataset.proView!=='newPatient'||document.getElementById('npActivatePatientArea'))return;
    const email=document.getElementById('npEmail');if(!email)return;
    const emailLabel=document.querySelector('label[for="npEmail"]');
    const wrap=document.createElement('div');wrap.className='nubemo-patient-area-choice';
    wrap.innerHTML='<label><input id="npActivatePatientArea" type="checkbox" checked> Attiva Area Paziente NUBEMO</label><p class="muted">Se disattivata, il paziente sarà gestito solo dal professionista e non riceverà alcun invito.</p>';
    emailLabel?.insertAdjacentElement('beforebegin',wrap);
    const toggle=wrap.querySelector('#npActivatePatientArea');
    const sync=()=>{const enabled=toggle.checked;emailLabel?.classList.toggle('nubemo-access-hidden',!enabled);email.classList.toggle('nubemo-access-hidden',!enabled);const note=email.nextElementSibling;if(note?.tagName==='SMALL')note.classList.toggle('nubemo-access-hidden',!enabled);email.required=enabled;if(!enabled)email.value='';};
    toggle.addEventListener('change',sync);sync();
  }

  function draftModal(row){
    document.getElementById('nubemoDraftModal')?.remove();
    const modal=document.createElement('div');modal.id='nubemoDraftModal';modal.className='nubemo-draft-modal-backdrop';
    modal.innerHTML=`<section class="card nubemo-draft-modal" role="dialog" aria-modal="true"><div class="section-head"><h2>Completa anagrafica</h2><button type="button" class="mini" data-close-draft-modal>✕</button></div><p><b>${esc(row.first_name)} ${esc(row.last_name)}</b>${row.phone?` · ${esc(row.phone)}`:''}</p><label>Data di nascita</label><input id="draftBirth" placeholder="gg/mm/aaaa" inputmode="numeric"><label>Sesso</label><select id="draftSex"><option value="">Non specificato</option><option value="M">Maschile</option><option value="F">Femminile</option><option value="X">Altro / preferisco non specificare</option></select><label>Altezza (cm)</label><input id="draftHeight" type="number" min="80" max="250" step="1"><div class="nubemo-patient-area-choice"><label><input id="draftActivateArea" type="checkbox"> Attiva Area Paziente NUBEMO</label><p class="muted">Attivandola verrà richiesto l’indirizzo email e sarà inviato l’invito.</p></div><div id="draftEmailBox" hidden><label>Email</label><input id="draftEmail" type="email" inputmode="email"></div><div class="pro3-actions"><button type="button" class="secondary" data-close-draft-modal>Annulla</button><button type="button" class="primary" id="convertDraftPatient">Crea paziente</button></div></section>`;
    document.body.appendChild(modal);
    const toggle=modal.querySelector('#draftActivateArea'),emailBox=modal.querySelector('#draftEmailBox');toggle.addEventListener('change',()=>emailBox.hidden=!toggle.checked);
    modal.querySelectorAll('[data-close-draft-modal]').forEach(b=>b.addEventListener('click',()=>modal.remove()));
    modal.querySelector('#convertDraftPatient').addEventListener('click',async event=>{
      const button=event.currentTarget,activate=toggle.checked,email=activate?String(modal.querySelector('#draftEmail').value||'').trim().toLowerCase():'';
      if(activate&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return alert('Inserisci un indirizzo email valido.');
      const birth=normaliseDate(modal.querySelector('#draftBirth').value)||null,sex=modal.querySelector('#draftSex').value||null,heightRaw=String(modal.querySelector('#draftHeight').value||'').trim(),height=heightRaw?Number(heightRaw):null;
      if(height!==null&&(!Number.isFinite(height)||height<80||height>250))return alert('Controlla l’altezza inserita.');
      button.disabled=true;button.textContent='Conversione...';
      try{await invokeLifecycle({action:'convert-draft',draft_id:row.id,activate_patient_area:activate,email:activate?email:null,birth_date:birth,sex,height_cm:height,pathway_start_date:null});window.location.reload();}
      catch(error){console.error('NUBEMO draft convert:',error);alert(error.message||'Conversione non completata.');button.disabled=false;button.textContent='Crea paziente';}
    });
  }

  function identifyCurrentPatient(){
    if(currentPatientId){const row=(context.patients||[]).find(x=>x.id===currentPatientId);if(row)return row;}
    const title=document.querySelector('.patient-global-title')?.textContent||'';
    return (context.patients||[]).find(row=>title.includes([row.profile?.first_name,row.profile?.last_name].filter(Boolean).join(' ')))||null;
  }

  function patchNoAccessAccountAndPrivacy(){
    if(document.body.dataset.proView!=='details')return;
    const row=identifyCurrentPatient();if(!row||row.profile?.email)return;
    const active=document.querySelector('[data-patient-tab].active')?.dataset?.patientTab||'';
    if(active==='account'){
      const slot=document.querySelector('.patient-content-card .nubemo-remote-tab-content[data-domain="account"]');
      if(slot&&!slot.dataset.noAccessOwner){slot.dataset.noAccessOwner='1';slot.innerHTML=`<div class="section-head"><h2>Account paziente</h2><span class="pill">Area Paziente non attiva</span></div><p class="muted">Il paziente è gestito in NUBEMO dal professionista, ma non dispone di un account personale.</p><label>Email per attivazione</label><input type="email" data-enable-patient-email inputmode="email" placeholder="es. nome@email.it"><button class="secondary" type="button" data-enable-patient-area style="margin-top:12px">Attiva Area Paziente</button><p class="muted" data-enable-patient-message></p>`;
        const button=slot.querySelector('[data-enable-patient-area]'),input=slot.querySelector('[data-enable-patient-email]'),message=slot.querySelector('[data-enable-patient-message]');
        button.addEventListener('click',async()=>{const email=String(input.value||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return message.textContent='Inserisci un indirizzo email valido.';button.disabled=true;button.textContent='Invio...';try{await invokeLifecycle({action:'activate-patient-area',patient_id:row.id,email});row.profile.email=email;window.location.reload();}catch(error){message.textContent=error.message||'Attivazione non completata.';button.disabled=false;button.textContent='Attiva Area Paziente';}});
      }
    }
    if(active==='privacy'){
      const slot=document.querySelector('.patient-content-card .nubemo-remote-tab-content[data-domain="privacy"]');if(!slot)return;
      const card=[...slot.querySelectorAll('.card')].find(c=>c.querySelector('h2')?.textContent?.trim()==='Privacy NUBEMO');
      if(card&&!card.dataset.noAccessOwner){card.dataset.noAccessOwner='1';card.innerHTML='<div class="section-head"><h2>Privacy NUBEMO</h2><span class="pill">Area Paziente non attiva</span></div><p class="muted">L’informativa NUBEMO per l’accesso personale non è richiesta finché l’Area Paziente non viene attivata.</p>';}
    }
  }

  function patchDraftRows(){
    document.querySelectorAll('[data-patient],[data-drawer-patient]').forEach(node=>{
      const id=node.dataset.patient||node.dataset.drawerPatient;if(!drafts.has(id)||node.dataset.draftMarked)return;node.dataset.draftMarked='1';node.classList.add('nubemo-draft-patient');
      if(node.matches('[data-patient]')){const marker=document.createElement('span');marker.className='nubemo-draft-badge';marker.textContent='Anagrafica parziale';node.appendChild(marker);}
    });
  }

  function patch(){if(patching)return;patching=true;try{patchNewPatientAccessChoice();patchDraftRows();patchNoAccessAccountAndPrivacy();}finally{patching=false;}}

  const style=document.createElement('style');style.textContent=`
    .patient-content-card,.patient-content-card .nubemo-remote-tab-content,.patient-content-card .pro-read-grid,.patient-content-card .pro-read-grid>div{min-width:0}
    .patient-content-card b,.patient-content-card p,.patient-content-card span{overflow-wrap:anywhere;word-break:break-word}
    .nubemo-access-hidden{display:none!important}
    .nubemo-patient-area-choice{margin:18px 0 8px;padding:14px;border:1px solid #dce7e8;border-radius:14px;background:#f8fbfb}
    .nubemo-patient-area-choice label{display:flex;align-items:center;gap:9px;margin:0}.nubemo-patient-area-choice input[type="checkbox"]{width:auto;margin:0}
    .nubemo-patient-area-choice p{margin:7px 0 0}
    .nubemo-draft-patient{position:relative}.nubemo-draft-badge{font-size:11px!important;font-weight:800!important;color:#8a6420!important;background:#fff4cf!important;border-radius:999px;padding:5px 8px;justify-self:end}
    .nubemo-draft-modal-backdrop{position:fixed;inset:0;background:#16202a66;z-index:9999;display:grid;place-items:center;padding:18px;overflow:auto}
    .nubemo-draft-modal{width:min(620px,100%);max-height:calc(100vh - 36px);overflow:auto;margin:0}
  `;document.head.appendChild(style);

  document.addEventListener('click',event=>{
    const drawerTrigger=event.target?.closest?.('#openProDrawer');
    if(drawerTrigger&&!phonePortrait()){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();return;}

    const patientTarget=event.target?.closest?.('[data-patient],[data-drawer-patient]');
    if(patientTarget){const id=patientTarget.dataset.patient||patientTarget.dataset.drawerPatient;if(drafts.has(id)){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();draftModal(drafts.get(id));return;}currentPatientId=id||currentPatientId;}

    const draftCreate=event.target?.closest?.('#agendaCreateQuickPatient');
    if(draftCreate){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void createDraftFromAgenda(draftCreate);return;}

    const savePatient=event.target?.closest?.('#saveNewPatient');
    if(savePatient&&document.body.dataset.proView==='newPatient'&&document.getElementById('npActivatePatientArea')){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void createRealPatient(savePatient);return;}
  },true);

  const ready=(async()=>{try{await refreshDraftState();}catch(error){console.error('NUBEMO draft hydrate:',error);}})();
  window.nubemoPatientLifecycleBridge={ready,refresh:refreshDraftState,isDraft:id=>drafts.has(id)};
  const observer=new MutationObserver(()=>queueMicrotask(patch));observer.observe(app,{childList:true,subtree:true});patch();
})();