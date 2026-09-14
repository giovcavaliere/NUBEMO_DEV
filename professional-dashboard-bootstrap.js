// NUBEMO 4.0 — bootstrap Dashboard Professionista.
// Carica un payload minimo e virtualizza solo i dati necessari alla Dashboard.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  if(!client)return;

  const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
  const DELETED_PATIENTS_KEY='diario-pro-deleted-patients-v1';
  const APPT_KEY='diario-pro-appts-recovery-v1';
  const SETTINGS_KEY='diario-pro-settings-recovery-v1';
  const DOCUMENT_META_KEY='nubemo-documents-meta-v1';

  const storageProto=Object.getPrototypeOf(window.localStorage);
  const previousGetItem=storageProto.getItem;
  const previousSetItem=storageProto.setItem;
  const previousRemoveItem=storageProto.removeItem;
  const memory=new Map();
  let enabled=false;
  let installed=false;

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

    // I nomi servono solo per l'Agenda di oggi. Li assegniamo a shell già
    // presenti, senza ampliare il payload pazienti della Dashboard.
    const subjectMap=new Map();
    let cursor=0;
    for(const appt of Array.isArray(payload?.today_appointments)?payload.today_appointments:[]){
      if(appt?.type==='personal'||!appt?.subject_id||subjectMap.has(appt.subject_id))continue;
      if(cursor>=rows.length)break;
      const row=rows[cursor++];
      const oldId=row.id;
      row.id=String(appt.subject_id);
      row.name=String(appt.subject_name||'Paziente');
      row.firstName=row.name;
      subjectMap.set(String(appt.subject_id),row.id);
      if(oldId!==row.id)subjectMap.set(oldId,row.id);
    }
    return {rows,subjectMap};
  }

  function buildAppointments(payload,subjectMap){
    const actual=(Array.isArray(payload?.today_appointments)?payload.today_appointments:[]).map(row=>({
      id:String(row.id),
      patientId:row.type==='personal'?null:(subjectMap.get(String(row.subject_id||''))||null),
      date:String(row.date||''),
      time:String(row.time||'00:00'),
      type:String(row.type||'control'),
      duration:Math.max(1,asInt(row.duration)||30),
      title:row.type==='personal'?String(row.title||'Impegno personale'):'',
      note:row.type==='personal'?'':String(row.note||'')
    }));

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

  function buildDocuments(payload,patients){
    const patientId=patients[0]?.id||'__dash_none';
    const docs=[];
    if(payload?.has_unread_documents)docs.push({id:'__dash_unread_document',patientId,category:'health',subCategory:'other',title:'Documento',uploadedBy:'patient',unreadForProfessional:true});
    if(payload?.has_unread_labs)docs.push({id:'__dash_unread_lab',patientId,category:'health',subCategory:'blood_test',title:'Analisi',uploadedBy:'patient',unreadForProfessional:true});
    return docs;
  }

  function installStorage(){
    if(installed)return;
    installed=true;
    storageProto.getItem=function(key){
      const k=String(key);
      if(this===window.localStorage&&enabled&&memory.has(k))return memory.get(k);
      return previousGetItem.call(this,key);
    };
    storageProto.setItem=function(key,value){
      const k=String(key);
      if(this===window.localStorage&&enabled&&memory.has(k)){
        memory.set(k,String(value));
        return;
      }
      return previousSetItem.call(this,key,value);
    };
    storageProto.removeItem=function(key){
      const k=String(key);
      if(this===window.localStorage&&enabled&&memory.has(k)){
        memory.delete(k);
        return;
      }
      return previousRemoveItem.call(this,key);
    };
  }

  function publish(payload){
    const {rows:patients,subjectMap}=buildPatients(payload);
    memory.set(DELETED_PATIENTS_KEY,JSON.stringify(['main','laura','marco']));
    memory.set(EXTRA_PATIENTS_KEY,JSON.stringify(patients));
    memory.set(APPT_KEY,JSON.stringify(buildAppointments(payload,subjectMap)));
    memory.set(SETTINGS_KEY,JSON.stringify({workDays:asInt(payload?.work_days_count)===6?6:5}));
    memory.set(DOCUMENT_META_KEY,JSON.stringify(buildDocuments(payload,patients)));
    enabled=true;
    installStorage();
  }

  async function init(context){
    const {data,error}=await client.rpc('get_professional_dashboard');
    if(error)throw error;
    const payload=data&&typeof data==='object'?data:{};
    publish(payload);
    if(context)context.dashboard=payload;

    // Compatibilità con pro.js: il catalogo alimenti non fa parte del bootstrap.
    if(!window.nubemoFoodCatalog){
      window.nubemoFoodCatalog=Object.freeze({
        nubemoFoods:Object.freeze([]),
        findCrea:()=>null,
        canUseCrea:()=>false
      });
    }
    return payload;
  }

  function disable(){enabled=false;}

  window.nubemoProfessionalDashboardBootstrap=Object.freeze({init,disable,memory});
})();
