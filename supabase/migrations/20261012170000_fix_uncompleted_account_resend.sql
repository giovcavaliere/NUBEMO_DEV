-- Reinvio per account NUBEMO non attivato, indipendente dalla conferma email Auth.
create or replace function public.admin2_begin_email_operation(p_actor uuid,p_operation uuid,p_action text,p_payload jsonb)
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
      and p.activation_completed_at is null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
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

