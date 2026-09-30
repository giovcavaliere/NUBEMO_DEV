do $$
declare
  v_oid oid;
  v_def text;
  v_new text;
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_professional_patient_list'
  limit 1;
  if v_oid is null then raise exception 'get_professional_patient_list non trovata'; end if;
  v_def := pg_get_functiondef(v_oid);
  v_new := replace(v_def,'    lh.height_cm,','    coalesce(lh.height_cm, p.height_cm) as height_cm,');
  if v_new = v_def then raise exception 'Patch height patient list non applicata'; end if;
  execute v_new;
end $$;

do $$
declare
  v_oid oid;
  v_def text;
  v_new text;
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_professional_bmi_patients'
  limit 1;
  if v_oid is null then raise exception 'get_professional_bmi_patients non trovata'; end if;
  v_def := pg_get_functiondef(v_oid);
  v_new := replace(v_def,'    lh.height_cm,','    coalesce(lh.height_cm, p.height_cm) as height_cm,');
  v_new := replace(
    v_new,
    '    case when lw.weight_kg is not null and lh.height_cm is not null and lh.height_cm > 0
      then round((lw.weight_kg / power(lh.height_cm / 100.0, 2))::numeric, 1)',
    '    case when lw.weight_kg is not null and coalesce(lh.height_cm, p.height_cm) is not null and coalesce(lh.height_cm, p.height_cm) > 0
      then round((lw.weight_kg / power(coalesce(lh.height_cm, p.height_cm) / 100.0, 2))::numeric, 1)'
  );
  if v_new = v_def then raise exception 'Patch height bmi patients non applicata'; end if;
  execute v_new;
end $$;

do $$
declare
  v_oid oid;
  v_def text;
  v_new text;
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_professional_dashboard'
  limit 1;
  if v_oid is null then raise exception 'get_professional_dashboard non trovata'; end if;
  v_def := pg_get_functiondef(v_oid);
  v_new := replace(
    v_def,
    '  select pw.id as pathway_id, pp.patient_id
  from me
  join public.professional_patients pp on pp.professional_id = me.professional_id
  join public.patient_pathways pw on pw.professional_patient_id = pp.id and pw.status = ''active''',
    '  select pw.id as pathway_id, pp.patient_id, p.height_cm as patient_height_cm
  from me
  join public.professional_patients pp on pp.professional_id = me.professional_id
  join public.patient_pathways pw on pw.professional_patient_id = pp.id and pw.status = ''active''
  join public.patients p on p.id = pp.patient_id'
  );
  v_new := replace(
    v_new,
    '    case when lh.height_cm is null or lh.height_cm <= 0 or lw.weight_kg is null or lw.weight_kg <= 0 then null
         else lw.weight_kg / power(lh.height_cm / 100.0, 2) end as bmi',
    '    case when coalesce(lh.height_cm, ap.patient_height_cm) is null or coalesce(lh.height_cm, ap.patient_height_cm) <= 0 or lw.weight_kg is null or lw.weight_kg <= 0 then null
         else lw.weight_kg / power(coalesce(lh.height_cm, ap.patient_height_cm) / 100.0, 2) end as bmi'
  );
  if v_new = v_def then raise exception 'Patch height dashboard non applicata'; end if;
  execute v_new;
end $$;
