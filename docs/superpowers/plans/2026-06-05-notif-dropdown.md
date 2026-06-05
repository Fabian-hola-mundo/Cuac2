# Notification Bell Dropdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un dropdown de notificaciones en tiempo real en el topbar del admin que agrega eventos de mensajes, cotizaciones, stock bajo y eventos próximos.

**Architecture:** Un `NotificationsService` (`providedIn: 'root'`) carga el estado inicial con `load()` y abre canales Supabase Realtime con `subscribe()`. Un standalone component `NotificationsDropdownComponent` renderiza la lista y emite `(closed)` al navegar. El shell lo monta condicionalmente con `@if (notifOpen())` y un overlay transparente para cerrar al hacer click afuera.

**Tech Stack:** Angular 17+ signals, `@if/@for` control flow, Supabase JS client (postgres_changes Realtime), SCSS con los tokens CSS del admin.

---

## Mapa de archivos

| Acción | Ruta |
|--------|------|
| Crear | `src/app/pages/admin/notifications/notifications.service.ts` |
| Crear | `src/app/pages/admin/notifications/notifications-dropdown.component.ts` |
| Crear | `src/app/pages/admin/notifications/notifications-dropdown.component.html` |
| Crear | `src/app/pages/admin/notifications/notifications-dropdown.component.scss` |
| Modificar | `src/app/pages/admin/admin-shell.component.ts` |
| Modificar | `src/app/pages/admin/admin-shell.component.html` |

---

### Task 1: NotificationsService — interfaz + load()

Crea el servicio con la interfaz `AdminNotif`, los signals y el método `load()` que hace fetch paralelo de las 4 fuentes.

**Tablas reales en Supabase confirmadas:** `mensajes`, `cotizaciones`, `productos_evento`, `eventos`.
`pedidos` y `pagos` usan datos mock — no se incluyen en Realtime.

**Files:**
- Create: `src/app/pages/admin/notifications/notifications.service.ts`

- [ ] **Step 1: Crear el archivo con la interfaz y el servicio**

```ts
// src/app/pages/admin/notifications/notifications.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/services/supabase.service';

export interface AdminNotif {
  id: string;
  type: 'mensaje' | 'cotizacion' | 'stock' | 'evento';
  title: string;
  sub: string;
  time: string;       // ISO — se muestra como timestamp relativo
  route: string[];    // argumento de Router.navigate()
  tone: 'rio' | 'lila' | 'sol' | 'rosa';
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private sb = inject(SupabaseService);
  private channel: RealtimeChannel | null = null;

  readonly items = signal<AdminNotif[]>([]);
  readonly unread = computed(() => this.items().length);

  async load(): Promise<void> {
    const [mensajes, cotizaciones, stock, eventos] = await Promise.all([
      this.fetchMensajes(),
      this.fetchCotizaciones(),
      this.fetchStock(),
      this.fetchEventos(),
    ]);
    const all = [...mensajes, ...cotizaciones, ...stock, ...eventos]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 20);
    this.items.set(all);
  }

  private async fetchMensajes(): Promise<AdminNotif[]> {
    const { data } = await this.sb.db
      .from('mensajes')
      .select('id, mensaje, correo, created_at')
      .eq('leido', false)
      .order('created_at', { ascending: false })
      .limit(5);
    return (data ?? []).map(m => ({
      id: `msg-${m.id}`,
      type: 'mensaje' as const,
      title: `Mensaje de ${m.correo ?? 'visitante'}`,
      sub: (m.mensaje as string)?.slice(0, 60) ?? '',
      time: m.created_at,
      route: ['/admin/mensajes'],
      tone: 'rio' as const,
    }));
  }

  private async fetchCotizaciones(): Promise<AdminNotif[]> {
    const { data } = await this.sb.db
      .from('cotizaciones')
      .select('id, nombre, empresa, created_at')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(5);
    return (data ?? []).map(c => ({
      id: `cot-${c.id}`,
      type: 'cotizacion' as const,
      title: `Cotización de ${c.nombre}`,
      sub: c.empresa ?? '',
      time: c.created_at,
      route: ['/admin/cotizaciones'],
      tone: 'lila' as const,
    }));
  }

  private async fetchStock(): Promise<AdminNotif[]> {
    // La tabla se llama productos_evento y el campo es stock_actual
    const { data } = await this.sb.db
      .from('productos_evento')
      .select('id, nombre, stock_actual, creado_en')
      .eq('activo', true)
      .lte('stock_actual', 3)
      .order('stock_actual', { ascending: true })
      .limit(5);
    return (data ?? []).map(p => ({
      id: `stk-${p.id}`,
      type: 'stock' as const,
      title: `Stock bajo · ${p.nombre}`,
      sub: `Solo ${p.stock_actual} unidad${p.stock_actual === 1 ? '' : 'es'} disponible${p.stock_actual === 1 ? '' : 's'}`,
      time: p.creado_en,
      route: ['/admin/productos'],
      tone: 'sol' as const,
    }));
  }

  private async fetchEventos(): Promise<AdminNotif[]> {
    const now = new Date().toISOString();
    const in7days = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const { data } = await this.sb.db
      .from('eventos')
      .select('id, nombre, fecha_inicio')
      .neq('estado', 'finalizado')
      .gte('fecha_inicio', now)
      .lte('fecha_inicio', in7days)
      .order('fecha_inicio', { ascending: true })
      .limit(3);
    return (data ?? []).map(e => ({
      id: `evt-${e.id}`,
      type: 'evento' as const,
      title: `Evento próximo · ${e.nombre}`,
      sub: new Date(e.fecha_inicio).toLocaleDateString('es-CL', {
        weekday: 'long', day: 'numeric', month: 'short',
      }),
      time: e.fecha_inicio,
      route: ['/admin/eventos'],
      tone: 'rosa' as const,
    }));
  }

  subscribe(): void { /* implementado en Task 2 */ }
  cleanup(): void { /* implementado en Task 2 */ }
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

Resultado esperado: sin errores de TypeScript. Si hay error en `RealtimeChannel`, instalar tipos: `npm install @supabase/supabase-js` (ya debería estar).

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/notifications/notifications.service.ts
git commit -m "feat(notif): NotificationsService — interfaz AdminNotif + load()"
```

---

### Task 2: NotificationsService — subscribe() + cleanup()

Implementa los canales Supabase Realtime y el método de limpieza.

**Files:**
- Modify: `src/app/pages/admin/notifications/notifications.service.ts`

- [ ] **Step 1: Reemplazar los stubs `subscribe()` y `cleanup()` con la implementación real**

Reemplaza estos dos métodos en el archivo:

```ts
subscribe(): void {
  if (this.channel) return; // evitar doble suscripción
  this.channel = this.sb.db
    .channel('admin-notif')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensajes' },
      payload => {
        const m = payload.new as any;
        this.prepend({
          id: `msg-${m.id}`,
          type: 'mensaje',
          title: `Mensaje de ${m.correo ?? 'visitante'}`,
          sub: (m.mensaje as string)?.slice(0, 60) ?? '',
          time: m.created_at,
          route: ['/admin/mensajes'],
          tone: 'rio',
        });
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'cotizaciones' },
      payload => {
        const c = payload.new as any;
        this.prepend({
          id: `cot-${c.id}`,
          type: 'cotizacion',
          title: `Cotización de ${c.nombre}`,
          sub: c.empresa ?? '',
          time: c.created_at,
          route: ['/admin/cotizaciones'],
          tone: 'lila',
        });
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'productos_evento' },
      payload => {
        const p = payload.new as any;
        if (p.activo && p.stock_actual <= 3) {
          const notif: AdminNotif = {
            id: `stk-${p.id}`,
            type: 'stock',
            title: `Stock bajo · ${p.nombre}`,
            sub: `Solo ${p.stock_actual} unidad${p.stock_actual === 1 ? '' : 'es'} disponible${p.stock_actual === 1 ? '' : 's'}`,
            time: new Date().toISOString(),
            route: ['/admin/productos'],
            tone: 'sol',
          };
          // Reemplaza duplicado del mismo producto o prepende
          this.items.update(list => [notif, ...list.filter(n => n.id !== notif.id)].slice(0, 20));
        }
      }
    )
    .subscribe();
}

cleanup(): void {
  if (this.channel) {
    this.sb.db.removeChannel(this.channel);
    this.channel = null;
  }
}

private prepend(notif: AdminNotif): void {
  this.items.update(list => [notif, ...list.filter(n => n.id !== notif.id)].slice(0, 20));
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/notifications/notifications.service.ts
git commit -m "feat(notif): subscribe() Realtime + cleanup()"
```

---

### Task 3: NotificationsDropdownComponent — TS + template

Crea el componente standalone con su template. Sigue el mismo patrón de `AdminSearchComponent`.

**Files:**
- Create: `src/app/pages/admin/notifications/notifications-dropdown.component.ts`
- Create: `src/app/pages/admin/notifications/notifications-dropdown.component.html`

- [ ] **Step 1: Crear el archivo TypeScript**

```ts
// src/app/pages/admin/notifications/notifications-dropdown.component.ts
import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminNotif } from './notifications.service';

@Component({
  selector: 'app-notifications-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications-dropdown.component.html',
  styleUrl: './notifications-dropdown.component.scss',
})
export class NotificationsDropdownComponent {
  @Input() items: AdminNotif[] = [];
  @Output() closed = new EventEmitter<void>();

  private router = inject(Router);

  navigate(item: AdminNotif, e: MouseEvent): void {
    e.stopPropagation();
    this.router.navigate(item.route);
    this.closed.emit();
  }

  stopProp(e: MouseEvent): void {
    e.stopPropagation();
  }

  timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 2)  return 'ahora';
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `hace ${hrs} h`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? 'ayer' : `hace ${days} d`;
  }
}
```

- [ ] **Step 2: Crear el template HTML**

```html
<!-- src/app/pages/admin/notifications/notifications-dropdown.component.html -->
<div class="nd" (click)="stopProp($event)">

  <!-- Header -->
  <div class="nd-header">
    <span class="nd-title">
      Notificaciones
      @if (items.length > 0) {
        <span class="nd-badge">{{ items.length }}</span>
      }
    </span>
    <span class="nd-ts">Hoy</span>
  </div>

  <!-- Lista con items -->
  @if (items.length > 0) {
    <div class="nd-list">
      @for (item of items; track item.id) {
        <button class="nd-item" (click)="navigate(item, $event)">
          <div class="nd-ic" [class]="item.tone">
            @if (item.type === 'mensaje') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            }
            @if (item.type === 'cotizacion') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
              </svg>
            }
            @if (item.type === 'stock') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21 8-9-5-9 5 9 5 9-5Z"/>
                <path d="m3 8 9 5v8L3 16V8Z"/>
                <path d="m21 8-9 5v8l9-5V8Z"/>
              </svg>
            }
            @if (item.type === 'evento') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
            }
          </div>
          <div class="nd-body">
            <div class="nd-t">{{ item.title }}</div>
            <div class="nd-s">
              <span>{{ item.sub }}</span>
              <span class="sep">·</span>
              <span class="nd-time">{{ timeAgo(item.time) }}</span>
            </div>
          </div>
          <div class="nd-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </div>
        </button>
      }
    </div>

    <div class="nd-footer">
      <button class="nd-footer-link" (click)="closed.emit()">Cerrar</button>
    </div>

  } @else {

    <!-- Estado vacío -->
    <div class="nd-empty">
      <div class="nd-empty-ic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      </div>
      <div class="nd-empty-t">Todo al día</div>
      <div class="nd-empty-s">No hay actividad nueva en el panel por ahora.</div>
    </div>

  }

</div>
```

- [ ] **Step 3: Verificar que compila**

```bash
npx ng build --configuration development 2>&1 | tail -20
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/admin/notifications/notifications-dropdown.component.ts src/app/pages/admin/notifications/notifications-dropdown.component.html
git commit -m "feat(notif): NotificationsDropdownComponent — template + lógica"
```

---

### Task 4: NotificationsDropdownComponent — estilos

Crea el archivo SCSS del dropdown. Usa los tokens CSS del admin (`--rio-soft`, `--terra`, etc.) que ya están disponibles globalmente via `_admin.scss`.

**Files:**
- Create: `src/app/pages/admin/notifications/notifications-dropdown.component.scss`

- [ ] **Step 1: Crear el archivo de estilos**

```scss
// src/app/pages/admin/notifications/notifications-dropdown.component.scss

.nd {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 340px;
  background: var(--paper);
  border: 1px solid var(--carbon-12);
  border-radius: 14px;
  box-shadow: 0 12px 48px rgba(21, 31, 40, 0.14), 0 2px 8px rgba(21, 31, 40, 0.08);
  z-index: 50;
  overflow: hidden;
  animation: ndIn 0.15s ease;
}

@keyframes ndIn {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

// ── Header ──────────────────────────────────────────────────────────────────
.nd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--carbon-08);
}

.nd-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--carbon);
  display: flex;
  align-items: center;
  gap: 8px;
}

.nd-badge {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  background: var(--terra);
  color: #fff;
  padding: 2px 7px;
  border-radius: 999px;
  letter-spacing: 0.04em;
}

.nd-ts {
  font-family: var(--mono);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--carbon-30);
}

// ── Lista ────────────────────────────────────────────────────────────────────
.nd-list {
  max-height: 380px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--carbon-12) transparent;

  &::-webkit-scrollbar        { width: 4px; }
  &::-webkit-scrollbar-track  { background: transparent; }
  &::-webkit-scrollbar-thumb  { background: var(--carbon-12); border-radius: 999px; }
}

// ── Item ─────────────────────────────────────────────────────────────────────
.nd-item {
  display: grid;
  grid-template-columns: 32px 1fr 14px;
  gap: 10px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--carbon-08);
  align-items: center;
  width: 100%;
  text-align: left;
  background: none;
  border-left: 0;
  border-right: 0;
  border-top: 0;
  cursor: pointer;
  transition: background 0.1s;

  &:last-child { border-bottom: 0; }
  &:hover { background: var(--cream); }
  &:hover .nd-arrow { opacity: 1; }
}

// ── Ícono coloreado ───────────────────────────────────────────────────────────
.nd-ic {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;

  svg { width: 14px; height: 14px; }

  &.rio   { background: var(--rio-soft);   color: var(--rio);   }
  &.lila  { background: var(--lila-soft);  color: var(--lila);  }
  &.sol   { background: var(--sol-soft);   color: #B07820;      }
  &.rosa  { background: var(--rosa-soft);  color: var(--rosa);  }
}

// ── Cuerpo del item ───────────────────────────────────────────────────────────
.nd-body { min-width: 0; }

.nd-t {
  font-size: 13px;
  font-weight: 500;
  color: var(--carbon);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.nd-s {
  font-size: 11.5px;
  color: var(--carbon-50);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  overflow: hidden;

  span { overflow: hidden; text-overflow: ellipsis; }
  .sep { color: var(--carbon-12); flex-shrink: 0; }
}

.nd-time {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--carbon-30);
  white-space: nowrap;
  flex-shrink: 0;
}

// ── Flecha hover ─────────────────────────────────────────────────────────────
.nd-arrow {
  color: var(--carbon-30);
  opacity: 0;
  transition: opacity 0.1s;
  flex-shrink: 0;

  svg { width: 12px; height: 12px; }
}

// ── Footer ────────────────────────────────────────────────────────────────────
.nd-footer {
  padding: 10px 14px;
  border-top: 1px solid var(--carbon-08);
  background: var(--cream);
  display: flex;
  justify-content: center;
}

.nd-footer-link {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--carbon-30);
  background: none;
  border: 0;
  cursor: pointer;
  padding: 2px 0;
  transition: color 0.1s;

  &:hover { color: var(--terra); }
}

// ── Estado vacío ──────────────────────────────────────────────────────────────
.nd-empty {
  padding: 36px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.nd-empty-ic {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--selva-soft);
  display: grid;
  place-items: center;
  color: var(--selva);

  svg { width: 20px; height: 20px; }
}

.nd-empty-t {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--carbon);
}

.nd-empty-s {
  font-size: 12px;
  color: var(--carbon-50);
  max-width: 22ch;
  line-height: 1.5;
}
```

- [ ] **Step 2: Verificar visualmente en el navegador**

Iniciar el servidor de desarrollo:
```bash
npx ng serve
```
Abrir `http://localhost:4200/admin`. El componente aún no está montado en el shell — esto se hace en el siguiente task. Solo verificar que no hay errores de compilación en la consola.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/notifications/notifications-dropdown.component.scss
git commit -m "feat(notif): estilos del dropdown de notificaciones"
```

---

### Task 5: Integrar en AdminShellComponent

Conecta el servicio y el componente al shell. Modifica el TypeScript y el template.

**Files:**
- Modify: `src/app/pages/admin/admin-shell.component.ts`
- Modify: `src/app/pages/admin/admin-shell.component.html`

- [ ] **Step 1: Actualizar `admin-shell.component.ts`**

Cambios en el archivo existente:

**a) Agregar imports en la sección de imports del módulo:**
```ts
import { NotificationsService }       from './notifications/notifications.service';
import { NotificationsDropdownComponent } from './notifications/notifications-dropdown.component';
```

**b) Agregar `NotificationsDropdownComponent` al array `imports` del decorador `@Component`:**
```ts
imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, AdminSearchComponent, NotificationsDropdownComponent],
```

**c) Agregar la signal y el servicio en el cuerpo de la clase** (después de `searchOpen`):
```ts
notifOpen     = signal(false);
readonly notifSvc = inject(NotificationsService);
```

**d) Extender el `HostListener` existente para cerrar con Escape:**

Reemplazar el método `onGlobalKey` existente por:
```ts
@HostListener('document:keydown', ['$event'])
onGlobalKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    if (this.sb.session()) this.searchOpen.update(v => !v);
  }
  if (e.key === 'Escape') {
    this.notifOpen.set(false);
    this.searchOpen.set(false);
  }
}
```

**e) Agregar `ngOnDestroy` a la clase e implementar la interfaz.** Modificar la línea de la clase:
```ts
export class AdminShellComponent implements OnInit, OnDestroy {
```

Agregar `OnDestroy` al import de `@angular/core`:
```ts
import { Component, computed, signal, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
```

Agregar el método `ngOnDestroy` al final de la clase:
```ts
ngOnDestroy(): void {
  this.notifSvc.cleanup();
}
```

**f) Agregar llamadas en `ngOnInit`** (después de `this.unreadSvc.load()`):
```ts
ngOnInit() {
  this.sb.db.auth.onAuthStateChange(() => {});
  this.unreadSvc.load();
  this.notifSvc.load();
  this.notifSvc.subscribe();
}
```

- [ ] **Step 2: Actualizar `admin-shell.component.html`**

Localizar el bloque `<div class="top-actions-admin">` (línea ~126) y reemplazarlo completo:

```html
<div class="top-actions-admin">
  <div class="notif-wrap">
    <button
      class="ib"
      title="Notificaciones"
      (click)="notifOpen.set(!notifOpen()); $event.stopPropagation()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 16H6a3 3 0 0 0 3-3V9a3 3 0 0 1 6 0v4a3 3 0 0 0 3 3Z"/>
        <path d="M10 19a2 2 0 0 0 4 0"/>
      </svg>
      @if (notifSvc.unread() > 0) { <span class="dot"></span> }
    </button>
    @if (notifOpen()) {
      <div class="notif-overlay" (click)="notifOpen.set(false)"></div>
      <app-notifications-dropdown
        [items]="notifSvc.items()"
        (closed)="notifOpen.set(false)" />
    }
  </div>
</div>
```

- [ ] **Step 3: Agregar estilos para `.notif-wrap` y `.notif-overlay` en `_admin.scss`**

Dentro del bloque `.top-actions-admin` en `src/styles/_admin.scss`, agregar después del bloque `.ib` existente:

```scss
.notif-wrap {
  position: relative;
}

.notif-overlay {
  position: fixed;
  inset: 0;
  z-index: 49;
  background: transparent;
}
```

- [ ] **Step 4: Verificar en el navegador**

```bash
npx ng serve
```

1. Ir a `http://localhost:4200/admin` e iniciar sesión.
2. Hacer click en la campana — el dropdown debe abrirse con animación.
3. Hacer click fuera del dropdown — debe cerrarse.
4. Presionar Escape — debe cerrarse.
5. Si hay mensajes sin leer o cotizaciones pendientes, deben aparecer en la lista y el punto rojo debe ser visible en la campana.
6. El estado vacío "Todo al día" debe aparecer si no hay ninguna notificación.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/admin-shell.component.ts src/app/pages/admin/admin-shell.component.html src/styles/_admin.scss
git commit -m "feat(notif): integrar dropdown de notificaciones en admin shell"
```
