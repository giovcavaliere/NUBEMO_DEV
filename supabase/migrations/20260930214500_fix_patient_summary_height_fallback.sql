do $$
declare
  v_oid oid;
  v_def text;
  v_new text;
begin
  select p.oid into v_oid
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_professional_patient_summary'
  limit 1;

  if v_oid is null then
    raise exception 'get_professional_patient_summary non trovata';
  end if;

  v_def := pg_get_functiondef(v_oid);
  v_new := replace(
    v_def,
    '    lh.height_cm,',
    '    coalesce(lh.height_cm, p.height_cm) as height_cm,'
  );

  if v_new = v_def then
    raise exception 'Patch height patient summary non applicata';
  end if;

  execute v_new;
end $$;
