// NUBEMO — Area Professionista / Cartella clinico-nutrizionale
// Adapter Supabase -> motore PDF approvato già presente nella baseline pro.js.
(() => {
  'use strict';
  const services = window.nubemoProfessionalServices;
  const patients = window.nubemoProfessionalPatients;
  if (!services || !patients) return;

  const esc=(v='')=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  async function collect(patientId){
    const row=patients.getPatientById?.(patientId);
    const [anamnesis,measures,labs,plans,docs,diary,visits,notes]=await Promise.all([
      services.loadPatientClinicalProfile(patientId),services.loadPatientMeasurements(patientId),services.loadLaboratoryReports(patientId),services.loadNutritionPlans(patientId),services.loadPatientDocuments(patientId),services.loadPatientDiary(patientId),services.loadPatientAppointments(patientId),services.loadProfessionalNotes(patientId)
    ]);
    return {row,anamnesis:anamnesis||{},measures:measures||[],labs:labs||[],plans:plans||[],docs:docs||[],diary:diary||[],visits:visits||[],notes:notes||[]};
  }

  function legacyPatient(data){
    const r=data.row||{},profile=r.profile||{},a=data.anamnesis||{};
    const entries=data.diary.map(d=>({
      date:d.entry_date,weight:d.weight_kg??'',water:d.water??'',coffee:d.coffee??0,sweetener:d.sweetener||'',breakfast:d.breakfast||'',snack1:d.morning_snack||'',lunch:d.lunch||'',snack2:d.afternoon_snack||'',dinner:d.dinner||'',notes:[d.sport,d.notes].filter(Boolean).join(' · ')
    }));
    const measures=data.measures.map(m=>({date:m.measured_at,professionalWeight:m.weight_kg??'',waist:m.waist_cm??'',hips:m.hips_cm??'',notes:m.notes||''}));
    const weights=entries.filter(e=>e.weight!==''&&e.weight!=null).map(e=>[e.date,Number(e.weight)]);
    const first=weights[0]?.[1]??null,last=weights.at(-1)?.[1]??null;
    return {
      id:r.id,
      real:true,
      name:[profile.first_name,profile.last_name].filter(Boolean).join(' ')||profile.email||'Paziente',
      surname:profile.last_name||'',
      email:profile.email||'',
      birth:r.birth_date||'',sex:r.sex||'',height:r.height_cm??'',startDate:r.pathway_start_date||r.relationship?.started_at?.slice?.(0,10)||'',
      goal:a.goal_weight_kg??'',minWeight:a.min_weight_kg??'',maxWeight:a.max_weight_kg??'',reasonableWeight:a.reasonable_weight_kg??'',theoreticalWeight:a.theoretical_weight_kg??'',
      work:a.work||'',activity:a.activity||'',activityFactor:a.activity_factor??'',smoking:a.smoking||'',alcohol:a.alcohol||'',diagnosis:a.diagnosis||'',bowel:a.bowel||'',metabolism:a.metabolism||'',feeg:a.feeg||'',impedance:a.impedance||'',
      familyObesity:a.family_obesity??false,familyDiabetes:a.family_diabetes??false,familyHypertension:a.family_hypertension??false,familyCardiovascular:a.family_cardiovascular??false,familyDyslipidemia:a.family_dyslipidemia??false,familyThyroid:a.family_thyroid??false,
      previousDiets:a.previous_diets||'',allergies:a.allergies||'',medications:a.medications||'',giIssues:a.gi_issues||'',pastConditions:a.past_conditions||'',observations:a.observations||'',objectives:a.objectives||'',
      entries,diary:entries,weights,measures,first,last,delta:first!=null&&last!=null?last-first:null,
      labs:data.labs,plans:data.plans,documents:data.docs,appointments:data.visits,professionalNotes:data.notes
    };
  }

  function openDialog(p){
    if(typeof window.exportClinicalPdf!=='function')return alert('Il motore della Cartella PDF approvata non è disponibile. Ricarica NUBEMO e riprova.');
    document.getElementById('clinicalPdfOverlay')?.remove();
    const o=document.createElement('div');o.id='clinicalPdfOverlay';o.className='clinical-overlay';
    o.innerHTML=`<section class="clinical-modal"><button class="monubi-x" id="closeClinicalPdf" type="button">×</button><div class="eyebrow">CARTELLA PAZIENTE</div><h2>Genera PDF di ${esc(p.name)}</h2><p class="muted">La cartella raccoglie i dati clinico-nutrizionali realmente presenti nella scheda.</p><label>Diario / storico peso da allegare</label><select id="clinicalDiaryMode"><option value="none">Non includere</option><option value="weight">Diario sintetico – solo peso rilevato</option><option value="7">Diario – ultimi 7 giorni</option><option value="30">Diario – ultimi 30 giorni</option><option value="full">Diario completo</option></select><div id="clinicalWeightIntervalWrap" style="display:none"><label>Intervallo rilevazioni peso (giorni)</label><input id="clinicalWeightInterval" type="number" min="1" max="365" value="30"></div><div class="clinical-actions"><button class="secondary" id="cancelClinicalPdf">Annulla</button><button class="primary" id="createClinicalPdf">Genera cartella PDF</button></div></section>`;
    document.body.appendChild(o);
    const mode=o.querySelector('#clinicalDiaryMode'),wrap=o.querySelector('#clinicalWeightIntervalWrap');
    const syncMode=()=>{wrap.style.display=mode.value==='weight'?'block':'none';};mode.addEventListener('change',syncMode);syncMode();
    const close=()=>o.remove();o.querySelector('#closeClinicalPdf')?.addEventListener('click',close);o.querySelector('#cancelClinicalPdf')?.addEventListener('click',close);o.addEventListener('click',e=>{if(e.target===o)close();});
    o.querySelector('#createClinicalPdf')?.addEventListener('click',async()=>{const b=o.querySelector('#createClinicalPdf'),interval=Math.max(1,Math.min(365,Number(o.querySelector('#clinicalWeightInterval')?.value)||30)),diaryMode=mode.value||'none';b.disabled=true;b.textContent='Generazione…';try{await window.exportClinicalPdf(p,{interval,diaryMode});close();}catch(e){console.error('NUBEMO approved clinical PDF',e);alert('Non riesco a generare la cartella PDF.');b.disabled=false;b.textContent='Genera cartella PDF';}});
  }

  async function generate(patientId=patients.getCurrentPatientId?.()){
    if(!patientId)return alert('Paziente non disponibile.');
    try{const data=await collect(patientId);openDialog(legacyPatient(data));}
    catch(e){console.error('NUBEMO clinical PDF data',e);alert('Non è stato possibile preparare i dati della Cartella PDF.');}
  }

  function bindButton(el){if(!el||el.dataset.nubemoPdf==='approved')return;const clone=el.cloneNode(true);clone.dataset.nubemoPdf='approved';clone.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();void generate();});el.replaceWith(clone);}
  function syncView(){if(document.body.dataset.proView!=='details')return;bindButton(document.getElementById('desktopClinicalPdf'));document.querySelectorAll('[data-drawer-clinical]').forEach(bindButton);}
  window.nubemoProfessionalPdf=Object.freeze({syncView,generate});
})();
