create policy diary_entries_select_own_history on public.diary_entries for select to authenticated using(deleted_at is null and patient_id=public.current_patient_id() and exists(select 1 from public.patient_pathways pw where pw.id=diary_entries.pathway_id and pw.patient_id=public.current_patient_id() and pw.status in ('active','ended')));
create or replace function public.patient2_soft_delete_own_diary_entry(p_entry_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 update public.diary_entries d set deleted_at=now(),updated_at=now()
 where d.id=p_entry_id and d.deleted_at is null
 and d.patient_id=public.current_patient_id()
 and d.pathway_id=public.current_active_pathway_id()
 and d.created_by_user_id=auth.uid();
 if not found then raise exception 'Giornata non eliminabile'; end if;
end $$;
revoke all on function public.patient2_soft_delete_own_diary_entry(uuid) from public;
grant execute on function public.patient2_soft_delete_own_diary_entry(uuid) to authenticated;