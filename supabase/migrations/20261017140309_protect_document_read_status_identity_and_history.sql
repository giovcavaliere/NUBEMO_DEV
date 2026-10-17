-- NUBEMO 2.0: protect read receipts without breaking client UPSERT.
-- Applied to NUBEMO_DEV at migration version 20261017140309.
CREATE OR REPLACE FUNCTION public.document_read_status_protect_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.document_id IS DISTINCT FROM OLD.document_id
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'document_read_status_identity_immutable' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.document_read_status_protect_identity() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS document_read_status_protect_identity ON public.document_read_status;
CREATE TRIGGER document_read_status_protect_identity
BEFORE UPDATE ON public.document_read_status
FOR EACH ROW EXECUTE FUNCTION public.document_read_status_protect_identity();

ALTER POLICY document_read_status_update_own_history ON public.document_read_status
WITH CHECK (
  profile_id = (SELECT p.profile_id FROM public.patients p WHERE p.id = public.current_patient_id())
  AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_read_status.document_id
      AND d.deleted_at IS NULL
      AND d.patient_id = public.current_patient_id()
  )
);
