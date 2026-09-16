create or replace function public.get_professional_patient_list()
returns jsonb
language sql
stable
set search_path = public
as $$
with me as (
  select pr.id as professional_id, pf.id as profile_id
  from public.professionals pr
  join public.profiles pf on pf.id = pr.profile_id
  where pf.auth_user_id = auth.uid()
    and pf.status::text = 'active'
    and pr.status::text = 'active'
  limit 1
), active_rows as (
  select
    p.id,
    p.profile_id,
    coalesce(nullif(trim(concat_ws(' ', prof.first_name, prof.last_name)), ''), prof.email, 'Paziente') as name,
    coalesce(prof.first_name, '') as first_name,
    coalesce(prof.last_name, '') as last_name,
    coalesce(prof.phone, '') as phone,
    coalesce(prof.email, '') as email,
    p.birth_date,
    p.sex,
    p.height_cm,
    p.pathway_start_date,
    p.status::text as patient_status,
    pp.started_at,
    fw.weight_kg as first_weight,
    lw.weight_kg as last_weight,
    exists (
      select 1
      from public.documents d
      cross join me mx
      where d.patient_id = p.id
        and d.deleted_at is null
        and d.category = 'health'
        and d.sub_category = 'health_other'
        and d.uploaded_by_user_id <> auth.uid()
        and not exists (
          select 1 from public.document_read_status drs
          where drs.document_id = d.id
            and drs.profile_id = mx.profile_id
            and drs.read_at is not null
        )
    ) as unread_documents,
    exists (
      select 1
      from public.documents d
      cross join me mx
      where d.patient_id = p.id
        and d.deleted_at is null
        and d.category = 'health'
        and d.sub_category = 'blood_test'
        and d.uploaded_by_user_id <> auth.uid()
        and not exists (
          select 1 from public.document_read_status drs
          where drs.document_id = d.id
            and drs.profile_id = mx.profile_id
            and drs.read_at is not null
        )
    ) as unread_labs
  from me
  join public.professional_patients pp on pp.professional_id = me.professional_id and pp.status::text = 'active'
  join public.patients p on p.id = pp.patient_id and p.status::text = 'active'
  join public.profiles prof on prof.id = p.profile_id
  left join lateral (
    select de.weight_kg
    from public.diary_entries de
    where de.patient_id = p.id and de.deleted_at is null and de.weight_kg is not null
    order by de.entry_date asc
    limit 1
  ) fw on true
  left join lateral (
    select de.weight_kg
    from public.diary_entries de
    where de.patient_id = p.id and de.deleted_at is null and de.weight_kg is not null
    order by de.entry_date desc
    limit 1
  ) lw on true
), draft_rows as (
  select
    d.id,
    coalesce(nullif(trim(concat_ws(' ', d.first_name, d.last_name)), ''), 'Contatto') as name,
    coalesce(d.first_name, '') as first_name,
    coalesce(d.last_name, '') as last_name,
    coalesce(d.phone, '') as phone,
    d.status,
    d.converted_patient_id,
    d.created_at
  from me
  join public.professional_patient_drafts d on d.professional_id = me.professional_id
  where d.status = 'draft' and d.converted_patient_id is null
)
select jsonb_build_object(
  'patients', coalesce((select jsonb_agg(to_jsonb(a) order by a.name) from active_rows a), '[]'::jsonb),
  'drafts', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at) from draft_rows d), '[]'::jsonb)
);
$$;

grant execute on function public.get_professional_patient_list() to authenticated;

create or replace function public.get_professional_bmi_patients(p_category text)
returns jsonb
language sql
stable
set search_path = public
as $$
with me as (
  select pr.id as professional_id
  from public.professionals pr
  join public.profiles pf on pf.id = pr.profile_id
  where pf.auth_user_id = auth.uid()
    and pf.status::text = 'active'
    and pr.status::text = 'active'
  limit 1
), rows as (
  select
    p.id,
    coalesce(nullif(trim(concat_ws(' ', prof.first_name, prof.last_name)), ''), prof.email, 'Paziente') as name,
    lw.weight_kg as weight,
    p.height_cm,
    case when lw.weight_kg is not null and p.height_cm is not null and p.height_cm > 0
      then round((lw.weight_kg / power(p.height_cm / 100.0, 2))::numeric, 1)
      else null end as bmi
  from me
  join public.professional_patients pp on pp.professional_id = me.professional_id and pp.status::text = 'active'
  join public.patients p on p.id = pp.patient_id and p.status::text = 'active'
  join public.profiles prof on prof.id = p.profile_id
  left join lateral (
    select de.weight_kg
    from public.diary_entries de
    where de.patient_id = p.id and de.deleted_at is null and de.weight_kg is not null
    order by de.entry_date desc
    limit 1
  ) lw on true
), categorized as (
  select *, case
    when bmi is null then 'Senza BMI'
    when bmi < 18.5 then 'Sottopeso'
    when bmi < 25 then 'Normopeso'
    when bmi < 30 then 'Sovrappeso'
    when bmi < 35 then 'Obesità I'
    when bmi < 40 then 'Obesità II'
    else 'Obesità III'
  end as category
  from rows
)
select coalesce(jsonb_agg(jsonb_build_object(
  'id', id,
  'name', name,
  'weight', weight,
  'height', height_cm,
  'bmi', bmi
) order by name), '[]'::jsonb)
from categorized
where category = p_category;
$$;

grant execute on function public.get_professional_bmi_patients(text) to authenticated;
