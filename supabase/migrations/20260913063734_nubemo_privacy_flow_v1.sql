alter table public.privacy_acceptances
  add column if not exists status text not null default 'accepted',
  add column if not exists refused_at timestamptz;

alter table public.privacy_acceptances
  alter column accepted_at drop not null;

alter table public.privacy_acceptances
  drop constraint if exists privacy_acceptances_status_check;

alter table public.privacy_acceptances
  add constraint privacy_acceptances_status_check
  check (status in ('accepted','refused'));

update public.privacy_acceptances
set status = 'accepted'
where status is distinct from 'accepted' and accepted_at is not null;

create table if not exists public.professional_privacy_documents (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete restrict,
  version text not null,
  original_filename text not null,
  storage_bucket text not null default 'privacy-documents',
  storage_path text not null,
  active boolean not null default true,
  replaced_at timestamptz,
  created_at timestamptz not null default now(),
  constraint professional_privacy_documents_storage_uq unique (storage_bucket, storage_path)
);

create index if not exists professional_privacy_documents_professional_idx
  on public.professional_privacy_documents (professional_id, active, created_at desc);

create table if not exists public.patient_professional_privacy (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  professional_privacy_document_id uuid not null references public.professional_privacy_documents(id) on delete restrict,
  signed_storage_bucket text not null default 'privacy-documents',
  signed_storage_path text not null,
  original_filename text not null,
  uploaded_by_user_id uuid not null references auth.users(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  constraint patient_professional_privacy_storage_uq unique (signed_storage_bucket, signed_storage_path)
);

create index if not exists patient_professional_privacy_lookup_idx
  on public.patient_professional_privacy (professional_id, patient_id, uploaded_at desc);

alter table public.professional_privacy_documents enable row level security;
alter table public.patient_professional_privacy enable row level security;

grant select, insert, update on public.professional_privacy_documents to authenticated;
grant select, insert on public.patient_professional_privacy to authenticated;
grant update on public.privacy_acceptances to authenticated;

drop policy if exists privacy_acceptances_insert_own_patient on public.privacy_acceptances;
drop policy if exists privacy_acceptances_select_own_patient on public.privacy_acceptances;
drop policy if exists privacy_acceptances_insert_own_profile on public.privacy_acceptances;
drop policy if exists privacy_acceptances_select_own_profile on public.privacy_acceptances;
drop policy if exists privacy_acceptances_update_own_profile on public.privacy_acceptances;

create policy privacy_acceptances_select_own_profile
on public.privacy_acceptances
for select to authenticated
using (
  profile_id = (
    select p.id from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.status = 'active'::account_status
      and p.role in ('professional'::app_role,'patient'::app_role)
    limit 1
  )
);

create policy privacy_acceptances_insert_own_profile
on public.privacy_acceptances
for insert to authenticated
with check (
  profile_id = (
    select p.id from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.status = 'active'::account_status
      and p.role in ('professional'::app_role,'patient'::app_role)
    limit 1
  )
);

create policy privacy_acceptances_update_own_profile
on public.privacy_acceptances
for update to authenticated
using (
  profile_id = (
    select p.id from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.status = 'active'::account_status
      and p.role in ('professional'::app_role,'patient'::app_role)
    limit 1
  )
)
with check (
  profile_id = (
    select p.id from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.status = 'active'::account_status
      and p.role in ('professional'::app_role,'patient'::app_role)
    limit 1
  )
);

drop policy if exists professional_privacy_documents_select_own on public.professional_privacy_documents;
drop policy if exists professional_privacy_documents_insert_own on public.professional_privacy_documents;
drop policy if exists professional_privacy_documents_update_own on public.professional_privacy_documents;

create policy professional_privacy_documents_select_own
on public.professional_privacy_documents
for select to authenticated
using (professional_id = current_active_professional_id());

create policy professional_privacy_documents_insert_own
on public.professional_privacy_documents
for insert to authenticated
with check (professional_id = current_active_professional_id());

create policy professional_privacy_documents_update_own
on public.professional_privacy_documents
for update to authenticated
using (professional_id = current_active_professional_id())
with check (professional_id = current_active_professional_id());

drop policy if exists patient_professional_privacy_select_associated_professional on public.patient_professional_privacy;
drop policy if exists patient_professional_privacy_insert_active_professional on public.patient_professional_privacy;

create policy patient_professional_privacy_select_associated_professional
on public.patient_professional_privacy
for select to authenticated
using (
  professional_id = current_active_professional_id()
  and exists (
    select 1 from public.professional_patients pp
    where pp.professional_id = patient_professional_privacy.professional_id
      and pp.patient_id = patient_professional_privacy.patient_id
  )
);

create policy patient_professional_privacy_insert_active_professional
on public.patient_professional_privacy
for insert to authenticated
with check (
  professional_id = current_active_professional_id()
  and uploaded_by_user_id = auth.uid()
  and exists (
    select 1 from public.professional_patients pp
    where pp.professional_id = patient_professional_privacy.professional_id
      and pp.patient_id = patient_professional_privacy.patient_id
      and pp.status <> 'ended'::relationship_status
  )
);

drop policy if exists privacy_documents_storage_select_active_users on storage.objects;
drop policy if exists privacy_documents_storage_select_nubemo_active_users on storage.objects;
drop policy if exists privacy_documents_storage_select_own_professional on storage.objects;
drop policy if exists privacy_documents_storage_insert_own_professional on storage.objects;
drop policy if exists privacy_documents_storage_update_own_professional on storage.objects;

create policy privacy_documents_storage_select_nubemo_active_users
on storage.objects
for select to authenticated
using (
  bucket_id = 'privacy-documents'
  and (storage.foldername(name))[1] = 'nubemo'
  and exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid() and p.status = 'active'::account_status
  )
);

create policy privacy_documents_storage_select_own_professional
on storage.objects
for select to authenticated
using (
  bucket_id = 'privacy-documents'
  and (storage.foldername(name))[1] = 'professionals'
  and exists (
    select 1
    from public.professionals pr
    join public.profiles p on p.id = pr.profile_id
    where p.auth_user_id = auth.uid()
      and p.role = 'professional'::app_role
      and p.status = 'active'::account_status
      and pr.id::text = (storage.foldername(name))[2]
  )
);

create policy privacy_documents_storage_insert_own_professional
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'privacy-documents'
  and (storage.foldername(name))[1] = 'professionals'
  and exists (
    select 1
    from public.professionals pr
    join public.profiles p on p.id = pr.profile_id
    where p.auth_user_id = auth.uid()
      and p.role = 'professional'::app_role
      and p.status = 'active'::account_status
      and pr.id::text = (storage.foldername(name))[2]
  )
);

create policy privacy_documents_storage_update_own_professional
on storage.objects
for update to authenticated
using (
  bucket_id = 'privacy-documents'
  and (storage.foldername(name))[1] = 'professionals'
  and exists (
    select 1
    from public.professionals pr
    join public.profiles p on p.id = pr.profile_id
    where p.auth_user_id = auth.uid()
      and p.role = 'professional'::app_role
      and p.status = 'active'::account_status
      and pr.id::text = (storage.foldername(name))[2]
  )
)
with check (
  bucket_id = 'privacy-documents'
  and (storage.foldername(name))[1] = 'professionals'
  and exists (
    select 1
    from public.professionals pr
    join public.profiles p on p.id = pr.profile_id
    where p.auth_user_id = auth.uid()
      and p.role = 'professional'::app_role
      and p.status = 'active'::account_status
      and pr.id::text = (storage.foldername(name))[2]
  )
);
