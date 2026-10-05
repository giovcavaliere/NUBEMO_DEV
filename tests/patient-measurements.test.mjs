import test from "node:test";
import assert from "node:assert/strict";
import {calculateBMI,calculateFFM,getLatestMeasurement,getPreviousMeasurement,getMeasurementDelta,formatMeasurementDelta,buildMeasurementSeries,buildMeasurementChart,getMeasurementsViewModel,measurementFromForm,getMeasurementFormPreview,isMeasurementDate} from "../professional-v2/patient-measurements-model.js";
import {renderMeasurements} from "../professional-v2/patient-measurements-view.js";

const measurement=(id,date,values={})=>({id,date,...values});
const data=measurements=>({measurements});

test("BMI needs positive weight and height in the same snapshot; no hidden height fallback",()=>{
  assert.ok(Math.abs(calculateBMI(104.8,180)-32.345679)<.000001);
  for(const height of [null,undefined,0,-180,"180",NaN]) assert.equal(calculateBMI(104.8,height),null);
  const model=getMeasurementsViewModel(data([measurement("a","2026-09-01",{weight:110,height:180}),measurement("b","2026-10-01",{weight:105})]));
  assert.equal(model.summary[1].text,"—");
  assert.equal(model.lastHeight.value,180);
  assert.equal(model.rows[0].values[1].text,"—");
});

test("FFM derives from zero-inclusive BCM and ECM without overwriting explicit FFM",()=>{
  const source={bcm:47.5,ecm:20.1,ffm:70};
  assert.equal(calculateFFM(source),67.6);
  assert.equal(source.ffm,70);
  assert.equal(calculateFFM({bcm:0,ecm:0}),0);
  assert.equal(calculateFFM({bcm:40}),null);
  assert.equal(calculateFFM({bcm:40,ffm:66}),66);
  const row=getMeasurementsViewModel(data([measurement("a","2026-10-01",source)])).rows[0];
  assert.match(row.ffmNote,/70,0/);
  assert.match(row.ffmNote,/67,6/);
});

test("snapshots order by date and time, keep same-day measurements separate and compare the preceding snapshot",()=>{
  const records=[measurement("c","2026-10-02",{weight:104.8,bodyFat:32.4,bcm:47.5}),measurement("b","2026-10-01",{time:"12:00",weight:106,bodyFat:33.1,bcm:46.9}),measurement("a","2026-10-01",{time:"09:00",weight:107})];
  assert.equal(getLatestMeasurement(records).id,"c");
  assert.equal(getPreviousMeasurement(records).id,"b");
  assert.equal(records[0].id,"c");
  assert.equal(formatMeasurementDelta(getMeasurementDelta(records[0],records[1],"weight"),"kg"),"-1,2 kg");
  assert.equal(formatMeasurementDelta(getMeasurementDelta(records[0],records[1],"bcm"),"pp"),"+0,6 pp");
  assert.equal(formatMeasurementDelta(getMeasurementDelta(records[0],records[2],"bodyFat"),"pp"),"Nessun confronto");
  assert.equal(formatMeasurementDelta(null,"kg"),"Nessun confronto");
});

test("structured series use actual dates, separate units, support zero and single points and scale many points",()=>{
  assert.equal(buildMeasurementChart(buildMeasurementSeries([])),null);
  const one=buildMeasurementChart(buildMeasurementSeries([measurement("a","2026-10-01",{weight:80,bodyFat:0})]));
  assert.equal(one.series.length,2);
  assert.equal(one.series[0].dots.length,1);
  assert.equal(one.series[1].points[0].value,0);
  assert.equal(one.series[0].dots[0].x,250);
  const records=[measurement("a","2026-09-01",{weight:90}),measurement("b","2026-09-02",{weight:89}),measurement("c","2026-10-01",{weight:80})];
  const chart=buildMeasurementChart(buildMeasurementSeries(records));
  assert.ok(chart.series[0].dots[1].x-chart.series[0].dots[0].x<20);
  const many=Array.from({length:500},(_,i)=>measurement(String(i),new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),{weight:90-i*.01,muscleMass:40}));
  const result=buildMeasurementChart(buildMeasurementSeries(many));
  assert.equal(result.series[0].points.length,500);
  assert.equal(result.series[0].dots.length,2);
  assert.ok(result.labels.length<=4);
  assert.doesNotMatch(result.series[0].path,/NaN|Infinity/);
});

test("latest BIA stays one coherent snapshot, handles incomplete BIA, explicit FFM and totals above 100",()=>{
  const measurements=[measurement("a","2026-09-01",{bodyFat:30,ecm:20,bcm:50}),measurement("b","2026-10-01",{weight:80})];
  assert.equal(getMeasurementsViewModel(data(measurements)).composition.dateText,"01 set 2026");
  const partial=getMeasurementsViewModel(data([measurement("a","2026-10-01",{bodyFat:32})]));
  assert.equal(partial.composition.components[1].value,null);
  assert.equal(partial.composition.ffmText,"—");
  assert.match(partial.composition.note,/parziale/);
  assert.ok(Math.abs(partial.composition.bands.find(band=>band.tone==="fm").height-89.6)<1e-8);
  const over=getMeasurementsViewModel(data([measurement("a","2026-10-01",{bodyFat:40,ecm:40,bcm:50})]));
  assert.deepEqual(over.composition.components.map(component=>component.barHeight),[40,40,50]);
  assert.ok(Math.abs(over.composition.bands.reduce((total,band)=>total+band.height,0)-280)<1e-8);
  assert.match(over.composition.note,/130,0/);
  assert.equal(over.composition.ffmText,"90,0 %");
  assert.equal(getMeasurementsViewModel(data([measurement("a","2026-10-01",{ffm:70})])).composition.hasSegments,false);
});

test("date-only, only weight, no BIA and no measurements render useful states without NaN",()=>{
  for(const measurements of [[],[measurement("a","2026-10-01")],[measurement("a","2026-10-01",{weight:80})]]){
    const html=renderMeasurements(getMeasurementsViewModel(data(measurements)));
    assert.match(html,/Composizione corporea non ancora rilevata/);
    assert.doesNotMatch(html,/NaN|Infinity|undefined|<details[^>]* open/);
  }
  assert.equal(isMeasurementDate("2026-02-30"),false);
  assert.equal(isMeasurementDate("2026-02-28"),true);
});

test("shared form serialization creates stable identities, preserves explicit FFM, and never saves derived values",()=>{
  const values=new Map([["date","2026-10-01"],["time","12:00"],["weight","104.8"],["height",""] ,["ecm","20.1"],["bcm","47.5"],["notes","  Test  "]]);
  const created=measurementFromForm(values);
  assert.ok(created.id);
  assert.equal(created.height,null);
  assert.equal(created.notes,"Test");
  assert.equal(created.weight,104.8);
  assert.equal(created.ffm,undefined);
  assert.equal(created.bmi,undefined);
  const edited=measurementFromForm(values,{id:"stable",ffm:70,source:"original"});
  assert.equal(edited.id,"stable");
  assert.equal(edited.ffm,70);
  assert.equal(edited.source,"original");
  assert.equal(getMeasurementFormPreview(values).ffmText,"67,6 %");
  values.delete("ecm");
  assert.equal(getMeasurementFormPreview(values,{ffm:70}).ffmText,"—");
});
