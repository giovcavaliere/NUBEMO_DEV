create or replace function public.patient2_owns_diary_pathway(p_pathway_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.patient_pathways pw
 where pw.id=p_pathway_id and pw.patient_id=public.current_patient_id() and pw.status in ('active','ended'))
$$;
revoke all on function public.patient2_owns_diary_pathway(uuid) from public;
grant execute on function public.patient2_owns_diary_pathway(uuid) to authenticated;
drop policy if exists diary_entries_select_own_history on public.diary_entries;
create policy diary_entries_select_own_history on public.diary_entries for select to authenticated
using(deleted_at is null and patient_id=public.current_patient_id()
 and public.patient2_owns_diary_pathway(pathway_id));