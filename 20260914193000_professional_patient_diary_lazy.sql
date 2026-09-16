create or replace function public.get_professional_patient_diary(
  p_patient_id uuid,
  p_days integer default 30
)
returns jsonb
language sql
stable
security invoker
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
), allowed as (
  select 1
  from public.professional_patients pp
  join me on me.professional_id = pp.professional_id
  where pp.patient_id = p_patient_id
    and pp.status::text <> 'ended'
  limit 1
), rows as (
  select
    d.id,
    d.patient_id,
    d.entry_date,
    d.weight_kg,
    d.water,
    d.coffee,
    d.sweetener,
    d.breakfast,
    d.morning_snack,
    d.lunch,
    d.afternoon_snack,
    d.dinner,
    d.sport,
    d.notes,
    d.breakfast_kcal,
    d.morning_snack_kcal,
    d.lunch_kcal,
    d.afternoon_snack_kcal,
    d.dinner_kcal,
    d.total_kcal,
    d.calorie_quality,
    d.calorie_calculated_at,
    d.created_at,
    d.updated_at
  from public.diary_entries d
  where exists (select 1 from allowed)
    and d.patient_id = p_patient_id
    and d.deleted_at is null
    and d.entry_date >= current_date - (greatest(1, least(coalesce(p_days,30), 3650)) - 1)
  order by d.entry_date asc, d.updated_at asc nulls first, d.created_at asc
)
select coalesce(jsonb_agg(to_jsonb(r) order by r.entry_date), '[]'::jsonb)
from rows r;
$$;

grant execute on function public.get_professional_patient_diary(uuid, integer) to authenticated;
