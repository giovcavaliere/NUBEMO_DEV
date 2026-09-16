alter table public.profiles alter column auth_user_id drop not null;
alter table public.profiles alter column email drop not null;

create table public.professional_patient_drafts (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  phone text,
  status text not null default 'draft' check (status in ('draft','converted','archived')),
  converted_patient_id uuid references public.patients(id) on delete set null,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  converted_at timestamptz
);

create index professional_patient_drafts_professional_status_idx
  on public.professional_patient_drafts(professional_id,status,created_at desc);

alter table public.professional_patient_drafts enable row level security;

create policy professional_patient_drafts_select_own_professional
on public.professional_patient_drafts for select to authenticated
using (professional_id = public.current_active_professional_id());

create policy professional_patient_drafts_insert_own_professional
on public.professional_patient_drafts for insert to authenticated
with check (
  professional_id = public.current_active_professional_id()
  and created_by_user_id = auth.uid()
  and status = 'draft'
);

create policy professional_patient_drafts_update_own_professional
on public.professional_patient_drafts for update to authenticated
using (professional_id = public.current_active_professional_id())
with check (professional_id = public.current_active_professional_id());

alter table public.appointment_patients drop constraint appointment_patients_pkey;
alter table public.appointment_patients add column id uuid default gen_random_uuid() not null;
alter table public.appointment_patients add constraint appointment_patients_pkey primary key (id);
alter table public.appointment_patients alter column patient_id drop not null;
alter table public.appointment_patients add column draft_patient_id uuid references public.professional_patient_drafts(id) on delete restrict;
alter table public.appointment_patients add constraint appointment_patients_exactly_one_subject_chk
  check ((patient_id is not null)::int + (draft_patient_id is not null)::int = 1);
create unique index appointment_patients_patient_unique
  on public.appointment_patients(appointment_id,patient_id) where patient_id is not null;
create unique index appointment_patients_draft_unique
  on public.appointment_patients(appointment_id,draft_patient_id) where draft_patient_id is not null;

drop policy if exists appointment_patients_insert_associated_professional on public.appointment_patients;
drop policy if exists appointment_patients_update_associated_professional on public.appointment_patients;

create policy appointment_patients_insert_associated_professional
on public.appointment_patients for insert to authenticated
with check (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_patients.appointment_id
      and a.deleted_at is null
      and a.professional_id = public.current_active_professional_id()
  )
  and (
    (
      appointment_patients.patient_id is not null
      and exists (
        select 1 from public.professional_patients pp
        where pp.patient_id = appointment_patients.patient_id
          and pp.professional_id = public.current_active_professional_id()
          and pp.status <> 'ended'::public.relationship_status
      )
    )
    or
    (
      appointment_patients.draft_patient_id is not null
      and exists (
        select 1 from public.professional_patient_drafts d
        where d.id = appointment_patients.draft_patient_id
          and d.professional_id = public.current_active_professional_id()
          and d.status = 'draft'
      )
    )
  )
);

create policy appointment_patients_update_associated_professional
on public.appointment_patients for update to authenticated
using (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_patients.appointment_id
      and a.deleted_at is null
      and a.professional_id = public.current_active_professional_id()
  )
)
with check (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_patients.appointment_id
      and a.deleted_at is null
      and a.professional_id = public.current_active_professional_id()
  )
  and (
    (
      appointment_patients.patient_id is not null
      and exists (
        select 1 from public.professional_patients pp
        where pp.patient_id = appointment_patients.patient_id
          and pp.professional_id = public.current_active_professional_id()
          and pp.status <> 'ended'::public.relationship_status
      )
    )
    or
    (
      appointment_patients.draft_patient_id is not null
      and exists (
        select 1 from public.professional_patient_drafts d
        where d.id = appointment_patients.draft_patient_id
          and d.professional_id = public.current_active_professional_id()
          and d.status = 'draft'
      )
    )
  )
);