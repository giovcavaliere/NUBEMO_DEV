-- Admin 2.0: profilo personale e immagine privata (solo NUBEMO DEV).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_avatar_path text;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('admin-assets','admin-assets',false,2097152,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin2_update_own_profile(p_first_name text, p_last_name text, p_avatar_path text)
RETURNS TABLE(id uuid, first_name text, last_name text, email text, admin_avatar_path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid; v_uid uuid := auth.uid();
BEGIN
  SELECT p.id INTO v_id FROM public.profiles p
  WHERE p.auth_user_id = v_uid AND p.role = 'admin' AND p.status = 'active';
  IF v_id IS NULL THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  IF p_first_name IS NULL OR char_length(btrim(p_first_name)) NOT BETWEEN 1 AND 100 OR
     p_last_name IS NULL OR char_length(btrim(p_last_name)) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid_name' USING ERRCODE='22023';
  END IF;
  IF p_avatar_path IS NOT NULL AND
     p_avatar_path NOT IN (v_uid::text || '/avatar.jpg',v_uid::text || '/avatar.png',v_uid::text || '/avatar.webp') THEN
    RAISE EXCEPTION 'invalid_avatar_path' USING ERRCODE='22023';
  END IF;
  RETURN QUERY UPDATE public.profiles p SET
    first_name=btrim(p_first_name),last_name=btrim(p_last_name),
    admin_avatar_path=p_avatar_path, updated_at=now()
  WHERE p.id=v_id
  RETURNING p.id,p.first_name,p.last_name,p.email,p.admin_avatar_path;
END $$;
REVOKE ALL ON FUNCTION public.admin2_update_own_profile(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin2_update_own_profile(text,text,text) TO authenticated;

CREATE POLICY admin_assets_select_own ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='admin-assets' AND (storage.foldername(name))[1]=auth.uid()::text AND public.is_active_admin());
CREATE POLICY admin_assets_insert_own ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='admin-assets' AND (storage.foldername(name))[1]=auth.uid()::text AND name ~ ('^' || auth.uid()::text || '/avatar\\.(jpg|png|webp)$') AND public.is_active_admin());
CREATE POLICY admin_assets_update_own ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='admin-assets' AND (storage.foldername(name))[1]=auth.uid()::text AND public.is_active_admin())
WITH CHECK (bucket_id='admin-assets' AND (storage.foldername(name))[1]=auth.uid()::text AND name ~ ('^' || auth.uid()::text || '/avatar\\.(jpg|png|webp)$') AND public.is_active_admin());
