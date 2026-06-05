---
title: Notification Bell Dropdown — Admin Panel
date: 2026-06-05
status: approved
---

# Dropdown de Notificaciones — Admin Panel

## Contexto

El topbar del admin (`admin-shell.component.html`) ya tiene un botón de campana sin comportamiento. Este spec define un dropdown de notificaciones en tiempo real que agrega eventos de todas las secciones del panel en una vista compacta, sin panel completo ni gestión de leídos.

## Decisiones de diseño

- **Patrón**: dropdown flotante (popover), no drawer lateral — el usuario explícitamente no quiere panel completo.
- **Actualización**: Supabase Realtime — el badge se actualiza sin abrir el dropdown; nuevos eventos prependen la lista en vivo.
- **Gestión de leídos**: ninguna. El badge desaparece al navegar a la sección correspondiente (igual que mensajes en el sidebar).
- **Ancho**: 340 px, máx 20 items, scrollable internamente.

## Archivos nuevos

```
src/app/pages/admin/notifications/
  notifications.service.ts
  notifications-dropdown.component.ts
  notifications-dropdown.component.html
  notifications-dropdown.component.scss
```

## Interfaz de datos

```ts
interface AdminNotif {
  id: string
  type: 'mensaje' | 'pedido' | 'cotizacion' | 'pago' | 'stock' | 'evento'
  title: string       // texto principal del item
  sub: string         // subtítulo (preview o detalle breve)
  time: string        // ISO timestamp — se muestra como "hace X min"
  route: string[]     // argumento de Router.navigate()
  tone: 'rio' | 'terra' | 'lila' | 'selva' | 'sol' | 'rosa'
}
```

## NotificationsService

`providedIn: 'root'`. Expone:

| Miembro | Tipo | Descripción |
|---------|------|-------------|
| `items` | `signal<AdminNotif[]>` | Lista unificada, ordenada desc por `time`, máx 20 |
| `unread` | `computed<number>` | Count para el badge de la campana (= `items().length` mientras no haya leídos) |
| `load()` | `async` | Fetch inicial: últimos 5 por tipo |
| `subscribe()` | `void` | Abre canales Realtime; cada INSERT prepende al signal |

### Fuentes de datos

| Tipo | Tabla Supabase | Condición fetch | Tono | Ruta |
|------|---------------|-----------------|------|------|
| `mensaje` | `mensajes` | `leido = false`, últimos 5 | `rio` | `/admin/mensajes` |
| `pedido` | `pedidos` | últimos 5 por `created_at` | `terra` | `/admin` (view pedidos) |
| `cotizacion` | `cotizaciones` | últimos 5 por `created_at` | `lila` | `/admin/cotizaciones` |
| `pago` | `pagos` | últimos 5 por `created_at` | `selva` | `/admin` (view pagos) |
| `stock` | `productos` | `stock <= 3`, activos | `sol` | `/admin/productos` |
| `evento` | `eventos` | próximos 7 días | `rosa` | `/admin/eventos` |

Realtime escucha `INSERT` en `mensajes`, `pedidos`, `cotizaciones`, `pagos`; y eventos `UPDATE` en `productos` donde `new.stock <= 3` (para detectar stock bajo). El timestamp de notificaciones de stock usa `updated_at` del registro. Eventos se mapean a `AdminNotif` antes de prependar.

Las subscripciones se abren en `subscribe()` y se cierran en `ngOnDestroy()` del shell con `this.sb.db.removeAllChannels()`.

## NotificationsDropdownComponent

Standalone, selector `app-notifications-dropdown`.

**Inputs:**
- `items: AdminNotif[]`

**Outputs:**
- `closed: EventEmitter<void>` — emitido al navegar o al hacer click en el overlay

**Template — estructura:**
```
.notif-dropdown
  .nd-header          → "Notificaciones" + badge count + timestamp "Hoy"
  .nd-list            → máx-height: 380px, scroll
    .nd-item × N      → icono · título · subtítulo + timestamp relativo · flecha hover
  .nd-footer          → (solo si hay items) botón "Ver actividad completa" — cierra el dropdown sin navegar (fuera de alcance en esta iteración)

[estado vacío]
  .nd-empty           → ícono check + "Todo al día" + texto explicativo
```

**Anatomía de `.nd-item`:**
- Grid 3 columnas: `32px 1fr 14px`
- `.nd-ic` coloreado según `tone` (usa clases `rio`, `terra`, etc. — mismos tokens del admin)
- `.nd-t` título bold, overflow ellipsis
- `.nd-s` subtítulo + sep `·` + timestamp relativo (pipe personalizado o función)
- `.nd-arrow` aparece en hover; al click → `Router.navigate(item.route)` + emit `closed`

**Timestamp relativo:** función utilitaria `timeAgo(iso: string): string` que devuelve "hace X min", "hace X h", "hace X d". Sin dependencia externa.

## Integración en AdminShellComponent

### admin-shell.component.ts

```ts
// Nuevas adiciones
notifOpen = signal(false);
readonly notifSvc = inject(NotificationsService);

// En ngOnInit()
this.notifSvc.load();
this.notifSvc.subscribe();

// HostListener existente — agregar cierre con Escape
// Nuevo HostListener document:click para cerrar al hacer click fuera
@HostListener('document:click', ['$event'])
onDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest('.notif-wrap')) this.notifOpen.set(false);
}
```

### admin-shell.component.html — cambios en topbar

```html
<!-- Reemplazar el botón .ib existente por: -->
<div class="notif-wrap">
  <button class="ib" (click)="notifOpen.set(!notifOpen()); $event.stopPropagation()">
    <!-- SVG campana igual que ahora -->
    @if (notifSvc.unread() > 0) { <span class="dot"></span> }
  </button>
  @if (notifOpen()) {
    <app-notifications-dropdown
      [items]="notifSvc.items()"
      (closed)="notifOpen.set(false)" />
  }
</div>
```

`.notif-wrap` es un `div` con `position: relative` para que el dropdown se posicione desde ahí.

## Estilos

Los estilos del dropdown van en `notifications-dropdown.component.scss`. No se añaden reglas a `_admin.scss` — el componente usa los tokens CSS (`--rio-soft`, `--terra`, etc.) que ya están definidos y disponibles globalmente.

Clases del dropdown: `.notif-dropdown`, `.nd-header`, `.nd-list`, `.nd-item`, `.nd-ic`, `.nd-body`, `.nd-t`, `.nd-s`, `.nd-arrow`, `.nd-footer`, `.nd-empty`. Ver mockup en `.superpowers/brainstorm/2557-1780639483/content/notif-dropdown.html`.

**Animación de entrada:** `@keyframes ndIn` — `opacity 0→1` + `translateY(-6px → 0)` en 150ms.

## Comportamiento de cierre

1. Click en un item → navega + cierra
2. Click fuera del `.notif-wrap` → cierra (HostListener en el shell)
3. Tecla Escape → cierra (extender el HostListener existente de `document:keydown`)

## Fuera de alcance

- Marcar notificaciones como leídas individualmente
- Persistencia de notificaciones vistas en base de datos
- Panel completo de historial de notificaciones
- Push notifications / notificaciones del navegador
