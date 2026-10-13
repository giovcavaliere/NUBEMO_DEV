-- Tracciamento apertura informativa e conferma versione in Professional/Patient 2.0.
CREATE TABLE IF NOT EXISTS public.privacy_document_opens (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  privacy_document_id uuid NOT NULL REFERENCES public.privacy_documents(id) ON DELETE RESTRICT,
  opened_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id,privacy_document_id)
);
ALTER TABLE public.privacy_document_opens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.privacy_document_opens FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.privacy_document_opens TO service_role;

CREATE OR REPLACE FUNCTION public.nubemo_record_privacy_open(p_document uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_profile uuid; v_opened timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
 SELECT p.id INTO v_profile FROM public.profiles p
 WHERE p.auth_user_id=auth.uid() AND p.role IN ('professional','patient') AND p.status='active';
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.privacy_documents d
   WHERE d.id=p_document AND d.document_type='nubemo' AND d.active=true) THEN
   RAISE EXCEPTION 'document_not_available' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.privacy_document_opens(profile_id,privacy_document_id,opened_at)
 VALUES(v_profile,p_document,now())
 ON CONFLICT(profile_id,privacy_document_id) DO UPDATE SET opened_at=excluded.opened_at
 RETURNING opened_at INTO v_opened;
 RETURN v_opened;
END $$;

CREATE OR REPLACE FUNCTION public.nubemo_submit_privacy_choice(p_document uuid,p_accept boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_profile uuid; v_status text;
BEGIN
 IF auth.uid() IS NULL OR p_accept IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
 SELECT p.id INTO v_profile FROM public.profiles p
 WHERE p.auth_user_id=auth.uid() AND p.role IN ('professional','patient') AND p.status='active';
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.privacy_documents d
   WHERE d.id=p_document AND d.document_type='nubemo' AND d.active=true) THEN
   RAISE EXCEPTION 'document_not_available' USING ERRCODE='42501';
 END IF;
 IF p_accept AND NOT EXISTS(SELECT 1 FROM public.privacy_document_opens o
   WHERE o.profile_id=v_profile AND o.privacy_document_id=p_document) THEN
   RAISE EXCEPTION 'document_not_opened' USING ERRCODE='42501';
 END IF;
 v_status=CASE WHEN p_accept THEN 'accepted' ELSE 'refused' END;
 INSERT INTO public.privacy_acceptances(profile_id,privacy_document_id,status,accepted_at,refused_at)
 VALUES(v_profile,p_document,v_status,CASE WHEN p_accept THEN now() ELSE null END,
        CASE WHEN NOT p_accept THEN now() ELSE null END)
 ON CONFLICT(profile_id,privacy_document_id) DO UPDATE SET status=excluded.status,
  accepted_at=CASE WHEN p_accept THEN now() ELSE null END,
  refused_at=CASE WHEN NOT p_accept THEN now() ELSE public.privacy_acceptances.refused_at END;
 RETURN v_status;
END $$;
REVOKE ALL ON FUNCTION public.nubemo_record_privacy_open(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.nubemo_submit_privacy_choice(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.nubemo_record_privacy_open(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nubemo_submit_privacy_choice(uuid,boolean) TO authenticated;
