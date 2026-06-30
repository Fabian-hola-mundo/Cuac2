# Reordenar personajes con drag handle (Admin → Contenido)

## Contexto

En `/admin`, la sección "Contenido" del nav navega a `/admin/personajes`
(`PersonajesListComponent`), la única lista con controles de orden
(`order-btns`: botones ▲/▼) en todo el admin. El reordenamiento actual
mueve un personaje una posición a la vez por click, recalcula `sort_order`
para toda la lista y persiste vía `PersonajesService.updateOrder()`.

Se reemplazan los botones ▲/▼ por un control de arrastre (drag-and-drop)
para reordenar arrastrando filas directamente.

## Alcance

Solo `src/app/pages/admin/personajes/personajes-list.component.{ts,html,scss}`.
Ninguna otra lista del admin usa este patrón hoy, así que no hay otros
componentes a tocar.

## Dependencia

`@angular/cdk` ya está instalado (`package.json`, `^21.2.13`). Se usa
`DragDropModule` de `@angular/cdk/drag-drop`, sin nuevas dependencias.

## Diseño

### Estructura (HTML)

- `.drag-list` pasa a ser un contenedor `cdkDropList` con
  `(cdkDropListDropped)="onDrop($event)"`.
- Cada `.drag-row` pasa a ser `cdkDrag`.
- El bloque `.order-btns` (dos `<button>` ▲/▼) se reemplaza por un único
  ícono de agarre `.drag-handle` (⋮⋮, vía SVG inline para mantener el
  estilo del resto de los íconos de la fila) marcado con `cdkDragHandle`.
  Es el único punto de la fila desde el que se puede iniciar el arrastre,
  de forma que no interfiere con los botones de ver/editar/eliminar ni con
  el toggle de activo/inactivo.
- Se agrega `cdkDragPreview` implícito (preview por defecto de CDK) y una
  clase de placeholder para el hueco que deja la fila mientras se arrastra.

### Lógica (TypeScript)

- Se elimina `moveUp(p)` y `moveDown(p)`.
- Se agrega `onDrop(event: CdkDragDrop<Personaje[]>)`:
  1. Si `event.previousIndex === event.currentIndex`, no hace nada.
  2. Copia `svc.personajes()`, aplica `moveItemInArray(items, event.previousIndex, event.currentIndex)`.
  3. `svc.personajes.set(items)` (actualización optimista, igual que el
     comportamiento actual de `moveUp`/`moveDown`).
  4. Recalcula `sort_order` para toda la lista: `items.map((x, i) => ({ id: x.id, sort_order: i + 1 }))`.
  5. Llama a `svc.updateOrder(updates)` (sin cambios en el servicio) y
     muestra el toast `'Orden guardado'` igual que hoy. Guardado automático
     al soltar, sin botón de confirmación aparte.
- Import de `CdkDragDrop`, `moveItemInArray` desde `@angular/cdk/drag-drop`.
- `DragDropModule` se agrega al array `imports` del componente standalone.

### Estilos (SCSS)

- Se elimina `.order-btns` y `.order-btn`.
- Se agrega `.drag-handle`: mismo footprint aproximado que `.order-btns`
  (ancho fijo, `flex-shrink: 0`), `cursor: grab` en reposo y
  `cursor: grabbing` mientras se arrastra (`.cdk-drag-dragging`).
- Estilos de feedback visual de CDK:
  - `.cdk-drag-preview`: la fila que sigue al cursor — sombra
    (`box-shadow`) y fondo sólido para que se destaque sobre el resto.
  - `.cdk-drag-placeholder`: el hueco que queda en la lista mientras se
    arrastra — opacidad reducida, sin contenido visible (outline punteado
    sutil opcional).
  - `.cdk-drop-list-dragging .drag-row:not(.cdk-drag-placeholder)`:
    transición suave (`transition: transform 200ms`) para que las demás
    filas se acomoden con animación al reordenarse.

## Fuera de alcance

- No se toca ninguna otra lista del admin (productos, pedidos, clientes,
  etc.) ni el visor de galería del detalle de personaje.
- No se agrega soporte de reordenamiento por teclado más allá de lo que
  CDK Drag & Drop provee out-of-the-box (ya incluye accesibilidad básica
  vía `cdkDragHandle` + foco).
- No se cambia `PersonajesService.updateOrder()`.
