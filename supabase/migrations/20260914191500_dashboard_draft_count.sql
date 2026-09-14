create or replace function public.get_professional_dashboard()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with me as (
  select p.id as profile_id, pr.id as professional_id
  from public.profiles p
  join public.professionals pr on pr.profile_id = p.id
  where p.auth_user_id = auth.uid()
    and p.role::text = 'professional'
    and p.status::text = 'active'
    and pr.status::text = 'active'
  limit 1
),
active_rel as (
  select distinct pp.patient_id
  from public.professional_patients pp
  join me on me.professional_id = pp.professional_id
  where pp.status::text <> 'ended'
),
active_patients as (
  select p.id, p.height_cm
  from public.patients p
  join active_rel ar on ar.patient_id = p.id
),
latest_weights as (
  select distinct on (d.patient_id)
    d.patient_id,
    d.weight_kg
  from public.diary_entries d
  join active_rel ar on ar.patient_id = d.patient_id
  where d.deleted_at is null
    and d.weight_kg is not null
  order by d.patient_id, d.entry_date desc, d.updated_at desc nulls last, d.created_at desc
),
bmi_rows as (
  select ap.id,
    case
      when ap.height_cm is null or ap.height_cm <= 0 or lw.weight_kg is null or lw.weight_kg <= 0 then null
      else lw.weight_kg / power(ap.height_cm / 100.0, 2)
    end as bmi
  from active_patients ap
  left join latest_weights lw on lw.patient_id = ap.id
),
bmi_counts as (
  select jsonb_build_object(
    'underweight', count(*) filter (where bmi < 18.5),
    'normal', count(*) filter (where bmi >= 18.5 and bmi < 25),
    'overweight', count(*) filter (where bmi >= 25 and bmi < 30),
    'obesity1', count(*) filter (where bmi >= 30 and bmi < 35),
    'obesity2', count(*) filter (where bmi >= 35 and bmi < 40),
    'obesity3', count(*) filter (where bmi >= 40),
    'without_bmi', count(*) filter (where bmi is null)
  ) as value
  from bmi_rows
),
settings as (
  select coalesce(
    case
      when ps.settings_json->>'workDays' ~ '^[0-9]+$' then (ps.settings_json->>'workDays')::int
      else null
    end,
    cardinality(ps.work_days),
    5
  ) as work_days_count
  from me
  left join public.professional_settings ps on ps.professional_id = me.professional_id
  limit 1
),
today_rows as (
  select
    a.id,
    (a.starts_at at time zone 'Europe/Rome')::date as local_date,
    to_char(a.starts_at at time zone 'Europe/Rome','HH24:MI') as local_time,
    case
      when lower(coalesce(a.appointment_type,'')) like '%prima%' or lower(coalesce(a.appointment_type,'')) = 'first' then 'first'
      when lower(coalesce(a.appointment_type,'')) like '%personal%' or lower(coalesce(a.appointment_type,'')) like '%impegno%' or lower(coalesce(a.appointment_type,'')) = 'personal' then 'personal'
      else 'control'
    end as event_type,
    greatest(1, round(extract(epoch from (coalesce(a.ends_at,a.starts_at)-a.starts_at))/60.0)::int) as duration_min,
    coalesce(link.patient_id::text, link.draft_patient_id::text, '') as subject_id,
    coalesce(
      nullif(trim(concat(pp.first_name,' ',pp.last_name)),''),
      nullif(trim(concat(dp.first_name,' ',dp.last_name)),''),
      'Paziente'
    ) as subject_name,
    a.notes
  from public.appointments a
  join me on me.professional_id = a.professional_id
  left join lateral (
    select ap.patient_id, ap.draft_patient_id
    from public.appointment_patients ap
    where ap.appointment_id = a.id
    order by ap.created_at
    limit 1
  ) link on true
  left join public.patients pt on pt.id = link.patient_id
  left join public.profiles pp on pp.id = pt.profile_id
  left join public.professional_patient_drafts dp on dp.id = link.draft_patient_id
  where a.deleted_at is null
    and (a.starts_at at time zone 'Europe/Rome')::date = (now() at time zone 'Europe/Rome')::date
),
today_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'date', local_date,
    'time', local_time,
    'type', event_type,
    'duration', duration_min,
    'subject_id', subject_id,
    'subject_name', subject_name,
    'title', case when event_type='personal' then coalesce(notes,'Impegno personale') else '' end,
    'note', case when event_type='personal' then '' else coalesce(notes,'') end
  ) order by local_time), '[]'::jsonb) as value
  from today_rows
),
week_base as (
  select (date_trunc('week', now() at time zone 'Europe/Rome')::date + gs)::date as local_date
  from generate_series(0,6) as gs
),
week_events as (
  select
    (a.starts_at at time zone 'Europe/Rome')::date as local_date,
    case
      when lower(coalesce(a.appointment_type,'')) like '%prima%' or lower(coalesce(a.appointment_type,'')) = 'first' then 'first'
      when lower(coalesce(a.appointment_type,'')) like '%personal%' or lower(coalesce(a.appointment_type,'')) like '%impegno%' or lower(coalesce(a.appointment_type,'')) = 'personal' then 'personal'
      else 'control'
    end as event_type
  from public.appointments a
  join me on me.professional_id = a.professional_id
  where a.deleted_at is null
    and (a.starts_at at time zone 'Europe/Rome')::date between date_trunc('week', now() at time zone 'Europe/Rome')::date
      and date_trunc('week', now() at time zone 'Europe/Rome')::date + 6
),
week_count_rows as (
  select wb.local_date,
    count(*) filter (where we.event_type='first') as first_count,
    count(*) filter (where we.event_type='control') as control_count
  from week_base wb
  left join week_events we on we.local_date = wb.local_date
  group by wb.local_date
),
week_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', local_date,
    'first', first_count,
    'control', control_count
  ) order by local_date),'[]'::jsonb) as value
  from week_count_rows
),
unread as (
  select
    exists(
      select 1
      from public.documents d
      join active_rel ar on ar.patient_id = d.patient_id
      cross join me
      where d.deleted_at is null
        and d.category = 'health'
        and d.sub_category = 'health_other'
        and d.uploaded_by_user_id is distinct from auth.uid()
        and not exists (
          select 1 from public.document_read_status dr
          where dr.document_id = d.id
            and dr.profile_id = me.profile_id
            and dr.read_at is not null
        )
    ) as has_unread_documents,
    exists(
      select 1
      from public.documents d
      join active_rel ar on ar.patient_id = d.patient_id
      cross join me
      where d.deleted_at is null
        and d.category = 'health'
        and d.sub_category = 'blood_test'
        and d.uploaded_by_user_id is distinct from auth.uid()
        and not exists (
          select 1 from public.document_read_status dr
          where dr.document_id = d.id
            and dr.profile_id = me.profile_id
            and dr.read_at is not null
        )
    ) as has_unread_labs
)
select jsonb_build_object(
  'active_patient_count', (select count(*) from active_rel),
  'draft_patient_count', (
    select count(*)
    from public.professional_patient_drafts d
    join me on me.professional_id = d.professional_id
    where d.status = 'draft'
      and d.converted_patient_id is null
  ),
  'bmi_counts', coalesce((select value from bmi_counts), jsonb_build_object('underweight',0,'normal',0,'overweight',0,'obesity1',0,'obesity2',0,'obesity3',0,'without_bmi',0)),
  'today_appointments', coalesce((select value from today_json),'[]'::jsonb),
  'week_counts', coalesce((select value from week_json),'[]'::jsonb),
  'has_unread_documents', coalesce((select has_unread_documents from unread),false),
  'has_unread_labs', coalesce((select has_unread_labs from unread),false),
  'work_days_count', coalesce((select work_days_count from settings),5)
);
$$;

grant execute on function public.get_professional_dashboard() to authenticated;
