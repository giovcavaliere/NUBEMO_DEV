'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const baseline = '1a2be4b993a3aba7c1b200c906fa90a9bd7e5bb3';
const rowsPath = process.argv[2];
if (!rowsPath) throw new Error('Usage: node tests/food-catalog.test.cjs <food_catalog-readback.json>');
const rows = JSON.parse(fs.readFileSync(rowsPath, 'utf8')).sort((a,b) => a.source.localeCompare(b.source) || a.source_order-b.source_order);
const clean = x => JSON.parse(JSON.stringify(x));
function service() {
 const context = { window: {} }; vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(root,'food-catalog.js'),'utf8'),context);
 return context.window.nubemoFoodCatalog;
}
function client(dataRows, options={}) {
 const pages=[];
 return {pages,from(table){
  assert.equal(table,'food_catalog');
  return {select(cols,opts){assert.equal(opts.count,'exact');assert(!cols.includes('source_payload'));return this;},
   eq(column,value){assert.equal(column,'is_active');assert.equal(value,true);return this;},
   order(){return this;},async range(from,to){pages.push([from,to]);
    if(options.delay) await options.delay;
    if(options.failAt===from)return {data:null,error:{message:'denied'}};
    return {data:options.emptyAt===from?[]:dataRows.slice(from,to+1),count:dataRows.length+(options.changedAt===from?1:0),error:null};
   }};
 }};
}
function runtime(file, api, old=false) {
 const code=old ? cp.execFileSync('git',['show',`${baseline}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:8e6}) : fs.readFileSync(path.join(root,file),'utf8');
 const constant=file==='app.js'?'PATIENT_CALORIE_FOODS':'CALORIE_FOODS';
 const section=code.slice(code.indexOf('const '+constant+'='),code.indexOf('function calorieEstimateDay'));
 const context={window:{nubemoFoodCatalog:api}};vm.createContext(context);
 vm.runInContext(section+`;this.foods=${constant};this.estimate=calorieEstimateText;this.find=findCalorieFood;`,context);
 return {context,code};
}
(async()=>{
 const api=service(); assert.throws(()=>api.nubemoFoods,/non ancora/);
 const backend=client(rows);await api.load(backend);
 assert.equal(backend.pages.length,Math.ceil(rows.length/500));
 assert.equal(api.nubemoFoods.length,952);
 const original=runtime('app.js',null,true).context.foods;
 const reconstructed=api.nubemoFoods.map(({source,sourceCode,sourceVersion,...food})=>food);
 assert.deepEqual(clean(reconstructed),clean(original),'Every NUBEMO field and alias order must match the verified baseline');
 let releaseBlocked=false;
 for (const file of ['app.js','pro.js']) {
  const old=runtime(file,null,true), fallback=runtime(file,{nubemoFoods:api.nubemoFoods,findCrea:()=>null}), current=runtime(file,api);
  const parser=s=>s.slice(s.indexOf('function parseSegmentCalories'),s.indexOf('function calorieEstimateDay'));
  assert.equal(parser(old.code),parser(current.code),'Calculation functions must remain byte-identical');
  let parity=0;const regressions=[];const changedQuantities=[];
  for(const food of old.context.foods)for(const name of food.names)for(const prefix of ['', '50 g ', '100 ml ', '1 ', '2 ', '10 ', '1 porzione ', '2 fette ']) {
   const input=prefix+name;const before=clean(old.context.estimate(input));
   assert.deepEqual(clean(fallback.context.estimate(input)),before,input);parity++;
   const after=clean(current.context.estimate(input));
   if(before.calories>0 && after.calories>0 && before.items[0].quantity!==after.items[0].quantity)changedQuantities.push({input,before:before.calories,after:after.calories,oldQuantity:before.items[0].quantity,newQuantity:after.items[0].quantity});
   if(before.calories>0 && after.calories===0)regressions.push({input,before:before.calories,after:after.calories,status:after.items[0].status});
  }
  assert.equal(current.context.estimate('50 g pan bauletto').calories,133);
  for(const input of ['2 fette pane di segale','1 succo di frutta','2 succo di frutta','10 succo di frutta','pane di segale','pizza','pizza con salsiccia']) {
   assert.deepEqual(clean(current.context.estimate(input)),clean(old.context.estimate(input)),input);
  }
  for(const input of ['2 fette pane di segale','1 succo di frutta','10 succo di frutta']) assert.equal(current.context.find(input).source,'NUBEMO');
  for(const input of ['100 g pane di segale','pane di segale 100 g','100 ml succo di frutta','50 pane di segale']) {
   const found=current.context.find(input);assert.equal(found.source,'CREA',input);
   const expected=Number(input.includes('50 ')?50:100)*found.k100/100;
   assert.equal(current.context.estimate(input).calories,Math.round(expected),input);
  }
  // No grams supplied: all household quantities and piece counts keep NUBEMO.
  for(const unit of ['fetta','fette','cucchiaino','cucchiaini','cucchiaio','cucchiai','vasetto','vasetti','porzione','porzioni','pezzo','pezzi','bicchiere','bicchieri','bottiglia','bottiglie','lattina','lattine','biscotto','biscotti','tazzina','tazzine','tazza','tazze']) {
   const input=`2 ${unit} pane di segale`;
   assert.equal(current.context.find(input).source,'NUBEMO',input);
   assert.deepEqual(clean(current.context.estimate(input)),clean(old.context.estimate(input)),input);
  }
  if(regressions.length || changedQuantities.length)releaseBlocked=true;
  console.log(JSON.stringify({file,parityCases:parity,lostEstimates:regressions.length,examples:regressions.slice(0,12),changedQuantities}));
 }
 // Every unique official name is reachable, without collapsing cooking qualifiers.
 const crea=rows.filter(r=>r.source==='CREA');const byName=new Map();
 for(const r of crea){const group=byName.get(r.normalized_name)||[];group.push(r);byName.set(r.normalized_name,group);}
 for(const [name,group] of byName) {
  for(const text of [name,'100 g '+name,name+' 100 g','100 gr di '+name,'  100 G '+name.toUpperCase()+'  ']){
   const hit=api.findCrea(text);
   if(group.length===1){assert.equal(hit?.sourceCode,group[0].source_code,text);assert.equal(hit.k100,Number(group[0].kcal_100g));}
   else assert.equal(hit,null,text);
  }
  assert.equal(api.findCrea('alimento diverso '+name),null);
  assert.equal(api.findCrea(name+' con ingrediente aggiunto'),null);
 }
 assert.equal(api.findCrea('50 g pan bauletto'),null);
 const margarine=api.findCrea(crea.find(r=>r.source_code==='009110').name);
 assert.equal(margarine.creaPortionGrams,null);
 assert.equal(margarine.portionKcal,undefined,'CREA portion is not a countable piece');
 for(const options of [{failAt:500},{emptyAt:500},{changedAt:500}]){
  const broken=service();await assert.rejects(broken.load(client(rows,options)));assert.throws(()=>broken.nubemoFoods);
  await broken.load(client(rows));assert.equal(broken.nubemoFoods.length,952);
 }
 for(const brokenRows of [[],rows.filter(r=>r.source==='CREA'),rows.concat(rows[0]),rows.map((r,i)=>i===5?{...r,source_version:'mixed'}:r)]){
  const broken=service();await assert.rejects(broken.load(client(brokenRows)));assert.throws(()=>broken.nubemoFoods);
 }
 const duplicate=rows.concat({...crea[0],source_code:'test-duplicate',source_order:99999}).sort((a,b)=>a.source.localeCompare(b.source)||a.source_order-b.source_order);
 const ambiguous=service();await ambiguous.load(client(duplicate));assert.equal(ambiguous.findCrea(crea[0].name),null);
 let release;const delay=new Promise(resolve=>release=resolve);const delayed=service();const waiting=delayed.load(client(rows,{delay}));
 assert.throws(()=>delayed.nubemoFoods);release();await waiting;
 for(const [guard,app] of [['patient-guard.js','await loadPatientApp()'],['professional-guard.js',"await loadScript('pro.js?"]]){
  const source=fs.readFileSync(path.join(root,guard),'utf8');assert(source.indexOf('await window.nubemoFoodCatalog.load(client)')<source.indexOf(app));
 }
 console.log(JSON.stringify({officialFoods:crea.length,officialNames:byName.size,paginationAndFailureTests:'passed',baseline,quantityFallback:'verified'}));
 if(releaseBlocked)throw new Error('Regressione nelle stime per quantità domestiche/pezzi.');
})().catch(error=>{console.error(error);process.exitCode=1;});
