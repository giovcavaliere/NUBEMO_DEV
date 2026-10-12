-- Consente all'Admin attivo di aggiornare soltanto il limite predefinito,
-- senza attivare le operazioni di gestione dei professionisti.
CREATE OR REPLACE FUNCTION public.admin2_set_default_patient_limit(p_limit integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_limit integer;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100000 THEN
    RAISE EXCEPTION 'invalid_patient_limit' USING ERRCODE='22023';
  END IF;
  UPDATE public.admin_settings SET default_patient_limit=p_limit,updated_at=now()
  WHERE singleton=true RETURNING default_patient_limit INTO v_limit;
  IF NOT FOUND THEN RAISE EXCEPTION 'settings_unavailable'; END IF;
  RETURN v_limit;
END $$;
REVOKE ALL ON FUNCTION public.admin2_set_default_patient_limit(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin2_set_default_patient_limit(integer) TO authenticated;
