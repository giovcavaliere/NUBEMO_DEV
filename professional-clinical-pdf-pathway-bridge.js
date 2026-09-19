// NUBEMO — Cartella PDF professionista: sorgente dati percorso ACTIVE.
// Compatibility adapter in memoria: non persiste dati e lascia invariato il generatore PDF legacy.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  if(!client)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  const DEMO_MEASURES_KEY='diario-pro-demo-measures-overrides-v1';
  const NOTES_KEY='diario-pro-notes-recovery-v1';
  const LABS_KEY='diario-pro-labs-v1';
  const DOCUMENT_META_KEY='nubemo-documents-meta-v1';
  const PATIENT_START_DATE_KEY='nubemo-patient-start-date-v1';

  const bypass=new WeakSet();
  let activeOverlay=null;
  let lifecycleObserver=null;
  let fallbackTimer=null;

  const parse=(value,fallback)=>{try{return JSON.parse(value)}catch(_){return fallback}};
  const originalGetItem=Storage.prototype.getItem;

  function rawLocal(key){
    try{return originalGetItem.call(localStorage,key)}catch(_){return null}
  }

  function currentPatientId(){
    const title=document.querySelector('.patient-global-title')?.textContent?.trim()||'';
    const rows=parse(rawLocal(EXTRA_PATIENTS_KEY)||'[]',[]);
    if(Array.isArray(rows)){
      const exact=rows.find(row=>row?.id&&String(row.name||'').trim()===title);
      if(exact)return String(exact.id);
      const partial=rows.find(row=>row?.id&&title.includes(String(row.name||'').trim()));
      if(partial)return String(partial.id);
    }
    return '';
  }

  function numberOrBlank(value){
    return value===null||value===undefined||value===''?'':Number(value);
  }

  function diaryRow(row){
    return {
      date:String(row?.entry_date||''),
      weight:numberOrBlank(row?.weight_kg),
      water:row?.water??'',
      coffee:row?.coffee??'',
      sweetener:row?.sweetener??'',
      breakfast:row?.breakfast||'',
      snack1:row?.morning_snack||'',
      lunch:row?.lunch||'',
      snack2:row?.afternoon_snack||'',
      dinner:row?.dinner||'',
      sport:row?.sport||'',
      notes:row?.notes||'',
      total_kcal:row?.total_kcal??null,
      calorie_quality:row?.calorie_quality||null,
      calorie_calculated_at:row?.calorie_calculated_at||null
    };
  }

  function measurementRow(row){
    return {
      _remoteId:row?.id||null,
      date:String(row?.measured_at||''),
      professionalWeight:numberOrBlank(row?.weight_kg),
      waist:numberOrBlank(row?.waist_cm),
      hips:numberOrBlank(row?.hips_cm),
      height:numberOrBlank(row?.height_cm),
      notes:row?.notes||''
    };
  }

  function normalizeTestKey(value){
    return String(value||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }

  function legacyLabField(value){
    const key=normalizeTestKey(value);
    if(!key)return '';
    if(key==='glucose'||key.includes('glicem'))return 'glucose';
    if(key==='cholesterol'||key.includes('colesterol'))return 'cholesterol';
    if(/(^| )hdl( |$)/.test(key))return 'hdl';
    if(/(^| )ldl( |$)/.test(key))return 'ldl';
    if(key.includes('triglicer')||key.includes('triglycer'))return 'triglycerides';
    if(/(^| )(got|ast)( |$)/.test(key))return 'got';
    if(/(^| )(gpt|alt)( |$)/.test(key))return 'gpt';
    if(key.includes('acido urico')||key.includes('uric acid')||key.includes('uricemia'))return 'uricAcid';
    if(key.includes('creatinin'))return 'creatinine';
    if(/(^| )(ggt|gamma gt|gamma glutamil)( |$)/.test(key))return 'ggt';
    return '';
  }

  function labValueText(value){
    if(value?.value_text!==null&&value?.value_text!==undefined&&String(value.value_text).trim())return String(value.value_text).trim();
    if(value?.value_numeric!==null&&value?.value_numeric!==undefined){
      const n=String(value.value_numeric).replace('.',',');
      return value?.unit?`${n} ${value.unit}`:n;
    }
    return '';
  }

  function labRow(report){
    const out={id:report?.id||`lab-${crypto.randomUUID()}`,date:String(report?.report_date||'')};
    (Array.isArray(report?.values)?report.values:[]).forEach(value=>{
      const field=legacyLabField(value?.test_code)||legacyLabField(value?.test_name);
      if(field&&!out[field])out[field]=labValueText(value);
    });
    return out;
  }

  function documentRow(row,patientId){
    return {
      id:row?.id||crypto.randomUUID(),
      patientId,
      category:row?.category||'document',
      subCategory:row?.sub_category||null,
      title:row?.title||row?.original_filename||'Documento',
      documentDate:row?.document_date||null,
      documentNumber:row?.document_number||null,
      validFrom:row?.valid_from||null,
      professionalNote:row?.professional_note||'',
      fileName:row?.original_filename||row?.title||'Documento',
      mimeType:row?.mime_type||null,
      fileSize:row?.size_bytes??null,
      storageBucket:row?.storage_bucket||null,
      storagePath:row?.storage_path||null,
      uploadedAt:row?.created_at||null,
      uploadedBy:'professional',
      unreadForProfessional:false,
      unreadForPatient:false
    };
  }

  function patientFrom(summary,snapshot){
    const row=summary?.patient||{};
    const clinical=snapshot?.clinical||{};
    const diary=(Array.isArray(snapshot?.diary)?snapshot.diary:[]).map(diaryRow).filter(x=>x.date);
    const measures=(Array.isArray(snapshot?.measurements)?snapshot.measurements:[]).map(measurementRow).filter(x=>x.date);
    const weights=diary.filter(x=>x.weight!==''&&Number.isFinite(Number(x.weight))).map(x=>[x.date,Number(x.weight)]);
    const pathway=snapshot?.pathway||{};
    return {
      id:String(row.id||''),
      profileId:row.profile_id||null,
      name:String(row.name||'Paziente'),
      firstName:String(row.first_name||''),
      surname:String(row.last_name||''),
      phone:String(row.phone||''),
      email:String(row.email||''),
      birth:row.birth_date||'',
      sex:row.sex||'',
      height:numberOrBlank(row.height_cm),
      startDate:pathway.pathway_start_date||row.pathway_start_date||String(pathway.started_at||row.started_at||'').slice(0,10),
      status:row.patient_status||'active',relationshipStatus:'active',
      goal:clinical.goal_weight_kg??row.goal_weight_kg??'',
      minWeight:clinical.min_weight_kg??row.min_weight_kg??'',
      maxWeight:clinical.max_weight_kg??row.max_weight_kg??'',
      reasonableWeight:clinical.reasonable_weight_kg??row.reasonable_weight_kg??'',
      theoreticalWeight:clinical.theoretical_weight_kg??row.theoretical_weight_kg??'',
      work:clinical.work??row.work??'',
      activity:clinical.activity??row.activity??'',
      activityFactor:clinical.activity_factor??row.activity_factor??'',
      smoking:clinical.smoking??row.smoking??'',
      alcohol:clinical.alcohol??row.alcohol??'',
      diagnosis:clinical.diagnosis??row.diagnosis??'',
      bowel:clinical.bowel??row.bowel??'',
      metabolism:clinical.metabolism??row.metabolism??'',
      feeg:clinical.feeg??row.feeg??'',
      impedance:clinical.impedance??row.impedance??'',
      famObesity:!!(clinical.family_obesity??row.family_obesity),
      famDiabetes:!!(clinical.family_diabetes??row.family_diabetes),
      famHypertension:!!(clinical.family_hypertension??row.family_hypertension),
      famCardiovascular:!!(clinical.family_cardiovascular??row.family_cardiovascular),
      famDyslipidemia:!!(clinical.family_dyslipidemia??row.family_dyslipidemia),
      famThyroid:!!(clinical.family_thyroid??row.family_thyroid),
      famGestational:false,
      previousDiets:clinical.previous_diets??row.previous_diets??'',
      allergies:clinical.allergies??row.allergies??'',
      medications:clinical.medications??row.medications??'',
      giIssues:clinical.gi_issues??row.gi_issues??'',
      pastConditions:clinical.past_conditions??row.past_conditions??'',
      observations:clinical.observations??row.observations??'',
      objectives:clinical.objectives??row.objectives??'',
      showEnergyValues:row.show_energy_values!==false,
      readOnly:row.read_only===true,
      diary,entries:diary,weights,measures,
      real:true,remote:true,_patientListShell:false,_summaryHydrated:true,_hydrated:true
    };
  }

  function noteText(snapshot){
    return (Array.isArray(snapshot?.notes)?snapshot.notes:[])
      .filter(row=>String(row?.content||'').trim())
      .map(row=>{
        const date=String(row?.created_at||'').slice(0,10);
        const content=String(row.content).trim();
        return date?`${date} — ${content}`:content;
      }).join('\n\n');
  }

  function buildOverrides(patientId,summary,snapshot){
    const patient=patientFrom(summary,snapshot);
    const overrides=new Map();

    const extra=parse(rawLocal(EXTRA_PATIENTS_KEY)||'[]',[]);
    const rows=Array.isArray(extra)?extra.slice():[];
    const index=rows.findIndex(row=>String(row?.id||'')===patientId);
    if(index>=0)rows[index]={...rows[index],...patient};else rows.push(patient);
    overrides.set(EXTRA_PATIENTS_KEY,JSON.stringify(rows));

    const measureMap=parse(rawLocal(DEMO_MEASURES_KEY)||'{}',{});
    overrides.set(DEMO_MEASURES_KEY,JSON.stringify({...measureMap,[patientId]:patient.measures}));

    const notesMap=parse(rawLocal(NOTES_KEY)||'{}',{});
    overrides.set(NOTES_KEY,JSON.stringify({...notesMap,[patientId]:noteText(snapshot)}));

    const labsMap=parse(rawLocal(LABS_KEY)||'{}',{});
    const labs=(Array.isArray(snapshot?.labs)?snapshot.labs:[]).map(labRow).filter(row=>row.date);
    overrides.set(LABS_KEY,JSON.stringify({...labsMap,[patientId]:labs}));

    const existingDocs=parse(rawLocal(DOCUMENT_META_KEY)||'[]',[]);
    const kept=Array.isArray(existingDocs)?existingDocs.filter(row=>String(row?.patientId||'')!==patientId):[];
    const remoteDocs=(Array.isArray(snapshot?.documents)?snapshot.documents:[]).map(row=>documentRow(row,patientId));
    overrides.set(DOCUMENT_META_KEY,JSON.stringify([...kept,...remoteDocs]));

    const starts=parse(rawLocal(PATIENT_START_DATE_KEY)||'{}',{});
    overrides.set(PATIENT_START_DATE_KEY,JSON.stringify({...starts,[patientId]:patient.startDate||''}));

    return overrides;
  }

  async function loadActiveSnapshot(patientId){
    const [summaryResult,pathwaysResult]=await Promise.all([
      client.rpc('get_professional_patient_summary',{p_patient_id:patientId}),
      client.rpc('get_professional_patient_pathways',{p_patient_id:patientId})
    ]);
    if(summaryResult.error)throw summaryResult.error;
    if(pathwaysResult.error)throw pathwaysResult.error;
    const pathways=Array.isArray(pathwaysResult.data)?pathwaysResult.data:[];
    const active=pathways.find(row=>String(row?.status||'').toLowerCase()==='active');
    if(!active?.id)throw new Error('Percorso attivo non disponibile.');
    const snapshotResult=await client.rpc('get_professional_pathway_snapshot',{p_pathway_id:active.id});
    if(snapshotResult.error)throw snapshotResult.error;
    if(!snapshotResult.data?.pathway)throw new Error('Dati del percorso attivo non disponibili.');
    return {summary:summaryResult.data,snapshot:snapshotResult.data};
  }

  function restoreOverlay(){
    if(fallbackTimer){clearTimeout(fallbackTimer);fallbackTimer=null;}
    lifecycleObserver?.disconnect();lifecycleObserver=null;
    if(activeOverlay&&Storage.prototype.getItem===activeOverlay.wrapper){
      Storage.prototype.getItem=activeOverlay.original;
    }
    activeOverlay=null;
  }

  function installOverlay(overrides){
    restoreOverlay();
    const original=Storage.prototype.getItem;
    const wrapper=function(key){
      if(this===localStorage&&overrides.has(String(key)))return overrides.get(String(key));
      return original.call(this,key);
    };
    Storage.prototype.getItem=wrapper;
    activeOverlay={original,wrapper};
    fallbackTimer=setTimeout(restoreOverlay,5*60*1000);
  }

  function watchPdfDialog(){
    lifecycleObserver?.disconnect();
    let dialogSeen=false;
    lifecycleObserver=new MutationObserver(()=>{
      const overlay=document.getElementById('clinicalPdfOverlay');
      if(overlay){
        dialogSeen=true;
        overlay.querySelector('#closeClinicalPdf')?.addEventListener('click',()=>setTimeout(restoreOverlay,0),{once:true});
        overlay.querySelector('#cancelClinicalPdf')?.addEventListener('click',()=>setTimeout(restoreOverlay,0),{once:true});
        return;
      }
      if(dialogSeen&&activeOverlay)restoreOverlay();
    });
    lifecycleObserver.observe(document.body,{childList:true,subtree:true});
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#desktopClinicalPdf,[data-drawer-clinical]');
    if(!button)return;
    if(bypass.has(button)){bypass.delete(button);return;}

    const patientId=currentPatientId();
    if(!patientId)return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const oldDisabled=button.disabled;
    const oldText=button.textContent;
    button.disabled=true;
    button.textContent='Preparazione…';

    void loadActiveSnapshot(patientId).then(({summary,snapshot})=>{
      installOverlay(buildOverrides(patientId,summary,snapshot));
      watchPdfDialog();
      bypass.add(button);
      button.disabled=oldDisabled;
      button.textContent=oldText;
      button.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    }).catch(error=>{
      restoreOverlay();
      button.disabled=oldDisabled;
      button.textContent=oldText;
      console.error('NUBEMO Cartella PDF pathway:',error);
      alert('Non riesco a caricare i dati del percorso attivo per la Cartella PDF. Riprova.');
    });
  },true);

  window.addEventListener('pagehide',restoreOverlay);
})();