create table if not exists public.appointment_visits (
  id uuid primary key default gen_random_uuid(),
  appointment_patient_id uuid not null unique references public.appointment_patients(id) on delete restrict,
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  visit_note text not null default '',
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointment_visits_appointment_idx on public.appointment_visits(appointment_id);
create index if not exists appointment_visits_patient_idx on public.appointment_visits(patient_id);

alter table public.appointment_visits enable row level security;

drop policy if exists appointment_visits_select_own_professional on public.appointment_visits;
create policy appointment_visits_select_own_professional
on public.appointment_visits
for select
using (professional_id = public.current_active_professional_id());

drop policy if exists appointment_visits_insert_own_professional on public.appointment_visits;
create policy appointment_visits_insert_own_professional
on public.appointment_visits
for insert
with check (professional_id = public.current_active_professional_id());

drop policy if exists appointment_visits_update_own_professional on public.appointment_visits;
create policy appointment_visits_update_own_professional
on public.appointment_visits
for update
using (professional_id = public.current_active_professional_id())
with check (professional_id = public.current_active_professional_id());

drop trigger if exists appointment_visits_set_updated_at on public.appointment_visits;
create trigger appointment_visits_set_updated_at
before update on public.appointment_visits
for each row execute function public.set_updated_at();

create or replace function public.save_professional_visit(
  p_appointment_id uuid,
  p_patient_id uuid,
  p_visit_note text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_professional_id uuid;
  v_link_id uuid;
  v_visit_id uuid;
  v_registered_at timestamptz;
begin
  v_professional_id := public.current_active_professional_id();
  if v_professional_id is null then
    raise exception 'Professionista non autenticato';
  end if;

  select ap.id
    into v_link_id
  from public.appointment_patients ap
  join public.appointments a on a.id = ap.appointment_id
  where ap.appointment_id = p_appointment_id
    and ap.patient_id = p_patient_id
    and a.professional_id = v_professional_id
    and a.deleted_at is null
  limit 1;

  if v_link_id is null then
    raise exception 'Appuntamento o paziente non disponibile';
  end if;

  insert into public.appointment_visits(
    appointment_patient_id, appointment_id, patient_id, professional_id, visit_note
  )
  values(
    v_link_id, p_appointment_id, p_patient_id, v_professional_id, coalesce(p_visit_note,'')
  )
  on conflict (appointment_patient_id) do update
    set visit_note = excluded.visit_note,
        updated_at = now()
  returning id, registered_at into v_visit_id, v_registered_at;

  return jsonb_build_object(
    'status','saved',
    'visit_id',v_visit_id,
    'appointment_id',p_appointment_id,
    'patient_id',p_patient_id,
    'registered_at',v_registered_at
  );
end;
$$;

create or replace function public.correct_registered_visit_datetime(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_professional_id uuid;
begin
  v_professional_id := public.current_active_professional_id();
  if v_professional_id is null then
    raise exception 'Professionista non autenticato';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'Data o ora non valida';
  end if;
  if not exists (
    select 1
    from public.appointment_visits v
    join public.appointments a on a.id = v.appointment_id
    where v.appointment_id = p_appointment_id
      and a.professional_id = v_professional_id
      and a.deleted_at is null
  ) then
    raise exception 'Visita registrata non disponibile';
  end if;

  perform set_config('nubemo.allow_registered_visit_datetime_correction','on',true);

  update public.appointments
     set starts_at = p_starts_at,
         ends_at = p_ends_at,
         updated_at = now()
   where id = p_appointment_id
     and professional_id = v_professional_id
     and deleted_at is null;

  if not found then
    raise exception 'Appuntamento non disponibile';
  end if;

  return jsonb_build_object('status','saved','appointment_id',p_appointment_id);
end;
$$;

create or replace function public.protect_registered_appointment()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_allow_correction text;
begin
  if exists(select 1 from public.appointment_visits v where v.appointment_id = old.id) then
    if new.deleted_at is distinct from old.deleted_at then
      raise exception 'Appuntamento non eliminabile: visita registrata';
    end if;

    if new.starts_at is distinct from old.starts_at
       or new.ends_at is distinct from old.ends_at then
      v_allow_correction := current_setting('nubemo.allow_registered_visit_datetime_correction', true);
      if coalesce(v_allow_correction,'') <> 'on' then
        raise exception 'Data e ora bloccate: visita registrata';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_registered_appointment on public.appointments;
create trigger protect_registered_appointment
before update on public.appointments
for each row execute function public.protect_registered_appointment();

create or replace function public.protect_registered_appointment_patient()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_appointment_id uuid;
begin
  v_appointment_id := coalesce(new.appointment_id, old.appointment_id);

  if exists(select 1 from public.appointment_visits v where v.appointment_id = v_appointment_id) then
    raise exception 'Paziente appuntamento non modificabile: visita registrata';
  end if;

  return case when tg_op='DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_registered_appointment_patient on public.appointment_patients;
create trigger protect_registered_appointment_patient
before insert or update or delete on public.appointment_patients
for each row execute function public.protect_registered_appointment_patient();

grant execute on function public.save_professional_visit(uuid,uuid,text) to authenticated;
grant execute on function public.correct_registered_visit_datetime(uuid,timestamptz,timestamptz) to authenticated;
