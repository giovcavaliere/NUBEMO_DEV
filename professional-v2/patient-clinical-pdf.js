const PAGE_W=595, PAGE_H=842, LEFT=42, RIGHT=553, BOTTOM=54;
const encoder=new TextEncoder();
const clean=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[–—]/g,"-").replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x20-\x7E]/g," ");
const esc=value=>clean(value).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
const n=value=>Number(value).toFixed(2).replace(/0+$/g,"").replace(/\.$/,"");
const fmtDate=value=>{
  if(!value) return "-";
  const d=new Date(String(value).length===10?`${value}T12:00:00`:value);
  return Number.isNaN(d.getTime())?clean(value):new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
};
const fmtNum=(value,digits=1)=>value===null||value===undefined||!Number.isFinite(Number(value))?"-":Number(value).toFixed(digits).replace(".",",");
const txt=(x,y,value,size=9,font="F1")=>`BT /${font} ${n(size)} Tf ${n(x)} ${n(y)} Td (${esc(value)}) Tj ET\n`;
const line=(x1,y1,x2,y2,width=.5,gray=.82)=>`${n(gray)} G ${n(width)} w ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S 0 G\n`;
const rect=(x,y,w,h,fill=".96 .975 .95",stroke=".84 .89 .82")=>`${fill} rg ${n(x)} ${n(y)} ${n(w)} ${n(h)} re f 0 0 0 rg ${stroke} RG .45 w ${n(x)} ${n(y)} ${n(w)} ${n(h)} re S 0 G\n`;
function wrap(value,maxChars=78){
  const words=clean(value).replace(/\s+/g," ").trim().split(" ").filter(Boolean),lines=[]; let current="";
  for(const word of words){const next=current?`${current} ${word}`:word;if(next.length>maxChars&&current){lines.push(current);current=word}else current=next}
  if(current) lines.push(current);
  return lines.length?lines:["-"];
}
function footer(pageNo,pageCount){
  return line(LEFT,36,RIGHT,36,.55,.82)+txt(LEFT,22,"NUBEMO - Il tuo percorso, ogni giorno.",7.2,"F2")+txt(488,22,`Pagina ${pageNo} di ${pageCount}`,7.2);
}
function pageHeader(title,subtitle=""){
  let s=txt(LEFT,806,"NUBEMO",15,"F2")+txt(LEFT+82,807,"CARTELLA PAZIENTE",8.5,"F2");
  s+=line(LEFT,796,RIGHT,796,1,.42)+txt(LEFT,772,title,18,"F2");
  if(subtitle) s+=txt(LEFT,754,subtitle,8.5);
  return s;
}
function row(label,value,y,{height=28}={}){
  const valueLines=wrap(value,58);
  const h=Math.max(height,14+valueLines.length*10);
  let s=rect(LEFT,y-h,RIGHT-LEFT,h,".985 .99 .98",".88 .91 .86");
  s+=txt(LEFT+10,y-17,label,7.2,"F2");
  valueLines.forEach((v,i)=>s+=txt(LEFT+150,y-17-i*10,v,8.2));
  return {stream:s,y:y-h-6};
}
function sectionTitle(title,y){
  return {stream:txt(LEFT,y,title,11,"F2")+line(LEFT,y-8,RIGHT,y-8,.5,.82),y:y-22};
}
function metric(x,y,w,label,value){
  return rect(x,y,w,58,".93 .96 .91",".79 .86 .76")+txt(x+10,y+39,label,7.3)+txt(x+10,y+17,value,15,"F2");
}
function simpleTable(headers,rows,widths,startY){
  let y=startY,s="",headH=26,x=LEFT;
  s+=rect(LEFT,y-headH,RIGHT-LEFT,headH,".90 .95 .88",".74 .83 .72");
  headers.forEach((h,i)=>{s+=txt(x+5,y-17,h,6.5,"F2");x+=widths[i]});
  y-=headH;
  for(const cells of rows){
    const wrapped=cells.map((c,i)=>wrap(c,Math.max(5,Math.floor(widths[i]/4.7))));
    const lines=Math.max(1,...wrapped.map(v=>v.length)),h=Math.max(23,lines*9+7);
    if(y-h<BOTTOM+10) break;
    x=LEFT;s+=rect(LEFT,y-h,RIGHT-LEFT,h,"1 1 1",".88 .91 .86");
    wrapped.forEach((parts,i)=>{parts.forEach((part,j)=>s+=txt(x+5,y-14-j*9,part,6.4,i===0?"F2":"F1"));x+=widths[i]});
    y-=h;
  }
  return {stream:s,y:y-8};
}
function weightChart(rows){
  const points=rows.filter(r=>Number.isFinite(Number(r.weight)));
  if(points.length<2) return txt(LEFT,400,"Dati insufficienti per il grafico del peso.",9);
  const values=points.map(r=>Number(r.weight)),min=Math.min(...values),max=Math.max(...values),pad=Math.max(1,(max-min)*.15);
  const lo=min-pad,hi=max+pad,x0=72,x1=525,y0=220,y1=620;
  const x=i=>x0+i*(x1-x0)/(points.length-1), y=v=>y0+(v-lo)*(y1-y0)/(hi-lo||1);
  let s=rect(LEFT,190,RIGHT-LEFT,470,".985 .992 .98",".86 .90 .84");
  for(let i=0;i<5;i++){const val=lo+(hi-lo)*i/4,yy=y(val);s+=line(x0,yy,x1,yy,.35,.9)+txt(LEFT+4,yy-3,fmtNum(val),6.5)}
  s+=".05 .36 .29 RG 1.7 w ";
  points.forEach((p,i)=>{s+=`${n(x(i))} ${n(y(p.weight))} ${i?"l":"m"} `});s+="S 0 G\n";
  points.forEach((p,i)=>{s+=`.38 .66 .39 rg ${n(x(i)-2.5)} ${n(y(p.weight)-2.5)} 5 5 re f 0 0 0 rg\n`});
  s+=txt(x0,200,fmtDate(points[0].date),6.8)+txt(x1-58,200,fmtDate(points.at(-1).date),6.8);
  return s;
}
function biaBars(bia){
  if(!bia) return txt(LEFT,400,"Nessuna rilevazione BIA disponibile.",9);
  const entries=[["FFM",bia.ffm],["FM",bia.bodyFat],["MM",bia.muscleMass],["ECM",bia.ecm],["BCM",bia.bcm]].filter(([,v])=>Number.isFinite(Number(v)));
  if(!entries.length) return txt(LEFT,400,"Nessun valore BIA disponibile.",9);
  let s=txt(LEFT,715,`Ultima rilevazione: ${fmtDate(bia.date)}`,8.5),y=650;
  entries.forEach(([label,value])=>{
    const pct=Math.max(0,Math.min(100,Number(value))),w=(RIGHT-LEFT-120)*pct/100;
    s+=txt(LEFT,y+6,label,8,"F2")+rect(LEFT+55,y,w,20,".59 .76 .58",".59 .76 .58")+txt(RIGHT-48,y+6,`${fmtNum(value)}%`,8,"F2");
    y-=48;
  });
  return s;
}
function cover(doc){
  const p=doc.patient,pr=doc.professional;
  let s=rect(0,0,PAGE_W,PAGE_H,".97 .95 .90",".97 .95 .90");
  s+=txt(LEFT,755,"NUBEMO",24,"F2")+txt(LEFT,730,"Il tuo percorso, ogni giorno.",9,"F3");
  s+=txt(LEFT,630,"CARTELLA PAZIENTE",11,"F2")+txt(LEFT,590,p.name||"Paziente",28,"F2");
  if(p.birthDate) s+=txt(LEFT,562,`Nato/a il ${fmtDate(p.birthDate)}`,9);
  s+=line(LEFT,525,RIGHT,525,1,.55);
  s+=txt(LEFT,470,"Professionista",7.5,"F2")+txt(LEFT,446,pr.displayName||"Professionista",14,"F2");
  if(pr.qualification) s+=txt(LEFT,426,pr.qualification,8.5);
  if(pr.address) s+=txt(LEFT,406,pr.address,8);
  if(pr.phone||pr.email) s+=txt(LEFT,388,[pr.phone,pr.email].filter(Boolean).join(" - "),8);
  s+=txt(LEFT,116,`Generato il ${fmtDate(doc.generatedAt)}`,7.5)+txt(RIGHT-118,116,"Documento riservato",7.5,"F2");
  return s;
}
function profilePage(doc){
  const p=doc.patient,su=doc.summary,ap=doc.activePathway;
  let s=pageHeader("Profilo paziente","Situazione generale e percorsi"),y=710;
  const metrics=[["Peso iniziale",su.firstWeight==null?"-":`${fmtNum(su.firstWeight)} kg`],["Peso attuale",su.currentWeight==null?"-":`${fmtNum(su.currentWeight)} kg`],["Variazione",su.delta==null?"-":`${su.delta>0?"+":""}${fmtNum(su.delta)} kg`],["BMI",su.currentBmi==null?"-":fmtNum(su.currentBmi)]];
  metrics.forEach((m,i)=>s+=metric(LEFT+i*128,y,116,m[0],m[1]));y-=86;
  for(const [label,value] of [["Data di nascita",p.birthDate?fmtDate(p.birthDate):"-"],["Eta",p.age==null?"-":`${p.age} anni`],["Sesso",p.sex||"-"],["Altezza",p.height==null?"-":`${fmtNum(p.height)} cm`],["Telefono",p.phone||"-"],["Email",p.email||"-"]]){const r=row(label,value,y);s+=r.stream;y=r.y}
  const sh=sectionTitle("Percorso attuale",y);s+=sh.stream;y=sh.y;
  if(ap){for(const [label,value] of [["Stato","In corso"],["Inizio",fmtDate(ap.startedAt)],["Obiettivo",ap.objective],["Nota obiettivo",ap.objectiveNote||"-"]]){const r=row(label,value,y);s+=r.stream;y=r.y}}
  else {const r=row("Stato","Nessun percorso attivo",y);s+=r.stream;y=r.y}
  if(doc.pathways.length&&y>180){
    const st=sectionTitle("Storico percorsi",y);s+=st.stream;y=st.y;
    const rows=doc.pathways.slice(-5).reverse().map(pw=>[fmtDate(pw.startedAt),pw.endedAt?fmtDate(pw.endedAt):"-",pw.objective,pw.status==="active"?"In corso":pw.status==="pending"?"In attesa":"Concluso"]);
    const t=simpleTable(["Inizio","Fine","Obiettivo","Stato"],rows,[80,80,250,101],y);s+=t.stream;
  }
  return s;
}
function anamnesisPage(doc){
  const a=doc.anamnesis||{};
  let s=pageHeader("Profilo clinico e anamnesi",doc.activePathway?`Riferita al percorso iniziato il ${fmtDate(doc.activePathway.startedAt)}`:"Ultima anamnesi disponibile"),y=720;
  const activity={1.2:"Sedentario",1.375:"Leggermente attivo",1.55:"Moderatamente attivo",1.725:"Molto attivo",1.9:"Estremamente attivo"}[String(a.activityFactor||"")]||a.activityFactor||"";
  const fields=[["Diagnosi / motivo",a.diagnosis],["Peso obiettivo",a.goalWeight?`${a.goalWeight} kg`:""],["Peso minimo storico",a.minWeight?`${a.minWeight} kg`:""],["Peso massimo storico",a.maxWeight?`${a.maxWeight} kg`:""],["Peso ragionevole / concordato",a.reasonableWeight?`${a.reasonableWeight} kg`:""],["Peso teorico",a.theoreticalWeight?`${a.theoreticalWeight} kg`:""],["Attivita lavorativa",a.work],["Attivita fisica",a.activity],["Livello attivita",activity],["Fumo",a.smoking],["Alcol",a.alcohol],["Alvo",a.bowel],["Metabolismo basale",a.metabolism],["FEEG / fabbisogno",a.feeg],["Impedenziometria",a.impedance],["Familiarita",a.familyText],["Diete pregresse",a.previousDiets],["Allergie / intolleranze",a.allergies],["Farmaci / integrazione",a.medications],["Disturbi gastrointestinali",a.giIssues],["Patologie / interventi pregressi",a.pastConditions],["Osservazioni",a.observations],["Obiettivi",a.objectives]];
  for(const [label,value] of fields){if(y<95) break;const r=row(label,value||"-",y);s+=r.stream;y=r.y}
  return s;
}
function measuresPage(doc){
  let s=pageHeader("Antropometria, misure ed esami","Dati longitudinali del paziente"),y=720;
  const rows=doc.measurements.slice(-10).reverse().map(m=>[fmtDate(m.date),m.weight==null?"-":fmtNum(m.weight),m.waist==null?"-":fmtNum(m.waist),m.hips==null?"-":fmtNum(m.hips),m.bodyFat==null?"-":fmtNum(m.bodyFat),m.muscleMass==null?"-":fmtNum(m.muscleMass),m.ecm==null?"-":fmtNum(m.ecm),m.bcm==null?"-":fmtNum(m.bcm)]);
  const t=simpleTable(["Data","Peso","Vita","Fianchi","FM%","MM%","ECM%","BCM%"],rows.length?rows:[["-","-","-","-","-","-","-","-"]],[68,55,55,55,55,55,55,55],y);s+=t.stream;y=t.y-10;
  if(y>220){
    const st=sectionTitle("Esami ematici - ultimo referto",y);s+=st.stream;y=st.y;
    const keys=[["glucose","Glicemia"],["cholesterol","Colesterolo"],["hdl","HDL"],["ldl","LDL"],["triglycerides","Trigliceridi"],["got","GOT"],["gpt","GPT"],["uricAcid","Acido urico"],["creatinine","Creatinina"],["ggt","Gamma GT"],["tsh","TSH"],["vitaminD","Vitamina D"]];
    const lab=doc.labs.at(-1);
    if(lab){
      s+=txt(LEFT,y,`Referto del ${fmtDate(lab.date)}`,7.5,"F2");y-=18;
      for(const [key,label] of keys){if(y<92) break;const r=row(label,lab.values?.[key]??"-",y,{height:24});s+=r.stream;y=r.y}
      if(lab.notes&&y>90){const r=row("Note",lab.notes,y);s+=r.stream}
    }else s+=txt(LEFT,y,"Nessun esame ematico disponibile.",9);
  }
  return s;
}
function trendPage(doc){
  const su=doc.summary;let s=pageHeader("Andamento peso","Evoluzione longitudinale delle rilevazioni");
  s+=metric(LEFT,684,150,"Prima rilevazione",su.firstWeight==null?"-":`${fmtNum(su.firstWeight)} kg`);
  s+=metric(LEFT+172,684,150,"Ultima rilevazione",su.currentWeight==null?"-":`${fmtNum(su.currentWeight)} kg`);
  s+=metric(LEFT+344,684,150,"Variazione",su.delta==null?"-":`${su.delta>0?"+":""}${fmtNum(su.delta)} kg`);
  s+=weightChart(doc.measurements);
  return s;
}
function biaPage(doc){return pageHeader("Analisi BIA","Composizione corporea - ultima rilevazione disponibile")+biaBars(doc.latestBia)}
function diaryPages(doc){
  const pages=[];let s=pageHeader("Diario alimentare",doc.diaryMode==="7"?"Ultimi 7 giorni":doc.diaryMode==="30"?"Ultimi 30 giorni":"Diario completo"),y=720;
  const labels={breakfast:"Colazione",snack1:"Spuntino mattina",lunch:"Pranzo",snack2:"Spuntino pomeriggio",dinner:"Cena"};
  for(const day of doc.diary){
    const needed=45+(day.meals||[]).reduce((sum,m)=>sum+18+wrap(m.text,65).length*9,0);
    if(y-needed<75){pages.push(s);s=pageHeader("Diario alimentare","Continuazione");y=720}
    s+=rect(LEFT,y-30,RIGHT-LEFT,30,".91 .96 .89",".77 .85 .74")+txt(LEFT+10,y-19,fmtDate(day.date),9,"F2");y-=38;
    for(const meal of day.meals||[]){
      const lines=wrap(meal.text||"-",64),h=Math.max(25,10+lines.length*9);
      s+=txt(LEFT+8,y-14,labels[meal.key]||meal.key||"Pasto",7,"F2");
      lines.forEach((v,i)=>s+=txt(LEFT+145,y-14-i*9,v,7.2));
      y-=h;
    }
    y-=10;
  }
  pages.push(s);
  return pages;
}
function buildPdf(pageStreams){
  const objects=[];const add=value=>{objects.push(typeof value==="string"?encoder.encode(value):value);return objects.length};
  const f1=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const f2=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const f3=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>");
  const pagesObj=add("PAGES");
  const pageIds=[];
  pageStreams.forEach(stream=>{
    const body=encoder.encode(stream);
    const prefix=encoder.encode(`<< /Length ${body.length} >>\nstream\n`),suffix=encoder.encode("\nendstream");
    const merged=new Uint8Array(prefix.length+body.length+suffix.length);merged.set(prefix,0);merged.set(body,prefix.length);merged.set(suffix,prefix.length+body.length);
    const content=add(merged);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> /Contents ${content} 0 R >>`));
  });
  objects[pagesObj-1]=encoder.encode(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] >>`);
  const catalog=add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
  const parts=[encoder.encode("%PDF-1.4\n%NUBEMO\n")],offsets=[0];let pos=parts[0].length;
  objects.forEach((obj,i)=>{offsets[i+1]=pos;const a=encoder.encode(`${i+1} 0 obj\n`),b=encoder.encode("\nendobj\n");parts.push(a,obj,b);pos+=a.length+obj.length+b.length});
  const xref=pos;let tail=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++) tail+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;
  tail+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  parts.push(encoder.encode(tail));
  return new Blob(parts,{type:"application/pdf"});
}

export function createClinicalPdf(doc){
  const pages=[cover(doc),profilePage(doc),anamnesisPage(doc),measuresPage(doc),trendPage(doc),biaPage(doc)];
  if(doc.diary?.length) pages.push(...diaryPages(doc));
  return buildPdf(pages.map((stream,index)=>stream+footer(index+1,pages.length)));
}
export function openClinicalPdf(blob,fileName){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=fileName;a.target="_blank";a.rel="noopener";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
