import test from "node:test";
import assert from "node:assert/strict";
import {loadPatientOverview,loadPatientRecentActivity} from "../professional-v2/patient-overview-live.js";
import {renderLivePatientOverview} from "../professional-v2/patient-detail-view.js";

const overview={patient:{id:"patient-a",first_name:"Anna",last_name:"Test"},link:{id:"relation-a",status:"active"},professionalId:"pro-a",pathways:[{id:"current",status:"active"},{id:"past",status:"ended"}]};
function fixture(overrides={}){
 const tables={
  professionals:[{id:"pro-a",profile_id:"profile-a"}],
  professional_patients:[{id:"relation-a",professional_id:"pro-a",patient_id:"patient-a",status:"active"}],
  patient_pathways:overview.pathways.map(p=>({...p,professional_patient_id:"relation-a"})),
  documents:[
   {id:"doc-a",patient_id:"patient-a",pathway_id:"current",title:"Esame",uploaded_by_user_id:"user-a",created_at:"2026-10-10T18:00:00Z",deleted_at:null},
   {id:"doc-deleted",patient_id:"patient-a",pathway_id:"current",created_at:"2026-10-15T18:00:00Z",deleted_at:"2026-10-15"},
   {id:"doc-other-patient",patient_id:"patient-b",pathway_id:"current",created_at:"2026-10-15T18:00:00Z"},
   {id:"doc-other-path",patient_id:"patient-a",pathway_id:"foreign",created_at:"2026-10-15T18:00:00Z"}
  ],
  diary_entries:[{id:"diary-a",patient_id:"patient-a",pathway_id:"past",entry_date:"2026-09-01",created_at:"2026-09-01T12:00:00Z",updated_at:"2026-10-12T12:00:00Z",deleted_at:null}],
  appointment_patients:[{id:"visit-link",patient_id:"patient-a",pathway_id:"past"}],
  appointment_visits:[
   {id:"visit-a",patient_id:"patient-a",professional_id:"pro-a",appointment_patient_id:"visit-link",registered_at:"2026-10-11T12:00:00Z",updated_at:"2026-10-13T12:00:00Z",appointments:{appointment_type:"first",starts_at:"2026-09-20T12:00:00Z",deleted_at:null}},
   {id:"visit-other-path",patient_id:"patient-a",professional_id:"pro-a",appointment_patient_id:"foreign-link",updated_at:"2026-10-15T12:00:00Z",appointments:{deleted_at:null}},
   {id:"visit-other-pro",patient_id:"patient-a",professional_id:"pro-b",appointment_patient_id:"visit-link",updated_at:"2026-10-15T12:00:00Z",appointments:{deleted_at:null}}
  ],
  profiles:[{auth_user_id:"user-a",role:"professional"}],...overrides
 };
 const calls=[];
 const client={from(table){
  const filters=[],orders=[];let limit=Infinity;
  const value=(r,key)=>key.split(".").reduce((o,k)=>o?.[k],r);
  const q={select(columns){calls.push({table,columns,filters});return q},
   eq(key,val){filters.push(["eq",key,val]);return q},in(key,vals){filters.push(["in",key,vals]);return q},is(key,val){filters.push(["is",key,val]);return q},
   order(key,options={}){orders.push([key,options]);return q},limit(n){limit=n;return q},
   single(){return q.then(r=>({...r,data:r.data[0]||null}))},
   then(resolve,reject){
    if(table===overrides.failTable)return Promise.resolve({error:{message:"offline"}}).then(resolve,reject);
    let data=(tables[table]||[]).filter(r=>filters.every(([op,k,v])=>op==="in"?v.includes(value(r,k)):op==="is"?(value(r,k)??null)===v:value(r,k)===v));
    data=[...data].sort((a,b)=>{for(const [k,o] of orders){const av=value(a,k),bv=value(b,k);if(av===bv)continue;if(av==null)return o.nullsFirst? -1:1;if(bv==null)return o.nullsFirst?1:-1;return (av<bv?-1:1)*(o.ascending===false?-1:1);}return 0;}).slice(0,limit);
    return Promise.resolve({data,error:null}).then(resolve,reject);
   }
  };return q;
 }};
 globalThis.window={nubemoSupabase:client,NUBEMO_PRO2_PROFILE:{id:"profile-a"}};
 return {tables,calls};
}
test("recent feed uses actual update timestamps, excludes unrelated/deleted records and identifies history",async()=>{
 fixture();
 const events=await loadPatientRecentActivity(overview);
 assert.deepEqual(events.map(e=>e.id),["visit-a","diary-a","doc-a"]);
 assert.equal(events[0].date,"2026-10-13T12:00:00Z");
 assert.match(events[0].title,/Prima visita aggiornata/);
 assert.match(events[0].description,/Percorso concluso/);
 assert.match(events[1].description,/01 settembre 2026.*Percorso concluso/);
 assert.equal(events[2].origin,"Professionista");
 assert.equal(events[2].date,"2026-10-10T18:00:00Z");
});
test("global four-event limit follows chronological merge, not source priority",async()=>{
 fixture({documents:Array.from({length:8},(_,i)=>({id:"d"+i,patient_id:"patient-a",pathway_id:"current",title:"Documento",created_at:`2026-10-${String(10+i).padStart(2,"0")}T12:00:00Z`}))});
 const events=await loadPatientRecentActivity(overview);
 assert.deepEqual(events.map(e=>e.id),["d7","d6","d5","d4"]);
 assert.ok(events.every(e=>e.origin==="")); // Unknown uploader is not guessed to be the patient.
});
test("missing timestamps produce no invented event dates; errors do not become empty success",async()=>{
 const f=fixture({diary_entries:[],appointment_patients:[],documents:[{id:"undated",patient_id:"patient-a",pathway_id:"current",title:"Senza data"}]});
 assert.deepEqual(await loadPatientRecentActivity(overview),[]);
 assert.equal(f.calls.some(c=>c.table==="appointment_visits"),false);
 fixture({failTable:"documents"});
 await assert.rejects(()=>loadPatientRecentActivity(overview),/offline/);
});
test("no pathways means empty feed and no clinical reads; absent identity is rejected",async()=>{
 const f=fixture();
 assert.deepEqual(await loadPatientRecentActivity({...overview,pathways:[]}),[]);
 assert.equal(f.calls.length,0);
 delete window.NUBEMO_PRO2_PROFILE;
 await assert.rejects(()=>loadPatientRecentActivity(overview),/Sessione/);
});
test("overview authorization precedes clinical retrieval and scopes pathways to the own relationship",async()=>{
 const f=fixture();
 await assert.rejects(()=>loadPatientOverview("patient-b",[overview.patient]),/non associato/);
 assert.equal(f.calls.length,0);
 const result=await loadPatientOverview("patient-a",[overview.patient]);
 assert.equal(result.professionalId,"pro-a");
 assert.deepEqual(result.pathways.map(p=>p.id),["current","past"]);
 assert.ok(f.calls.find(c=>c.table==="professional_patients").filters.some(f=>f[1]==="professional_id"&&f[2]==="pro-a"));
});
test("live overview reuses activity card after the three panels and gates unmigrated actions",()=>{
 const root={innerHTML:"",querySelector:()=>null,querySelectorAll:()=>[]};
 renderLivePatientOverview(root,{...overview,recentActivity:[{id:"safe",type:"document",title:'<img src=x>',description:'<script>test</script>',date:"2026-10-15T12:00:00Z"}]});
 assert.ok(root.innerHTML.indexOf("Documenti e attività recenti")>root.innerHTML.indexOf("Aggiungi misure"));
 assert.match(root.innerHTML,/Aggiornamenti in ordine cronologico/);
 assert.match(root.innerHTML,/&lt;img src=x&gt;/);
 assert.doesNotMatch(root.innerHTML,/<script>test|Le funzioni cliniche saranno attivate/);
 for(const tab of ["visite","documenti","misure"])assert.match(root.innerHTML,new RegExp('href="#patient/patient-a/'+tab+'"'));
 assert.match(root.innerHTML,/data-clinical-pdf disabled/);
 assert.match(root.innerHTML,/aria-disabled="true"[^>]+>.*Controlla diario/);
 assert.doesNotMatch(root.innerHTML,/href="#patient\/patient-a\/diario"/);
 renderLivePatientOverview(root,{...overview});
 assert.match(root.innerHTML,/Nessuna attività recente/);
 renderLivePatientOverview(root,{...overview,activityError:"Lettura non riuscita"});
 assert.match(root.innerHTML,/role="alert">Lettura non riuscita/);
 assert.doesNotMatch(root.innerHTML,/Nessuna attività recente/);
});
