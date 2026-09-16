create or replace function public.get_professional_patient_weight_trend(
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
  select d.entry_date, d.weight_kg
  from public.diary_entries d
  where exists (select 1 from allowed)
    and d.patient_id = p_patient_id
    and d.deleted_at is null
    and d.weight_kg is not null
    and (
      coalesce(p_days,0) <= 0
      or d.entry_date >= current_date - (greatest(1, least(p_days,3650)) - 1)
    )
  order by d.entry_date asc
)
select coalesce(
  jsonb_agg(jsonb_build_object('date', r.entry_date, 'weight', r.weight_kg) order by r.entry_date),
  '[]'::jsonb
)
from rows r;
$$;

grant execute on function public.get_professional_patient_weight_trend(uuid, integer) to authenticated;
