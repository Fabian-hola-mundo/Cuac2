-- 015_storage_admin.sql
-- Las escrituras a los tres buckets estaban abiertas a cualquier usuario
-- 'authenticated'. Se alinean con el mismo criterio que las tablas: is_admin().
-- La lectura pública de los buckets no cambia.

begin;

drop policy if exists "portfolio_storage_auth_insert" on storage.objects;
drop policy if exists "portfolio_storage_auth_update" on storage.objects;
drop policy if exists "portfolio_storage_auth_delete" on storage.objects;
drop policy if exists "productos_storage_auth_insert" on storage.objects;
drop policy if exists "productos_storage_auth_update" on storage.objects;
drop policy if exists "productos_storage_auth_delete" on storage.objects;
drop policy if exists "personajes-media: auth upload" on storage.objects;
drop policy if exists "personajes-media: auth update" on storage.objects;
drop policy if exists "personajes-media: auth delete" on storage.objects;

create policy storage_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('portfolio', 'productos', 'personajes-media') and public.is_admin());

create policy storage_admin_update on storage.objects
  for update to authenticated
  using      (bucket_id in ('portfolio', 'productos', 'personajes-media') and public.is_admin())
  with check (bucket_id in ('portfolio', 'productos', 'personajes-media') and public.is_admin());

create policy storage_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('portfolio', 'productos', 'personajes-media') and public.is_admin());

commit;
