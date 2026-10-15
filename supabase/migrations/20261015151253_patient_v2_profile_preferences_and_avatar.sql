-- NUBEMO 2.0 DEV — Migrazione Profilo paziente.
-- Applicata a Supabase DEV come versione 20261015151253.
alter table public.profiles add column if not exists patient_avatar_path text;

create table if not exists public.patient_contact_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  communications_email boolean not null default false,
  reminders_email boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.patient_contact_preferences enable row level security;

create policy patient_contact_preferences_select_self_or_professional on public.patient_contact_preferences
for select to authenticated using (
  profile_id=(select id from public.profiles where auth_user_id=auth.uid() and role='patient' and status='active' limit 1)
  or exists (
    select 1 from public.patients p
    join public.professional_patients pp on pp.patient_id=p.id
    where p.profile_id=patient_contact_preferences.profile_id
      and pp.professional_id=public.current_active_professional_id()
  )
);
create policy patient_contact_preferences_insert_own on public.patient_contact_preferences
for insert to authenticated with check (
  profile_id=(select id from public.profiles where auth_user_id=auth.uid() and role='patient' and status='active' limit 1)
);
create policy patient_contact_preferences_update_own on public.patient_contact_preferences
for update to authenticated using (
  profile_id=(select id from public.profiles where auth_user_id=auth.uid() and role='patient' and status='active' limit 1)
) with check (
  profile_id=(select id from public.profiles where auth_user_id=auth.uid() and role='patient' and status='active' limit 1)
);
grant select,insert,update on public.patient_contact_preferences to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('patient-avatars','patient-avatars',false,3145728,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;

create policy patient_avatars_read_own_or_professional on storage.objects
for select to authenticated using (
  bucket_id='patient-avatars'
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or exists (
      select 1 from public.profiles pr
      join public.patients p on p.profile_id=pr.id
      join public.professional_patients pp on pp.patient_id=p.id
      where pr.auth_user_id::text=(storage.foldername(name))[1]
        and pp.professional_id=public.current_active_professional_id()
    )
  )
);
create policy patient_avatars_upload_own on storage.objects
for insert to authenticated with check (
  bucket_id='patient-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
  and storage.extension(name) in ('jpg','jpeg','png','webp')
);
create policy patient_avatars_update_own on storage.objects
for update to authenticated using (
  bucket_id='patient-avatars' and (storage.foldername(name))[1]=auth.uid()::text
) with check (
  bucket_id='patient-avatars' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy patient_avatars_delete_own on storage.objects
for delete to authenticated using (
  bucket_id='patient-avatars' and (storage.foldername(name))[1]=auth.uid()::text
);

create or replace function public.nubemo_set_own_patient_avatar(p_path text)
returns void language plpgsql security definer set search_path=public as $$
declare v_profile uuid;
begin
  select id into v_profile from public.profiles
  where auth_user_id=auth.uid() and role='patient' and status='active' limit 1;
  if v_profile is null then raise exception 'Accesso negato'; end if;
  if p_path is not null and (p_path !~ ('^'||auth.uid()::text||'/avatar\.(jpg|jpeg|png|webp)$')) then
    raise exception 'Percorso foto non valido';
  end if;
  update public.profiles set patient_avatar_path=p_path where id=v_profile;
end;
$$;
revoke all on function public.nubemo_set_own_patient_avatar(text) from public;
grant execute on function public.nubemo_set_own_patient_avatar(text) to authenticated;
