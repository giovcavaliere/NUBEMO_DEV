create or replace function public.get_current_patient_pathways()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with me as (
  select public.current_patient_id() as patient_id
), own as (
  select
    pw.id,
    pw.status,
    pw.pathway_start_date,
    pw.started_at,
    pw.ended_at,
    pw.created_at,
    trim(concat_ws(' ', pr.first_name, pr.last_name)) as professional_name
  from public.patient_pathways pw
  join public.professional_patients pp on pp.id = pw.professional_patient_id
  join public.professionals p on p.id = pp.professional_id
  join public.profiles pr on pr.id = p.profile_id
  join me on me.patient_id = pw.patient_id
  where pw.status = 'ended'
)
select coalesce(jsonb_agg(jsonb_build_object(
  'id', o.id,
  'status', o.status,
  'pathway_start_date', o.pathway_start_date,
  'started_at', o.started_at,
  'ended_at', o.ended_at,
  'created_at', o.created_at,
  'professional_name', o.professional_name
) order by coalesce(o.ended_at, o.started_at, o.created_at) desc), '[]'::jsonb)
from own o;
$$;

create or replace function public.get_current_patient_pathway_snapshot(p_pathway_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_allowed boolean;
  v_result jsonb;
begin
  v_patient_id := public.current_patient_id();
  if v_patient_id is null then
    raise exception 'Paziente non autenticato';
  end if;

  select exists(
    select 1
    from public.patient_pathways pw
    where pw.id = p_pathway_id
      and pw.patient_id = v_patient_id
      and pw.status = 'ended'
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Percorso non disponibile';
  end if;

  select jsonb_build_object(
    'pathway', (select to_jsonb(pw) from public.patient_pathways pw where pw.id = p_pathway_id),
    'diary', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.entry_date)
      from public.diary_entries d
      where d.pathway_id = p_pathway_id and d.deleted_at is null
    ), '[]'::jsonb),
    'plans', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.valid_from, n.created_at)
      from public.nutrition_plans n
      where n.pathway_id = p_pathway_id and n.deleted_at is null
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.document_date, d.created_at)
      from public.nutrition_plans n
      join public.nutrition_plan_documents npd on npd.nutrition_plan_id = n.id
      join public.documents d on d.id = npd.document_id
      where n.pathway_id = p_pathway_id
        and n.deleted_at is null
        and d.deleted_at is null
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_current_patient_pathways() to authenticated;
grant execute on function public.get_current_patient_pathway_snapshot(uuid) to authenticated;