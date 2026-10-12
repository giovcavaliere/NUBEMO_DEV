-- Correzione delle policy per le foto Admin: confronto esatto del percorso.
DROP POLICY IF EXISTS admin_assets_insert_own ON storage.objects;
DROP POLICY IF EXISTS admin_assets_update_own ON storage.objects;
CREATE POLICY admin_assets_insert_own ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='admin-assets'
  AND public.is_active_admin()
  AND name IN (auth.uid()::text || '/avatar.jpg', auth.uid()::text || '/avatar.png', auth.uid()::text || '/avatar.webp')
);
CREATE POLICY admin_assets_update_own ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id='admin-assets'
  AND public.is_active_admin()
  AND (storage.foldername(name))[1]=auth.uid()::text
)
WITH CHECK (
  bucket_id='admin-assets'
  AND public.is_active_admin()
  AND name IN (auth.uid()::text || '/avatar.jpg', auth.uid()::text || '/avatar.png', auth.uid()::text || '/avatar.webp')
);
