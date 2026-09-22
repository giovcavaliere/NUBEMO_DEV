// NUBEMO — visite di coppia: secondo paziente senza alterare il modello legacy della UI.
(() => {
  'use strict';

  const APPT_KEY='diario-pro-appts-recovery-v1';
  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  const app=document.getElementById('proApp');
  if(!app)return;

  let editingEventId='';
  let selectedPatientId='';
  let pendingOpenEventId='';
  let mounting=false;

  const parse=(value,fallback)=>{try{return JSON.parse(value)}catch(_){return fallback}};
  const appointments=()=>{const rows=parse(localStorage.getItem(APPT_KEY)||'[]',[]);return Array.isArray(rows)?rows:[];};
  const patients=()=>{const rows=parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]',[]);return Array.isArray(rows)?rows:[];};
  const idsFor=a=>[...new Set((Array.isArray(a?.patientIds)&&a.patientIds.length?a.patientIds:[a?.patientId]).filter(Boolean).map(String))].slice(0,2);
  const patientById=id=>patients().find(row=>String(row?.id||'')===String(id||''))||null;
  const patientName=id=>{
    const p=patientById(id);
    if(!p)return 'Paziente';
    const name=p.name||[p.firstName||p.first_name,p.surname||p.last_name].filter(Boolean).join(' ').trim();
    return name||'Paziente';
  };
  const esc=(value='')=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  function ensureStyles(){
    if(document.getElementById('nubemoCoupleAppointmentStyles'))return;
    const style=document.createElement('style');
    style.id='nubemoCoupleAppointmentStyles';
    style.textContent=`
      .nubemo-couple-add{margin-top:10px;width:auto}
      .nubemo-couple-box{margin-top:14px;padding-top:14px;border-top:1px solid #e3eaeb}
      .nubemo-couple-box[hidden]{display:none!important}
      .nubemo-couple-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .nubemo-couple-head label{margin:0}
      .nubemo-couple-remove{width:auto;margin:0}
      .nubemo-couple-option[hidden]{display:none!important}
      .nubemo-couple-visit-badge{margin-left:8px;font-size:10px;font-weight:800;padding:3px 7px;border-radius:999px;background:#e7f4f4;color:#167d89}
    `;
    document.head.appendChild(style);
  }

  function secondPatientOptions(primaryId,selectedId){
    return patients().map(p=>{
      const id=String(p.id||'');
      if(!id)return'';
      const name=p.name||[p.firstName||p.first_name,p.surname||p.last_name].filter(Boolean).join(' ').trim()||'Paziente';
      const phone=p.phone||'';
      return `<button type="button" class="agenda-patient-option nubemo-couple-option ${id===String(selectedId||'')?'selected':''}" data-couple-patient="${esc(id)}" ${id===String(primaryId||'')?'hidden':''}><span>${esc(name)}</span>${phone?`<small>${esc(phone)}</small>`:''}</button>`;
    }).join('');
  }

  function currentEditingAppointment(){
    if(!editingEventId)return null;
    return appointments().find(a=>String(a.id)===String(editingEventId))||null;
  }

  function refreshSecondOptions(){
    const primary=String(document.getElementById('ePatient')?.value||'');
    const second=String(document.getElementById('ePatient2')?.value||'');
    document.querySelectorAll('[data-couple-patient]').forEach(button=>{
      const id=String(button.dataset.couplePatient||'');
      button.hidden=id===primary;
      button.classList.toggle('selected',id===second);
    });
    if(second&&second===primary){
      const hidden=document.getElementById('ePatient2');
      if(hidden)hidden.value='';
    }
  }

  function selectSecondPatient(id){
    const hidden=document.getElementById('ePatient2');
    if(!hidden)return;
    const primary=String(document.getElementById('ePatient')?.value||'');
    if(id&&String(id)===primary)return;
    hidden.value=id||'';
    refreshSecondOptions();
  }

  function patchSavedAppointment(snapshot){
    const rows=appointments();
    let target=null;
    if(snapshot.editingId)target=rows.find(a=>String(a.id)===String(snapshot.editingId))||null;
    if(!target){
      const added=rows.filter(a=>!snapshot.beforeIds.has(String(a.id)));
      target=added.find(a=>String(a.patientId||'')===snapshot.primary&&String(a.date||'')===snapshot.date&&String(a.time||'')===snapshot.time&&String(a.type||'')===snapshot.type)||added[0]||null;
    }
    if(!target)return;
    const subjectIds=[snapshot.primary,snapshot.second].filter(Boolean).filter((id,index,arr)=>arr.indexOf(id)===index).slice(0,2);
    target.patientId=subjectIds[0]||null;
    target.patientIds=subjectIds;
    localStorage.setItem(APPT_KEY,JSON.stringify(rows));
  }

  function bindSave(button){
    if(button.dataset.coupleBound==='1')return;
    button.dataset.coupleBound='1';
    let snapshot=null;
    button.addEventListener('click',()=>{
      const type=String(document.getElementById('eType')?.value||'');
      snapshot={
        editingId:editingEventId,
        beforeIds:new Set(appointments().map(a=>String(a.id))),
        type,
        primary:type==='personal'?'':String(document.getElementById('ePatient')?.value||''),
        second:type==='personal'?'':String(document.getElementById('ePatient2')?.value||''),
        date:(document.getElementById('eDate')?.value||''),
        time:String(document.getElementById('eTime')?.value||'')
      };
    },true);
    button.addEventListener('click',()=>{
      if(!snapshot||snapshot.type==='personal')return;
      queueMicrotask(()=>patchSavedAppointment(snapshot));
    });
  }

  function mountEventForm(){
    if(mounting)return;
    const patientBox=document.getElementById('patientBox');
    const firstResults=document.getElementById('ePatientResults');
    const saveButton=document.getElementById('saveEvent');
    if(!patientBox||!firstResults||!saveButton)return;
    mounting=true;
    try{
      ensureStyles();
      bindSave(saveButton);
      if(document.getElementById('nubemoSecondPatientBox'))return;

      const current=currentEditingAppointment();
      const currentIds=idsFor(current);
      const primary=String(document.getElementById('ePatient')?.value||currentIds[0]||'');
      const second=currentIds.find(id=>String(id)!==primary)||'';

      const add=document.createElement('button');
      add.type='button';
      add.id='nubemoAddSecondPatient';
      add.className='secondary nubemo-couple-add';
      add.textContent='＋ Aggiungi secondo paziente';

      const box=document.createElement('div');
      box.id='nubemoSecondPatientBox';
      box.className='nubemo-couple-box';
      box.hidden=!second;
      box.innerHTML=`<div class="nubemo-couple-head"><label>Secondo paziente</label><button type="button" class="mini danger-text nubemo-couple-remove" id="nubemoRemoveSecondPatient">Rimuovi</button></div>
        <div class="agenda-patient-picker">
          <input id="ePatient2Search" type="search" placeholder="Cerca secondo paziente per nome o cognome..." autocomplete="off">
          <input id="ePatient2" type="hidden" value="${esc(second)}">
          <div id="ePatient2Results" class="agenda-patient-results">${secondPatientOptions(primary,second)}</div>
        </div>`;

      firstResults.insertAdjacentElement('afterend',add);
      add.insertAdjacentElement('afterend',box);

      add.addEventListener('click',()=>{box.hidden=false;add.hidden=true;document.getElementById('ePatient2Search')?.focus();});
      if(second)add.hidden=true;
      document.getElementById('nubemoRemoveSecondPatient')?.addEventListener('click',()=>{selectSecondPatient('');box.hidden=true;add.hidden=false;});
      document.querySelectorAll('[data-couple-patient]').forEach(button=>button.addEventListener('click',()=>selectSecondPatient(button.dataset.couplePatient)));
      document.getElementById('ePatient2Search')?.addEventListener('input',event=>{
        const q=String(event.target.value||'').trim().toLocaleLowerCase('it-IT');
        document.querySelectorAll('[data-couple-patient]').forEach(button=>{
          const isPrimary=String(button.dataset.couplePatient||'')===String(document.getElementById('ePatient')?.value||'');
          button.hidden=isPrimary||(q!==''&&!button.innerText.toLocaleLowerCase('it-IT').includes(q));
        });
      });
      document.querySelectorAll('[data-agenda-patient]').forEach(button=>button.addEventListener('click',()=>queueMicrotask(refreshSecondOptions)));
      document.getElementById('eType')?.addEventListener('change',event=>{
        const personal=event.target.value==='personal';
        add.style.display=personal?'none':'';
        box.style.display=personal?'none':'';
      });
      refreshSecondOptions();
    }finally{mounting=false;}
  }

  function patchAgendaLabels(){
    const byId=new Map(appointments().map(a=>[String(a.id),a]));
    document.querySelectorAll('[data-event]').forEach(node=>{
      const a=byId.get(String(node.dataset.event||''));
      const ids=idsFor(a);
      if(ids.length<2||a?.type==='personal')return;
      const signature=ids.join('|');
      if(node.dataset.coupleSignature===signature)return;
      const names=ids.map(patientName).join(' + ');
      const span=node.querySelector('span');
      if(!span)return;
      if(node.classList.contains('pro3-cal-event'))span.textContent=names;
      else{
        const parts=String(span.textContent||'').split(' · ');
        span.textContent=parts.length>1?`${names} · ${parts.slice(1).join(' · ')}`:names;
      }
      node.dataset.coupleSignature=signature;
    });
  }

  function patchSecondaryVisits(){
    if(!selectedPatientId)return;
    const visitsTab=document.querySelector('[data-tab="visits"].active,[data-tab="visits"][aria-selected="true"]');
    if(!visitsTab)return;
    const shared=appointments().filter(a=>a.type!=='personal'&&String(a.patientId||'')!==selectedPatientId&&idsFor(a).includes(selectedPatientId));
    if(!shared.length)return;
    const existing=new Set([...document.querySelectorAll('[data-edit-visit],[data-couple-edit-visit]')].map(b=>String(b.dataset.editVisit||b.dataset.coupleEditVisit||'')));
    let anchor=document.querySelector('[data-edit-visit],[data-couple-edit-visit]')?.parentElement||null;
    if(!anchor){
      const empty=[...app.querySelectorAll('p.muted')].find(p=>p.textContent.trim()==='Nessuna visita.');
      if(empty){anchor=empty.parentElement;empty.remove();}
    }
    if(!anchor)return;
    shared.sort((a,b)=>String(b.date+b.time).localeCompare(String(a.date+a.time))).forEach(a=>{
      if(existing.has(String(a.id)))return;
      const button=document.createElement('button');
      button.type='button';
      button.className=`pro3-event pro3-event-clickable ${a.type==='first'?'pro-first':'pro-control'}`;
      button.dataset.coupleEditVisit=String(a.id);
      button.innerHTML=`<b>${esc(String(a.date||'').split('-').reverse().join('-'))} · ${esc(a.time||'')}</b><span>${a.type==='first'?'Prima visita':'Controllo'} · ${esc(a.duration||30)} min <span class="nubemo-couple-visit-badge">COPPIA</span></span>`;
      button.addEventListener('click',()=>openAgendaEvent(a.id));
      anchor.appendChild(button);
    });
  }

  function openAgendaEvent(id){
    pendingOpenEventId=String(id||'');
    const action=document.querySelector('[data-view="agenda"],[data-drawer-view="agenda"],#goAgenda');
    action?.click();
  }

  function tryOpenPendingEvent(){
    if(!pendingOpenEventId)return;
    const eventButton=document.querySelector(`[data-event="${CSS.escape(pendingOpenEventId)}"]`);
    if(!eventButton)return;
    pendingOpenEventId='';
    eventButton.click();
  }

  function refresh(){
    mountEventForm();
    patchAgendaLabels();
    patchSecondaryVisits();
    tryOpenPendingEvent();
  }

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-event],[data-edit-visit],#newEvent,.pro3-slot,[data-patient],[data-drawer-patient],[data-tab]');
    if(!target)return;
    if(target.matches('[data-event]'))editingEventId=String(target.dataset.event||'');
    else if(target.matches('[data-edit-visit]'))editingEventId=String(target.dataset.editVisit||'');
    else if(target.matches('#newEvent,.pro3-slot'))editingEventId='';
    if(target.matches('[data-patient]'))selectedPatientId=String(target.dataset.patient||'');
    if(target.matches('[data-drawer-patient]'))selectedPatientId=String(target.dataset.drawerPatient||'');
    queueMicrotask(refresh);
  },true);

  const observer=new MutationObserver(()=>queueMicrotask(refresh));
  observer.observe(app,{childList:true,subtree:true});
  queueMicrotask(refresh);
})();