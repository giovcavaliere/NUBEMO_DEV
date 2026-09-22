revoke execute on function public.get_current_patient_pathways() from public, anon;
revoke execute on function public.get_current_patient_pathway_snapshot(uuid) from public, anon;
grant execute on function public.get_current_patient_pathways() to authenticated;
grant execute on function public.get_current_patient_pathway_snapshot(uuid) to authenticated;