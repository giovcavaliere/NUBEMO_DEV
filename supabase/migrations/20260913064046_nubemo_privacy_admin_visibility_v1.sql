drop policy if exists privacy_acceptances_select_admin on public.privacy_acceptances;

create policy privacy_acceptances_select_admin
on public.privacy_acceptances
for select to authenticated
using (is_active_admin());
