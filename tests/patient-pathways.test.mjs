import test from "node:test";
import assert from "node:assert/strict";
import {capturePathwaySnapshot,getPathwayHistoryModel,pathwayDuration} from "../professional-v2/patient-pathways-model.js";
import {getPatientData} from "../professional-v2/patient-detail-data.js";
import {renderPathwayManagement} from "../professional-v2/patient-pathways-view.js";

const ended={id:"archive",status:"ended",startedAt:"2026-09-12",endedAt:"2026-10-09",objectiveLabel:"Dimagrimento"};
test("archive captures existing interval records, not other pathways or undated records",()=>{
  const data=structuredClone(getPatientData("p1"));
  data.notes.push({id:"unscoped",text:"No date"},{id:"other",createdAt:"2026-10-01",pathwayId:"other",text:"Other pathway"});
  const snapshot=capturePathwaySnapshot(data,ended);
  assert.equal(snapshot.measurements.length,6);
  assert.equal(snapshot.visits.length,3);
  assert.equal(snapshot.diary.length,6);
  assert.equal(snapshot.documents.length,3);
  assert.equal(snapshot.plans.length,1);
  assert.equal(snapshot.reports.length,1);
  assert.equal(snapshot.notes.length,2);
  data.measurements[0].weight=1;
  data.profile.anamnesis.diagnosis="Changed";
  assert.equal(snapshot.measurements[0].weight,109.4);
  assert.notEqual(snapshot.anamnesis.diagnosis,"Changed");
});
test("readonly summary reuses snapshot BMI and FFM, with no live height fallback",()=>{
  const snapshot={measurements:[{id:"one",date:"2026-09-12",weight:80,height:200,bcm:30,ecm:20},{id:"two",date:"2026-10-09",weight:79}],diary:[],documents:[],plans:[],reports:[],visits:[],notes:[]};
  const before=structuredClone(snapshot);
  const history=getPathwayHistoryModel({...ended,snapshot});
  const summary=Object.fromEntries(history.summary);
  assert.equal(summary["BMI iniziale"],"20");
  assert.equal(summary["BMI finale"],"—");
  assert.equal(summary["Variazione peso"],"-1 kg");
  assert.equal(summary["Referti"],"0");
  assert.equal(history.measurementRows[1].values.find(item=>item.key==="ffm").text,"50,0 %");
  assert.deepEqual(snapshot,before);
});
test("old summary-only archives do not invent absent values or details",()=>{
  const history=getPathwayHistoryModel({...ended,snapshotSummary:{initialWeight:null,finalWeight:null,visits:3}});
  assert.equal(history.summary.length,14);
  const summary=Object.fromEntries(history.summary);
  assert.equal(summary["Peso iniziale"],"—");
  assert.equal(summary["Variazione peso"],"—");
  assert.equal(summary["BMI finale"],"—");
  assert.equal(summary["Visite"],"3");
  assert.equal(summary["Referti"],"—");
  assert.equal(history.sections.length,8);
  assert.ok(history.sections.every(section=>section.items===null));
});
test("overview keeps only the compact list, even with old selected-history UI state",()=>{
  const data={pathways:{items:[{...ended,snapshot:{notes:[{text:"Private archived clinical detail"}]}}],ui:{historyOpen:true,selectedHistoryId:ended.id}}};
  const html=renderPathwayManagement({data});
  assert.match(html,/data-pathway-history-open="archive"/);
  assert.doesNotMatch(html,/Private archived|pathway-archive-summary|<details/);
});
test("duration is inclusive, rejects invalid/reversed intervals",()=>{
  assert.equal(pathwayDuration("2026-10-09","2026-10-09"),1);
  assert.equal(pathwayDuration("2026-10-10","2026-10-09"),null);
  assert.equal(pathwayDuration(null,"2026-10-09"),null);
});
