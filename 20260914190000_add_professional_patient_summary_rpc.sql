create or replace function public.get_professional_patient_summary(p_patient_id uuid)
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
), base as (
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
    c.goal_weight_kg,
    c.min_weight_kg,
    c.max_weight_kg,
    c.reasonable_weight_kg,
    c.theoretical_weight_kg,
    c.work,
    c.activity,
    c.activity_factor,
    c.smoking,
    c.alcohol,
    c.diagnosis,
    c.bowel,
    c.metabolism,
    c.feeg,
    c.impedance,
    c.family_obesity,
    c.family_diabetes,
    c.family_hypertension,
    c.family_cardiovascular,
    c.family_dyslipidemia,
    c.family_thyroid,
    c.previous_diets,
    c.allergies,
    c.medications,
    c.gi_issues,
    c.past_conditions,
    c.observations,
    c.objectives,
    coalesce((ps.settings_json->>'showEnergyValues')::boolean, true) as show_energy_values,
    coalesce((ps.settings_json->>'readOnly')::boolean, false) as read_only
  from me
  join public.professional_patients pp on pp.professional_id = me.professional_id
    and pp.patient_id = p_patient_id
    and pp.status::text = 'active'
  join public.patients p on p.id = pp.patient_id and p.status::text = 'active'
  join public.profiles prof on prof.id = p.profile_id
  left join public.patient_clinical_profiles c on c.patient_id = p.id
  left join public.patient_settings ps on ps.patient_id = p.id
), lw as (
  select de.entry_date, de.weight_kg
  from public.diary_entries de
  where de.patient_id = p_patient_id
    and de.deleted_at is null
    and de.weight_kg is not null
  order by de.entry_date desc
  limit 1
), lm as (
  select pm.id, pm.measured_at, pm.weight_kg, pm.waist_cm, pm.hips_cm, pm.notes
  from public.patient_measurements pm
  where pm.patient_id = p_patient_id and pm.deleted_at is null
  order by pm.measured_at desc, pm.created_at desc
  limit 1
), lc as (
  select de.entry_date, de.total_kcal, de.calorie_quality, de.calorie_calculated_at
  from public.diary_entries de
  where de.patient_id = p_patient_id
    and de.deleted_at is null
    and de.total_kcal is not null
  order by de.entry_date desc
  limit 1
), plan as (
  select exists(
    select 1 from public.documents d
    where d.patient_id = p_patient_id
      and d.deleted_at is null
      and d.sub_category = 'meal_plan'
  ) as has_plan
)
select case when exists(select 1 from base) then jsonb_build_object(
  'patient', to_jsonb(base),
  'latest_weight', coalesce((select jsonb_build_object('date',entry_date,'weight',weight_kg) from lw), 'null'::jsonb),
  'latest_measurement', coalesce((select jsonb_build_object('id',id,'date',measured_at,'weight',weight_kg,'waist',waist_cm,'hips',hips_cm,'notes',notes) from lm), 'null'::jsonb),
  'latest_calorie', coalesce((select jsonb_build_object('date',entry_date,'total_kcal',total_kcal,'quality',calorie_quality,'calculated_at',calorie_calculated_at) from lc), 'null'::jsonb),
  'has_plan', (select has_plan from plan)
) else null end
from base
limit 1;
$$;

grant execute on function public.get_professional_patient_summary(uuid) to authenticated;
