-- Permite que visitantes anónimos lean productos activos en la tienda pública.
-- La política de admin (solo_admin_productos FOR ALL) sigue cubriendo
-- INSERT/UPDATE/DELETE y lectura de productos inactivos para el admin.
CREATE POLICY "productos_public_read" ON productos_evento
  FOR SELECT
  USING (activo = true);
