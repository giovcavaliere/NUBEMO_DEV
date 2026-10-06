import test from "node:test";
import assert from "node:assert/strict";
import {getProgressViewModel,filterProgressMeasurements,buildProgressComparison} from "../professional-v2/patient-progress-model.js";
import {getPatientData} from "../professional-v2/patient-detail-data.js";
import {renderProgress} from "../professional-v2/patient-progress-view.js";
import {renderMeasurements} from "../professional-v2/patient-measurements-view.js";
import {getMeasurementsViewModel} from "../professional-v2/patient-measurements-model.js";

const record=(id,date,values={})=>({id,date,...values});
test("progress KPIs use first and latest valid values, BMI uses the same snapshot, goal uses existing anamnesis",()=>{
  const model=getProgressViewModel(getPatientData("p1"));
  assert.equal(model.summary[0].value,"106,6 kg");
  assert.equal(model.summary[0].delta,"-2,8 kg");
  assert.equal(model.summary[1].value,"32,9");
  assert.equal(model.summary[2].value,"108,0 cm");
  assert.equal(model.summary[2].delta,"-4,0 cm");
  assert.deepEqual(model.summary[3].parts,[{label:"FM",text:"-1,2 pp"},{label:"MM",text:"+0,8 pp"}]);
  assert.equal(model.charts.weight.reference.text,"Obiettivo 85,0 kg");
  assert.equal(model.observations.length,3);
  const sparse=getProgressViewModel({measurements:[record("a","2026-01-01",{weight:90,height:180}),record("b","2026-02-01",{weight:80})]});
  assert.equal(sparse.summary[1].value,"27,8");
  assert.equal(sparse.summary[1].delta,"Nessun confronto");
  assert.equal(sparse.charts.weight.reference,null);
});
test("one month filter clamps the boundary to the last calendar day and anchors to the latest record",()=>{
  const records=[record("a","2026-02-27"),record("b","2026-02-28"),record("c","2026-03-31")];
  assert.deepEqual(filterProgressMeasurements(records,"1").map(item=>item.id),["b","c"]);
  assert.equal(filterProgressMeasurements(records,"all"),records);
});
test("period applies to all three charts while KPI and chosen comparison keep the whole journey",()=>{
  const data={measurements:[record("a","2026-01-01",{weight:100,waist:110,bodyFat:40}),record("b","2026-05-01",{weight:90,waist:100,bodyFat:35}),record("c","2026-06-01",{weight:85,waist:98,bodyFat:32})]};
  const short=getProgressViewModel(data,{period:"1"}),all=getProgressViewModel(data,{period:"all"});
  for(const key of ["weight","bia","circumference"]){assert.equal(short.charts[key].series[0].points.length,2);assert.equal(all.charts[key].series[0].points.length,3)}
  assert.equal(short.summary[0].delta,"-15,0 kg");
  assert.equal(short.comparison.firstId,"a");
});
test("BIA gaps break paths, zero percentages stay real and values above 100 are never normalized",()=>{
  const model=getProgressViewModel({measurements:[record("a","2026-01-01",{bodyFat:0,muscleMass:30,bcm:40}),record("b","2026-01-02",{weight:90}),record("c","2026-01-03",{bodyFat:120,muscleMass:32,bcm:50})]});
  const fm=model.charts.bia.series[0];
  assert.deepEqual(fm.points.map(item=>item.value),[0,120]);
  assert.equal((fm.path.match(/M/g)||[]).length,2);
  assert.ok(!fm.path.includes("L"));
  assert.equal(fm.dots.length,2);
  assert.equal(model.charts.bia.ticks.at(-1).percent,"130,0");
  assert.deepEqual(model.charts.bia.series.map(item=>item.key),["bodyFat","muscleMass","bcm"]);
});
test("selected snapshots compare their actual data only; same date readings keep separate identities",()=>{
  const records=[record("a","2026-01-01",{time:"09:00",weight:100,height:180,waist:110,bodyFat:30}),record("b","2026-01-01",{time:"12:00",weight:95,bodyFat:29})];
  const comparison=buildProgressComparison(records,"a","b");
  assert.equal(comparison.rows[0].delta,"-5,0 kg");
  assert.equal(comparison.rows[1].last,"—");
  assert.equal(comparison.rows[1].delta,"Nessun confronto");
  assert.equal(comparison.rows[2].last,"—");
  assert.equal(comparison.rows[3].delta,"-1,0 pp");
  assert.match(comparison.rows[0].lastLabel,/12:00/);
  assert.equal(buildProgressComparison(records,"b","a").rows[0].delta,"+5,0 kg");
  assert.ok(buildProgressComparison(records,"a","a").rows.every(item=>item.delta==="Nessun confronto"));
});
test("empty, one reading and missing values produce useful states without imaginary trends",()=>{
  for(const measurements of [[],[record("a","2026-01-01")],[record("a","2026-01-01",{weight:80,waist:90,bodyFat:0})]]){
    const model=getProgressViewModel({measurements});
    assert.equal(model.observations.length,0);
    assert.equal(model.charts.circumference,null);
    assert.doesNotMatch(renderProgress(model),/NaN|Infinity|undefined|measure-body|Andamento BMI/);
  }
});
test("many readings keep all actual points, finite geometry and bounded date labels",()=>{
  const records=Array.from({length:200},(_,i)=>record(String(i),new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),{weight:100-i*.05,waist:110-i*.02,bodyFat:i%2?null:30-i*.01}));
  const model=getProgressViewModel({measurements:records},{period:"all"});
  assert.equal(model.charts.weight.series[0].dots.length,200);
  assert.equal(model.charts.bia.series[0].dots.length,100);
  assert.ok(model.charts.weight.labels.length<=4);
  assert.doesNotMatch(renderProgress(model),/NaN|Infinity/);
});
test("Misure keeps body, composition and operational history and no longer renders historical graphs",()=>{
  const html=renderMeasurements(getMeasurementsViewModel(getPatientData("p1")));
  assert.match(html,/measure-body-clip/);
  assert.match(html,/BCM \/ ECM/);
  assert.match(html,/data-measure-new/);
  assert.match(html,/data-measure-edit/);
  assert.match(html,/data-measure-delete/);
  assert.doesNotMatch(html,/Andamento nel tempo|data-measure-chart|data-measure-series/);
});
