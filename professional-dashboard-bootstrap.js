// NUBEMO 4.0 — bootstrap Dashboard Professionista.
// Carica un payload minimo e prepara query puntuali per BMI e lista Pazienti.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  if(!client)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  const DELETED_PATIENTS_KEY='diario-pro-deleted-patients-v1';
  const APPT_KEY='diario-pro-appts-recovery-v1';
  const SETTINGS_KEY='diario-pro-settings-recovery-v1';
  const DOCUMENT_META_KEY='nubemo-documents-meta-v1';

  const {getItem:previousGetItem,setItem:previousSetItem,removeItem:previousRemoveItem}=window.NubemoRuntimeKit.capture();
  const memory=new Map();
  let enabled=false;
  let installed=false;
  let dashboardPayload=null;
  let patientListPayload=null;

  const asInt=value=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.trunc(n)):0;};
  const today=()=>new Date().toISOString().slice(0,10);

  function shell(id,index,bmiValue=null,name='Paziente'){
    const hasBmi=Number.isFinite(Number(bmiValue));
    return {
      id,
      name,
      firstName:name,
      surname:'',
      phone:'',email:'',birth:'',sex:'',
      height:hasBmi?100:'',
      startDate:'',status:'active',relationshipStatus:'active',
      goal:'',minWeight:'',maxWeight:'',reasonableWeight:'',theoreticalWeight:'',
      work:'',activity:'',activityFactor:'',smoking:'',alcohol:'',diagnosis:'',bowel:'',metabolism:'',feeg:'',impedance:'',
      famObesity:false,famDiabetes:false,famHypertension:false,famCardiovascular:false,famDyslipidemia:false,famThyroid:false,famGestational:false,
      previousDiets:'',allergies:'',medications:'',giIssues:'',pastConditions:'',observations:'',objectives:'',
      showEnergyValues:false,readOnly:false,
      weights:hasBmi?[[today(),Number(bmiValue)]]:[],
      diary:[],entries:[],measures:[],
      real:true,remote:true,_dashboardShell:true,_hydrated:false,_index:index
    };
  }

  function dashboardDraftShell(index){
    return {
      ...shell(`__dash_draft_${index}`,index,null,'Contatto'),
      status:'draft',relationshipStatus:'draft',readOnly:true,real:false,_draft:true
    };
  }

  function buildPatients(payload){
    const counts=payload?.bmi_counts||{};
    const buckets=[
      ['underweight',17],['normal',22],['overweight',27],
      ['obesity1',32],['obesity2',37],['obesity3',42]
    ];
    const rows=[];
    let seq=0;
    for(const [key,bmi] of buckets){
      for(let i=0;i<asInt(counts[key]);i++)rows.push(shell(`__dash_${key}_${++seq}`,seq,bmi));
    }
    for(let i=0;i<asInt(counts.without_bmi);i++)rows.push(shell(`__dash_no_bmi_${++seq}`,seq,null));

    const activeCount=asInt(payload?.active_patient_count);
    while(rows.length<activeCount)rows.push(shell(`__dash_extra_${++seq}`,seq,null));
    if(rows.length>activeCount)rows.length=activeCount;

    const draftCount=asInt(payload?.draft_patient_count);
    for(let i=0;i<draftCount;i++)rows.push(dashboardDraftShell(++seq));

    const subjectMap=new Map();
    let cursor=0;
    for(const appt of Array.isArray(payload?.today_appointments)?payload.today_appointments:[]){
      if(appt?.type==='personal')continue;
      const subjects=Array.isArray(appt?.subjects)&&appt.subjects.length
        ?appt.subjects
        :(appt?.subject_id?[{id:appt.subject_id,name:appt.subject_name||'Paziente'}]:[]);
      for(const subject of subjects){
        const id=String(subject?.id||'');
        if(!id||subjectMap.has(id))continue;
        if(cursor>=rows.length)break;
        const row=rows[cursor++];
        row.id=id;
        row.name=String(subject?.name||'Paziente');
        row.firstName=row.name;
        subjectMap.set(id,row.id);
      }
    }
    return {rows,subjectMap};
  }

  function buildAppointments(payload,subjectMap){
    const actual=(Array.isArray(payload?.today_appointments)?payload.today_appointments:[]).map(row=>{
      const subjects=row.type==='personal'?[]:(Array.isArray(row?.subjects)&&row.subjects.length
        ?row.subjects
        :(row?.subject_id?[{id:row.subject_id,name:row.subject_name||'Paziente'}]:[]));
      const patientIds=[...new Set(subjects.map(subject=>subjectMap.get(String(subject?.id||''))).filter(Boolean).map(String))].slice(0,2);
      return {
      id:String(row.id),
      patientId:patientIds[0]||null,
      patientIds,
      date:String(row.date||''),
      time:String(row.time||'00:00'),
      type:String(row.type||'control'),
      duration:Math.max(1,asInt(row.duration)||30),
      title:row.type==='personal'?String(row.title||'Impegno personale'):'',
      note:row.type==='personal'?'':String(row.note||'')
    };
    });

    const currentDay=today();
    const synthetic=[];
    for(const day of Array.isArray(payload?.week_counts)?payload.week_counts:[]){
      const date=String(day?.date||'');
      if(!date||date===currentDay)continue;
      for(let i=0;i<asInt(day?.first);i++)synthetic.push({id:`__dash_${date}_first_${i}`,patientId:null,date,time:'00:00',type:'first',duration:60,title:'',note:''});
      for(let i=0;i<asInt(day?.control);i++)synthetic.push({id:`__dash_${date}_control_${i}`,patientId:null,date,time:'00:00',type:'control',duration:30,title:'',note:''});
    }
    return [...actual,...synthetic];
  }

  function buildDashboardDocuments(payload,patients){
    const patientId=patients[0]?.id||'__dash_none';
    const docs=[];
    if(payload?.has_unread_documents)docs.push({id:'__dash_unread_document',patientId,category:'health',subCategory:'other',title:'Documento',uploadedBy:'patient',unreadForProfessional:true});
    if(payload?.has_unread_labs)docs.push({id:'__dash_unread_lab',patientId,category:'health',subCategory:'blood_test',title:'Analisi',uploadedBy:'patient',unreadForProfessional:true});
    return docs;
  }

  function listPatient(row){
    const first=row?.first_weight==null?null:Number(row.first_weight);
    const last=row?.last_weight==null?null:Number(row.last_weight);
    const weights=[];
    if(Number.isFinite(first))weights.push([String(row.pathway_start_date||'1900-01-01'),first]);
    if(Number.isFinite(last)&&(weights.length===0||last!==first))weights.push([today(),last]);
    return {
      id:String(row.id),profileId:row.profile_id||null,
      name:String(row.name||'Paziente'),firstName:String(row.first_name||''),surname:String(row.last_name||''),
      phone:String(row.phone||''),email:String(row.email||''),birth:row.birth_date||'',sex:row.sex||'',height:row.height_cm??'',
      startDate:row.pathway_start_date||String(row.started_at||'').slice(0,10),status:row.patient_status||'active',relationshipStatus:'active',
      goal:'',minWeight:'',maxWeight:'',reasonableWeight:'',theoreticalWeight:'',work:'',activity:'',activityFactor:'',smoking:'',alcohol:'',diagnosis:'',bowel:'',metabolism:'',feeg:'',impedance:'',
      famObesity:false,famDiabetes:false,famHypertension:false,famCardiovascular:false,famDyslipidemia:false,famThyroid:false,famGestational:false,
      previousDiets:'',allergies:'',medications:'',giIssues:'',pastConditions:'',observations:'',objectives:'',showEnergyValues:false,readOnly:false,
      weights,diary:[],entries:[],measures:[],real:true,remote:true,_patientListShell:true,_hydrated:false,
      _unreadDocuments:!!row.unread_documents,_unreadLabs:!!row.unread_labs
    };
  }

  function listDraft(row){
    return {
      id:String(row.id),name:String(row.name||'Contatto'),firstName:String(row.first_name||''),surname:String(row.last_name||''),phone:String(row.phone||''),
      email:'',birth:'',sex:'',height:'',startDate:'',status:'draft',relationshipStatus:'draft',
      goal:'',minWeight:'',maxWeight:'',reasonableWeight:'',theoreticalWeight:'',work:'',activity:'',activityFactor:'',smoking:'',alcohol:'',diagnosis:'',bowel:'',metabolism:'',feeg:'',impedance:'',
      famObesity:false,famDiabetes:false,famHypertension:false,famCardiovascular:false,famDyslipidemia:false,famThyroid:false,famGestational:false,
      previousDiets:'',allergies:'',medications:'',giIssues:'',pastConditions:'',observations:'',objectives:'',showEnergyValues:false,readOnly:true,
      weights:[],diary:[],entries:[],measures:[],real:false,remote:true,_draft:true,_patientListShell:true,_hydrated:false
    };
  }

  function buildPatientListDocuments(rows){
    const docs=[];
    for(const p of rows){
      if(p._unreadDocuments)docs.push({id:`__list_doc_${p.id}`,patientId:p.id,category:'health',subCategory:'other',title:'Documento',uploadedBy:'patient',unreadForProfessional:true});
      if(p._unreadLabs)docs.push({id:`__list_lab_${p.id}`,patientId:p.id,category:'health',subCategory:'blood_test',title:'Analisi',uploadedBy:'patient',unreadForProfessional:true});
    }
    return docs;
  }

  // Il badge "Anagrafica parziale" e' ora reso nel markup dell'elenco
  // pazienti (pro.js). Prima veniva iniettato come foglio di stile con un
  // selettore ::after per ogni id draft, agganciato alla posizione esatta
  // dei nodi (> div:nth-child(2)): si perdeva a ogni ricostruzione della
  // lista e per i draft creati dopo il caricamento.

  function installStorage(){
    if(installed)return;
    installed=true;
    window.NubemoRuntimeKit.patch('professional-dashboard-bootstrap',{
      getItem:function(key){
        const k=String(key);
        if(this===window.nubemoProfessionalRuntimeStore.storage&&enabled&&memory.has(k))return memory.get(k);
        return previousGetItem.call(this,key);
      },
      setItem:function(key,value){
        const k=String(key);
        if(this===window.nubemoProfessionalRuntimeStore.storage&&enabled&&memory.has(k)){
          memory.set(k,String(value));
          return;
        }
        return previousSetItem.call(this,key,value);
      },
      removeItem:function(key){
        const k=String(key);
        if(this===window.nubemoProfessionalRuntimeStore.storage&&enabled&&memory.has(k)){
          memory.delete(k);
          return;
        }
        return previousRemoveItem.call(this,key);
      }
    }, []);
  }

  function publishDashboard(payload){
    const {rows:patients,subjectMap}=buildPatients(payload);
    memory.set(DELETED_PATIENTS_KEY,JSON.stringify(['main','laura','marco']));
    memory.set(EXTRA_PATIENTS_KEY,JSON.stringify(patients));
    memory.set(APPT_KEY,JSON.stringify(buildAppointments(payload,subjectMap)));
    memory.set(SETTINGS_KEY,JSON.stringify({workDays:asInt(payload?.work_days_count)===6?6:5}));
    memory.set(DOCUMENT_META_KEY,JSON.stringify(buildDashboardDocuments(payload,patients)));
    enabled=true;
    installStorage();
  }

  function publishPatientList(payload){
    const real=(Array.isArray(payload?.patients)?payload.patients:[]).map(listPatient);
    const drafts=(Array.isArray(payload?.drafts)?payload.drafts:[]).map(listDraft);
    memory.set(DELETED_PATIENTS_KEY,JSON.stringify(['main','laura','marco']));
    memory.set(EXTRA_PATIENTS_KEY,JSON.stringify([...real,...drafts]));
    memory.set(DOCUMENT_META_KEY,JSON.stringify(buildPatientListDocuments(real)));
    enabled=true;
    installStorage();
  }

  function bmiKey(category){
    return ({'Sottopeso':'underweight','Normopeso':'normal','Sovrappeso':'overweight','Obesità I':'obesity1','Obesità II':'obesity2','Obesità III':'obesity3'})[String(category||'')]||'';
  }

  function dashboardShellBmiKey(patient){
    if(!patient?._dashboardShell)return '';
    const w=Number(patient.weights?.[0]?.[1]);
    if(!Number.isFinite(w))return '';
    if(w<18.5)return 'underweight';
    if(w<25)return 'normal';
    if(w<30)return 'overweight';
    if(w<35)return 'obesity1';
    if(w<40)return 'obesity2';
    return 'obesity3';
  }

  function bmiPatient(row,index){
    const weight=row?.weight==null?null:Number(row.weight);
    const height=row?.height==null?null:Number(row.height);
    return {
      ...shell(String(row.id),index,null,String(row.name||'Paziente')),
      height:Number.isFinite(height)?height:'',
      weights:Number.isFinite(weight)?[[today(),weight]]:[],
      _dashboardShell:false,_bmiPointShell:true
    };
  }

  function restoreAgendaSubjects(rows,payload){
    const existing=new Set(rows.map(row=>String(row.id)));
    const free=rows.filter(row=>row?._dashboardShell===true);
    let cursor=0;
    for(const appt of Array.isArray(payload?.today_appointments)?payload.today_appointments:[]){
      if(appt?.type==='personal')continue;
      const subjects=Array.isArray(appt?.subjects)&&appt.subjects.length
        ?appt.subjects
        :(appt?.subject_id?[{id:appt.subject_id,name:appt.subject_name||'Paziente'}]:[]);
      for(const subject of subjects){
        const id=String(subject?.id||'');
        if(!id||existing.has(id))continue;
        while(cursor<free.length&&free[cursor]?._dashboardShell!==true)cursor++;
        const row=free[cursor++];
        if(!row)return;
        row.id=id;
        row.name=String(subject?.name||'Paziente');
        row.firstName=row.name;
        existing.add(id);
      }
    }
  }

  async function loadBmiCategory(category){
    if(!dashboardPayload)throw new Error('Payload Dashboard non disponibile.');
    const key=bmiKey(category);
    if(!key)return [];
    const {data,error}=await client.rpc('get_professional_bmi_patients',{p_category:String(category)});
    if(error)throw error;
    const rows=Array.isArray(data)?data:[];
    const baseline=buildPatients(dashboardPayload).rows;
    const slots=[];
    baseline.forEach((p,i)=>{if(dashboardShellBmiKey(p)===key)slots.push(i);});
    rows.forEach((row,i)=>{if(i<slots.length)baseline[slots[i]]=bmiPatient(row,slots[i]);});
    restoreAgendaSubjects(baseline,dashboardPayload);
    memory.set(EXTRA_PATIENTS_KEY,JSON.stringify(baseline));
    memory.set(DOCUMENT_META_KEY,JSON.stringify(buildDashboardDocuments(dashboardPayload,baseline)));
    enabled=true;
    return rows;
  }

  async function loadPatientsList(force=false){
    if(patientListPayload&&!force){publishPatientList(patientListPayload);return patientListPayload;}
    const {data,error}=await client.rpc('get_professional_patient_list');
    if(error)throw error;
    patientListPayload=data&&typeof data==='object'?data:{patients:[],drafts:[]};
    publishPatientList(patientListPayload);
    return patientListPayload;
  }

  function restoreDashboard(){
    if(dashboardPayload)publishDashboard(dashboardPayload);
    if(patientListPayload)publishPatientList(patientListPayload);
  }

  // get_professional_dashboard veniva eseguita una sola volta in init():
  // i conteggi BMI restavano quelli del caricamento iniziale anche dopo
  // che un paziente inseriva un nuovo peso. Qui si rilegge dal database.
  let refreshing=null;
  function refreshDashboard(){
    if(refreshing)return refreshing;
    refreshing=(async()=>{
      const {data,error}=await client.rpc('get_professional_dashboard');
      if(error)throw error;
      dashboardPayload=data&&typeof data==='object'?data:{};
      publishDashboard(dashboardPayload);
      const ctx=window.nubemoProfessionalContext;
      if(ctx)ctx.dashboard=dashboardPayload;
      return dashboardPayload;
    })().finally(()=>{refreshing=null;});
    return refreshing;
  }

  // Il ritorno sulla Dashboard rilegge i conteggi.
  document.addEventListener('click',event=>{
    if(!event.target?.closest?.('[data-view="dashboard"],[data-drawer-view="dashboard"]'))return;
    setTimeout(()=>{
      refreshDashboard()
        .then(()=>window.nubemoProfessionalRender?.())
        .catch(error=>console.error('NUBEMO Dashboard aggiornamento:',error));
    },0);
  });

  async function init(context){
    const {data,error}=await client.rpc('get_professional_dashboard');
    if(error)throw error;
    dashboardPayload=data&&typeof data==='object'?data:{};
    publishDashboard(dashboardPayload);
    if(context)context.dashboard=dashboardPayload;

    if(!window.nubemoFoodCatalog){
      window.nubemoFoodCatalog=Object.freeze({
        nubemoFoods:Object.freeze([]),
        findCrea:()=>null,
        canUseCrea:()=>false
      });
    }
    return dashboardPayload;
  }

  function disable(){enabled=false;}

  window.nubemoProfessionalDashboardBootstrap=Object.freeze({
    init,disable,memory,restoreDashboard,refreshDashboard,loadBmiCategory,loadPatientsList
  });
})();