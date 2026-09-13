grant select, insert, update on public.privacy_documents to authenticated;

drop policy if exists privacy_documents_select_admin on public.privacy_documents;
create policy privacy_documents_select_admin on public.privacy_documents
for select to authenticated
using (is_active_admin());

drop policy if exists privacy_documents_insert_admin on public.privacy_documents;
create policy privacy_documents_insert_admin on public.privacy_documents
for insert to authenticated
with check (is_active_admin());

drop policy if exists privacy_documents_update_admin on public.privacy_documents;
create policy privacy_documents_update_admin on public.privacy_documents
for update to authenticated
using (is_active_admin())
with check (is_active_admin());
