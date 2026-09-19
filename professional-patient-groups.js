// NUBEMO — raggruppamento anagrafiche professionista per stato percorso.
(() => {
  'use strict';
  const client=window.nubemoSupabase;
  const app=document.getElementById('proApp');
  if(!client||!app)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  let busy=false;
  let queued=false;
  let stateMap=new Map();
  let lastSignature='';

  function parse(value,fallback){try{return JSON.parse(value)}catch(_){return fallback}}

  async function loadStates(){
    const {data,error}=await client.rpc('get_professional_patient_pathway_states');
    if(error)throw error;
    stateMap=new Map((Array.isArray(data)?data:[]).map(row=>[String(row.patient_id),String(row.status||'ended')]));
  }

  function rowMap(){
    const rows=parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]',[]);
    return new Map((Array.isArray(rows)?rows:[]).map(row=>[String(row?.id||''),row]));
  }

  function groupSection(id,title,subtitle){
    const section=document.createElement('section');
    section.className='card nubemo-patient-state-group';
    section.id=id;
    section.innerHTML=`<div class="section-head"><div><h2>${title}</h2>${subtitle?`<p class="muted" style="margin:4px 0 0">${subtitle}</p>`:''}</div><span class="pill" data-group-count>0</span></div><div class="pro3-patients" data-group-list></div>`;
    return section;
  }

  function setSecondaryText(button,text){
    const spans=button.querySelectorAll(':scope > div:nth-child(2) > span');
    if(spans.length>1)spans[1].textContent=text;
  }

  function classify(id,row){
    if(row?._draft===true||row?.relationshipStatus==='draft')return 'draft';
    const status=stateMap.get(String(id))||'ended';
    if(status==='active')return 'active';
    if(status==='pending')return 'pending';
    return 'ended';
  }

  function removePreviousGroups(){
    document.querySelectorAll('.nubemo-patient-state-group,#nubemoPatientGroupsMarker').forEach(node=>node.remove());
    const oldPending=document.getElementById('pendingPathwaysCard');
    if(oldPending)oldPending.style.display='none';
  }

  function cloneForGroup(original,label){
    const clone=original.cloneNode(true);
    clone.style.display='';
    if(label)setSecondaryText(clone,label);
    clone.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      original.click();
    });
    return clone;
  }

  function organise(){
    if(document.body.dataset.proView!=='patients'){
      removePreviousGroups();
      lastSignature='';
      return;
    }

    const baseList=[...app.querySelectorAll('.pro3-patients')].find(list=>list.querySelector('button[data-patient]')&&!list.closest('.nubemo-patient-state-group'));
    if(!baseList)return;
    const baseCard=baseList.closest('section.card');
    if(!baseCard)return;

    const rows=rowMap();
    const buttons=[...baseList.querySelectorAll('button[data-patient]')];
    const classified=buttons.map(button=>{
      const id=String(button.dataset.patient||'');
      return {button,id,row:rows.get(id)||null,group:classify(id,rows.get(id)||null)};
    });
    const signature=classified.map(x=>`${x.id}:${x.group}`).sort().join('|');
    if(signature===lastSignature&&document.getElementById('nubemoPatientGroupsMarker')){
      const oldPending=document.getElementById('pendingPathwaysCard');
      if(oldPending)oldPending.style.display='none';
      return;
    }

    removePreviousGroups();
    lastSignature=signature;

    const grouped={active:[],pending:[],draft:[],ended:[]};
    for(const item of classified){
      grouped[item.group].push(item);
      item.button.style.display=item.group==='active'?'':'none';
    }

    const heading=baseCard.querySelector(':scope > .section-head h2');
    if(heading)heading.textContent='Attivi';

    const marker=document.createElement('div');
    marker.id='nubemoPatientGroupsMarker';
    marker.hidden=true;
    baseCard.insertAdjacentElement('afterend',marker);

    const defs=[
      ['pending','nubemoPendingPatientsGroup','In attesa di accettazione','Il percorso diventerà attivo dopo la conferma del paziente.','Percorso proposto · in attesa di accettazione'],
      ['draft','nubemoDraftPatientsGroup','Contatti provvisori','Anagrafiche non ancora trasformate in pazienti.','Contatto provvisorio'],
      ['ended','nubemoEndedPatientsGroup','Terminati','Il paziente resta unico; i singoli percorsi terminati sono consultabili nella sua scheda.','Percorso terminato · storico disponibile']
    ];

    let anchor=marker;
    for(const [key,id,title,subtitle,rowLabel] of defs){
      if(!grouped[key].length)continue;
      const section=groupSection(id,title,subtitle);
      section.querySelector('[data-group-count]').textContent=String(grouped[key].length);
      const list=section.querySelector('[data-group-list]');
      for(const item of grouped[key])list.appendChild(cloneForGroup(item.button,rowLabel));
      anchor.insertAdjacentElement('afterend',section);
      anchor=section;
    }
  }

  async function refresh(){
    if(busy)return;
    busy=true;
    try{
      if(document.body.dataset.proView==='patients')await loadStates();
      organise();
    }catch(error){
      console.error('NUBEMO raggruppamento pazienti:',error);
    }finally{busy=false;}
  }

  function schedule(){
    if(queued)return;
    queued=true;
    setTimeout(()=>{queued=false;void refresh();},50);
  }

  const observer=new MutationObserver(schedule);
  observer.observe(app,{childList:true,subtree:true});
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('[data-view="patients"],[data-drawer-view="patients"],#openUnreadLabPatients,#openUnreadPatients')){
      lastSignature='';
      setTimeout(schedule,0);
    }
  },true);
  window.addEventListener('storage',event=>{if(event.key===EXTRA_PATIENTS_KEY){lastSignature='';schedule();}});
  schedule();
})();
