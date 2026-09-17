// NUBEMO 4.0 — Modifica scheda paziente puntuale.
// Evita il runtime completo: carica/salva solo anagrafica, profilo clinico e impostazioni del paziente selezionato.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  if(!client)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  const PATIENT_START_DATE_KEY='nubemo-patient-start-date-v1';
  const bypass=new WeakSet();
  let currentPatientId='';
  let preparePromise=null;
  let saving=false;

  function loadScript(src,errorMessage){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.onload=resolve;
      script.onerror=()=>reject(new Error(errorMessage));
      document.body.appendChild(script);
    });
  }
  function hasScript(fragment){return [...document.scripts].some(script=>String(script.src||'').includes(fragment));}
  function parse(value,fallback){try{return JSON.parse(value)}catch(_){return fallback}}
  function text(id){return String(document.getElementById(id)?.value||'').trim();}
  function checked(id){return !!document.getElementById(id)?.checked;}
  function optionalNumber(id){
    const raw=text(id).replace(',','.');
    if(raw==='')return null;
    const value=Number(raw);
    return Number.isFinite(value)?value:NaN;
  }
  function readItalianDate(id){
    const value=text(id);
    if(!value)return null;
    const m=value.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if(!m)return '';
    const iso=`${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    const d=new Date(`${iso}T12:00:00`);
    return !Number.isNaN(d.getTime())&&d.getFullYear()===Number(m[3])&&d.getMonth()+1===Number(m[2])&&d.getDate()===Number(m[1])?iso:'';
  }
  function currentFromDom(){
    const direct=document.querySelector('[data-drawer-patient]')?.dataset.drawerPatient;
    if(direct)return String(direct);
    const title=document.querySelector('.patient-global-title')?.textContent?.trim()||'';
    const rows=parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]',[]);
    if(Array.isArray(rows)){
      const row=rows.find(item=>item?.id&&title.includes(String(item.name||'').trim()));
      if(row)return String(row.id);
    }
    return currentPatientId;
  }
  function shell(patientId){
    const rows=parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]',[]);
    return Array.isArray(rows)?rows.find(row=>String(row?.id||'')===String(patientId))||null:null;
  }

  async function ensureDependencies(){
    if(!window.nubemoProfessionalServices){
      if(!hasScript('professional-services.js'))await loadScript('professional-services.js?v=nubemo40clean04','Impossibile caricare i servizi paziente.');
      if(!window.nubemoProfessionalServices)throw new Error('Servizi paziente non disponibili.');
    }
    if(!window.nubemoProfessionalPatientSummaryLazy){
      if(!hasScript('professional-patient-summary-lazy.js'))await loadScript('professional-patient-summary-lazy.js?v=nubemo40clean04','Impossibile caricare il riepilogo paziente.');
      if(!window.nubemoProfessionalPatientSummaryLazy)throw new Error('Riepilogo paziente non disponibile.');
    }
  }

  async function prepare(patientId){
    const id=String(patientId||'');
    if(!id)throw new Error('Paziente non disponibile.');
    if(preparePromise&&currentPatientId===id)return preparePromise;
    currentPatientId=id;
    preparePromise=(async()=>{
      const started=performance.now();
      await ensureDependencies();
      await window.nubemoProfessionalPatientSummaryLazy.load(id);
      console.log(`[NUBEMO PERF] Modifica scheda lazy: ${Math.round(performance.now()-started)} ms`);
      return true;
    })().catch(error=>{preparePromise=null;throw error;});
    return preparePromise;
  }

  function patchPhoneField(){
    if(document.body.dataset.proView!=='editProfile'||document.getElementById('epPhone'))return;
    const surname=document.getElementById('epSurname');
    if(!surname)return;
    const row=shell(currentPatientId);
    const label=document.createElement('label');label.htmlFor='epPhone';label.textContent='Telefono';
    const input=document.createElement('input');input.id='epPhone';input.type='tel';input.inputMode='tel';input.autocomplete='tel';input.value=String(row?.phone||'');
    surname.insertAdjacentElement('afterend',input);
    surname.insertAdjacentElement('afterend',label);
  }

  function clinicalFromForm(){
    return {
      goalWeight:optionalNumber('epGoal'),
      minWeight:optionalNumber('epMinWeight'),
      maxWeight:optionalNumber('epMaxWeight'),
      reasonableWeight:optionalNumber('epReasonableWeight'),
      theoreticalWeight:optionalNumber('epTheoreticalWeight'),
      work:text('epWork')||null,
      activity:text('epActivity')||null,
      activityFactor:optionalNumber('epActivityFactor'),
      smoking:text('epSmoking')||null,
      alcohol:text('epAlcohol')||null,
      diagnosis:text('epDiagnosis')||null,
      bowel:text('epBowel')||null,
      metabolism:text('epMetabolism')||null,
      feeg:text('epFeeg')||null,
      impedance:text('epImpedance')||null,
      familyObesity:checked('epFamObesity'),
      familyDiabetes:checked('epFamDiabetes'),
      familyHypertension:checked('epFamHypertension'),
      familyCardiovascular:checked('epFamCardiovascular'),
      familyDyslipidemia:checked('epFamDyslipidemia'),
      familyThyroid:checked('epFamThyroid'),
      previousDiets:text('epPreviousDiets')||null,
      allergies:text('epAllergies')||null,
      medications:text('epMedications')||null,
      giIssues:text('epGiIssues')||null,
      pastConditions:text('epPastConditions')||null,
      observations:text('epObservations')||null,
      objectives:text('epObjectives')||null
    };
  }

  function validate(first,last,birth,height,clinical){
    if(!first||!last){alert('Inserisci nome e cognome.');return false;}
    if(birth===''){alert('Controlla la data di nascita.');return false;}
    if(height!==null&&(!Number.isFinite(height)||height<80||height>250)){alert('Controlla l’altezza inserita.');return false;}
    for(const value of [clinical.goalWeight,clinical.minWeight,clinical.maxWeight,clinical.reasonableWeight,clinical.theoreticalWeight]){
      if(value!==null&&(!Number.isFinite(value)||value<30||value>300)){alert('Controlla i valori di peso inseriti.');return false;}
    }
    return true;
  }

  function updateStartDateCache(patientId,date){
    const map=parse(localStorage.getItem(PATIENT_START_DATE_KEY)||'{}',{});
    if(date)map[patientId]=date;else delete map[patientId];
    localStorage.setItem(PATIENT_START_DATE_KEY,JSON.stringify(map));
  }

  function updateContext(patientId,values){
    const ctx=window.nubemoProfessionalContext||{};
    const rows=Array.isArray(ctx.patients)?ctx.patients:[];
    const next=rows.map(row=>String(row?.id||'')===patientId?{
      ...row,
      birth_date:values.birthDate,
      sex:values.sex,
      height_cm:values.height,
      pathway_start_date:values.pathwayStart,
      profile:{...(row.profile||{}),first_name:values.firstName,last_name:values.lastName,phone:values.phone}
    }:row);
    window.nubemoProfessionalContext={...ctx,patients:next};
  }

  async function save(){
    if(saving)return;
    const patientId=String(currentPatientId||currentFromDom()||'');
    if(!patientId)return alert('Paziente non disponibile.');
    const row=shell(patientId);
    if(!row)return alert('Scheda paziente non disponibile.');

    const firstName=text('epName');
    const lastName=text('epSurname');
    const phone=text('epPhone');
    const birthDate=readItalianDate('epBirth');
    const sex=document.getElementById('epSex')?.value||null;
    const height=optionalNumber('epHeight');
    const pathwayStart=readItalianDate('epStartDate');
    const clinical=clinicalFromForm();
    const showEnergyValues=(document.getElementById('epShowEnergyValues')?.value||'yes')!=='no';
    const readOnly=(document.getElementById('epReadOnly')?.value||'no')==='yes';
    if(!validate(firstName,lastName,birthDate,height,clinical))return;

    const button=document.getElementById('saveEditProfile');
    saving=true;if(button){button.disabled=true;button.textContent='Salvataggio...';}
    try{
      await ensureDependencies();
      let profileId=row.profileId||row.profile_id||null;
      if(!profileId){
        const {data,error}=await client.from('patients').select('profile_id').eq('id',patientId).single();
        if(error)throw error;
        profileId=data?.profile_id||null;
      }
      if(!profileId)throw new Error('Profilo paziente non disponibile.');

      const services=window.nubemoProfessionalServices;
      await Promise.all([
        services.updatePatientDemographics({id:patientId,profile_id:profileId},{firstName,lastName,phone,birthDate,sex,height,pathwayStart}),
        services.savePatientAnamnesis(patientId,clinical)
      ]);

      const currentSettings=await client.from('patient_settings').select('settings_json').eq('patient_id',patientId).maybeSingle();
      if(currentSettings.error)throw currentSettings.error;
      const settingsJson={...(currentSettings.data?.settings_json||{}),showEnergyValues,readOnly};
      const settingsResult=await client.from('patient_settings').upsert({patient_id:patientId,settings_json:settingsJson},{onConflict:'patient_id'});
      if(settingsResult.error)throw settingsResult.error;

      updateStartDateCache(patientId,pathwayStart||'');
      updateContext(patientId,{firstName,lastName,phone,birthDate,sex,height,pathwayStart});

      // Aggiorna cache elenco e poi ripubblica il riepilogo completo del paziente appena salvato.
      await window.nubemoProfessionalDashboardBootstrap?.loadPatientsList?.(true);
      await window.nubemoProfessionalPatientSummaryLazy.load(patientId);

      alert('Scheda paziente aggiornata');
      document.getElementById('cancelEditProfile')?.click();
    }catch(error){
      console.error('NUBEMO Modifica scheda lazy:',error);
      alert('Non è stato possibile salvare la scheda paziente. Riprova.');
    }finally{
      saving=false;
      if(button&&document.body.contains(button)){button.disabled=false;button.textContent='Salva modifiche';}
    }
  }

  document.addEventListener('click',event=>{
    const edit=event.target?.closest?.('#editPatientProfileLegacy,#patientMenuEditProfile');
    if(edit){
      if(bypass.has(edit)){
        bypass.delete(edit);
        const originalId=edit.id;
        edit.removeAttribute('id');
        queueMicrotask(()=>{if(edit.isConnected&&!edit.id)edit.id=originalId;});
        return;
      }
      event.preventDefault();event.stopImmediatePropagation();
      const patientId=currentFromDom();
      void prepare(patientId).then(()=>{
        bypass.add(edit);
        edit.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
      }).catch(error=>{
        console.error('NUBEMO Modifica scheda lazy:',error);
        alert('Non riesco a caricare la scheda del paziente. Riprova.');
      });
      return;
    }

    const saveButton=event.target?.closest?.('#saveEditProfile');
    if(saveButton&&document.body.dataset.proView==='editProfile'){
      event.preventDefault();event.stopImmediatePropagation();void save();
    }
  },true);

  const observer=new MutationObserver(()=>queueMicrotask(patchPhoneField));
  const app=document.getElementById('proApp');
  if(app)observer.observe(app,{childList:true,subtree:true});
  patchPhoneField();

  window.nubemoProfessionalPatientEditLazy=Object.freeze({prepare});
})();