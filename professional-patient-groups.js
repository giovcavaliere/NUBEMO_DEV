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

  const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const fmtDate=value=>{
    if(!value)return '—';
    const d=new Date(String(value).length===10?`${value}T12:00:00`:value);
    return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString('it-IT');
  };
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

  function setSecondaryText(node,text){
    const spans=node.querySelectorAll(':scope > div:nth-child(2) > span');
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

  function displayName(item){
    const row=item.row||{};
    const fromRow=String(row.name||[row.firstName,row.surname].filter(Boolean).join(' ')||'').trim();
    if(fromRow)return fromRow;
    return String(item.button.querySelector(':scope > div:nth-child(2) > span')?.textContent||'Paziente').trim();
  }

  function closeModal(id){document.getElementById(id)?.remove();}

  async function getPathways(patientId){
    const {data,error}=await client.rpc('get_professional_patient_pathways',{p_patient_id:patientId});
    if(error)throw error;
    return Array.isArray(data)?data:[];
  }

  async function openSnapshot(pathwayId,patientName){
    const {data,error}=await client.rpc('get_professional_pathway_snapshot',{p_pathway_id:pathwayId});
    if(error)throw error;
    const p=data?.pathway||{};
    const diary=data?.diary||[],measures=data?.measurements||[],docs=data?.documents||[],plans=data?.plans||[],labs=data?.labs||[],notes=data?.notes||[],appointments=data?.appointments||[];
    closeModal('nubemoPatientStateModal');
    const modal=document.createElement('div');
    modal.id='nubemoPatientStateModal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(4,23,20,.55);z-index:10000;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';
    modal.innerHTML=`<section class="card" style="width:min(760px,100%);margin:auto">
      <div class="section-head"><div><div class="eyebrow">PERCORSO TERMINATO</div><h2>${esc(patientName)}</h2><p class="muted" style="margin:4px 0 0">${fmtDate(p.pathway_start_date||p.started_at)} → ${fmtDate(p.ended_at)}</p></div><button class="mini" type="button" data-close-state>✕</button></div>
      <div class="grid two" style="margin-top:16px">
        <div><b>Giornate diario</b><p>${diary.length}</p></div><div><b>Misurazioni</b><p>${measures.length}</p></div>
        <div><b>Documenti</b><p>${docs.length}</p></div><div><b>Piani alimentari</b><p>${plans.length}</p></div>
        <div><b>Referti</b><p>${labs.length}</p></div><div><b>Note / appuntamenti</b><p>${notes.length} / ${appointments.length}</p></div>
      </div>
      <p class="muted">Percorso storico in sola lettura.</p>
    </section>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close-state]')?.addEventListener('click',()=>modal.remove());
    modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
  }

  async function openEndedPatient(item){
    const name=displayName(item);
    try{
      const pathways=(await getPathways(item.id)).filter(p=>p.status==='ended');
      closeModal('nubemoPatientStateModal');
      const modal=document.createElement('div');
      modal.id='nubemoPatientStateModal';
      modal.style.cssText='position:fixed;inset:0;background:rgba(4,23,20,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';
      modal.innerHTML=`<section class="card" style="width:min(760px,100%);margin:auto">
        <div class="section-head"><div><div class="eyebrow">PAZIENTE TERMINATO</div><h2>${esc(name)}</h2><p class="muted" style="margin:4px 0 0">I percorsi precedenti restano disponibili in sola lettura.</p></div><button class="mini" type="button" data-close-state>✕</button></div>
        <div class="pro3-patients" style="margin-top:16px">${pathways.map((p,i)=>`<div class="pro3-patient" style="font-weight:400"><div><span style="display:block;font-size:15px;font-weight:700;color:#34484f">Percorso ${pathways.length-i}</span><span style="display:block;margin-top:3px;font-size:12px;color:#7b898f">${fmtDate(p.pathway_start_date||p.started_at)} → ${fmtDate(p.ended_at)}</span></div><button class="mini" type="button" data-open-ended-pathway="${esc(p.id)}">Consulta</button></div>`).join('')||'<p class="muted">Nessun percorso storico disponibile.</p>'}</div>
      </section>`;
      document.body.appendChild(modal);
      modal.querySelector('[data-close-state]')?.addEventListener('click',()=>modal.remove());
      modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
      modal.querySelectorAll('[data-open-ended-pathway]').forEach(button=>button.addEventListener('click',async e=>{
        e.stopPropagation();
        button.disabled=true;
        try{await openSnapshot(button.dataset.openEndedPathway,name);}catch(error){console.error('NUBEMO storico terminato:',error);alert(error?.message||'Percorso storico non disponibile.');}
        finally{button.disabled=false;}
      }));
    }catch(error){
      console.error('NUBEMO paziente terminato:',error);
      alert(error?.message||'Storico paziente non disponibile.');
    }
  }

  async function openPendingPatient(item){
    const name=displayName(item);
    try{
      const pending=(await getPathways(item.id)).find(p=>p.status==='pending');
      closeModal('nubemoPatientStateModal');
      const modal=document.createElement('div');
      modal.id='nubemoPatientStateModal';
      modal.style.cssText='position:fixed;inset:0;background:rgba(4,23,20,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';
      modal.innerHTML=`<section class="card" style="width:min(700px,100%);margin:auto">
        <div class="section-head"><div><div class="eyebrow">IN ATTESA DI ACCETTAZIONE</div><h2>${esc(name)}</h2><p class="muted" style="margin:4px 0 0">Il percorso non è ancora operativo.</p></div><button class="mini" type="button" data-close-state>✕</button></div>
        <p><b>Stato</b><br>Proposta inviata al paziente</p>
        <p><b>Data proposta</b><br>${fmtDate(pending?.created_at)}</p>
        <p class="muted">Diario, misurazioni e documenti del nuovo percorso saranno disponibili dopo l’accettazione del paziente.</p>
      </section>`;
      document.body.appendChild(modal);
      modal.querySelector('[data-close-state]')?.addEventListener('click',()=>modal.remove());
      modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
    }catch(error){
      console.error('NUBEMO paziente pending:',error);
      alert(error?.message||'Proposta di percorso non disponibile.');
    }
  }

  async function createNewPathway(item,button){
    const name=displayName(item);
    if(!confirm(`Creare un nuovo percorso per ${name}?\n\nI percorsi terminati resteranno nello storico e non verranno riattivati.`))return;
    button.disabled=true;
    const old=button.textContent;
    button.textContent='Creazione...';
    try{
      const {data,error}=await client.rpc('create_new_professional_patient_pathway',{p_patient_id:item.id});
      if(error)throw error;
      if(typeof window.nubemoReloadProfessionalPatients==='function')await window.nubemoReloadProfessionalPatients();
      lastSignature='';
      if(data?.status==='pending')alert('Nuovo percorso proposto. Il paziente dovrà accettarlo dalla propria Area Paziente.');
      else alert('Nuovo percorso creato e attivato.');
      document.querySelector('[data-view="patients"],[data-drawer-view="patients"]')?.click();
      schedule();
    }catch(error){
      console.error('NUBEMO nuovo percorso:',error);
      alert(error?.message||'Non è stato possibile creare il nuovo percorso.');
    }finally{
      button.disabled=false;
      button.textContent=old;
    }
  }

  function cloneForGroup(item,label){
    const {button:original,group}=item;
    if(group==='draft'){
      const clone=original.cloneNode(true);
      clone.style.display='';
      if(label)setSecondaryText(clone,label);
      clone.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();original.click();});
      return clone;
    }

    const row=document.createElement('div');
    row.className='pro3-patient';
    row.style.fontWeight='400';
    row.dataset.patient=item.id;
    const source=original.cloneNode(true);
    source.style.display='';
    if(label)setSecondaryText(source,label);
    row.innerHTML=source.innerHTML;
    row.style.cursor='pointer';
    row.addEventListener('click',()=>{
      if(group==='pending')void openPendingPatient(item);
      else if(group==='ended')void openEndedPatient(item);
    });

    if(group==='ended'){
      const action=document.createElement('button');
      action.type='button';
      action.className='mini';
      action.textContent='Nuovo percorso';
      action.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();void createNewPathway(item,action);});
      row.appendChild(action);
    }
    return row;
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
    if(signature===lastSignature&&document.getElementById('nubemoPatientGroupsMarker'))return;

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
      for(const item of grouped[key])list.appendChild(cloneForGroup(item,rowLabel));
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
