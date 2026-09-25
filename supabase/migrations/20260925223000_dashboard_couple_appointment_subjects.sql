create or replace function public.get_professional_dashboard()
returns jsonb
language sql
stable
security definer
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
active_pathways as (
  select pw.id as pathway_id, pp.patient_id
  from me
  join public.professional_patients pp on pp.professional_id = me.professional_id
  join public.patient_pathways pw on pw.professional_patient_id = pp.id and pw.status = 'active'
),
bmi_rows as (
  select ap.patient_id,
    case when lh.height_cm is null or lh.height_cm <= 0 or lw.weight_kg is null or lw.weight_kg <= 0 then null
         else lw.weight_kg / power(lh.height_cm / 100.0, 2) end as bmi
  from active_pathways ap
  left join lateral (
    select de.weight_kg from public.diary_entries de
    where de.pathway_id = ap.pathway_id and de.deleted_at is null and de.weight_kg is not null
    order by de.entry_date desc limit 1
  ) lw on true
  left join lateral (
    select pm.height_cm from public.patient_measurements pm
    where pm.pathway_id = ap.pathway_id and pm.deleted_at is null and pm.height_cm is not null
    order by pm.measured_at desc, pm.created_at desc limit 1
  ) lh on true
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
  ) as value from bmi_rows
),
settings as (
  select coalesce(
    case when ps.settings_json->>'workDays' ~ '^[0-9]+$' then (ps.settings_json->>'workDays')::int else null end,
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
      when lower(coalesce(a.appointment_type,'')) like '%prima%' or lower(coalesce(a.appointment_type,''))='first' then 'first'
      when lower(coalesce(a.appointment_type,'')) like '%personal%' or lower(coalesce(a.appointment_type,'')) like '%impegno%' or lower(coalesce(a.appointment_type,''))='personal' then 'personal'
      else 'control'
    end as event_type,
    greatest(1, round(extract(epoch from (coalesce(a.ends_at,a.starts_at)-a.starts_at))/60.0)::int) as duration_min,
    coalesce(subjects.items->0->>'id','') as subject_id,
    coalesce(subjects.items->0->>'name','Paziente') as subject_name,
    coalesce(subjects.items,'[]'::jsonb) as subjects,
    a.notes
  from public.appointments a
  join me on me.professional_id = a.professional_id
  left join lateral (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', coalesce(ap.patient_id::text, ap.draft_patient_id::text),
          'name', coalesce(
            nullif(trim(concat(ppf.first_name,' ',ppf.last_name)),''),
            nullif(trim(concat(dp.first_name,' ',dp.last_name)),''),
            'Paziente'
          )
        )
        order by ap.created_at
      ) filter (where ap.patient_id is not null or ap.draft_patient_id is not null),
      '[]'::jsonb
    ) as items
    from public.appointment_patients ap
    left join public.patients pt on pt.id = ap.patient_id
    left join public.profiles ppf on ppf.id = pt.profile_id
    left join public.professional_patient_drafts dp on dp.id = ap.draft_patient_id
    where ap.appointment_id = a.id
  ) subjects on true
  where a.deleted_at is null
    and (a.starts_at at time zone 'Europe/Rome')::date = (now() at time zone 'Europe/Rome')::date
),
today_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',id,
        'date',local_date,
        'time',local_time,
        'type',event_type,
        'duration',duration_min,
        'subject_id',subject_id,
        'subject_name',subject_name,
        'subjects',subjects,
        'title',case when event_type='personal' then coalesce(notes,'Impegno personale') else '' end,
        'note',case when event_type='personal' then '' else coalesce(notes,'') end
      )
      order by local_time
    ),
    '[]'::jsonb
  ) as value
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
      when lower(coalesce(a.appointment_type,'')) like '%prima%' or lower(coalesce(a.appointment_type,''))='first' then 'first'
      when lower(coalesce(a.appointment_type,'')) like '%personal%' or lower(coalesce(a.appointment_type,'')) like '%impegno%' or lower(coalesce(a.appointment_type,''))='personal' then 'personal'
      else 'control'
    end as event_type
  from public.appointments a
  join me on me.professional_id = a.professional_id
  where a.deleted_at is null
    and (a.starts_at at time zone 'Europe/Rome')::date between date_trunc('week', now() at time zone 'Europe/Rome')::date
      and date_trunc('week', now() at time zone 'Europe/Rome')::date + 6
),
week_count_rows as (
  select
    wb.local_date,
    count(*) filter(where we.event_type='first') as first_count,
    count(*) filter(where we.event_type='control') as control_count
  from week_base wb
  left join week_events we on we.local_date=wb.local_date
  group by wb.local_date
),
week_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object('date',local_date,'first',first_count,'control',control_count)
      order by local_date
    ),
    '[]'::jsonb
  ) as value
  from week_count_rows
),
unread as (
  select
    exists(
      select 1
      from public.documents d
      join active_pathways ap on ap.pathway_id=d.pathway_id
      cross join me
      where d.deleted_at is null
        and d.category='health'
        and d.sub_category='health_other'
        and d.uploaded_by_user_id is distinct from auth.uid()
        and not exists(
          select 1
          from public.document_read_status dr
          where dr.document_id=d.id
            and dr.profile_id=me.profile_id
            and dr.read_at is not null
        )
    ) as has_unread_documents,
    exists(
      select 1
      from public.documents d
      join active_pathways ap on ap.pathway_id=d.pathway_id
      cross join me
      where d.deleted_at is null
        and d.category='health'
        and d.sub_category='blood_test'
        and d.uploaded_by_user_id is distinct from auth.uid()
        and not exists(
          select 1
          from public.document_read_status dr
          where dr.document_id=d.id
            and dr.profile_id=me.profile_id
            and dr.read_at is not null
        )
    ) as has_unread_labs
)
select jsonb_build_object(
  'active_patient_count',(select count(*) from active_pathways),
  'draft_patient_count',(
    select count(*)
    from public.professional_patient_drafts d
    join me on me.professional_id=d.professional_id
    where d.status='draft'
      and d.converted_patient_id is null
  ),
  'bmi_counts',coalesce(
    (select value from bmi_counts),
    jsonb_build_object(
      'underweight',0,'normal',0,'overweight',0,
      'obesity1',0,'obesity2',0,'obesity3',0,'without_bmi',0
    )
  ),
  'today_appointments',coalesce((select value from today_json),'[]'::jsonb),
  'week_counts',coalesce((select value from week_json),'[]'::jsonb),
  'has_unread_documents',coalesce((select has_unread_documents from unread),false),
  'has_unread_labs',coalesce((select has_unread_labs from unread),false),
  'work_days_count',coalesce((select work_days_count from settings),5)
);
$$;