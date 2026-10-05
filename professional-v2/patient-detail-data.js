import {patientRecords} from "./patients-data.js";

// Demo adapter. A future data loader can return the same shape without changing the views.
const patientDetails={
  p1:{
    identity:{birthDate:"1979-03-14",sex:"Maschio",fiscalCode:"",address:"",postalCode:"",city:"",province:""},
    journey:{startedAt:"2026-09-12",summary:"Buona continuità nel percorso; il diario è presente, con attenzione ai weekend.",plans:[{id:"plan-1",createdAt:"2026-09-14",sharedAt:"2026-09-14",title:"Piano alimentare condiviso"}]},
    appointments:[{id:"a1",startsAt:"2026-10-10T11:00:00+02:00",title:"Controllo nutrizionale",status:"scheduled"}],
    visits:[
      {id:"v1",date:"2026-09-12",type:"first",status:"completed",title:"Prima visita",description:"Anamnesi, misure e obiettivi definiti"},
      {id:"v2",date:"2026-09-28",type:"control",status:"completed",title:"Controllo",description:"Verifica progressi e adattamenti"},
      {id:"v3",date:"2026-10-01",type:"followup",status:"completed",title:"Visita successiva",description:"Percorso e diario aggiornati"}
    ],
    measurements:[
      {date:"2026-09-12",weight:109.4,bodyFat:29.6,muscleMass:40.4,bcm:38.1},
      {date:"2026-09-16",weight:108.9},
      {date:"2026-09-20",weight:108.1,bodyFat:29.1,muscleMass:40.6,bcm:38.2},
      {date:"2026-09-24",weight:107.5},
      {date:"2026-09-28",weight:106.8,bodyFat:28.4,muscleMass:41.2,bcm:38.6},
      {date:"2026-10-01",weight:106.6}
    ],
    diary:{days:[
      {date:"2026-09-29",valid:true},{date:"2026-09-30",valid:true},
      {date:"2026-10-01",valid:true},{date:"2026-10-02",valid:true},
      {date:"2026-10-03",valid:false},{date:"2026-10-04",valid:true}
    ],updates:[{id:"du1",date:"2026-10-04",title:"Diario aggiornato",description:"Nuove voci del diario",origin:"Paziente"}]},
    documents:[{id:"d1",date:"2026-09-26",type:"referto",title:"Referto vitamina D",description:"Caricato dal paziente",origin:"Paziente",unread:true}],
    activities:[{id:"e1",date:"2026-09-24",type:"email",title:"Promemoria visita inviato via Email",description:"Consegna richiesta",origin:"Agenda"}],
    profile:{
      goals:{summary:"Dimagrimento graduale e sostenibile, con maggiore continuità nel diario alimentare.",items:["Migliorare la regolarità dei pasti","Più continuità nel diario","Gestire meglio i weekend"]},
      history:{summary:"Informazioni generali sul percorso raccolte durante la prima visita.",details:"Anamnesi da completare nelle prossime visite."},
      conditions:{summary:"Condizioni cliniche, allergie e intolleranze note.",items:[]},
      medication:{summary:"Terapie e integrazione in corso.",items:[]},
      lifestyle:[
        {type:"activity",label:"Attività fisica",value:"3–4 volte a settimana",description:"Palestra e camminate"},
        {type:"food",label:"Alimentazione",value:"Prevalentemente regolare",description:"Da curare la continuità nel weekend"},
        {type:"sleep",label:"Sonno",value:"6–7 ore a notte",description:"Qualità variabile"},
        {type:"stress",label:"Stress",value:"Livello moderato",description:"Più alto nei periodi lavorativi"}
      ]
    },
    privacy:{consent:{signedAt:"2026-09-12"},communications:{email:true},reminders:{email:true},administrativeNotes:""}
  }
};

const demoSession=new Map();

export function getPatientData(id){
  if(demoSession.has(id)) return demoSession.get(id);
  const record=patientRecords.find(patient=>patient.id===id);
  if(!record) return null;
  const detail=patientDetails[id]||{};
  const data={
    identity:{id:record.id,firstName:record.first_name,lastName:record.last_name,avatar:record.avatar,status:record.status,birthDate:null,age:record.age,sex:null,phone:record.phone||"",email:record.email||"",fiscalCode:"",address:"",postalCode:"",city:"",province:"",...detail.identity},
    journey:{startedAt:null,summary:"",plans:[],...detail.journey},
    appointments:detail.appointments||[],visits:detail.visits||[],measurements:detail.measurements||[],
    diary:{days:[],updates:[],...detail.diary},documents:detail.documents||[],activities:detail.activities||[],
    profile:{goals:null,history:null,conditions:null,medication:null,lifestyle:[],...detail.profile},
    privacy:{consent:null,communications:{email:false},reminders:{email:false},administrativeNotes:"",...detail.privacy}
  };
  demoSession.set(id,data);
  return data;
}
