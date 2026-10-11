// Postgres WASM locale, fixture sintetiche, nessuna connessione Supabase.
// PGLITE_MODULE_PATH indica @electric-sql/pglite già installato fuori dal repository.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite');
const id = n => '10000000-0000-4000-8000-' + String(n).padStart(12,'0');
const admin = id(1), proAuth = id(2), proProfile = id(3), pro = id(4);
const migration = fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261011180000_admin2_professional_management.sql'),'utf8');
let db;
const scalar = async sql => (await db.query(sql)).rows[0].v;
const exec = sql => db.exec(sql);
const base = `
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),invited_at timestamptz,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz);
create type public.account_status as enum('active','suspended','disabled');
create table public.profiles(id uuid primary key default gen_random_uuid(),auth_user_id uuid unique references auth.users(id) on delete restrict,
 role text not null,first_name text not null,last_name text not null,email text,status public.account_status not null default 'active');
create table public.professionals(id uuid primary key default gen_random_uuid(),profile_id uuid unique not null references public.profiles(id) on delete restrict,status text not null default 'active');
create table public.professional_settings(professional_id uuid primary key references public.professionals(id) on delete restrict,
 active_patient_limit integer default 10 check(active_patient_limit is null or active_patient_limit>0),settings_json jsonb not null default '{}',updated_at timestamptz default now());
create table public.patients(id uuid primary key);
create table public.professional_patients(id uuid primary key default gen_random_uuid(),professional_id uuid not null references public.professionals(id) on delete restrict,
 patient_id uuid not null references public.patients(id) on delete restrict,status text default 'pending',unique(professional_id,patient_id));
create table public.patient_pathways(id uuid primary key default gen_random_uuid(),professional_patient_id uuid not null references public.professional_patients(id),
 patient_id uuid not null references public.patients(id),status text not null);
create function public.is_active_admin() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.profiles where auth_user_id=auth.uid() and role='admin' and status='active')$$;
create function public.current_active_professional_id() returns uuid language sql stable security definer set search_path='' as $$
select pr.id from public.professionals pr join public.profiles p on p.id=pr.profile_id
 where p.auth_user_id=auth.uid() and p.role='professional' and p.status='active' and pr.status='active' limit 1$$;
grant usage on schema public,auth to authenticated,service_role;
grant select,insert,update on public.professional_settings to authenticated;
grant all on all tables in schema public,auth to service_role;
alter table public.professional_settings enable row level security;
create policy professional_settings_select_own on public.professional_settings for select to authenticated using(professional_id=public.current_active_professional_id());
create policy professional_settings_update_own on public.professional_settings for update to authenticated using(professional_id=public.current_active_professional_id()) with check(professional_id=public.current_active_professional_id());
create policy professional_settings_insert_own on public.professional_settings for insert to authenticated with check(professional_id=public.current_active_professional_id());
insert into auth.users(id,email,email_confirmed_at) values('${admin}','admin@example.invalid',now()),('${proAuth}','pro@example.invalid',now());
insert into profiles(id,auth_user_id,role,first_name,last_name,email) values('${id(5)}','${admin}','admin','Admin','Test','admin@example.invalid'),('${proProfile}','${proAuth}','professional','Pro','Test','pro@example.invalid');
insert into professionals(id,profile_id) values('${pro}','${proProfile}');
insert into professional_settings(professional_id,active_patient_limit) values('${pro}',10);
select set_config('request.jwt.claim.role','service_role',false);
`;
test.before(async()=>{ db=new PGlite(); await exec(base); await exec(migration); });
test.after(async()=>{ await db?.close(); });
const reset = async () => {
  await exec(`reset role; select set_config('request.jwt.claim.role','service_role',false);
    delete from patient_pathways; delete from professional_patients; delete from patients;
    update profiles set status='active' where id='${proProfile}';
    update professionals set status='active' where id='${pro}';
    update auth.users set banned_until=null where id='${proAuth}';
    update professional_settings set active_patient_limit=10 where professional_id='${pro}';
    update admin_settings set default_patient_limit=10,management_enabled=true;`);
};
const add = async (n,status='active') => {
  await exec(`insert into patients(id) values('${id(100+n)}'); insert into professional_patients(id,professional_id,patient_id,status) values('${id(200+n)}','${pro}','${id(100+n)}','${status}');`);
};
test('Migrazione crea soltanto nuove strutture: interruttore inizialmente spento, default 10',async()=>{
  const config=await scalar(`select admin2_management_snapshot('${admin}') v`);
  assert.equal(config.enabled,false);assert.equal(config.default_patient_limit,10);
  await assert.rejects(exec(`select admin2_set_limits('${admin}',20)`),/non ancora disponibile/);
  assert.equal(await scalar('select count(*)::int v from admin_professional_operations'),0);
});
test('Backend rifiuta ruolo professionista, identità assente e Admin sospeso',async()=>{
  await reset();
  for(const actor of [proAuth,id(99)]) await assert.rejects(exec(`select admin2_set_limits('${actor}',20)`),/Admin attivo/);
  await exec(`update profiles set status='suspended' where auth_user_id='${admin}'`);
  await assert.rejects(exec(`select admin2_set_limits('${admin}',20)`),/Admin attivo/);
  await exec(`update profiles set status='active' where auth_user_id='${admin}';update auth.users set banned_until=now()+interval '1 day' where id='${admin}'`);
  await assert.rejects(exec(`select admin2_set_limits('${admin}',20)`),/Admin attivo/);
  await exec(`update auth.users set banned_until=null where id='${admin}'`);
});
test('Generale e individuale: default non modifica assegnati, validazione e nessun DELETE',async()=>{
  await reset();await add(1);
  await exec(`select admin2_set_limits('${admin}',25)`);
  assert.equal(await scalar(`select active_patient_limit v from professional_settings where professional_id='${pro}'`),10);
  for(const value of ['0','-1','100001','null']) await assert.rejects(exec(`select admin2_set_limits('${admin}',${value},'${pro}')`),/Limite non valido/);
  await exec(`select admin2_set_limits('${admin}',1,'${pro}')`);
  assert.equal(await scalar('select count(*)::int v from patients'),1);
});
test('Conteggio distingue associati/attivi, elimina doppioni, include percorsi attivi compatibili',async()=>{
  await reset();await add(1);await add(2,'pending');await add(3,'ended');
  await exec(`insert into patient_pathways(professional_patient_id,patient_id,status) values('${id(201)}','${id(101)}','active'),('${id(202)}','${id(102)}','active'),('${id(203)}','${id(103)}','ended')`);
  const item=(await scalar(`select admin2_management_snapshot('${admin}') v`)).capacity.find(x=>x.professional_id===pro);
  assert.deepEqual([item.associated_patient_count,item.active_patient_count,item.available_patient_slots],[3,2,8]);
});
test('Riduzione sotto conteggio conserva pazienti; blocca insert, riattivazione e percorso nuovo',async()=>{
  await reset();await add(1);await add(2);await add(3,'pending');
  await exec(`select admin2_set_limits('${admin}',1,'${pro}')`);
  assert.equal((await scalar(`select admin2_management_snapshot('${admin}') v`)).capacity.find(x=>x.professional_id===pro).available_patient_slots,0);
  await assert.rejects(add(4),/Limite pazienti/);
  await assert.rejects(exec(`update professional_patients set status='active' where id='${id(203)}'`),/Limite pazienti/);
  await assert.rejects(exec(`insert into patient_pathways(professional_patient_id,patient_id,status) values('${id(203)}','${id(103)}','active')`),/Limite pazienti/);
  await exec(`update professional_patients set status='ended' where id in ('${id(201)}','${id(202)}')`);
  await exec(`update professional_patients set status='active' where id='${id(203)}'`);
  assert.equal(await scalar(`select count(*)::int v from admin2_active_patient_ids('${pro}')`),1);
  assert.equal(await scalar('select count(*)::int v from patients'),3);
});
test('Operazione su paziente già contato non usa un secondo posto; pending non occupa capacità',async()=>{
  await reset();await exec(`select admin2_set_limits('${admin}',1,'${pro}')`);await add(1);await add(2,'pending');
  await exec(`insert into patient_pathways(professional_patient_id,patient_id,status) values('${id(201)}','${id(101)}','active'),('${id(202)}','${id(102)}','pending')`);
  assert.equal(await scalar(`select count(*)::int v from admin2_active_patient_ids('${pro}')`),1);
});
test('Sospensione blocca autorizzazioni effettive; riattivazione non scavalca altri blocchi',async()=>{
  await reset();
  await exec(`select set_config('request.jwt.claim.sub','${proAuth}',false)`);
  assert.equal(await scalar('select current_active_professional_id() v'),pro);
  await exec(`select admin2_set_professional_status('${admin}','${pro}','active','suspended')`);
  assert.equal(await scalar('select current_active_professional_id() v'),null);
  await assert.rejects(add(1,'pending'),/Professionista non attivo/);
  await exec(`update professionals set status='suspended' where id='${pro}'`);
  await assert.rejects(exec(`select admin2_set_professional_status('${admin}','${pro}','suspended','active')`),/account bloccato/);
  await exec(`update professionals set status='active' where id='${pro}';update auth.users set banned_until=now()+interval '1 day' where id='${proAuth}'`);
  await assert.rejects(exec(`select admin2_set_professional_status('${admin}','${pro}','suspended','active')`),/Auth non disponibile/);
  await exec(`update auth.users set banned_until=null where id='${proAuth}'`);
  await exec(`select admin2_set_professional_status('${admin}','${pro}','suspended','active')`);
  assert.equal(await scalar('select current_active_professional_id() v'),pro);
});
test('RLS/grant: RPC e registro non accessibili al browser; settings limite protetto, resto conservato',async()=>{
  await reset();await exec(`select set_config('request.jwt.claim.sub','${proAuth}',false);select set_config('request.jwt.claim.role','authenticated',false);set role authenticated`);
  await assert.rejects(exec(`select admin2_set_limits('${admin}',1000,'${pro}')`),/permission denied/);
  await assert.rejects(exec('select * from admin_professional_operations'),/permission denied/);
  await assert.rejects(exec(`update professional_settings set active_patient_limit=1000 where professional_id='${pro}'`),/soltanto da Admin/);
  await exec(`update professional_settings set settings_json='{"duration":30}' where professional_id='${pro}'`);
  assert.equal(await scalar(`select active_patient_limit v from professional_settings where professional_id='${pro}'`),10);
  await exec(`insert into professional_settings(professional_id,settings_json) values('${pro}','{"duration":45}') on conflict(professional_id) do update set settings_json=excluded.settings_json`);
  assert.equal(await scalar(`select active_patient_limit v from professional_settings where professional_id='${pro}'`),10);
  await assert.rejects(exec(`insert into professional_settings(professional_id,active_patient_limit) values('${pro}',1000) on conflict(professional_id) do update set active_patient_limit=excluded.active_patient_limit`),/soltanto da Admin/);
  await exec('reset role');
});
test('Invito: duplicati, replay sicuro e provisioning atomico con default al momento della creazione',async()=>{
  await reset();
  const operation=id(500), auth=id(501), payload={first_name:'Nuovo',last_name:'Pro',email:'new@example.invalid'};
  const begin=op=>db.query('select admin2_begin_email_operation($1,$2,$3,$4::jsonb) v',[admin,op,'invite-professional',JSON.stringify(payload)]);
  assert.equal((await begin(operation)).rows[0].v.replay,false);
  assert.equal((await begin(operation)).rows[0].v.replay,true);
  await assert.rejects(begin(id(502)),/duplicate key/);
  await exec(`update admin_professional_operations set state='email_started' where id='${operation}';
    insert into auth.users(id,email,invited_at) values('${auth}','new@example.invalid',now());
    select admin2_set_limits('${admin}',17)`);
  const result=await scalar(`select admin2_finish_invite('${admin}','${operation}','${auth}') v`);
  assert.equal(result.active_patient_limit,17);assert.equal(result.email_status,'accepted');
  assert.equal(await scalar(`select active_patient_limit v from professional_settings where professional_id='${pro}'`),10);
  assert.equal((await begin(operation)).rows[0].v.result.professional_id,result.professional_id);
  const failed=id(510),badAuth=id(511);
  await db.query('select admin2_begin_email_operation($1,$2,$3,$4::jsonb)',[admin,failed,'invite-professional',JSON.stringify({...payload,email:'fail@example.invalid'})]);
  await exec(`update admin_professional_operations set state='email_started' where id='${failed}';insert into auth.users(id,email,invited_at,email_confirmed_at) values('${badAuth}','different@example.invalid',now(),now())`);
  await assert.rejects(exec(`select admin2_finish_invite('${admin}','${failed}','${badAuth}')`),/Identità invito/);
  assert.equal(await scalar(`select count(*)::int v from profiles where auth_user_id='${badAuth}'`),0);
  assert.equal(await scalar(`select state v from admin_professional_operations where id='${failed}'`),'email_started');
});
test('Limite non configurato fallisce chiuso, senza backfill automatico',async()=>{
  await reset();await exec(`update professional_settings set active_patient_limit=null where professional_id='${pro}'`);
  await assert.rejects(add(1),/non configurato/);
  assert.equal(await scalar(`select active_patient_limit v from professional_settings where professional_id='${pro}'`),null);
});
test('Aggiunte simultanee accodate dall’engine e INSERT multiplo non superano capacità',async()=>{
  await reset();await exec(`select admin2_set_limits('${admin}',1,'${pro}')`);
  const results=await Promise.allSettled([add(1),add(2)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(await scalar(`select count(*)::int v from admin2_active_patient_ids('${pro}')`),1);
  await reset();await exec(`select admin2_set_limits('${admin}',1,'${pro}');insert into patients(id) values('${id(101)}'),('${id(102)}')`);
  await assert.rejects(exec(`insert into professional_patients(professional_id,patient_id,status) values('${pro}','${id(101)}','active'),('${pro}','${id(102)}','active')`),/Limite pazienti/);
  assert.equal(await scalar('select count(*)::int v from professional_patients'),0);
});
