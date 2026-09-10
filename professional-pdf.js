// NUBEMO — Area Professionista / Cartella clinico-nutrizionale
(() => {
  'use strict';
  const services = window.nubemoProfessionalServices;
  const patients = window.nubemoProfessionalPatients;
  if (!services || !patients) return;

  const esc = (v='') => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const fmtDate = v => { if(!v)return '—'; const p=String(v).slice(0,10).split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:esc(v); };
  const val = v => v===null||v===undefined||String(v).trim()===''?'—':esc(v);
  const num = (v,s='') => v===null||v===undefined||v===''?'—':`${Number(v).toFixed(1).replace('.',',')}${s}`;

  async function collect(patientId) {
    const row = patients.getPatientById?.(patientId);
    const [anamnesis, measures, labs, plans, docs, diary, visits, notes] = await Promise.all([
      services.loadPatientClinicalProfile(patientId), services.loadPatientMeasurements(patientId),
      services.loadLaboratoryReports(patientId), services.loadNutritionPlans(patientId),
      services.loadPatientDocuments(patientId), services.loadPatientDiary(patientId),
      services.loadPatientAppointments(patientId), services.loadProfessionalNotes(patientId)
    ]);
    return { row, anamnesis, measures, labs, plans, docs, diary, visits, notes };
  }

  function table(headers, rows) {
    return `<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">—</td></tr>`}</tbody></table>`;
  }

  function html(data) {
    const r=data.row||{}, p=r.profile||{}, a=data.anamnesis||{};
    const measures=(data.measures||[]).map(m=>[fmtDate(m.measured_at),num(m.weight_kg,' kg'),num(m.waist_cm,' cm'),num(m.hips_cm,' cm'),val(m.notes)]);
    const diary=(data.diary||[]).map(d=>[fmtDate(d.entry_date),num(d.weight_kg,' kg'),val(d.breakfast),val(d.lunch),val(d.dinner),val(d.sport),val(d.notes)]);
    const plans=(data.plans||[]).map(x=>[val(x.title),val(x.status),fmtDate(x.valid_from),fmtDate(x.valid_to),val(x.professional_note)]);
    const visits=(data.visits||[]).map(x=>[new Date(x.starts_at).toLocaleString('it-IT'),val(x.appointment_type),val(x.status),val(x.notes)]);
    const labs=(data.labs||[]).map(x=>[fmtDate(x.report_date),val(x.title),x.status==='confirmed'?'Confermato':'Da revisionare',String(x.values?.length||0)]);
    const notes=(data.notes||[]).map(x=>[new Date(x.created_at).toLocaleString('it-IT'),val(x.content)]);
    return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Cartella ${esc(p.first_name||'')} ${esc(p.last_name||'')}</title><style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#183832;font-size:11px;line-height:1.35}h1{font-size:22px;margin:0}h2{font-size:14px;margin:18px 0 7px;padding-bottom:4px;border-bottom:1px solid #b9cbc6}.brand{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #064b43;padding-bottom:10px;margin-bottom:14px}.muted{color:#60746f}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.box{border:1px solid #d9e3df;border-radius:6px;padding:7px}.box span{display:block;color:#60746f;font-size:9px}.box b{font-size:11px}table{width:100%;border-collapse:collapse;margin:5px 0 12px}th,td{border:1px solid #d9e3df;padding:5px;text-align:left;vertical-align:top}th{background:#f2f6f4}section{break-inside:avoid}.patient-diary-note{font-style:italic;color:#60746f;margin:3px 0 7px}@media print{button{display:none}}</style></head><body>
      <div class="brand"><div><h1>NUBEMO</h1><div class="muted">Cartella clinico-nutrizionale</div></div><div class="muted">Generato dal professionista · ${new Date().toLocaleString('it-IT')}</div></div>
      <section><h2>Paziente</h2><div class="grid"><div class="box"><span>Nome</span><b>${val([p.first_name,p.last_name].filter(Boolean).join(' '))}</b></div><div class="box"><span>Data di nascita</span><b>${fmtDate(r.birth_date)}</b></div><div class="box"><span>Altezza</span><b>${r.height_cm?`${val(r.height_cm)} cm`:'—'}</b></div><div class="box"><span>Inizio percorso</span><b>${fmtDate(r.pathway_start_date||r.relationship?.started_at)}</b></div><div class="box"><span>Diagnosi / motivo</span><b>${val(a.diagnosis)}</b></div><div class="box"><span>Obiettivi</span><b>${val(a.objectives)}</b></div></div></section>
      <section><h2>Anamnesi</h2><div class="grid"><div class="box"><span>Peso teorico</span><b>${num(a.theoretical_weight_kg,' kg')}</b></div><div class="box"><span>Attività</span><b>${val(a.activity)}</b></div><div class="box"><span>Alvo</span><b>${val(a.bowel)}</b></div><div class="box"><span>Allergie</span><b>${val(a.allergies)}</b></div><div class="box"><span>Farmaci</span><b>${val(a.medications)}</b></div><div class="box"><span>Patologie pregresse</span><b>${val(a.past_conditions)}</b></div></div></section>
      <section><h2>Antropometria e misure</h2>${table(['Data','Peso rilevato','Vita','Fianchi','Note'],measures)}</section>
      <section><h2>Piani alimentari</h2>${table(['Titolo','Stato','Dal','Al','Nota'],plans)}</section>
      <section><h2>Esami</h2>${table(['Data','Titolo','Stato','Valori'],labs)}</section>
      <section><h2>Visite</h2>${table(['Data/ora','Tipo','Stato','Note'],visits)}</section>
      <section><h2>Diario</h2><p class="patient-diary-note">Dati registrati direttamente dal paziente e riportati in sola lettura.</p>${table(['Data','Peso paziente','Colazione','Pranzo','Cena','Sport','Note'],diary)}</section>
      <section><h2>Note professionista</h2>${table(['Data','Nota'],notes)}</section>
      </body></html>`;
  }

  async function generate(patientId=patients.getCurrentPatientId?.()) {
    if(!patientId)return alert('Paziente non disponibile.');
    try {
      const data=await collect(patientId);
      const w=window.open('','_blank');
      if(!w)return alert('Il browser ha bloccato la finestra di stampa. Consenti i popup e riprova.');
      w.document.open(); w.document.write(html(data)); w.document.close();
      w.addEventListener('load',()=>setTimeout(()=>w.print(),150),{once:true});
    } catch(e) { console.error('NUBEMO clinical PDF',e); alert('Non è stato possibile preparare la Cartella PDF.'); }
  }

  function bindButton(el){if(!el||el.dataset.nubemoPdf==='1')return;el.dataset.nubemoPdf='1';const clone=el.cloneNode(true);clone.dataset.nubemoPdf='1';clone.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();void generate();});el.replaceWith(clone);}
  function syncView(){if(document.body.dataset.proView!=='details')return;bindButton(document.getElementById('desktopClinicalPdf'));document.querySelectorAll('[data-drawer-clinical]').forEach(bindButton);}

  window.nubemoProfessionalPdf=Object.freeze({syncView,generate});
})();
