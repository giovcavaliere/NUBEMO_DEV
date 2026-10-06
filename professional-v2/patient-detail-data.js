import {patientRecords} from "./patients-data.js";

// Demo adapter. A future data loader can return the same shape without changing the views.
const patientDetails={
  p1:{
    identity:{birthDate:"1979-03-14",sex:"Maschio",fiscalCode:"",address:"",postalCode:"",city:"",province:""},
    journey:{startedAt:"2026-09-12",summary:"Buona continuità nel percorso; il diario è presente, con attenzione ai weekend.",plans:[{id:"plan-1",createdAt:"2026-09-14",sharedAt:"2026-09-14",title:"Piano alimentare condiviso"}]},
    appointments:[{id:"a1",startsAt:"2026-10-10T11:00:00+02:00",title:"Controllo nutrizionale",status:"scheduled"}],
    visits:[
      {id:"v1",appointmentId:"visit-gc-20260912",date:"2026-09-12",type:"first",status:"completed",title:"Prima visita",description:"Anamnesi, misure e obiettivi definiti"},
      {id:"v2",appointmentId:"visit-gc-20260928",date:"2026-09-28",type:"control",status:"completed",title:"Controllo",description:"Verifica progressi e adattamenti"},
      {id:"v3",appointmentId:"visit-gc-20261001",date:"2026-10-01",type:"control",status:"completed",title:"Visita successiva",description:"Percorso e diario aggiornati"}
    ],
    measurements:[
      {id:"m1",date:"2026-09-12",time:"10:00",weight:109.4,height:180,waist:112,hips:115,arm:35,thigh:62,bodyFat:29.6,muscleMass:40.4,ecm:32.3,bcm:38.1,notes:"Prima rilevazione del percorso."},
      {id:"m2",date:"2026-09-16",time:"09:30",weight:108.9,notes:"Rilevazione del solo peso."},
      {id:"m3",date:"2026-09-20",time:"11:20",weight:108.1,height:180,waist:110,hips:114,bodyFat:29.1,muscleMass:40.6,ecm:32.7,bcm:38.2},
      {id:"m4",date:"2026-09-24",time:"10:00",weight:107.5},
      {id:"m5",date:"2026-09-28",time:"09:40",weight:106.8,height:180,waist:108,hips:112,arm:34,thigh:60,bodyFat:28.4,muscleMass:41.2,ecm:33,bcm:38.6,notes:"Misurazione antropometrica completa con BIA."},
      {id:"m6",date:"2026-10-01",time:"10:15",weight:106.6,height:180,notes:"Controllo del peso. BIA non rilevata in questa occasione."}
    ],
    diary:{days:[
      {date:"2026-09-29",valid:true},{date:"2026-09-30",valid:true},
      {date:"2026-10-01",valid:true},{date:"2026-10-02",valid:true},
      {date:"2026-10-03",valid:false},{date:"2026-10-04",valid:true}
    ],updates:[{id:"du1",date:"2026-10-04",title:"Diario aggiornato",description:"Nuove voci del diario",origin:"Paziente"}]},
    documents:[
      {id:"doc-a-oct",date:"2026-10-04",category:"analysis",title:"Analisi sangue ottobre",fileName:"Analisi_sangue_04-10-2026.pdf",uploadedBy:"patient",origin:"Paziente",description:"Caricato dal paziente",unread:true,file:null},
      {id:"doc-r-eco",date:"2026-10-02",category:"report",title:"Referto ecografia addome",fileName:"Ecografia_addome.pdf",uploadedBy:"patient",origin:"Paziente",description:"Caricato dal paziente",unread:true,file:null},
      {id:"doc-a-sep",date:"2026-09-12",category:"analysis",title:"Analisi sangue settembre",fileName:"Analisi_sangue_12-09-2026.pdf",uploadedBy:"patient",origin:"Paziente",description:"Caricato dal paziente",unread:false,file:null},
      {id:"doc-r-hema",date:"2026-09-05",category:"report",title:"Referto ematochimico",fileName:"Referto_ematochimico.pdf",uploadedBy:"professional",origin:"Professionista",description:"Caricato dal professionista",unread:false,file:null},
      {id:"doc-o-q",date:"2026-08-18",category:"other",title:"Questionario iniziale",fileName:"Questionario_iniziale.pdf",uploadedBy:"professional",origin:"Professionista",description:"Caricato dal professionista",unread:false,file:null}
    ],
    laboratoryReports:[
      {id:"lab-sep",documentId:"doc-a-sep",reportDate:"2026-09-12",status:"confirmed",values:{glucose:"92",cholesterol:"187",hdl:"52",ldl:"111",triglycerides:"120",got:"24",gpt:"29",uricAcid:"5.8",creatinine:"0.96",ggt:"31",tsh:"2.1",vitaminD:"28"},notes:"Valori registrati dal referto di settembre.",updatedAt:"2026-09-12T11:00:00+02:00"}
    ],
    activities:[{id:"e1",date:"2026-09-24",type:"email",title:"Promemoria visita inviato via Email",description:"Consegna richiesta",origin:"Agenda"}],
    notes:[
      {id:"n1",createdAt:"2026-10-01T12:05:00+02:00",updatedAt:null,text:"Buona aderenza generale al percorso. Verificare la continuità del diario nei fine settimana."},
      {id:"n2",createdAt:"2026-09-12T11:30:00+02:00",updatedAt:null,text:"Prima visita completata. Il paziente appare motivato e disponibile a un percorso graduale."}
    ],
    nutritionPlans:[
      {id:"np3",title:"Piano dimagrimento – Fase 1",validFrom:"2026-10-01",fileName:"Piano_dimagrimento_Fase_1.pdf",professionalNote:"Piano aggiornato dopo il controllo di fine settembre.",uploadedAt:"2026-10-01T09:30:00+02:00",file:null},
      {id:"np2",title:"Piano iniziale",validFrom:"2026-09-01",fileName:"Piano_iniziale.pdf",professionalNote:"Prima impostazione del percorso.",uploadedAt:"2026-09-01T10:00:00+02:00",file:null},
      {id:"np1",title:"Piano riequilibrio",validFrom:"2026-07-01",fileName:"Piano_riequilibrio.pdf",professionalNote:"",uploadedAt:"2026-07-01T10:00:00+02:00",file:null}
    ],
    profile:{
      anamnesis:{
        goalWeight:85,minWeight:92,maxWeight:134,reasonableWeight:95,theoreticalWeight:80,
        objectives:"Dimagrimento graduale e sostenibile, mantenendo continuità nel diario e nelle abitudini.",
        work:"Attività lavorativa prevalentemente sedentaria.",
        activity:"Palestra e camminate 3–4 volte a settimana.",
        activityFactor:"1.375",smoking:"No",alcohol:"Occasionale",
        diagnosis:"Percorso nutrizionale per riduzione ponderale.",
        bowel:"Regolare",metabolism:"",feeg:"",impedance:"",
        family:{obesity:true,diabetes:false,hypertension:true,cardiovascular:false,dyslipidemia:false,thyroid:false},
        previousDiets:"Pregressi tentativi di dieta ipocalorica.",
        allergies:"Nessuna allergia o intolleranza riferita.",
        medications:"Nessuna integrazione nutrizionale specifica riportata.",
        giIssues:"Nessun disturbo gastrointestinale rilevante riferito.",
        pastConditions:"Nessun intervento rilevante riportato ai fini del percorso nutrizionale.",
        observations:"Monitorare la continuità del diario nei fine settimana."
      }
    },
    privacy:{consent:{status:"signed",signedAt:"2026-09-12",documentId:null},communications:{email:true},reminders:{email:true},administrativeNotes:""}
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
    diary:{days:[],updates:[],...detail.diary},documents:detail.documents||[],laboratoryReports:detail.laboratoryReports||[],documentUi:{filter:"all"},activities:detail.activities||[],notes:detail.notes||[],nutritionPlans:detail.nutritionPlans||[],
    profile:{anamnesis:{goalWeight:"",minWeight:"",maxWeight:"",reasonableWeight:"",theoreticalWeight:"",objectives:"",work:"",activity:"",activityFactor:"",smoking:"",alcohol:"",diagnosis:"",bowel:"",metabolism:"",feeg:"",impedance:"",family:{obesity:false,diabetes:false,hypertension:false,cardiovascular:false,dyslipidemia:false,thyroid:false},previousDiets:"",allergies:"",medications:"",giIssues:"",pastConditions:"",observations:""},...detail.profile},
    privacy:{consent:null,communications:{email:false},reminders:{email:false},administrativeNotes:"",...detail.privacy}
  };
  demoSession.set(id,data);
  return data;
}
