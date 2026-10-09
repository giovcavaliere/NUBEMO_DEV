import test from "node:test";
import assert from "node:assert/strict";
import {buildClinicalPdfData} from "../professional-v2/patient-clinical-pdf-model.js";
import {createClinicalPdf} from "../professional-v2/patient-clinical-pdf.js";
import {getPatientData} from "../professional-v2/patient-detail-data.js";
import {professionalProfile} from "../professional-v2/profile-view.js";
import {pdfFontRegular,pdfFontBold} from "../professional-v2/patient-clinical-pdf-assets.js";
import {getMeasurementsViewModel} from "../professional-v2/patient-measurements-model.js";

const encoded=text=>Array.from(text,c=>c.charCodeAt(0).toString(16).padStart(2,"0")).join("");
const pdfText=async doc=>new TextDecoder().decode(await createClinicalPdf(doc).arrayBuffer());
test("normalized data keeps diary modes and excludes application/private fields",()=>{
  const data=structuredClone(getPatientData("p1"));
  data.notes=[{text:"PRIVATE-NOTE-SENTINEL"}];
  const none=buildClinicalPdfData(data,professionalProfile);
  assert.equal(none.diary.length,0);
  assert.equal(none.latestBia.ffm,71.6);
  assert.equal(none.measurements[0].ffm,70.4);
  assert.ok(Math.abs(none.summary.initialBmi-33.7654)<.001);
  assert.equal(none.summary.currentBmiCategory,"Obesità I");
  assert.doesNotMatch(JSON.stringify(none),/PRIVATE-NOTE-SENTINEL|nubemoAccountStatus|showCaloriesToPatient/);
  data.diary.days=["2026-08-01","2026-09-20","2026-09-28","2026-10-04"].map(date=>({date,meals:[]}));
  assert.equal(buildClinicalPdfData(data,professionalProfile,{diaryMode:"7"}).diary.length,2);
  assert.equal(buildClinicalPdfData(data,professionalProfile,{diaryMode:"30"}).diary.length,3);
  assert.equal(buildClinicalPdfData(data,professionalProfile,{diaryMode:"full"}).diary.length,4);
});
test("generation remains synchronous and DOM-independent with embedded brand/fonts and valid xref",async()=>{
  const doc=buildClinicalPdfData(getPatientData("p1"),professionalProfile);
  const blob=createClinicalPdf(doc);
  assert.equal(blob.type,"application/pdf");
  const raw=new Uint8Array(await blob.arrayBuffer()),text=new TextDecoder().decode(raw);
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text,/\/Subtype \/Image/);assert.match(text,/\/FontFile2/);
  const offset=Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(new TextDecoder().decode(raw.slice(offset,offset+4)),"xref");
  assert.ok(text.includes(encoded("CLINICO-NUTRIZIONALE")));
  assert.notEqual(pdfFontRegular.widths[105],pdfFontRegular.widths[77]);
  assert.notEqual(pdfFontBold.widths[105],pdfFontBold.widths[77]);
});
test("table/text flow preserves many records, long notes, multiple labs and historical objectives",async()=>{
  const doc=buildClinicalPdfData(getPatientData("p1"),professionalProfile,{diaryMode:"full"});
  doc.measurements=Array.from({length:140},(_,i)=>({...doc.measurements[0],notes:`measurement-marker-${i}`}));
  doc.pathways=Array.from({length:70},(_,i)=>({status:"ended",startedAt:"2024-01-01",endedAt:"2024-02-01",objective:`pathway-marker-${i}`}));
  doc.labs=Array.from({length:5},(_,i)=>({date:`2026-10-0${i+1}`,values:{glucose:`lab-marker-${i}`},notes:`report-marker-${i}`}));
  doc.anamnesis.diagnosis="Long narrative. ".repeat(500)+"END-ANAMNESIS-MARKER";
  doc.diary[0].meals[0].text="Long meal narrative. ".repeat(500)+"END-DIARY-MARKER";
  const text=await pdfText(doc);
  for(const marker of ["measurement-marker-139","pathway-marker-69","lab-marker-4","report-marker-4","END-ANAMNESIS-MARKER","END-DIARY-MARKER"])assert.ok(text.includes(encoded(marker)),marker);
  assert.ok(Number(text.match(/\/Type \/Pages \/Count (\d+)/)[1])>12);
});
test("missing data, no active pathway, one reading and partial/excess BIA remain honest",async()=>{
  const sparse=buildClinicalPdfData(getPatientData("p2"),professionalProfile);
  assert.equal(sparse.activePathway,null);
  assert.equal(sparse.summary.currentBmi,null);
  const empty=await pdfText(sparse);
  assert.ok(empty.includes(encoded("Nessun percorso attivo.")));
  assert.ok(empty.includes(encoded("Anamnesi non ancora disponibile.")));
  assert.ok(empty.includes(encoded("Composizione corporea non ancora rilevata.")));
  const data=structuredClone(getPatientData("p2"));
  data.measurements=[{date:"2026-10-09",weight:80,bodyFat:70,bcm:90,ecm:20,ffm:110,muscleMass:null}];
  const text=await pdfText(buildClinicalPdfData(data,professionalProfile));
  assert.ok(text.includes(encoded("180,0%"))||text.includes(encoded("180,0%.")));
  assert.doesNotMatch(text,/NaN|Infinity/);
});
test("weight trend and its KPIs share the inclusive active-pathway interval without changing patient totals",async()=>{
  const data=structuredClone(getPatientData("p1"));
  data.pathways.items=[{status:"ended",startedAt:"2024-01-01"},{status:"active",startedAt:"2026-09-01"}];
  data.measurements=[{date:"2026-08-31",weight:100},{date:"2026-09-01",weight:"95"},{date:"2026-09-10",weight:null},{date:"2026-09-20",weight:92}];
  const doc=buildClinicalPdfData(data,professionalProfile);
  assert.deepEqual(doc.weightTrend,{measurements:[{date:"2026-09-01",weight:95},{date:"2026-09-20",weight:92}],firstWeight:95,currentWeight:92,delta:-3});
  assert.equal(doc.measurements.length,4);
  assert.equal(doc.summary.firstWeight,100);
  assert.equal(doc.summary.delta,-8);
  assert.ok((await pdfText(doc)).includes(encoded("Evoluzione del peso dall")+"92"+encoded("inizio del percorso")));
  data.pathways.items=[];
  const fallback=buildClinicalPdfData(data,professionalProfile);
  assert.equal(fallback.weightTrend.firstWeight,100);
  assert.equal(fallback.weightTrend.delta,-8);
  assert.equal(fallback.weightTrend.measurements.length,3);
  data.pathways.items=[{status:"active",startedAt:"2027-01-01"}];
  const empty=buildClinicalPdfData(data,professionalProfile);
  assert.deepEqual(empty.weightTrend,{measurements:[],firstWeight:null,currentWeight:null,delta:null});
  assert.ok((await pdfText(empty)).includes(encoded("Nessun peso disponibile per rappresentare")));
});
test("PDF BIA reuses the approved Misure bands for complete, partial and excess values",async()=>{
  for(const values of [{bodyFat:30,bcm:50,ecm:20},{bodyFat:20,bcm:null,ecm:null},{bodyFat:70,bcm:90,ecm:20},{ffm:70}]){
    const data=structuredClone(getPatientData("p2"));
    data.measurements=[{date:"2026-10-09",...values}];
    const doc=buildClinicalPdfData(data,professionalProfile);
    assert.deepEqual(doc.biaComposition.bands,getMeasurementsViewModel(data).composition.bands);
    const text=await pdfText(doc);
    assert.match(text,/ W n 0\.898 0\.902 0\.875 rg/);
    assert.doesNotMatch(text,/NaN|Infinity/);
  }
});
