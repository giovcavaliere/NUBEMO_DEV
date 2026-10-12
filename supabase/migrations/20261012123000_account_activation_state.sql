-- Stato di attivazione applicativa distinto dalla conferma email Auth.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activation_completed_at timestamptz;
CREATE OR REPLACE FUNCTION public.nubemo_complete_own_activation()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_completed timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
 UPDATE public.profiles p
 SET activation_completed_at=coalesce(p.activation_completed_at,now()),updated_at=now()
 WHERE p.auth_user_id=auth.uid() AND p.role IN ('professional','patient') AND p.status='active'
 RETURNING p.activation_completed_at INTO v_completed;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_eligible' USING ERRCODE='42501'; END IF;
 RETURN v_completed;
END $$;
REVOKE ALL ON FUNCTION public.nubemo_complete_own_activation() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.nubemo_complete_own_activation() TO authenticated;
