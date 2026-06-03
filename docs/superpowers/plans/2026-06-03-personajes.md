# Personajes Cuaquiverso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo completo de personajes: tabla Supabase, servicio Angular, admin CRUD con drag-reorder, página pública individual, y conexión de páginas existentes con datos reales.

**Architecture:** `PersonajesService` signal-based (patrón `InventarioService`) como fuente única de verdad. Admin en child routes del shell existente con CDK DragDrop. Página pública `/cuaquiverso/personaje/:slug` con layout editorial. `cuaquiverso.component` y `universo.component` leen del servicio en lugar de arrays hardcodeados.

**Tech Stack:** Angular 21 standalone, Supabase (PostgreSQL + Storage), `@angular/cdk@^21.0.0` drag-drop, Three.js (existente), Signals.

---

## Archivos a crear / modificar

**Nuevos:**
- `supabase/migrations/20260603_create_personajes.sql`
- `src/app/core/services/personajes.service.ts`
- `src/app/pages/admin/personajes/personajes-list.component.ts`
- `src/app/pages/admin/personajes/personajes-list.component.html`
- `src/app/pages/admin/personajes/personajes-list.component.scss`
- `src/app/pages/admin/personajes/personaje-form.component.ts`
- `src/app/pages/admin/personajes/personaje-form.component.html`
- `src/app/pages/admin/personajes/personaje-form.component.scss`
- `src/app/pages/admin/personajes/personaje-detail.component.ts`
- `src/app/pages/admin/personajes/personaje-detail.component.html`
- `src/app/pages/admin/personajes/personaje-detail.component.scss`
- `src/app/pages/cuaquiverso/personaje/personaje-page.component.ts`
- `src/app/pages/cuaquiverso/personaje/personaje-page.component.html`
- `src/app/pages/cuaquiverso/personaje/personaje-page.component.scss`

**Modificados:**
- `package.json` — agregar `@angular/cdk`
- `src/app/app.routes.ts` — 4 rutas admin + 1 pública
- `src/app/pages/admin/admin-shell.component.ts` — crumbs + nav + `goPersonajes()`
- `src/app/pages/admin/admin-shell.component.html` — active state para personajes
- `src/app/pages/cuaquiverso/cuaquiverso.component.ts` — elenco dinámico + Three.js desde servicio
- `src/app/pages/cuaquiverso/universo/universo.component.ts` — índice dinámico
- `src/app/pages/cuaquiverso/universo/universo.component.html` — links a páginas individuales

---

## Task 1: CDK + Migración Supabase

**Files:**
- Create: `supabase/migrations/20260603_create_personajes.sql`
- Modify: `package.json`

- [ ] **Instalar Angular CDK**

```bash
npm install @angular/cdk@^21.0.0
```

Verificar que `package.json` tiene `"@angular/cdk": "^21.0.0"` en `dependencies`.

- [ ] **Crear directorio de migraciones si no existe**

```bash
mkdir -p supabase/migrations
```

- [ ] **Crear la migración SQL**

Crear `supabase/migrations/20260603_create_personajes.sql`:

```sql
CREATE TABLE IF NOT EXISTS personajes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text        UNIQUE NOT NULL,
  nombre       text        NOT NULL,
  sort_order   integer     NOT NULL DEFAULT 0,
  region       text,
  color        text,
  wire_color   text,
  slogan       text,
  bio          text,
  musica       text,
  personalidad text,
  fauna_flora  text,
  cover_url    text,
  galeria_urls text[]      NOT NULL DEFAULT '{}',
  activo       boolean     NOT NULL DEFAULT true,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO personajes (key, nombre, sort_order, color, wire_color) VALUES
  ('cuac',       'Cuac',       1, '#2A6FDB', '#5C95EA'),
  ('kiki',       'Kiki',       2, '#FF6FA8', '#FFB1CF'),
  ('roar',       'Roar',       3, '#3D4856', '#7A8694'),
  ('yeison',     'Yeison',     4, '#E8A434', '#FFD27A'),
  ('abejandro',  'Abejandro',  5, '#E8623D', '#F5957C'),
  ('atolita',    'Atolita',    6, '#8B6FD8', '#B9A4F0'),
  ('colibriana', 'Colibriana', 7, '#1F8A5B', '#5BB890'),
  ('tiburcio',   'Tiburcio',   8, '#2E8FB8', '#7DC1DC')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Aplicar la migración en Supabase**

En el dashboard de Supabase → SQL Editor, ejecutar el contenido del archivo. Verificar que la tabla `personajes` aparece con 8 filas.

- [ ] **Crear bucket `personajes-media` en Supabase Storage**

En Supabase → Storage → New bucket: nombre `personajes-media`, público (Public bucket). Verificar que aparece en la lista.

- [ ] **Commit**

```bash
git add supabase/migrations/20260603_create_personajes.sql package.json package-lock.json
git commit -m "feat(personajes): add CDK, Supabase migration and storage bucket"
```

---

## Task 2: PersonajesService

**Files:**
- Create: `src/app/core/services/personajes.service.ts`

- [ ] **Crear el servicio**

Crear `src/app/core/services/personajes.service.ts`:

```typescript
import { Injectable, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Personaje {
  id: string;
  key: string;
  nombre: string;
  sort_order: number;
  region: string | null;
  color: string | null;
  wire_color: string | null;
  slogan: string | null;
  bio: string | null;
  musica: string | null;
  personalidad: string | null;
  fauna_flora: string | null;
  cover_url: string | null;
  galeria_urls: string[];
  activo: boolean;
  creado_en: string;
}

@Injectable({ providedIn: 'root' })
export class PersonajesService {
  readonly personajes = signal<Personaje[]>([]);
  readonly cargando   = signal(false);
  readonly error      = signal<string | null>(null);

  readonly activos = computed(() =>
    this.personajes().filter(p => p.activo).sort((a, b) => a.sort_order - b.sort_order)
  );

  constructor(private sb: SupabaseService) {}

  async load(): Promise<void> {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set(null);
    const { data, error } = await this.sb.db
      .from('personajes')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      this.error.set(error.message);
      this.cargando.set(false);
      return;
    }
    this.personajes.set(
      (data ?? []).map(p => ({ ...p, galeria_urls: p.galeria_urls ?? [] }))
    );
    this.cargando.set(false);
  }

  getByKey(key: string): Personaje | undefined {
    return this.personajes().find(p => p.key === key);
  }

  async create(
    payload: Omit<Personaje, 'id' | 'creado_en'>,
    coverFile?: File,
    galleryFiles: File[] = []
  ): Promise<{ id: string | null; error: string | null }> {
    const { data, error } = await this.sb.db
      .from('personajes')
      .insert(payload)
      .select('id')
      .single();
    if (error) return { id: null, error: error.message };
    const id = data.id as string;

    let cover_url = payload.cover_url;
    if (coverFile) {
      const { url } = await this.uploadImage(id, coverFile, 'cover');
      if (url) cover_url = url;
    }

    const galeria_urls: string[] = [];
    for (let i = 0; i < galleryFiles.length; i++) {
      const { url } = await this.uploadImage(id, galleryFiles[i], `gallery_${i}`);
      if (url) galeria_urls.push(url);
    }

    if (coverFile || galleryFiles.length > 0) {
      await this.sb.db.from('personajes').update({ cover_url, galeria_urls }).eq('id', id);
    }

    await this.load();
    return { id, error: null };
  }

  async update(
    id: string,
    payload: Partial<Omit<Personaje, 'id' | 'creado_en'>>,
    coverFile?: File,
    newGalleryFiles: File[] = [],
    removedUrls: string[] = []
  ): Promise<{ error: string | null }> {
    let cover_url = payload.cover_url;
    if (coverFile) {
      const ext = coverFile.name.split('.').pop() ?? 'jpg';
      const { url } = await this.uploadImage(id, coverFile, `cover.${ext}`);
      if (url) cover_url = url;
    }

    const existing = (payload.galeria_urls ?? []).filter(u => !removedUrls.includes(u));
    const newUrls: string[] = [];
    for (let i = 0; i < newGalleryFiles.length; i++) {
      const ext = newGalleryFiles[i].name.split('.').pop() ?? 'jpg';
      const { url } = await this.uploadImage(id, newGalleryFiles[i], `gallery_${Date.now()}_${i}.${ext}`);
      if (url) newUrls.push(url);
    }

    const { error } = await this.sb.db
      .from('personajes')
      .update({ ...payload, cover_url, galeria_urls: [...existing, ...newUrls] })
      .eq('id', id);
    if (error) return { error: error.message };

    await this.load();
    return { error: null };
  }

  async updateOrder(items: { id: string; sort_order: number }[]): Promise<void> {
    for (const item of items) {
      await this.sb.db
        .from('personajes')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id);
    }
    await this.load();
  }

  async toggleActivo(id: string, activo: boolean): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('personajes')
      .update({ activo })
      .eq('id', id);
    if (error) return { error: error.message };
    await this.load();
    return { error: null };
  }

  async delete(id: string): Promise<{ error: string | null }> {
    const { error } = await this.sb.db
      .from('personajes')
      .delete()
      .eq('id', id);
    if (error) return { error: error.message };
    await this.load();
    return { error: null };
  }

  async uploadImage(
    personajeId: string,
    file: File,
    name: string
  ): Promise<{ url: string | null; error: string | null }> {
    const safeName = name.replace(/[^a-z0-9._-]/gi, '_');
    const path = `${personajeId}/${safeName}`;
    const { error } = await this.sb.db.storage
      .from('personajes-media')
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) return { url: null, error: error.message };
    const { data } = this.sb.db.storage
      .from('personajes-media')
      .getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }
}
```

- [ ] **Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | head -30
```

Esperado: sin errores de TypeScript relacionados con `PersonajesService`.

- [ ] **Commit**

```bash
git add src/app/core/services/personajes.service.ts
git commit -m "feat(personajes): add PersonajesService with Supabase CRUD and image upload"
```

---

## Task 3: Rutas + Admin Shell

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/pages/admin/admin-shell.component.ts`
- Modify: `src/app/pages/admin/admin-shell.component.html`

- [ ] **Agregar rutas en `app.routes.ts`**

Agregar después del bloque `// New eventos routes` y antes del bloque `// Ajustes`:

```typescript
// Personajes
{
  path: 'personajes',
  loadComponent: () =>
    import('./pages/admin/personajes/personajes-list.component').then(
      m => m.PersonajesListComponent,
    ),
},
{
  path: 'personajes/nuevo',
  loadComponent: () =>
    import('./pages/admin/personajes/personaje-form.component').then(
      m => m.PersonajeFormComponent,
    ),
},
{
  path: 'personajes/:id',
  loadComponent: () =>
    import('./pages/admin/personajes/personaje-detail.component').then(
      m => m.PersonajeDetailComponent,
    ),
},
{
  path: 'personajes/:id/editar',
  loadComponent: () =>
    import('./pages/admin/personajes/personaje-form.component').then(
      m => m.PersonajeFormComponent,
    ),
},
```

Agregar también la ruta pública, fuera del bloque `admin`, junto con las otras rutas de cuaquiverso:

```typescript
{
  path: 'cuaquiverso/personaje/:slug',
  loadComponent: () =>
    import('./pages/cuaquiverso/personaje/personaje-page.component').then(
      m => m.PersonajePageComponent,
    ),
},
```

- [ ] **Actualizar `admin-shell.component.ts`**

Agregar `isPersonajesRoute` computed, crumbs para personajes, y `goPersonajes()`. Editar el método `goHome` para que `contenido` navegue a `/admin/personajes`.

Añadir después de `isAjustesRoute`:
```typescript
isPersonajesRoute = computed(() => this.routerUrl().includes('/admin/personajes'));
```

Añadir al inicio del bloque `crumbs = computed(...)`, antes de la línea `if (url.includes('/ajustes/negocio'))`:
```typescript
if (url.includes('/personajes/nuevo'))        return ['Universo', 'Personajes', 'Nuevo'];
if (url.match(/\/personajes\/.+\/editar/))    return ['Universo', 'Personajes', 'Editar'];
if (url.match(/\/personajes\/[^/]+$/))        return ['Universo', 'Personajes', 'Detalle'];
if (url.includes('/personajes'))              return ['Universo', 'Personajes'];
```

En `goHome`, añadir antes del `if (id === 'ajustes')`:
```typescript
if (id === 'contenido') {
  this.router.navigate(['/admin/personajes']);
  return;
}
```

Añadir método:
```typescript
goPersonajes() { this.router.navigate(['/admin/personajes']); }
```

- [ ] **Actualizar `admin-shell.component.html` — active state del nav**

Localizar la línea del nav de `NAV_UNIVERSO` que tiene `[class.is-active]` y reemplazar la condición completa:

```html
<a [class.is-active]="(state.view() === id && !isPortafolioRoute() && !isCotizacionesRoute() && !isProductosRoute() && !isEventosRoute() && !isAjustesRoute() && !isPersonajesRoute()) || (id === 'contenido' && isPersonajesRoute()) || (id === 'ajustes' && isAjustesRoute())" (click)="goHome(id)">
```

- [ ] **Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | head -30
```

Esperado: sin errores.

- [ ] **Commit**

```bash
git add src/app/app.routes.ts src/app/pages/admin/admin-shell.component.ts src/app/pages/admin/admin-shell.component.html
git commit -m "feat(personajes): add admin and public routes, update admin shell nav"
```

---

## Task 4: PersonajesListComponent

**Files:**
- Create: `src/app/pages/admin/personajes/personajes-list.component.ts`
- Create: `src/app/pages/admin/personajes/personajes-list.component.html`
- Create: `src/app/pages/admin/personajes/personajes-list.component.scss`

- [ ] **Crear el componente TypeScript**

```typescript
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { PersonajesService, Personaje } from '../../../core/services/personajes.service';

@Component({
  selector: 'app-personajes-list',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './personajes-list.component.html',
  styleUrl: './personajes-list.component.scss',
})
export class PersonajesListComponent implements OnInit {
  readonly svc    = inject(PersonajesService);
  private router  = inject(Router);

  toast           = signal<string | null>(null);
  confirmDeleteId = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  async ngOnInit() {
    await this.svc.load();
  }

  onDrop(event: CdkDragDrop<Personaje[]>) {
    const items = [...this.svc.personajes()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.svc.personajes.set(items);
    const updates = items.map((p, i) => ({ id: p.id, sort_order: i + 1 }));
    this.svc.updateOrder(updates).then(() => this.flash('Orden guardado'));
  }

  async toggleActivo(p: Personaje) {
    const { error } = await this.svc.toggleActivo(p.id, !p.activo);
    if (error) this.flash('Error: ' + error);
    else this.flash(p.activo ? 'Desactivado' : 'Activado');
  }

  async confirmDelete(id: string) {
    this.confirmDeleteId.set(id);
  }

  async deleteConfirmed() {
    const id = this.confirmDeleteId();
    if (!id) return;
    const { error } = await this.svc.delete(id);
    this.confirmDeleteId.set(null);
    if (error) this.flash('Error al eliminar');
    else this.flash('Personaje eliminado');
  }

  cancelDelete() { this.confirmDeleteId.set(null); }

  goNuevo()          { this.router.navigate(['/admin/personajes/nuevo']); }
  goDetalle(id: string) { this.router.navigate(['/admin/personajes', id]); }
  goEditar(id: string)  { this.router.navigate(['/admin/personajes', id, 'editar']); }

  flash(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2400);
  }
}
```

- [ ] **Crear la plantilla HTML**

```html
<div class="list-header">
  <div>
    <h2>Personajes</h2>
    <p class="sub">{{ svc.personajes().length }} personajes · arrastra para reordenar</p>
  </div>
  <button class="btn-primary" (click)="goNuevo()">+ Nuevo personaje</button>
</div>

@if (svc.cargando()) {
  <div class="loading">Cargando personajes…</div>
}

<div class="drag-list" cdkDropList (cdkDropListDropped)="onDrop($event)">
  @for (p of svc.personajes(); track p.id) {
    <div class="drag-row" cdkDrag>
      <span class="drag-handle" cdkDragHandle title="Arrastrar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="5" cy="12" r="1.2"/>
          <circle cx="11" cy="4" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
        </svg>
      </span>

      <div class="row-thumb" [style.background]="p.color ?? '#ccc'">
        @if (p.cover_url) {
          <img [src]="p.cover_url" [alt]="p.nombre" />
        } @else {
          <span>{{ p.nombre[0] }}</span>
        }
      </div>

      <div class="row-info">
        <strong>{{ p.nombre }}</strong>
        <span class="region">{{ p.region ?? '—' }}</span>
      </div>

      <div class="row-order">#{{ p.sort_order }}</div>

      <button
        class="toggle-btn"
        [class.active]="p.activo"
        (click)="toggleActivo(p)"
        [title]="p.activo ? 'Desactivar' : 'Activar'">
        {{ p.activo ? 'Activo' : 'Inactivo' }}
      </button>

      <div class="row-actions">
        <button (click)="goDetalle(p.id)" title="Ver detalle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button (click)="goEditar(p.id)" title="Editar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
        </button>
        <button class="delete-btn" (click)="confirmDelete(p.id)" title="Eliminar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>

      <div class="drag-preview" *cdkDragPreview>{{ p.nombre }}</div>
    </div>
  }
</div>

@if (confirmDeleteId()) {
  <div class="confirm-overlay">
    <div class="confirm-box">
      <p>¿Eliminar este personaje? Esta acción no se puede deshacer.</p>
      <div class="confirm-actions">
        <button (click)="cancelDelete()">Cancelar</button>
        <button class="btn-danger" (click)="deleteConfirmed()">Eliminar</button>
      </div>
    </div>
  </div>
}

@if (toast()) {
  <div class="toast">{{ toast() }}</div>
}
```

- [ ] **Crear SCSS**

```scss
.list-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: var(--s-6);
  h2 { font-size: 20px; font-weight: 700; color: var(--carbon); margin: 0; }
  .sub { font-size: 13px; color: var(--carbon-50); margin-top: 2px; }
}

.btn-primary {
  padding: 8px 16px; background: var(--carbon); color: var(--paper);
  border: none; border-radius: var(--r-md); font-size: 13px; font-weight: 600;
  cursor: pointer; white-space: nowrap;
  &:hover { background: #2d3d4d; }
}

.loading { padding: 32px; text-align: center; color: var(--carbon-50); font-size: 14px; }

.drag-list { display: flex; flex-direction: column; gap: 6px; }

.drag-row {
  display: flex; align-items: center; gap: 12px;
  background: var(--paper); border: 1px solid var(--carbon-08);
  border-radius: var(--r-md); padding: 10px 12px;
  cursor: default;
  &.cdk-drag-animating { transition: transform 250ms cubic-bezier(0,0,0.2,1); }
}

.cdk-drop-list-dragging .drag-row:not(.cdk-drag-placeholder) {
  transition: transform 250ms cubic-bezier(0,0,0.2,1);
}
.cdk-drag-placeholder { opacity: 0; }

.drag-handle {
  cursor: grab; color: var(--carbon-30); flex-shrink: 0;
  display: flex; align-items: center;
  &:active { cursor: grabbing; }
}

.row-thumb {
  width: 40px; height: 40px; border-radius: var(--r-sm); flex-shrink: 0;
  overflow: hidden; display: flex; align-items: center; justify-content: center;
  img { width: 100%; height: 100%; object-fit: cover; }
  span { color: #fff; font-weight: 700; font-size: 16px; }
}

.row-info { flex: 1; min-width: 0;
  strong { display: block; font-size: 14px; font-weight: 600; color: var(--carbon); }
  .region { font-size: 12px; color: var(--carbon-50); }
}

.row-order { font-size: 12px; color: var(--carbon-30); width: 28px; text-align: right; flex-shrink: 0; }

.toggle-btn {
  padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
  border: 1px solid var(--carbon-12); background: var(--carbon-04); color: var(--carbon-50);
  cursor: pointer;
  &.active { background: #e8f5ee; border-color: #1F8A5B; color: #1F8A5B; }
}

.row-actions {
  display: flex; gap: 4px;
  button {
    width: 32px; height: 32px; border-radius: var(--r-sm); border: none;
    background: transparent; color: var(--carbon-40); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    &:hover { background: var(--carbon-04); color: var(--carbon); }
  }
  .delete-btn:hover { background: #fee; color: #c00; }
}

.confirm-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.confirm-box {
  background: #fff; border-radius: var(--r-lg); padding: 24px;
  max-width: 360px; box-shadow: 0 8px 32px rgba(0,0,0,.16);
  p { font-size: 14px; color: var(--carbon); margin-bottom: 20px; }
}
.confirm-actions { display: flex; gap: 10px; justify-content: flex-end;
  button { padding: 8px 16px; border-radius: var(--r-md); border: 1px solid var(--carbon-12); background: #fff; cursor: pointer; font-size: 13px; }
  .btn-danger { background: #c00; color: #fff; border-color: #c00; }
}

.toast {
  position: fixed; bottom: 24px; right: 24px;
  background: var(--carbon); color: var(--paper);
  padding: 10px 18px; border-radius: var(--r-md); font-size: 13px;
  animation: toast-in .2s ease-out;
  z-index: 200;
}
@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
```

- [ ] **Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | head -30
```

- [ ] **Commit**

```bash
git add src/app/pages/admin/personajes/
git commit -m "feat(personajes): admin list with CDK drag-drop reorder"
```

---

## Task 5: PersonajeFormComponent

**Files:**
- Create: `src/app/pages/admin/personajes/personaje-form.component.ts`
- Create: `src/app/pages/admin/personajes/personaje-form.component.html`
- Create: `src/app/pages/admin/personajes/personaje-form.component.scss`

- [ ] **Crear el componente TypeScript**

```typescript
import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { PersonajesService } from '../../../core/services/personajes.service';

@Component({
  selector: 'app-personaje-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './personaje-form.component.html',
  styleUrl: './personaje-form.component.scss',
})
export class PersonajeFormComponent implements OnInit {
  private router  = inject(Router);
  private route   = inject(ActivatedRoute);
  private fb      = inject(FormBuilder);
  readonly svc    = inject(PersonajesService);

  readonly editId  = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly errorMsg  = signal<string | null>(null);
  readonly isEdit    = computed(() => this.editId() !== null);

  readonly coverPreview    = signal<string | null>(null);
  readonly galleryPreviews = signal<string[]>([]);
  private coverFile?: File;
  private newGalleryFiles: File[] = [];
  private removedUrls: string[] = [];

  form = this.fb.group({
    nombre:       ['', [Validators.required, Validators.minLength(2)]],
    key:          ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    region:       [''],
    color:        ['#2A6FDB'],
    wire_color:   ['#5C95EA'],
    slogan:       ['', Validators.maxLength(120)],
    bio:          [''],
    musica:       [''],
    personalidad: [''],
    fauna_flora:  [''],
    activo:       [true],
  });

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      await this.svc.load();
      const p = this.svc.getByKey(id) ?? this.svc.personajes().find(x => x.id === id);
      if (p) {
        this.form.patchValue({
          nombre:       p.nombre,
          key:          p.key,
          region:       p.region ?? '',
          color:        p.color ?? '#2A6FDB',
          wire_color:   p.wire_color ?? '#5C95EA',
          slogan:       p.slogan ?? '',
          bio:          p.bio ?? '',
          musica:       p.musica ?? '',
          personalidad: p.personalidad ?? '',
          fauna_flora:  p.fauna_flora ?? '',
          activo:       p.activo,
        });
        this.form.get('key')?.disable();
        this.coverPreview.set(p.cover_url);
        this.galleryPreviews.set([...(p.galeria_urls ?? [])]);
      }
    }

    // Auto-generate key from nombre when creating
    if (!this.isEdit()) {
      this.form.get('nombre')?.valueChanges.subscribe(v => {
        if (v && !this.form.get('key')?.dirty) {
          const slug = v.toLowerCase().normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          this.form.get('key')?.setValue(slug, { emitEvent: false });
        }
      });
    }
  }

  onCoverChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.coverFile = file;
    const reader = new FileReader();
    reader.onload = e => this.coverPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  onGalleryChange(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    const current = this.galleryPreviews().length;
    const remaining = 8 - current;
    const toAdd = files.slice(0, remaining);
    this.newGalleryFiles.push(...toAdd);
    toAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        this.galleryPreviews.update(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }

  removeGalleryImage(index: number) {
    const url = this.galleryPreviews()[index];
    // If it's an existing URL (not a data URL), mark it for removal
    if (url && !url.startsWith('data:')) {
      this.removedUrls.push(url);
    } else {
      // Remove from newGalleryFiles
      const dataUrls = this.galleryPreviews().filter(u => u.startsWith('data:'));
      const fileIndex = dataUrls.indexOf(url);
      if (fileIndex >= 0) this.newGalleryFiles.splice(fileIndex, 1);
    }
    this.galleryPreviews.update(prev => prev.filter((_, i) => i !== index));
  }

  async guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.errorMsg.set(null);

    const v = this.form.getRawValue();
    const existingGallery = this.galleryPreviews().filter(u => !u.startsWith('data:'));

    try {
      if (this.isEdit()) {
        const { error } = await this.svc.update(
          this.editId()!,
          {
            nombre:       v.nombre!,
            region:       v.region || null,
            color:        v.color || null,
            wire_color:   v.wire_color || null,
            slogan:       v.slogan || null,
            bio:          v.bio || null,
            musica:       v.musica || null,
            personalidad: v.personalidad || null,
            fauna_flora:  v.fauna_flora || null,
            activo:       v.activo ?? true,
            galeria_urls: existingGallery,
          },
          this.coverFile,
          this.newGalleryFiles,
          this.removedUrls
        );
        if (error) { this.errorMsg.set(error); return; }
      } else {
        const nextOrder = this.svc.personajes().length + 1;
        const { error } = await this.svc.create(
          {
            key:          v.key!,
            nombre:       v.nombre!,
            sort_order:   nextOrder,
            region:       v.region || null,
            color:        v.color || null,
            wire_color:   v.wire_color || null,
            slogan:       v.slogan || null,
            bio:          v.bio || null,
            musica:       v.musica || null,
            personalidad: v.personalidad || null,
            fauna_flora:  v.fauna_flora || null,
            cover_url:    null,
            galeria_urls: [],
            activo:       v.activo ?? true,
          },
          this.coverFile,
          this.newGalleryFiles
        );
        if (error) { this.errorMsg.set(error); return; }
      }
      this.router.navigate(['/admin/personajes']);
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar() { this.router.navigate(['/admin/personajes']); }

  field(name: string): AbstractControl { return this.form.get(name)!; }
  isInvalid(name: string): boolean {
    const c = this.field(name); return c.invalid && c.touched;
  }
}
```

- [ ] **Crear la plantilla HTML**

```html
<div class="form-page">
  <div class="form-header">
    <button class="back-btn" (click)="cancelar()">← Personajes</button>
    <h2>{{ isEdit() ? 'Editar personaje' : 'Nuevo personaje' }}</h2>
  </div>

  <form [formGroup]="form" (ngSubmit)="guardar()" class="form-body">
    <div class="form-grid">

      <!-- Columna izquierda: datos -->
      <div class="form-col">
        <section class="form-section">
          <h3>Identidad</h3>

          <div class="field">
            <label>Nombre <span class="req">*</span></label>
            <input formControlName="nombre" type="text" placeholder="Ej: Cuac" />
            @if (isInvalid('nombre')) { <span class="err">Nombre requerido (mínimo 2 caracteres)</span> }
          </div>

          <div class="field">
            <label>Key / slug <span class="req">*</span></label>
            <input formControlName="key" type="text" placeholder="ej: cuac" [attr.disabled]="isEdit() ? true : null" />
            <span class="hint">Solo minúsculas, números y guiones. {{ isEdit() ? 'No editable.' : 'Se genera automáticamente.' }}</span>
            @if (isInvalid('key')) { <span class="err">Solo letras minúsculas, números y guiones</span> }
          </div>

          <div class="field">
            <label>Región</label>
            <input formControlName="region" type="text" placeholder="Ej: Bogotá · migratorio" />
          </div>

          <div class="field-row">
            <div class="field">
              <label>Color principal</label>
              <div class="color-wrap">
                <input formControlName="color" type="color" class="color-input" />
                <input formControlName="color" type="text" class="color-text" placeholder="#2A6FDB" />
              </div>
            </div>
            <div class="field">
              <label>Color wire (Three.js)</label>
              <div class="color-wrap">
                <input formControlName="wire_color" type="color" class="color-input" />
                <input formControlName="wire_color" type="text" class="color-text" placeholder="#5C95EA" />
              </div>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h3>Personalidad</h3>

          <div class="field">
            <label>Frase / eslogan</label>
            <input formControlName="slogan" type="text" placeholder="Ej: Siempre hay un páramo más por descubrir." maxlength="120" />
            <span class="hint">{{ field('slogan').value?.length ?? 0 }} / 120</span>
          </div>

          <div class="field">
            <label>Bio</label>
            <textarea formControlName="bio" rows="5" placeholder="Historia del personaje…"></textarea>
          </div>

          <div class="field">
            <label>Música</label>
            <input formControlName="musica" type="text" placeholder="Ej: Vallenato · jazz" />
          </div>

          <div class="field">
            <label>Personalidad</label>
            <input formControlName="personalidad" type="text" placeholder="Ej: Curioso, soñador" />
          </div>

          <div class="field">
            <label>Fauna / flora asociada</label>
            <input formControlName="fauna_flora" type="text" placeholder="Ej: Frailejones" />
          </div>
        </section>

        <section class="form-section">
          <h3>Estado</h3>
          <label class="toggle-label">
            <input formControlName="activo" type="checkbox" />
            <span>Activo (visible en el sitio)</span>
          </label>
        </section>
      </div>

      <!-- Columna derecha: imágenes -->
      <div class="form-col">
        <section class="form-section">
          <h3>Imagen principal</h3>
          <div class="cover-upload">
            @if (coverPreview()) {
              <div class="cover-preview">
                <img [src]="coverPreview()!" alt="Cover" />
                <button type="button" class="remove-cover" (click)="coverPreview.set(null)">✕</button>
              </div>
            } @else {
              <label class="upload-area" for="cover-input">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Subir imagen principal</span>
                <span class="hint">PNG, JPG, WEBP</span>
              </label>
              <input id="cover-input" type="file" accept="image/*" (change)="onCoverChange($event)" hidden />
            }
          </div>
        </section>

        <section class="form-section">
          <h3>Galería <span class="hint">(máx. 8 imágenes)</span></h3>
          <div class="gallery-grid">
            @for (url of galleryPreviews(); track url; let i = $index) {
              <div class="gallery-thumb">
                <img [src]="url" alt="Galería {{ i + 1 }}" />
                <button type="button" class="remove-thumb" (click)="removeGalleryImage(i)">✕</button>
              </div>
            }
            @if (galleryPreviews().length < 8) {
              <label class="gallery-add" for="gallery-input">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </label>
              <input id="gallery-input" type="file" accept="image/*" multiple (change)="onGalleryChange($event)" hidden />
            }
          </div>
        </section>
      </div>
    </div>

    @if (errorMsg()) {
      <p class="error-banner">{{ errorMsg() }}</p>
    }

    <div class="form-actions">
      <button type="button" (click)="cancelar()">Cancelar</button>
      <button type="submit" class="btn-save" [disabled]="guardando()">
        {{ guardando() ? 'Guardando…' : (isEdit() ? 'Guardar cambios' : 'Crear personaje') }}
      </button>
    </div>
  </form>
</div>
```

- [ ] **Crear SCSS**

```scss
.form-page { max-width: 1100px; }

.form-header {
  display: flex; align-items: center; gap: 16px; margin-bottom: var(--s-6);
  h2 { font-size: 20px; font-weight: 700; color: var(--carbon); margin: 0; }
}

.back-btn {
  background: none; border: none; color: var(--carbon-50); font-size: 13px;
  cursor: pointer; padding: 0;
  &:hover { color: var(--carbon); }
}

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-6); }
.form-col { display: flex; flex-direction: column; gap: var(--s-5); }

.form-section {
  background: var(--paper); border: 1px solid var(--carbon-08); border-radius: var(--r-lg);
  padding: var(--s-5);
  h3 { font-size: 13px; font-weight: 700; color: var(--carbon); text-transform: uppercase;
    letter-spacing: .06em; margin: 0 0 var(--s-4); }
}

.field { display: flex; flex-direction: column; gap: 5px; margin-bottom: var(--s-3);
  label { font-size: 12px; font-weight: 600; color: var(--carbon-60); }
  .req { color: var(--coral); }
  input[type=text], textarea, input[type=email] {
    padding: 8px 10px; border: 1px solid var(--carbon-12); border-radius: var(--r-sm);
    font-size: 14px; color: var(--carbon); background: #fff;
    &:focus { outline: none; border-color: var(--carbon-40); }
  }
  textarea { resize: vertical; }
  .hint { font-size: 11px; color: var(--carbon-40); }
  .err { font-size: 11px; color: var(--coral); }
}

.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-4); }

.color-wrap { display: flex; align-items: center; gap: 8px;
  .color-input { width: 36px; height: 36px; border: 1px solid var(--carbon-12); border-radius: var(--r-sm); padding: 2px; cursor: pointer; }
  .color-text { flex: 1; padding: 8px 10px; border: 1px solid var(--carbon-12); border-radius: var(--r-sm); font-size: 13px; }
}

.toggle-label { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;
  input[type=checkbox] { width: 16px; height: 16px; }
}

.cover-upload { }
.cover-preview { position: relative; display: inline-block;
  img { width: 100%; max-height: 220px; object-fit: cover; border-radius: var(--r-md); display: block; }
  .remove-cover {
    position: absolute; top: 6px; right: 6px; width: 24px; height: 24px;
    border-radius: 50%; background: rgba(0,0,0,.5); color: #fff; border: none;
    cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;
  }
}
.upload-area {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  border: 2px dashed var(--carbon-12); border-radius: var(--r-md); padding: 32px 16px;
  cursor: pointer; color: var(--carbon-40); text-align: center;
  &:hover { border-color: var(--carbon-30); background: var(--carbon-04); }
  span { font-size: 13px; }
  .hint { font-size: 11px; }
}

.gallery-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
}
.gallery-thumb {
  position: relative; aspect-ratio: 1; border-radius: var(--r-sm); overflow: hidden;
  img { width: 100%; height: 100%; object-fit: cover; }
  .remove-thumb {
    position: absolute; top: 3px; right: 3px; width: 20px; height: 20px;
    border-radius: 50%; background: rgba(0,0,0,.5); color: #fff; border: none;
    cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center;
  }
}
.gallery-add {
  aspect-ratio: 1; border: 2px dashed var(--carbon-12); border-radius: var(--r-sm);
  display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--carbon-30);
  &:hover { border-color: var(--carbon-40); color: var(--carbon); }
}

.error-banner {
  margin: var(--s-4) 0; padding: 10px 14px; background: #fee; border-radius: var(--r-sm);
  color: #c00; font-size: 13px;
}

.form-actions {
  display: flex; justify-content: flex-end; gap: 10px; margin-top: var(--s-6);
  button {
    padding: 9px 20px; border-radius: var(--r-md); border: 1px solid var(--carbon-12);
    background: #fff; font-size: 13px; cursor: pointer;
    &:disabled { opacity: .5; cursor: not-allowed; }
  }
  .btn-save {
    background: var(--carbon); color: var(--paper); border-color: var(--carbon);
    font-weight: 600;
    &:hover:not(:disabled) { background: #2d3d4d; }
  }
}

@media (max-width: 768px) {
  .form-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | head -30
```

- [ ] **Commit**

```bash
git add src/app/pages/admin/personajes/personaje-form.component.ts src/app/pages/admin/personajes/personaje-form.component.html src/app/pages/admin/personajes/personaje-form.component.scss
git commit -m "feat(personajes): admin form component (create/edit) with image upload"
```

---

## Task 6: PersonajeDetailComponent

**Files:**
- Create: `src/app/pages/admin/personajes/personaje-detail.component.ts`
- Create: `src/app/pages/admin/personajes/personaje-detail.component.html`
- Create: `src/app/pages/admin/personajes/personaje-detail.component.scss`

- [ ] **Crear el componente TypeScript**

```typescript
import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { PersonajesService, Personaje } from '../../../core/services/personajes.service';
import { InventarioService } from '../../../core/services/inventario.service';

@Component({
  selector: 'app-personaje-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './personaje-detail.component.html',
  styleUrl: './personaje-detail.component.scss',
})
export class PersonajeDetailComponent implements OnInit {
  readonly svc     = inject(PersonajesService);
  readonly inv     = inject(InventarioService);
  private router   = inject(Router);
  private route    = inject(ActivatedRoute);

  personaje        = signal<Personaje | null>(null);
  productoCount    = signal(0);
  confirmDelete    = signal(false);

  readonly selectedGalleryImg = signal<string | null>(null);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    await this.svc.load();
    const p = this.svc.personajes().find(x => x.id === id);
    if (!p) { this.router.navigate(['/admin/personajes']); return; }
    this.personaje.set(p);
    if (p.galeria_urls.length > 0) this.selectedGalleryImg.set(p.galeria_urls[0]);

    await this.inv.cargarTodos();
    this.productoCount.set(
      this.inv.productos().filter(pr => pr.personaje === p.key).length
    );
  }

  goEditar() { this.router.navigate(['/admin/personajes', this.personaje()!.id, 'editar']); }
  goLista()  { this.router.navigate(['/admin/personajes']); }
  goSitio()  { window.open(`/cuaquiverso/personaje/${this.personaje()!.key}`, '_blank'); }

  async deleteConfirmed() {
    const id = this.personaje()?.id;
    if (!id) return;
    await this.svc.delete(id);
    this.router.navigate(['/admin/personajes']);
  }
}
```

- [ ] **Crear la plantilla HTML**

```html
@if (personaje(); as p) {
<div class="detail-page">
  <div class="detail-header">
    <button class="back-btn" (click)="goLista()">← Personajes</button>
    <div class="header-actions">
      <button (click)="goSitio()">Ver en sitio →</button>
      <button (click)="goEditar()">Editar</button>
      <button class="btn-danger" (click)="confirmDelete.set(true)">Eliminar</button>
    </div>
  </div>

  <div class="detail-body">
    <!-- Cover -->
    <div class="cover-col">
      @if (p.cover_url) {
        <img class="cover-img" [src]="p.cover_url" [alt]="p.nombre" />
      } @else {
        <div class="cover-placeholder" [style.background]="p.color ?? '#ccc'">
          <span>{{ p.nombre[0] }}</span>
        </div>
      }
      <div class="status-chip" [class.active]="p.activo">
        {{ p.activo ? 'Activo' : 'Inactivo' }}
      </div>
      <div class="product-count">
        <strong>{{ productoCount() }}</strong> productos vinculados
      </div>
    </div>

    <!-- Data -->
    <div class="data-col">
      <div class="name-row">
        <h2>{{ p.nombre }}</h2>
        <span class="key-chip">{{ p.key }}</span>
        <div class="color-dots">
          <span [style.background]="p.color ?? '#ccc'" title="Color principal"></span>
          <span [style.background]="p.wire_color ?? '#ccc'" title="Wire color"></span>
        </div>
      </div>

      @if (p.slogan) {
        <p class="slogan">"{{ p.slogan }}"</p>
      }

      <div class="fields-grid">
        <div class="field-item"><span class="lbl">Región</span><span class="val">{{ p.region ?? '—' }}</span></div>
        <div class="field-item"><span class="lbl">Música</span><span class="val">{{ p.musica ?? '—' }}</span></div>
        <div class="field-item"><span class="lbl">Personalidad</span><span class="val">{{ p.personalidad ?? '—' }}</span></div>
        <div class="field-item"><span class="lbl">Fauna / flora</span><span class="val">{{ p.fauna_flora ?? '—' }}</span></div>
        <div class="field-item"><span class="lbl">Orden</span><span class="val">#{{ p.sort_order }}</span></div>
      </div>

      @if (p.bio) {
        <div class="bio-block">
          <span class="lbl">Bio</span>
          <p>{{ p.bio }}</p>
        </div>
      }
    </div>
  </div>

  <!-- Gallery -->
  @if (p.galeria_urls.length > 0) {
    <section class="gallery-section">
      <h3>Galería</h3>
      <div class="gallery-main-wrap">
        <div class="gallery-main">
          <img [src]="selectedGalleryImg() ?? p.galeria_urls[0]" alt="Galería principal" />
        </div>
        <div class="gallery-thumbs">
          @for (url of p.galeria_urls; track url) {
            <div class="thumb" [class.selected]="selectedGalleryImg() === url" (click)="selectedGalleryImg.set(url)">
              <img [src]="url" alt="Thumbnail" />
            </div>
          }
        </div>
      </div>
    </section>
  }
</div>

@if (confirmDelete()) {
  <div class="confirm-overlay">
    <div class="confirm-box">
      <p>¿Eliminar a <strong>{{ p.nombre }}</strong>? Esta acción no se puede deshacer.</p>
      <div class="confirm-actions">
        <button (click)="confirmDelete.set(false)">Cancelar</button>
        <button class="btn-danger" (click)="deleteConfirmed()">Eliminar</button>
      </div>
    </div>
  </div>
}
}
```

- [ ] **Crear SCSS**

```scss
.detail-page { max-width: 960px; }

.detail-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: var(--s-6);
  .header-actions { display: flex; gap: 8px;
    button {
      padding: 7px 14px; border-radius: var(--r-md); border: 1px solid var(--carbon-12);
      background: #fff; font-size: 13px; cursor: pointer;
      &:hover { background: var(--carbon-04); }
    }
    .btn-danger { border-color: #c00; color: #c00;
      &:hover { background: #fee; }
    }
  }
}

.back-btn { background: none; border: none; color: var(--carbon-50); font-size: 13px; cursor: pointer; padding: 0; }

.detail-body { display: grid; grid-template-columns: 280px 1fr; gap: var(--s-7); margin-bottom: var(--s-8); }

.cover-col {
  .cover-img { width: 100%; border-radius: var(--r-lg); display: block; }
  .cover-placeholder {
    width: 100%; aspect-ratio: 1; border-radius: var(--r-lg);
    display: flex; align-items: center; justify-content: center;
    span { font-size: 72px; font-weight: 800; color: rgba(255,255,255,.5); font-family: var(--display); }
  }
  .status-chip {
    display: inline-block; margin-top: 10px; padding: 4px 12px;
    border-radius: 20px; font-size: 12px; font-weight: 600;
    background: #f0f0eb; color: var(--carbon-50);
    &.active { background: #e8f5ee; color: #1F8A5B; }
  }
  .product-count { margin-top: 8px; font-size: 13px; color: var(--carbon-60);
    strong { font-weight: 700; color: var(--carbon); }
  }
}

.data-col { }

.name-row {
  display: flex; align-items: center; gap: 10px; margin-bottom: var(--s-4);
  h2 { font-size: 28px; font-weight: 700; margin: 0; }
  .key-chip { padding: 3px 8px; background: var(--carbon-04); border-radius: 4px; font-size: 11px; font-family: var(--mono); color: var(--carbon-60); }
  .color-dots { display: flex; gap: 5px;
    span { width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(0,0,0,.08); }
  }
}

.slogan { font-style: italic; color: var(--carbon-60); font-size: 15px; margin-bottom: var(--s-5); }

.fields-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--s-3);
  margin-bottom: var(--s-5);
}
.field-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 10px 12px; background: var(--paper); border-radius: var(--r-sm); border: 1px solid var(--carbon-08);
  .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: var(--carbon-40); }
  .val { font-size: 14px; font-weight: 600; color: var(--carbon); }
}

.bio-block {
  .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: var(--carbon-40); display: block; margin-bottom: 6px; }
  p { font-size: 14px; color: var(--carbon-70); line-height: 1.65; }
}

.gallery-section {
  h3 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--carbon-50); margin-bottom: var(--s-4); }
}

.gallery-main-wrap { display: grid; grid-template-columns: 1fr 120px; gap: 10px; }
.gallery-main { border-radius: var(--r-lg); overflow: hidden;
  img { width: 100%; display: block; object-fit: cover; max-height: 360px; }
}
.gallery-thumbs { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
.thumb { border-radius: var(--r-sm); overflow: hidden; cursor: pointer; border: 2px solid transparent;
  img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
  &.selected { border-color: var(--carbon); }
}

.confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.confirm-box { background: #fff; border-radius: var(--r-lg); padding: 24px; max-width: 360px; box-shadow: 0 8px 32px rgba(0,0,0,.16);
  p { font-size: 14px; margin-bottom: 20px; }
}
.confirm-actions { display: flex; gap: 10px; justify-content: flex-end;
  button { padding: 8px 16px; border-radius: var(--r-md); border: 1px solid var(--carbon-12); background: #fff; cursor: pointer; font-size: 13px; }
  .btn-danger { background: #c00; color: #fff; border-color: #c00; }
}
```

- [ ] **Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | head -30
```

- [ ] **Commit**

```bash
git add src/app/pages/admin/personajes/personaje-detail.component.ts src/app/pages/admin/personajes/personaje-detail.component.html src/app/pages/admin/personajes/personaje-detail.component.scss
git commit -m "feat(personajes): admin detail view with gallery and product count"
```

---

## Task 7: PersonajePageComponent (página pública)

**Files:**
- Create: `src/app/pages/cuaquiverso/personaje/personaje-page.component.ts`
- Create: `src/app/pages/cuaquiverso/personaje/personaje-page.component.html`
- Create: `src/app/pages/cuaquiverso/personaje/personaje-page.component.scss`

- [ ] **Crear el componente TypeScript**

```typescript
import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { PersonajesService, Personaje } from '../../../core/services/personajes.service';
import { InventarioService, ProductoEvento } from '../../../core/services/inventario.service';
import { CartService } from '../services/cart.service';
import { CartModalComponent } from '../cart-modal/cart-modal.component';
import { SeoService } from '../../../core/services/seo.service';

@Component({
  selector: 'app-personaje-page',
  standalone: true,
  imports: [CommonModule, CartModalComponent],
  templateUrl: './personaje-page.component.html',
  styleUrl: './personaje-page.component.scss',
})
export class PersonajePageComponent implements OnInit {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private seo     = inject(SeoService);
  readonly svcP   = inject(PersonajesService);
  readonly svcI   = inject(InventarioService);
  readonly cart   = inject(CartService);

  personaje        = signal<Personaje | null>(null);
  productos        = signal<ProductoEvento[]>([]);
  selectedImg      = signal<string | null>(null);

  prev = computed(() => {
    const p = this.personaje();
    if (!p) return null;
    const all = this.svcP.activos();
    const idx = all.findIndex(x => x.id === p.id);
    return idx > 0 ? all[idx - 1] : null;
  });

  next = computed(() => {
    const p = this.personaje();
    if (!p) return null;
    const all = this.svcP.activos();
    const idx = all.findIndex(x => x.id === p.id);
    return idx < all.length - 1 ? all[idx + 1] : null;
  });

  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    await this.svcP.load();
    const p = this.svcP.activos().find(x => x.key === slug);
    if (!p) { this.router.navigate(['/cuaquiverso/universo']); return; }
    this.personaje.set(p);
    if (p.galeria_urls.length > 0) this.selectedImg.set(p.galeria_urls[0]);

    this.seo.set({
      title:       `${p.nombre} — Cuaquiverso`,
      description: p.bio ? p.bio.slice(0, 160) : `Conoce a ${p.nombre} del Cuaquiverso.`,
      canonical:   `https://cuacdesign.com/cuaquiverso/personaje/${p.key}`,
    });

    await this.svcI.cargarTodos();
    this.productos.set(
      this.svcI.productos().filter(pr => pr.personaje === slug && pr.activo)
    );
  }

  addToCart(event: Event, p: ProductoEvento) {
    event.preventDefault();
    event.stopPropagation();
    this.cart.add(p);
  }
}
```

- [ ] **Crear la plantilla HTML**

```html
@if (personaje(); as p) {

<!-- Topbar -->
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="/cuaquiverso">
      <span class="b1">Cuaqui</span><span class="dot"></span><span class="b2">verso</span>
    </a>
    <nav class="primary">
      <a href="/cuaquiverso/tienda">Tienda</a>
      <a href="/cuaquiverso/universo">Universo</a>
    </nav>
    <div class="top-actions">
      <button class="icon-btn" aria-label="Carrito" (click)="cart.open()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4h2l2.5 12.5h11L21 7H7"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>
        @if (cart.count() > 0) { <span class="badge">{{ cart.count() }}</span> }
      </button>
    </div>
  </div>
</header>

<!-- Hero -->
<section class="pj-hero" [style.--pj-color]="p.color ?? '#2A6FDB'">
  <div class="pj-hero-inner">
    <div class="crumbs">
      <a href="/cuaquiverso">Inicio</a><span>/</span>
      <a href="/cuaquiverso/universo">Universo</a><span>/</span>
      <span>{{ p.nombre }}</span>
    </div>
    <div class="pj-num">{{ String(p.sort_order).padStart(2, '0') }}</div>
    <h1>{{ p.nombre }}</h1>
    @if (p.slogan) {
      <p class="pj-slogan">{{ p.slogan }}</p>
    }
  </div>
</section>

<!-- Identity strip -->
@if (p.region || p.musica || p.personalidad || p.fauna_flora) {
  <div class="pj-identity">
    @if (p.region) {
      <div class="id-cell">
        <span class="id-lbl">Región</span>
        <span class="id-val">{{ p.region }}</span>
      </div>
    }
    @if (p.musica) {
      <div class="id-cell">
        <span class="id-lbl">Música</span>
        <span class="id-val">{{ p.musica }}</span>
      </div>
    }
    @if (p.personalidad) {
      <div class="id-cell">
        <span class="id-lbl">Carácter</span>
        <span class="id-val">{{ p.personalidad }}</span>
      </div>
    }
    @if (p.fauna_flora) {
      <div class="id-cell">
        <span class="id-lbl">Fauna / flora</span>
        <span class="id-val">{{ p.fauna_flora }}</span>
      </div>
    }
  </div>
}

<!-- Bio -->
@if (p.bio) {
  <section class="pj-section pj-bio">
    <div class="pj-section-inner">
      <div class="eyebrow"><span class="dot-sm"></span> Sobre {{ p.nombre }}</div>
      <p>{{ p.bio }}</p>
    </div>
  </section>
}

<!-- Gallery -->
@if (p.galeria_urls.length > 0) {
  <section class="pj-section pj-gallery">
    <div class="pj-section-inner">
      <div class="eyebrow"><span class="dot-sm"></span> Galería</div>
      <div class="gallery-layout">
        <div class="gallery-main">
          <img [src]="selectedImg() ?? p.galeria_urls[0]" [alt]="p.nombre" />
        </div>
        @if (p.galeria_urls.length > 1) {
          <div class="gallery-thumbs">
            @for (url of p.galeria_urls; track url) {
              <div
                class="gallery-thumb"
                [class.active]="selectedImg() === url"
                (click)="selectedImg.set(url)">
                <img [src]="url" [alt]="p.nombre" />
              </div>
            }
          </div>
        }
      </div>
    </div>
  </section>
}

<!-- Productos -->
@if (productos().length > 0) {
  <section class="pj-section pj-productos">
    <div class="pj-section-inner">
      <div class="eyebrow"><span class="dot-sm"></span> Objetos de {{ p.nombre }}</div>
      <div class="productos-scroll">
        @for (pr of productos(); track pr.id) {
          <a class="prod-card" href="/cuaquiverso/tienda">
            <div class="prod-img" [style.background]="pr.color ?? '#eee'">
              @if (pr.cover_url) { <img [src]="pr.cover_url" [alt]="pr.nombre" /> }
            </div>
            <div class="prod-info">
              <span class="prod-name">{{ pr.nombre }}</span>
              <span class="prod-sub">{{ pr.categoria }}</span>
              <span class="prod-price">${{ pr.precio | number:'1.0-0' }}</span>
            </div>
            <button class="prod-cart" (click)="addToCart($event, pr)">+ Carrito</button>
          </a>
        }
      </div>
    </div>
  </section>
}

<!-- Nav entre personajes -->
<nav class="pj-nav">
  @if (prev(); as prevP) {
    <a class="pj-nav-item prev" [href]="'/cuaquiverso/personaje/' + prevP.key">
      <span class="nav-dir">← Anterior</span>
      <span class="nav-name">{{ prevP.nombre }}</span>
    </a>
  } @else {
    <div></div>
  }
  <a class="pj-nav-all" href="/cuaquiverso/universo">Ver todos</a>
  @if (next(); as nextP) {
    <a class="pj-nav-item next" [href]="'/cuaquiverso/personaje/' + nextP.key">
      <span class="nav-dir">Siguiente →</span>
      <span class="nav-name">{{ nextP.nombre }}</span>
    </a>
  } @else {
    <div></div>
  }
</nav>

}

<app-cart-modal />
```

**Nota:** En el componente TypeScript necesita `String` disponible. Añadir al TS:
```typescript
readonly String = String;
```

- [ ] **Crear SCSS**

```scss
// ─── Topbar (igual que universo) ─────────────────────────────────────────────
.topbar { background: var(--carbon); border-bottom: 1px solid rgba(240,241,246,.08); position: sticky; top: 0; z-index: 10; }
.topbar-inner { max-width: 1320px; margin: 0 auto; padding: 0 var(--s-7); height: 56px; display: flex; align-items: center; gap: var(--s-6); }
.brand { display: flex; align-items: center; gap: 3px; text-decoration: none; font-family: var(--display); font-size: 20px; font-weight: 700;
  .b1 { color: var(--paper); } .dot { width: 6px; height: 6px; background: var(--coral); border-radius: 50%; } .b2 { color: var(--coral); }
}
.primary { display: flex; gap: var(--s-5); margin-left: auto;
  a { text-decoration: none; font-size: 13px; color: rgba(240,241,246,.55); transition: color .2s;
    &:hover { color: var(--paper); }
  }
}
.top-actions { display: flex; gap: var(--s-3); }
.icon-btn { background: none; border: none; color: rgba(240,241,246,.7); cursor: pointer; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: var(--r-sm); position: relative;
  &:hover { color: var(--paper); }
  svg { width: 18px; height: 18px; }
}
.badge { position: absolute; top: 4px; right: 4px; min-width: 16px; height: 16px; background: var(--coral); color: #fff; border-radius: 8px; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; padding: 0 3px; }

// ─── Hero ─────────────────────────────────────────────────────────────────────
.pj-hero {
  background: var(--pj-color, #2A6FDB);
  padding: var(--s-10) var(--s-7) var(--s-9);
  position: relative; overflow: hidden;
  &::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 70% 30%, rgba(255,255,255,.07), transparent 60%); pointer-events: none; }
}
.pj-hero-inner { max-width: 1320px; margin: 0 auto; position: relative; }
.crumbs { display: flex; align-items: center; gap: 6px; font-size: 11px; color: rgba(255,255,255,.45); margin-bottom: var(--s-5);
  a { color: rgba(255,255,255,.45); text-decoration: none; &:hover { color: rgba(255,255,255,.7); } }
  span { color: rgba(255,255,255,.25); }
}
.pj-num { font-family: var(--display); font-size: clamp(80px,12vw,160px); font-weight: 800; color: rgba(255,255,255,.06); line-height: 1; position: absolute; right: 0; top: -20px; letter-spacing: -.04em; }
h1 { font-family: var(--display); font-size: clamp(56px,8vw,96px); font-weight: 400; color: #fff; line-height: 1; letter-spacing: -.03em; margin: 0 0 var(--s-4); }
.pj-slogan { font-size: clamp(15px,1.8vw,18px); color: rgba(255,255,255,.7); font-style: italic; max-width: 46ch; line-height: 1.5; margin: 0; }

// ─── Identity strip ───────────────────────────────────────────────────────────
.pj-identity {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  border-bottom: 1px solid var(--carbon-08);
}
.id-cell {
  padding: var(--s-4) var(--s-6); border-right: 1px solid var(--carbon-08);
  &:last-child { border-right: none; }
  display: flex; flex-direction: column; gap: 4px;
}
.id-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: .14em; color: var(--carbon-40); }
.id-val { font-size: 13px; font-weight: 600; color: var(--carbon); }

// ─── Sections ─────────────────────────────────────────────────────────────────
.pj-section { border-bottom: 1px solid var(--carbon-08); }
.pj-section-inner { max-width: 1320px; margin: 0 auto; padding: var(--s-8) var(--s-7); }
.eyebrow { display: flex; align-items: center; gap: var(--s-3); font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: var(--carbon-40); margin-bottom: var(--s-5); }
.dot-sm { width: 6px; height: 6px; background: var(--coral); border-radius: 50%; flex-shrink: 0; }

// ─── Bio ──────────────────────────────────────────────────────────────────────
.pj-bio p { font-size: clamp(15px,1.6vw,17px); color: var(--carbon-70); line-height: 1.7; max-width: 70ch; }

// ─── Gallery ──────────────────────────────────────────────────────────────────
.gallery-layout { display: grid; grid-template-columns: 1fr 130px; gap: 12px; }
.gallery-main { border-radius: var(--r-lg); overflow: hidden;
  img { width: 100%; display: block; object-fit: cover; max-height: 480px; transition: opacity .2s; }
}
.gallery-thumbs { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 480px; }
.gallery-thumb { border-radius: var(--r-sm); overflow: hidden; cursor: pointer; border: 2px solid transparent; flex-shrink: 0;
  img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
  &.active { border-color: var(--carbon); }
  &:hover { opacity: .85; }
}

// ─── Productos ────────────────────────────────────────────────────────────────
.productos-scroll { display: flex; gap: var(--s-4); overflow-x: auto; padding-bottom: var(--s-3); }
.prod-card {
  min-width: 180px; background: var(--paper); border: 1px solid var(--carbon-08);
  border-radius: var(--r-lg); overflow: hidden; text-decoration: none; flex-shrink: 0;
  display: flex; flex-direction: column;
  &:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); }
}
.prod-img { aspect-ratio: 1; overflow: hidden; position: relative;
  img { width: 100%; height: 100%; object-fit: cover; }
}
.prod-info { padding: 10px 12px; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.prod-name { font-size: 13px; font-weight: 600; color: var(--carbon); }
.prod-sub { font-size: 11px; color: var(--carbon-50); text-transform: capitalize; }
.prod-price { font-size: 14px; font-weight: 700; color: var(--carbon); margin-top: 4px; }
.prod-cart {
  margin: 0 12px 12px; padding: 7px; border: 1px solid var(--carbon-12); border-radius: var(--r-sm);
  background: #fff; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--carbon);
  &:hover { background: var(--carbon); color: var(--paper); }
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
.pj-nav {
  display: grid; grid-template-columns: 1fr auto 1fr;
  align-items: center; gap: var(--s-5);
  padding: var(--s-7) var(--s-7);
  max-width: 1320px; margin: 0 auto;
  border-top: 1px solid var(--carbon-08);
}
.pj-nav-item {
  display: flex; flex-direction: column; gap: 2px; text-decoration: none;
  .nav-dir { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--carbon-40); }
  .nav-name { font-family: var(--display); font-size: 20px; color: var(--carbon); font-weight: 400; }
  &.next { text-align: right; }
  &:hover .nav-name { color: var(--coral); }
}
.pj-nav-all { font-size: 12px; color: var(--carbon-50); text-decoration: none; text-align: center;
  &:hover { color: var(--carbon); }
}

@media (max-width: 768px) {
  .gallery-layout { grid-template-columns: 1fr; }
  .gallery-thumbs { flex-direction: row; max-height: none; overflow-x: auto; }
  .gallery-thumb { min-width: 70px; }
  .pj-nav { grid-template-columns: 1fr 1fr; }
  .pj-nav-all { display: none; }
}
```

- [ ] **Verificar compilación**

```bash
npx ng build --configuration development 2>&1 | head -30
```

- [ ] **Commit**

```bash
git add src/app/pages/cuaquiverso/personaje/
git commit -m "feat(personajes): public character page /cuaquiverso/personaje/:slug"
```

---

## Task 8: Conectar cuaquiverso.component (El elenco)

**Files:**
- Modify: `src/app/pages/cuaquiverso/cuaquiverso.component.ts`
- Modify: `src/app/pages/cuaquiverso/cuaquiverso.component.html`

- [ ] **Actualizar `cuaquiverso.component.ts`**

Añadir `inject(PersonajesService)` y modificar `initHeroScene` para que lea del servicio. El array de personajes del Three.js hero también viene del servicio.

Cambios al fichero (conservar todo el código existente, solo añadir/modificar):

1. Añadir import:
```typescript
import { PersonajesService } from '../../core/services/personajes.service';
```

2. En la clase, añadir:
```typescript
readonly personajesSvc = inject(PersonajesService);
readonly String = String;
```

3. En `ngOnInit`, añadir al inicio:
```typescript
await this.personajesSvc.load();
```
(hacer `ngOnInit` async si no lo es)

4. En `initHeroScene`, reemplazar el array hardcodeado `characters`:
```typescript
// Reemplazar:
// const characters: Character[] = [ { key: 'cuac', ... }, ... ];
// Por:
const characters: Character[] = this.personajesSvc.activos().map(p => ({
  key:   p.key,
  name:  p.nombre + (p.personalidad ? ` · ${p.personalidad}` : ''),
  color: p.color  ?? '#2A6FDB',
  wire:  p.wire_color ?? '#5C95EA',
}));
if (characters.length === 0) return; // guard: data not ready
```

- [ ] **Actualizar la sección elenco en `cuaquiverso.component.html`**

Localizar el bloque `<div class="cast-row">` y sus 8 `<a class="cast-card">` hardcodeados. Reemplazar con:

```html
<div class="cast-row">
  @for (p of personajesSvc.activos(); track p.id) {
    <a class="cast-card" [attr.data-c]="p.key" [href]="'/cuaquiverso/personaje/' + p.key">
      <div class="face" [style.background]="p.color ?? '#ccc'">{{ p.nombre[0] }}</div>
      <div class="nm">
        <span class="n1">{{ p.nombre }}</span>
        <span class="n2">{{ p.region ?? '' }}</span>
      </div>
    </a>
  }
</div>
```

- [ ] **Verificar compilación y comportamiento**

```bash
npx ng build --configuration development 2>&1 | head -30
```

Arrancar dev server y navegar a `/cuaquiverso`. Verificar que los cast-cards del elenco muestran los personajes de Supabase y los links llevan a `/cuaquiverso/personaje/:key`.

- [ ] **Commit**

```bash
git add src/app/pages/cuaquiverso/cuaquiverso.component.ts src/app/pages/cuaquiverso/cuaquiverso.component.html
git commit -m "feat(personajes): connect El elenco section and Three.js hero to PersonajesService"
```

---

## Task 9: Conectar universo.component

**Files:**
- Modify: `src/app/pages/cuaquiverso/universo/universo.component.ts`
- Modify: `src/app/pages/cuaquiverso/universo/universo.component.html`

- [ ] **Actualizar `universo.component.ts`**

Añadir:
```typescript
import { PersonajesService } from '../../../core/services/personajes.service';
```

En la clase:
```typescript
readonly personajesSvc = inject(PersonajesService);
```

En `ngOnInit` (crear si no existe, o añadir al inicio):
```typescript
async ngOnInit(): Promise<void> {
  await this.personajesSvc.load();
  // ... código SEO existente si está en ngOnInit
}
```

Si el SEO está en `ngOnInit`, mantenerlo. Si está en el constructor, moverlo a `ngOnInit`.

- [ ] **Actualizar `universo.component.html` — índice de personajes**

Localizar los `<a class="ch-index-row">` con `href="#"` hardcodeados (son 8 links). Reemplazar el bloque completo con:

```html
<div class="ch-index" data-reveal data-reveal-delay="1">
  @for (p of personajesSvc.activos(); track p.id; let i = $index) {
    <a class="ch-index-row" [style.--ci]="p.color" [href]="'/cuaquiverso/personaje/' + p.key">
      <span class="ci-n">{{ String(i + 1).padStart(2, '0') }}</span>
      <span class="ci-name">{{ p.nombre }}</span>
      <span class="ci-region">{{ p.region ?? '' }}</span>
      <span class="ci-arr">→</span>
    </a>
  }
</div>
```

Añadir `readonly String = String;` al componente TS.

- [ ] **Actualizar `universo.component.html` — grid de personajes**

Reemplazar el bloque `<section class="uni-grid">` completo (desde `<!-- CHARACTER GRID -->` hasta el cierre `</section>`) con:

```html
<!-- CHARACTER GRID -->
<section class="uni-grid">
  @for (p of personajesSvc.activos(); track p.id; let i = $index) {
    <a
      class="ch-card"
      [class.feat]="i < 2"
      [class.med]="i >= 2 && i < 5"
      [class.sm]="i >= 5"
      [attr.data-c]="p.key"
      [href]="'/cuaquiverso/personaje/' + p.key"
      data-reveal
      [attr.data-reveal-delay]="i % 3">
      <div class="art" [style.--ch-color]="p.color ?? '#2A6FDB'">
        <span class="corner">N° {{ String(i + 1).padStart(2, '0') }}</span>
        <span class="badge-region">{{ (p.region ?? '').split('·')[1]?.trim() || p.region }}</span>
        <div class="glyph">{{ p.nombre.slice(0, i < 2 ? p.nombre.length : 2) }}</div>
      </div>
      <div class="info">
        <h3>{{ p.nombre }}</h3>
        @if (p.personalidad) { <span class="arch">{{ p.personalidad }}</span> }
        @if (p.bio) { <p class="tag">{{ p.bio.length > 80 ? p.bio.slice(0, 80) + '…' : p.bio }}</p> }
        <div class="meta">
          @if (p.musica) { <span>{{ p.musica }}</span> }
          <span class="open">{{ i < 2 ? 'Ficha completa' : 'Conocer' }}</span>
        </div>
      </div>
    </a>
  }
  <!-- Próximamente — siempre estático al final -->
  <a class="ch-card sm proxim" href="#" data-reveal>
    <div class="art">
      <span class="corner">2026 · Próximamente</span>
      <div class="glyph proxim-glyph">+</div>
    </div>
    <div class="info">
      <h3 class="muted">Vol. 02</h3>
      <span class="arch muted">Nuevos personajes en camino</span>
      <p class="tag">El mapa sigue creciendo. Suscríbete y entérate primero.</p>
      <div class="meta"><span>En desarrollo</span><span class="muted">—</span></div>
    </div>
  </a>
</section>
```

- [ ] **Verificar**

```bash
npx ng build --configuration development 2>&1 | head -30
```

Navegar a `/cuaquiverso/universo`. Verificar que el índice muestra los personajes de Supabase con links funcionales a sus páginas individuales.

- [ ] **Commit**

```bash
git add src/app/pages/cuaquiverso/universo/universo.component.ts src/app/pages/cuaquiverso/universo/universo.component.html
git commit -m "feat(personajes): connect universo page index and grid to PersonajesService"
```

---

## Verificación final

- [ ] Navegar a `/admin` → Universo → Personajes: lista de 8 personajes con drag-reorder funcional
- [ ] Crear un personaje nuevo desde el admin con imagen de cover y 2 fotos de galería
- [ ] Editar el personaje recién creado, cambiar su bio y agregar otra foto
- [ ] Ver el detalle del personaje: cover, galería, contador de productos
- [ ] Reordenar los personajes arrastrando; verificar que el orden se persiste tras recargar
- [ ] Navegar a `/cuaquiverso`: la sección El elenco muestra datos reales, los cards linkean a páginas individuales
- [ ] Navegar a `/cuaquiverso/personaje/cuac`: hero con color del personaje, strip de identidad, nav prev/next
- [ ] Navegar a `/cuaquiverso/universo`: los links del índice llevan a las páginas individuales
- [ ] Navegar a un slug inválido (`/cuaquiverso/personaje/noexiste`): redirige a `/cuaquiverso/universo`
