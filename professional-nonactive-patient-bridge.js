// NUBEMO — scheda paziente accessibile anche per percorsi PENDING / ENDED.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  const app=document.getElementById('proApp');
  if(!client||!app)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  let stateMap=new Map();
  let patchedAdapter=false;
  let loadingStates=null;

  function parse(value,fallback){try{return JSON.parse(value)}catch(_){return fallback}}
  function rows(){const value=parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]',[]);return Array.isArray(value)?value:[]}
  function saveRows(value){localStorage.setItem(EXTRA_PATIENTS_KEY,JSON.stringify(value))}

  async function loadStates(force=false){
    if(stateMap.size&&!force)return stateMap;
    if(loadingStates)return loadingStates;
    loadingStates=(async()=>{
      const {data,error}=await client.rpc('get_professional_patient_pathway_states');
      if(error)throw error;
      stateMap=new Map((Array.isArray(data)?data:[]).map(row=>[String(row.patient_id),{
        status:String(row.status||'ended'),
        pathwayId:row.pathway_id||null
      }]));
      const list=rows();
      let changed=false;
      for(const row of list){
        if(row?._draft===true||row?.relationshipStatus==='draft')continue;
        const state=stateMap.get(String(row?.id||''));
        if(!state)continue;
        if(row.relationshipStatus!==state.status||row.pathwayStatus!==state.status||row.pathwayId!==state.pathwayId||row.readOnly!==(state.status!=='active')){
          row.relationshipStatus=state.status;
          row.pathwayStatus=state.status;
          row.pathwayId=state.pathwayId;
          row.readOnly=state.status!=='active';
          changed=true;
        }
      }
      if(changed)saveRows(list);
      return stateMap;
    })().finally(()=>{loadingStates=null;});
    return loadingStates;
  }

  function localPatient(patientId){return rows().find(row=>String(row?.id||'')===String(patientId))||null}

  function publishNonActiveShell(patientId,state){
    const list=rows();
    const index=list.findIndex(row=>String(row?.id||'')===String(patientId));
    if(index<0)return null;
    const row={...list[index],
      relationshipStatus:state.status,
      pathwayStatus:state.status,
      pathwayId:state.pathwayId,
      readOnly:true,
      _hydrated:true,
      _nonActiveShell:true
    };
    list[index]=row;
    saveRows(list);
    return row;
  }

  function patchAdapter(){
    if(patchedAdapter)return;
    const base=window.nubemoProfessionalLegacyAdapter;
    if(!base?.ensurePatientHydrated)return;
    const wrapped={...base};
    wrapped.ensurePatientHydrated=async function(patientId){
      await loadStates();
      const state=stateMap.get(String(patientId));
      if(!state||state.status==='active')return base.ensurePatientHydrated(patientId);
      return publishNonActiveShell(patientId,state);
    };
    wrapped.isHydrated=function(id){
      const state=stateMap.get(String(id));
      if(state&&state.status!=='active')return true;
      return base.isHydrated?.(id)===true;
    };
    window.nubemoProfessionalLegacyAdapter=Object.freeze(wrapped);
    patchedAdapter=true;
  }

  function currentPatient(){
    const drawer=document.querySelector('[data-drawer-patient]')?.dataset.drawerPatient;
    if(drawer)return localPatient(drawer);
    const title=document.querySelector('.patient-global-title')?.textContent?.trim()||'';
    if(!title)return null;
    return rows().find(row=>row?.id&&title.includes(String(row.name||'').trim()))||null;
  }

  function patientName(patient){
    return String(patient?.name||[patient?.firstName,patient?.surname].filter(Boolean).join(' ')||'Paziente');
  }

  function statusLabel(status){return status==='pending'?'In attesa di accettazione':'Percorso terminato'}

  async function createNewPathway(patient,button){
    if(!patient?.id)return;
    const name=patientName(patient);
    if(!confirm(`Creare un nuovo percorso per ${name}?\n\nIl percorso terminato resterà nello storico e non verrà riattivato.`))return;
    if(button){button.disabled=true;button.textContent='Creazione...';}
    try{
      const {data,error}=await client.rpc('create_new_professional_patient_pathway',{p_patient_id:patient.id});
      if(error)throw error;
      await loadStates(true);
      if(typeof window.nubemoReloadProfessionalPatients==='function')await window.nubemoReloadProfessionalPatients();
      if(data?.status==='pending')alert('Nuovo percorso proposto. Il paziente dovrà accettarlo dalla propria Area Paziente.');
      else alert('Nuovo percorso creato e attivato.');
      document.querySelector('[data-view="patients"],[data-drawer-view="patients"]')?.click();
    }catch(error){
      console.error('NUBEMO nuovo percorso da scheda terminata:',error);
      alert(error?.message||'Non è stato possibile creare il nuovo percorso.');
    }finally{
      if(button){button.disabled=false;button.textContent='Nuovo percorso';}
    }
  }

  function patchDetailsUi(){
    if(document.body.dataset.proView!=='details'){
      document.getElementById('nubemoNonActivePatientBanner')?.remove();
      return;
    }
    const patient=currentPatient();
    if(!patient)return;
    const status=String(patient.relationshipStatus||patient.pathwayStatus||'active');
    if(status==='active'||status==='draft'){
      document.getElementById('nubemoNonActivePatientBanner')?.remove();
      return;
    }

    let banner=document.getElementById('nubemoNonActivePatientBanner');
    if(!banner){
      banner=document.createElement('section');
      banner.id='nubemoNonActivePatientBanner';
      banner.className='card';
      banner.style.cssText='border:1px solid #dce7e1;background:#f8fbf9';
      const tabs=document.querySelector('.patient-desktop-tabs');
      const content=document.querySelector('.patient-content-card');
      if(tabs)tabs.insertAdjacentElement('beforebegin',banner);
      else if(content)content.insertAdjacentElement('beforebegin',banner);
      else app.prepend(banner);
    }

    if(banner.dataset.pathwayStatus!==status){
      banner.dataset.pathwayStatus=status;
      banner.innerHTML=status==='pending'
        ? `<div class="section-head"><div><div class="eyebrow">STATO PERCORSO</div><h2>${statusLabel(status)}</h2></div></div><p class="muted" style="margin:6px 0 0">La scheda anagrafica resta consultabile. Le funzioni operative del nuovo percorso saranno disponibili dopo l'accettazione del paziente.</p>`
        : `<div class="section-head"><div><div class="eyebrow">STATO PERCORSO</div><h2>${statusLabel(status)}</h2></div><button class="primary" type="button" data-new-ended-pathway>Nuovo percorso</button></div><p class="muted" style="margin:6px 0 0">La scheda resta consultabile in sola lettura. I percorsi precedenti sono disponibili nello Storico percorsi.</p>`;
    }

    const moreWrap=document.querySelector('.patient-more-wrap');
    if(moreWrap)moreWrap.style.display=status==='ended'?'none':'';

    const newPathwayButton=banner.querySelector('[data-new-ended-pathway]');
    if(newPathwayButton)newPathwayButton.onclick=()=>{void createNewPathway(patient,newPathwayButton);};

    const allowed=new Set(['summary','privacy','account']);
    document.querySelectorAll('[data-patient-tab]').forEach(button=>{
      const key=String(button.dataset.patientTab||'');
      button.hidden=!allowed.has(key);
    });

    document.querySelectorAll('#deletePatient,#desktopClinicalPdf,[data-patient-edit],#editPatient,[data-edit-patient]').forEach(node=>{node.style.display='none';});
  }

  function schedule(){
    queueMicrotask(()=>{
      patchAdapter();
      void loadStates().then(patchDetailsUi).catch(error=>console.error('NUBEMO stato scheda paziente:',error));
    });
  }

  document.addEventListener('load',event=>{
    const src=String(event.target?.src||'');
    if(src.includes('professional-legacy-supabase-adapter.js'))schedule();
  },true);

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('[data-view="patients"],[data-drawer-view="patients"],button[data-patient]')){
      void loadStates(true).catch(error=>console.error('NUBEMO refresh stato paziente:',error));
      setTimeout(schedule,0);
    }
  },true);

  const observer=new MutationObserver(schedule);
  observer.observe(app,{childList:true,subtree:true});
  schedule();
})();
