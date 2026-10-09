import {pdfLogo,pdfFontRegular,pdfFontBold} from "./patient-clinical-pdf-assets.js";

// Editorial A4 layout. Coordinates below are measured from the top of the page.
// The renderer consumes normalized data only; no DOM, network or route dependencies.
const PAGE_W=595,PAGE_H=842,LEFT=42,RIGHT=553,WIDTH=RIGHT-LEFT,TOP=144,END=764;
const encoder=new TextEncoder();
const C={ink:"0.04 0.20 0.18",green:"0.11 0.36 0.29",sage:"0.43 0.60 0.46",muted:"0.39 0.47 0.43",line:"0.87 0.88 0.83",cream:"0.99 0.98 0.96",soft:"0.93 0.96 0.92",white:"1 1 1",fm:"0.93 0.65 0.35",ecm:"0.36 0.66 0.77",bcm:"0.38 0.65 0.43",mm:"0.52 0.49 0.72"};
const n=value=>Number(value).toFixed(2).replace(/0+$/g,"").replace(/\.$/,"");
const clean=value=>String(value??"—").normalize("NFC").replace(/[\r\n\t]+/g," ").replace(/\s+/g," ").trim()||"—";
const finite=value=>typeof value==="number"&&Number.isFinite(value);
const fmtNum=(value,digits=1)=>finite(value)?new Intl.NumberFormat("it-IT",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value):"—";
const fmtDate=value=>{
  if(!value) return "—";
  const d=new Date(String(value).length===10?`${value}T12:00:00`:value);
  return Number.isNaN(d.getTime())?clean(value):new Intl.DateTimeFormat("it-IT").format(d);
};
const weight=value=>finite(value)?`${fmtNum(value)} kg`:"—";
const delta=value=>finite(value)?`${value>0?"+":""}${weight(value)}`:"—";
const winAnsi={"€":128,"‚":130,"ƒ":131,"„":132,"…":133,"†":134,"‡":135,"ˆ":136,"‰":137,"Š":138,"‹":139,"Œ":140,"Ž":142,"‘":145,"’":146,"“":147,"”":148,"•":149,"–":150,"—":151,"˜":152,"™":153,"š":154,"›":155,"œ":156,"ž":158,"Ÿ":159};
const bytes=value=>Array.from(clean(value),char=>winAnsi[char]??(char.charCodeAt(0)<=255?char.charCodeAt(0):63));
const fonts={F1:pdfFontRegular,F2:pdfFontBold,F3:pdfFontRegular};
const textWidth=(value,size=9,font="F1")=>bytes(value).reduce((sum,code)=>sum+(fonts[font].widths[code]||600),0)*size/1000;
const txt=(x,top,value,size=9,font="F1",color=C.ink)=>`q ${color} rg BT /${font} ${n(size)} Tf 1 0 0 1 ${n(x)} ${n(PAGE_H-top)} Tm <${bytes(value).map(code=>code.toString(16).padStart(2,"0")).join("")}> Tj ET Q\n`;
const alignText=(x,top,value,width,size=9,font="F1",align="left",color=C.ink)=>txt(x+(align==="right"?width-textWidth(value,size,font):align==="center"?(width-textWidth(value,size,font))/2:0),top,value,size,font,color);
const line=(x1,y1,x2,y2,color=C.line,width=.5)=>`q ${color} RG ${n(width)} w ${n(x1)} ${n(PAGE_H-y1)} m ${n(x2)} ${n(PAGE_H-y2)} l S Q\n`;
const rect=(x,top,w,h,fill=C.white,stroke=null)=>`q ${fill} rg ${stroke?`${stroke} RG .5 w`:""} ${n(x)} ${n(PAGE_H-top-h)} ${n(w)} ${n(h)} re ${stroke?"B":"f"} Q\n`;
const circle=(x,top,r,fill,stroke=null)=>{
  const y=PAGE_H-top,k=r*.55228475;
  return `q ${fill} rg ${stroke?`${stroke} RG 1.4 w`:""} ${n(x+r)} ${n(y)} m ${n(x+r)} ${n(y+k)} ${n(x+k)} ${n(y+r)} ${n(x)} ${n(y+r)} c ${n(x-k)} ${n(y+r)} ${n(x-r)} ${n(y+k)} ${n(x-r)} ${n(y)} c ${n(x-r)} ${n(y-k)} ${n(x-k)} ${n(y-r)} ${n(x)} ${n(y-r)} c ${n(x+k)} ${n(y-r)} ${n(x+r)} ${n(y-k)} ${n(x+r)} ${n(y)} c ${stroke?"B":"f"} Q\n`;
};
const logo=(x,top,size)=>`q ${n(size)} 0 0 ${n(size)} ${n(x)} ${n(PAGE_H-top-size)} cm /Logo Do Q\n`;

function wrap(value,width,size=9,font="F1"){
  const words=clean(value).split(" "),lines=[];let current="";
  for(const word of words){
    if(textWidth(current?`${current} ${word}`:word,size,font)<=width){current=current?`${current} ${word}`:word;continue}
    if(current){lines.push(current);current=""}
    // Split even an unbroken filename/email; never silently clip a long token.
    let part="";
    for(const char of word){if(part&&textWidth(part+char,size,font)>width){lines.push(part);part=""}part+=char}
    current=part;
  }
  if(current) lines.push(current);
  return lines.length?lines:["—"];
}
function paragraph(x,top,value,width,size=9,font="F1",color=C.ink,leading=size*1.45){
  const lines=wrap(value,width,size,font);
  return {stream:lines.map((value,i)=>txt(x,top+i*leading,value,size,font,color)).join(""),height:lines.length*leading};
}
function pageHeader(title,subtitle,sectionNo,continued=false){
  let s=rect(0,0,PAGE_W,PAGE_H,C.cream)+rect(LEFT,40,4,34,C.green)+logo(RIGHT-32,38,32);
  s+=txt(LEFT+14,48,`NUBEMO  /  ${sectionNo}`,8,"F2",C.muted);
  const heading=paragraph(LEFT+14,74,title,WIDTH-62,21,"F2");s+=heading.stream;
  s+=txt(LEFT,113,continued?"Continua dalla pagina precedente":subtitle,8.5,"F1",C.muted);
  return s+line(LEFT,127,RIGHT,127);
}
function footer(doc,pageNo,pageCount){
  const patient=wrap(doc.patient.name||"Paziente",170,7.2)[0];
  return line(LEFT,790,RIGHT,790)+txt(LEFT,807,patient,7.2,"F2",C.muted)+alignText(LEFT+174,807,"NUBEMO · Cartella clinico-nutrizionale",230,7,"F1","center",C.muted)+alignText(RIGHT-52,807,`${pageNo} / ${pageCount}`,52,7.2,"F2","right",C.muted)+txt(LEFT,822,"Documento riservato",6.5,"F1",C.muted);
}
function metrics(values,top=TOP){
  const gap=10,w=(WIDTH-gap*(values.length-1))/values.length;
  return values.map(([label,value,tone],i)=>{
    const x=LEFT+i*(w+gap),size=Math.min(20,(w-20)/Math.max(1,textWidth(value,1,"F2")));
    return rect(x,top,w,76,C.white,C.line)+rect(x,top,w,3,tone||C.green)+txt(x+11,top+25,label,8,"F1",C.muted)+txt(x+11,top+55,value,size,"F2",tone||C.ink);
  }).join("");
}

// One flow engine for every text/table section. Continuations repeat the page
// identity and table headings; even a single oversized cell is split safely.
class Flow{
  constructor(title,subtitle,number){this.title=title;this.subtitle=subtitle;this.number=number;this.pages=[];this.page=pageHeader(title,subtitle,number);this.y=TOP;this.currentSection=null}
  next(){this.pages.push(this.page);this.page=pageHeader(this.title,this.subtitle,this.number,true);this.y=TOP;if(this.currentSection)this.band(`${this.currentSection} (segue)`)}
  ensure(height){if(this.y+height>END)this.next()}
  band(title){this.page+=rect(LEFT,this.y,WIDTH,28,C.soft)+txt(LEFT+10,this.y+18,title,10,"F2",C.green);this.y+=40}
  section(title){this.currentSection=null;this.ensure(62);this.currentSection=title;this.band(title)}
  text(value,{x=LEFT,width=WIDTH,size=10,font="F1",color=C.ink,leading=size*1.45}={}){
    const lines=wrap(value,width,size,font);
    lines.forEach(value=>{this.ensure(leading+4);this.page+=txt(x,this.y+size,value,size,font,color);this.y+=leading});this.y+=8;
  }
  note(value){
    const lines=wrap(value,WIDTH-24,9);let offset=0;
    while(offset<lines.length){this.ensure(32);const count=Math.min(lines.length-offset,Math.floor((END-this.y-18)/13));this.page+=rect(LEFT,this.y,WIDTH,count*13+18,C.soft);for(let i=0;i<count;i++)this.page+=txt(LEFT+12,this.y+16+i*13,lines[offset+i],9,"F1",C.muted);this.y+=count*13+28;offset+=count}
  }
  table(headers,rows,widths,{size=8.5,aligns=[],labelColumn=true}={}){
    const head=()=>{
      const lines=headers.map((value,i)=>wrap(value,widths[i]-16,size,"F2")),height=Math.max(...lines.map(parts=>parts.length))*12+16;
      this.ensure(height+30);this.page+=rect(LEFT,this.y,WIDTH,height,C.soft);let x=LEFT;
      lines.forEach((parts,i)=>{parts.forEach((part,j)=>this.page+=alignText(x+8,this.y+15+j*12,part,widths[i]-16,size,"F2",aligns[i]||"left",C.green));x+=widths[i]});this.y+=height;
    };
    if(headers)head();
    rows.forEach((cells,rowIndex)=>{
      const lines=cells.map((value,i)=>wrap(value,widths[i]-16,size,labelColumn&&i===0?"F2":"F1"));
      const total=Math.max(...lines.map(parts=>parts.length));let offset=0;
      while(offset<total){
        if(this.y+28>END){this.next();if(headers)head()}
        const available=Math.max(1,Math.floor((END-this.y-14)/12)),count=Math.min(total-offset,available),height=count*12+14;
        this.page+=rect(LEFT,this.y,WIDTH,height,rowIndex%2?"0.965 0.973 0.957":C.white)+line(LEFT,this.y+height,RIGHT,this.y+height);
        let x=LEFT;
        lines.forEach((parts,i)=>{for(let j=0;j<count;j++){const value=parts[offset+j]??(offset>0&&i===0&&j===0?parts[0]:undefined);if(value!==undefined)this.page+=alignText(x+8,this.y+15+j*12,value,widths[i]-16,size,labelColumn&&i===0?"F2":"F1",aligns[i]||"left",i===0?C.ink:C.muted)}x+=widths[i]});
        this.y+=height;offset+=count;
        if(offset<total){this.next();if(headers)head()}
      }
    });
    this.y+=16;
  }
  fields(rows){this.table(null,rows,[176,335],{size:9})}
  finish(){return [...this.pages,this.page]}
}

function cover(doc){
  const p=doc.patient,pr=doc.professional;
  const f=new Flow("Cartella clinico-nutrizionale","Dati identificativi del documento","00");
  let s=rect(0,0,PAGE_W,PAGE_H,C.cream)+rect(0,0,15,PAGE_H,C.green)+rect(15,0,3,PAGE_H,C.sage);
  s+=logo(LEFT,45,70)+txt(LEFT+86,76,"NUBEMO",25,"F2",C.green)+txt(LEFT+86,98,"Il tuo percorso, ogni giorno.",10,"F3",C.muted)+line(LEFT,137,RIGHT,137);
  s+=txt(LEFT,195,"CARTELLA",11,"F2",C.muted)+txt(LEFT,229,"CLINICO-NUTRIZIONALE",25,"F2",C.ink)+rect(LEFT,247,68,3,C.sage);
  f.page=s;f.y=277;
  f.text(p.name||"Paziente",{size:30,font:"F2",leading:38});
  const demographics=[p.birthDate?`Data di nascita ${fmtDate(p.birthDate)}`:null,p.age!=null?`${p.age} anni`:null,finite(p.height)?`${fmtNum(p.height,0)} cm`:null].filter(Boolean).join(" · ");
  f.text(demographics||"Dati anagrafici non disponibili",{size:10,color:C.muted});
  f.y+=8;f.text(`Documento generato il ${fmtDate(doc.generatedAt)}`,{size:9,color:C.muted});
  const blockTop=Math.max(470,f.y+30);
  const fields=[pr.displayName||"Professionista",pr.qualification,pr.address,[pr.phone,pr.email].filter(Boolean).join(" · ")].filter(Boolean);
  const blocks=fields.map((value,i)=>({lines:wrap(value,WIDTH-40,i===0?17:10,i===0?"F2":"F1"),size:i===0?17:10}));
  const blockHeight=56+blocks.reduce((sum,block)=>sum+block.lines.length*(block.size===17?22:15)+8,0);
  if(blockTop+blockHeight<=END){
    f.page+=rect(LEFT,blockTop,WIDTH,blockHeight,C.soft)+rect(LEFT,blockTop,3,blockHeight,C.sage)+txt(LEFT+20,blockTop+27,"A CURA DI",8.5,"F2",C.green);
    let by=blockTop+55;
    blocks.forEach((block,i)=>{block.lines.forEach(value=>{f.page+=txt(LEFT+20,by,value,block.size,i===0?"F2":"F1",i===0?C.ink:C.muted);by+=i===0?22:15});by+=8});
  }else{
    f.y=Math.min(f.y+30,END);f.section("A CURA DI");
    fields.forEach((value,i)=>f.text(value,{size:i===0?17:10,font:i===0?"F2":"F1",color:i===0?C.ink:C.muted}));
  }
  return f.finish();
}
function profilePages(doc){
  const p=doc.patient,a=doc.anamnesis,su=doc.summary;
  const f=new Flow("Profilo e sintesi","La situazione del paziente, in un colpo d’occhio","01");
  f.page+=metrics([["Peso iniziale",weight(su.firstWeight)],["Peso attuale",weight(su.currentWeight)],["Variazione",delta(su.delta),C.sage],["BMI attuale",fmtNum(su.currentBmi)]]);f.y+=100;
  f.section("Dati del paziente");
  f.fields([["Data di nascita",fmtDate(p.birthDate)],["Età",p.age==null?null:`${p.age} anni`],["Sesso",p.sex],["Altezza",finite(p.height)?`${fmtNum(p.height,0)} cm`:null],
    ["Peso obiettivo",a.goalWeight!=null&&a.goalWeight!==""?`${a.goalWeight} kg`:null],["Peso minimo storico",a.minWeight!=null&&a.minWeight!==""?`${a.minWeight} kg`:null],
    ["Peso massimo storico",a.maxWeight!=null&&a.maxWeight!==""?`${a.maxWeight} kg`:null],["Peso ragionevole / concordato",a.reasonableWeight!=null&&a.reasonableWeight!==""?`${a.reasonableWeight} kg`:null],
    ["BMI iniziale",fmtNum(su.initialBmi)],["Categoria BMI attuale",su.currentBmiCategory]]);
  f.note("La categoria BMI è un’etichetta informativa derivata dal valore disponibile.");
  renderPathways(f,doc);
  return f.finish();
}
function renderPathways(f,doc){
  f.section("Percorso attuale e storico");
  const active=doc.activePathway,ended=doc.pathways.filter(item=>item.status==="ended");
  if(!active)f.note("Nessun percorso attivo.");
  const rows=[...(active?[[fmtDate(active.startedAt),"—",active.objective,"In corso"]]:[]),...ended.map(item=>[fmtDate(item.startedAt),fmtDate(item.endedAt),item.objective,"Concluso"])];
  if(rows.length)f.table(["Inizio","Fine","Obiettivo","Stato"],rows,[85,85,260,81]);
  else f.note("Nessun percorso concluso disponibile.");
}
function anamnesisPages(doc){
  const a=doc.anamnesis||{},kg=value=>value===null||value===undefined||value===""?null:`${value} kg`;
  const activity={1.2:"Sedentario",1.375:"Leggermente attivo",1.55:"Moderatamente attivo",1.725:"Molto attivo",1.9:"Estremamente attivo"}[String(a.activityFactor)]||a.activityFactor;
  const groups=[
    ["Obiettivi e storia del peso",[["Obiettivi",a.objectives],["Peso obiettivo",kg(a.goalWeight)],["Peso minimo storico",kg(a.minWeight)],["Peso massimo storico",kg(a.maxWeight)],["Peso concordato",kg(a.reasonableWeight)],["Peso teorico",kg(a.theoreticalWeight)]]],
    ["Stile di vita",[["Attività lavorativa",a.work],["Attività fisica abituale",a.activity],["Livello attività",activity],["Fumo",a.smoking],["Alcol",a.alcohol]]],
    ["Dati clinici",[["Diagnosi / motivo",a.diagnosis],["Alvo",a.bowel],["Metabolismo basale",a.metabolism],["FEEG / fabbisogno",a.feeg],["Impedenziometria",a.impedance]]],
    ["Familiarità",[["Condizioni riferite",a.familyText||"Non indicate"]]],
    ["Anamnesi patologica",[["Diete pregresse",a.previousDiets],["Allergie / intolleranze",a.allergies],["Farmaci / integrazione",a.medications],["Disturbi gastrointestinali",a.giIssues],["Patologie / interventi pregressi",a.pastConditions],["Osservazioni cliniche",a.observations]]]
  ];
  const f=new Flow("Anamnesi","Quadro clinico-nutrizionale disponibile","02");
  const hasFields=groups.filter(([title])=>title!=="Familiarità").some(([,fields])=>fields.some(([,value])=>value!==null&&value!==undefined&&value!==""));
  if(!hasFields&&!a.familyText){f.note("Anamnesi non ancora disponibile.");return f.finish()}
  groups.forEach(([title,fields])=>{f.section(title);f.fields(fields)});return f.finish();
}
function measurePages(doc){
  const f=new Flow("Antropometria e misure","Rilevazioni professionali · peso in kg, circonferenze in cm, BIA in %","03");
  if(!doc.measurements.length){f.note("Nessuna misurazione disponibile.");return f.finish()}
  f.table(["Data","Peso","Vita","Fianchi","FFM","FM","MM","ECM","BCM"],doc.measurements.map(m=>[fmtDate(m.date),...['weight','waist','hips','ffm','bodyFat','muscleMass','ecm','bcm'].map(key=>fmtNum(m[key]))]),[79,54,54,54,54,54,54,54,54],{size:8,aligns:["left",...Array(8).fill("right")]});
  const notes=doc.measurements.filter(item=>item.notes);
  if(notes.length){f.section("Note alle rilevazioni");f.fields(notes.map(item=>[fmtDate(item.date),item.notes]))}
  return f.finish();
}
function labPages(doc){
  const f=new Flow("Esami ematici","Confronto degli ultimi referti disponibili","04");
  if(!doc.labs.length){f.note("Nessun referto ematico disponibile.");return f.finish()}
  const parameters=[["glucose","Glicemia"],["cholesterol","Colesterolo"],["hdl","HDL"],["ldl","LDL"],["triglycerides","Trigliceridi"],["got","GOT"],["gpt","GPT"],["uricAcid","Acido urico"],["creatinine","Creatinina"],["ggt","Gamma GT"],["tsh","TSH"],["vitaminD","Vitamina D"]];
  const w=(WIDTH-151)/doc.labs.length;
  f.table(["Parametro",...doc.labs.map(item=>fmtDate(item.date))],parameters.map(([key,label])=>[label,...doc.labs.map(item=>item.values[key])]),[151,...doc.labs.map(()=>w)],{size:8.5,aligns:["left",...doc.labs.map(()=>"right")]});
  const notes=doc.labs.filter(item=>item.notes);
  if(notes.length){f.section("Note ai referti");f.fields(notes.map(item=>[fmtDate(item.date),item.notes]))}
  return f.finish();
}
function weightChart(rows){
  const points=rows.filter(row=>finite(row.weight)&&Number.isFinite(Date.parse(row.date)));
  if(!points.length)return null;
  const values=points.map(row=>row.weight),minimum=Math.min(...values),maximum=Math.max(...values),pad=Math.max(1,(maximum-minimum)*.18);
  const lo=minimum-pad,hi=maximum+pad,x0=LEFT+51,x1=RIGHT-23,y0=594,y1=326;
  const dates=points.map(row=>Date.parse(row.date)),first=dates[0],last=dates.at(-1);
  const x=i=>last===first?(x0+x1)/2:x0+(dates[i]-first)/(last-first)*(x1-x0),y=value=>y0-(value-lo)/(hi-lo)*(y0-y1);
  let s=rect(LEFT,262,WIDTH,386,C.white,C.line)+txt(LEFT+18,288,"Il peso nel tempo",12,"F2")+txt(LEFT+18,309,"kg",8,"F1",C.muted);
  for(let i=0;i<5;i++){const value=lo+(hi-lo)*i/4,yy=y(value);s+=line(x0,yy,x1,yy)+alignText(LEFT+8,yy+3,fmtNum(value),34,8,"F1","right",C.muted)}
  if(points.length>1){
    const area=points.map((point,i)=>`${n(x(i))} ${n(PAGE_H-y(point.weight))} ${i?"l":"m"}`).join(" ");
    s+=`q ${C.soft} rg ${area} ${n(x(points.length-1))} ${n(PAGE_H-y0)} l ${n(x(0))} ${n(PAGE_H-y0)} l h f Q\n`;
    s+=`q ${C.green} RG 1.8 w 1 J 1 j ${area} S Q\n`;
  }
  points.forEach((point,i)=>{if(points.length<60||i===0||i===points.length-1)s+=circle(x(i),y(point.weight),3,C.white,C.green)});
  const candidates=[...new Set(Array.from({length:Math.min(5,points.length)},(_,i)=>Math.round(i*(points.length-1)/Math.max(1,Math.min(5,points.length)-1))))];
  const indices=[];
  candidates.forEach(i=>{if(!indices.length||x(i)-x(indices.at(-1))>=68)indices.push(i)});
  const lastIndex=points.length-1;
  if(indices.at(-1)!==lastIndex&&last!==first){if(indices.length>1&&x(lastIndex)-x(indices.at(-1))<68)indices.pop();if(x(lastIndex)-x(indices.at(-1))>=68)indices.push(lastIndex)}
  indices.forEach(i=>{s+=line(x(i),y0,x(i),y0+4,C.muted)+alignText(x(i)-30,y0+23,fmtDate(points[i].date),60,7.5,"F1","center",C.muted)});
  return s;
}
function trendPages(doc){
  const su=doc.summary,f=new Flow("Andamento peso","Evoluzione longitudinale delle rilevazioni disponibili","05");
  f.page+=metrics([["Prima rilevazione",weight(su.firstWeight)],["Ultima rilevazione",weight(su.currentWeight)],["Variazione",delta(su.delta),C.sage]]);f.y=TOP+100;
  const chart=weightChart(doc.measurements);
  if(chart){f.page+=chart;f.y=674;f.note(doc.measurements.filter(item=>finite(item.weight)).length===1?"Una sola rilevazione disponibile: il punto indica il peso registrato, senza stimare un andamento.":"Il grafico mantiene le date reali delle rilevazioni. La scala verticale segue l’intervallo dei pesi disponibili.")}
  else f.note("Nessun peso disponibile per rappresentare l’andamento.");
  return f.finish();
}
function biaPages(doc){
  const b=doc.latestBia,f=new Flow("Composizione corporea","Analisi BIA · ultima rilevazione disponibile","06");
  if(!b){f.note("Composizione corporea non ancora rilevata.");return f.finish()}
  f.note(`Rilevazione del ${fmtDate(b.date)} · valori percentuali disponibili`);
  const components=[["FFM","Massa magra",b.ffm,C.green],["FM","Massa grassa",b.bodyFat,C.fm],["MM","Massa muscolare",b.muscleMass,C.mm],["ECM","Massa extracellulare",b.ecm,C.ecm],["BCM","Massa cellulare",b.bcm,C.bcm]];
  const w=(WIDTH-4*8)/5;
  components.forEach(([label,description,value,color],i)=>{
    const x=LEFT+i*(w+8),top=f.y;
    f.page+=rect(x,top,w,100,C.white,C.line)+rect(x,top,w,3,color)+txt(x+10,top+25,label,10,"F2",color)+txt(x+10,top+55,finite(value)?`${fmtNum(value)}%`:"—",18,"F2")+paragraph(x+10,top+76,description,w-20,7.5,"F1",C.muted,10).stream;
  });
  f.y+=124;
  const chartTop=f.y;
  f.page+=rect(LEFT,chartTop,WIDTH,305,C.white,C.line)+txt(LEFT+18,chartTop+27,"Due letture complementari",12,"F2")+txt(LEFT+18,chartTop+46,"Scala di riferimento 0–100%",8,"F1",C.muted);
  const base=chartTop+240,h=160,chartLeft=LEFT+42,stackW=64;
  const stacks=[["FFM / FM",[["FFM",b.ffm,C.green],["FM",b.bodyFat,C.fm]]],["BCM / ECM",[["BCM",b.bcm,C.bcm],["ECM",b.ecm,C.ecm]]]];
  const ceiling=Math.max(100,...stacks.map(([,segments])=>segments.reduce((sum,[,value])=>sum+(finite(value)?value:0),0)));
  const unit=h/ceiling;
  for(let tick=0;tick<=100;tick+=20){const yy=base-unit*tick;f.page+=txt(LEFT+12,yy+3,String(tick),7,"F1",C.muted)+line(chartLeft-5,yy,chartLeft+stackW*2+40,yy)}
  stacks.forEach(([label,segments],i)=>{
    const x=chartLeft+i*(stackW+32),total=segments.reduce((sum,[,value])=>sum+(finite(value)?value:0),0);let offset=0;
    f.page+=rect(x,base-100*unit,stackW,100*unit,C.cream,C.line);
    segments.forEach(([name,value,color])=>{
      if(!finite(value))return;
      if(value>0){f.page+=rect(x,base-(offset+value)*unit,stackW,value*unit,color);if(value*unit>=27)f.page+=alignText(x,base-(offset+value/2)*unit+3,fmtNum(value),stackW,9,"F2","center",name==="FFM"?C.white:C.ink)}
      offset+=value;
    });
    f.page+=alignText(x-8,base+21,label,stackW+16,9,"F2","center");
    if(total>100)f.page+=alignText(x-6,base-h-12,`Totale ${fmtNum(total)}%`,stackW+12,7,"F2","center",C.muted);
  });
  let ly=chartTop+92;
  components.forEach(([label,description,value,color])=>{f.page+=circle(LEFT+289,ly-3,3.5,color)+txt(LEFT+302,ly,label,9,"F2",color)+alignText(LEFT+342,ly,finite(value)?`${fmtNum(value)} %`:"—",WIDTH-354,9,"F2","right");ly+=31});
  f.y=chartTop+327;
  const complete=[b.bodyFat,b.ecm,b.bcm].every(finite),total=complete?b.bodyFat+b.ecm+b.bcm:null;
  f.note(`${finite(b.bcm)&&finite(b.ecm)?"FFM = BCM + ECM.":"FFM registrata, quando disponibile."} ${total>100?`FM + ECM + BCM = ${fmtNum(total)}%. Nessuna normalizzazione: l’eccedenza si estende oltre il riferimento 100%.`:"I campi mancanti non sono stimati. Le pile non implicano che la somma delle componenti sia pari a 100%."}`);
  return f.finish();
}
function diaryPages(doc){
  const f=new Flow("Diario alimentare",doc.diaryMode==="7"?"Ultimi 7 giorni disponibili":doc.diaryMode==="30"?"Ultimi 30 giorni disponibili":"Diario completo disponibile","07");
  const labels={breakfast:"Colazione",snack1:"Spuntino mattina",lunch:"Pranzo",snack2:"Spuntino pomeriggio",dinner:"Cena"};
  doc.diary.forEach(day=>{
    f.currentSection=null;
    const height=40+day.meals.reduce((sum,meal)=>sum+14+Math.max(wrap(meal.text,319,9).length,wrap(labels[meal.key]||meal.key||"Pasto",160,9,"F2").length)*12,0);
    if(height<END-TOP)f.ensure(height+16);
    f.section(fmtDate(day.date));
    if(finite(day.weight)||day.water!=null)f.fields([["Rilevazioni associate",[finite(day.weight)?`Peso ${weight(day.weight)}`:null,day.water!=null?`Acqua ${day.water}`:null].filter(Boolean).join(" · ")]]);
    if(day.meals.length)f.fields(day.meals.map(meal=>[[labels[meal.key]||meal.key||"Pasto",meal.time].filter(Boolean).join(" · "),meal.text]));else f.note("Nessun pasto disponibile per questa giornata.");
  });return f.finish();
}

// Existing PDF object/xref serialization, with one shared logo XObject and
// WinAnsi font encoding. No second generator or browser print dependency.
function buildPdf(pageStreams){
  const objects=[];const add=value=>{objects.push(typeof value==="string"?encoder.encode(value):value);return objects.length};
  const streamObject=(body,attributes="")=>{
    const prefix=encoder.encode(`<< ${attributes} /Length ${body.length} >>\nstream\n`),suffix=encoder.encode("\nendstream");
    const merged=new Uint8Array(prefix.length+body.length+suffix.length);merged.set(prefix,0);merged.set(body,prefix.length);merged.set(suffix,prefix.length+body.length);return add(merged);
  };
  const embeddedFont=font=>{
    const data=Uint8Array.from(atob(font.data),char=>char.charCodeAt(0));
    const file=streamObject(data,`/Filter /FlateDecode /Length1 ${font.length}`);
    const descriptor=add(`<< /Type /FontDescriptor /FontName /${font.name} /Flags 32 /FontBBox [${font.bbox.join(" ")}] /ItalicAngle 0 /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.ascent} /StemV 80 /FontFile2 ${file} 0 R >>`);
    return add(`<< /Type /Font /Subtype /TrueType /BaseFont /${font.name} /Encoding /WinAnsiEncoding /FirstChar 0 /LastChar 255 /Widths [${font.widths.join(" ")}] /FontDescriptor ${descriptor} 0 R >>`);
  };
  const f1=embeddedFont(pdfFontRegular),f2=embeddedFont(pdfFontBold),f3=f1;
  const image=streamObject(Uint8Array.from(atob(pdfLogo.data),char=>char.charCodeAt(0)),`/Type /XObject /Subtype /Image /Width ${pdfLogo.width} /Height ${pdfLogo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`);
  const pagesObj=add("PAGES"),pageIds=[];
  pageStreams.forEach(stream=>{
    const content=streamObject(encoder.encode(stream));
    pageIds.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> /XObject << /Logo ${image} 0 R >> >> /Contents ${content} 0 R >>`));
  });
  objects[pagesObj-1]=encoder.encode(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] >>`);
  const catalog=add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
  const parts=[encoder.encode("%PDF-1.4\n%NUBEMO\n")],offsets=[0];let pos=parts[0].length;
  objects.forEach((obj,i)=>{offsets[i+1]=pos;const a=encoder.encode(`${i+1} 0 obj\n`),b=encoder.encode("\nendobj\n");parts.push(a,obj,b);pos+=a.length+obj.length+b.length});
  const xref=pos;let tail=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++)tail+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;
  tail+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  parts.push(encoder.encode(tail));return new Blob(parts,{type:"application/pdf"});
}

export function createClinicalPdf(doc){
  const pages=[...cover(doc),...profilePages(doc),...anamnesisPages(doc),...measurePages(doc),...labPages(doc),...trendPages(doc),...biaPages(doc)];
  if(doc.diary?.length)pages.push(...diaryPages(doc));
  return buildPdf(pages.map((stream,index)=>stream+footer(doc,index+1,pages.length)));
}
export function openClinicalPdf(blob,fileName){
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=fileName;a.target="_blank";a.rel="noopener";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
