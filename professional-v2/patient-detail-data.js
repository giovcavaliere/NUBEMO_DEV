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
      {date:"2026-10-04",valid:true,confidence:"high",meals:[
        {key:"breakfast",time:"07:30",originalText:"150 g yogurt greco + 45 g biscotti",components:[
          {text:"150 g yogurt greco",kcal:145,confidence:"high"},
          {text:"45 g biscotti",kcal:205,confidence:"high"}
        ]},
        {key:"snack1",time:"10:30",originalText:"1 mela",components:[{text:"1 mela",kcal:80,confidence:"medium"}]},
        {key:"lunch",time:"13:00",originalText:"80 g pasta al pomodoro + 120 g pollo + insalata + 10 g olio",components:[
          {text:"80 g pasta al pomodoro",kcal:310,confidence:"high"},
          {text:"120 g pollo alla griglia",kcal:200,confidence:"high"},
          {text:"Insalata con pomodori",kcal:60,confidence:"medium"},
          {text:"10 g olio extravergine di oliva",kcal:90,confidence:"high"}
        ]},
        {key:"snack2",time:"16:30",originalText:"10 g mandorle",components:[{text:"10 g mandorle",kcal:58,confidence:"high"}]},
        {key:"dinner",time:"20:00",originalText:"2 fette pane integrale + 80 g tonno + insalata con olive verdi + 1 cucchiaio olio",components:[
          {text:"2 fette pane integrale",kcal:150,confidence:"medium"},
          {text:"80 g tonno al naturale",kcal:93,confidence:"high"},
          {text:"Insalata con olive verdi",kcal:85,confidence:"medium"},
          {text:"1 cucchiaio olio extravergine",kcal:90,confidence:"medium"}
        ]}
      ]},
      {date:"2026-10-03",valid:false,confidence:"low",meals:[
        {key:"breakfast",time:"08:00",originalText:"caffè e brioche",components:[
          {text:"Caffè",kcal:null,confidence:"low"},
          {text:"Brioche",kcal:null,confidence:"low",status:"unresolved"}
        ]},
        {key:"dinner",time:"20:30",originalText:"aperitivo con amici",components:[
          {text:"Aperitivo con amici",kcal:null,confidence:"low",status:"unresolved"}
        ]}
      ]},
      {date:"2026-10-02",valid:true,confidence:"medium",meals:[
        {key:"breakfast",time:"07:40",originalText:"yogurt greco con cereali e banana",components:[
          {text:"Yogurt greco",kcal:150,confidence:"medium"},
          {text:"Cereali",kcal:120,confidence:"medium"},
          {text:"Banana",kcal:105,confidence:"medium"}
        ]},
        {key:"lunch",time:"13:15",originalText:"100 g salmone affumicato + 80 g pane integrale",components:[
          {text:"100 g salmone affumicato",kcal:180,confidence:"high"},
          {text:"80 g pane integrale",kcal:200,confidence:"high"}
        ]},
        {key:"dinner",time:"20:10",originalText:"150 g patate al forno con 10 g olio + verdure",components:[
          {text:"150 g patate al forno",kcal:220,confidence:"high"},
          {text:"10 g olio",kcal:90,confidence:"high"},
          {text:"Verdure",kcal:70,confidence:"medium"}
        ]}
      ]},
      {date:"2026-10-01",valid:true,confidence:"high",meals:[
        {key:"breakfast",time:"07:25",originalText:"200 ml latte + 40 g cereali",components:[
          {text:"200 ml latte parzialmente scremato",kcal:92,confidence:"high"},
          {text:"40 g cereali",kcal:150,confidence:"high"}
        ]},
        {key:"lunch",time:"13:00",originalText:"80 g riso basmati + 120 g pollo + 10 g olio",components:[
          {text:"80 g riso basmati",kcal:282,confidence:"high"},
          {text:"120 g pollo",kcal:198,confidence:"high"},
          {text:"10 g olio extravergine",kcal:90,confidence:"high"}
        ]},
        {key:"dinner",time:"20:00",originalText:"100 g mozzarella, pomodoro e 60 g pane",components:[
          {text:"100 g mozzarella",kcal:253,confidence:"high"},
          {text:"Pomodoro",kcal:35,confidence:"medium"},
          {text:"60 g pane",kcal:160,confidence:"high"}
        ]}
      ]},
      {date:"2026-09-30",valid:true,confidence:"medium",meals:[
        {key:"breakfast",time:"07:30",originalText:"2 fette pane + marmellata + caffè",components:[
          {text:"2 fette pane",kcal:150,confidence:"medium"},
          {text:"Marmellata",kcal:90,confidence:"medium"},
          {text:"Caffè",kcal:2,confidence:"medium"}
        ]},
        {key:"lunch",time:"13:10",originalText:"pasta al pomodoro con tonno e olive",components:[
          {text:"Pasta al pomodoro",kcal:390,confidence:"medium"},
          {text:"Tonno",kcal:160,confidence:"medium"},
          {text:"Olive",kcal:70,confidence:"low"}
        ]},
        {key:"dinner",time:"20:15",originalText:"petto di pollo, verdure grigliate e un filo d'olio",components:[
          {text:"Petto di pollo",kcal:250,confidence:"medium"},
          {text:"Verdure grigliate",kcal:110,confidence:"medium"},
          {text:"Un filo d'olio",kcal:45,confidence:"low"}
        ]}
      ]},
      {date:"2026-09-29",valid:true,confidence:"medium",meals:[
        {key:"breakfast",time:"07:20",originalText:"1 vasetto di yogurt + banana",components:[
          {text:"1 vasetto di yogurt",kcal:125,confidence:"medium"},
          {text:"1 banana",kcal:105,confidence:"medium"}
        ]},
        {key:"lunch",time:"12:50",originalText:"80 g pasta + 120 g pollo + salsa della nonna",components:[
          {text:"80 g pasta",kcal:285,confidence:"high"},
          {text:"120 g pollo",kcal:198,confidence:"high"},
          {text:"Salsa della nonna",kcal:null,confidence:"low",status:"unresolved"}
        ]},
        {key:"dinner",time:"20:20",originalText:"pizza margherita",components:[
          {text:"Pizza margherita",kcal:810,confidence:"medium"}
        ]}
      ]}
    ],ui:{selectedDate:"2026-10-04"},updates:[{id:"du1",date:"2026-10-04",title:"Diario aggiornato",description:"Nuove voci del diario",origin:"Paziente"}]},
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
    diary:{days:[],updates:[],...detail.diary},documents:detail.documents||[],laboratoryReports:detail.laboratoryReports||[],documentUi:{filter:"all",unreadOnly:false},activities:detail.activities||[],notes:detail.notes||[],nutritionPlans:detail.nutritionPlans||[],
    profile:{anamnesis:{goalWeight:"",minWeight:"",maxWeight:"",reasonableWeight:"",theoreticalWeight:"",objectives:"",work:"",activity:"",activityFactor:"",smoking:"",alcohol:"",diagnosis:"",bowel:"",metabolism:"",feeg:"",impedance:"",family:{obesity:false,diabetes:false,hypertension:false,cardiovascular:false,dyslipidemia:false,thyroid:false},previousDiets:"",allergies:"",medications:"",giIssues:"",pastConditions:"",observations:""},...detail.profile},
    privacy:{consent:null,communications:{email:false},reminders:{email:false},administrativeNotes:"",...detail.privacy}
  };
  demoSession.set(id,data);
  return data;
}
