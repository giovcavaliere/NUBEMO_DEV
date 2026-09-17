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

  async function load(patientId,days=30,force=false){
    const id=String(patientId||'');
    if(!id)throw new Error('Paziente non valido.');
    const range=normalizeRange(days);
    const key=`${id}:${range===0?'all':range}`;
    if(!force&&cache.has(key)){
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

  function rangeLabel(range){return range===0?'Tutto':`${range} gg`;}

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
      controls.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:2px 0 16px;padding:10px 12px;border:1px solid #dfe8e4;border-radius:12px;background:#f8fbf9';
      controls.innerHTML='<span style="font-size:12px;font-weight:800;letter-spacing:.02em;color:#5f716b;text-transform:uppercase">Periodo visualizzato</span>'+
        '<div data-diary-range-segment style="display:inline-flex;align-items:stretch;border:1px solid #cfdad5;border-radius:9px;overflow:hidden;background:#fff">'+
          '<button type="button" data-diary-range="30" aria-label="Ultimi 30 giorni">30 gg</button>'+
          '<button type="button" data-diary-range="60" aria-label="Ultimi 60 giorni">60 gg</button>'+
          '<button type="button" data-diary-range="90" aria-label="Ultimi 90 giorni">90 gg</button>'+
          '<button type="button" data-diary-range="all" aria-label="Tutto lo storico">Tutto</button>'+
        '</div>';
      host.insertBefore(controls,search);
    }

    const patientId=currentPatientId();
    const active=activeRangeByPatient.get(patientId)??30;
    const buttons=[...controls.querySelectorAll('[data-diary-range]')];
    buttons.forEach((button,index)=>{
      const value=button.dataset.diaryRange==='all'?0:Number(button.dataset.diaryRange);
      const selected=value===active;
      button.setAttribute('aria-pressed',selected?'true':'false');
      button.title=selected?`${rangeLabel(value)} selezionato`:`Visualizza ${rangeLabel(value)}`;
      button.style.cssText=[
        'appearance:none',
        'border:0',
        index<buttons.length-1?'border-right:1px solid #d8e1dd':'',
        'padding:7px 12px',
        'min-width:62px',
        'font:inherit',
        'font-size:13px',
        'font-weight:750',
        'cursor:pointer',
        `background:${selected?'#064b43':'#ffffff'}`,
        `color:${selected?'#ffffff':'#435650'}`,
        'transition:background .15s ease,color .15s ease'
      ].filter(Boolean).join(';');
    });
  }

  function queueRangePatch(){
    if(rangePatchQueued)return;
    rangePatchQueued=true;
    requestAnimationFrame(()=>requestAnimationFrame(patchRangeControls));
  }

  function refreshDiaryView(scrollTop){
    const search=document.getElementById('proDiarySearch');
    if(!search){queueRangePatch();return;}
    search.dispatchEvent(new Event('input',{bubbles:true}));
    requestAnimationFrame(()=>{
      window.scrollTo(0,scrollTop);
      queueRangePatch();
    });
  }

  document.addEventListener('click',event=>{
    const rangeButton=event.target?.closest?.('[data-diary-range]');
    if(rangeButton){
      event.preventDefault();
      event.stopImmediatePropagation();
      const patientId=currentPatientId();
      if(!patientId)return;
      const raw=String(rangeButton.dataset.diaryRange||'30');
      const requested=raw==='all'?0:(Number(raw)||30);
      const current=activeRangeByPatient.get(patientId)??30;
      if(requested===current)return;

      const controls=rangeButton.closest('[data-diary-range-controls]');
      controls?.querySelectorAll('[data-diary-range]').forEach(button=>button.disabled=true);
      const scrollTop=document.scrollingElement?.scrollTop||0;

      void load(patientId,requested,true).then(()=>{
        refreshDiaryView(scrollTop);
      }).catch(error=>{
        console.error('NUBEMO Diario filtro periodo:',error);
        controls?.querySelectorAll('[data-diary-range]').forEach(button=>button.disabled=false);
        alert('Non riesco a caricare il periodo richiesto del diario. Riprova.');
      });
      return;
    }

    if(event.target?.closest?.('[data-patient-tab="diary"],[data-drawer-tab="diary"],#backDiary')){
      queueRangePatch();
      // La cache del diario non veniva mai invalidata: una giornata
      // inserita dal paziente non compariva fino al ricaricamento della
      // pagina. Al click sulla tab si rilegge sempre dal database.
      const patientId=currentPatientId();
      if(patientId&&event.target.closest('[data-patient-tab="diary"],[data-drawer-tab="diary"]')){
        const range=activeRangeByPatient.get(patientId)??30;
        const scrollTop=document.scrollingElement?.scrollTop||0;
        void load(patientId,range,true).then(()=>refreshDiaryView(scrollTop))
          .catch(error=>console.error('NUBEMO Diario aggiornamento:',error));
      }
    }

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
