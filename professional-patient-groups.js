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
    document.querySelectorAll('.nubemo-patient-state-group').forEach(node=>node.remove());
    const oldPending=document.getElementById('pendingPathwaysCard');
    if(oldPending)oldPending.style.display='none';
  }

  function organise(){
    if(document.body.dataset.proView!=='patients'){
      removePreviousGroups();
      return;
    }

    const baseList=[...app.querySelectorAll('.pro3-patients')].find(list=>list.querySelector('button[data-patient]')&&!list.closest('.nubemo-patient-state-group'));
    if(!baseList)return;
    const baseCard=baseList.closest('section.card');
    if(!baseCard)return;

    removePreviousGroups();
    const rows=rowMap();
    const buttons=[...baseList.querySelectorAll('button[data-patient]')];
    const grouped={active:[],pending:[],draft:[],ended:[]};

    for(const button of buttons){
      const id=String(button.dataset.patient||'');
      const row=rows.get(id)||null;
      const group=classify(id,row);
      grouped[group].push(button);
      if(group==='pending')setSecondaryText(button,'Percorso proposto · in attesa di accettazione');
      else if(group==='draft')setSecondaryText(button,'Contatto provvisorio');
      else if(group==='ended')setSecondaryText(button,'Percorso terminato · storico disponibile');
    }

    baseList.replaceChildren(...grouped.active);
    const heading=baseCard.querySelector(':scope > .section-head h2');
    if(heading)heading.textContent='Attivi';

    const sections=[];
    const defs=[
      ['pending','nubemoPendingPatientsGroup','In attesa di accettazione','Il percorso diventerà attivo dopo la conferma del paziente.'],
      ['draft','nubemoDraftPatientsGroup','Contatti provvisori','Anagrafiche non ancora trasformate in pazienti.'],
      ['ended','nubemoEndedPatientsGroup','Terminati','Il paziente resta unico; i singoli percorsi terminati sono consultabili nella sua scheda.']
    ];
    for(const [key,id,title,subtitle] of defs){
      if(!grouped[key].length)continue;
      const section=groupSection(id,title,subtitle);
      section.querySelector('[data-group-count]').textContent=String(grouped[key].length);
      section.querySelector('[data-group-list]').append(...grouped[key]);
      sections.push(section);
    }

    let anchor=baseCard;
    for(const section of sections){
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
    if(event.target?.closest?.('[data-view="patients"],[data-drawer-view="patients"],#openUnreadLabPatients,#openUnreadPatients'))setTimeout(schedule,0);
  },true);
  window.addEventListener('storage',event=>{if(event.key===EXTRA_PATIENTS_KEY)schedule();});
  schedule();
})();
