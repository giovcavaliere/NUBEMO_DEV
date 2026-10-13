-- Pubblicazione atomica informativa NUBEMO, riservata all'Admin attivo.
CREATE OR REPLACE FUNCTION public.admin2_publish_privacy(p_version text,p_title text,p_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,storage,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.is_active_admin() THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_version,''))) NOT BETWEEN 1 AND 40 OR
    length(btrim(coalesce(p_title,''))) NOT BETWEEN 1 AND 120 OR
    p_path !~ '^nubemo/[a-f0-9-]{36}[.]pdf THEN
    RAISE EXCEPTION 'invalid_document_metadata' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='privacy-documents' AND name=p_path
               AND (metadata->>'mimetype')='application/pdf') THEN
    RAISE EXCEPTION 'pdf_not_uploaded' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('nubemo:privacy:publish'));
 IF EXISTS(SELECT 1 FROM public.privacy_documents WHERE document_type='nubemo' AND version=btrim(p_version)) THEN
   RAISE EXCEPTION 'version_already_exists' USING ERRCODE='23505';
 END IF;
 UPDATE public.privacy_documents SET active=false WHERE document_type='nubemo' AND active=true;
 INSERT INTO public.privacy_documents(document_type,version,title,storage_bucket,storage_path,published_at,active)
 VALUES('nubemo',btrim(p_version),btrim(p_title),'privacy-documents',p_path,now(),true)
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin2_publish_privacy(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin2_publish_privacy(text,text,text) TO authenticated;
 THEN
    RAISE EXCEPTION 'invalid_document_metadata' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='privacy-documents' AND name=p_path
               AND (metadata->>'mimetype')='application/pdf') THEN
    RAISE EXCEPTION 'pdf_not_uploaded' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('nubemo:privacy:publish'));
 IF EXISTS(SELECT 1 FROM public.privacy_documents WHERE document_type='nubemo' AND version=btrim(p_version)) THEN
   RAISE EXCEPTION 'version_already_exists' USING ERRCODE='23505';
 END IF;
 UPDATE public.privacy_documents SET active=false WHERE document_type='nubemo' AND active=true;
 INSERT INTO public.privacy_documents(document_type,version,title,storage_bucket,storage_path,published_at,active)
 VALUES('nubemo',btrim(p_version),btrim(p_title),'privacy-documents',p_path,now(),true)
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin2_publish_privacy(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin2_publish_privacy(text,text,text) TO authenticated;
