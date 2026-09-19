// NUBEMO — storico percorsi professionista/paziente.
(() => {
  'use strict';
  const client=window.nubemoSupabase;
  const app=document.getElementById('proApp');
  if(!client||!app)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  let lastKey='';
  let loading=false;

  const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const fmtDate=value=>{
    if(!value)return '—';
    const d=new Date(String(value).length===10?`${value}T12:00:00`:value);
    return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString('it-IT');
  };
  function parse(value,fallback){try{return JSON.parse(value)}catch(_){return fallback}}
  function currentPatientId(){
    const drawer=document.querySelector('[data-drawer-patient]')?.dataset.drawerPatient;
    if(drawer)return String(drawer);
    const title=document.querySelector('.patient-global-title')?.textContent?.trim()||'';
    const rows=parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]',[]);
    const row=Array.isArray(rows)?rows.find(item=>item?.id&&title.includes(String(item.name||'').trim())):null;
    return row?.id?String(row.id):'';
  }
  function patientName(patientId){
    const rows=parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]',[]);
    const row=Array.isArray(rows)?rows.find(item=>String(item?.id||'')===String(patientId)):null;
    return String(row?.name||[row?.firstName,row?.surname].filter(Boolean).join(' ')||'Paziente');
  }

  async function getPathways(patientId){
    const {data,error}=await client.rpc('get_professional_patient_pathways',{p_patient_id:patientId});
    if(error)throw error;
    return Array.isArray(data)?data:[];
  }

  function summaryRow(label,value){return `<div style="display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid #edf1f2"><span class="muted">${esc(label)}</span><b style="text-align:right">${esc(value??'—')}</b></div>`;}

  async function openSnapshot(pathwayId,patientId){
    const {data,error}=await client.rpc('get_professional_pathway_snapshot',{p_pathway_id:pathwayId});
    if(error)throw error;
    const p=data?.pathway||{},c=data?.clinical||{},diary=data?.diary||[],measures=data?.measurements||[],docs=data?.documents||[],plans=data?.plans||[],labs=data?.labs||[],notes=data?.notes||[],appointments=data?.appointments||[];
    const firstWeight=[...diary].find(x=>x?.weight_kg!=null)?.weight_kg;
    const lastWeight=[...diary].reverse().find(x=>x?.weight_kg!=null)?.weight_kg;
    document.getElementById('nubemoPathwayHistoryModal')?.remove();
    const modal=document.createElement('div');
    modal.id='nubemoPathwayHistoryModal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(4,23,20,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';
    modal.innerHTML=`<section class="card" style="width:min(900px,100%);margin:auto;max-height:none">
      <div class="section-head"><div><div class="eyebrow">STORICO PERCORSO</div><h2 style="margin-bottom:4px">${esc(patientName(patientId))}</h2><p class="muted" style="margin:0">${fmtDate(p.pathway_start_date||p.started_at)} → ${fmtDate(p.ended_at)}</p></div><button class="mini" type="button" data-close-pathway-history>✕</button></div>
      <div class="grid two" style="margin-top:16px"><section>${summaryRow('Stato','Terminato')}${summaryRow('Giornate diario',diary.length)}${summaryRow('Peso iniziale',firstWeight!=null?`${firstWeight} kg`:'—')}${summaryRow('Peso finale',lastWeight!=null?`${lastWeight} kg`:'—')}</section><section>${summaryRow('Misurazioni professionista',measures.length)}${summaryRow('Documenti',docs.length)}${summaryRow('Piani alimentari',plans.length)}${summaryRow('Referti',labs.length)}</section></div>
      <section class="card" style="margin-top:16px"><h3>Anamnesi del percorso</h3>${c?`<div class="grid two">${summaryRow('Obiettivo peso',c.goal_weight_kg!=null?`${c.goal_weight_kg} kg`:'—')}${summaryRow('Attività',c.activity||'—')}${summaryRow('Diagnosi',c.diagnosis||'—')}${summaryRow('Farmaci',c.medications||'—')}</div><p><b>Osservazioni</b><br>${esc(c.observations||'—')}</p><p><b>Obiettivi</b><br>${esc(c.objectives||'—')}</p>`:'<p class="muted">Nessuna anamnesi disponibile per questo percorso.</p>'}</section>
      <section class="card" style="margin-top:16px"><div class="section-head"><h3>Diario</h3><span class="pill">${diary.length}</span></div>${diary.length?`<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px">Data</th><th style="text-align:left;padding:8px">Peso</th><th style="text-align:left;padding:8px">Note</th></tr></thead><tbody>${diary.map(d=>`<tr><td style="padding:8px;border-top:1px solid #edf1f2">${fmtDate(d.entry_date)}</td><td style="padding:8px;border-top:1px solid #edf1f2">${d.weight_kg!=null?esc(d.weight_kg)+' kg':'—'}</td><td style="padding:8px;border-top:1px solid #edf1f2">${esc(d.notes||d.sport||'')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Nessuna giornata registrata.</p>'}</section>
      <section class="card" style="margin-top:16px"><div class="section-head"><h3>Altri dati del percorso</h3></div><div class="grid two">${summaryRow('Note professionista',notes.length)}${summaryRow('Appuntamenti',appointments.length)}${summaryRow('Documenti',docs.length)}${summaryRow('Piani',plans.length)}</div></section>
      <p class="muted" style="margin-top:16px">Percorso storico in sola lettura.</p>
    </section>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close-pathway-history]')?.addEventListener('click',()=>modal.remove());
    modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
  }

  function renderHistory(patientId,pathways){
    document.getElementById('nubemoPathwayHistoryCard')?.remove();
    if(document.body.dataset.proView!=='details')return;
    const ended=pathways.filter(x=>x.status==='ended');
    if(!ended.length)return;
    const card=document.createElement('section');
    card.className='card';
    card.id='nubemoPathwayHistoryCard';
    card.innerHTML=`<div class="section-head"><div><h2>Storico percorsi</h2><p class="muted" style="margin:4px 0 0">Percorsi precedenti con questo professionista, disponibili in sola lettura.</p></div><span class="pill">${ended.length}</span></div><div class="pro3-patients">${ended.map((p,i)=>`<div class="pro3-patient" style="font-weight:400"><div><span style="display:block;font-size:15px;font-weight:700;color:#34484f">Percorso ${ended.length-i}</span><span style="display:block;margin-top:3px;font-size:12px;color:#7b898f">${fmtDate(p.pathway_start_date||p.started_at)} → ${fmtDate(p.ended_at)} · ${p.diary_count||0} giornate diario · ${p.document_count||0} documenti</span></div><button class="mini" type="button" data-open-pathway-history="${esc(p.id)}">Consulta</button></div>`).join('')}</div>`;
    app.appendChild(card);
    card.querySelectorAll('[data-open-pathway-history]').forEach(button=>button.addEventListener('click',async()=>{
      button.disabled=true;const old=button.textContent;button.textContent='Apertura...';
      try{await openSnapshot(button.dataset.openPathwayHistory,patientId);}catch(error){console.error('NUBEMO storico percorso:',error);alert(error?.message||'Percorso storico non disponibile.');}
      finally{button.disabled=false;button.textContent=old;}
    }));
  }

  async function refreshDetails(){
    if(document.body.dataset.proView!=='details'){document.getElementById('nubemoPathwayHistoryCard')?.remove();lastKey='';return;}
    const patientId=currentPatientId();if(!patientId||loading)return;
    const key=`${patientId}:${document.body.dataset.proView}`;
    if(key===lastKey&&document.getElementById('nubemoPathwayHistoryCard'))return;
    loading=true;
    try{const pathways=await getPathways(patientId);lastKey=key;renderHistory(patientId,pathways);}catch(error){console.error('NUBEMO carica storico percorsi:',error);}finally{loading=false;}
  }

  async function createNewPathway(patientId,button){
    const name=patientName(patientId);
    if(!confirm(`Creare un nuovo percorso per ${name}?\n\nIl percorso terminato resterà nello storico e non verrà riattivato.`))return;
    if(button){button.disabled=true;button.textContent='Creazione...';}
    try{
      const {data,error}=await client.rpc('create_new_professional_patient_pathway',{p_patient_id:patientId});
      if(error)throw error;
      if(typeof window.nubemoReloadProfessionalPatients==='function')await window.nubemoReloadProfessionalPatients();
      if(data?.status==='pending')alert('Nuovo percorso proposto. Il paziente dovrà accettarlo dalla propria Area Paziente.');
      else alert('Nuovo percorso creato e attivato.');
      document.querySelector('[data-view="patients"],[data-drawer-view="patients"]')?.click();
    }catch(error){console.error('NUBEMO nuovo percorso:',error);alert(error?.message||'Non è stato possibile creare il nuovo percorso.');}
    finally{if(button){button.disabled=false;button.textContent='Nuovo percorso';}}
  }

  document.addEventListener('click',event=>{
    const old=event.target?.closest?.('[data-reactivate-patient]');
    if(old){
      event.preventDefault();event.stopImmediatePropagation();
      const patientId=old.dataset.reactivatePatient;
      old.textContent='Nuovo percorso';
      void createNewPathway(patientId,old);
      return;
    }
  },true);

  const observer=new MutationObserver(()=>queueMicrotask(()=>{
    document.querySelectorAll('[data-reactivate-patient]').forEach(b=>{if(b.textContent!=='Nuovo percorso')b.textContent='Nuovo percorso';});
    void refreshDetails();
  }));
  observer.observe(app,{childList:true,subtree:true});
  queueMicrotask(()=>{document.querySelectorAll('[data-reactivate-patient]').forEach(b=>b.textContent='Nuovo percorso');void refreshDetails();});
})();