// NUBEMO — Area Professionista / Agenda e visite, unica sorgente Supabase
(() => {
  'use strict';
  const services = window.nubemoProfessionalServices;
  const patients = window.nubemoProfessionalPatients;
  const client = window.nubemoSupabase;
  if (!services || !patients || !client) return;

  const visitCache = new Map();
  let agendaRows = [];
  let weekStart = mondayOf(new Date());
  let agendaLoading = false;

  const esc=(v='')=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const pid=()=>patients.getCurrentPatientId?.()||'';
  const context=()=>window.nubemoProfessionalContext||{};
  const allPatients=()=>[...(context().patients||[]),...(context().endedPatients||[])];
  const patientName=id=>{const r=allPatients().find(x=>x.id===id),p=r?.profile||{};return [p.first_name,p.last_name].filter(Boolean).join(' ')||p.email||'Paziente';};
  const isVisits=()=>document.body.dataset.proView==='details'&&!!document.querySelector('[data-patient-tab="visits"].active');
  const isAgenda=()=>document.body.dataset.proView==='agenda';
  const active=()=>patients.getPatientById?.(pid())?.relationship?.status!=='ended';
  const fmt=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?esc(v):d.toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'});};
  const isoDate=d=>{const z=d.getTimezoneOffset()*60000;return new Date(d-z).toISOString().slice(0,10);};
  function mondayOf(value){const d=new Date(value);d.setHours(12,0,0,0);const day=d.getDay()||7;d.setDate(d.getDate()-day+1);return d;}
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
  function localValue(iso){if(!iso)return '';const d=new Date(iso),local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,16);}
  function localDateTime(date,hour='09:00'){return `${isoDate(date)}T${hour}`;}

  // ---- Visite nella scheda paziente ----
  function visitHost(){return document.querySelector('.patient-content-card');}
  function replaceVisits(patientId,html,sig,bind){const card=visitHost();if(!card)return;const old=document.getElementById('nubemoProfessionalVisits');if(old&&old.dataset.patientId===patientId&&old._sig===sig){bind?.(old);return;}const head=card.querySelector(':scope > .patient-section-head');Array.from(card.children).forEach(c=>{if(c!==head)c.remove();});const b=document.createElement('div');b.id='nubemoProfessionalVisits';b.dataset.patientId=patientId;b._sig=sig;b.innerHTML=html;card.appendChild(b);bind?.(b);}
  async function loadVisits(patientId,force=false){if(!force&&visitCache.has(patientId))return visitCache.get(patientId);const rows=await services.loadPatientAppointments(patientId);visitCache.set(patientId,rows||[]);return rows||[];}
  function visitsHtml(rows,canEdit){return `<div class="section-head"><h2>Visite</h2>${canEdit?'<button class="mini" id="nubemoNewVisit">＋ Nuova visita</button>':''}</div>${rows.length?rows.map(r=>`<div class="pro3-event"><b>${fmt(r.starts_at)}</b><span>${esc(r.appointment_type||'Visita')} · ${esc(r.status||'')}</span>${r.notes?`<span>${esc(r.notes)}</span>`:''}${canEdit?`<button class="mini" data-edit-visit-id="${esc(r.id)}">Modifica</button>`:''}</div>`).join(''):'<p class="muted">Nessuna visita.</p>'}`;}
  function renderVisits(patientId,rows){const canEdit=active();replaceVisits(patientId,visitsHtml(rows,canEdit),JSON.stringify(rows),h=>{h.querySelector('#nubemoNewVisit')?.addEventListener('click',()=>openPatientVisitEditor(patientId,null));h.querySelectorAll('[data-edit-visit-id]').forEach(b=>b.addEventListener('click',()=>openPatientVisitEditor(patientId,rows.find(r=>r.id===b.dataset.editVisitId))));});}
  function openPatientVisitEditor(patientId,existing){if(!active())return alert('Paziente attivo non disponibile.');openAppointmentEditor({patientId,existing,patientLocked:true,onSaved:async()=>{renderVisits(patientId,await loadVisits(patientId,true));await refreshAgendaIfVisible();}});}

  // ---- Agenda generale ----
  async function loadAgenda(){
    const professionalId=context().professional?.id;if(!professionalId)return [];
    const {data:rows,error}=await client.from('appointments').select('id,professional_id,starts_at,ends_at,appointment_type,status,notes,created_by_user_id,created_at,updated_at').eq('professional_id',professionalId).is('deleted_at',null).order('starts_at');
    if(error)throw error;if(!rows?.length)return [];
    const ids=rows.map(r=>r.id);
    const {data:links,error:linkError}=await client.from('appointment_patients').select('appointment_id,patient_id').in('appointment_id',ids);if(linkError)throw linkError;
    const patientByAppointment=new Map((links||[]).map(l=>[l.appointment_id,l.patient_id]));
    return rows.map(r=>({...r,patient_id:patientByAppointment.get(r.id)||null}));
  }
  function agendaTypeClass(row){const t=String(row.appointment_type||'').toLowerCase();if(!row.patient_id)return 'pro-personal';if(t.includes('prima'))return 'pro-first';return 'pro-control';}
  function agendaGrid(rows){
    const days=Array.from({length:5},(_,i)=>addDays(weekStart,i)),start=7*60,end=20*60,step=30;
    let grid='<div class="pro3-calendar">';grid+='<div class="pro3-cal-head"></div>'+days.map(d=>`<div class="pro3-cal-head"><b>${d.toLocaleDateString('it-IT',{weekday:'short'})}</b><span>${d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'})}</span></div>`).join('');
    for(let min=start;min<end;min+=step){const hh=String(Math.floor(min/60)).padStart(2,'0'),mm=String(min%60).padStart(2,'0');grid+=`<div class="pro3-cal-time">${hh}:${mm}</div>`;for(let d=0;d<days.length;d++)grid+='<div class="pro3-cal-slot"></div>';}
    const weekEnd=addDays(weekStart,5);
    rows.filter(a=>{const x=new Date(a.starts_at);return x>=weekStart&&x<weekEnd;}).forEach(a=>{const s=new Date(a.starts_at),e=new Date(a.ends_at),di=Math.max(0,Math.min(4,(s.getDay()||7)-1)),mins=s.getHours()*60+s.getMinutes(),si=Math.max(0,Math.round((mins-start)/step)),span=Math.max(1,Math.ceil((e-s)/60000/step));const label=a.patient_id?patientName(a.patient_id):(a.notes||'Impegno personale');grid+=`<button class="pro3-cal-event ${agendaTypeClass(a)}" data-supa-event="${a.id}" style="grid-column:${di+2};grid-row:${si+2}/span ${span}"><b>${s.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</b><span>${esc(label)}</span></button>`;});
    return grid+'</div>';
  }
  function agendaHtml(rows){const end=addDays(weekStart,4);return `<section class="card pro3-agenda-tools"><button class="mini" id="nubemoPrevWeek">‹</button><button class="mini" id="nubemoTodayWeek">Oggi</button><button class="mini" id="nubemoNextWeek">›</button><span>${weekStart.toLocaleDateString('it-IT')} — ${end.toLocaleDateString('it-IT')}</span><button class="primary compact" id="nubemoNewAgendaEvent">＋ Nuovo evento</button></section><section class="card"><div class="pro3-legend"><span>🟨 Prima visita</span><span>🟩 Controllo / visita</span><span>⬜ Impegno personale</span></div></section><section class="card pro3-calendar-wrap">${agendaGrid(rows)}</section>`;}
  function bindAgenda(root){root.querySelector('#nubemoPrevWeek')?.addEventListener('click',()=>{weekStart=addDays(weekStart,-7);renderAgendaRoot();});root.querySelector('#nubemoNextWeek')?.addEventListener('click',()=>{weekStart=addDays(weekStart,7);renderAgendaRoot();});root.querySelector('#nubemoTodayWeek')?.addEventListener('click',()=>{weekStart=mondayOf(new Date());renderAgendaRoot();});root.querySelector('#nubemoNewAgendaEvent')?.addEventListener('click',()=>openAppointmentEditor({patientId:null,existing:null,patientLocked:false,onSaved:refreshAgendaIfVisible}));root.querySelectorAll('[data-supa-event]').forEach(b=>b.addEventListener('click',()=>{const row=agendaRows.find(r=>r.id===b.dataset.supaEvent);if(row)openAppointmentEditor({patientId:row.patient_id,existing:row,patientLocked:!!row.patient_id,onSaved:async()=>{if(row.patient_id)visitCache.delete(row.patient_id);await refreshAgendaIfVisible();}});}));}
  function renderAgendaRoot(){if(!isAgenda())return;let root=document.getElementById('nubemoProfessionalAgendaRoot');if(!root){const tools=document.querySelector('.pro3-agenda-tools'),calendar=document.querySelector('.pro3-calendar-wrap');if(!tools||!calendar)return;const legend=tools.nextElementSibling;root=document.createElement('div');root.id='nubemoProfessionalAgendaRoot';tools.replaceWith(root);if(legend&&legend!==calendar)legend.remove();calendar.remove();}root.innerHTML=agendaHtml(agendaRows);bindAgenda(root);}
  async function syncGeneralAgenda(force=false){if(!isAgenda()||agendaLoading)return;agendaLoading=true;try{if(force||!agendaRows.length)agendaRows=await loadAgenda();renderAgendaRoot();}catch(e){console.error('NUBEMO agenda load',e);const root=document.getElementById('nubemoProfessionalAgendaRoot');if(root)root.innerHTML='<section class="card"><p class="muted">Non è stato possibile caricare l’Agenda.</p></section>';}finally{agendaLoading=false;}}
  async function refreshAgendaIfVisible(){agendaRows=await loadAgenda();if(isAgenda())renderAgendaRoot();}

  function openAppointmentEditor({patientId=null,existing=null,patientLocked=false,onSaved=null}){
    document.getElementById('nubemoAppointmentOverlay')?.remove();
    const o=document.createElement('div');o.className='clinical-overlay';o.id='nubemoAppointmentOverlay';
    const start=existing?localValue(existing.starts_at):localDateTime(new Date(),'09:00'),end=existing?localValue(existing.ends_at):localDateTime(new Date(),'10:00');
    const activePatients=(context().patients||[]);const selected=patientId||existing?.patient_id||'';
    o.innerHTML=`<section class="clinical-modal"><button class="monubi-x" id="closeAppointment">×</button><div class="eyebrow">AGENDA</div><h2>${existing?'Modifica appuntamento':'Nuovo appuntamento'}</h2><label>Paziente</label><select id="agendaPatient" ${patientLocked?'disabled':''}><option value="">Impegno personale</option>${activePatients.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(patientName(p.id))}</option>`).join('')}</select><label>Inizio</label><input id="agendaStart" type="datetime-local" value="${esc(start)}"><label>Fine</label><input id="agendaEnd" type="datetime-local" value="${esc(end)}"><label>Tipo</label><select id="agendaType"><option value="Prima visita" ${existing?.appointment_type==='Prima visita'?'selected':''}>Prima visita</option><option value="Controllo" ${existing?.appointment_type==='Controllo'?'selected':''}>Controllo</option><option value="Visita" ${existing?.appointment_type==='Visita'?'selected':''}>Visita</option><option value="Impegno personale" ${!selected?'selected':''}>Impegno personale</option></select><label>Stato</label><select id="agendaStatus"><option value="scheduled" ${!existing||existing.status==='scheduled'?'selected':''}>Programmato</option><option value="completed" ${existing?.status==='completed'?'selected':''}>Completato</option><option value="cancelled" ${existing?.status==='cancelled'?'selected':''}>Annullato</option></select><label>Note</label><textarea id="agendaNotes" rows="4">${esc(existing?.notes||'')}</textarea><div class="pro3-actions"><button class="secondary" id="cancelAppointment">Annulla</button><button class="primary" id="saveAppointment">Salva</button></div></section>`;
    document.body.appendChild(o);const close=()=>o.remove();o.querySelector('#closeAppointment')?.addEventListener('click',close);o.querySelector('#cancelAppointment')?.addEventListener('click',close);o.addEventListener('click',e=>{if(e.target===o)close();});
    o.querySelector('#saveAppointment')?.addEventListener('click',async()=>{const b=o.querySelector('#saveAppointment'),s=o.querySelector('#agendaStart')?.value,e=o.querySelector('#agendaEnd')?.value;if(!s||!e)return alert('Inserisci data e ora di inizio e fine.');const sd=new Date(s),ed=new Date(e);if(ed<=sd)return alert('L’orario di fine deve essere successivo all’inizio.');const selectedPatient=patientLocked?selected:(o.querySelector('#agendaPatient')?.value||'');const values={startsAt:sd.toISOString(),endsAt:ed.toISOString(),appointmentType:o.querySelector('#agendaType')?.value||'Visita',status:o.querySelector('#agendaStatus')?.value||'scheduled',notes:String(o.querySelector('#agendaNotes')?.value||'').trim()||null};if(!selectedPatient&&values.appointmentType!=='Impegno personale')values.appointmentType='Impegno personale';if(b){b.disabled=true;b.textContent='Salvataggio...';}try{if(existing){await services.updatePatientAppointment(existing.id,values);}else if(selectedPatient){await services.createPatientAppointment(selectedPatient,values);visitCache.delete(selectedPatient);}else{const professionalId=context().professional?.id,userId=context().user?.id;const {error}=await client.from('appointments').insert({professional_id:professionalId,starts_at:values.startsAt,ends_at:values.endsAt,appointment_type:values.appointmentType,status:values.status,notes:values.notes,created_by_user_id:userId});if(error)throw error;}close();if(onSaved)await onSaved();}catch(err){console.error('NUBEMO appointment save',err);alert('Non è stato possibile salvare l’appuntamento.');}finally{if(b){b.disabled=false;b.textContent='Salva';}}});
  }

  async function syncView(){if(isVisits()){const patientId=pid();if(!patientId)return;replaceVisits(patientId,'<p class="muted">Caricamento visite...</p>','loading');try{const rows=await loadVisits(patientId);if(isVisits()&&pid()===patientId)renderVisits(patientId,rows);}catch(e){console.error('NUBEMO visits load',e);replaceVisits(patientId,'<p class="muted">Non è stato possibile caricare le visite.</p>','error');}return;}if(isAgenda())await syncGeneralAgenda();}
  window.nubemoProfessionalAgenda=Object.freeze({syncView,reload:async(patientId=pid())=>{if(patientId){visitCache.delete(patientId);if(isVisits())renderVisits(patientId,await loadVisits(patientId,true));}await refreshAgendaIfVisible();},openEditor:openPatientVisitEditor});
})();
