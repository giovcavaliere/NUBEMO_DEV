const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const id = n => '20000000-0000-4000-8000-' + String(n).padStart(12,'0');
const profile = {role:'admin',status:'active'}, user={id:id(1)};
let edge;
test.before(async()=>{edge=await import('../supabase/functions/swift-endpoint/management.mjs');});
function edgeFixture(overrides={}) {
  const calls=[];let emailCount=0;
  const ctx={supabaseAdmin:{
    rpc:async(name,values)=>{
      calls.push({name,values});
      if(overrides.rpc) {const result=await overrides.rpc(name,values);if(result!==undefined)return result;}
      if(name==='admin2_management_snapshot') return {data:{version:1,enabled:true,default_patient_limit:10,capacity:[]}};
      if(name==='admin2_begin_email_operation')return {data:{replay:false,state:'started'}};
      if(name==='admin2_finish_invite')return {data:{ok:true,invited:true,professional_id:id(3),email_status:'accepted'}};
      if(name==='admin2_set_limits')return {data:{ok:true,limit:values.p_limit,professional_id:values.p_professional}};
      if(name==='admin2_set_professional_status')return {data:{ok:true,nubemo_status:values.p_status,professional_id:values.p_professional}};
      return {data:null};
    },
    from(table) {
      const q={};for(const method of ['update','select','eq'])q[method]=(...args)=>{calls.push({table,method,args});return q;};
      q.single=async()=>({data:table==='professionals'?{id:id(3),status:'active',profiles:{role:'professional',status:overrides.profileStatus||'active',auth_user_id:id(2),first_name:'Pro',last_name:'Test',email:'pro@example.invalid'}}:{id:id(4)}});
      return q;
    },
    auth:{admin:{
      getUserById:async()=>({data:{user:{id:id(2),email:'pro@example.invalid',...overrides.authUser}}}),
      inviteUserByEmail:async(...args)=>{emailCount++;calls.push({email:args});return overrides.invite?overrides.invite(...args):{data:{user:{id:id(2)}}};}
    }}
  }};
  return {ctx,calls,get emailCount(){return emailCount;},run:body=>edge.handleManagement(body,ctx,user,profile,'https://example.invalid/set-password.html')};
}
const invite={action:'invite-professional',management_version:1,operation_id:id(4),first_name:' Laura ',last_name:' Rossi ',email:'LAURA@example.invalid'};
test('Edge: ruolo/stato reali e capability obbligatori; indisponibile senza chiamate email',async()=>{
  const h=edgeFixture();
  for(const p of [{role:'professional',status:'active'},{role:'admin',status:'suspended'}]){
    assert.equal((await edge.handleManagement(invite,h.ctx,user,p,'unused')).status,403);
  }
  const disabled=edgeFixture({rpc:name=>name==='admin2_management_snapshot'?{data:{version:1,enabled:false,capacity:[]}}:undefined});
  assert.equal((await disabled.run(invite)).status,503);assert.equal(disabled.emailCount,0);
  const absent=edgeFixture({rpc:name=>name==='admin2_management_snapshot'?{error:{code:'PGRST202'}}:undefined});
  assert.equal((await absent.run(invite)).status,503);assert.equal(absent.emailCount,0);
});
test('Edge: invito riusa Auth, input normalizzato, provisioning atomico dopo email accettata',async()=>{
  const h=edgeFixture(); const response=await h.run(invite);assert.equal(response.status,200);
  assert.equal((await response.json()).invited,true);assert.equal(h.emailCount,1);
  const begin=h.calls.find(c=>c.name==='admin2_begin_email_operation');
  assert.deepEqual(begin.values.p_payload,{first_name:'Laura',last_name:'Rossi',email:'laura@example.invalid'});
  assert.equal(begin.values.p_actor,user.id);
  assert.equal(h.calls.find(c=>c.email).email[1].redirectTo,'https://example.invalid/set-password.html');
  assert.ok(h.calls.some(c=>c.name==='admin2_finish_invite'));
});
test('Edge: validazioni e duplicati impediscono chiamate Auth',async()=>{
  for(const values of [{email:'invalid'},{first_name:''},{last_name:'a'.repeat(101)},{operation_id:'bad'}]){
    const h=edgeFixture();assert.equal((await h.run({...invite,...values})).status,400);assert.equal(h.emailCount,0);
  }
  const h=edgeFixture({rpc:name=>name==='admin2_begin_email_operation'?{error:{code:'23505',message:'private SQL detail'}}:undefined});
  const response=await h.run(invite);assert.equal(response.status,409);assert.ok(!(await response.text()).includes('private'));assert.equal(h.emailCount,0);
});
test('Edge: replay completato non reinvia; richieste pendenti/incerte non sono ripetute',async()=>{
  for(const state of ['started','email_started','needs_review','failed','completed']){
    const result={ok:true,invited:true,professional_id:id(3),email_status:'accepted'};
    const h=edgeFixture({rpc:name=>name==='admin2_begin_email_operation'?{data:{replay:true,state,result}}:undefined});
    assert.equal((await h.run(invite)).status,state==='completed'?200:409);assert.equal(h.emailCount,0);
  }
});
test('Edge: email fallita/timeout/finalizzazione fallita non producono successo',async()=>{
  for(const options of [
    {invite:async()=>({error:{message:'SMTP failed'},data:{}})},
    {invite:async()=>{throw Error('private network');}},
    {rpc:name=>name==='admin2_finish_invite'?{error:{code:'23505'}}:undefined}
  ]){
    const h=edgeFixture(options);const response=await h.run(invite);assert.ok(response.status>=500);assert.equal((await response.json()).ok,false);
    assert.ok(h.calls.some(c=>c.table==='admin_professional_operations' && c.method==='update' && c.args[0].state==='needs_review'));
  }
});
test('Edge: reinvio soltanto invitato e attivo, senza ban Auth o mismatch email',async()=>{
  const action={action:'resend-professional-invite',professional_id:id(3),operation_id:id(4)};
  const h=edgeFixture();assert.equal((await h.run(action)).status,200);assert.equal(h.emailCount,1);
  for(const options of [{authUser:{email_confirmed_at:new Date().toISOString()}},{authUser:{banned_until:'2999-01-01'}},{profileStatus:'suspended'},{authUser:{email:'other@example.invalid'}}]){
    const invalid=edgeFixture(options);assert.equal((await invalid.run(action)).status,409);assert.equal(invalid.emailCount,0);
  }
});
test('Edge: sospensione richiede conferma 2.0, transizioni e limiti solo tramite RPC',async()=>{
  const h=edgeFixture();
  assert.equal((await h.run({action:'suspend-professional',professional_id:id(3),management_version:1})).status,400);
  for(const action of ['suspend-professional','activate-professional']){
    const response=await h.run({action,professional_id:id(3),management_version:1,confirmed:true});assert.equal(response.status,200);
    const call=h.calls.findLast(c=>c.name==='admin2_set_professional_status');assert.equal(call.values.p_actor,user.id);
    assert.equal(call.values.p_expected,action==='suspend-professional'?'active':'suspended');
  }
  for(const value of [0,1.5,'10',100001,null]) assert.equal((await h.run({action:'set-default-patient-limit',limit:value})).status,400);
  assert.equal((await h.run({action:'set-professional-limit',professional_id:id(3),limit:3})).status,200);
  assert.equal(h.emailCount,0);
});

function servicesFixture(options={}) {
  const calls=[];
  const row={professional_id:id(3),profile_id:id(5),active_patient_count:12,associated_patient_count:15,active_patient_limit:10,available_patient_slots:0,can_resend:true,can_suspend:true,can_activate:false};
  const client={auth:{getSession:async()=>({data:{session:{access_token:'mock-jwt'}}})},functions:{invoke:async(name,{body,headers})=>{
    calls.push({name,body,headers});if(options.invoke)return options.invoke(body);
    if(body.action==='list-professionals')return {data:{ok:true,professionals:[row],management:{version:1,enabled:true,default_patient_limit:10}}};
    if(body.action==='invite-professional')return {data:{ok:true,invited:true,professional_id:id(3),email_status:'accepted'}};
    if(body.action==='resend-professional-invite')return {data:{ok:true,resent:true,professional_id:id(3),email_status:'accepted'}};
    return {data:{ok:true,limit:body.limit,professional_id:body.professional_id||null,nubemo_status:body.action==='suspend-professional'?'suspended':'active'}};
  }}};
  const window={crypto:require('node:crypto').webcrypto};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../admin-v2/admin-services.js'),'utf8'),{window,setTimeout,clearTimeout});
  return {service:window.NubemoAdminServices.create(client),calls};
}
test('Servizi: backend assente resta sola lettura; contratto capacità malformato fallisce chiuso',async()=>{
  const h=servicesFixture({invoke:async()=>({data:{ok:true,professionals:[]}})});await h.service.listProfessionals();
  await assert.rejects(h.service.manage('invite-professional',invite),/non ancora disponibile/);assert.equal(h.calls.length,1);
  const malformed=servicesFixture({invoke:async()=>({data:{ok:true,professionals:[{professional_id:id(3),profile_id:id(5)}],management:{version:1,enabled:true,default_patient_limit:10}}})});
  await assert.rejects(malformed.service.listProfessionals(),/non valide/);assert.equal(malformed.service.getManagement().enabled,false);
});
test('Servizi: double submit bloccato e stesso operation_id dopo esito incerto',async()=>{
  let release;let phase='list';
  const h=servicesFixture({invoke:async body=>{
    if(body.action==='list-professionals')return {data:{ok:true,professionals:[],management:{version:1,enabled:true,default_patient_limit:10}}};
    if(phase==='hold')return new Promise(resolve=>{release=resolve;});
    return {data:{ok:false,code:'needs_review'}};
  }});
  await h.service.listProfessionals();phase='hold';
  const first=h.service.manage('invite-professional',invite);
  await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(h.service.manage('invite-professional',invite),/già in corso/);
  release({data:{ok:false,code:'needs_review'}});await assert.rejects(first,/incerto/);
  phase='failed';await assert.rejects(h.service.manage('invite-professional',invite),/incerto/);
  const calls=h.calls.filter(c=>c.body.action==='invite-professional');assert.equal(calls.length,2);
  assert.equal(calls[0].body.operation_id,calls[1].body.operation_id);
});
test('Servizi: risultati confermati, validazione limiti e rifiuto successi incompleti',async()=>{
  const h=servicesFixture();await h.service.listProfessionals();
  assert.equal((await h.service.manage('set-professional-limit',{professional_id:id(3),limit:3})).limit,3);
  assert.equal((await h.service.manage('set-default-patient-limit',{limit:20})).limit,20);
  await assert.rejects(h.service.manage('suspend-professional',{professional_id:id(3)}),/esplicitamente/);
  for(const value of [0,NaN,2.5,100001]) await assert.rejects(h.service.manage('set-default-patient-limit',{limit:value}),/intero/);
  const fake=servicesFixture({invoke:async body=>body.action==='list-professionals'?{data:{ok:true,professionals:[],management:{version:1,enabled:true,default_patient_limit:10}}}:{data:{ok:true}}});
  await fake.service.listProfessionals();await assert.rejects(fake.service.manage('invite-professional',invite),/non ha confermato/);
});

test('Entrypoint: autentica identità/profilo prima della gestione e mantiene lista legacy',async()=>{
 const { stripTypeScriptTypes } = require('node:module');
 const { pathToFileURL } = require('node:url');
 const helper=pathToFileURL(path.join(__dirname,'../supabase/functions/swift-endpoint/management.mjs')).href;
 const capacityHelper=pathToFileURL(path.join(__dirname,'../supabase/functions/swift-endpoint/patient-capacity.mjs')).href;
 let source=fs.readFileSync(path.join(__dirname,'../supabase/functions/swift-endpoint/index.ts'),'utf8');
 source=source.replace('import { withSupabase } from "npm:@supabase/server@^1";','const withSupabase = (_,handler) => handler;')
   .replace('from "./management.mjs"','from '+JSON.stringify(helper))
   .replace('from "./patient-capacity.mjs"','from '+JSON.stringify(capacityHelper));
 const entry=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})).toString('base64'));
 const run=(ctx,body)=>entry.default.fetch(new Request('https://example.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),ctx);
 const h=edgeFixture();
 h.ctx.supabase={auth:{getUser:async()=>({data:{user}})},from:()=>({select(){return this},eq(){return this},single:async()=>({data:profile})})};
 let response=await run(h.ctx,{...invite});assert.equal(response.status,200);
 h.ctx.supabase.auth.getUser=async()=>({data:{user:null}});
 response=await run(h.ctx,invite);assert.equal(response.status,401);
 h.ctx.supabase.auth.getUser=async()=>({data:{user}});
 h.ctx.supabase.from=()=>({select(){return this},eq(){return this},single:async()=>({data:{role:'patient',status:'active'}})});
 assert.equal((await run(h.ctx,invite)).status,403);
 h.ctx.supabase.from=()=>({select(){return this},eq(){return this},single:async()=>({data:profile})});
 const previous=h.ctx.supabaseAdmin.from;
 h.ctx.supabaseAdmin.from=table=>table==='professionals'?{select(){return this},order:async()=>({data:[]})}:previous(table);
 const legacy=await (await run(h.ctx,{action:'list-professionals'})).json();
 assert.deepEqual(legacy,{ok:true,professionals:[]});
 const current=await (await run(h.ctx,{action:'list-professionals',management_version:1})).json();
 assert.equal(current.management.version,1);
 assert.equal((await run(h.ctx,null)).status,400);
});
