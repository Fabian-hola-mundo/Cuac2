# Admin Global Search Dialog

**Fecha:** 2026-06-05  
**Estado:** Aprobado

## Resumen

Dialog centrado con glassmorfismo que permite buscar pedidos, clientes y productos desde cualquier sección del admin. Se activa con `⌘K` / `Ctrl+K` o haciendo click en el input del topbar.

## Componente

`src/app/pages/admin/search/admin-search.component.{ts,html,scss}`

Standalone component montado condicionalmente en `admin-shell.component.html`.

## Trigger y cierre

| Acción | Resultado |
|--------|-----------|
| Click en `.top-search` del topbar | Abre dialog |
| `⌘K` / `Ctrl+K` desde cualquier lugar | Abre dialog |
| `Escape` | Cierra dialog |
| Click en el overlay | Cierra dialog |
| Click en un resultado | Navega y cierra |

## Fuentes de datos

| Sección | Servicio | Campos buscados |
|---------|----------|-----------------|
| Pedidos | `MockAdminDataService.ORDERS` | `id`, `customer`, `city` |
| Clientes | `MockAdminDataService.CUSTOMERS` | `nombre`, `email`, `ciudad` |
| Productos | `InventarioService.productos()` | `nombre`, `categoria` |

Búsqueda cliente-side, instantánea, `includes()` case-insensitive.  
Sin query → muestra los primeros 4 de cada sección.  
Con query → máximo 4 resultados por grupo.

## Navegación al seleccionar

| Tipo | Acción |
|------|--------|
| Pedido | `AdminStateService.view.set('pedidos')` → `router.navigate(['/admin'])` |
| Cliente | `AdminStateService.view.set('clientes')` → `router.navigate(['/admin'])` |
| Producto | `router.navigate(['/admin/productos'])` |

## Teclado

- `↑` / `↓` — navegar entre resultados
- `Enter` — seleccionar resultado enfocado
- `Escape` — cerrar

## Estilo glassmorfismo

**Overlay:**
- `background: rgba(21, 31, 40, 0.45)`
- `backdrop-filter: blur(6px)`

**Dialog:**
- `background: rgba(245, 247, 250, 0.88)`
- `backdrop-filter: blur(28px) saturate(1.8)`
- `border: 1px solid rgba(255, 255, 255, 0.55)`
- `border-radius: 18px`
- `box-shadow: 0 24px 64px rgba(21,31,40,0.30)`
- `max-width: 560px`, centrado con `position: fixed; inset: 0; margin: auto`

**Input de búsqueda:**
- Font-size 17px, sin borde propio, fondo transparente
- Icono lupa a la izquierda

**Resultados:**
- Eyebrow label por grupo (PEDIDOS / CLIENTES / PRODUCTOS)
- Hover: `background: rgba(21,31,40,0.05)`
- Resultado activo (teclado): `background: rgba(21,31,40,0.08)`, borde izq terra
- Click ripple sutil

**Footer:**
- Hints de teclado en `var(--mono)`, texto tenue
