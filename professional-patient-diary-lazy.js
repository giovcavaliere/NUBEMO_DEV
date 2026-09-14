// NUBEMO 4.0 — Diario professionista puntuale.
// Carica solo il periodo richiesto (default 30 giorni) e pubblica i dati nel contratto legacy di pro.js.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  if(!client)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  const cache=new Map();
  const exportReplay=new WeakSet();
  const activeRangeByPatient=new Map();
  let requestedRange=null;
  let rangePatchQueued=false;

  const parse=(value,fallback)=>{try{return JSON.parse(value)}catch(_){return fallback}};

  function legacyDiary(row){
    return {
      date:row.entry_date,
      weight:row.weight_kg??'',
      water:row.water??'',
      coffee:Number(row.coffee||0),
      sweetener:row.sweetener||'',
      breakfast:row.breakfast||'',
      snack1:row.morning_snack||'',
      lunch:row.lunch||'',
      snack2:row.afternoon_snack||'',
      dinner:row.dinner||'',
      notes:[row.sport,row.notes].filter(Boolean).join(row.sport&&row.notes?'\n':''),
      breakfastKcal:row.breakfast_kcal??null,
      morningSnackKcal:row.morning_snack_kcal??null,
      lunchKcal:row.lunch_kcal??null,
      afternoonSnackKcal:row.afternoon_snack_kcal??null,
      dinnerKcal:row.dinner_kcal??null,
      totalKcal:row.total_kcal??null,
      calorieQuality:row.calorie_quality||'none',
      calorieCalculatedAt:row.calorie_calculated_at||null
    };
  }

  function normalizeRange(days){
    const numeric=Number(days);
    return (days==='all'||(Number.isFinite(numeric)&&numeric<=0))
      ? 0
      : Math.max(1,Math.min(numeric||30,3650));
  }

  function publish(patientId,rows,range){
    const patients=parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]',[]);
    if(!Array.isArray(patients))throw new Error('Elenco pazienti non disponibile.');
    const index=patients.findIndex(row=>String(row?.id||'')===String(patientId));
    if(index<0)throw new Error('Paziente non disponibile nel contesto corrente.');
    const entries=(rows||[]).map(legacyDiary).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const periodWeights=entries.filter(x=>x.weight!==''&&x.weight!=null&&Number.isFinite(Number(x.weight))).map(x=>[x.date,Number(x.weight)]);
    const existingWeights=Array.isArray(patients[index].weights)?patients[index].weights:[];
    const weightMap=new Map(existingWeights.filter(x=>Array.isArray(x)&&x[0]).map(x=>[String(x[0]),Number(x[1])]));
    for(const [date,weight] of periodWeights)weightMap.set(String(date),Number(weight));
    patients[index]={
      ...patients[index],
      diary:entries,
      entries,
      weights:[...weightMap.entries()].filter(([,w])=>Number.isFinite(w)).sort((a,b)=>a[0].localeCompare(b[0])),
      _diaryLazyDays:range===0?'all':range
    };
    localStorage.setItem(EXTRA_PATIENTS_KEY,JSON.stringify(patients));
  }

  async function load(patientId,days=30){
    const id=String(patientId||'');
    if(!id)throw new Error('Paziente non valido.');
    const pending=requestedRange;
    requestedRange=null;
    const range=normalizeRange(pending===null?days:pending);
    const key=`${id}:${range===0?'all':range}`;
    if(cache.has(key)){
      const rows=cache.get(key);
      publish(id,rows,range);
      activeRangeByPatient.set(id,range);
      window.nubemoProfessionalDiaryCaloriesBridge?.primePatientDiary?.(id,rows);
      return rows;
    }
    const {data,error}=await client.rpc('get_professional_patient_diary',{p_patient_id:id,p_days:range});
    if(error)throw error;
    const rows=Array.isArray(data)?data:[];
    cache.set(key,rows);
    publish(id,rows,range);
    activeRangeByPatient.set(id,range);
    window.nubemoProfessionalDiaryCaloriesBridge?.primePatientDiary?.(id,rows);
    return rows;
  }

  function clear(patientId){
    const id=String(patientId||'');
    for(const key of [...cache.keys()])if(key.startsWith(`${id}:`))cache.delete(key);
    activeRangeByPatient.delete(id);
  }

  function currentPatientId(){return document.querySelector('[data-drawer-patient]')?.dataset.drawerPatient||'';}

  function activeDiaryTab(){
    return document.querySelector('[data-patient-tab="diary"].active,[data-drawer-tab="diary"].active');
  }

  function patchRangeControls(){
    rangePatchQueued=false;
    if(!activeDiaryTab())return;
    const host=document.querySelector('.patient-content-card');
    const search=host?.querySelector('.search-wrap');
    if(!host||!search)return;
    let controls=host.querySelector('[data-diary-range-controls]');
    if(!controls){
      controls=document.createElement('div');
      controls.dataset.diaryRangeControls='';
      controls.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 14px';
      controls.innerHTML='<span class="muted" style="font-size:13px;font-weight:700;margin-right:2px">Periodo</span>'+
        '<button type="button" class="secondary compact" data-diary-range="30" aria-label="Ultimi 30 giorni">30</button>'+
        '<button type="button" class="secondary compact" data-diary-range="60" aria-label="Ultimi 60 giorni">60</button>'+
        '<button type="button" class="secondary compact" data-diary-range="90" aria-label="Ultimi 90 giorni">90</button>'+
        '<button type="button" class="secondary compact" data-diary-range="all" aria-label="Tutto lo storico">Tutto</button>';
      host.insertBefore(controls,search);
    }
    const patientId=currentPatientId();
    const active=activeRangeByPatient.get(patientId)??30;
    controls.querySelectorAll('[data-diary-range]').forEach(button=>{
      const value=button.dataset.diaryRange==='all'?0:Number(button.dataset.diaryRange);
      const selected=value===active;
      button.className=`${selected?'primary':'secondary'} compact`;
      button.setAttribute('aria-pressed',selected?'true':'false');
    });
  }

  function queueRangePatch(){
    if(rangePatchQueued)return;
    rangePatchQueued=true;
    queueMicrotask(patchRangeControls);
  }

  document.addEventListener('click',event=>{
    const rangeButton=event.target?.closest?.('[data-diary-range]');
    if(rangeButton){
      event.preventDefault();
      const raw=String(rangeButton.dataset.diaryRange||'30');
      requestedRange=raw==='all'?0:(Number(raw)||30);
      const tabButton=activeDiaryTab();
      if(tabButton)tabButton.click();
      return;
    }

    if(event.target?.closest?.('[data-patient-tab="diary"],[data-drawer-tab="diary"],#backDiary'))queueRangePatch();

    const button=event.target?.closest?.('[data-diary-export-period]');
    if(!button)return;
    if(exportReplay.has(button)){exportReplay.delete(button);return;}
    const period=String(button.dataset.diaryExportPeriod||'');
    if(!['90','all'].includes(period))return;
    const patientId=currentPatientId();
    if(!patientId)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const requested=period==='all'?0:90;
    const previousRange=activeRangeByPatient.get(patientId)??30;
    void load(patientId,requested).then(()=>{
      exportReplay.add(button);
      button.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
      return load(patientId,previousRange);
    }).then(queueRangePatch).catch(error=>{
      console.error('NUBEMO Diario export lazy:',error);
      alert('Non riesco a caricare il periodo richiesto del diario. Riprova.');
    });
  },true);

  document.addEventListener('input',event=>{
    if(event.target?.matches?.('#proDiarySearch'))queueRangePatch();
  },true);

  window.nubemoProfessionalPatientDiaryLazy=Object.freeze({load,clear,cache,activeRangeByPatient});
})();
