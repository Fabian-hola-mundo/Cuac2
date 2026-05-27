# Admin — Refactor inventario, mejoras a ventas y pedido manual

**Fecha:** 2026-05-27  
**Estado:** Aprobado, listo para implementación

---

## Contexto

El panel admin de Cuaquiverso (`/admin`) tiene dos secciones solapadas para gestionar productos: la sección "Inventario" (bajo rutas `/admin/inventario/*`) y la sección "Productos" (bajo `/admin/productos/*`). Se unifica todo en "Productos". Adicionalmente se mejoran la columna Canal del registro de ventas, se agrega drill-down de ventas por fila, se expone la gestión de eventos desde Productos, y se implementa el drawer de pedido manual.

Archivos clave afectados:
- `src/app/app.routes.ts`
- `src/app/pages/admin/admin-shell.component.ts` + `.html`
- `src/app/pages/admin/productos/productos-list.component.ts` + `.html`
- `src/app/pages/admin/productos/ventas-general.component.ts` + `.html`
- `src/app/pages/admin/admin-home.component.html` + `.ts`
- `src/app/core/services/inventario.service.ts`

---

## Cambio 1 — Eliminar sección Inventario del sidebar

**Qué:** Quitar el link "Inventario" del sidebar y sus rutas.

**Archivos:**
- `admin-shell.component.html`: eliminar el `<a>` de "Inventario" (línea 92–96), limpiar `isInventarioRoute()` de todas las condiciones `[class.is-active]`.
- `admin-shell.component.ts`: eliminar `isInventarioRoute = computed(...)`, `goInventario()`, y las referencias en `goHome()` y `crumbs`.
- `app.routes.ts`: eliminar las 4 rutas `inventario`, `inventario/nuevo`, `inventario/:id/editar`, `inventario/ventas`.

**No hacer:** no borrar los archivos de componente (pueden servir de referencia). Solo quitar acceso desde navegación y rutas.

---

## Cambio 2 — Columna Canal alineada con eventos

**Qué:** La columna "Canal" en la tabla "Detalle de ventas" de `ventas-general.component` actualmente muestra solo "Evento" o "Web". Cuando el canal es `evento`, debe mostrar el nombre específico del evento (p.ej. "sofa-2026").

**Cómo:**

1. `inventario.service.ts` — `getVentas()`: ampliar el select para incluir `evento_id` en el join de productos:
   ```ts
   .select('*, productos_evento(nombre, categoria, precio, evento_id)')
   ```

2. Interfaz `VentaEvento.productos_evento`: agregar campo opcional `evento_id?: string | null`.

3. `ventas-general.component.html` — celda Canal:
   - Si `canal === 'evento'`: badge `rio` con texto `v.productos_evento?.evento_id ?? 'Evento'`
   - Si `canal === 'web'`: badge `ok` con texto "Web"

---

## Cambio 3 — Total al pie de "Por producto"

**Qué:** Agregar una fila de total al final del panel "Por producto" en `ventas-general.component`.

**Cómo:**

1. `ventas-general.component.ts`: agregar computed:
   ```ts
   totalProductosVendidos = computed(() =>
     this.totalesPorProducto().reduce((acc, t) => acc + t.total, 0)
   );
   ```

2. `ventas-general.component.html`: después del `@for`, agregar fila de cierre:
   ```html
   @if (totalesPorProducto().length > 0) {
     <div class="total-row">
       <span>Total</span>
       <strong>{{ totalProductosVendidos() }} ud.</strong>
     </div>
   }
   ```
   La fila lleva `border-top: 1px solid var(--carbon-12)`, `padding-top: 10px`, `font-weight: 700`.

---

## Cambio 4 — Drill-down: click en fila abre detalle de venta

**Qué:** Clicking en cualquier fila de la tabla "Detalle de ventas" abre un drawer lateral con el detalle completo de esa venta.

**Cómo:**

1. `ventas-general.component.ts`:
   - Agregar `ventaSeleccionada = signal<VentaEvento | null>(null)`
   - Método `verDetalle(v: VentaEvento)` que llama `ventaSeleccionada.set(v)`
   - Método `cerrarDetalle()` que llama `ventaSeleccionada.set(null)`

2. `ventas-general.component.html`:
   - `(click)="verDetalle(v)"` y `style="cursor:pointer"` en cada `<tr>` del `@for`
   - Drawer estándar al final del template (patrón existente: `.drawer-back` + `.drawer`):
     - Header: "Detalle de venta" + botón `×`
     - Body: lista kv con Fecha/Hora, Producto, Categoría, Cantidad, Canal (+ evento_id), Dispositivo, Sincronizado
     - Footer: botón "Cerrar"

---

## Cambio 5 — Gestión de evento activo desde Productos

**Qué:** En la cabecera de `productos-list.component`, exponer acciones de evento: crear uno nuevo si no hay activo, o finalizar el activo si existe.

**Cómo:**

1. `productos-list.component.ts`:
   - Inyectar `EventosService`
   - Agregar `eventoActivo = signal<Evento | null>(null)` e importar tipo `Evento`
   - En `ngOnInit`: cargar `this.eventoActivo.set(await this.eventosSvc.getEventoActivo())`
   - Signals auxiliares: `crearEventoOpen = signal(false)`, `nuevoEventoNombre = ''`, `creando = signal(false)`, `crearError = signal<string|null>(null)`
   - Signals para finalizar: `finalizarOpen = signal(false)`, `finalizando = signal(false)`, `finalizarError = signal<string|null>(null)`
   - Método `crearEvento()`: llama `EventosService.crearEvento(nombre)`, recarga `eventoActivo`, muestra toast de éxito o error
   - Método `finalizarEvento()`: llama `EventosService.finalizarEvento(id)`, recarga `eventoActivo`

2. `productos-list.component.html` — en `ph-r`, antes del botón "Nuevo producto":
   - Si no hay evento activo: botón `btn-sm ghost` "Nuevo evento +" → `crearEventoOpen.set(true)`
   - Si hay evento activo: badge con nombre del evento + botón `btn-sm danger` "Finalizar evento" → `finalizarOpen.set(true)`

3. Dialog "Crear evento" (modal centrado, mismo patrón del confirm-dialog de `evento-detail`):
   - Input para nombre
   - Botón "Crear" + "Cancelar"
   - Muestra error inline si `crearError()`

4. Dialog "Finalizar evento" (mismo patrón confirm):
   - Texto de confirmación con el nombre del evento
   - Botón "Sí, finalizar" + "Cancelar"

---

## Cambio 6 — Vista "Pedido manual" en Pedidos

**Qué:** Implementar el drawer de creación de pedido manual en `admin-home.component`. El botón ya existe en el HTML; actualmente llama `openOrder()`. Debe llamar `openManualOrder()`.

**Cómo:**

1. `admin-home.component.ts`:
   - Agregar `manualOrderOn = signal(false)`
   - Método `openManualOrder()` / `closeManualOrder()`
   - Estado del formulario:
     ```ts
     mo = {
       clienteNombre: '', clienteEmail: '', clienteTel: '',
       clienteCiudad: '', clienteDireccion: '',
       metodo: 'efectivo' as string,
       canal: 'web' as string,
       notas: '',
       items: signal<{ id: string; name: string; price: number; qty: number }[]>([]),
       productSearch: '',
     }
     ```
   - Computed `moSubtotal`, `moTotal` (subtotal + envío fijo $0 por ahora)
   - Método `moAddProduct(p)`: agrega o incrementa qty en `mo.items`
   - Método `moRemoveItem(id)`: quita item de la lista
   - Método `moCrear()`: valida mínimo 1 item + cliente con nombre, luego `flash('Pedido manual creado')` + cierra drawer (backend pendiente)

2. `admin-home.component.html`:
   - Cambiar el `(click)` del botón "Pedido manual" a `openManualOrder()`
   - Agregar drawer al final del template (antes del drawer de detalle de orden):

   **Layout del drawer (2 columnas):**
   
   Columna izquierda (2/3):
   - Panel "Línea de productos": input de búsqueda (filtra `PRODUCTS`), lista de resultados con botón `+`, tabla de ítems agregados (producto / cant. / precio / subtotal / ✕)
   - Panel "Resumen": kv-list subtotal / envío ($0) / total

   Columna derecha (1/3):
   - Panel "Cliente": campos nombre*, email, teléfono, ciudad, dirección
   - Panel "Pago": select método (Efectivo, Transferencia, Bold, Nequi, Contra-entrega), select canal (Web, Evento)
   - Panel "Notas": textarea

   Footer: `Cancelar` (ghost) + `Crear pedido` (solid, disabled si no hay items o no hay nombre de cliente)

**Validación mínima:** al menos 1 producto + nombre de cliente. Sin backend por ahora — solo `flash()`.

---

## Lo que NO cambia

- Los archivos de componente del inventario (`inventario-list`, `inventario-form`, `inventario-ventas`) se mantienen en disco sin modificar.
- El resto del admin-home (dashboard, clientes, pagos, contenido, ajustes) no se toca.
- El `ProductoFormComponent` (ruta `/admin/productos/nuevo` y `/admin/productos/:id/editar`) no se toca.
- El `EventoDetailComponent` y `EventosListComponent` no se tocan.

---

## Orden de implementación sugerido

1. Cambio 1 (más limpio hacerlo primero — quita ruido del shell)
2. Cambio 2 + 3 (mismos archivos de ventas-general)
3. Cambio 4 (mismo archivo, agrega drawer)
4. Cambio 5 (productos-list — agrega evento logic)
5. Cambio 6 (admin-home — pedido manual)
