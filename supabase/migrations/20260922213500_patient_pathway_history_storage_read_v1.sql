create or replace function public.patient_storage_object_can_read(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, storage
as $$
declare
  v_folders text[];
  v_patient_id uuid;
  v_pathway_id uuid;
  v_professional_id uuid;
begin
  if auth.uid() is null or p_name is null then return false; end if;
  v_folders := storage.foldername(p_name);
  begin v_patient_id := nullif(v_folders[1],'')::uuid; exception when others then v_patient_id := null; end;
  begin v_pathway_id := nullif(v_folders[2],'')::uuid; exception when others then v_pathway_id := null; end;
  v_professional_id := public.current_active_professional_id();

  if v_patient_id is not null and v_pathway_id is not null then
    if not public.pathway_matches_patient(v_pathway_id, v_patient_id) then return false; end if;
    if v_professional_id is not null then
      return public.pathway_belongs_to_current_professional(v_pathway_id);
    end if;
    return v_patient_id = public.current_patient_id()
       and exists (
         select 1
         from public.patient_pathways pw
         where pw.id = v_pathway_id
           and pw.patient_id = v_patient_id
           and pw.status in ('active','ended')
       );
  end if;

  return exists (
    select 1
    from public.documents d
    join public.patient_pathways pw on pw.id = d.pathway_id
    where d.storage_bucket = 'patient-documents'
      and d.storage_path = p_name
      and d.deleted_at is null
      and (
        (v_professional_id is not null and public.pathway_belongs_to_current_professional(d.pathway_id))
        or
        (v_professional_id is null
          and d.patient_id = public.current_patient_id()
          and pw.patient_id = public.current_patient_id()
          and pw.status in ('active','ended'))
      )
  );
end;
$$;