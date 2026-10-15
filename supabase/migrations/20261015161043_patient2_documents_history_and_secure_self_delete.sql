create policy documents_select_own_history on public.documents for select to authenticated using (deleted_at is null and patient_id=public.current_patient_id() and exists(select 1 from public.patient_pathways pw where pw.id=documents.pathway_id and pw.patient_id=public.current_patient_id() and pw.status in ('active','ended')));
create policy document_read_status_select_own_history on public.document_read_status for select to authenticated using(profile_id=(select p.profile_id from public.patients p where p.id=public.current_patient_id()) and exists(select 1 from public.documents d where d.id=document_read_status.document_id and d.deleted_at is null and d.patient_id=public.current_patient_id()));
create policy document_read_status_insert_own_history on public.document_read_status for insert to authenticated with check(profile_id=(select p.profile_id from public.patients p where p.id=public.current_patient_id()) and exists(select 1 from public.documents d where d.id=document_read_status.document_id and d.deleted_at is null and d.patient_id=public.current_patient_id()));
create policy document_read_status_update_own_history on public.document_read_status for update to authenticated using(profile_id=(select p.profile_id from public.patients p where p.id=public.current_patient_id()) and exists(select 1 from public.documents d where d.id=document_read_status.document_id and d.deleted_at is null and d.patient_id=public.current_patient_id())) with check(profile_id=(select p.profile_id from public.patients p where p.id=public.current_patient_id()));
create or replace function public.patient2_soft_delete_own_document(p_document_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 select d.id into v_id from public.documents d
 where d.id=p_document_id and d.deleted_at is null and d.patient_id=public.current_patient_id()
 and d.uploaded_by_user_id=auth.uid() and d.category='health'
 and d.pathway_id=public.current_active_pathway_id()
 and not exists(select 1 from public.nutrition_plan_documents l where l.document_id=d.id)
 for update;
 if v_id is null then raise exception 'Documento non eliminabile'; end if;
 update public.documents set deleted_at=now(),updated_at=now() where id=v_id;
end $$;
revoke all on function public.patient2_soft_delete_own_document(uuid) from public;
grant execute on function public.patient2_soft_delete_own_document(uuid) to authenticated;