-- PREPARATA SOLTANTO. Non applicare senza approvazione separata per NUBEMO_DEV.
-- Nessun backfill, DELETE, sostituzione RLS o modifica di funzioni/trigger esistenti.
begin;

create table public.admin_settings (
  singleton boolean primary key default true check (singleton),
  default_patient_limit integer not null default 10 check (default_patient_limit between 1 and 100000),
  management_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.admin_settings(singleton) values (true);
alter table public.admin_settings enable row level security;
revoke all on public.admin_settings from public, anon, authenticated;
grant all on public.admin_settings to service_role;

create table public.admin_professional_operations (
  id uuid primary key,
  actor_auth_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('invite-professional','resend-professional-invite')),
  operation_key text not null,
  payload jsonb not null,
  state text not null default 'started' check (state in ('started','email_started','completed','failed','needs_review')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index admin_professional_operations_inflight
  on public.admin_professional_operations(operation_key)
  where state in ('started','email_started','needs_review');
alter table public.admin_professional_operations enable row level security;
revoke all on public.admin_professional_operations from public, anon, authenticated;
grant all on public.admin_professional_operations to service_role;

create function public.admin2_assert_actor(p_actor uuid, p_write boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_actor is null or not exists (
    select 1 from public.profiles p join auth.users u on u.id=p.auth_user_id
    where p.auth_user_id=p_actor and p.role='admin' and p.status='active'
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
  ) then raise exception using errcode='42501', message='Admin attivo richiesto'; end if;
  if p_write and not exists(select 1 from public.admin_settings where singleton and management_enabled) then
    raise exception using errcode='55000', message='Gestione non ancora disponibile';
  end if;
end;
$$;

-- Una sola volta per paziente; include entrambi i contratti esistenti.
create function public.admin2_active_patient_ids(p_professional uuid)
returns table(patient_id uuid) language sql stable security definer set search_path = '' as $$
  select pp.patient_id from public.professional_patients pp
  where pp.professional_id=p_professional and pp.status='active'
  union
  select pp.patient_id from public.professional_patients pp
  join public.patient_pathways pw on pw.professional_patient_id=pp.id
  where pp.professional_id=p_professional and pw.status='active';
$$;

create function public.admin2_management_snapshot(p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_settings jsonb; v_rows jsonb;
begin
  perform public.admin2_assert_actor(p_actor);
  select jsonb_build_object('version',1,'enabled',management_enabled,'default_patient_limit',default_patient_limit)
  into v_settings from public.admin_settings where singleton;
  select coalesce(jsonb_agg(jsonb_build_object(
    'professional_id',pr.id,'active_patient_count',c.n,
    'associated_patient_count',(select count(*) from public.professional_patients pp where pp.professional_id=pr.id),
    'active_patient_limit',s.active_patient_limit,
    'available_patient_slots',case when s.active_patient_limit is null then null else greatest(s.active_patient_limit-c.n,0) end
  )), '[]'::jsonb) into v_rows
  from public.professionals pr
  left join public.professional_settings s on s.professional_id=pr.id
  cross join lateral (select count(*) n from public.admin2_active_patient_ids(pr.id)) c;
  return v_settings || jsonb_build_object('capacity',v_rows);
end;
$$;

create function public.admin2_set_limits(p_actor uuid, p_limit integer, p_professional uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin2_assert_actor(p_actor,true);
  if p_limit is null or p_limit not between 1 and 100000 then
    raise exception using errcode='22023',message='Limite non valido';
  end if;
  if p_professional is null then
    update public.admin_settings set default_patient_limit=p_limit,updated_at=now() where singleton;
  else
    perform 1 from public.professionals pr join public.profiles p on p.id=pr.profile_id
      where pr.id=p_professional and p.role='professional' for update of pr;
    if not found then raise exception using errcode='22023',message='Professionista non disponibile'; end if;
    insert into public.professional_settings(professional_id,active_patient_limit)
      values(p_professional,p_limit)
      on conflict(professional_id) do update set active_patient_limit=excluded.active_patient_limit,updated_at=now();
  end if;
  -- Non modifica pazienti/percorsi o altri limiti individuali.
  return jsonb_build_object('ok',true,'limit',p_limit,'professional_id',p_professional);
end;
$$;

create function public.admin2_set_professional_status(p_actor uuid,p_professional uuid,p_expected text,p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile uuid; v_status text; v_entity text; v_auth uuid;
begin
  perform public.admin2_assert_actor(p_actor,true);
  if p_expected is null or p_status is null or (p_expected,p_status) not in (('active','suspended'),('suspended','active')) then
    raise exception using errcode='22023',message='Transizione non valida';
  end if;
  select p.id,p.status::text,pr.status::text,p.auth_user_id into v_profile,v_status,v_entity,v_auth
  from public.professionals pr join public.profiles p on p.id=pr.profile_id
  where pr.id=p_professional and p.role='professional' for update of pr,p;
  if not found then raise exception using errcode='22023',message='Professionista non disponibile'; end if;
  if v_status<>p_expected or v_entity<>'active' then
    raise exception using errcode='40001',message='Stato modificato o account bloccato';
  end if;
  if p_status='active' and not exists(select 1 from auth.users where id=v_auth
      and (banned_until is null or banned_until<=now()) and deleted_at is null) then
    raise exception using errcode='42501',message='Account Auth non disponibile';
  end if;
  update public.profiles set status=p_status::public.account_status where id=v_profile;
  return jsonb_build_object('ok',true,'professional_id',p_professional,'nubemo_status',p_status);
end;
$$;

-- Deduplicazione durevole prima di chiamare Auth/email; mai replay di invii incerti.
create function public.admin2_begin_email_operation(p_actor uuid,p_operation uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_existing public.admin_professional_operations; v_key text; v_email text; v_professional uuid;
begin
  perform public.admin2_assert_actor(p_actor,true);
  if p_operation is null or p_action is null or p_action not in ('invite-professional','resend-professional-invite') then
    raise exception using errcode='22023',message='Operazione non valida';
  end if;
  select * into v_existing from public.admin_professional_operations where id=p_operation for update;
  if found then
    if v_existing.actor_auth_id<>p_actor or v_existing.action<>p_action or v_existing.payload<>p_payload then
      raise exception using errcode='22023',message='Identificatore già utilizzato';
    end if;
    return jsonb_build_object('replay',true,'state',v_existing.state,'result',v_existing.result);
  end if;
  if p_action='invite-professional' then
    v_email:=lower(btrim(p_payload->>'email'));
    if v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      or length(btrim(coalesce(p_payload->>'first_name',''))) not between 1 and 100
      or length(btrim(coalesce(p_payload->>'last_name',''))) not between 1 and 100 then
      raise exception using errcode='22023',message='Dati invito non validi';
    end if;
    v_key:='invite:'||v_email;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key,0));
    if exists(select 1 from public.profiles where lower(btrim(email))=v_email)
      or exists(select 1 from auth.users where lower(btrim(email))=v_email) then
      raise exception using errcode='23505',message='Email già utilizzata';
    end if;
  else
    v_professional:=(p_payload->>'professional_id')::uuid;
    if not exists(select 1 from public.professionals pr join public.profiles p on p.id=pr.profile_id
      join auth.users u on u.id=p.auth_user_id where pr.id=v_professional
      and p.role='professional' and p.status='active' and pr.status='active'
      and u.email_confirmed_at is null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
      and lower(btrim(p.email))=lower(btrim(u.email))) then
      raise exception using errcode='42501',message='Reinvio non consentito per questo account';
    end if;
    v_key:='resend:'||v_professional::text;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key,0));
    if exists(select 1 from public.admin_professional_operations where operation_key=v_key
      and state='completed' and updated_at>now()-interval '60 seconds') then
      raise exception using errcode='55000',message='Attendi prima di reinviare';
    end if;
  end if;
  insert into public.admin_professional_operations(id,actor_auth_id,action,operation_key,payload)
    values(p_operation,p_actor,p_action,v_key,p_payload);
  return jsonb_build_object('replay',false,'state','started');
end;
$$;

create function public.admin2_finish_invite(p_actor uuid,p_operation uuid,p_auth_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_op public.admin_professional_operations; v_profile uuid; v_professional uuid; v_limit integer; v_result jsonb;
begin
  perform public.admin2_assert_actor(p_actor,true);
  select * into v_op from public.admin_professional_operations
    where id=p_operation and actor_auth_id=p_actor and action='invite-professional' for update;
  if not found or v_op.state<>'email_started' then
    raise exception using errcode='55000',message='Invito non finalizzabile';
  end if;
  if not exists(select 1 from auth.users where id=p_auth_user
    and lower(btrim(email))=v_op.payload->>'email' and created_at>=v_op.created_at
    and invited_at is not null and deleted_at is null
    and (banned_until is null or banned_until<=now()))
    or exists(select 1 from public.profiles where auth_user_id=p_auth_user or lower(btrim(email))=v_op.payload->>'email') then
    raise exception using errcode='23505',message='Identità invito non valida o già associata';
  end if;
  select default_patient_limit into v_limit from public.admin_settings where singleton;
  insert into public.profiles(auth_user_id,role,first_name,last_name,email,status)
    values(p_auth_user,'professional',v_op.payload->>'first_name',v_op.payload->>'last_name',v_op.payload->>'email','active')
    returning id into v_profile;
  insert into public.professionals(profile_id,status) values(v_profile,'active') returning id into v_professional;
  insert into public.professional_settings(professional_id,active_patient_limit) values(v_professional,v_limit);
  v_result:=jsonb_build_object('ok',true,'invited',true,'professional_id',v_professional,
    'profile_id',v_profile,'auth_user_id',p_auth_user,'email',v_op.payload->>'email','active_patient_limit',v_limit,'email_status','accepted');
  update public.admin_professional_operations set state='completed',result=v_result,updated_at=now() where id=p_operation;
  return v_result;
end;
$$;

create function public.admin2_protect_patient_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_assigned integer;
begin
  if tg_op='INSERT' and coalesce(auth.role(),'')<>'service_role' and not public.is_active_admin() then
    -- BEFORE INSERT è eseguito anche dagli upsert del bridge settings esistente.
    select active_patient_limit into v_assigned from public.professional_settings where professional_id=new.professional_id;
    if not found then raise exception using errcode='42501',message='Limite da configurare tramite Admin'; end if;
    if new.active_patient_limit is distinct from v_assigned and new.active_patient_limit is distinct from 10 then
      raise exception using errcode='42501',message='Limite modificabile soltanto da Admin';
    end if;
    new.active_patient_limit:=v_assigned;
    return new;
  end if;
  if tg_op='UPDATE' and new.professional_id<>old.professional_id then
    raise exception using errcode='42501',message='Professionista settings non modificabile';
  end if;
  if (tg_op='INSERT' or new.active_patient_limit is distinct from old.active_patient_limit)
    and coalesce(auth.role(),'')<>'service_role' and not public.is_active_admin() then
    raise exception using errcode='42501',message='Limite assegnato e modificabile soltanto da Admin';
  end if;
  return new;
end;
$$;
create trigger admin2_protect_patient_limit before insert or update on public.professional_settings
for each row execute function public.admin2_protect_patient_limit();

-- Volatile: dopo il lock ogni query vede le transazioni concorrenti già confermate.
-- Aggiorna la stessa riga settings: a REPEATABLE READ una corsa fallisce con 40001.
create function public.admin2_guard_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_professional uuid; v_patient uuid; v_limit integer; v_count integer; v_already boolean;
begin
  if new.status::text not in ('active','pending') then return new; end if;
  if tg_op='UPDATE' and new.status::text=old.status::text then
    if tg_table_name='professional_patients' and new.professional_id=old.professional_id and new.patient_id=old.patient_id then return new; end if;
    if tg_table_name='patient_pathways' and new.professional_patient_id=old.professional_patient_id and new.patient_id=old.patient_id then return new; end if;
  end if;
  if tg_table_name='professional_patients' then v_professional:=new.professional_id; v_patient:=new.patient_id;
  else select professional_id,patient_id into v_professional,v_patient from public.professional_patients where id=new.professional_patient_id; end if;
  -- Ordine lock condiviso con le azioni Admin: professionista, profilo, settings.
  perform 1 from public.professionals where id=v_professional for update;
  perform 1 from public.profiles p join public.professionals pr on pr.profile_id=p.id
    where pr.id=v_professional for share of p;
  -- Tutte le operazioni di aumento serializzano sulla riga dell'unica fonte del limite.
  update public.professional_settings set updated_at=now() where professional_id=v_professional
    returning active_patient_limit into v_limit;
  if not found or v_limit is null then
    raise exception using errcode='55000',message='Limite pazienti non configurato';
  end if;
  if not exists(select 1 from public.professionals pr join public.profiles p on p.id=pr.profile_id
    where pr.id=v_professional and pr.status='active' and p.role='professional' and p.status='active') then
    raise exception using errcode='42501',message='Professionista non attivo';
  end if;
  if new.status::text='pending' then return new; end if;
  select count(*),coalesce(bool_or(patient_id=v_patient),false) into v_count,v_already
    from public.admin2_active_patient_ids(v_professional);
  if not v_already and v_count>=v_limit then
    raise exception using errcode='23514',message='Limite pazienti attivi raggiunto';
  end if;
  return new;
end;
$$;
create trigger admin2_guard_association_capacity before insert or update of status,professional_id,patient_id
on public.professional_patients for each row execute function public.admin2_guard_capacity();
create trigger admin2_guard_pathway_capacity before insert or update of status,professional_patient_id,patient_id
on public.patient_pathways for each row execute function public.admin2_guard_capacity();

-- Nessuna RPC nuova è eseguibile dal browser; l'actor proviene da getUser() nella Edge.
revoke all on function public.admin2_assert_actor(uuid,boolean),
 public.admin2_active_patient_ids(uuid),public.admin2_management_snapshot(uuid),
 public.admin2_set_limits(uuid,integer,uuid),public.admin2_set_professional_status(uuid,uuid,text,text),
 public.admin2_begin_email_operation(uuid,uuid,text,jsonb),public.admin2_finish_invite(uuid,uuid,uuid),
 public.admin2_protect_patient_limit(),public.admin2_guard_capacity() from public,anon,authenticated;
grant execute on function public.admin2_assert_actor(uuid,boolean),
 public.admin2_active_patient_ids(uuid),public.admin2_management_snapshot(uuid),
 public.admin2_set_limits(uuid,integer,uuid),public.admin2_set_professional_status(uuid,uuid,text,text),
 public.admin2_begin_email_operation(uuid,uuid,text,jsonb),public.admin2_finish_invite(uuid,uuid,uuid) to service_role;
commit;
