import test from "node:test";
import assert from "node:assert/strict";
import {getPatientData} from "../professional-v2/patient-detail-data.js";
import {getPatientOverviewKPIs,buildJourneyTimeline,getWeeklyFocus,getWeightSeries,getLatestComposition,getPatientViewModel} from "../professional-v2/patient-detail-model.js";
import {renderPatientDetail} from "../professional-v2/patient-detail-view.js";

const now=new Date("2026-10-05T12:00:00+02:00");

test("overview derives KPI values from records and orders the next appointment",()=>{
  const data=getPatientData("p1");
  const kpis=getPatientOverviewKPIs(data,{now});
  assert.equal(kpis.initialWeight,109.4);
  assert.equal(kpis.currentWeight,106.6);
  assert.ok(Math.abs(kpis.change+2.8)<1e-8);
  assert.equal(kpis.adherence.completed,5);
  assert.equal(kpis.adherence.percentage,71);
  assert.equal(kpis.completedVisits,3);
  assert.equal(kpis.nextAppointment.id,"a1");
  assert.equal(getPatientViewModel(data,{now}).age,47);
});

test("timeline and focus adapt to sparse patient data",()=>{
  const sparse=getPatientData("p2");
  assert.deepEqual(buildJourneyTimeline(sparse,{now}),[]);
  assert.deepEqual(getWeeklyFocus(sparse,{now}),[]);
  assert.deepEqual(getWeightSeries(sparse),[]);
  assert.equal(getLatestComposition(sparse).lastBiaDate,null);
  const one={...sparse,journey:{startedAt:"2026-09-01",plans:[]},measurements:[{date:"2026-09-02",weight:80}],visits:[{date:"2026-09-01",status:"completed",type:"first",title:"Prima visita"}]};
  assert.equal(getWeightSeries(one).length,1);
  assert.deepEqual(buildJourneyTimeline(one,{now}).map(item=>item.type),["start","first-visit"]);
  assert.equal(getPatientOverviewKPIs(one,{now}).change,0);
});

test("timeline stays bounded; focus only uses diary, documents or visit preparation",()=>{
  const base=getPatientData("p1");
  const many={...base,visits:Array.from({length:20},(_,i)=>({date:`2026-09-${String(i+1).padStart(2,"0")}`,status:"completed",type:"control",title:`Controllo ${i+1}`}))};
  const timeline=buildJourneyTimeline(many,{now});
  assert.ok(timeline.length<=5);
  assert.equal(timeline.at(-1).status,"upcoming");
  const focus=getWeeklyFocus(base,{now});
  assert.ok(focus.length<=3);
  assert.ok(focus.every(item=>["diary","document","appointment","measure"].includes(item.type)));
  assert.ok(focus.every(item=>item.title && item.description && item.targetRoute));
});

test("shared header and tab links render for both views, including sparse records",()=>{
  const root={innerHTML:"",querySelectorAll:()=>[],querySelector:()=>null};
  const data=getPatientData("p1");
  renderPatientDetail(root,getPatientViewModel(data,{now}),"panoramica");
  assert.match(root.innerHTML,/href="#patient\/p1\/profilo"/);
  assert.match(root.innerHTML,/Percorso in sintesi/);
  assert.match(root.innerHTML,/Ultimo controllo/);
  renderPatientDetail(root,getPatientViewModel(data,{now}),"profilo");
  assert.match(root.innerHTML,/href="#patient\/p1\/panoramica"/);
  assert.match(root.innerHTML,/Dati amministrativi/);
  assert.doesNotMatch(root.innerHTML,/SMS|WhatsApp/);
  renderPatientDetail(root,getPatientViewModel(getPatientData("p2"),{now}),"panoramica");
  assert.match(root.innerHTML,/Nessuna misurazione del peso disponibile/);
  assert.match(root.innerHTML,/Nessuna attenzione particolare questa settimana/);
});
