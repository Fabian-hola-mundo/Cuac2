# Spec: Productos con fotos + tienda conectada

**Fecha:** 2026-06-03  
**Proyecto:** cuac-design / Cuaquiverso

---

## Contexto

La tienda de Cuaquiverso (`/cuaquiverso/tienda`) usa 42 productos hardcodeados. El admin (`/admin/productos`) crea productos reales en Supabase (`productos_evento`), pero sin fotos ni campos de apariencia. El objetivo es unificar ambos: el admin gestiona el catálogo completo (con fotos y metadatos visuales) y la tienda lo consume en tiempo real.

---

## Cambio 1 — Texto hero de la tienda

Reemplazar el párrafo actual del `shop-hero` en `tienda.component.html:48`:

**Nuevo texto:**  
"Trabajamos en cantidades pensadas. Algunos productos vuelven, otros son únicos. La mejor forma de no perderte nada es actuar cuando algo te gusta."

---

## Cambio 2 — DB Migration (`productos_evento`)

Agregar columnas vía `ALTER TABLE` en Supabase (proyecto cuaquiverso-pos):

```sql
ALTER TABLE productos_evento
  ADD COLUMN IF NOT EXISTS cover_url   TEXT,
  ADD COLUMN IF NOT EXISTS fotos       TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS material    TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS color       TEXT,
  ADD COLUMN IF NOT EXISTS flag        TEXT,
  ADD COLUMN IF NOT EXISTS descripcion TEXT;
```

Valores de `flag`: `'new'` | `'last'` | `NULL`.  
Valores de `color`: tokens CSS del proyecto (`rio`, `rosa`, `sol`, `bone`, `terra`, `lila`, `selva`, `tibu`, `cream`).  
Valores de `material`: subconjunto de `algodon`, `lona`, `papel`, `vinilo`, `esmalte`.

---

## Cambio 3 — Supabase Storage

Crear bucket público `productos`. El bucket `portfolio` ya existe y es la referencia — mismo patrón de acceso público.

---

## Cambio 4 — `InventarioService`

- Actualizar interfaz `ProductoEvento` con los 6 campos nuevos.
- Agregar método `uploadProductoImage(productoId, file, name): Promise<{ url, error }>` que sube a `productos/<productoId>/<name>` y retorna la URL pública.
- Los métodos `createProducto` y `updateProducto` ya reciben el payload completo — solo necesitan aceptar los campos nuevos (actualizar los tipos).

---

## Cambio 5 — Admin `producto-form`

### Componente TypeScript

- Agregar señales: `coverPreview`, `galleryPreviews`, `coverFile`, `galleryFiles`, `existingFotos`.
- Agregar campos al `FormGroup`: `color` (string | null), `flag` (string | null), `material` (no en form, señal separada), `descripcion` (string).
- Handler `onCoverChange(event)`: guarda el File, genera URL local para preview.
- Handler `onGalleryChange(event)`: guarda array de Files, genera previews locales.
- Handler `removeGalleryItem(i)`: elimina preview y file por índice.
- En `guardar()`: si hay `coverFile`, hacer upload y guardar URL; si hay `galleryFiles`, uploadear cada uno y agregar a array; construir payload con todos los campos nuevos.
- En `ngOnInit` (modo edición): cargar `cover_url`, `fotos`, `material`, `color`, `flag`, `descripcion` del producto existente.

### Template HTML

Agregar tres secciones nuevas dentro de `.panel-b`, después del bloque de personaje/activo:

**Sección Fotos:**
- Campo cover: input file (`accept="image/*"`) + preview `<img>` condicional
- Campo galería: input file múltiple + grid de previews con botón "×" por imagen

**Sección Apariencia:**
- Select de color con 9 opciones + swatch de color como visual aid
- Select de flag: "Ninguno / Recién llegado / Últimas unidades"

**Sección Detalles:**
- Textarea para descripción
- Checkboxes de material (5 opciones) con la misma clase `.filter-opt` del admin

---

## Cambio 6 — Tienda `tienda.component.ts`

- Inyectar `InventarioService`.
- Al iniciar (`ngOnInit`): llamar `cargarTodos()`, luego filtrar `activo = true`.
- Reemplazar `readonly PRODUCTS: Product[]` (hardcoded) por `readonly products = computed(() => this.inv.productos().filter(p => p.activo))`.
- Actualizar la interfaz `Product` o usar `ProductoEvento` directamente en los cómputos.
- La función `filteredProducts()` mapea sobre `products()` en lugar de `PRODUCTS`.
- El campo `av` (disponibilidad) se deriva del `flag`: `'new'` → `['stock','new']`, `'last'` → `['last']`, `null` → `['stock']`.
- Agregar señal `cargando` para mostrar skeleton o spinner mientras carga.

### Template HTML

- En las tarjetas `.pcard`: mostrar `<img>` si `cover_url` existe; si no, mantener el label textual como fallback.
- Usar `p.color` del campo nuevo en `[attr.data-color]`.
- Flag badge: leer de `p.flag` directamente.

---

## Fuera de scope

- Checkout / pasarela de pago.
- Página de detalle de producto (`/cuaquiverso/tienda/:id`).
- Eliminación de imágenes del bucket al borrar un producto.
- Paginación de la tienda.

---

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `src/app/pages/cuaquiverso/tienda/tienda.component.html` | Texto hero |
| `src/app/pages/cuaquiverso/tienda/tienda.component.ts` | Cargar desde Supabase |
| `src/app/core/services/inventario.service.ts` | Interfaz + upload |
| `src/app/pages/admin/productos/producto-form.component.ts` | Fotos + campos nuevos |
| `src/app/pages/admin/productos/producto-form.component.html` | Secciones fotos/apariencia/detalles |
| Supabase DB | ALTER TABLE + bucket |
