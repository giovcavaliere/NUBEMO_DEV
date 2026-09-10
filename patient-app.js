// NUBEMO — Area Paziente / runtime Supabase-first
(() => {
  'use strict';
  const services = window.nubemoPatientServices;
  const app = document.getElementById('app');
  const state = { page: 'home', context: null, diary: [], selfMeasures: [], proMeasures: [], documents: [], plans: [], planLinks: [], appointments: [], privacy: { documents: [], acceptances: [] }, editDiaryId: null, editSelfMeasureId: null };

  const esc = (v='') => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const isoToday = () => { const d = new Date(), z = d.getTimezoneOffset() * 60000; return new Date(d-z).toISOString().slice(0,10); };
  const fmtDate = v => v ? new Date(String(v).slice(0,10)+'T12:00:00').toLocaleDateString('it-IT') : '—';
  const kg = v => v === null || v === undefined || v === '' ? '—' : `${Number(v).toFixed(1).replace('.',',')} kg`;
  const cm = v => v === null || v === undefined || v === '' ? '—' : `${Number(v).toFixed(1).replace('.',',')} cm`;
  const nullableNumber = v => { const s = String(v ?? '').trim().replace(',','.'); return s === '' ? null : Number(s); };
  const textOrNull = v => { const s = String(v ?? '').trim(); return s || null; };
  const active = () => !!state.context?.activePathway;

  function latestDiaryWeight() { return [...state.diary].filter(x => x.weight_kg != null).sort((a,b)=>a.entry_date.localeCompare(b.entry_date)).at(-1) || null; }
  function nextAppointment() { const now = new Date(); return state.appointments.filter(a => new Date(a.starts_at) >= now && a.status !== 'cancelled').sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at))[0] || null; }
  function currentPlan() { const today = isoToday(); return state.plans.filter(p => p.status === 'active' && (!p.valid_from || p.valid_from <= today) && (!p.valid_to || p.valid_to >= today)).sort((a,b)=>String(b.valid_from||'').localeCompare(String(a.valid_from||'')))[0] || null; }

  async function reloadAll() {
    const c = state.context;
    const [diary,selfMeasures,proMeasures,documents,plans,appointments,privacy] = await Promise.all([
      services.loadDiary(c.patient.id), services.loadSelfMeasurements(c.patient.id), services.loadProfessionalMeasurements(c.patient.id), services.loadDocuments(c.patient.id), services.loadPlans(c.patient.id), services.loadAppointments(c.patient.id), services.loadPrivacy(c.profile.id)
    ]);
    const planLinks = await services.loadPlanDocuments(plans.map(p=>p.id));
    Object.assign(state, { diary,selfMeasures,proMeasures,documents,plans,appointments,privacy,planLinks });
  }

  function loading(label='Caricamento…') { app.innerHTML = `<section class="card"><p class="muted">${esc(label)}</p></section>`; }
  function errorMessage(error) { console.error(error); alert(error?.message || 'Operazione non completata.'); }

  function homeHtml() {
    const c = state.context, last = latestDiaryWeight(), visit = nextAppointment(), plan = currentPlan();
    const greeting = c.profile.first_name ? `Ciao ${esc(c.profile.first_name)}` : 'Il tuo percorso';
    return `<div class="hero-title"><div><div class="eyebrow">IL TUO PERCORSO, OGNI GIORNO</div><h1>${greeting}</h1></div></div>
      ${active()?'':'<section class="card notice"><b>Percorso concluso</b><p class="muted">NUBEMO è in sola consultazione. Il tuo storico resta disponibile.</p></section>'}
      <section class="card summary"><div class="section-head"><h2>Oggi</h2><span class="pill">Supabase</span></div><div class="stats">
        <div><span>Ultimo peso registrato</span><b>${last?kg(last.weight_kg):'—'}</b></div>
        <div><span>Prossima visita</span><b>${visit?new Date(visit.starts_at).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'}):'—'}</b></div>
        <div><span>Piano alimentare</span><b>${plan?esc(plan.title):'—'}</b></div>
      </div></section>
      <section class="card"><div class="section-head"><h2>Ultime giornate</h2>${active()?'<button class="primary compact" data-go="add">＋ Aggiungi</button>':''}</div>
        ${state.diary.length ? [...state.diary].reverse().slice(0,5).map(d=>`<div class="listitem" data-edit-diary="${d.id}"><span><b>${fmtDate(d.entry_date)}</b><small>${esc(d.breakfast||d.lunch||d.dinner||'Giornata registrata')}</small></span><b>${kg(d.weight_kg)}</b></div>`).join('') : '<p class="muted">Nessuna giornata registrata.</p>'}
      </section>`;
  }

  function diaryFormHtml() {
    if (!active()) return `<section class="card"><h2>Diario</h2><p class="muted">Il percorso è concluso: puoi consultare lo storico, ma non aggiungere o modificare giornate.</p></section>`;
    const existing = state.editDiaryId ? state.diary.find(x=>x.id===state.editDiaryId) : null;
    const d = existing || { entry_date: isoToday(), coffee:0 };
    return `<div class="page-title"><button class="back" data-go="home">‹</button><div><div class="eyebrow">${existing?'REGISTRAZIONE':'NUOVA REGISTRAZIONE'}</div><h1>${existing?'Modifica giornata':'Aggiungi giornata'}</h1></div>${existing?'<button class="mini danger-text" id="deleteDiary">Elimina</button>':''}</div>
    <section class="card form-card">
      <label>Data</label><input id="diaryDate" type="date" value="${esc(d.entry_date)}">
      <label>Peso (kg)</label><input id="diaryWeight" inputmode="decimal" value="${d.weight_kg??''}" placeholder="es. 115,6">
      <label>Acqua bevuta (litri)</label><input id="diaryWater" inputmode="decimal" value="${d.water??''}" placeholder="es. 1,5">
      <label>Caffè</label><input id="diaryCoffee" type="number" min="0" step="1" value="${d.coffee??0}">
      <label>Zucchero / dolcificante</label><input id="diarySweetener" value="${esc(d.sweetener||'')}">
      <label>🥐 Colazione</label><textarea id="diaryBreakfast">${esc(d.breakfast||'')}</textarea>
      <label>🍎 Spuntino mattina</label><textarea id="diaryMorningSnack">${esc(d.morning_snack||'')}</textarea>
      <label>🍝 Pranzo</label><textarea id="diaryLunch">${esc(d.lunch||'')}</textarea>
      <label>🍎 Spuntino pomeriggio</label><textarea id="diaryAfternoonSnack">${esc(d.afternoon_snack||'')}</textarea>
      <label>🍽️ Cena</label><textarea id="diaryDinner">${esc(d.dinner||'')}</textarea>
      <label>🏃 Sport</label><textarea id="diarySport">${esc(d.sport||'')}</textarea>
      <label>Note</label><textarea id="diaryNotes">${esc(d.notes||'')}</textarea>
      <div class="form-actions"><button class="primary" id="saveDiary">${existing?'Aggiorna giornata':'Salva giornata'}</button>${existing?'<button class="secondary" id="duplicateDiary">⧉ Duplica giornata</button>':''}</div>
    </section>`;
  }

  function trendHtml() {
    const weighted = state.diary.filter(x=>x.weight_kg!=null).sort((a,b)=>a.entry_date.localeCompare(b.entry_date));
    const first=weighted[0], last=weighted.at(-1), delta=first&&last?Number(last.weight_kg)-Number(first.weight_kg):null;
    const rows=[...state.diary].reverse();
    return `<div class="hero-title"><div><div class="eyebrow">STATISTICHE</div><h1>Andamento</h1></div><button class="pdf-btn" id="exportDiaryPdf">PDF</button></div>
      <section class="card summary"><div class="section-head"><h2>Riepilogo peso</h2><span class="pill">Diario paziente</span></div>${first?`<div class="stats"><div><span>Peso iniziale</span><b>${kg(first.weight_kg)}</b></div><div><span>Ultimo peso</span><b>${kg(last.weight_kg)}</b></div><div><span>Variazione</span><b>${delta>0?'+':''}${delta.toFixed(1).replace('.',',')} kg</b></div></div>`:'<p class="muted">Nessun peso registrato.</p>'}</section>
      <section class="card"><div class="section-head"><h2>Storico</h2><span class="pill">${rows.length}</span></div>${rows.map(d=>`<div class="listitem" data-edit-diary="${d.id}"><span><b>${fmtDate(d.entry_date)}</b><small>${esc([d.breakfast,d.lunch,d.dinner].filter(Boolean).join(' · ')||'Giornata registrata')}</small></span><div class="history-right"><b>${kg(d.weight_kg)}</b>${d.water!=null?`<small>💧 ${Number(d.water).toFixed(1).replace('.',',')} L</small>`:''}</div></div>`).join('')||'<p class="muted">Nessuna giornata registrata.</p>'}</section>`;
  }

  function measurementsHtml() {
    const diaryByDate = new Map(state.diary.filter(x=>x.weight_kg!=null).map(x=>[x.entry_date,x]));
    const selfRows = state.selfMeasures.map(m=>({...m, patientWeight:diaryByDate.get(m.measured_at)?.weight_kg ?? null})).sort((a,b)=>b.measured_at.localeCompare(a.measured_at));
    const proRows = [...state.proMeasures].sort((a,b)=>b.measured_at.localeCompare(a.measured_at));
    return `<div class="hero-title"><div><div class="eyebrow">EVOLUZIONE CORPOREA</div><h1>Misure</h1></div></div>
      ${active()?`<section class="card"><div class="section-head"><h2>Automisurazione</h2><span class="pill">Inserita da te</span></div>
      <p class="muted">Il peso viene dal Diario. Qui puoi registrare vita e fianchi misurati autonomamente.</p>
      <label>Data</label><input id="selfMeasureDate" type="date" value="${isoToday()}"><div class="measure-grid"><div><label>Vita (cm)</label><input id="selfMeasureWaist" inputmode="decimal"></div><div><label>Fianchi (cm)</label><input id="selfMeasureHips" inputmode="decimal"></div></div><label>Note</label><textarea id="selfMeasureNotes"></textarea><button class="primary" id="saveSelfMeasure">Salva automisurazione</button></section>`:''}
      <section class="card"><div class="section-head"><h2>Le tue automisurazioni</h2><span class="pill">Paziente</span></div>${selfRows.length?`<div class="measure-table-wrap"><table class="measure-table"><thead><tr><th>Data</th><th>Peso diario</th><th>Vita</th><th>Fianchi</th><th>Note</th></tr></thead><tbody>${selfRows.map(m=>`<tr data-edit-self-measure="${m.id}"><td>${fmtDate(m.measured_at)}</td><td>${kg(m.patientWeight)}</td><td>${cm(m.waist_cm)}</td><td>${cm(m.hips_cm)}</td><td>${esc(m.notes||'')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Nessuna automisurazione.</p>'}</section>
      <section class="card"><div class="section-head"><h2>Misure rilevate dal professionista</h2><span class="pill">Professionista</span></div>${proRows.length?`<div class="measure-table-wrap"><table class="measure-table"><thead><tr><th>Data</th><th>Peso</th><th>Vita</th><th>Fianchi</th><th>Note</th></tr></thead><tbody>${proRows.map(m=>`<tr><td>${fmtDate(m.measured_at)}</td><td>${kg(m.weight_kg)}</td><td>${cm(m.waist_cm)}</td><td>${cm(m.hips_cm)}</td><td>${esc(m.notes||'')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Nessuna misura rilevata dal professionista.</p>'}</section>`;
  }

  function documentsHtml() {
    const planDocIds = new Set(state.planLinks.map(x=>x.document_id));
    const planDocs = state.documents.filter(d=>planDocIds.has(d.id));
    const accounting = state.documents.filter(d=>['accounting','invoice'].includes(d.category));
    const blood = state.documents.filter(d=>d.sub_category==='blood_test');
    const health = state.documents.filter(d=>d.category==='health' && d.sub_category!=='blood_test');
    const row = d => `<div class="document-row"><div><b>${esc(d.title)}</b><span>${fmtDate(d.document_date)} · ${esc(d.original_filename)}</span></div><button class="secondary compact" data-open-doc="${d.id}">Apri</button></div>`;
    return `<div class="page-title"><button class="back" data-go="home">‹</button><div><div class="eyebrow">ARCHIVIO PAZIENTE</div><h1>Documenti</h1></div></div>
      <section class="card"><div class="section-head"><h2>Piani alimentari</h2><span class="pill">${state.plans.length}</span></div>${state.plans.map(p=>{const link=state.planLinks.find(x=>x.nutrition_plan_id===p.id),doc=link&&state.documents.find(d=>d.id===link.document_id);return `<div class="document-row"><div><b>${esc(p.title)}${p.status==='active'?'<span class="plan-status-badge">IN VIGORE</span>':''}</b><span>${p.valid_from?'Valido dal '+fmtDate(p.valid_from):'Decorrenza non indicata'}</span></div>${doc?`<button class="secondary compact" data-open-doc="${doc.id}">Apri</button>`:''}</div>`}).join('')||'<p class="muted">Nessun piano pubblicato.</p>'}</section>
      <section class="card"><div class="section-head"><h2>Documenti contabili</h2><span class="pill">${accounting.length}</span></div>${accounting.map(row).join('')||'<p class="muted">Nessun documento contabile.</p>'}</section>
      <section class="card"><div class="section-head"><h2>Analisi del sangue</h2><span class="pill">${blood.length}</span></div>${active()?'<button class="primary" data-upload-kind="blood_test">＋ Carica analisi</button>':''}${blood.map(row).join('')||'<p class="muted">Nessun referto analisi.</p>'}</section>
      <section class="card"><div class="section-head"><h2>Altri documenti sanitari</h2><span class="pill">${health.length}</span></div>${active()?'<button class="secondary" data-upload-kind="health_other">＋ Carica documento</button>':''}${health.map(row).join('')||'<p class="muted">Nessun altro documento sanitario.</p>'}</section>
      <input id="patientUploadFile" type="file" accept=".pdf,application/pdf,image/*" hidden>`;
  }

  function profileHtml() {
    const c=state.context, p=c.patient, cl=c.clinical||{}, visit=nextAppointment();
    const acceptedIds=new Set(state.privacy.acceptances.map(a=>a.privacy_document_id));
    const sex=p.sex==='M'?'Maschile':p.sex==='F'?'Femminile':p.sex||'—';
    return `<div class="page-title"><button class="back" data-go="home">‹</button><div><div class="eyebrow">DATI PERSONALI</div><h1>Profilo</h1></div></div>
      <section class="card"><div class="section-head"><h2>Profilo gestito dal professionista</h2></div><p class="muted">I dati anagrafici e clinici sono gestiti dal professionista. Se qualcosa non è corretto, segnalalo durante la visita.</p></section>
      <section class="card"><h2>Dati personali</h2><div class="profile-read-grid"><div><span>Nome</span><b>${esc(c.profile.first_name)}</b></div><div><span>Cognome</span><b>${esc(c.profile.last_name)}</b></div><div><span>Data di nascita</span><b>${fmtDate(p.birth_date)}</b></div><div><span>Sesso</span><b>${esc(sex)}</b></div><div><span>Altezza</span><b>${p.height_cm?cm(p.height_cm):'—'}</b></div><div><span>Peso obiettivo</span><b>${kg(cl.goal_weight_kg)}</b></div><div><span>Prossima visita</span><b>${visit?new Date(visit.starts_at).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'}):'—'}</b></div></div></section>
      <section class="card"><h2>Storia del peso</h2><div class="profile-read-grid"><div><span>Peso minimo storico</span><b>${kg(cl.min_weight_kg)}</b></div><div><span>Peso massimo storico</span><b>${kg(cl.max_weight_kg)}</b></div><div><span>Peso ragionevole / concordato</span><b>${kg(cl.reasonable_weight_kg)}</b></div></div></section>
      <details class="patient-section"><summary>Anamnesi e obiettivi</summary><div class="profile-read-grid section-body"><div><span>Diagnosi / motivo</span><b>${esc(cl.diagnosis||'—')}</b></div><div><span>Attività lavorativa</span><b>${esc(cl.work||'—')}</b></div><div><span>Attività fisica</span><b>${esc(cl.activity||'—')}</b></div><div><span>Fumo</span><b>${esc(cl.smoking||'—')}</b></div><div><span>Alcol</span><b>${esc(cl.alcohol||'—')}</b></div><div><span>Allergie / intolleranze</span><b>${esc(cl.allergies||'—')}</b></div><div><span>Farmaci</span><b>${esc(cl.medications||'—')}</b></div><div><span>Osservazioni</span><b>${esc(cl.observations||'—')}</b></div><div><span>Obiettivi</span><b>${esc(cl.objectives||'—')}</b></div></div></details>
      <section class="card"><div class="section-head"><h2>Privacy</h2><span class="pill">${state.privacy.documents.length}</span></div>${state.privacy.documents.map(d=>`<div class="document-row"><div><b>${esc(d.title)}</b><span>Versione ${esc(d.version)} · ${acceptedIds.has(d.id)?'Accettata':'Da accettare'}</span></div>${acceptedIds.has(d.id)?'<span class="pill">OK</span>':`<button class="primary compact" data-accept-privacy="${d.id}">Accetta</button>`}</div>`).join('')||'<p class="muted">Nessuna informativa attiva.</p>'}</section>
      <section class="card support-entry-card"><div><div class="eyebrow">SUPPORTO TECNICO</div><h2>Assistenza NUBEMO</h2><p class="muted">Per problemi tecnici puoi preparare una mail all’assistenza.</p></div><button class="secondary" id="patientSupport">Segnala un problema</button></section>`;
  }

  function render() {
    document.body.dataset.page=state.page;
    document.querySelectorAll('nav [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===state.page));
    app.innerHTML = state.page==='home'?homeHtml():state.page==='add'?diaryFormHtml():state.page==='trend'?trendHtml():state.page==='measures'?measurementsHtml():state.page==='documents'?documentsHtml():profileHtml();
  }

  async function refreshAndRender() { loading(); await reloadAll(); render(); }

  async function saveDiary() {
    try {
      const values={ entry_date:document.getElementById('diaryDate').value, weight_kg:nullableNumber(document.getElementById('diaryWeight').value), water:nullableNumber(document.getElementById('diaryWater').value), coffee:Number(document.getElementById('diaryCoffee').value||0), sweetener:textOrNull(document.getElementById('diarySweetener').value), breakfast:textOrNull(document.getElementById('diaryBreakfast').value), morning_snack:textOrNull(document.getElementById('diaryMorningSnack').value), lunch:textOrNull(document.getElementById('diaryLunch').value), afternoon_snack:textOrNull(document.getElementById('diaryAfternoonSnack').value), dinner:textOrNull(document.getElementById('diaryDinner').value), sport:textOrNull(document.getElementById('diarySport').value), notes:textOrNull(document.getElementById('diaryNotes').value) };
      if(!values.entry_date) return alert('Seleziona una data.'); if(values.water!=null&&(values.water<0||values.water>20))return alert('Controlla la quantità di acqua.');
      await services.saveDiaryEntry(state.context.patient.id,state.context.user.id,values,state.editDiaryId); state.editDiaryId=null; state.page='home'; await refreshAndRender();
    } catch(e) { if(e.message?.includes('duplicate')||e.message?.includes('unique')) alert('Questa data è già registrata.'); else errorMessage(e); }
  }

  async function saveSelfMeasure() {
    try {
      const values={ measured_at:document.getElementById('selfMeasureDate').value, waist_cm:nullableNumber(document.getElementById('selfMeasureWaist').value), hips_cm:nullableNumber(document.getElementById('selfMeasureHips').value), notes:textOrNull(document.getElementById('selfMeasureNotes').value) };
      if(!values.measured_at)return alert('Inserisci la data.'); if(values.waist_cm!=null&&(values.waist_cm<20||values.waist_cm>300))return alert('Controlla la circonferenza vita.'); if(values.hips_cm!=null&&(values.hips_cm<20||values.hips_cm>300))return alert('Controlla la circonferenza fianchi.');
      await services.saveSelfMeasurement(state.context.patient.id,state.context.user.id,values,state.editSelfMeasureId); state.editSelfMeasureId=null; await refreshAndRender();
    } catch(e){ if(e.message?.includes('duplicate')||e.message?.includes('unique'))alert('Esiste già una automisurazione per questa data.'); else errorMessage(e); }
  }

  async function uploadDocument(kind,file) {
    const title=prompt('Titolo documento',file.name.replace(/\.[^.]+$/,'')); if(!title)return;
    const date=prompt('Data documento (AAAA-MM-GG)',isoToday()); if(date===null)return;
    try { loading('Caricamento documento…'); await services.uploadPatientDocument(state.context.patient.id,state.context.user.id,file,{category:'health',sub_category:kind,title:title.trim(),document_date:date||null}); await refreshAndRender(); } catch(e){ errorMessage(e); render(); }
  }

  function exportDiaryPdf() {
    if(!state.diary.length)return alert('Nessuna giornata da esportare.');
    const rows=state.diary.map(d=>[fmtDate(d.entry_date),d.weight_kg==null?'':Number(d.weight_kg).toFixed(1).replace('.',','),d.water==null?'':Number(d.water).toFixed(1).replace('.',','),d.coffee??'',d.sweetener||'',d.breakfast||'',d.morning_snack||'',d.lunch||'',d.afternoon_snack||'',d.dinner||'', [d.sport,d.notes].filter(Boolean).join(' · ')]);
    const blob=window.NubemoDiaryPdf.create({rows,origin:'patient'}),url=URL.createObjectURL(blob); window.location.href=url; setTimeout(()=>URL.revokeObjectURL(url),120000);
  }

  app.addEventListener('click',async e=>{
    const go=e.target.closest('[data-go]'); if(go){state.page=go.dataset.go; if(state.page!=='add')state.editDiaryId=null; render(); return;}
    const edit=e.target.closest('[data-edit-diary]'); if(edit&&active()){state.editDiaryId=edit.dataset.editDiary;state.page='add';render();return;}
    if(e.target.id==='saveDiary')return saveDiary();
    if(e.target.id==='deleteDiary'){if(confirm('Eliminare questa giornata?')){try{await services.deleteDiaryEntry(state.editDiaryId);state.editDiaryId=null;state.page='home';await refreshAndRender();}catch(err){errorMessage(err);}}return;}
    if(e.target.id==='duplicateDiary'){const src=state.diary.find(x=>x.id===state.editDiaryId);state.editDiaryId=null;render();setTimeout(()=>{const ids=['diaryWeight','diaryWater','diaryCoffee','diarySweetener','diaryBreakfast','diaryMorningSnack','diaryLunch','diaryAfternoonSnack','diaryDinner','diarySport','diaryNotes'];const vals=[null,src.water,src.coffee,src.sweetener,src.breakfast,src.morning_snack,src.lunch,src.afternoon_snack,src.dinner,src.sport,src.notes];document.getElementById('diaryDate').value=isoToday();ids.forEach((id,i)=>{const el=document.getElementById(id);if(el)el.value=vals[i]??'';});},0);return;}
    if(e.target.id==='saveSelfMeasure')return saveSelfMeasure();
    const open=e.target.closest('[data-open-doc]'); if(open){const doc=state.documents.find(d=>d.id===open.dataset.openDoc);if(doc){try{const url=await services.openDocument(doc);if(url)window.location.href=url;}catch(err){errorMessage(err);}}return;}
    const upload=e.target.closest('[data-upload-kind]'); if(upload){const input=document.getElementById('patientUploadFile');input.dataset.kind=upload.dataset.uploadKind;input.click();return;}
    const accept=e.target.closest('[data-accept-privacy]'); if(accept){try{await services.acceptPrivacy(state.context.profile.id,accept.dataset.acceptPrivacy);await refreshAndRender();}catch(err){errorMessage(err);}return;}
    if(e.target.id==='exportDiaryPdf')return exportDiaryPdf();
    if(e.target.id==='patientSupport'){const subject='NUBEMO - Segnalazione problema Area Paziente';window.location.href=`mailto:giov.cavaliere@gmail.com?subject=${encodeURIComponent(subject)}`;}
  });

  app.addEventListener('change',e=>{if(e.target.id==='patientUploadFile'&&e.target.files?.[0]){uploadDocument(e.target.dataset.kind||'health_other',e.target.files[0]);}});
  document.querySelector('nav')?.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b)return;state.page=b.dataset.page;state.editDiaryId=null;render();scrollTo(0,0);});

  window.nubemoPatientApp={
    async init(context){state.context=context;loading();await reloadAll();render();},
    state
  };
})();
