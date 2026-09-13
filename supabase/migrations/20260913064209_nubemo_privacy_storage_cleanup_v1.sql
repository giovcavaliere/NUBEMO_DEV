drop policy if exists privacy_documents_storage_delete_own_professional on storage.objects;

create policy privacy_documents_storage_delete_own_professional
on storage.objects
for delete to authenticated
using (
  bucket_id = 'privacy-documents'
  and (storage.foldername(name))[1] = 'professionals'
  and exists (
    select 1
    from public.professionals pr
    join public.profiles p on p.id = pr.profile_id
    where p.auth_user_id = auth.uid()
      and p.role = 'professional'::app_role
      and p.status = 'active'::account_status
      and pr.id::text = (storage.foldername(name))[2]
  )
);
