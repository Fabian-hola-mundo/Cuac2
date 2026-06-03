# Tienda real + vista de producto — Spec de diseño

**Fecha:** 2026-06-03
**Estado:** Aprobado por el usuario, listo para implementar

---

## Resumen

Dos mejoras relacionadas al flujo de tienda en Cuaquiverso:

1. **Home conectado al admin**: La sección "La tienda" de `/cuaquiverso` deja de usar datos hardcodeados y muestra productos reales del admin, priorizando los marcados como `destacado`.
2. **Vista individual de producto**: Nueva ruta `/cuaquiverso/tienda/:id` con layout 2 columnas (galería + info), usando los datos de `InventarioService`.

---

## Parte 1 — Home "La tienda" conectada al admin

### Base de datos

Agregar columna a `productos_evento`:

```sql
ALTER TABLE productos_evento
  ADD COLUMN destacado boolean NOT NULL DEFAULT false;
```

### ProductoEvento interface

Agregar campo en `src/app/core/services/inventario.service.ts`:
```typescript
destacado: boolean;
```

### Admin — formulario de producto

Archivo: `src/app/pages/admin/productos/producto-form.component.ts` y `.html`

- Agregar control `destacado: [false]` al `FormGroup`
- En `ngOnInit`, hacer `patchValue` con `p.destacado`
- En el template: toggle tipo checkbox con label "Mostrar en home del Cuaquiverso"
- En `updateProducto` y `createProducto`: incluir `destacado` en el payload

### CuaquiversoComponent — home

Archivo: `src/app/pages/cuaquiverso/cuaquiverso.component.ts`

- Inyectar `InventarioService`
- Llamar `inv.cargarTodos()` en `ngOnInit` (ya carga `select('*')` que incluye `destacado`)
- Eliminar `previewProducts` hardcodeado
- Computed `showcaseProducts`: filtra `activo = true && destacado = true`, max 5. Si el resultado tiene 0, fallback a los 5 más recientes activos (orden por `creado_en` desc).
- Actualizar `addToCart(event, product: ProductoEvento)` para usar `p.id`, `p.nombre`, `p.categoria`, `p.precio`, `p.color`

Archivo: `src/app/pages/cuaquiverso/cuaquiverso.component.html`

- Reemplazar los 5 `<a class="pcard ...">` hardcodeados por un `@for (p of showcaseProducts(); track p.id)` con el mismo marcado de tarjeta.
- Cada tarjeta enlaza a `/cuaquiverso/tienda/{{ p.id }}` (vía `routerLink`, no `href`)
- El botón "+" llama `addToCart($event, p)`
- Si `showcaseProducts().length === 0` y `inv.cargando()` → mostrar 5 skeleton cards
- El enlace "Ver toda la tienda →" permanece igual

### Lógica de color en las tarjetas del home

`ProductoEvento.color` es un valor hex (ej. `#2A6FDB`) o null. El atributo `data-color` en las pcard actuales usa tokens de CSS (ej. `rio`). Las tarjetas dinámicas usarán `[style.background]` directamente en el elemento de imagen placeholder en lugar de `data-color`, para no depender de los tokens.

---

## Parte 2 — Vista individual de producto

### Ruta

```
/cuaquiverso/tienda/:id
```

Componente: `ProductoDetailComponent`
Ruta lazy-loaded en `app.routes.ts`, insertada antes del wildcard.

### Archivos nuevos

```
src/app/pages/cuaquiverso/tienda/producto/
  producto-detail.component.ts
  producto-detail.component.html
  producto-detail.component.scss
```

### Layout — 2 columnas (desktop), apilado (mobile)

**Columna izquierda — Galería:**
- Imagen principal: `cover_url` si existe, si no `fotos[0]`, si no un placeholder de color del producto.
- Si hay `fotos[]` con más de 1 elemento: fila de thumbnails debajo de la imagen principal. Click en thumbnail cambia la imagen principal (`selectedImg` signal).
- Imagen principal: `object-fit: cover`, aspecto cuadrado, border-radius 14px.

**Columna derecha — Info:**
- Breadcrumbs: "Inicio / Tienda / [nombre]" con links via `routerLink`
- Tag de categoría (usando `CAT_SHORT` map) + personaje si existe
- Nombre del producto (`h1`)
- Precio formateado en COP
- Badge de flag si existe (`new` → "Nuevo", `last` → "Últimas unidades")
- Descripción (si existe)
- Chips de material
- Badge de stock: si `stock_actual <= 5` → "Últimas {{ stock_actual }} unidades"
- Botón "Agregar al carrito" (ember, full-width) — llama `cart.add(...)` y navega a `/cuaquiverso/checkout` via router
- Link "← Volver a la tienda" bajo el botón

### Estados

- **Cargando**: skeleton de 2 columnas con pulsación
- **No encontrado**: mensaje "Producto no encontrado" + botón "Ver la tienda"
- **Sin imagen**: placeholder de color sólido usando `product.color` o `#3D4856`

### Datos

- `InventarioService.getProducto(id)` carga el producto por id
- `CartService.add(...)` igual que en tienda y home

### SEO

`SeoService.set({ title: p.nombre + ' — Cuaquiverso', description: p.descripcion ?? '...', canonical: '...' })`

---

## Archivos modificados / creados

| Archivo | Acción |
|---|---|
| `supabase/migrations/006_destacado.sql` | Crear — agrega columna destacado |
| `src/app/core/services/inventario.service.ts` | Modificar — agregar `destacado` a `ProductoEvento` |
| `src/app/pages/admin/productos/producto-form.component.ts` | Modificar — toggle destacado |
| `src/app/pages/admin/productos/producto-form.component.html` | Modificar — UI del toggle |
| `src/app/pages/cuaquiverso/cuaquiverso.component.ts` | Modificar — cargar productos reales, computed showcaseProducts |
| `src/app/pages/cuaquiverso/cuaquiverso.component.html` | Modificar — reemplazar hardcoded cards |
| `src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.ts` | Crear |
| `src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.html` | Crear |
| `src/app/pages/cuaquiverso/tienda/producto/producto-detail.component.scss` | Crear |
| `src/app/app.routes.ts` | Modificar — agregar ruta `/cuaquiverso/tienda/:id` |

---

## Fuera de alcance

- Productos relacionados
- Selector de tallas / variantes
- Zoom de imagen
- Reseñas
