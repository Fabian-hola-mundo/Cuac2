-- Políticas de acceso para el bucket de Storage 'productos'
-- El bucket existía pero sin RLS policies → todos los uploads fallaban silenciosamente

CREATE POLICY "productos_storage_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'productos');

CREATE POLICY "productos_storage_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'productos');

CREATE POLICY "productos_storage_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'productos');

CREATE POLICY "productos_storage_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'productos');
